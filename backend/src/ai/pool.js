import { Worker } from 'node:worker_threads';
import { bestCell, DEFAULT_SAMPLES, MIN_ACCEPTED } from './montecarlo.js';
import { chunkSeed } from './rng.js';
import { chooseShot } from './strategies.js';
import { summarizeAnalysis } from './analysis.js';
import { runTask } from './tasks.js';

const WORKER_FILE = new URL('./ai.worker.js', import.meta.url);
const MIN_DEGRADED_SAMPLES = 500; // con sobrecarga, la IA Experta nunca baja de aquí

/** Reparte `total` en `parts` trozos casi iguales (el resto se reparte de a uno). */
function split(total, parts) {
  const base = Math.floor(total / parts), extra = total % parts;
  return Array.from({ length: parts }, (_, k) => base + (k < extra ? 1 : 0)).filter((n) => n > 0);
}

const cancelled = () => new Error('cancelado');

/**
 * Pool de worker threads para calcular en PARALELO.
 *
 * Node ejecuta JavaScript en un solo hilo: muchas salas a la vez ya son concurrentes (el event loop
 * atiende a todas), pero un cálculo pesado frenaría a todas. Con el pool, ese cálculo corre en otros
 * núcleos y el hilo principal sigue atendiendo sockets.
 *
 * Planificación: COLA COMPARTIDA con "trabajo por demanda" y DOS PRIORIDADES. Las tareas esperan en una
 * sola cola y cada worker, apenas queda libre, toma la siguiente. Las tareas `live` (una partida esperando
 * su jugada) se colocan SIEMPRE antes que las `batch` (torneos, análisis): un torneo largo no retrasa
 * a una persona que está jugando.
 *
 * Granularidad adaptativa: repartir una tarea cuesta (copiar, despertar un hilo, reunir resultados).
 * Si el cálculo es más barato que eso, el pool lo hace en el mismo hilo (`minParallelCost`; el umbral
 * de TU equipo se calibra con `npm run calibrate`).
 *
 * Contrapresión: con la cola muy larga la IA Experta usa MENOS muestras (decide peor pero a tiempo);
 * por encima de `maxQueue` rechaza (`ia_saturada`) y la sala dispara al azar en vez de acumular trabajo.
 *
 * Cancelación: una tarea acepta un `AbortSignal`. Las que esperan en la cola se retiran; las Monte Carlo
 * que ya corren leen una bandera compartida (SharedArrayBuffer + Atomics) y se detienen en pocos ms.
 *
 * `size: 0` (o inline: true) calcula en el mismo hilo; sirve para pruebas, como plan B y como línea base secuencial.
 */
