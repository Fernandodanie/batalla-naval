/**
 * ¿Para qué sirven los hilos? Para que el servidor NO se congele mientras la IA piensa.
 *
 *   node scripts/latency-test.js [--workers N] [--samples 20000] [--every 25] [--seconds 6] [--size 10]
 *
 * Simula una carga constante de decisiones de la IA Experta (una cada `--every` ms, como muchas partidas
 * a la vez) y mide el retraso del event loop con la IA (1) en el hilo principal y (2) en N hilos.
 * Si el retraso es mucho menor en (2), los hilos protegen la capacidad de respuesta de TODAS las salas.
 *
 * Con un solo núcleo físico los hilos compiten con el hilo principal por la misma CPU y la diferencia desaparece.
 */
import os from 'node:os';
import { AiPool } from '../src/ai/pool.js';
import { createMetrics } from '../src/metrics.js';
import { fleetFor } from '../src/domain/fleet.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const SIZE = Number(args.size) || 10;
const SAMPLES = Number(args.samples) || 20_000;
const EVERY = Number(args.every) || 25;
const SECONDS = Number(args.seconds) || 6;
const WORKERS = Number(args.workers) || Math.max(1, os.availableParallelism() - 1);
const FLEET = fleetFor(SIZE).map((f) => f.length);
const shots = new Array(SIZE * SIZE).fill(0);
shots[SIZE * 3 + 4] = 2; shots[1] = 1;
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;

async function scenario(label, poolOptions) {
  const pool = new AiPool({ ...poolOptions, mcSamples: SAMPLES, timeoutMs: 60_000 });
  const metrics = createMetrics({ resolution: 5 });
  const payload = { size: SIZE, shots, remaining: FLEET, difficulty: 'expert' };
  await pool.choose(payload); // calentamiento
  await new Promise((r) => setTimeout(r, 100));
  metrics.reset();
  const lat = [];
  const pending = [];
  const timer = setInterval(() => {
    const t0 = performance.now();
    pending.push(pool.choose(payload).then(() => lat.push(performance.now() - t0)).catch(() => {}));
  }, EVERY);
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  clearInterval(timer);
  await Promise.all(pending);
  const lag = metrics.snapshot();
  metrics.close();
  await pool.close();
  return { label, n: lat.length, p50: pct(lat, 50), p99: pct(lat, 99), lag };
}

console.log(`\nCarga: 1 decisión de IA Experta (${SAMPLES.toLocaleString()} muestras) cada ${EVERY} ms durante ${SECONDS} s. Núcleos: ${os.availableParallelism()}\n`);
const rows = [
  await scenario('en el hilo principal', { size: 0 }),
  await scenario(`${WORKERS} hilos de trabajo`, { size: WORKERS, adaptive: false }),
];
console.log('configuración'.padEnd(24) + 'decisiones'.padStart(11) + 'latencia p50'.padStart(14) + 'p99'.padStart(10) + '   retraso del event loop p50 / p99 / máx');
for (const r of rows) {
  console.log(r.label.padEnd(24) + String(r.n).padStart(11) + `${r.p50.toFixed(1)} ms`.padStart(14) + `${r.p99.toFixed(1)} ms`.padStart(10)
    + `   ${r.lag.p50} / ${r.lag.p99} / ${r.lag.max} ms`);
}
const [a, b] = rows;
console.log(b.lag.p99 < a.lag.p99
  ? `\nLos hilos redujeron el retraso p99 del servidor de ${a.lag.p99} ms a ${b.lag.p99} ms.\n`
  : '\nSin mejora visible: la carga es baja para tu CPU, o hay pocos núcleos. Prueba más muestras (--samples) o más ritmo (--every 10).\n');
