/**
 * Calibra la granularidad adaptativa de TU equipo: ¿desde qué tamaño de tarea conviene repartir entre hilos?
 *
 *   node scripts/calibrate.js [--size 10] [--workers N] [--reps 15]
 *
 * Para cada número de muestras compara la latencia de UNA decisión de la IA Experta calculada en el hilo
 * principal contra la misma decisión repartida en el pool. El punto de cruce es el valor recomendado para
 * PARALLEL_MIN_COST (costo = muestras × barcos): por debajo, repartir cuesta más de lo que ahorra.
 */
import os from 'node:os';
import { AiPool } from '../src/ai/pool.js';
import { fleetFor } from '../src/domain/fleet.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const SIZE = Number(args.size) || 10;
const WORKERS = Number(args.workers) || Math.max(2, os.availableParallelism());
const REPS = Number(args.reps) || 15;
const FLEET = fleetFor(SIZE).map((f) => f.length);
const shots = new Array(SIZE * SIZE).fill(0);
shots[SIZE * 3 + 4] = 2; shots[1] = 1; shots[SIZE + 7] = 1;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const inline = new AiPool({ size: 2, adaptive: true, minParallelCost: Infinity }); // siempre en el hilo principal
const forced = new AiPool({ size: WORKERS, adaptive: true, minParallelCost: 0 });   // siempre repartido
const latency = async (pool, samples, reps = REPS) => {
  const payload = { size: SIZE, shots, remaining: FLEET, difficulty: 'expert', samples };
  await pool.choose(payload);
  const ts = [];
  for (let r = 0; r < reps; r++) { const t0 = performance.now(); await pool.choose(payload); ts.push(performance.now() - t0); }
  return median(ts);
};

// Calentamiento: sin esto la primera fila mide el compilador JIT en frío y falsea el cruce.
for (let k = 0; k < 3; k++) { await latency(inline, 4000, 20); await latency(forced, 4000, 20); }

console.log(`\nCalibración: tablero ${SIZE}×${SIZE}, ${FLEET.length} barcos, ${WORKERS} hilos, ${os.availableParallelism()} núcleos\n`);
console.log('muestras      costo   hilo principal   repartido   veredicto');
let crossover = null;
for (const samples of [250, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000]) {
  const a = await latency(inline, samples), b = await latency(forced, samples);
  const wins = b < a * 0.9;
  if (wins && crossover === null) crossover = samples * FLEET.length;
  if (!wins && crossover !== null) crossover = null; // el cruce debe mantenerse para tamaños mayores
  console.log(`${String(samples).padStart(7)}${String(samples * FLEET.length).padStart(11)}${(a.toFixed(2) + ' ms').padStart(17)}${(b.toFixed(2) + ' ms').padStart(12)}   ${wins ? 'repartir' : 'en el hilo principal'}`);
}
await Promise.all([inline.close(), forced.close()]);
console.log(crossover === null
  ? '\nEn este equipo repartir NO compensó en ningún tamaño probado (¿1 núcleo?). Deja la IA en el hilo principal: AI_WORKERS=0.\n'
  : `\nRecomendado:  PARALLEL_MIN_COST=${crossover}\n`);