export class AiPool {
  /**
   * @param {object} [o]
   * @param {number} [o.size]            hilos de trabajo
   * @param {boolean} [o.inline]         sin hilos
   * @param {number} [o.timeoutMs]       tiempo máximo por tarea desde que se pide
   * @param {number} [o.mcSamples]       muestras Monte Carlo por jugada de la IA experta
   * @param {'message'|'shared'} [o.mcMode] cómo se comunican los hilos: copia por mensajes o memoria compartida
   * @param {boolean} [o.adaptive]       true: las tareas baratas se calculan en el mismo hilo
   * @param {number} [o.minParallelCost] costo (muestras × barcos) desde el cual conviene repartir
   * @param {number} [o.degradeAt]       largo de cola desde el cual la IA Experta reduce sus muestras
   * @param {number} [o.maxQueue]        largo de cola desde el cual se rechaza trabajo `live`
   */
  constructor({
    size = 2, inline = false, timeoutMs = 5000, mcSamples = DEFAULT_SAMPLES, mcMode = 'shared',
    adaptive = true, minParallelCost = 100_000, degradeAt, maxQueue,
  } = {}) {
    this.inline = inline || size === 0;
    this.timeoutMs = timeoutMs;
    this.mcSamples = mcSamples;
    this.mcMode = mcMode === 'message' ? 'message' : 'shared';
    this.adaptive = adaptive;
    this.minParallelCost = minParallelCost;
    this.degradeAt = degradeAt ?? Math.max(8, size * 4);
    this.maxQueue = maxQueue ?? Math.max(64, size * 32);
    this.workers = [];
    this.queue = [];          // tareas esperando un worker libre (las `live` delante de las `batch`)
    this.pending = new Map(); // id -> tarea (en cola o en ejecución)
    this.nextId = 1;
    this.completed = 0;
    this.inlineRuns = 0;      // decisiones calculadas en el hilo principal por ser baratas
    this.degraded = 0;        // decisiones con menos muestras por sobrecarga
    this.rejected = 0;        // decisiones rechazadas por cola saturada
    this.cancelled = 0;
    this.closed = false;
    if (!this.inline) for (let i = 0; i < size; i++) this.workers.push(this.#spawn());
  }

  /** Cuántos trozos conviene crear para una tarea repartible. */
  get parallelism() { return this.inline ? 1 : this.workers.length; }

  /** Trabajo esperando un hilo: es la medida de sobrecarga para la contrapresión. */
  queueLength() { return this.queue.length; }

  #spawn() {
    const worker = new Worker(WORKER_FILE);
    worker.busy = false;
    worker.current = null;
    worker.unref();
    worker.on('message', ({ id, ...reply }) => { // `id` es de transporte: la respuesta que ve el llamador no lo incluye
      worker.busy = false;
      worker.current = null;
      const job = this.pending.get(id);
      if (job) {
        this.#settle(job);
        this.completed += 1;
        if (reply.error) job.reject(new Error(reply.error)); else job.resolve(reply);
      }
      this.#drain(); // quedó libre: toma la siguiente tarea de la cola
    });
    const fail = (err) => {
      const job = worker.current !== null ? this.pending.get(worker.current) : null;
      if (job) {
        this.#settle(job);
        job.reject(err instanceof Error ? err : new Error('worker_terminado'));
      }
      if (!this.closed) {
        const i = this.workers.indexOf(worker);
        if (i !== -1) this.workers[i] = this.#spawn(); // reemplazo automático
        this.#drain();
      }
    };
    worker.once('error', fail);
    worker.once('exit', () => { if (!this.closed) fail(new Error('worker_terminado')); });
    return worker;
  }

