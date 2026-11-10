/**
 * Rangos militares según las estrellas reunidas en las campañas (el máximo posible es 60).
 * Son solo de presentación: no cambian las reglas ni el Elo.
 */
export const RANKS = Object.freeze([
  { id: 'recluta', name: 'Recluta', icon: '🪖', min: 0 },
  { id: 'soldado', name: 'Soldado', icon: '🎖️', min: 3 },
  { id: 'cabo', name: 'Cabo', icon: '🥉', min: 8 },
  { id: 'sargento', name: 'Sargento', icon: '🥈', min: 14 },
  { id: 'subteniente', name: 'Subteniente', icon: '🥇', min: 21 },
  { id: 'capitan', name: 'Capitán', icon: '⭐', min: 29 },
  { id: 'mayor', name: 'Mayor', icon: '🌟', min: 38 },
  { id: 'coronel', name: 'Coronel', icon: '🏅', min: 47 },
  { id: 'general', name: 'General', icon: '🎗️', min: 55 },
  { id: 'mariscal', name: 'Mariscal', icon: '👑', min: 60 },
]);

/** Rango actual y cuánto falta para el siguiente. */
export function rankFor(totalStars) {
  const stars = Math.max(0, Math.floor(Number(totalStars) || 0));
  let idx = 0;
  RANKS.forEach((r, i) => { if (stars >= r.min) idx = i; });
  const cur = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  return {
    id: cur.id, name: cur.name, icon: cur.icon, min: cur.min,
    next: next ? { id: next.id, name: next.name, min: next.min, missing: next.min - stars } : null,
  };
}
