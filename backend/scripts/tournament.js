/**
 * Torneo IA vs IA en paralelo (paralelismo de TAREAS / bolsa de tareas).
 *
 *   node scripts/tournament.js [--games 40] [--size 10] [--a hard] [--b expert] [--samples 5000] [--workers N]
 *
 * Reparte las partidas entre worker threads y compara con la ejecución secuencial.
 * Sirve también para medir qué dificultad es mejor: gana la que necesita menos disparos.
 */
import os from 'node:os';
import { AiPool } from '../src/ai/pool.js';
import { DIFFICULTIES } from '../src/ai/strategies.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const GAMES = Number(args.games) || 40;
const SIZE = Number(args.size) || 10;
const A = args.a ?? 'hard';
const B = args.b ?? 'expert';
const SAMPLES = Number(args.samples) || 5000;
const WORKERS = Number(args.workers) || Math.max(2, os.availableParallelism());
for (const d of [A, B]) if (!DIFFICULTIES.includes(d)) { console.error(`Dificultad desconocida: ${d} (${DIFFICULTIES.join(', ')})`); process.exit(1); }

const params = { games: GAMES, size: SIZE, a: { difficulty: A, samples: SAMPLES }, b: { difficulty: B, samples: SAMPLES }, seed: 2024, chunk: 1 };
const run = async (size) => {
  const pool = new AiPool({ size });
  const t0 = performance.now();
  const r = await pool.tournament(params);
  const ms = performance.now() - t0;
  await pool.close();
  return { r, ms };
};

console.log(`\n${GAMES} partidas ${SIZE}×${SIZE}: ${A} vs ${B} (${SAMPLES} muestras si es experta), ${os.availableParallelism()} núcleos`);
const seq = await run(0);
const par = await run(WORKERS);
const avg = (shots, wins) => (wins ? (shots / wins).toFixed(1) : '-');
console.log(`  ${A}: ${seq.r.winsA} victorias, ${avg(seq.r.shotsWinA, seq.r.winsA)} disparos por victoria`);
console.log(`  ${B}: ${seq.r.winsB} victorias, ${avg(seq.r.shotsWinB, seq.r.winsB)} disparos por victoria`);
console.log(`  Secuencial     : ${seq.ms.toFixed(0)} ms`);
console.log(`  ${String(WORKERS).padStart(2)} hilos       : ${par.ms.toFixed(0)} ms   (aceleración ${(seq.ms / par.ms).toFixed(2)}x, eficiencia ${((seq.ms / par.ms / WORKERS) * 100).toFixed(0)} %)`);
console.log(`  Mismo resultado: ${JSON.stringify(seq.r) === JSON.stringify(par.r) ? 'sí (determinista por semilla)' : 'NO'}\n`);
