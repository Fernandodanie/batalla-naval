/**
 * Campañas: series de misiones. Una misión es una partida contra la IA con la configuración ya fijada
 * (escenario, tablero, dificultad). Las misiones de una campaña se desbloquean en orden.
 *
 * Estrellas (1 a 3): 1 por ganar + 1 por cada objetivo opcional cumplido (cada misión tiene dos).
 *
 * Contenido histórico: los textos `briefing` y `debrief`, y la narración de `content/` (fechas, datos, fuentes, preguntas),
 * se contrastaron con fuentes (ver docs/VERIFICACION-HISTORICA.md), pero conviene que los revise alguien de historia antes de
 * usarlos en un aula. Las campañas con `fiction: true` son ficción y se rotulan así en la interfaz.
 * `fictionalTwist: true` marca una misión que reinterpreta un hecho real con otro final (la interfaz lo avisa).
 */

import { getStory, glossaryFor, publicStory, storyTexts } from '../content/index.js';

export const OBJECTIVE_TYPES = ['maxShots', 'maxLost'];

/** Proporción máxima de casillas a disparar para el objetivo "pocos disparos", según la IA. */
const SHOT_RATIO = { easy: 0.8, normal: 0.7, hard: 0.62, expert: 0.55 };
/** Unidades que se pueden perder y seguir cumpliendo el objetivo "pocas bajas". */
const LOST_ALLOWED = { easy: 2, normal: 1, hard: 1, expert: 1 };

const mission = (id, title, size, difficulty, briefing, debrief, extra = {}) => ({
  id, title, size, difficulty, briefing, debrief,
  optional: [
    { type: 'maxShots', value: Math.round(size * size * SHOT_RATIO[difficulty]) },
    { type: 'maxLost', value: LOST_ALLOWED[difficulty] },
  ],
  ...extra,
});

