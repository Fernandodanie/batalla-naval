/**
 * Textos de la narración que se leen en voz alta: las escenas de apertura (modo aula) y las frases que se dicen durante la partida.
 * Cada uno tiene un id estable calculado con el texto limpio (el mismo que usa el navegador en js/voice.js), así que si cambias
 * una frase, su audio viejo deja de usarse y `generar.mjs` crea el nuevo.
 */
import { STORIES } from '../../backend/src/content/index.js';
import { clipId, speakable } from '../../frontend/public/js/voice.js';
import { militaryText } from '../../frontend/public/js/military-voice.js';

/** @returns {{id:string, text:string, where:string}[]} sin repetidos */
export function collectTexts(stories = STORIES) {
  const seen = new Map();
  const add = (raw, where) => {
    const text = speakable(raw);
    if (!text) return;
    const id = clipId(text);
    if (!seen.has(id)) seen.set(id, { id, text, where });
  };
  for (const [campaign, missions] of Object.entries(stories)) {
    for (const [n, story] of Object.entries(missions)) {
      (story.intro ?? []).forEach((t, i) => add(militaryText(t, `intro${Math.min(i, 1)}`), `${campaign}#${n} intro ${i + 1}`));
      for (const [k, t] of Object.entries(story.events ?? {})) add(militaryText(t, k), `${campaign}#${n} ${k}`);
    }
  }
  return [...seen.values()];
}
