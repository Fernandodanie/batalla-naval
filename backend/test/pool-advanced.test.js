import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiPool } from '../src/ai/pool.js';
import { createMetrics } from '../src/metrics.js';
import { startServer } from './helpers.js';

const FLEET = [5, 4, 3, 3, 2];
const empty = (size = 10) => new Array(size * size).fill(0);
const longGame = { kind: 'game', size: 10, games: 3, a: { difficulty: 'expert', samples: 3000 }, b: { difficulty: 'expert', samples: 3000 }, seed: 1 };
const swallow = (p) => p.catch(() => {});

test('prioridades: una tarea en vivo pasa delante de las tareas por lotes que esperan', async () => {
  const pool = new AiPool({ size: 1, adaptive: false });
  try {
    const jobs = [
      pool.submit(longGame, { priority: 'batch' }),  // ocupa al único worker
      pool.submit(longGame, { priority: 'batch' }),
      pool.submit(longGame, { priority: 'batch' }),
      pool.submit({ kind: 'choose', payload: { size: 10, shots: empty(), remaining: FLEET, difficulty: 'hard' } }, { priority: 'live' }),
    ];
    assert.deepEqual(pool.queue.map((j) => j.priority), ['live', 'batch', 'batch']);
    assert.equal(pool.stats().queuedLive, 1);
    assert.equal(pool.stats().queuedBatch, 2);
    await Promise.all(jobs);
  } finally { await pool.close(); }
});

test('cancelación: una tarea en cola se retira y rechaza con "cancelado"', async () => {
  const pool = new AiPool({ size: 1, adaptive: false });
  try {
    const busy = pool.submit(longGame, { priority: 'batch' });
    const ctrl = new AbortController();
    const waiting = pool.submit(longGame, { priority: 'batch', signal: ctrl.signal });
    assert.equal(pool.queue.length, 1);
    ctrl.abort();
    await assert.rejects(waiting, /cancelado/);
    assert.equal(pool.queue.length, 0);
    assert.equal(pool.stats().cancelled, 1);
    await busy;
  } finally { await pool.close(); }
});

test('cancelación: un Monte Carlo en ejecución se detiene y libera a los workers', async () => {
  const pool = new AiPool({ size: 2, timeoutMs: 120_000 });
  try {
    const ctrl = new AbortController();
    // 50 millones de muestras tardarían minutos: solo termina pronto si la bandera compartida funciona.
    const big = pool.density({ size: 10, shots: empty(), remaining: FLEET, samples: 50_000_000, signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 80);
    await assert.rejects(big, /cancelado/);
    const t0 = performance.now();
    const small = await pool.density({ size: 10, shots: empty(), remaining: FLEET, samples: 2000, seed: 1 });
    assert.equal(small.accepted, 2000);
    assert.ok(performance.now() - t0 < 5000, 'los workers quedaron libres poco después de cancelar');
  } finally { await pool.close(); }
});

test('contrapresión: con la cola larga la IA experta reduce sus muestras y, saturada, rechaza', async () => {
  const pool = new AiPool({ size: 1, adaptive: true, minParallelCost: 0, degradeAt: 2, maxQueue: 6 });
  const ctrl = new AbortController();
  const payload = { size: 10, shots: empty(), remaining: FLEET, difficulty: 'expert', samples: 4000 };
  try {
    const fill = (n) => Array.from({ length: n }, () => swallow(pool.submit(longGame, { priority: 'batch', signal: ctrl.signal })));
    fill(5); // 1 en el worker + 4 en cola: sobre degradeAt (2) y bajo maxQueue (6)
    assert.equal(pool.queue.length, 4);
    const index = await pool.choose(payload, { signal: undefined, priority: 'live' }).catch(() => null);
    assert.equal(pool.stats().degraded, 1);
    assert.ok(index === null || (index >= 0 && index < 100));

    fill(4);
    await assert.rejects(pool.choose(payload), /ia_saturada/);
    assert.equal(pool.stats().rejected, 1);
  } finally { ctrl.abort(); await pool.close(); }
});

test('granularidad adaptativa: lo barato se calcula en el hilo principal y lo caro se reparte', async () => {
  const pool = new AiPool({ size: 2, adaptive: true, minParallelCost: 100_000 });
  try {
    const base = { size: 10, shots: empty(), remaining: FLEET, difficulty: 'expert' };
    const cheap = await pool.choose({ ...base, samples: 100 });          // 100 × 5 = 500
    assert.ok(cheap >= 0 && cheap < 100);
    assert.equal(pool.stats().inlineRuns, 1);
    assert.equal(pool.stats().completed, 0);

    const costly = await pool.choose({ ...base, samples: 60_000 });      // 60 000 × 5 = 300 000
    assert.ok(costly >= 0 && costly < 100);
    assert.equal(pool.stats().inlineRuns, 1);
    assert.ok(pool.stats().completed >= 2, 'los trozos pasaron por los hilos');

    await pool.choose({ size: 10, shots: empty(), remaining: FLEET, difficulty: 'hard' });
    assert.equal(pool.stats().inlineRuns, 2, 'la IA difícil dura microsegundos: nunca se reparte');
  } finally { await pool.close(); }
});

test('métricas: el retraso del event loop se mide y sube cuando algo bloquea el hilo', async () => {
  const m = createMetrics({ resolution: 5 });
  try {
    await new Promise((r) => setTimeout(r, 120));
    const calm = m.snapshot();
    assert.ok(calm.samples > 0);
    m.reset();
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 20));
    while (Date.now() - t0 < 200) { /* bloquea el hilo principal ~200 ms */ }
    await new Promise((r) => setTimeout(r, 40));
    const blocked = m.snapshot();
    assert.ok(blocked.max >= 100, `el máximo debería reflejar el bloqueo (fue ${blocked.max} ms)`);
    assert.ok(blocked.max > calm.max);
  } finally { m.close(); }
});

test('GET /api/status incluye la latencia del event loop y GET /api/metrics responde en formato Prometheus', async () => {
  const srv = await startServer({ aiWorkers: 2 });
  try {
    const status = await (await fetch(`${srv.http}/api/status`)).json();
    assert.equal(typeof status.eventLoop.p99, 'number');
    assert.equal(status.ai.workers, 2);
    const text = await (await fetch(`${srv.http}/api/metrics`)).text();
    assert.match(text, /^# TYPE batalla_ai_workers gauge$/m);
    assert.match(text, /^batalla_ai_workers 2$/m);
    assert.match(text, /^batalla_eventloop_lag_p99_ms /m);
  } finally { await srv.close(); }
});