export const CAMPAIGNS = [
  {
    id: 'chaco',
    title: 'Guerra del Chaco',
    subtitle: 'Selva · 1932–1935',
    biome: 'jungle',
    fiction: false,
    icon: '🌵',
    intro: 'Bolivia y Paraguay se enfrentaron en el Gran Chaco entre 1932 y 1935. Recorre seis episodios de la guerra, de los fortines del comienzo a la defensa de Villamontes.',
    note: 'El Chaco es sobre todo monte espinoso; el escenario de selva se usa aquí como representación visual.',
    missions: [
      mission(1, 'Boquerón', 8, 'easy',
        'Septiembre de 1932. El fortín de Boquerón, tomado por fuerzas bolivianas semanas antes, queda rodeado por el ejército paraguayo. En la historia la guarnición terminó capitulando; en esta misión tu tarea es resistir y neutralizar a las fuerzas que lo acechan.',
        'Boquerón capituló el 29 de septiembre de 1932, tras un asedio de unos veinte días, en la primera gran batalla de la guerra. En esta misión lograste resistir.',
        { fictionalTwist: true }),
      mission(2, 'Alihuatá y Campo Jordán', 10, 'normal',
        'A inicios de 1933 el ejército boliviano pasó a la ofensiva y retomó el fortín de Alihuatá, cortando el camino de abastecimiento del rival. Avanza por el monte y despeja la zona.',
        'Alihuatá y Campo Jordán fueron victorias bolivianas de 1933, pero la guerra estaba lejos de terminar.'),
      mission(3, 'Nanawa', 12, 'normal',
        'En 1933 el fortín de Nanawa resistió dos grandes ofensivas bolivianas, en enero y en julio. En esta misión no repites el asalto: exploras una línea fortificada con paciencia, y cada trinchera descubierta cuenta.',
        'Nanawa mostró lo costoso que era atacar de frente posiciones fortificadas. En el juego lograste romper la línea; en la historia no se pudo.',
        { fictionalTwist: true }),
      mission(4, 'Campo Vía: rompe el cerco', 15, 'hard',
        'En diciembre de 1933 las divisiones bolivianas 4.ª y 9.ª quedaron cercadas en Campo Vía. Históricamente se rindieron el 11 de diciembre; en esta misión tu objetivo es romper el cerco.',
        'Campo Vía fue uno de los momentos más duros para Bolivia. Aquí lograste lo que entonces no se pudo: salir del cerco.',
        { fictionalTwist: true }),
      mission(5, 'Cañada Strongest', 15, 'hard',
        'En mayo de 1934 fuerzas bolivianas cercaron a un destacamento paraguayo en la zona de Cañada Strongest. Repite la maniobra y asegura la zona.',
        'Cañada Strongest se recuerda como una victoria boliviana de 1934; Bolivia la conmemora cada 20 de mayo.'),
      mission(6, 'Defensa de Villamontes', 20, 'expert',
        'En febrero de 1935 las fuerzas paraguayas atacaron Villamontes, centro de la defensa boliviana en el Chaco tarijeño. Es la prueba definitiva: tablero grande y una IA experta.',
        'La defensa de Villamontes resistió el ataque de 1935 y es parte central de la memoria de la guerra en el Chaco tarijeño. Cumpliste la campaña.'),
    ],
  },
  {
    id: 'siglo19',
    title: 'Armas de la República',
    subtitle: 'Tierra · siglo XIX',
    biome: 'land',
    fiction: false,
    icon: '🎖️',
    intro: 'Infantería, caballería y cañones: cinco batallas del siglo XIX, de la independencia a la Guerra del Pacífico. Los tanques todavía no existían.',
    note: 'Las misiones están ordenadas por dificultad, no por fecha.',
    missions: [
      mission(1, 'Tumusla (1825)', 8, 'easy',
        'Abril de 1825. Tumusla se considera el último combate de la independencia en el Alto Perú. Es una escaramuza: perfecta para el primer paso.',
        'Tumusla cerró una etapa: poco después nacería la República de Bolivia.'),
      mission(2, 'Ingavi (1841)', 10, 'normal',
        'Noviembre de 1841. En la pampa de Ingavi el ejército boliviano de José Ballivián enfrentó al peruano que había invadido Bolivia. Dirige a tus columnas y busca la victoria.',
        'Ingavi es recordada como una victoria boliviana y se conmemora cada año.'),
      mission(3, 'Calama (1879)', 12, 'normal',
        'Marzo de 1879. Al inicio de la Guerra del Pacífico, un grupo reducido de vecinos y soldados, entre ellos Eduardo Abaroa, defendió el puente del Topáter en Calama. En la historia fue una derrota; en esta misión, resiste todo lo posible.',
        'La defensa de Calama dejó una de las figuras más recordadas de la historia boliviana; el 23 de marzo se conmemora el Día del Mar.',
        { fictionalTwist: true }),
      mission(4, 'Campo de la Alianza (1880)', 15, 'hard',
        'Mayo de 1880. Cerca de Tacna, los ejércitos aliados de Bolivia y Perú enfrentaron a las fuerzas chilenas. En la historia fue una derrota aliada; en esta misión, lee el terreno con cuidado y resiste.',
        'La batalla del Campo de la Alianza fue un momento decisivo de la guerra; después de ella Bolivia se retiró del conflicto. Recordarla es también honrar a quienes combatieron.',
        { fictionalTwist: true }),
      mission(5, 'Ayacucho (1824)', 20, 'expert',
        'Diciembre de 1824. En la batalla de Ayacucho, Antonio José de Sucre mandó al ejército patriota. Fue una de las batallas decisivas de la independencia sudamericana. Gran tablero y una IA experta.',
        'Ayacucho abrió el camino a la independencia de Bolivia, que se declararía meses después. Completaste la campaña.'),
    ],
  },
  {
    id: 'corso',
    title: 'Patente de corso',
    subtitle: 'Mar · ficción',
    biome: 'pirate',
    fiction: true,
    icon: '🏴‍☠️',
    intro: 'En 1879 un decreto autorizó patentes de corso contra buques chilenos; en la práctica casi no hubo corsarios bolivianos. Esta campaña corta imagina qué habría pasado si hubiera funcionado. Es ficción, con humor.',
    note: 'Campaña de ficción: no describe hechos reales.',
    missions: [
      mission(1, 'La patente', 8, 'easy',
        'El decreto está firmado y la tinta todavía huele a nuevo. Tienes una chalupa, un loro y mucho entusiasmo. Primera salida: cazar a un velero distraído.',
        '¡Primer botín! El loro exige su parte.'),
      mission(2, 'Entre brumas', 10, 'normal',
        'La niebla del Pacífico es perfecta para sorprender a los rivales. Navega con cuidado: tu reputación de corsario recién empieza.',
        'La niebla es tu mejor aliada. Corre la voz entre los puertos.'),
      mission(3, 'El gran convoy', 15, 'hard',
        'Un convoy cargado de provisiones cruza tus aguas. Es la oportunidad de tu vida (y de tu tripulación, que ya canta).',
        'El convoy cayó. Los marineros hablan de ti en todas las tabernas imaginarias.'),
      mission(4, 'La flota fantasma', 20, 'expert',
        'Una flota entera te persigue y el mar es inmenso. Si sobrevives, tu leyenda será ficticia pero inolvidable.',
        'Corsario legendario... en un mundo que nunca existió. ¡Bravo!'),
    ],
  },
  {
    id: 'litoral',
    title: 'Operación Litoral',
    subtitle: 'Mar · ficción',
    biome: 'water',
    fiction: true,
    icon: '⚓',
    intro: 'Una flota moderna imaginaria protege un litoral que Bolivia no tiene. Cinco operaciones inventadas para jugar con la estrategia naval. Todo es ficción.',
    note: 'Campaña de ficción: nombres y operaciones inventados.',
    missions: [
      mission(1, 'Patrulla del amanecer', 8, 'easy',
        'La flota sale de puerto con las primeras luces. Reconocimiento de rutina: localiza y neutraliza a los intrusos.',
        'Zona despejada. Primera patrulla cumplida.'),
      mission(2, 'Escolta', 10, 'normal',
        'Un convoy necesita cruzar la zona sin contratiempos. Abre paso con tus unidades.',
        'El convoy llegó a destino. Buen trabajo de escolta.'),
      mission(3, 'Bloqueo', 12, 'normal',
        'Un bloqueo naval requiere paciencia y orden. Cierra el paso, pieza a pieza.',
        'El bloqueo se mantuvo. La paciencia fue tu mejor arma.'),
      mission(4, 'Estrecho', 15, 'hard',
        'Aguas angostas, poco margen de error. Cada disparo cuenta cuando el rival está a la vuelta de la isla.',
        'El estrecho quedó libre. Falta la última operación.'),
      mission(5, 'La gran armada', 20, 'expert',
        'La operación final reúne a todas las flotas en el océano abierto. Tablero enorme, IA experta y nada de improvisar.',
        'Campaña completada. El litoral imaginario queda a salvo.'),
    ],
  },
];

