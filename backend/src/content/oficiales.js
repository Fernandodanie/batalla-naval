/**
 * Quién manda cada bando en una misión de campaña.
 *
 *  - Campañas HISTÓRICAS: los jefes reales de cada batalla (`story.commanders` en `content/chaco.js` y `content/siglo19.js`).
 *  - Campañas de FICCIÓN: nombres inventados al azar de las listas de abajo (ficticios a propósito: no apuntan a nadie real).
 *
 * La elección es DETERMINISTA para una misma sala (se siembra con el código de la sala): si la persona recarga la página o se
 * reconecta, el rival sigue llamándose igual. No usa el generador de números aleatorios de la sala, así que no altera las
 * partidas de las pruebas con semilla.
 */
import { getStory } from './index.js';

/** Lado del jugador y de la IA en las salas de misión (quien crea la sala se sienta en A; la IA, en B). */
export const SIDES = Object.freeze({ you: 'A', foe: 'B' });

/** Emblemas de las tarjetas de jugador en una misión (en vez del 🤖 y del avatar de la cuenta). */
export const BADGES = Object.freeze({ you: '🎖️', foe: '⚔️' });

// ---------------------------------------------------------------- generador pseudoaleatorio con semilla
/** Hash de texto → número de 32 bits (FNV-1a). */
export function hashSeed(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** mulberry32: generador pequeño y repetible. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// ---------------------------------------------------------------- nombres inventados (ficción)
const NOMBRES_M = ['Anselmo', 'Baltasar', 'Dionisio', 'Fermín', 'Hilario', 'Jacinto', 'Macario', 'Nicanor', 'Pascual', 'Saturnino', 'Telésforo', 'Valentín', 'Wilfredo', 'Cirilo'];
const NOMBRES_F = ['Casilda', 'Eulalia', 'Genoveva', 'Irene', 'Leocadia', 'Octavia', 'Remedios', 'Úrsula', 'Ximena', 'Zenobia'];
/** Elige un nombre y su género (para que el cargo concuerde: «Capitán» / «Capitana»). */
const persona = (rand) => (rand() < 0.62
  ? { nombre: pick(rand, NOMBRES_M), f: false }
  : { nombre: pick(rand, NOMBRES_F), f: true });
const APELLIDOS = [
  'Altamirano', 'Barrientos', 'Calvimontes', 'Duchén', 'Escalante', 'Figueroa', 'Guzmán', 'Herbas', 'Iporre', 'Jáuregui', 'Landívar',
  'Montaño', 'Nogales', 'Oropeza', 'Paniagua', 'Quiroga', 'Rivero', 'Salvatierra', 'Tapia', 'Urquidi', 'Vaca', 'Zambrana', 'Aliaga', 'Burgos',
];
/** Mote de corsario (campaña «Patente de corso», que es humorística). */
const MOTES = [
  'Barbaluenga', 'Dientepez', 'el Mareado', 'Ojo de Lorito', 'Patafina', 'Mano de Ancla', 'la Tormenta', 'Tres Velas', 'Cara de Sal', 'el Zurdo',
  'Brújula Loca', 'Sopa de Quilla', 'Camote', 'Vientoeste', 'la Tuerta Feliz', 'Cañón Chico',
];

/** Rangos inventados de la campaña «Operación Litoral» (flota moderna imaginaria): [masculino, femenino]. */
const RANGOS_FLOTA = [['Capitán de Navío', 'Capitana de Navío'], ['Capitán de Fragata', 'Capitana de Fragata'], ['Contraalmirante', 'Contraalmirante'], ['Capitán de Corbeta', 'Capitana de Corbeta']];

/** Estilo de nombres por campaña de ficción. */
const ESTILOS = {
  corso: (rand, lado) => {
    const p = persona(rand);
    const mote = pick(rand, MOTES);
    return lado === 'you'
      ? { name: `${p.nombre} «${mote}»`, role: 'Corsario con patente (inventado)' }
      : { name: `${p.f ? 'Comodora' : 'Comodoro'} ${pick(rand, APELLIDOS)}`, role: 'Jefe de la flota rival (inventado)' };
  },
  litoral: (rand, lado) => {
    const p = persona(rand);
    const rango = pick(rand, RANGOS_FLOTA)[p.f ? 1 : 0];
    return { name: `${rango} ${p.nombre} ${pick(rand, APELLIDOS)}`, role: lado === 'you' ? 'Jefe de tu flota (inventado)' : 'Jefe de la flota rival (inventado)' };
  },
};

/** Estilo por defecto (campañas de ficción nuevas que aún no tengan uno propio). */
const ESTILO_GENERICO = (rand, lado) => ({
  name: `${persona(rand).nombre} ${pick(rand, APELLIDOS)}`,
  role: lado === 'you' ? 'Jefe de tu bando (inventado)' : 'Jefe del bando rival (inventado)',
});

// ---------------------------------------------------------------- API
/**
 * Los dos jefes de una misión.
 * @param {string} campaignId
 * @param {number} missionId
 * @param {string} seed        normalmente el código de la sala; la misma semilla da siempre los mismos nombres
 * @returns {{ A: {name:string, role:string, badge:string}, B: {name:string, role:string, badge:string}, invented: boolean }}
 *   `invented` = true si son nombres de ficción (no hay personas reales detrás)
 */
export function officersFor(campaignId, missionId, seed) {
  const story = getStory(campaignId, missionId);
  const real = story?.commanders;
  if (real?.you?.name && real?.foe?.name) {
    return {
      [SIDES.you]: { name: real.you.name, role: real.you.role ?? '', badge: BADGES.you },
      [SIDES.foe]: { name: real.foe.name, role: real.foe.role ?? '', badge: BADGES.foe },
      invented: false,
    };
  }
  const rand = seeded(hashSeed(`${campaignId}:${missionId}:${seed}`));
  const style = ESTILOS[campaignId] ?? ESTILO_GENERICO;
  const you = style(rand, 'you');
  let foe = style(rand, 'foe');
  for (let i = 0; i < 5 && foe.name === you.name; i += 1) foe = style(rand, 'foe'); // nunca el mismo nombre en los dos bandos
  return {
    [SIDES.you]: { ...you, badge: BADGES.you },
    [SIDES.foe]: { ...foe, badge: BADGES.foe },
    invented: true,
  };
}
