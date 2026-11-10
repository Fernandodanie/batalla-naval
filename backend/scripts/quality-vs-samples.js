/**
 * ¿Más cómputo hace mejor a la IA Experta?  Mide cuántos disparos necesita para hundir la flota según el número
 * de muestras Monte Carlo, y la compara con las IA "normal" y "difícil".
 *
 *   node scripts/quality-vs-samples.js [--size 10] [--games 40] [--samples 250,1000,4000,16000] [--workers N] [--csv q.csv]
 *
 * Cada medición juega `games` tableros (mismos tableros para todas las estrategias: misma semilla) repartidos
 * entre los hilos. Menos disparos = mejor. El error estándar indica si una diferencia es real o ruido.
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { AiPool } from '../src/ai/pool.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const SIZE = Number(args.size) || 10;
const GAMES = Number(args.games) || 40;
const SAMPLES = (args.samples ?? '250,1000,4000,16000').split(',').map(Number);
const WORKERS = Number(args.workers) || Math.max(2, os.availableParallelism());

const pool = new AiPool({ size: WORKERS });
const rows = [];
const line = (label, r, ms) => {
  console.log(`${label.padEnd(24)}${r.mean.toFixed(2).padStart(8)} ± ${r.stderr.toFixed(2).padEnd(6)}${(ms / 1000).toFixed(1).padStart(8)} s`);
  rows.push({ estrategia: label, disparos_promedio: r.mean.toFixed(3), error_estandar: r.stderr.toFixed(3), partidas: r.games, segundos: (ms / 1000).toFixed(2) });
};

console.log(`\nDisparos para hundir la flota (${GAMES} tableros ${SIZE}×${SIZE}, ${WORKERS} hilos). Menos = mejor.\n`);
console.log(`${'estrategia'.padEnd(24)}${'disparos'.padStart(8)}   ${'error'.padEnd(6)}${'tiempo'.padStart(10)}`);
for (const [label, strategy] of [['normal', { difficulty: 'normal' }], ['difícil', { difficulty: 'hard' }],
  ...SAMPLES.map((s) => [`experta ${s} muestras`, { difficulty: 'expert', samples: s }])]) {
  const t0 = performance.now();
  const r = await pool.solo({ games: GAMES, size: SIZE, strategy, seed: 2024 });
  line(label, r, performance.now() - t0);
}
await pool.close();
console.log('\nSi la diferencia entre dos filas es menor que ~2 veces su error, no es distinguible del ruido: súbele --games.\n');
if (args.csv) {
  writeFileSync(args.csv, [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).join(','))].join('\n') + '\n');
  console.log(`Guardado en ${args.csv}`);
}
