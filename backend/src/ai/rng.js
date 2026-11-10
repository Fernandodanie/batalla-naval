/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 * Cada worker recibe una semilla distinta: los resultados son reproducibles y los hilos no repiten muestras.
 */
export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla del trozo k derivada de una semilla base (constante de Fibonacci/golden ratio para dispersarlas). */
export const chunkSeed = (seed, k) => (seed + Math.imul(k + 1, 0x9e3779b1)) >>> 0;
