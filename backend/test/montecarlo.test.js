import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bestCell, sampleDensity } from '../src/ai/montecarlo.js';
import { AiPool } from '../src/ai/pool.js';
import { mulberry32 } from '../src/ai/rng.js';
import { chooseShot } from '../src/ai/strategies.js';
import { seeded } from './seed.js';

const FLEET = [5, 4, 3, 3, 2];
const board = (size, marks = {}) => {
  const shots = new Array(size * size).fill(0);
  for (const [i, v] of Object.entries(marks)) shots[i] = v;
  return shots;
};

test('Monte Carlo: nunca cuenta casillas ya disparadas y es reproducible con la misma semilla', () => {
  const shots = board(10, { 0: 1, 1: 1, 11: 1, 45: 2, 46: 3 });
  const a = sampleDensity({ size: 10, shots, remaining: FLEET, samples: 3000, rng: mulberry32(5) });
  const b = sampleDensity({ size: 10, shots, remaining: FLEET, samples: 3000, rng: mulberry32(5) });
  assert.deepEqual([...a.density], [...b.density]);
  assert.equal(a.accepted, b.accepted);
  for (const i of [0, 1, 11, 45, 46]) assert.equal(a.density[i], 0, `casilla ${i} ya disparada`);
  assert.ok(a.accepted > 0);
});

test('Monte Carlo: con un impacto, la mayor densidad queda junto al impacto', () => {
  const shots = board(10, { 45: 2 });
  const { density } = sampleDensity({ size: 10, shots, remaining: FLEET, samples: 5000, rng: mulberry32(9) });
  assert.ok(new Set([35, 55, 44, 46]).has(bestCell(density, shots, seeded(1))));
});

test('Monte Carlo: con dos impactos en línea sigue la línea', () => {
  const shots = board(10, { 44: 2, 45: 2 });
  const { density } = sampleDensity({ size: 10, shots, remaining: [4, 3], samples: 5000, rng: mulberry32(3) });
  assert.ok([43, 46].includes(bestCell(density, shots, seeded(2))));
});

test('Monte Carlo: sin posiciones posibles no inventa nada (accepted 0) y la experta cae a "difícil"', () => {
  const shots = board(8);
  shots.fill(1);            // todo agua salvo una casilla: ningún barco de 3 cabe
  shots[10] = 0;
  const r = sampleDensity({ size: 8, shots, remaining: [3], samples: 100, rng: mulberry32(1) });
  assert.equal(r.accepted, 0);
  const i = chooseShot({ size: 8, shots, remaining: [3], difficulty: 'expert', samples: 100 }, seeded(1));
  assert.equal(i, 10);
});

test('los modos message y shared dan EXACTAMENTE la misma densidad (misma semilla, mismos trozos)', async () => {
  const pool = new AiPool({ size: 3, timeoutMs: 30_000 });
  try {
    const args = { size: 12, shots: board(12, { 30: 2, 5: 1 }), remaining: FLEET, samples: 6000, seed: 1234 };
    const msg = await pool.density({ ...args, mode: 'message' });
    const shm = await pool.density({ ...args, mode: 'shared' });
    assert.equal(shm.accepted, msg.accepted);
    assert.deepEqual([...shm.density], [...msg.density]);
    assert.ok(msg.accepted > 0);
  } finally { await pool.close(); }
});

test('repartir las muestras no cambia el total: p trozos suman todas las muestras pedidas', async () => {
  const pool = new AiPool({ size: 4, timeoutMs: 30_000 });
  try {
    const r = await pool.density({ size: 10, shots: board(10), remaining: FLEET, samples: 4001, mode: 'shared', seed: 1 });
    assert.equal(r.accepted, 4001); // tablero vacío: todas las muestras son válidas
  } finally { await pool.close(); }
});

test('el pool devuelve jugadas válidas de la IA experta con hilos y sin hilos', async () => {
  for (const size of [0, 2]) {
    const pool = new AiPool({ size, mcSamples: 2000, mcMode: size ? 'shared' : 'message', minParallelCost: 0 });
    try {
      const shots = board(10, { 45: 2 });
      for (let k = 0; k < 4; k++) {
        const i = await pool.choose({ size: 10, shots, remaining: FLEET, difficulty: 'expert' });
        assert.ok(new Set([35, 55, 44, 46]).has(i), `esperaba una casilla vecina, obtuvo ${i}`);
      }
    } finally { await pool.close(); }
  }
});

test('cola compartida: más tareas que workers se completan todas y la cola queda vacía', async () => {
  const pool = new AiPool({ size: 2, adaptive: false });
  try {
    const jobs = Array.from({ length: 30 }, () => pool.choose({ size: 10, shots: board(10), remaining: FLEET, difficulty: 'hard' }));
    const out = await Promise.all(jobs);
    assert.equal(out.length, 30);
    const s = pool.stats();
    assert.equal(s.queued, 0);
    assert.equal(s.pending, 0);
    assert.equal(s.completed, 30);
  } finally { await pool.close(); }
});

