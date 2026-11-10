import { CHACO } from './chaco.js';
import { glossaryFor } from './glosario.js';
import { CORSO, LITORAL } from './ficcion.js';
import { SIGLO19 } from './siglo19.js';

/**
 * Narración de las misiones: una historia por misión, además del `briefing` y `debrief` de `domain/campaigns.js`.
 *
 *  story = {
 *    date, place            texto corto de contexto
 *    real                   qué pasó de verdad (o «Ficción»)
 *    won                    solo en misiones reales: ¿ganó en la historia el bando del jugador? Si es false, la misión debe llevar
 *                           `fictionalTwist: true` en campaigns.js (la interfaz avisa que es una reinterpretación)
 *    commanders             solo en misiones reales: { you:{name, role}, foe:{name, role} } los jefes de cada bando. Se muestran en la
 *                           sala en lugar del nombre de la persona y de «Almirante IA». En ficción no se escriben: se inventan al azar
 *                           (ver content/oficiales.js)
 *    facts[]                datos para el panel «Datos» y el modo aula
 *    sources[]              { title, url? } fuentes consultadas (obligatorias en campañas reales)
 *    intro[]                escenas de apertura (1–3 párrafos)
 *    events{}               frases que se muestran durante la partida (ver EVENT_KEYS)
 *    quiz[]                 preguntas de comprensión para el modo aula (solo campañas reales)
 *  }
 *
 * IMPORTANTE: son textos pensados para el aula. Antes de usarlos con estudiantes, que los revise alguien de historia.
 */
export const EVENT_KEYS = ['start', 'firstHit', 'firstSunk', 'firstLoss', 'half', 'last', 'win', 'lose'];

export const STORIES = { chaco: CHACO, siglo19: SIGLO19, corso: CORSO, litoral: LITORAL };

export const getStory = (campaignId, missionId) => STORIES[campaignId]?.[Number(missionId)] ?? null;

/**
 * Comprueba la forma de una historia. Devuelve una lista de problemas (vacía si está bien).
 * @param {object} story
 * @param {{fiction:boolean}} opts
 */
export function storyProblems(story, { fiction }) {
  const out = [];
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!story) return ['falta la historia'];
  for (const k of ['date', 'place', 'real']) if (!text(story[k])) out.push(`falta «${k}»`);
  if (!Array.isArray(story.intro) || !story.intro.length || !story.intro.every(text)) out.push('«intro» debe tener al menos un párrafo');
  for (const k of EVENT_KEYS) if (!text(story.events?.[k])) out.push(`falta el evento «${k}»`);
  for (const k of Object.keys(story.events ?? {})) if (!EVENT_KEYS.includes(k)) out.push(`evento desconocido «${k}»`);
  if (!Array.isArray(story.facts) || !story.facts.every(text)) out.push('«facts» debe ser una lista de textos');
  if (!Array.isArray(story.sources)) out.push('«sources» debe ser una lista');
  else for (const s of story.sources) {
    if (!text(s?.title)) out.push('una fuente no tiene título');
    if (s?.url != null && !/^https:\/\//.test(s.url)) out.push(`la fuente «${s?.title}» tiene un enlace que no es https`);
  }
  if (fiction && story.commanders) out.push('una misión de ficción no lleva «commanders»: sus nombres se inventan al azar');
  if (!fiction) {
    if ((story.facts ?? []).length < 2) out.push('una misión real necesita al menos 2 datos');
    if ((story.sources ?? []).length < 1) out.push('una misión real necesita al menos 1 fuente');
    if (typeof story.won !== 'boolean') out.push('una misión real necesita «won» (true o false)');
    for (const side of ['you', 'foe']) {
      if (!text(story.commanders?.[side]?.name)) out.push(`una misión real necesita «commanders.${side}.name»`);
      else if (!text(story.commanders[side].role)) out.push(`falta «commanders.${side}.role»`);
    }
    if (text(story.commanders?.you?.name) && story.commanders.you.name === story.commanders?.foe?.name) out.push('los dos bandos tienen el mismo comandante');
    if (!Array.isArray(story.quiz) || story.quiz.length < 2) out.push('una misión real necesita al menos 2 preguntas');
  }
  for (const q of story.quiz ?? []) {
    if (!text(q.q) || !text(q.why)) out.push('una pregunta no tiene enunciado o explicación');
    if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every(text)) out.push(`la pregunta «${q.q}» necesita al menos 2 opciones`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) out.push(`la pregunta «${q.q}» tiene una respuesta fuera de rango`);
  }
  return out;
}

/** Todos los textos de una misión (historia + briefing y debrief), para buscar términos del glosario. */
export const storyTexts = (story, mission = {}) => story ? [mission.briefing, mission.debrief, mission.title, story.real, story.place, ...(story.facts ?? []), ...(story.intro ?? []), ...Object.values(story.events ?? {}), ...(story.quiz ?? []).flatMap((q) => [q.q, ...q.options])] : [];
export { glossaryFor };

/**
 * Parte pública de una historia. Las preguntas viajan SIN la respuesta correcta ni la explicación (`why`, que suele
 * delatarla): las corrige el servidor (POST /api/quiz) y devuelve la explicación después de contestar.
 */
export const publicStory = (s) => (s ? {
  date: s.date, place: s.place, real: s.real, facts: s.facts, sources: s.sources, commanders: s.commanders ?? null,
  intro: s.intro, events: s.events, quiz: (s.quiz ?? []).map((q) => ({ q: q.q, options: q.options })),
} : null);
