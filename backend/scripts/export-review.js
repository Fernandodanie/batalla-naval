#!/usr/bin/env node
/**
 * Exporta TODOS los textos históricos del juego en un solo documento para que los revise una persona de historia.
 *   npm run export:review                      → escribe revision-historica.md en la carpeta actual
 *   npm run export:review -- ruta/salida.md    → o donde quieras
 * Cada misión trae sus textos, datos, glosario, preguntas (con respuesta), fuentes y casillas «Aprobado / Corregir» con espacio para comentarios.
 * El documento NO se guarda en el repositorio: se genera cuando hace falta.
 */
import { writeFileSync } from 'node:fs';
import { CAMPAIGNS } from '../src/domain/campaigns.js';
import { GLOSSARY, glossaryFor } from '../src/content/glosario.js';
import { EVENT_KEYS, getStory, storyTexts } from '../src/content/index.js';

const EVENT_LABELS = { start: 'Al empezar la batalla', firstHit: 'Primer impacto', firstSunk: 'Primera unidad rival hundida', firstLoss: 'Primera baja propia', half: 'Mitad de la flota rival hundida', last: 'Queda una unidad rival', win: 'Victoria', lose: 'Derrota' };
const out = process.argv[2] ?? 'revision-historica.md';
const plainReal = (t) => t.replace(/^Resultado histórico:\s*/i, '');

const L = [];
const box = (label) => `- [ ] **${label}** · Corregir: ______________________________`;
L.push('# Revisión histórica de Batalla Naval', '',
  'Documento para quien revisa el contenido histórico. Por favor, para cada misión: marca **Aprobado** o escribe la **corrección** (con la fuente), y señala cualquier dato, ',
  'cifra, nombre, fecha o juicio que falte, sobre o pueda leerse como parcial hacia alguno de los bandos.', '',
  'Las campañas de **ficción** no describen hechos reales; basta revisar que no confundan al lector.', '');

for (const c of CAMPAIGNS) {
  L.push(`## ${c.title}${c.fiction ? ' (ficción)' : ''}`, '', c.intro, '');
  if (c.note) L.push(`_${c.note}_`, '');
  for (const m of c.missions) {
    const s = getStory(c.id, m.id);
    L.push(`### ${c.id} · misión ${m.id}: ${m.title}`, '',
      `**Fecha y lugar:** ${s.date} · ${s.place}  `,
      `**Resultado histórico:** ${plainReal(s.real)}  `,
      c.fiction ? '' : `**¿Ganó en la historia el bando del jugador?** ${s.won ? 'Sí' : 'No → la misión se presenta como «reinterpretación»'}`, '');
    if (s.commanders) L.push('**Jefes de cada bando (aparecen en la sala en lugar del nombre del jugador y de «Almirante IA»)**', '',
      `- Tú: ${s.commanders.you.name} — ${s.commanders.you.role}`, `- Rival: ${s.commanders.foe.name} — ${s.commanders.foe.role}`, '', box('Jefes'), '');
    else if (c.fiction) L.push('_Nombres de los jefes: inventados al azar en cada partida (no son personas reales)._', '');
    L.push('**Texto de la ficha (briefing)**', '', `> ${m.briefing}`, '', box('Briefing'), '');
    L.push('**Texto al ganar (debrief)**', '', `> ${m.debrief}`, '', box('Debrief'), '');
    L.push('**Escenas de apertura**', ''); s.intro.forEach((p, i) => L.push(`${i + 1}. ${p}`)); L.push('', box('Escenas'), '');
    L.push('**Frases durante la partida**', ''); for (const k of EVENT_KEYS) L.push(`- *${EVENT_LABELS[k]}:* ${s.events[k]}`); L.push('', box('Frases'), '');
    if (s.facts.length) { L.push('**Datos**', ''); s.facts.forEach((f) => L.push(`- ${f}`)); L.push('', box('Datos'), ''); }
    const gl = glossaryFor(storyTexts(s, m));
    if (gl.length) { L.push('**Glosario que aparece en esta misión**', ''); gl.forEach((g) => L.push(`- **${g.term}:** ${g.def}`)); L.push(''); }
    if (s.quiz?.length) {
      L.push('**Preguntas** (la respuesta correcta va en negrita)', '');
      s.quiz.forEach((q, i) => { L.push(`${i + 1}. ${q.q}`); q.options.forEach((o, k) => L.push(`   - ${k === q.answer ? `**${o}**` : o}`)); L.push(`   - _Explicación:_ ${q.why}`); });
      L.push('', box('Preguntas'), '');
    }
    if (s.sources.length) { L.push('**Fuentes citadas**', ''); s.sources.forEach((x) => L.push(`- ${x.title}${x.url ? ` — ${x.url}` : ''}`)); L.push('', '¿Las fuentes son adecuadas? ¿Falta alguna académica o del otro bando? ______________________________', ''); }
    L.push('**Comentarios generales de esta misión:**', '', '', '---', '');
  }
}
L.push('## Glosario completo', '');
GLOSSARY.forEach((g) => L.push(`- **${g.term}:** ${g.def}`));
L.push('', box('Glosario'), '');
writeFileSync(out, L.join('\n'), 'utf8');
console.log(`✓ Documento de revisión escrito en ${out} (${CAMPAIGNS.reduce((a, c) => a + c.missions.length, 0)} misiones).`);