test('torneo: las victorias suman las partidas y no cambia el resultado con hilos o sin ellos', async () => {
  const params = { games: 6, size: 8, a: { difficulty: 'hard' }, b: { difficulty: 'normal' }, seed: 42, chunk: 2 };
  const seq = new AiPool({ size: 0 });
  const par = new AiPool({ size: 3 });
  try {
    const s = await seq.tournament(params);
    const p = await par.tournament(params);
    assert.equal(s.games, 6);
    assert.equal(s.winsA + s.winsB, 6);
    assert.deepEqual(p, s); // mismas semillas por tarea ⇒ mismo resultado, sea cual sea el reparto
    assert.equal(s.tasks, 3);
  } finally { await Promise.all([seq.close(), par.close()]); }
});

// ---------------------------------------------------------------- análisis de partidas
import { analysisMoves, summarizeAnalysis } from '../src/ai/analysis.js';
import { Game } from '../src/domain/game.js';

function playSeeded(size, a, b, seed) {
  const rng = mulberry32(seed);
  const g = new Game({ size, rng });
  g.autoFleet('A'); g.autoFleet('B');
  const strat = { A: a, B: b };
  while (g.status === 'battle') {
    const side = g.turn, enemy = g.boards[side === 'A' ? 'B' : 'A'];
    const i = chooseShot({ size, shots: enemy.shots, remaining: enemy.remainingLengths(), difficulty: strat[side] }, rng);
    g.fire(side, Math.floor(i / size), i % size);
  }
  return g;
}

test('análisis: la repetición reconstruye cada tablero conocido y cubre todos los disparos', () => {
  const g = playSeeded(10, 'normal', 'normal', 11);
  assert.equal(g.history.length, g.stats.A.shots + g.stats.B.shots);
  const moves = analysisMoves(g, 'A');
  assert.equal(moves.length, g.stats.A.shots);
  assert.equal(moves[0].shots.every((v) => v === 0), true);
  assert.equal(moves[0].remaining.length, 5);
  for (const m of moves) assert.equal(m.shots[m.cell], 0, 'la casilla elegida estaba sin disparar');
  const last = moves.at(-1);
  assert.equal(last.remaining.length, 1, 'al último disparo solo quedaba un barco');
});

test('análisis en paralelo: mismo resultado que en secuencial y distingue buenos de malos tiradores', async () => {
  const g = playSeeded(10, 'easy', 'hard', 5);
  const seq = new AiPool({ size: 0 }), par = new AiPool({ size: 3 });
  try {
    const easyMoves = analysisMoves(g, 'A'), hardMoves = analysisMoves(g, 'B');
    const p = await par.analyze({ size: 10, moves: easyMoves, samples: 3000, seed: 9 });
    const s = await seq.analyze({ size: 10, moves: easyMoves, samples: 3000, seed: 9 });
    assert.deepEqual(p.results, s.results);
    assert.equal(p.moves, easyMoves.length);
    const hard = await par.analyze({ size: 10, moves: hardMoves, samples: 3000, seed: 9 });
    assert.ok(hard.avgEfficiency > p.avgEfficiency + 0.1, `difícil ${hard.avgEfficiency.toFixed(2)} vs fácil ${p.avgEfficiency.toFixed(2)}`);
    assert.ok(hard.avgEfficiency <= 1.01);
  } finally { await Promise.all([seq.close(), par.close()]); }
});

test('summarizeAnalysis: promedia solo los disparos con estimación válida', () => {
  const r = summarizeAnalysis([
    { probChosen: 0.5, probBest: 0.5 }, { probChosen: 0.1, probBest: 0.5 }, { probChosen: null, probBest: null },
  ]);
  assert.equal(r.moves, 3);
  assert.equal(r.analysed, 2);
  assert.equal(r.optimal, 1);
  assert.equal(r.mistakes, 1);
  assert.ok(Math.abs(r.avgEfficiency - 0.6) < 1e-9);
});

test('solo: media y error estándar de una estrategia son reproducibles y no dependen del reparto', async () => {
  const seq = new AiPool({ size: 0 }), par = new AiPool({ size: 3 });
  try {
    const p = { games: 12, size: 8, strategy: { difficulty: 'hard' }, seed: 4, chunk: 2 };
    const a = await seq.solo(p), b = await par.solo(p);
    assert.equal(a.games, 12);
    assert.deepEqual(b, a);
    assert.ok(a.mean > 10 && a.mean < 64, `disparos promedio razonables (${a.mean})`);
    const random = await seq.solo({ ...p, strategy: { difficulty: 'easy' } });
    assert.ok(random.mean > a.mean, 'difícil necesita menos disparos que fácil');
  } finally { await Promise.all([seq.close(), par.close()]); }
});
