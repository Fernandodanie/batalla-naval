/**
 * Tareas que sabe ejecutar un worker (y también el modo sin hilos).
 * Un mensaje es un objeto con `kind`:
 *
 *   choose  una jugada completa de cualquier dificultad            → { index }
 *   mc      un TROZO de las muestras Monte Carlo de la IA experta
 *             mode 'message': los datos viajan copiados por postMessage y el trozo devuelve su densidad
 *             mode 'shared' : los datos viven en un SharedArrayBuffer; el trozo suma con Atomics   → { accepted }
 *   game    una tanda de partidas IA contra IA (para el torneo)    → estadísticas
 *   solo    una tanda de tableros que UNA estrategia resuelve disparando sola → { games, shots, shotsSq }
 *   analysis  la calidad de UN disparo de una partida terminada     → { probChosen, probBest, rank }
 *
 * Mantenerlas en un solo archivo permite probar la misma lógica con hilos y sin ellos.
 */
import { Game } from '../domain/game.js';
import { MIN_ACCEPTED, sampleDensity } from './montecarlo.js';
import { mulberry32 } from './rng.js';
import { chooseShot } from './strategies.js';

/** @returns {{reply:object, transfer?:ArrayBuffer[]}} */
export function runTask(msg) {
  switch (msg.kind ?? 'choose') {
    case 'choose':
      return { reply: { index: chooseShot(msg.payload) } };
    case 'mc':
      return mcTask(msg);
    case 'game':
      return { reply: gameTask(msg) };
    case 'analysis':
      return { reply: analysisTask(msg) };
    case 'solo':
      return { reply: soloTask(msg) };
    default:
      throw new Error(`tarea_desconocida: ${msg.kind}`);
  }
}

function mcTask({ mode, size, remaining, samples, seed, shots, shotsBuf, densityBuf, cancelBuf }) {
  const rng = mulberry32(seed);
  // Bandera de cancelación en memoria compartida: el hilo principal la sube con Atomics.store y el worker la lee
  // cada 256 muestras; así un cálculo ya iniciado puede abortarse sin matar el hilo.
  const flag = cancelBuf ? new Int32Array(cancelBuf) : null;
  const shouldStop = flag ? () => Atomics.load(flag, 0) !== 0 : undefined;
  if (mode === 'shared') {
    const view = new Uint8Array(shotsBuf);             // lectura compartida: nadie copia el tablero
    const shared = new Int32Array(densityBuf);         // [0..n-1] densidad, [n] muestras válidas
    const { density, accepted } = sampleDensity({ size, shots: view, remaining, samples, rng, shouldStop });
    // Se acumula en local y se vuelca UNA vez con Atomics.add: pocas escrituras compartidas = poca contención.
    for (let i = 0; i < density.length; i++) if (density[i] !== 0) Atomics.add(shared, i, density[i]);
    Atomics.add(shared, density.length, accepted);
    return { reply: { accepted } };
  }
  const { density, accepted } = sampleDensity({ size, shots, remaining, samples, rng, shouldStop });
  return { reply: { density, accepted }, transfer: [density.buffer] }; // el buffer se MUEVE, no se copia
}

/**
 * Juega `games` partidas IA contra IA en tamaño `size`. Las estrategias `a` y `b` son
 * { difficulty, samples? }. Se intercambian los lados en cada partida para que quién abre no sesgue.
 */
function gameTask({ size, games, a, b, seed }) {
  const rng = mulberry32(seed);
  const out = { games: 0, winsA: 0, winsB: 0, shotsWinA: 0, shotsWinB: 0 };
  for (let n = 0; n < games; n++) {
    const aIsSideA = n % 2 === 0;
    const sides = aIsSideA ? { A: a, B: b } : { A: b, B: a };
    const g = new Game({ size, rng });
    g.autoFleet('A');
    g.autoFleet('B');
    while (g.status === 'battle') {
      const side = g.turn;
      const enemy = g.boards[side === 'A' ? 'B' : 'A'];
      const strat = sides[side];
      const i = chooseShot({ size, shots: enemy.shots, remaining: enemy.remainingLengths(), ...strat }, rng);
      const res = g.fire(side, Math.floor(i / size), i % size);
      if (res.error) throw new Error(`disparo_invalido: ${res.error}`);
    }
    const aWon = (g.winner === 'A') === aIsSideA;
    out.games++;
    if (aWon) { out.winsA++; out.shotsWinA += g.stats[g.winner].shots; }
    else { out.winsB++; out.shotsWinB += g.stats[g.winner].shots; }
  }
  return out;
}

/**
 * Calidad de un disparo: con el tablero tal como estaba ANTES de disparar, ¿qué probabilidad (estimada por
 * Monte Carlo) tenía la casilla elegida de contener un barco, comparada con la mejor casilla posible?
 * Cada disparo se analiza por separado: es una tarea independiente.
 */
function analysisTask({ size, shots, remaining, cell, samples, seed }) {
  const { density, accepted } = sampleDensity({ size, shots, remaining, samples, rng: mulberry32(seed) });
  if (accepted < MIN_ACCEPTED) return { accepted, probChosen: null, probBest: null, rank: null };
  const chosen = density[cell];
  let best = 0, rank = 1;
  for (let i = 0; i < density.length; i++) {
    if (shots[i] !== 0) continue;
    if (density[i] > best) best = density[i];
    if (density[i] > chosen) rank += 1;
  }
  return { accepted, probChosen: chosen / accepted, probBest: best / accepted, rank };
}

/**
 * Mide una estrategia en solitario: dispara a `games` tableros aleatorios hasta hundir toda la flota y suma los
 * disparos que necesitó. Sin rival no hay sesgo de "quién abre" ni de "solo cuento mis victorias".
 * Devuelve suma y suma de cuadrados para poder calcular media y error estándar al juntar los trozos.
 */
function soloTask({ size, games, strategy, seed }) {
  const rng = mulberry32(seed);
  const out = { games: 0, shots: 0, shotsSq: 0 };
  for (let n = 0; n < games; n++) {
    const g = new Game({ size, rng });
    g.autoFleet('B');
    const enemy = g.boards.B;
    let shots = 0;
    while (!enemy.allSunk()) {
      const i = chooseShot({ size, shots: enemy.shots, remaining: enemy.remainingLengths(), ...strategy }, rng);
      const res = enemy.receiveShot(Math.floor(i / size), i % size);
      if (res.error) throw new Error(`disparo_invalido: ${res.error}`);
      shots += 1;
    }
    out.games += 1; out.shots += shots; out.shotsSq += shots * shots;
  }
  return out;
}
