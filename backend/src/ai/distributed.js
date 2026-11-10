/**
 * Coordinador de IA distribuida (patrón maestro-trabajadores).
 *
 * Misma interfaz que `AiPool` (choose, density, tournament, stats, close), pero las tareas viajan por la red a
 * NODOS (ver node-server.js), cada uno con sus propios worker threads. Dos niveles de paralelismo:
 * entre máquinas/procesos (distribuido) y dentro de cada nodo (hilos).
 *
 * Decisiones de diseño (para el informe):
 *  - Comunicación por MENSAJES: la memoria compartida no cruza procesos, así que `density` fuerza `mode: 'message'`.
 *  - Balanceo: cada tarea va al nodo con menos carga relativa (tareas en vuelo / hilos), con desempate al azar.
 *  - Tolerancia a fallos: si un nodo falla, se marca caído unos segundos (*circuit breaker*) y la tarea se
 *    REINTENTA en otro. Es seguro porque las tareas son idempotentes (la semilla fija el resultado).
 *  - Sin ningún nodo disponible, usa `fallback` (un AiPool local) en vez de dejar sin jugada a la sala.
 *  - Cancelación: abortar la petición HTTP hace que el nodo detenga el cálculo.
 */
import { AiPool } from './pool.js';
import { decode, encode } from './wire.js';

const DEFAULT_COOLDOWN_MS = 5000;

export class DistributedPool extends AiPool {
  /**
   * @param {object} o
   * @param {string[]} o.nodes             URLs base de los nodos, p. ej. ['http://10.0.0.5:5001']
   * @param {string} o.token               secreto compartido con los nodos
   * @param {AiPool} [o.fallback]          pool local por si no hay ningún nodo disponible
   * @param {number} [o.retries]           reintentos en OTROS nodos tras un fallo
   * @param {number} [o.cooldownMs]        cuánto se considera caído un nodo tras fallar
   * @param {number} [o.healthIntervalMs]  cada cuánto se consulta /health (0 = nunca)
   */
  constructor({ nodes, token, fallback = null, retries = 2, cooldownMs = DEFAULT_COOLDOWN_MS, healthIntervalMs = 5000, ...poolOpts }) {
    super({ ...poolOpts, size: 0 });
    this.inline = false; // el trabajo NO se hace aquí: va a los nodos
    this.token = token;
    this.fallback = fallback;
    this.retries = retries;
    this.cooldownMs = cooldownMs;
    this.nodes = nodes.map((url) => ({ url: url.replace(/\/+$/, ''), capacity: 1, inflight: 0, downUntil: 0, failures: 0, completed: 0 }));
    this.inflight = new Set(); // AbortControllers de las peticiones en curso
    this.fellBack = 0;
    this.retried = 0;
    this.ready = this.refresh();
    if (healthIntervalMs > 0) {
      this.healthTimer = setInterval(() => this.refresh(), healthIntervalMs);
      this.healthTimer.unref();
    }
  }

  get parallelism() { return Math.max(1, this.nodes.reduce((sum, n) => sum + n.capacity, 0)); }

  /** "Cola" distribuida: tareas en vuelo por encima de lo que los nodos pueden ejecutar a la vez. */
  queueLength() { return Math.max(0, this.nodes.reduce((a, n) => a + n.inflight, 0) - this.parallelism); }

  /** Consulta /health de cada nodo: actualiza su capacidad y si está vivo. */
  async refresh() {
    await Promise.all(this.nodes.map(async (node) => {
      try {
        const res = await fetch(`${node.url}/health`, { headers: { authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(2000) });
        if (!res.ok) throw new Error(`health ${res.status}`);
        const info = await res.json();
        node.capacity = Math.max(1, info.workers ?? 1);
        node.downUntil = 0;
      } catch {
        node.downUntil = Date.now() + this.cooldownMs;
      }
    }));
  }

  #pick(tried) {
    const now = Date.now();
    const candidates = this.nodes.filter((n) => !tried.has(n));
    const alive = candidates.filter((n) => n.downUntil <= now);
    const pool = alive.length ? alive : candidates; // sin nodos sanos: se prueba uno caído (puede haberse recuperado)
    if (!pool.length) return null;
    const load = (n) => n.inflight / n.capacity;
    const best = Math.min(...pool.map(load));
    const ties = pool.filter((n) => load(n) === best);
    return ties[Math.floor(Math.random() * ties.length)];
  }

