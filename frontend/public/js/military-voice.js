/**
 * Lenguaje de radio de un oficial de campaña. No cambia el contenido histórico:
 * añade una orden breve al audio antes del relato del hecho.
 * Se comparte con el generador de MP3 para que audio y texto tengan el mismo ID.
 */
const ORDERS = Object.freeze({
  start: 'Atención, unidad.',
  firstHit: 'Contacto confirmado.',
  firstSunk: 'Objetivo neutralizado.',
  firstLoss: 'Mantengan posiciones.',
  half: 'Mantengan el avance.',
  last: 'Concentren el fuego.',
  win: 'Misión cumplida.',
  lose: 'Repliegue ordenado.',
  intro0: 'Escuchen, tropa.',
  intro1: 'Presten atención a la misión.',
});

/** Agrega una introducción militar moderada, sin alterar datos ni nombres históricos. */
export function militaryText(text, event = '') {
  const clean = String(text ?? '').trim();
  if (!clean) return '';
  const opening = ORDERS[event];
  return opening ? `${opening} ${clean}` : clean;
}
