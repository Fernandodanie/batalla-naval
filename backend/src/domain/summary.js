import { other } from './game.js';

/**
 * Resumen de una partida terminada desde el punto de vista de un lado. Es lo que usan las misiones y los logros.
 * @returns {{won:boolean, shots:number, hits:number, lost:number, units:number, cleanSink:boolean, reason:string}}
 */
export function summarize(game, side) {
  const mine = game.boards[side];
  const lost = mine.ships.filter((s) => s.sunk).length;
  return {
    won: game.winner === side,
    shots: game.stats[side].shots,
    hits: game.stats[side].hits,
    lost,
    units: mine.ships.length,
    cleanSink: hasCleanSink(game, side),
    reason: game.reason,
  };
}

/**
 * "Tiro certero": hundir una unidad de 3 o más casillas acertando todos los disparos seguidos desde el primer toque
 * (sin ningún disparo de por medio que no fuera a esa unidad).
 */
export function hasCleanSink(game, side) {
  const target = game.boards[other(side)];
  const mine = game.history.filter((h) => h.side === side);
  const pos = new Map(mine.map((h, i) => [h.index, i]));
  for (const ship of target.ships) {
    if (!ship.sunk || ship.cells.length < 3) continue;
    const at = ship.cells.map((c) => pos.get(c)).filter((p) => p !== undefined).sort((a, b) => a - b);
    if (at.length === ship.cells.length && at[at.length - 1] - at[0] === at.length - 1) return true;
  }
  return false;
}