  /** Saca una tarea de la contabilidad (timer, señal, tabla de pendientes). */
  #settle(job) {
    this.pending.delete(job.id);
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.onAbort);
  }

  /** Rechaza una tarea que aún no terminó (timeout o cancelación). Si ya corría, su worker sigue ocupado hasta responder. */
  #abandon(job, err) {
    if (!this.pending.has(job.id)) return;
    this.#settle(job);
    const i = this.queue.findIndex((j) => j.id === job.id);
    if (i !== -1) this.queue.splice(i, 1); // si seguía en cola, nunca llegará a un worker
    job.reject(err);
  }

  #drain() {
    while (this.queue.length) {
      const worker = this.workers.find((w) => !w.busy);
      if (!worker) return;
      const job = this.queue.shift();
      worker.busy = true;
      worker.current = job.id;
      worker.postMessage({ ...job.msg, id: job.id }, job.transfer);
    }
  }

  #enqueue(job) {
    if (job.priority === 'batch') { this.queue.push(job); return; }
    const k = this.queue.findIndex((j) => j.priority === 'batch'); // `live` pasa delante de todo lo `batch`
    if (k === -1) this.queue.push(job); else this.queue.splice(k, 0, job);
  }

  /**
   * Envía una tarea (ver tasks.js) y devuelve su respuesta.
   * @param {object} msg
   * @param {{timeoutMs?:number, transfer?:ArrayBuffer[], priority?:'live'|'batch', signal?:AbortSignal}} [opts]
   * @returns {Promise<object>}
   */
  submit(msg, { timeoutMs = this.timeoutMs, transfer = [], priority = 'live', signal } = {}) {
    if (this.closed) return Promise.reject(new Error('pool_cerrado'));
    if (signal?.aborted) { this.cancelled += 1; return Promise.reject(cancelled()); }
    if (this.inline) {
      try { this.completed += 1; return Promise.resolve(runTask(msg).reply); }
      catch (err) { return Promise.reject(err); }
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const job = { id, msg, transfer, priority, signal, resolve, reject };
      job.timer = setTimeout(() => this.#abandon(job, new Error('ia_timeout')), timeoutMs);
      if (signal) {
        job.onAbort = () => { this.cancelled += 1; this.#abandon(job, cancelled()); };
        signal.addEventListener('abort', job.onAbort, { once: true });
      }
      this.pending.set(id, job);
      this.#enqueue(job);
      this.#drain();
    });
  }

  /**
   * Una jugada de la IA.
   * @param {object} payload   { size, shots, remaining, difficulty, samples? }
   * @param {{signal?:AbortSignal, priority?:'live'|'batch'}} [opts]
   * @returns {Promise<number>} índice de la casilla elegida
   */
  async choose(payload, { signal, priority = 'live' } = {}) {
    if (this.closed) throw new Error('pool_cerrado');
    if (signal?.aborted) throw cancelled();
    const expert = payload.difficulty === 'expert';

    if (this.inline) {
      if (expert && payload.samples === undefined) payload = { ...payload, samples: this.mcSamples };
      return (await this.submit({ kind: 'choose', payload })).index;
    }

    if (!expert) {
      if (this.adaptive) { this.inlineRuns += 1; return chooseShot(payload); } // microsegundos: no vale la pena repartir
      return (await this.submit({ kind: 'choose', payload }, { signal, priority })).index;
    }

    // --- IA Experta ---
    let samples = payload.samples ?? this.mcSamples;
    if (priority === 'live') {
      const load = this.queueLength();
      if (load >= this.maxQueue) { this.rejected += 1; throw new Error('ia_saturada'); }
      if (load > this.degradeAt) { // contrapresión: menos muestras cuanto más larga la cola
        samples = Math.max(MIN_DEGRADED_SAMPLES, Math.floor((samples * this.degradeAt) / load));
        this.degraded += 1;
      }
    }
    if (this.adaptive && samples * payload.remaining.length < this.minParallelCost) {
      this.inlineRuns += 1;
      return chooseShot({ ...payload, samples });
    }
    const { density, accepted } = await this.density({ ...payload, samples, signal, priority });
    const cell = accepted >= MIN_ACCEPTED ? bestCell(density, payload.shots) : -1;
    return cell >= 0 ? cell : chooseShot({ ...payload, difficulty: 'hard' });
  }

  /**
   * Monte Carlo repartido: cada worker calcula `samples / p` muestras y los conteos se SUMAN (reducción).
   * @param {{size:number, shots:ArrayLike<number>, remaining:number[], samples?:number,
   *          mode?:'message'|'shared', seed?:number, parts?:number, timeoutMs?:number,
   *          priority?:'live'|'batch', signal?:AbortSignal}} p
   * @returns {Promise<{density:Int32Array, accepted:number}>}
   */
  async density({ size, shots, remaining, samples = this.mcSamples, mode = this.mcMode, seed, parts, timeoutMs, priority, signal }) {
    const n = size * size;
    seed = (seed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
    const chunks = split(samples, parts ?? this.parallelism);
    const opts = { timeoutMs, priority, signal };
    const cancelBuf = new SharedArrayBuffer(4);
    if (signal) {
      const stop = () => Atomics.store(new Int32Array(cancelBuf), 0, 1); // los workers que ya corren se detienen
      if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true });
    }
    const common = { kind: 'mc', mode, size, remaining, cancelBuf };

    if (mode === 'shared') {
      const shotsBuf = new SharedArrayBuffer(n);
      new Uint8Array(shotsBuf).set(shots);
      const densityBuf = new SharedArrayBuffer((n + 1) * 4); // n casillas + 1 contador de muestras válidas
      await Promise.all(chunks.map((s, k) => this.submit(
        { ...common, samples: s, seed: chunkSeed(seed, k), shotsBuf, densityBuf }, opts)));
      const shared = new Int32Array(densityBuf);
      return { density: shared.slice(0, n), accepted: shared[n] };
    }

    const replies = await Promise.all(chunks.map((s, k) => this.submit(
      { ...common, samples: s, seed: chunkSeed(seed, k), shots: Array.from(shots) }, opts)));
    const density = new Int32Array(n);
    let accepted = 0;
    for (const r of replies) {
      for (let i = 0; i < n; i++) density[i] += r.density[i];
      accepted += r.accepted;
    }
    return { density, accepted };
  }

  /**
   * Torneo: `games` partidas IA vs IA entre las estrategias `a` y `b` ({difficulty, samples?}).
   * Se corta en tareas de `chunk` partidas que los workers van tomando de la cola (bolsa de tareas).
   * Corre con prioridad `batch`: nunca retrasa a una partida en vivo.
   */
  async tournament({ games, size = 10, a, b, seed = 1, chunk = 1, timeoutMs = 600_000, signal }) {
    const tasks = [];
    for (let done = 0, k = 0; done < games; k++) {
      const count = Math.min(chunk, games - done);
      tasks.push(this.submit({ kind: 'game', size, games: count, a, b, seed: chunkSeed(seed, k) },
        { timeoutMs, priority: 'batch', signal }));
      done += count;
    }
    const total = { games: 0, winsA: 0, winsB: 0, shotsWinA: 0, shotsWinB: 0 };
    for (const r of await Promise.all(tasks)) for (const key of Object.keys(total)) total[key] += r[key];
    return { ...total, tasks: tasks.length };
  }

  /**
   * Rendimiento de UNA estrategia disparando sola a `games` tableros (bolsa de tareas, prioridad `batch`).
   * @returns {Promise<{games:number, mean:number, stderr:number}>}  disparos promedio para hundir la flota y su error estándar
   */
  async solo({ games, size = 10, strategy, seed = 1, chunk = 1, timeoutMs = 600_000, signal }) {
    const tasks = [];
    for (let done = 0, k = 0; done < games; k++) {
      const count = Math.min(chunk, games - done);
      tasks.push(this.submit({ kind: 'solo', size, games: count, strategy, seed: chunkSeed(seed, k) }, { timeoutMs, priority: 'batch', signal }));
      done += count;
    }
    let n = 0, sum = 0, sumSq = 0;
    for (const r of await Promise.all(tasks)) { n += r.games; sum += r.shots; sumSq += r.shotsSq; }
    const mean = sum / n;
    const variance = n > 1 ? Math.max(0, (sumSq - n * mean * mean) / (n - 1)) : 0;
    return { games: n, mean, stderr: Math.sqrt(variance / n) };
  }

  /**
   * Análisis de partida: la calidad de cada disparo de `moves` (ver analysis.js), UNA TAREA POR DISPARO.
   * Es paralelismo de datos puro: los disparos no dependen entre sí. Corre con prioridad `batch`.
   * @returns {Promise<{moves:number, avgEfficiency:number, optimal:number, mistakes:number, results:object[]}>}
   */
  async analyze({ size, moves, samples = 5000, seed = 1, timeoutMs = 600_000, signal }) {
    const results = await Promise.all(moves.map((m, k) => this.submit({
      kind: 'analysis', size, shots: m.shots, remaining: m.remaining, cell: m.cell, samples, seed: chunkSeed(seed, k),
    }, { timeoutMs, priority: 'batch', signal })));
    return { ...summarizeAnalysis(results), results };
  }

  stats() {
    return {
      mode: this.inline ? 'inline' : 'workers', workers: this.workers.length,
      busy: this.workers.filter((w) => w.busy).length, queued: this.queue.length,
      queuedLive: this.queue.filter((j) => j.priority === 'live').length,
      queuedBatch: this.queue.filter((j) => j.priority === 'batch').length,
      pending: this.pending.size, completed: this.completed,
      inlineRuns: this.inlineRuns, degraded: this.degraded, rejected: this.rejected, cancelled: this.cancelled,
      mcSamples: this.mcSamples, mcMode: this.mcMode, adaptive: this.adaptive, minParallelCost: this.minParallelCost,
    };
  }

  async close() {
    this.closed = true;
    for (const job of [...this.pending.values()]) { this.#settle(job); job.reject(new Error('pool_cerrado')); }
    this.queue = [];
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
  }
}
