/**
 * Análisis de una partida terminada: "¿qué tan buenos fueron los disparos de cada jugador?".
 *
 * Se repite la partida disparo a disparo para reconstruir lo que el tirador SABÍA antes de cada uno
 * (agua, impactos, barcos hundidos y qué barcos quedaban) y se mide con Monte Carlo qué probabilidad tenía
 * la casilla elegida frente a la mejor. Eficiencia = probChosen / probBest (1 = jugada óptima).
 * Cada disparo es independiente de los demás, así que `AiPool.analyze()` los reparte entre los hilos.
 */
const MISS = 1, HIT = 2, SUNK = 3;

/** Reconstruye, para cada disparo de `side`, el tablero conocido ANTES de ese disparo. */
export function analysisMoves(game, side) {
  const enemy = game.boards[side === 'A' ? 'B' : 'A'];
  const shots = new Array(game.size * game.size).fill(0);
  const remaining = enemy.ships.map((s) => s.length);
  const moves = [];
  for (const h of game.history) {
    if (h.side !== side) continue;
    moves.push({ shots: shots.slice(), remaining: remaining.slice(), cell: h.index });
    if (h.result === 'miss') shots[h.index] = MISS;
    else if (h.result === 'hit') shots[h.index] = HIT;
    else {
      const ship = enemy.ships.find((s) => s.cells.includes(h.index));
      for (const c of ship.cells) shots[c] = SUNK;
      remaining.splice(remaining.indexOf(ship.length), 1);
    }
  }
  return moves;
}

/** Resume los resultados por disparo (función pura). */
export function summarizeAnalysis(results) {
  const effs = [];
  for (const r of results) if (r.probBest > 0) effs.push(r.probChosen / r.probBest);
  return {
    moves: results.length,
    analysed: effs.length,
    avgEfficiency: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : 0,
    optimal: effs.filter((e) => e >= 0.95).length,   // casi la mejor casilla
    mistakes: effs.filter((e) => e < 0.5).length,    // la mitad de probable que la mejor, o menos
  };
}
