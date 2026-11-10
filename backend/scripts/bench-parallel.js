/**
 * Benchmark de paralelismo con métricas formales.
 *
 *   node scripts/bench-parallel.js [opciones]
 *
 *   --only strong,weak,fine,tournament   qué experimentos correr (por defecto todos)
 *   --workers 1,2,4,8                    cantidades de hilos a probar (por defecto: potencias de 2 hasta los núcleos)
 *   --samples 200000                     muestras Monte Carlo del experimento de escalabilidad fuerte
 *   --size 20                            lado del tablero
 *   --reps 5                             repeticiones por medición (se reporta la MEDIANA)
 *   --games 24                           partidas del torneo
 *   --csv resultados.csv                 guarda todas las filas para graficar
 *
 * Experimentos:
 *   strong      MISMO trabajo, más hilos.   S = T1/Tp   E = S/p   Karp-Flatt e = (1/S - 1/p)/(1 - 1/p)
 *   weak        trabajo PROPORCIONAL a los hilos.   E_débil = T1(N) / Tp(p·N)
 *   fine        tareas diminutas (IA "difícil"): muestra cuándo el paralelismo NO conviene (sobrecarga > cómputo)
 *   tournament  bolsa de tareas: partidas IA vs IA repartidas por una cola compartida
 *
 * Línea base T1: el cálculo secuencial en un solo hilo SIN pool (lo que haría un programa no paralelo).
 */
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { bestCell, sampleDensity } from '../src/ai/montecarlo.js';
import { AiPool } from '../src/ai/pool.js';
import { mulberry32 } from '../src/ai/rng.js';
import { chooseShot } from '../src/ai/strategies.js';
import { fleetFor } from '../src/domain/fleet.js';

// ------------------------------------------------------------------ opciones
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const CORES = os.availableParallelism();
const SIZE = Number(args.size) || 20;
const SAMPLES = Number(args.samples) || 200_000;
const REPS = Number(args.reps) || 5;
const GAMES = Number(args.games) || 24;
const only = new Set((args.only ?? 'strong,weak,fine,tournament').split(','));
const defaultWorkers = [...new Set([1, 2, 4, 8, CORES].filter((p) => p <= Math.max(CORES, 2)))].sort((a, b) => a - b);
const WORKERS = args.workers ? args.workers.split(',').map(Number) : defaultWorkers;

// ------------------------------------------------------------------ utilidades
const N = SIZE * SIZE;
const FLEET = fleetFor(SIZE).map((f) => f.length);
// Posición a mitad de partida: algunos impactos y agua, para que el muestreo tenga restricciones reales.
const shots = new Array(N).fill(0);
for (const [i, v] of [[SIZE * 3 + 4, 2], [SIZE * 3 + 5, 2], [1, 1], [SIZE + 7, 1], [N - 1, 1], [N - 2, 1]]) shots[i] = v;

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (n, d = 0) => n.toFixed(d);
const rows = [];
const log = (...cols) => console.log(cols.map((c, i) => String(c).padStart(i === 0 ? 0 : 11)).join(' '));

async function time(fn) {
  await fn(); // calentamiento (JIT, arranque de hilos)
  const ts = [];
  for (let r = 0; r < REPS; r++) { const t0 = performance.now(); await fn(); ts.push(performance.now() - t0); }
  return median(ts);
}

const sequential = (samples) => () => {
  const { density } = sampleDensity({ size: SIZE, shots, remaining: FLEET, samples, rng: mulberry32(1) });
  return bestCell(density, shots);
};
const parallel = (pool, samples, mode) => () => pool.density({ size: SIZE, shots, remaining: FLEET, samples, mode, seed: 1 });

function header(title, note) {
  console.log(`\n${'='.repeat(78)}\n${title}\n${note}\n${'='.repeat(78)}`);
}

// ------------------------------------------------------------------ ejecución
console.log(`Núcleos disponibles: ${CORES}   Node ${process.version}   tablero ${SIZE}×${SIZE}   repeticiones: ${REPS} (mediana)`);
if (CORES === 1) console.log('AVISO: con 1 solo núcleo NO puede haber aceleración real; las cifras mostrarán solo la sobrecarga.');
if (Math.max(...WORKERS) > CORES) console.log(`AVISO: se piden hasta ${Math.max(...WORKERS)} hilos con ${CORES} núcleos: más hilos que núcleos solo agrega cambios de contexto.`);

if (only.has('strong')) {
  header(`1) ESCALABILIDAD FUERTE  (${SAMPLES.toLocaleString()} muestras fijas)`,
    'T1 = secuencial sin pool. S = T1/Tp, E = S/p, e = métrica de Karp-Flatt (fracción serial observada).');
  const t1 = await time(sequential(SAMPLES));
  console.log(`T1 secuencial: ${fmt(t1, 1)} ms\n`);
  log('modo', 'hilos p', 'Tp (ms)', 'speedup', 'eficiencia', 'Karp-Flatt');
  for (const mode of ['message', 'shared']) {
    for (const p of WORKERS) {
      const pool = new AiPool({ size: p, timeoutMs: 600_000 });
      const tp = await time(parallel(pool, SAMPLES, mode));
      await pool.close();
      const S = t1 / tp, E = S / p;
      const kf = p > 1 ? (1 / S - 1 / p) / (1 - 1 / p) : NaN;
      log(mode.padEnd(8), p, fmt(tp, 1), fmt(S, 2) + 'x', fmt(E * 100) + ' %', Number.isNaN(kf) ? '-' : fmt(kf, 3));
      rows.push({ experimento: 'strong', modo: mode, p, muestras: SAMPLES, t1_ms: t1, tp_ms: tp, speedup: S, eficiencia: E, karp_flatt: kf });
    }
  }
  console.log('\nLectura: si e se mantiene ~constante al subir p, la sobrecarga es serial fija (ley de Amdahl: S_max = 1/e).');
  console.log('Si e CRECE con p, hay sobrecarga que aumenta con los hilos (comunicación, memoria, más hilos que núcleos).');
}

