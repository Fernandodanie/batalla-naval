/**
 * IA "Experta": estimación Monte Carlo de dónde pueden estar los barcos.
 *
 * Idea: se generan muchas flotas ALEATORIAS que sean compatibles con lo que ya se sabe (no pisan
 * agua ni barcos hundidos, y cubren todos los impactos todavía sin hundir). Cada casilla acumula
 * cuántas veces la ocupó un barco: ese conteo es la densidad de probabilidad. La IA dispara a la
 * casilla desconocida con más conteo.
 *
 * ¿Por qué es paralelizable? Cada muestra es independiente de las demás: se puede repartir
 * `samples` entre p hilos, que no se comunican entre sí, y al final se SUMAN los conteos
 * (reducción). Es el patrón "map-reduce" / paralelismo de datos más simple.
 *
 * Todo aquí son funciones PURAS (sin hilos, sin red): las usan el worker, el modo sin hilos y las pruebas.
 */
const UNKNOWN = 0, MISS = 1, HIT = 2, SUNK = 3;

/** Todas las posiciones legales de un barco de `length`: dentro del tablero y sin pisar agua/hundidos. */
function buildPlacements(size, shots, length) {
  const all = { start: [], step: [] };
  const hit = { start: [], step: [] };
  for (const horizontal of length === 1 ? [true] : [true, false]) {
    const step = horizontal ? 1 : size;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (horizontal ? c + length > size : r + length > size) continue;
        const s = r * size + c;
        let blocked = false, covers = 0;
        for (let k = 0; k < length; k++) {
          const v = shots[s + k * step];
          if (v === MISS || v === SUNK) { blocked = true; break; }
          if (v === HIT) covers++;
        }
        if (blocked) continue;
        all.start.push(s); all.step.push(step);
        // Una posición que cubre h impactos entra 8^(h-1) veces (máx. 512) en la lista de "cubre impactos":
        // es más probable que impactos alineados sean UN solo barco a que sean barcos distintos.
        for (let c = 0, copies = Math.min(8 ** (covers - 1), 512); covers > 0 && c < copies; c++) {
          hit.start.push(s); hit.step.push(step);
        }
      }
    }
  }
  const pack = (p) => ({ n: p.start.length, start: Int32Array.from(p.start), step: Int32Array.from(p.step) });
  return { all: pack(all), hit: pack(hit) };
}

/**
 * Genera `samples` flotas aleatorias consistentes y acumula la densidad.
 *
 * @param {{size:number, shots:ArrayLike<number>, remaining:number[], samples:number, rng:()=>number,
 *          shouldStop?:()=>boolean}} p   shouldStop se consulta cada 256 muestras: cancelación cooperativa
 * @returns {{density:Int32Array, accepted:number}}  accepted = muestras válidas (las demás se descartan)
 */
export function sampleDensity({ size, shots, remaining, samples, rng, shouldStop }) {
  const n = size * size;
  const density = new Int32Array(n);
  const lengths = [...remaining].sort((a, b) => b - a); // primero los largos: son los más difíciles de acomodar
  const hits = [];
  for (let i = 0; i < n; i++) if (shots[i] === HIT) hits.push(i);
  const hitCount = hits.length;

  const placements = new Map();
  for (const len of new Set(lengths)) placements.set(len, buildPlacements(size, shots, len));
  const plan = lengths.map((len) => placements.get(len));
  if (plan.some((p) => p.all.n === 0)) return { density, accepted: 0 };

  const occupied = new Int32Array(n);  // occupied[i] === stamp  ⇒ casilla ocupada en la muestra actual (sin limpiar)
  const chosenStart = new Int32Array(lengths.length);
  const chosenStep = new Int32Array(lengths.length);
  let accepted = 0;

  for (let sample = 1; sample <= samples; sample++) {
    if ((sample & 255) === 0 && shouldStop?.()) break; // el pool pidió cancelar: se devuelve lo calculado hasta ahora
    let covered = 0, failed = false;
    for (let s = 0; s < plan.length && !failed; s++) {
      const { all, hit } = plan[s];
      const len = lengths[s];
      let placed = false;
      for (let attempt = 0; attempt < 40 && !placed; attempt++) {
        // Mientras queden impactos sin cubrir, se prefiere (90 %) una posición que cubra alguno.
        const list = covered < hitCount && hit.n > 0 && rng() < 0.9 ? hit : all;
        const k = Math.floor(rng() * list.n);
        const start = list.start[k], step = list.step[k];
        let free = true;
        for (let j = 0; j < len; j++) if (occupied[start + j * step] === sample) { free = false; break; }
        if (!free) continue;
        for (let j = 0; j < len; j++) {
          const i = start + j * step;
          occupied[i] = sample;
          if (shots[i] === HIT) covered++;
        }
        chosenStart[s] = start; chosenStep[s] = step;
        placed = true;
      }
      if (!placed) failed = true;
    }
    if (failed || covered !== hitCount) continue; // flota incompatible con los impactos: se descarta
    accepted++;
    for (let s = 0; s < plan.length; s++) {
      for (let j = 0; j < lengths[s]; j++) {
        const i = chosenStart[s] + j * chosenStep[s];
        if (shots[i] === UNKNOWN) density[i]++;
      }
    }
  }
  return { density, accepted };
}

/** Casilla desconocida con más conteo (los empates se resuelven al azar). -1 si no hay ninguna. */
export function bestCell(density, shots, rng = Math.random) {
  let best = 0;
  const top = [];
  for (let i = 0; i < density.length; i++) {
    if (shots[i] !== UNKNOWN) continue;
    if (density[i] > best) { best = density[i]; top.length = 0; }
    if (density[i] === best && best > 0) top.push(i);
  }
  return top.length ? top[Math.floor(rng() * top.length)] : -1;
}

/** Con menos muestras válidas que esto, el conteo no es confiable y la IA usa el cálculo exacto de "difícil". */
export const MIN_ACCEPTED = 10;
export const DEFAULT_SAMPLES = 20_000;
