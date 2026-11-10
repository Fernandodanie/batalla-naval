/**
 * Material para el aula, generado en el navegador a partir del catálogo (sin servidor):
 *  - guía didáctica en Markdown (contexto, datos, glosario, preguntas, fuentes);
 *  - hoja de trabajo imprimible (HTML autónomo; se imprime o se guarda como PDF desde el navegador).
 * Las respuestas correctas NO están en el catálogo: la guía invita a contestar en el juego (modo aula), que las corrige y explica.
 */
const LETTERS = 'abcdefghij';

/** Escapa texto para HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** `real` empieza con «Resultado histórico:»; en la guía ya hay una etiqueta propia. */
const plainReal = (t) => String(t ?? '').replace(/^Resultado histórico:\s*/i, '');

const DIFFICULTY = { easy: 'fácil', normal: 'normal', hard: 'difícil', expert: 'experta' };

/** Nombre de archivo: `guia-chaco-1.md`, `hoja-chaco-1.html`. */
export const guideFileName = (campaign, mission, kind = 'guia') => `${kind === 'hoja' ? 'hoja' : 'guia'}-${campaign.id}-${mission.id}.${kind === 'hoja' ? 'html' : 'md'}`;

/** Preguntas para conversar (generales, siempre las mismas, más una si la misión es reinterpretación). */
function discussion(mission) {
  const out = ['¿Qué fuentes usarías para comprobar lo que cuenta esta misión? ¿Todas cuentan lo mismo?',
    '¿Cómo se habrá vivido este hecho en cada bando? ¿Qué cambia según quién lo cuente?'];
  if (mission.twist) out.unshift('En el juego esta misión termina distinto a como ocurrió. ¿Por qué crees que el juego propone otro final y qué se pierde o se gana al cambiarlo?');
  return out;
}

/** Guía didáctica (Markdown) de una misión. */
export function guideMarkdown(campaign, mission) {
  const s = mission.story;
  if (!s) throw new Error('la misión no tiene historia');
  const L = [];
  L.push(`# Guía didáctica: ${campaign.title} · ${mission.id}. ${mission.title}`, '');
  L.push(`**Fecha y lugar:** ${s.date} · ${s.place}  `);
  L.push(`**Qué pasó de verdad:** ${plainReal(s.real)}`);
  if (mission.twist) L.push('', '> **Reinterpretación.** En el juego esta misión propone un final distinto al histórico; la ficha del juego siempre aclara qué ocurrió realmente.');
  L.push('', '## Contexto', '', mission.briefing, '');
  for (const p of s.intro ?? []) L.push(p, '');
  if (s.facts?.length) { L.push('## Datos clave', ''); s.facts.forEach((f) => L.push(`- ${f}`)); L.push(''); }
  if (s.glossary?.length) { L.push('## Glosario', ''); s.glossary.forEach((g) => L.push(`- **${g.term}:** ${g.def}`)); L.push(''); }
  L.push('## En el juego', '',
    `- Tablero ${mission.size}×${mission.size}, IA ${DIFFICULTY[mission.difficulty] ?? mission.difficulty}.`,
    '- Objetivos (cada uno vale una estrella):', `  - Gana la misión.`);
  (mission.objectives ?? []).forEach((o) => L.push(`  - ${o.label}.`));
  L.push('');
  if (s.quiz?.length) {
    L.push('## Preguntas de comprensión', '');
    s.quiz.forEach((q, i) => { L.push(`${i + 1}. ${q.q}`); q.options.forEach((o, k) => L.push(`   ${LETTERS[k]}) ${o}`)); L.push(''); });
    L.push('_Las respuestas y sus explicaciones las da el juego al contestar en el **modo aula** (Ajustes → Modo aula)._', '');
  }
  L.push('## Para conversar', ''); discussion(mission).forEach((d) => L.push(`- ${d}`)); L.push('');
  if (s.sources?.length) { L.push('## Fuentes consultadas', ''); s.sources.forEach((x) => L.push(x.url ? `- [${x.title}](${x.url})` : `- ${x.title}`)); L.push(''); }
  L.push('---', '_Material generado por Batalla Naval. El contenido histórico se contrastó con las fuentes citadas, pero debe revisarlo una persona de historia antes de usarlo en clase._', '');
  return L.join('\n');
}

/** Hoja de trabajo imprimible: documento HTML completo y autónomo (todo el texto se escapa). */
export function worksheetHtml(campaign, mission) {
  const s = mission.story;
  if (!s) throw new Error('la misión no tiene historia');
  const lines = (n) => Array.from({ length: n }, () => '<div class="line"></div>').join('');
  const q = (s.quiz ?? []).map((x, i) => `<li><p>${esc(x.q)}</p><ul class="opts">${x.options.map((o, k) => `<li>☐ ${LETTERS[k]}) ${esc(o)}</li>`).join('')}</ul></li>`).join('');
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(`Hoja de trabajo: ${mission.title}`)}</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; max-width: 760px; margin: 24px auto; padding: 0 16px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 20px 0 6px; border-bottom: 2px solid #111; }
  .meta { color: #444; } .who { display: flex; gap: 24px; margin: 12px 0; } .who span { flex: 1; border-bottom: 1px solid #111; padding-bottom: 14px; }
  .line { border-bottom: 1px solid #999; height: 26px; } .opts { list-style: none; padding-left: 12px; } .box { border: 1px solid #111; min-height: 70px; padding: 4px; }
  .tl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .tl div { border: 1px solid #111; min-height: 90px; padding: 4px; } .tl b { display: block; }
  .small { color: #555; font-size: 12px; } @media print { body { margin: 0; } .noprint { display: none; } }
</style></head><body>
<p class="noprint small">Para guardar como PDF: Imprimir → «Guardar como PDF».</p>
<h1>${esc(mission.title)}</h1>
<p class="meta">${esc(campaign.title)} · ${esc(s.date)} · ${esc(s.place)}</p>
<div class="who"><span>Nombre:</span><span>Curso:</span><span>Fecha:</span></div>
<h2>1. Lee</h2>
<p>${esc(mission.briefing)}</p>
<p><b>Qué pasó de verdad:</b> ${esc(plainReal(s.real))}</p>
${(s.facts ?? []).length ? `<ul>${s.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
${(s.glossary ?? []).length ? `<h2>2. Vocabulario</h2><ul>${s.glossary.map((g) => `<li><b>${esc(g.term)}:</b> ${esc(g.def)}</li>`).join('')}</ul><p>Escribe con tus palabras una de estas definiciones:</p>${lines(2)}` : ''}
<h2>3. Ordena el hecho</h2>
<div class="tl"><div><b>Antes</b></div><div><b>Durante</b></div><div><b>Después</b></div></div>
${q ? `<h2>4. Responde</h2><ol>${q}</ol>` : ''}
<h2>5. Reflexiona</h2>
${discussion(mission).slice(0, 2).map((d) => `<p>${esc(d)}</p>${lines(3)}`).join('')}
${(s.sources ?? []).length ? `<h2>Fuentes</h2><ul class="small">${s.sources.map((x) => `<li>${esc(x.title)}${x.url ? ` — ${esc(x.url)}` : ''}</li>`).join('')}</ul>` : ''}
<p class="small">Material generado por Batalla Naval. Contenido pendiente de revisión por una persona de historia.</p>
</body></html>`;
  return html;
}

/** Descarga un texto como archivo. */
export function downloadText(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
