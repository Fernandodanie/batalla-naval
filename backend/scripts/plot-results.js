/**
 * Convierte el CSV de `npm run bench -- --csv resultados.csv` en una página HTML con las gráficas del informe
 * (speedup, eficiencia, escalabilidad débil, torneo y granularidad), sin depender de ninguna librería.
 *
 *   node scripts/plot-results.js resultados.csv [salida.html]
 *
 * Abre el HTML en el navegador; cada gráfica se puede copiar o capturar para el informe. Las líneas
 * punteadas son referencias teóricas: lo ideal (S = p) y la ley de Amdahl con la fracción serial estimada
 * por la métrica de Karp-Flatt (promedio de los puntos medidos).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output = 'graficas.html'] = process.argv.slice(2);
if (!input) { console.error('Uso: node scripts/plot-results.js resultados.csv [salida.html]'); process.exit(1); }

const [head, ...lines] = readFileSync(input, 'utf8').trim().split('\n');
const cols = head.split(',');
const rows = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v === '' || Number.isNaN(Number(v)) ? v : Number(v)])));
const where = (exp, modo) => rows.filter((r) => r.experimento === exp && (!modo || r.modo === modo)).sort((a, b) => a.p - b.p);

const COLORS = ['#2a78d6', '#d65a2a', '#2a9d6a', '#8a5ad6'];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function chart({ title, xLabel, yLabel, series, yMin = 0 }) {
  const W = 560, H = 340, L = 56, R = 16, T = 34, B = 48;
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b);
  const xMax = Math.max(...xs), yMax = Math.max(...series.flatMap((s) => s.points.map((p) => p[1])), 1) * 1.08;
  const X = (x) => L + ((x - Math.min(...xs)) / ((xMax - Math.min(...xs)) || 1)) * (W - L - R);
  const Y = (y) => T + (1 - (y - yMin) / (yMax - yMin)) * (H - T - B);
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => (yMax - yMin) / s <= 6) ?? 100;
  let g = '';
  for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" class="grid"/><text x="${L - 8}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`;
  }
  for (const x of xs) g += `<text x="${X(x)}" y="${H - B + 18}" text-anchor="middle">${x}</text>`;
  const lines = series.map((s, i) => {
    const c = s.color ?? COLORS[i % COLORS.length];
    const path = s.points.map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
    const dots = s.dashed ? '' : s.points.map((p) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="${c}"/>`).join('');
    return `<path d="${path}" fill="none" stroke="${c}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="6 4" opacity=".7"' : ''}/>${dots}`;
  }).join('');
  const legend = series.map((s, i) => `<g transform="translate(${L + 8 + i * 150},${T - 16})"><rect width="12" height="3" y="4" fill="${s.color ?? COLORS[i % COLORS.length]}"/><text x="18" y="9">${esc(s.name)}</text></g>`).join('');
  return `<figure><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
<text x="${L}" y="14" class="title">${esc(title)}</text>${legend}${g}
<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="axis"/><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="axis"/>${lines}
<text x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}</text>
<text transform="translate(14,${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text></svg></figure>`;
}

const figs = [];
const strong = ['message', 'shared'].map((m) => ({ modo: m, rows: where('strong', m) })).filter((s) => s.rows.length);
if (strong.length) {
  const ps = [...new Set(strong.flatMap((s) => s.rows.map((r) => r.p)))].sort((a, b) => a - b);
  const kf = strong.flatMap((s) => s.rows).map((r) => r.karp_flatt).filter((v) => typeof v === 'number' && v > 0);
  const e = kf.length ? kf.reduce((a, b) => a + b, 0) / kf.length : null;
  figs.push(chart({
    title: 'Escalabilidad fuerte: aceleración', xLabel: 'hilos (p)', yLabel: 'S = T1 / Tp',
    series: [
      ...strong.map((s) => ({ name: s.modo === 'shared' ? 'memoria compartida' : 'mensajes', points: s.rows.map((r) => [r.p, r.speedup]) })),
      { name: 'ideal (S = p)', points: ps.map((p) => [p, p]), dashed: true, color: '#888' },
      ...(e ? [{ name: `Amdahl (f≈${e.toFixed(3)})`, points: ps.map((p) => [p, 1 / (e + (1 - e) / p)]), dashed: true, color: '#b08a1a' }] : []),
    ],
  }));
  figs.push(chart({
    title: 'Escalabilidad fuerte: eficiencia', xLabel: 'hilos (p)', yLabel: 'E = S / p (%)',
    series: [...strong.map((s) => ({ name: s.modo === 'shared' ? 'memoria compartida' : 'mensajes', points: s.rows.map((r) => [r.p, r.eficiencia * 100]) })),
      { name: 'ideal (100 %)', points: ps.map((p) => [p, 100]), dashed: true, color: '#888' }],
  }));
}
const weak = where('weak');
if (weak.length) figs.push(chart({ title: 'Escalabilidad débil (trabajo ∝ hilos)', xLabel: 'hilos (p)', yLabel: 'eficiencia débil (%)',
  series: [{ name: 'medida', points: weak.map((r) => [r.p, r.eficiencia * 100]) }, { name: 'ideal (100 %)', points: weak.map((r) => [r.p, 100]), dashed: true, color: '#888' }] }));
const tour = where('tournament');
if (tour.length) figs.push(chart({ title: 'Torneo: bolsa de tareas', xLabel: 'hilos (p)', yLabel: 'aceleración',
  series: [{ name: 'medida', points: tour.map((r) => [r.p, r.speedup]) }, { name: 'ideal (S = p)', points: tour.map((r) => [r.p, r.p]), dashed: true, color: '#888' }] }));
const fine = where('fine');
if (fine.length) figs.push(chart({ title: 'Granularidad: tareas diminutas', xLabel: 'hilos (p)', yLabel: 'aceleración (<1 = empeora)',
  series: [{ name: 'medida', points: fine.map((r) => [r.p, r.speedup]) }, { name: 'sin cambio (1×)', points: fine.map((r) => [r.p, 1]), dashed: true, color: '#888' }] }));

if (!figs.length) { console.error('El CSV no contiene filas de experimentos conocidos.'); process.exit(1); }
writeFileSync(output, `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Resultados de paralelismo</title><style>
:root{--bg:#fff;--fg:#1d2330;--grid:#e3e6ec;--axis:#8a93a3}
@media (prefers-color-scheme:dark){:root{--bg:#14181f;--fg:#e6e9ef;--grid:#2a313d;--axis:#7d8798}}
body{margin:0;padding:20px;background:var(--bg);color:var(--fg);font:14px system-ui,sans-serif}
h1{font-size:20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;max-width:1200px}
figure{margin:0}svg{width:100%;height:auto}svg text{fill:var(--fg);font-size:12px}.title{font-weight:600;font-size:13px}
.grid{stroke:var(--grid)}.axis{stroke:var(--axis)}</style>
<h1>Resultados de paralelismo — Batalla Naval</h1><p>Origen: ${esc(input)}. Línea punteada gris = ideal teórico.</p><main>${figs.join('\n')}</main></html>`);
console.log(`Gráficas guardadas en ${output} (${figs.length})`);
