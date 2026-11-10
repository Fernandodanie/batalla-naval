import { getStory } from '../content/index.js';

/**
 * Preguntas de comprensión (modo aula). El servidor es quien corrige: el catálogo público NO incluye la respuesta correcta
 * ni la explicación (ver `publicStory`), así que no se pueden leer en el navegador antes de contestar.
 */

/** Error de validación del cuestionario (la ruta lo traduce a 400). */
export class QuizError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Corrige las respuestas de una misión.
 * @param {string} campaignId
 * @param {number|string} missionId
 * @param {unknown} answers  índice elegido en cada pregunta, en orden
 * @returns {{correct:number, total:number, perfect:boolean, details:{ok:boolean, chosen:number, right:number, why:string}[]}}
 */
export function gradeQuiz(campaignId, missionId, answers) {
  const quiz = getStory(campaignId, missionId)?.quiz ?? [];
  if (!quiz.length) throw new QuizError('sin_preguntas');
  if (!Array.isArray(answers) || answers.length !== quiz.length) throw new QuizError('respuestas_invalidas');
  const details = quiz.map((q, i) => {
    const chosen = answers[i];
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= q.options.length) throw new QuizError('respuestas_invalidas');
    return { ok: chosen === q.answer, chosen, right: q.answer, why: q.why };
  });
  const correct = details.filter((d) => d.ok).length;
  return { correct, total: quiz.length, perfect: correct === quiz.length, details };
}

/** Misiones (reales) que tienen preguntas: base de los logros de estudio. */
export const quizMissions = (campaigns) => campaigns.filter((c) => !c.fiction).flatMap((c) => c.missions
  .filter((m) => getStory(c.id, m.id)?.quiz?.length).map((m) => `${c.id}:${m.id}`));
