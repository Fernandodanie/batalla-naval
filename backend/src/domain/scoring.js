/**
 * Sistema de puntos. Funciones puras: no tocan la base de datos, solo calculan.
 *
 *  - points : puntaje acumulado, nunca baja. Es el que ordena el ranking.
 *  - rating : Elo (arranca en 1000). Solo cambia en partidas PvP "rankeadas",
 *             es decir, cuando AMBOS jugadores tienen cuenta (así no se infla con invitados).
 */

export const START_RATING = 1000;
export const MIN_RATING = 100;
const ELO_K = 32;

const MODE_MULTIPLIER = { pvp: 1.5, easy: 0.5, normal: 1, hard: 1.5, expert: 2 };

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Puntos de una partida para un jugador.
 * @param {{won:boolean, shots:number, hits:number, size:number, mode:'pvp'|'ai', difficulty?:string,
 *          ranked?:boolean, forfeited?:boolean}} p
 */
export function pointsFor({ won, shots, hits, size, mode, difficulty = 'normal', ranked = true, forfeited = false }) {
  if (forfeited) return 0;
  const accuracy = shots > 0 ? hits / shots : 0;
  const base = won ? 100 + Math.round(50 * accuracy) : 25;
  const modeKey = mode === 'pvp' ? 'pvp' : difficulty;
  const mult = (MODE_MULTIPLIER[modeKey] ?? 1) * (size / 10) * (mode === 'pvp' && !ranked ? 0.5 : 1);
  return Math.round(base * mult);
}

/** Cambio de Elo para ambos jugadores de una partida PvP. */
export function eloDelta(winnerRating, loserRating) {
  const change = Math.round(ELO_K * (1 - expectedScore(winnerRating, loserRating)));
  return { winner: change, loser: -change };
}

export function applyRating(rating, delta) {
  return Math.max(MIN_RATING, rating + delta);
}

/**
 * Resultado completo de una partida terminada, por lado.
 * @param {object} m
 * @param {'pvp'|'ai'} m.mode
 * @param {string} [m.difficulty]
 * @param {number} m.size
 * @param {'A'|'B'} m.winner
 * @param {string|null} m.reason
 * @param {{A:{shots:number,hits:number},B:{shots:number,hits:number}}} m.stats
 * @param {{A:{rating:number|null},B:{rating:number|null}}} m.players  rating null = invitado o IA
 * @returns {{A:{points:number,ratingDelta:number}, B:{points:number,ratingDelta:number}, ranked:boolean}}
 */
export function scoreMatch({ mode, difficulty, size, winner, reason, stats, players }) {
  const loser = winner === 'A' ? 'B' : 'A';
  const ranked = mode === 'pvp' && players.A.rating !== null && players.B.rating !== null;
  const out = { A: { points: 0, ratingDelta: 0 }, B: { points: 0, ratingDelta: 0 }, ranked };

  for (const side of ['A', 'B']) {
    out[side].points = pointsFor({
      won: side === winner, shots: stats[side].shots, hits: stats[side].hits,
      size, mode, difficulty, ranked, forfeited: side === loser && reason === 'abandono',
    });
  }
  if (ranked) {
    const d = eloDelta(players[winner].rating, players[loser].rating);
    out[winner].ratingDelta = d.winner;
    out[loser].ratingDelta = d.loser;
  }
  return out;
}