  async #post(node, task, timeoutMs, signal) {
    const ctrl = new AbortController();
    this.inflight.add(ctrl);
    const stop = AbortSignal.any([ctrl.signal, AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    node.inflight += 1;
    try {
      const res = await fetch(`${node.url}/task`, {
        method: 'POST', body: encode(task), signal: stop,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      });
      const body = decode(await res.text());
      if (!res.ok) throw Object.assign(new Error(body.error ?? `http_${res.status}`), { status: res.status });
      return body;
    } finally {
      node.inflight -= 1;
      this.inflight.delete(ctrl);
    }
  }

  async submit(msg, { timeoutMs = this.timeoutMs, signal } = {}) {
    if (this.closed) throw new Error('pool_cerrado');
    if (signal?.aborted) { this.cancelled += 1; throw new Error('cancelado'); }
    // Lo que solo existe en memoria local no viaja: los nodos crean sus propias banderas.
    const { cancelBuf: _c, shotsBuf: _s, densityBuf: _d, ...task } = msg;
    const tried = new Set();
    let lastError = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const node = this.#pick(tried);
      if (!node) break;
      tried.add(node);
      try {
        const reply = await this.#post(node, task, timeoutMs, signal);
        node.completed += 1;
        this.completed += 1;
        return reply;
      } catch (err) {
        if (signal?.aborted) { this.cancelled += 1; throw new Error('cancelado'); }
        if (this.closed) throw new Error('pool_cerrado');
        if (err.status === 400 || err.status === 413) throw err; // tarea inválida: reintentar no ayuda (un 401 sí cuenta como fallo del nodo)
        lastError = err;
        node.failures += 1;
        node.downUntil = Date.now() + this.cooldownMs; // circuit breaker
        if (attempt < this.retries) this.retried += 1;
      }
    }
    if (this.fallback) { // ningún nodo respondió: cálculo local para no dejar la partida sin jugada
      this.fellBack += 1;
      return this.fallback.submit(msg, { timeoutMs, signal });
    }
    throw new Error(`sin_nodos: ${lastError?.message ?? 'ninguno disponible'}`);
  }

  /** La memoria compartida no existe entre procesos: siempre se usa paso de mensajes. */
  density(opts) { return super.density({ ...opts, mode: 'message' }); }

  stats() {
    return {
      mode: 'distributed', workers: this.parallelism, busy: this.nodes.reduce((a, n) => a + Math.min(n.inflight, n.capacity), 0),
      queued: this.queueLength(), queuedLive: this.queueLength(), queuedBatch: 0, pending: this.nodes.reduce((a, n) => a + n.inflight, 0),
      completed: this.completed, inlineRuns: this.inlineRuns, degraded: this.degraded, rejected: this.rejected, cancelled: this.cancelled,
      retried: this.retried, fellBack: this.fellBack,
      mcSamples: this.mcSamples, mcMode: 'message', adaptive: this.adaptive, minParallelCost: this.minParallelCost,
      nodes: this.nodes.map((n) => ({ url: n.url, healthy: n.downUntil <= Date.now(), capacity: n.capacity, inflight: n.inflight, completed: n.completed, failures: n.failures })),
    };
  }

  async close() {
    this.closed = true;
    clearInterval(this.healthTimer);
    for (const c of this.inflight) c.abort();
    await this.fallback?.close();
  }
}
