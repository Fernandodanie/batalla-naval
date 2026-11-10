/**
 * Convierte los CSV de medición en las tablas, figuras y números que usa el informe (carpeta generado/).
 *
 *   node informe/results-to-latex.mjs --mpi cluster/resultados-mpi.csv [--node cluster/resultados-node.csv] [--out informe/generado]
 *
 * Entradas
 *   --mpi   CSV de cluster/run-experiments.sh   (experimento,size,samples,hosts,ranks,threads,accepted,checksum,total_ms,compute_ms,comm_ms,imbalance)
 *   --node  CSV de `npm run bench -- --csv`      (capa de aplicación en Node; opcional)
 *   --net   CSV de kernels/pingpong_mpi          (latencia α y ancho de banda β de la red; opcional)
 * Salidas (todas se incluyen con \input desde main.tex; si no existen, el informe muestra marcadores "[completar]")
 *   datos.tex         macros con los números clave: \SpeedupMax, \EficienciaMax, \ProcMax, \AmdahlF, \AmdahlLimite, ...
 *   tabla_fuerte.tex  filas de la tabla de escalabilidad fuerte (S, E, % de comunicación, desbalance)
 *   tabla_debil.tex   filas de la tabla de escalabilidad débil (eficiencia débil y speedup escalado de Gustafson)
 *   tabla_node.tex    filas de la tabla de la capa Node (si hay --node)
 *   fig_speedup.tex / fig_eficiencia.tex   contenido de ejes pgfplots (medido + ideal + modelo de Amdahl/Gustafson)
 *
 * Métricas:  S = T1/Tp   E = S/p   Karp-Flatt e = (1/S - 1/p)/(1 - 1/p)   Amdahl S(p) = 1/(f + (1-f)/p)
 *            débil: S_esc = p·T1(N)/Tp(p·N)   Gustafson S(p) = p - α(p-1)   p = ranks × hilos
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
if (!argv.mpi && !argv.node) { console.error('Uso: node informe/results-to-latex.mjs --mpi resultados-mpi.csv [--node resultados-node.csv] [--out generado]'); process.exit(1); }
const OUT = argv.out ?? new URL('./generado', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const readCsv = (file) => {
  const [head, ...lines] = readFileSync(file, 'utf8').trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v])));
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
// Coma decimal (norma en español). `{,}` evita el espacio extra que TeX pone tras una coma en modo matemático.
// Las coordenadas de pgfplots NO pasan por aquí: usan punto, que es lo que exige TeX.
const dec = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace('.', '{,}') : '--');
const f1 = (x) => dec(x, 1);
const f2 = (x) => dec(x, 2);
const f3 = (x) => dec(x, 3);
const macros = [];
const def = (name, value) => macros.push(`\\renewcommand{\\${name}}{${value}}`);
const names = ['AlphaUs', 'BetaMBps', 'SpeedupMax', 'EficienciaMax', 'ProcMax', 'TUnoMs', 'KarpFlattMedio', 'AmdahlF', 'AmdahlLimite', 'GustafsonAlpha',
  'GustafsonSMax', 'CommPctMax', 'ImbalanceMax', 'NodosCluster', 'MuestrasFuerte', 'TableroLado', 'NodeSpeedupMax', 'NodeProcMax'];

// ------------------------------------------------------------------ MPI + OpenMP
if (argv.mpi) {
  const rows = readCsv(argv.mpi).map((r) => ({ ...r, p: r.ranks * r.threads }));
  const strong = rows.filter((r) => r.experimento === 'strong').sort((a, b) => a.p - b.p || a.ranks - b.ranks);
  const weak = rows.filter((r) => r.experimento === 'weak').sort((a, b) => a.p - b.p || a.ranks - b.ranks);

  const base = strong.find((r) => r.p === 1);
  if (!base) throw new Error('El CSV no trae la línea base (1 rank × 1 hilo) de escalabilidad fuerte.');
  const T1 = base.total_ms;
  const S = strong.map((r) => ({ ...r, S: T1 / r.total_ms, E: T1 / r.total_ms / r.p }));
  for (const r of S) r.kf = r.p > 1 ? (1 / r.S - 1 / r.p) / (1 - 1 / r.p) : NaN;
  // f ∈ [0,1]: con datos ruidosos o con speedup < 1 Karp-Flatt puede salir fuera de rango
  const f = Math.min(1, Math.max(0, median(S.filter((r) => r.p > 1).map((r) => r.kf))));
  const multi = S.filter((r) => r.p > 1);
  const best = (multi.length ? multi : S).reduce((a, b) => (b.S > a.S ? b : a)); // el mejor con más de 1 unidad de cómputo

  // checksum: mismo samples y mismo nº de trozos (ranks × hilos) → mismo resultado. Si no coincide, algo está mal.
  const bad = [];
  const byParts = new Map();
  for (const r of rows) {
    const key = `${r.samples}/${r.p}`;
    if (byParts.has(key) && byParts.get(key) !== r.checksum) bad.push(key);
    byParts.set(key, r.checksum);
  }
  if (bad.length) console.warn(`ADVERTENCIA: sumas de control distintas para misma configuración lógica: ${bad.join(', ')}`);

  def('SpeedupMax', f2(best.S));
  def('EficienciaMax', f1(best.E * 100));
  def('ProcMax', String(best.p));
  def('TUnoMs', f1(T1));
  def('KarpFlattMedio', f3(f));
  def('AmdahlF', f3(f));
  def('AmdahlLimite', f < 1e-4 ? '\\infty' : f1(1 / f));
  def('CommPctMax', f1(Math.max(...S.map((r) => (r.comm_ms / r.total_ms) * 100))));
  def('ImbalanceMax', f2(Math.max(...S.map((r) => r.imbalance))));
  def('NodosCluster', String(Math.max(...rows.map((r) => r.hosts))));
  def('MuestrasFuerte', base.samples.toLocaleString('en-US').replace(/,/g, '\\,'));
  def('TableroLado', String(base.size));

  writeFileSync(join(OUT, 'tabla_fuerte.tex'), S.map((r) =>
    `${r.hosts}\\,/\\,${r.ranks}\\,/\\,${r.threads} & ${r.p} & ${f1(r.total_ms)} & ${f2(r.S)} & ${f1(r.E * 100)} & ${f1((r.comm_ms / r.total_ms) * 100)} & ${f2(r.imbalance)}`).join(' \\\\\n') + '%\n');

  const ps = [...new Set(S.map((r) => r.p))];
  const pMax = Math.max(...ps);
  const grid = Array.from({ length: 41 }, (_, i) => 1 + ((pMax - 1) * i) / 40);
  const coords = (pts) => pts.map(([x, y]) => `(${x.toFixed(3)},${Number(y).toFixed(4)})`).join(' ');
  writeFileSync(join(OUT, 'fig_speedup.tex'),
    `\\addplot[only marks,mark=*,blue] coordinates {${coords(S.map((r) => [r.p, r.S]))}};\\addlegendentry{Medido}\n`
    + `\\addplot[dashed,gray] coordinates {(1,1) (${pMax},${pMax})};\\addlegendentry{Ideal}\n`
    + `\\addplot[red,thick,no marks] coordinates {${coords(grid.map((p) => [p, 1 / (f + (1 - f) / p)]))}};\\addlegendentry{Amdahl ($f=${f3(f)}$)}\n`);
  writeFileSync(join(OUT, 'fig_eficiencia.tex'),
    `\\addplot[only marks,mark=*,blue] coordinates {${coords(S.map((r) => [r.p, r.E * 100]))}};\\addlegendentry{Fuerte}\n`
    + (weak.length ? '' : '')
    + `\\addplot[dashed,gray] coordinates {(1,100) (${pMax},100)};\\addlegendentry{Ideal}\n`);

  // ---- débil
  let weakRows = '';
  if (weak.length) {
    const wb = weak.find((r) => r.p === 1);
    if (wb) {
      const W = weak.map((r) => ({ ...r, Ew: wb.total_ms / r.total_ms, Ss: (r.p * wb.total_ms) / r.total_ms }));
      const alpha = Math.min(1, Math.max(0, median(W.filter((r) => r.p > 1).map((r) => (r.p - r.Ss) / (r.p - 1)))));
      const gMax = W.reduce((a, b) => (b.Ss > a.Ss ? b : a));
      def('GustafsonAlpha', f3(alpha));
      def('GustafsonSMax', f2(gMax.Ss));
      weakRows = W.map((r) => `${r.hosts}\\,/\\,${r.ranks}\\,/\\,${r.threads} & ${r.p} & ${r.samples.toLocaleString('en-US').replace(/,/g, '\\,')} & ${f1(r.total_ms)} & ${f1(r.Ew * 100)} & ${f2(r.Ss)} & ${f2(r.p - alpha * (r.p - 1))}`).join(' \\\\\n') + '%\n';
      writeFileSync(join(OUT, 'fig_eficiencia.tex'),
        `\\addplot[only marks,mark=*,blue] coordinates {${coords(S.map((r) => [r.p, r.E * 100]))}};\\addlegendentry{Fuerte}\n`
        + `\\addplot[only marks,mark=square*,orange] coordinates {${coords(W.map((r) => [r.p, r.Ew * 100]))}};\\addlegendentry{D\\'ebil}\n`
        + `\\addplot[dashed,gray] coordinates {(1,100) (${pMax},100)};\\addlegendentry{Ideal}\n`);
    }
  }
  writeFileSync(join(OUT, 'tabla_debil.tex'), weakRows);
}

// ------------------------------------------------------------------ red: ping-pong (opcional)
if (argv.net) { // CSV de kernels/pingpong_mpi: bytes,one_way_us
  const pts = readCsv(argv.net).filter((r) => r.bytes > 0).sort((a, b) => a.bytes - b.bytes);
  if (pts.length > 1) {
    const alpha = Math.min(...pts.filter((r) => r.bytes <= 64).map((r) => r.one_way_us));
    const big = pts.at(-1);
    const beta = big.bytes / Math.max(1e-9, big.one_way_us - alpha); // bytes/µs = MB/s
    def('AlphaUs', f1(alpha));
    def('BetaMBps', f1(beta));
  }
}

// ------------------------------------------------------------------ capa Node (opcional)
if (argv.node) {
  const rows = readCsv(argv.node).filter((r) => r.experimento === 'strong');
  if (rows.length) {
    const best = rows.reduce((a, b) => (b.speedup > a.speedup ? b : a));
    def('NodeSpeedupMax', f2(best.speedup));
    def('NodeProcMax', String(best.p));
    writeFileSync(join(OUT, 'tabla_node.tex'), rows.map((r) =>
      `${r.modo === 'shared' ? 'compartida' : 'mensajes'} & ${r.p} & ${f1(r.tp_ms)} & ${f2(r.speedup)} & ${f1(r.eficiencia * 100)} & ${Number.isFinite(r.karp_flatt) ? f3(r.karp_flatt) : '--'}`).join(' \\\\\n') + '%\n');
  }
}

// ------------------------------------------------------------------ datos.tex (solo los macros que se pudieron calcular)
writeFileSync(join(OUT, 'datos.tex'), '% Generado por informe/results-to-latex.mjs: NO editar a mano.\n'
  + names.map((n) => `\\providecommand{\\${n}}{}`).join('\n') + '\n' + macros.join('\n') + '\n');
console.log(`Generado en ${OUT}: ${macros.length} valores, tablas y figuras.`);
