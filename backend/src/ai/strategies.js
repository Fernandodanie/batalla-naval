/**
 * Estrategias de la IA. Son funciones PURAS: reciben lo que la IA puede saber del tablero
 * enemigo y devuelven el índice de la casilla a la que disparar. No tocan la partida,
 * así se pueden probar solas y también ejecutar dentro de un worker thread.
 *
 * Entrada (todo es información pública, la IA no hace trampa):
 *   size       lado del tablero
 *   shots      matriz plana de disparos propios (0 desconocido, 1 agua, 2 tocado, 3 hundido)
 *   remaining  largos de los barcos enemigos que siguen a flote
 *   difficulty 'easy' | 'normal' | 'hard'
 */

import { bestCell, DEFAULT_SAMPLES, MIN_ACCEPTED, sampleDensity } from './montecarlo.js';
import { mulberry32 } from './rng.js';

export const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'];

const UNKNOWN = 0, MISS = 1, HIT = 2, SUNK = 3;

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function unknownCells(shots) {
  const out = [];
  for (let i = 0; i < shots.length; i++) if (shots[i] === UNKNOWN) out.push(i);
  return out;
}

/** Fácil: al azar. */
function easy({ shots }, rng) {
  return pick(unknownCells(shots), rng);
}

/**
 * Normal: "caza y objetivo". Mientras no haya tocados dispara en tablero de ajedrez
 * (un barco de 2 o más siempre toca una casilla de cada color); al tocar, explora los vecinos
 * y prefiere seguir la línea que ya formaron dos impactos.
 */
function normal({ size, shots }, rng) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const scores = new Map();
  for (let i = 0; i < shots.length; i++) {
    if (shots[i] !== HIT) continue;
    const r = Math.floor(i / size), c = i % size;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const n = nr * size + nc;
      if (shots[n] !== UNKNOWN) continue;
      const br = r - dr, bc = c - dc; // la casilla de atrás: ¿también está tocada?
      const behindHit = br >= 0 && bc >= 0 && br < size && bc < size && shots[br * size + bc] === HIT;
      scores.set(n, Math.max(scores.get(n) ?? 0, behindHit ? 3 : 1));
    }
  }
  if (scores.size > 0) {
    const best = Math.max(...scores.values());
    return pick([...scores].filter(([, s]) => s === best).map(([i]) => i), rng);
  }
  const free = unknownCells(shots);
  const parity = free.filter((i) => (Math.floor(i / size) + (i % size)) % 2 === 0);
  return pick(parity.length ? parity : free, rng);
}

/**
 * Difícil: mapa de densidad de probabilidad. Para cada barco que sigue a flote prueba todas las
 * posiciones en que aún podría estar (sin pisar agua ni barcos hundidos) y suma 1 a cada casilla
 * que cubre. Las posiciones que atraviesan casillas ya tocadas pesan muchísimo más, así que
 * cuando hay un impacto la IA se concentra a su alrededor. Dispara a la casilla con más puntos.
 */
function hard({ size, shots, remaining }, rng) {
  const density = new Float64Array(size * size);
  for (const length of new Set(remaining)) {
    const copies = remaining.filter((l) => l === length).length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        for (const horizontal of length === 1 ? [true] : [true, false]) {
          if (horizontal ? c + length > size : r + length > size) continue;
          let hits = 0, blocked = false;
          for (let k = 0; k < length; k++) {
            const v = shots[horizontal ? r * size + c + k : (r + k) * size + c];
            if (v === MISS || v === SUNK) { blocked = true; break; }
            if (v === HIT) hits++;
          }
          if (blocked) continue;
          const weight = copies * (hits === 0 ? 1 : 100 ** hits);
          for (let k = 0; k < length; k++) {
            const i = horizontal ? r * size + c + k : (r + k) * size + c;
            if (shots[i] === UNKNOWN) density[i] += weight;
          }
        }
      }
    }
  }
  let best = 0;
  const top = [];
  for (let i = 0; i < density.length; i++) {
    if (shots[i] !== UNKNOWN) continue;
    if (density[i] > best) { best = density[i]; top.length = 0; }
    if (density[i] === best) top.push(i);
  }
  return best > 0 ? pick(top, rng) : easy({ shots }, rng);
}

/**
 * Experta: Monte Carlo (ver montecarlo.js). Aquí corre TODO en un solo hilo (el "secuencial" de referencia);
 * `AiPool` reparte las mismas muestras entre varios hilos. Con pocas muestras válidas cae a "difícil".
 */
function expert({ size, shots, remaining, samples = DEFAULT_SAMPLES }, rng) {
  const mc = mulberry32(Math.floor(rng() * 4294967296));
  const { density, accepted } = sampleDensity({ size, shots, remaining, samples, rng: mc });
  const cell = accepted >= MIN_ACCEPTED ? bestCell(density, shots, rng) : -1;
  return cell >= 0 ? cell : hard({ size, shots, remaining }, rng);
}

const STRATEGIES = { easy, normal, hard, expert };

/** Devuelve el índice (fila*size+col) de la casilla elegida. */
export function chooseShot(input, rng = Math.random) {
  const strategy = STRATEGIES[input.difficulty] ?? normal;
  return strategy(input, rng);
}
