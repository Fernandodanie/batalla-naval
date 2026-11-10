import WebSocket from 'ws';
import { createApp } from '../src/app.js';
import { chooseShot } from '../src/ai/strategies.js';
import { loadConfig } from '../src/config.js';

/** Servidor de pruebas en un puerto libre, con tiempos cortos y la IA en el hilo principal. */
export async function startServer({ timing = {}, aiWorkers = 0, mcSamples = 1500, mcMode, adaptive = false, rng, guestAiDaily = 0, ...rest } = {}) {
  const config = loadConfig({ NODE_ENV: 'test' });
  config.aiWorkers = aiWorkers;
  config.aiAdaptive = adaptive; // las pruebas quieren que el trabajo pase por los hilos aunque sea barato
  config.mcSamples = mcSamples; // pocas muestras: las pruebas deben ser rápidas
  if (mcMode) config.mcMode = mcMode;
  config.guestAiDaily = guestAiDaily; // 0 = sin cupo (las pruebas crean muchas partidas de invitado)
  config.wsMessagesPerSecond = 10_000; // los bots de prueba juegan mucho más rápido que una persona
  config.timing = { turnMs: 0, placementMs: 0, graceMs: 300, aiThinkMs: [1, 3], idleMs: 60_000, ...timing };
  const app = await createApp({ config, bcryptRounds: 4, rng, ...rest });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  return { ...app, port, http: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}/ws` };
}

export async function api(srv, method, path, { body, token } = {}) {
  const res = await fetch(`${srv.http}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Cliente WebSocket de pruebas: guarda los mensajes y permite esperar condiciones. */
export class Client {
  static async connect(srv, { auth, session } = {}) {
    const ws = new WebSocket(srv.ws);
    const c = new Client(ws);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    c.send({ t: 'hello', auth, session });
    await c.waitFor((m) => m.t === 'welcome');
    return c;
  }

  constructor(ws) {
    this.ws = ws;
    this.buffer = [];
    this.waiters = [];
    this.state = null;
    this.session = null;
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.t === 'state') this.state = m;
      if (m.t === 'welcome') { this.session = m.session; this.welcome = m; }
      this.buffer.push(m);
      this.#flush();
    });
  }

  #flush() {
    for (const w of [...this.waiters]) {
      const i = this.buffer.findIndex(w.pred);
      if (i === -1) continue;
      const [m] = this.buffer.splice(0, i + 1).slice(-1);
      this.waiters.splice(this.waiters.indexOf(w), 1);
      clearTimeout(w.timer);
      w.resolve(m);
    }
  }

  send(obj) { this.ws.send(JSON.stringify(obj)); }

  waitFor(pred, ms = 4000) {
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      w.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        reject(new Error(`timeout esperando mensaje (último estado: ${this.state?.status}, turno ${this.state?.game?.turn})`));
      }, ms);
      this.waiters.push(w);
      this.#flush();
    });
  }

  /** Espera un estado que cumpla la condición (mira primero el último recibido). */
  async untilState(pred, ms = 4000) {
    if (this.state && pred(this.state)) return this.state;
    return this.waitFor((m) => m.t === 'state' && pred(m), ms);
  }

  async expectError(code) {
    const m = await this.waitFor((x) => x.t === 'error');
    if (m.code !== code) throw new Error(`esperaba error ${code} y llegó ${m.code}`);
  }

  /** Coloca la flota (aleatoria del servidor) y queda listo. */
  async placeAndReady() {
    this.send({ t: 'randomize' });
    const fleet = await this.waitFor((m) => m.t === 'fleet');
    this.send({ t: 'ready', ships: fleet.ships });
  }

  /** Juega solo hasta que la partida termine. Devuelve el último estado. */
  async autoPlay(difficulty = 'normal', ms = 15_000) {
    let placed = false;
    let lastKey = null;
    const step = (s) => {
      const g = s.game;
      if (!g) return;
      if (g.status === 'placing' && !g.ready[s.you] && !placed) { placed = true; this.placeAndReady(); }
      if (g.status === 'battle' && g.turn === s.you) {
        const key = `${g.stats.A.shots}-${g.stats.B.shots}-${g.turn}`;
        if (key === lastKey) return;
        lastKey = key;
        const enemy = g.boards[s.you === 'A' ? 'B' : 'A'];
        const remaining = enemy.fleet.filter((f) => !f.sunk).map((f) => f.length);
        const i = chooseShot({ size: g.size, shots: enemy.shots, remaining, difficulty });
        this.send({ t: 'fire', row: Math.floor(i / g.size), col: i % g.size });
      }
    };
    const onMsg = (data) => { const m = JSON.parse(data.toString()); if (m.t === 'state') step(m); };
    this.ws.on('message', onMsg);
    if (this.state) step(this.state);
    try { return await this.untilState((s) => s.status === 'over', ms); } finally { this.ws.off('message', onMsg); }
  }

  close() { this.ws.close(); }
}