if (only.has('weak')) {
  const per = Math.round(SAMPLES / 4);
  header(`2) ESCALABILIDAD DÉBIL  (${per.toLocaleString()} muestras POR hilo)`,
    'El trabajo crece con p. Eficiencia débil = T(1 hilo, N) / T(p hilos, p·N). Ideal: 100 %.');
  const pool1 = new AiPool({ size: 1, timeoutMs: 600_000 });
  const base = await time(parallel(pool1, per, 'shared'));
  await pool1.close();
  console.log(`T(1 hilo, ${per.toLocaleString()} muestras): ${fmt(base, 1)} ms\n`);
  log('hilos p', 'muestras', 'Tp (ms)', 'ef. débil');
  for (const p of WORKERS) {
    const pool = new AiPool({ size: p, timeoutMs: 600_000 });
    const tp = await time(parallel(pool, per * p, 'shared'));
    await pool.close();
    log(p, (per * p).toLocaleString(), fmt(tp, 1), fmt((base / tp) * 100) + ' %');
    rows.push({ experimento: 'weak', modo: 'shared', p, muestras: per * p, t1_ms: base, tp_ms: tp, speedup: (p * base) / tp, eficiencia: base / tp, karp_flatt: '' });
  }
}

if (only.has('fine')) {
  header('3) GRANULARIDAD: tareas diminutas (IA "difícil", una jugada ≈ décimas de ms)',
    'Enviar la tarea a otro hilo cuesta más que calcularla: paralelizar tareas finas EMPEORA el tiempo.');
  const payload = { size: SIZE, shots, remaining: FLEET, difficulty: 'hard' };
  const BATCH = 2000;
  const t0 = performance.now();
  for (let k = 0; k < BATCH; k++) chooseShot(payload);
  const seq = performance.now() - t0;
  console.log(`${BATCH} jugadas secuenciales: ${fmt(seq, 1)} ms\n`);
  log('hilos p', 'Tp (ms)', 'speedup');
  for (const p of WORKERS) {
    const pool = new AiPool({ size: p, timeoutMs: 600_000, adaptive: false }); // adaptive:false = forzar el reparto
    await pool.choose(payload);
    const t1 = performance.now();
    await Promise.all(Array.from({ length: BATCH }, () => pool.choose(payload)));
    const tp = performance.now() - t1;
    await pool.close();
    log(p, fmt(tp, 1), fmt(seq / tp, 2) + 'x');
    rows.push({ experimento: 'fine', modo: 'message', p, muestras: BATCH, t1_ms: seq, tp_ms: tp, speedup: seq / tp, eficiencia: seq / tp / p, karp_flatt: '' });
  }
}

if (only.has('tournament')) {
  const SZ = 10;
  header(`4) TORNEO: bolsa de tareas  (${GAMES} partidas ${SZ}×${SZ}, difícil vs experta de 3000 muestras)`,
    'Cada partida es una tarea independiente; los workers toman la siguiente de una cola compartida.');
  const params = { games: GAMES, size: SZ, a: { difficulty: 'hard' }, b: { difficulty: 'expert', samples: 3000 }, seed: 7, chunk: 1 };
  const seqPool = new AiPool({ size: 0 });
  const t0 = performance.now();
  const ref = await seqPool.tournament(params);
  const t1 = performance.now() - t0;
  await seqPool.close();
  console.log(`Secuencial: ${fmt(t1, 0)} ms   (victorias difícil ${ref.winsA} - experta ${ref.winsB})\n`);
  log('hilos p', 'Tp (ms)', 'speedup', 'eficiencia', 'mismo result.');
  for (const p of WORKERS) {
    const pool = new AiPool({ size: p });
    const t = performance.now();
    const r = await pool.tournament(params);
    const tp = performance.now() - t;
    await pool.close();
    const same = JSON.stringify({ ...r, tasks: 0 }) === JSON.stringify({ ...ref, tasks: 0 });
    log(p, fmt(tp, 0), fmt(t1 / tp, 2) + 'x', fmt((t1 / tp / p) * 100) + ' %', same ? 'sí' : 'NO');
    rows.push({ experimento: 'tournament', modo: 'queue', p, muestras: GAMES, t1_ms: t1, tp_ms: tp, speedup: t1 / tp, eficiencia: t1 / tp / p, karp_flatt: '' });
  }
}

if (args.csv && rows.length) {
  const cols = Object.keys(rows[0]);
  writeFileSync(args.csv, [cols.join(','), ...rows.map((r) => cols.map((c) => (typeof r[c] === 'number' ? +r[c].toFixed(4) : r[c])).join(','))].join('\n') + '\n');
  console.log(`\nResultados guardados en ${args.csv}`);
}
console.log('');
