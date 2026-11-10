import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiPool } from '../src/ai/pool.js';
import { chooseShot } from '../src/ai/strategies.js';
import { Game } from '../src/domain/game.js';
import { seeded } from './seed.js';

/** Juega IA contra IA hasta el final y devuelve los disparos que necesitó el ganador. */
function selfPlay(size, difficulty, seed) {
  const rng = seeded(seed);
  const g = new Game({ size, rng });
  g.autoFleet('A');
  g.autoFleet('B');
  while (g.status === 'battle') {
    const enemy = g.boards[g.turn === 'A' ? 'B' : 'A'];
    const i = chooseShot({ size, shots: enemy.shots, remaining: enemy.remainingLengths(), difficulty }, rng);
    const res = g.fire(g.turn, Math.floor(i / size), i % size);
    assert.ok(res.ok, `la IA (${difficulty}) hizo un disparo inválido: ${res.error}`);
  }
  return g.stats[g.winner].shots;
}

test('ninguna dificultad dispara a una casilla repetida y todas terminan la partida', () => {
  for (const size of [8, 10, 20]) {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      for (let seed = 1; seed <= 3; seed++) assert.ok(selfPlay(size, difficulty, seed) <= size * size);
    }
  }
});

test('la dificultad se nota: difícil necesita menos disparos que normal y normal menos que fácil', () => {
  const avg = (d) => [1, 2, 3, 4, 5, 6, 7, 8].reduce((s, seed) => s + selfPlay(10, d, seed), 0) / 8;
  const [easy, normal, hard] = [avg('easy'), avg('normal'), avg('hard')];
  assert.ok(normal < easy, `normal (${normal}) < fácil (${easy})`);
  assert.ok(hard < normal + 3, `difícil (${hard}) no es peor que normal (${normal})`);
  assert.ok(hard < easy * 0.7, `difícil (${hard}) mucho mejor que fácil (${easy})`);
});

test('tras un impacto, normal y difícil disparan junto al barco tocado', () => {
  const size = 10;
  const shots = new Array(100).fill(0);
  shots[45] = 2; // tocado en (4,5)
  const near = new Set([35, 55, 44, 46]);
  for (const difficulty of ['normal', 'hard']) {
    for (let seed = 1; seed <= 10; seed++) {
      const i = chooseShot({ size, shots, remaining: [5, 4, 3, 3, 2], difficulty }, seeded(seed));
      assert.ok(near.has(i), `${difficulty} disparó a ${i}, lejos del impacto`);
    }
  }
});

test('con dos impactos en línea, sigue la línea', () => {
  const shots = new Array(100).fill(0);
  shots[44] = 2; shots[45] = 2; // (4,4) y (4,5) horizontal
  const i = chooseShot({ size: 10, shots, remaining: [4, 3], difficulty: 'hard' }, seeded(3));
  assert.ok([43, 46].includes(i), `esperaba 43 o 46, obtuvo ${i}`);
});

test('el pool con hilos devuelve jugadas válidas y atiende pedidos en paralelo', async () => {
  const pool = new AiPool({ size: 2, adaptive: false });
  try {
    const shots = new Array(400).fill(0);
    const jobs = Array.from({ length: 12 }, () => pool.choose({ size: 20, shots, remaining: [7, 6, 5, 4, 3, 2], difficulty: 'hard' }));
    const results = await Promise.all(jobs);
    for (const i of results) assert.ok(Number.isInteger(i) && i >= 0 && i < 400);
    assert.equal(pool.stats().completed, 12);
    assert.equal(pool.stats().pending, 0);
    assert.equal(pool.stats().workers, 2);
  } finally {
    await pool.close();
  }
});

test('el pool en modo inline funciona sin hilos y cerrado rechaza pedidos', async () => {
  const pool = new AiPool({ size: 0 });
  assert.equal(pool.stats().mode, 'inline');
  const i = await pool.choose({ size: 8, shots: new Array(64).fill(0), remaining: [3], difficulty: 'easy' });
  assert.ok(i >= 0 && i < 64);
  await pool.close();
  await assert.rejects(pool.choose({ size: 8, shots: [], remaining: [], difficulty: 'easy' }), /pool_cerrado/);
});
