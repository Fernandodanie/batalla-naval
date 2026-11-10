/**
 * Glosario: palabras que conviene explicar. Se muestra, en cada misión, solo lo que aparece en sus textos
 * (ver `glossaryFor`). Las definiciones son neutrales y cortas; revísalas con la persona de historia.
 * Cada entrada: término (en singular, en minúscula) → definición. `forms` agrega otras formas que se deben reconocer.
 */
export const GLOSSARY = [
  { term: 'fortín', def: 'Puesto militar pequeño y fortificado (con empalizada, trincheras o parapetos) que protege un punto del territorio.', forms: ['fortines'] },
  { term: 'cerco', def: 'Rodear una posición con tropas para aislarla y cortarle el paso de víveres, agua y refuerzos.', forms: ['cercar', 'cercada', 'cercadas', 'cercado', 'cercaron'] },
  { term: 'asedio', def: 'Operación de rodear una posición y mantenerla bajo ataque o bloqueo durante días o semanas hasta que se rinda.', forms: ['asediados', 'asediado'] },
  { term: 'capitulación', def: 'Acuerdo por el que una fuerza militar se rinde, con unas condiciones pactadas con el vencedor.', forms: ['capituló', 'capitulara', 'capitular'] },
  { term: 'trinchera', def: 'Zanja que protege a los soldados del fuego enemigo y desde la que pueden disparar.', forms: ['trincheras'] },
  { term: 'mortero', def: 'Arma de tiro curvo: lanza proyectiles explosivos en un arco alto, útil para alcanzar posiciones protegidas.', forms: ['morteros'] },
  { term: 'pajonal', def: 'Terreno cubierto de pastos altos y espesos.', forms: ['pajonales'] },
  { term: 'cañada', def: 'Hondonada o quebrada por la que corre (o corría) el agua; en el Chaco suele estar seca gran parte del año.', forms: ['cañadas'] },
  { term: 'Chaco Boreal', def: 'Parte norte del Gran Chaco, una llanura de monte y bañados cuya posesión se disputaron Bolivia y Paraguay.', forms: [] },
  { term: 'realista', def: 'En las guerras de independencia, partidario del rey de España y del orden colonial.', forms: ['realistas'] },
  { term: 'patriota', def: 'En las guerras de independencia, partidario de la independencia de las colonias.', forms: ['patriotas'] },
  { term: 'Alto Perú', def: 'Nombre colonial del territorio de la actual Bolivia.', forms: [] },
  { term: 'patente de corso', def: 'Permiso de un gobierno a un particular para atacar barcos de un país enemigo en tiempo de guerra.', forms: ['patentes de corso'] },
  { term: 'corsario', def: 'Marino que navega con una patente de corso. A diferencia del pirata, actúa con permiso de un Estado.', forms: ['corsarios'] },
  { term: 'convoy', def: 'Grupo de barcos que navegan juntos, generalmente con escolta, para protegerse.', forms: ['convoyes'] },
  { term: 'escolta', def: 'Buques o tropas que acompañan a otros para protegerlos.', forms: ['escoltas'] },
  { term: 'bloqueo', def: 'Impedir con fuerzas navales o militares la entrada o salida de barcos o mercancías de un lugar.', forms: ['bloqueos'] },
  { term: 'Día del Mar', def: 'Fecha que Bolivia conmemora cada 23 de marzo, en recuerdo de la defensa de Calama (1879) y de su salida al océano Pacífico.', forms: [] },
  { term: 'litoral', def: 'Franja de territorio que está junto a la costa.', forms: [] },
  { term: 'reinterpretación', def: 'En este juego, una misión que cambia el final de un hecho real para que puedas jugarlo; la ficha siempre dice qué pasó de verdad.', forms: ['reinterpretaciones'] },
];

const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchers = GLOSSARY.map((g) => {
  const forms = [g.term, ...(g.forms ?? [])].map(norm).map(esc);
  return { entry: g, re: new RegExp(`(?<![a-z0-9])(?:${forms.join('|')})(?![a-z0-9])`) };
});

/**
 * Entradas del glosario cuyas palabras aparecen en los textos dados (sin distinguir mayúsculas ni tildes).
 * @param {string[]} texts
 * @returns {{term:string, def:string}[]} en el orden del glosario
 */
export function glossaryFor(texts) {
  const hay = norm(texts.filter(Boolean).join(' \n '));
  return matchers.filter((m) => m.re.test(hay)).map((m) => ({ term: m.entry.term, def: m.entry.def }));
}
