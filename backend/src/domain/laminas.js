import { CAMPAIGNS } from './campaigns.js';

/**
 * Láminas: cuadros en pixel art de cada misión, la recompensa por completarla.
 * - Se desbloquean al ganar la misión (1 o más estrellas) y siempre se entrega la misma lámina: ya no hay versión «base» y «dorada».
 * - Cada una es una tarjeta ya terminada (marco dorado, título, leyenda y estrellas dentro de la imagen), guardada en
 *   frontend/public/img/laminas-hd/<id>.png (completa) y frontend/public/img/laminas-hd/min/<id>.webp (miniatura).
 * Son ilustraciones de paisaje y siluetas, sin retratos de personas reales. Las de campañas de ficción se rotulan como ilustración de ficción.
 */
const L = (campaignId, missionId, title, caption) => ({ id: `${campaignId}-${missionId}`, campaignId, missionId, title, caption });

const DEFS = [
  L('chaco', 1, 'Fortín Boquerón', 'Septiembre de 1932 · Chaco Boreal'),
  L('chaco', 2, 'Alihuatá', 'Marzo de 1933 · avance por el pajonal'),
  L('chaco', 3, 'Nanawa', '1933 · línea de trincheras'),
  L('chaco', 4, 'Campo Vía', 'Diciembre de 1933 · el cerco'),
  L('chaco', 5, 'Cañada Strongest', 'Mayo de 1934 · cañada seca'),
  L('chaco', 6, 'Villamontes', 'Febrero de 1935 · Gran Chaco tarijeño'),
  L('siglo19', 1, 'Tumusla', '1 de abril de 1825 · último combate de la independencia en el Alto Perú'),
  L('siglo19', 2, 'Ingavi', '18 de noviembre de 1841 · pampa de Ingavi'),
  L('siglo19', 3, 'Puente del Topáter', '23 de marzo de 1879 · Calama'),
  L('siglo19', 4, 'Alto de la Alianza', '26 de mayo de 1880 · Tacna'),
  L('siglo19', 5, 'Pampa de la Quinua', '9 de diciembre de 1824 · Ayacucho'),
  L('corso', 1, 'La patente', 'Ilustración de ficción'),
  L('corso', 2, 'Entre brumas', 'Ilustración de ficción'),
  L('corso', 3, 'El gran convoy', 'Ilustración de ficción'),
  L('corso', 4, 'La flota fantasma', 'Ilustración de ficción'),
  L('litoral', 1, 'Patrulla del amanecer', 'Ilustración de ficción'),
  L('litoral', 2, 'Escolta', 'Ilustración de ficción'),
  L('litoral', 3, 'Bloqueo', 'Ilustración de ficción'),
  L('litoral', 4, 'Estrecho', 'Ilustración de ficción'),
  L('litoral', 5, 'La gran armada', 'Ilustración de ficción'),
];

const fictionOf = new Map(CAMPAIGNS.map((c) => [c.id, c.fiction]));
export const LAMINAS = DEFS.map((l) => ({ ...l, fiction: Boolean(fictionOf.get(l.campaignId)) }));

const byId = new Map(LAMINAS.map((l) => [l.id, l]));
export const getLamina = (id) => byId.get(id) ?? null;

/** Datos públicos del catálogo (todo es público). */
export const publicLaminas = () => LAMINAS.map(({ id, campaignId, missionId, title, caption, fiction }) => ({ id, campaignId, missionId, title, caption, fiction }));

/**
 * Láminas que tiene una cuenta: una por cada misión ganada (1 o más estrellas).
 * @param {Map<string, number>} stars  estrellas por «campaña:misión»
 * @returns {{id:string}[]}
 */
export function laminasFor(stars) {
  const out = [];
  for (const l of LAMINAS) {
    const s = stars.get(`${l.campaignId}:${l.missionId}`) ?? 0;
    if (s >= 1) out.push({ id: l.id });
  }
  return out;
}
