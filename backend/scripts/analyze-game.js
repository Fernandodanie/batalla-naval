/**
 * Juega una partida entre dos IA y analiza cada disparo en paralelo.
 *
 *   node scripts/analyze-game.js [--size 10] [--a easy] [--b hard] [--samples 20000] [--workers N] [--seed 1]
 *
 * Compara el análisis secuencial con el repartido entre hilos (una tarea por disparo).
 */
import os from 'node:os';
import { analysisMoves } from '../src/ai/analysis.js';
import { AiPool } from '../src/ai/pool.js';
import { mulberry32 } from '../src/ai/rng.js';
import { chooseShot, DIFFICULTIES } from '../src/ai/strategies.js';
import { Game } from '../src/domain/game.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const SIZE = Number(args.size) || 10;
const A = args.a ?? 'easy', B = args.b ?? 'hard';
const SAMPLES = Number(args.samples) || 20_000;
const WORKERS = Number(args.workers) || Math.max(2, os.availableParallelism());
const SEED = Number(args.seed) || 1;
for (const d of [A, B]) if (!DIFFICULTIES.includes(d)) { console.error(`Dificultad desconocida: ${d}`); process.exit(1); }

const rng = mulberry32(SEED);
const game = new Game({ size: SIZE, rng });
game.autoFleet('A');
game.autoFleet('B');
const strat = { A: A, B: B };
while (game.status === 'battle') {
  const side = game.turn;
  const enemy = game.boards[side === 'A' ? 'B' : 'A'];
  const i = chooseShot({ size: SIZE, shots: enemy.shots, remaining: enemy.remainingLengths(), difficulty: strat[side] }, rng);
  game.fire(side, Math.floor(i / SIZE), i % SIZE);
}
console.log(`\nPartida ${SIZE}×${SIZE}: A (${A}) ${game.stats.A.shots} disparos, B (${B}) ${game.stats.B.shots} disparos. Ganó ${game.winner}.`);

const moves = { A: analysisMoves(game, 'A'), B: analysisMoves(game, 'B') };
const total = moves.A.length + moves.B.length;
const run = async (size) => {
  const pool = new AiPool({ size });
  const t0 = performance.now();
  const out = { A: await pool.analyze({ size: SIZE, moves: moves.A, samples: SAMPLES, seed: 1 }),
    B: await pool.analyze({ size: SIZE, moves: moves.B, samples: SAMPLES, seed: 2 }) };
  const ms = performance.now() - t0;
  await pool.close();
  return { out, ms };
};
const seq = await run(0);
const par = await run(WORKERS);
for (const s of ['A', 'B']) {
  const r = seq.out[s];
  console.log(`  ${s} (${strat[s]}): eficiencia media ${(r.avgEfficiency * 100).toFixed(1)} %, ${r.optimal}/${r.analysed} disparos óptimos, ${r.mistakes} errores graves`);
}
console.log(`\n${total} disparos analizados con ${SAMPLES.toLocaleString()} muestras cada uno`);
console.log(`  Secuencial : ${seq.ms.toFixed(0)} ms`);
console.log(`  ${String(WORKERS).padStart(2)} hilos   : ${par.ms.toFixed(0)} ms   (aceleración ${(seq.ms / par.ms).toFixed(2)}x, eficiencia ${((seq.ms / par.ms / WORKERS) * 100).toFixed(0)} %)`);
const same = JSON.stringify(seq.out.A.results) === JSON.stringify(par.out.A.results);
console.log(`  Mismo resultado: ${same ? 'sí (determinista por semilla)' : 'NO'}\n`);
