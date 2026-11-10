/**
 * Nodo de cálculo de IA: un proceso (en esta u otra máquina) que recibe tareas por HTTP, las reparte entre
 * SUS worker threads y devuelve el resultado. Varios nodos + un coordinador (`DistributedPool`) forman un
 * sistema maestro-trabajadores: es la parte DISTRIBUIDA del proyecto (memoria separada, comunicación por red).
 *
 *   GET  /health   → { ok, workers, busy, queued }
 *   POST /task     → ejecuta una tarea (kind: choose | mc | game) y responde con su resultado
 *
 * Seguridad: este endpoint ejecuta cálculo a pedido, así que (1) exige un token compartido, (2) valida y
 * ACOTA cada campo (tamaño de tablero, muestras, partidas) para que nadie pueda pedir cálculos infinitos,
 * (3) limita el tamaño del cuerpo y (4) responde 503 si su cola ya está saturada.
 * Si el cliente corta la conexión, el cálculo se cancela (bandera compartida) y el hilo queda libre.
 */
import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { isValidSize } from '../domain/fleet.js';
import { AiPool } from './pool.js';
import { DIFFICULTIES } from './strategies.js';
import { decode, encode } from './wire.js';

export const LIMITS = { maxBodyBytes: 256 * 1024, maxSamples: 5_000_000, maxGames: 500, maxShips: 20 };

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const bad = (why) => Object.assign(new Error(why), { status: 400 });

function checkBoard(size, shots, remaining) {
  if (!isValidSize(size)) throw bad('size_invalido');
  if (!Array.isArray(shots) || shots.length !== size * size || !shots.every((v) => isInt(v, 0, 3))) throw bad('shots_invalido');
  if (!Array.isArray(remaining) || remaining.length > LIMITS.maxShips || !remaining.every((v) => isInt(v, 1, size))) throw bad('remaining_invalido');
}

function checkStrategy(s) {
  if (!s || !DIFFICULTIES.includes(s.difficulty)) throw bad('estrategia_invalida');
  if (s.samples !== undefined && !isInt(s.samples, 1, LIMITS.maxSamples)) throw bad('samples_invalido');
  return s.samples === undefined ? { difficulty: s.difficulty } : { difficulty: s.difficulty, samples: s.samples };
}

/** Valida y reconstruye la tarea con SOLO los campos conocidos (nunca se reenvía el objeto recibido tal cual). */
export function validateTask(raw) {
  if (!raw || typeof raw !== 'object') throw bad('tarea_invalida');
  switch (raw.kind) {
    case 'choose': {
      const p = raw.payload ?? {};
      checkBoard(p.size, p.shots, p.remaining);
      const strat = checkStrategy(p);
      return { kind: 'choose', payload: { size: p.size, shots: p.shots, remaining: p.remaining, ...strat } };
    }
    case 'mc': {
      if (raw.mode !== 'message') throw bad('modo_invalido'); // la memoria compartida no cruza la red
      checkBoard(raw.size, raw.shots, raw.remaining);
      if (!isInt(raw.samples, 1, LIMITS.maxSamples)) throw bad('samples_invalido');
      if (!isInt(raw.seed, 0, 4294967295)) throw bad('seed_invalido');
      return { kind: 'mc', mode: 'message', size: raw.size, shots: raw.shots, remaining: raw.remaining, samples: raw.samples, seed: raw.seed };
    }
    case 'solo': {
      if (!isValidSize(raw.size)) throw bad('size_invalido');
      if (!isInt(raw.games, 1, LIMITS.maxGames)) throw bad('games_invalido');
      if (!isInt(raw.seed, 0, 4294967295)) throw bad('seed_invalido');
      return { kind: 'solo', size: raw.size, games: raw.games, seed: raw.seed, strategy: checkStrategy(raw.strategy) };
    }
    case 'analysis': {
      checkBoard(raw.size, raw.shots, raw.remaining);
      if (!isInt(raw.cell, 0, raw.size * raw.size - 1)) throw bad('cell_invalido');
      if (!isInt(raw.samples, 1, LIMITS.maxSamples)) throw bad('samples_invalido');
      if (!isInt(raw.seed, 0, 4294967295)) throw bad('seed_invalido');
      return { kind: 'analysis', size: raw.size, shots: raw.shots, remaining: raw.remaining, cell: raw.cell, samples: raw.samples, seed: raw.seed };
    }
    case 'game': {
      if (!isValidSize(raw.size)) throw bad('size_invalido');
      if (!isInt(raw.games, 1, LIMITS.maxGames)) throw bad('games_invalido');
      if (!isInt(raw.seed, 0, 4294967295)) throw bad('seed_invalido');
      return { kind: 'game', size: raw.size, games: raw.games, seed: raw.seed, a: checkStrategy(raw.a), b: checkStrategy(raw.b) };
    }
    default:
      throw bad('kind_desconocido');
  }
}

function tokenOk(header, token) {
  const given = Buffer.from(String(header ?? '').replace(/^Bearer\s+/i, ''));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * @param {{pool?:AiPool, workers?:number, token:string, maxQueue?:number}} o
 * @returns {http.Server & {pool:AiPool}}
 */
export function createAiNodeServer({ pool, workers = 2, token, maxQueue = 64 }) {
  if (!token) throw new Error('AI_NODE_TOKEN es obligatorio');
  const ownPool = pool ?? new AiPool({ size: workers, adaptive: false, timeoutMs: 120_000 });

  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      const text = typeof body === 'string' ? body : encode(body);
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
      res.end(text);
    };
    try {
      if (!tokenOk(req.headers.authorization, token)) return send(401, { error: 'no_autorizado' });
      if (req.method === 'GET' && req.url === '/health') {
        const s = ownPool.stats();
        return send(200, { ok: true, workers: Math.max(1, s.workers), busy: s.busy, queued: s.queued });
      }
      if (req.method !== 'POST' || req.url !== '/task') return send(404, { error: 'no_encontrado' });

      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > LIMITS.maxBodyBytes) return send(413, { error: 'muy_grande' });
        chunks.push(c);
      }
      let task;
      try { task = validateTask(decode(Buffer.concat(chunks).toString('utf8'))); }
      catch (err) { return send(err.status ?? 400, { error: err.message }); }

      if (ownPool.queueLength() >= maxQueue) return send(503, { error: 'nodo_saturado' });

      // Si el cliente corta la conexión (cancelación, timeout), se detiene el cálculo.
      const abort = new AbortController();
      const flag = new SharedArrayBuffer(4);
      if (task.kind === 'mc') task.cancelBuf = flag;
      res.on('close', () => {
        if (res.writableEnded) return;
        Atomics.store(new Int32Array(flag), 0, 1);
        abort.abort();
      });
      const reply = await ownPool.submit(task, { signal: abort.signal, priority: task.kind === 'game' ? 'batch' : 'live' });
      send(200, reply);
    } catch (err) {
      if (!res.headersSent) send(500, { error: String(err.message ?? err) });
    }
  });
  server.pool = ownPool;
  server.on('close', () => { if (!pool) ownPool.close(); });
  return server;
}