const byId = new Map(CAMPAIGNS.map((c) => [c.id, c]));

export const getCampaign = (id) => byId.get(String(id)) ?? null;

export function getMission(campaignId, missionId) {
  const c = getCampaign(campaignId);
  return c?.missions.find((m) => m.id === Number(missionId)) ?? null;
}

/** Texto en español de un objetivo (para la interfaz). */
export function objectiveLabel(obj) {
  if (obj.type === 'maxShots') return `Gana en ${obj.value} disparos o menos`;
  if (obj.type === 'maxLost') return obj.value === 0 ? 'No pierdas ninguna unidad' : `Pierde como máximo ${obj.value} ${obj.value === 1 ? 'unidad' : 'unidades'}`;
  return '';
}

/**
 * Evalúa una misión con el resumen de la partida del jugador.
 * @param {object} m  misión
 * @param {{won:boolean, shots:number, lost:number}} summary
 * @returns {{won:boolean, stars:number, objectives:{id:string,label:string,met:boolean}[]}}
 */
export function evaluateMission(m, summary) {
  const objectives = [{ id: 'win', label: 'Gana la misión', met: Boolean(summary.won) }];
  for (const opt of m.optional) {
    const ok = summary.won && (opt.type === 'maxShots' ? summary.shots <= opt.value : summary.lost <= opt.value);
    objectives.push({ id: opt.type, label: objectiveLabel(opt), met: Boolean(ok) });
  }
  const stars = summary.won ? objectives.filter((o) => o.met).length : 0;
  return { won: Boolean(summary.won), stars, objectives };
}

/** Datos públicos de una misión (sin nada que el cliente no deba conocer: aquí todo es público). */
/** Historia pública + glosario de las palabras que aparecen en la misión (si es reinterpretación, también «reinterpretación»). */
function withGlossary(story, mission, twist) {
  const pub = publicStory(story);
  if (pub) pub.glossary = glossaryFor([...storyTexts(story, mission), twist ? 'reinterpretación' : '']);
  return pub;
}

export function publicCampaigns() {
  return CAMPAIGNS.map((c) => ({
    id: c.id, title: c.title, subtitle: c.subtitle, biome: c.biome, fiction: c.fiction, icon: c.icon, intro: c.intro, note: c.note,
    missions: c.missions.map((m) => ({
      id: m.id, title: m.title, size: m.size, difficulty: m.difficulty, briefing: m.briefing, debrief: m.debrief,
      twist: Boolean(m.fictionalTwist), story: withGlossary(getStory(c.id, m.id), m, m.fictionalTwist),
      objectives: m.optional.map((o) => ({ id: o.type, label: objectiveLabel(o) })),
    })),
  }));
}

/** ¿Está desbloqueada la misión? `stars` = Map "campaña:misión" → estrellas. La primera siempre; las demás requieren ganar la anterior. */
export function isUnlocked(campaignId, missionId, stars) {
  if (Number(missionId) <= 1) return true;
  return (stars.get(`${campaignId}:${Number(missionId) - 1}`) ?? 0) >= 1;
}
