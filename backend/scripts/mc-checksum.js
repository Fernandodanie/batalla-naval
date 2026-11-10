/**
 * Calcula, con la versión de Node, el mismo conteo y suma de control que imprime kernels/montecarlo_omp.c.
 * Si coinciden, ambas implementaciones calculan EXACTAMENTE lo mismo (misma semilla y mismo reparto en trozos).
 *
 *   node scripts/mc-checksum.js --size 10 --samples 200000 --threads 4 [--seed 1]
 */
import { sampleDensity } from '../src/ai/montecarlo.js';
import { chunkSeed, mulberry32 } from '../src/ai/rng.js';
import { fleetFor } from '../src/domain/fleet.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const size = Number(args.size) || 10, samples = Number(args.samples) || 200_000;
const threads = Number(args.threads) || 4, seed = Number(args.seed ?? 1) >>> 0;
const n = size * size;
const shots = new Array(n).fill(0);
shots[size * 3 + 4] = 2; shots[size * 3 + 5] = 2;
shots[1] = 1; shots[size + 7] = 1; shots[n - 1] = 1; shots[n - 2] = 1;
const remaining = fleetFor(size).map((f) => f.length);

const base = Math.floor(samples / threads), extra = samples % threads;
const density = new Int32Array(n);
let accepted = 0;
const t0 = performance.now();
for (let k = 0; k < threads; k++) {
  const chunk = base + (k < extra ? 1 : 0);
  if (chunk <= 0) continue;
  const r = sampleDensity({ size, shots, remaining, samples: chunk, rng: mulberry32(chunkSeed(seed, k)) });
  for (let i = 0; i < n; i++) density[i] += r.density[i];
  accepted += r.accepted;
}
let sum = 0;
for (let i = 0; i < n; i++) sum += density[i] * (i + 1);
console.log(`size=${size} samples=${samples} threads=${threads} accepted=${accepted} checksum=${sum % 4294967296} (Node, secuencial: ${(performance.now() - t0).toFixed(0)} ms)`);
