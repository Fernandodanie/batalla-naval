import { CAMPAIGNS } from './campaigns.js';

/**
 * Catálogo de logros. Cada uno tiene una regla pura (ver `earned`): se evalúa al terminar una partida con
 * el resumen de la partida, el progreso de campañas y algunos datos acumulados de la cuenta.
 *
 * Categorías: progreso · habilidad · variedad · histórico.
 * Los logros históricos se desbloquean al ganar una misión concreta; sus textos siguen docs/VERIFICACION-HISTORICA.md.
 *
 * Compatibilidad: si un logro cambia de id, se anota en `RENAMED` y la migración de la base de datos mueve los desbloqueos.
 */

/** ids antiguos → id actual (ver prisma/migrations/2_logro_villamontes). */
export const RENAMED = { hist_corralito: 'hist_villamontes' };

const done = (stars, campaignId, ids) => ids.every((id) => (stars.get(`${campaignId}:${id}`) ?? 0) >= 1);
const campaignDone = (stars, c) => done(stars, c.id, c.missions.map((m) => m.id));
const campaignPerfect = (stars, c) => c.missions.every((m) => (stars.get(`${c.id}:${m.id}`) ?? 0) >= 3);
const REAL_CAMPAIGNS = CAMPAIGNS.filter((c) => !c.fiction);

/** Tope de disparos para "ganar con pocos disparos": la mitad del tablero. */
export const efficientShots = (size) => Math.ceil((size * size) / 2);

const CAMPAIGN_DONE = {
  chaco: { name: 'Cumpliste el Chaco', text: 'Completaste la campaña de la Guerra del Chaco.' },
  siglo19: { name: 'Armas de la República', text: 'Completaste la campaña del siglo XIX.' },
  corso: { name: 'Leyenda del corso', text: 'Completaste la campaña ficticia de corsarios.' },
  litoral: { name: 'Guardián del litoral', text: 'Completaste la Operación Litoral (ficción).' },
};

export const ACHIEVEMENTS = [
  // ---- progreso
  { id: 'first_mission', category: 'progreso', icon: '🎖️', name: 'Primera misión', text: 'Ganaste tu primera misión de campaña.' },
  ...CAMPAIGNS.map((c) => ({ id: `camp_${c.id}`, category: 'progreso', icon: c.icon, ...CAMPAIGN_DONE[c.id] })),
  { id: 'all_campaigns', category: 'progreso', icon: '🏅', name: 'Alto mando', text: 'Completaste las cuatro campañas.' },
  { id: 'star_collector', category: 'progreso', icon: '⭐', name: 'Coleccionista de estrellas', text: 'Reuniste 20 estrellas en las campañas.' },
  { id: 'star_constellation', category: 'progreso', icon: '🌠', name: 'Constelación', text: 'Reuniste 40 estrellas en las campañas.' },
  { id: 'quiz_ace', category: 'progreso', icon: '📝', name: 'Buen alumno', text: 'Contestaste bien todas las preguntas de una misión.' },
  { id: 'quiz_scholar', category: 'progreso', icon: '🎓', name: 'Estudioso', text: 'Contestaste bien todas las preguntas de cinco misiones distintas.' },
  { id: 'quiz_sage', category: 'progreso', icon: '🦉', name: 'Sabio de las batallas', text: 'Contestaste bien todas las preguntas de todas las misiones históricas.' },
  { id: 'album_dorado', category: 'progreso', icon: '🖼️', name: 'Álbum dorado', text: 'Conseguiste las 20 láminas en su versión dorada (tres estrellas en todas las misiones).' },
  { id: 'historian', category: 'progreso', icon: '📚', name: 'Historiador', text: 'Completaste las dos campañas históricas: la Guerra del Chaco y las batallas del siglo XIX.' },
  // ---- habilidad
  { id: 'perfect', category: 'habilidad', icon: '🛡️', name: 'Victoria perfecta', text: 'Ganaste sin perder ninguna unidad (contra IA normal o superior, o contra una persona).' },
  { id: 'clean_sink', category: 'habilidad', icon: '🎯', name: 'Tiro certero', text: 'Hundiste una unidad de 3 o más casillas sin fallar ni un solo disparo desde el primer toque.' },
  { id: 'efficient', category: 'habilidad', icon: '⚡', name: 'Pocos disparos', text: 'Ganaste usando como máximo la mitad de las casillas del tablero (contra IA normal o superior, o contra una persona).' },
  { id: 'three_stars', category: 'habilidad', icon: '🌟', name: 'Tres estrellas', text: 'Conseguiste las tres estrellas en una misión.' },
  { id: 'five_perfect', category: 'habilidad', icon: '🎖️', name: 'Mano firme', text: 'Conseguiste las tres estrellas en cinco misiones distintas.' },
  { id: 'master_campaign', category: 'habilidad', icon: '👑', name: 'Maestro de campaña', text: 'Conseguiste las tres estrellas en todas las misiones de una misma campaña.' },
  // ---- variedad
  { id: 'win_all_biomes', category: 'variedad', icon: '🗺️', name: 'Mar, tierra y selva', text: 'Ganaste al menos una partida en cada uno de los cuatro escenarios.' },
  { id: 'beat_expert', category: 'variedad', icon: '🧠', name: 'Más listo que la IA', text: 'Venciste a la IA experta.' },
  { id: 'win_20', category: 'variedad', icon: '🌊', name: 'Gran océano', text: 'Ganaste una partida en un tablero de 20×20.' },
  // ---- históricos
  { id: 'hist_boqueron', category: 'histórico', icon: '🏚️', name: 'Defensor de Boquerón', text: 'Superaste la misión de Boquerón: resistir y neutralizar al rival en el primer fortín.', campaign: 'chaco', missions: [1] },
  { id: 'hist_tres_pasos', category: 'histórico', icon: '👣', name: 'Tres pasos al frente', text: 'Ganaste las tres primeras misiones del Chaco: Boquerón, Alihuatá y Nanawa.', campaign: 'chaco', missions: [1, 2, 3] },
  { id: 'hist_cerco', category: 'histórico', icon: '⛓️', name: 'Cerco roto', text: 'Lograste romper el cerco de Campo Vía (en la historia, una derrota; en el juego, tu victoria).', campaign: 'chaco', missions: [4] },
  { id: 'hist_alihuata', category: 'histórico', icon: '🌾', name: 'Alihuatá retomado', text: 'Ganaste la misión de Alihuatá y Campo Jordán (1933).', campaign: 'chaco', missions: [2] },
  { id: 'hist_nanawa', category: 'histórico', icon: '🕳️', name: 'Línea de Nanawa', text: 'Superaste la misión de Nanawa, explorando una línea fortificada con paciencia.', campaign: 'chaco', missions: [3] },
  { id: 'hist_strongest', category: 'histórico', icon: '🌵', name: 'Cañada Strongest', text: 'Ganaste la misión de Cañada Strongest (mayo de 1934).', campaign: 'chaco', missions: [5] },
  { id: 'hist_villamontes', category: 'histórico', icon: '🛡️', name: 'Defensor de Villamontes', text: 'Defendiste Villamontes en la misión final del Chaco (febrero de 1935).', campaign: 'chaco', missions: [6] },
  { id: 'hist_tumusla', category: 'histórico', icon: '🏔️', name: 'Último combate', text: 'Ganaste la misión de Tumusla (1 de abril de 1825).', campaign: 'siglo19', missions: [1] },
  { id: 'hist_ingavi', category: 'histórico', icon: '🎺', name: 'Pampa de Ingavi', text: 'Ganaste la misión de Ingavi.', campaign: 'siglo19', missions: [2] },
  { id: 'hist_calama', category: 'histórico', icon: '🌉', name: 'Resistencia de Calama', text: 'Superaste la misión de Calama (23 de marzo de 1879).', campaign: 'siglo19', missions: [3] },
  { id: 'hist_alianza', category: 'histórico', icon: '🚩', name: 'Alto de la Alianza', text: 'Superaste la misión del Campo de la Alianza (26 de mayo de 1880).', campaign: 'siglo19', missions: [4] },
  { id: 'hist_ayacucho', category: 'histórico', icon: '🕊️', name: 'Pampa de la Quinua', text: 'Ganaste la misión de Ayacucho (9 de diciembre de 1824).', campaign: 'siglo19', missions: [5] },
  { id: 'hist_patente', category: 'histórico', icon: '📜', name: 'Patente de corso', text: 'Ganaste la primera misión de la campaña ficticia de corsarios.', campaign: 'corso', missions: [1] },
  { id: 'hist_litoral', category: 'histórico', icon: '🚩', name: 'Faro del litoral', text: 'Ganaste la primera operación del litoral imaginario.', campaign: 'litoral', missions: [1] },
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const getAchievement = (id) => byId.get(id) ?? null;

export function publicAchievements() {
  return ACHIEVEMENTS.map(({ id, category, icon, name, text }) => ({ id, category, icon, name, text }));
}

/**
 * Logros cuyas condiciones se cumplen ahora.
 * @param {object} ctx
 * @param {{won:boolean, shots:number, lost:number, cleanSink:boolean}} ctx.summary  resumen de la partida de esa persona
 * @param {{mode:string, difficulty:string, size:number}} ctx.match
 * @param {{stars:number}|null} ctx.mission  resultado de misión de esta partida (si fue una misión)
 * @param {Map<string, number>} ctx.stars  estrellas por "campaña:misión" (ya con esta partida guardada)
 * @param {{biomesWon:string[], beatExpert:boolean, won20:boolean}} ctx.facts  acumulado de partidas (ya con esta partida guardada)
 * @returns {string[]} ids (incluye los ya desbloqueados; quien llama filtra)
 */
export function earned(ctx) {
  const { summary, match, mission, stars, facts } = ctx;
  const out = [];
  const add = (id, cond) => { if (cond) out.push(id); };
  const serious = match.mode === 'pvp' || match.difficulty !== 'easy';

  const totalStars = [...stars.values()].reduce((a, b) => a + b, 0);
  add('first_mission', [...stars.values()].some((s) => s >= 1));
  for (const c of CAMPAIGNS) add(`camp_${c.id}`, campaignDone(stars, c));
  add('all_campaigns', CAMPAIGNS.every((c) => campaignDone(stars, c)));
  add('star_collector', totalStars >= 20);
  add('star_constellation', totalStars >= 40);
  add('album_dorado', CAMPAIGNS.every((c) => campaignPerfect(stars, c)));
  add('historian', REAL_CAMPAIGNS.length > 0 && REAL_CAMPAIGNS.every((c) => campaignDone(stars, c)));

  add('perfect', summary.won && summary.lost === 0 && serious);
  add('clean_sink', summary.cleanSink);
  add('efficient', summary.won && summary.shots <= efficientShots(match.size) && serious);
  add('three_stars', mission?.stars === 3);
  add('five_perfect', [...stars.values()].filter((v) => v >= 3).length >= 5);
  add('master_campaign', CAMPAIGNS.some((c) => campaignPerfect(stars, c)));

  add('win_all_biomes', ['water', 'pirate', 'land', 'jungle'].every((b) => facts.biomesWon.includes(b)));
  add('beat_expert', facts.beatExpert);
  add('win_20', facts.won20);

  for (const a of ACHIEVEMENTS) if (a.campaign) add(a.id, done(stars, a.campaign, a.missions));
  return out;
}

/**
 * Logros de estudio: se evalúan cuando alguien contesta un cuestionario (no al terminar una partida).
 * @param {{campaignId:string, missionId:number, bestCorrect:number, total:number}[]} results  mejores resultados de la cuenta
 * @param {string[]} allQuizMissions  claves «campaña:misión» de las misiones reales con preguntas
 */
export function quizEarned(results, allQuizMissions) {
  const perfect = new Set(results.filter((r) => r.total > 0 && r.bestCorrect === r.total).map((r) => `${r.campaignId}:${r.missionId}`));
  const out = [];
  if (perfect.size >= 1) out.push('quiz_ace');
  if (perfect.size >= 5) out.push('quiz_scholar');
  if (allQuizMissions.length && allQuizMissions.every((k) => perfect.has(k))) out.push('quiz_sage');
  return out;
}
