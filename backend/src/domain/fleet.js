/**
 * Tamaños de tablero y flotas.
 *
 * Cada tamaño tiene su flota: los tableros grandes llevan más barcos y más largos
 * para que la densidad de barcos (≈ 10-14 % de casillas) se parezca a la del clásico 10×10.
 */

export const BOARD_SIZES = {
  8: { label: 'Pequeño', lengths: [4, 3, 3, 2] },
  10: { label: 'Clásico', lengths: [5, 4, 3, 3, 2] },
  12: { label: 'Grande', lengths: [5, 4, 4, 3, 3, 2, 2] },
  15: { label: 'Armada', lengths: [6, 5, 5, 4, 4, 3, 3, 3, 2, 2] },
  20: { label: 'Océano', lengths: [7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2] },
};

export const DEFAULT_SIZE = 10;

export const DEFAULT_BIOME = 'water';

/**
 * Escenarios (biomas). El bioma cambia el terreno, el tipo de unidades y los nombres, pero NO las reglas:
 * misma flota (largos), mismo tablero, misma IA. Así los cuatro escenarios son equivalentes en juego.
 *
 *   water  → mar, flota moderna      pirate → mar, barcos piratas
 *   land   → tierra, ejércitos del siglo XIX (infantería, caballería y cañones)       jungle → selva, soldados
 *
 * `names[largo]` es un nombre o una lista: si hay varias unidades del mismo largo, la n-ésima usa names[n % lista.length].
 */
export const BIOMES = {
  water: {
    label: 'Mar · flota moderna', terrain: 'agua', unit: 'barco',
    names: { 2: 'Destructor', 3: ['Crucero', 'Submarino'], 4: 'Acorazado', 5: 'Portaaviones', 6: 'Superacorazado', 7: 'Dreadnought' },
  },
  pirate: {
    label: 'Mar · piratas', terrain: 'agua', unit: 'barco',
    names: { 2: 'Chalupa', 3: ['Bergantín', 'Goleta'], 4: 'Fragata', 5: 'Galeón', 6: 'Navío de línea', 7: 'Buque insignia' },
  },
  land: {
    label: 'Tierra · ejércitos del siglo XIX', terrain: 'tierra', unit: 'unidad',
    names: { 2: 'Patrulla de jinetes', 3: ['Compañía de infantería', 'Batería de cañones'], 4: 'Escuadrón de caballería', 5: 'Regimiento', 6: 'Brigada', 7: 'División' },
  },
  jungle: {
    label: 'Selva · soldados', terrain: 'selva', unit: 'escuadra',
    names: { 2: 'Patrulla', 3: ['Escuadra', 'Exploradores'], 4: 'Pelotón', 5: 'Comando', 6: 'Compañía', 7: 'Batallón' },
  },
};

export function isValidBiome(biome) {
  return Object.hasOwn(BIOMES, biome);
}

/** Nombre de la unidad de ese largo; `n` es el orden entre las de igual largo. */
export function unitName(biome, length, n = 0) {
  const entry = BIOMES[biome]?.names[length];
  if (Array.isArray(entry)) return entry[n % entry.length];
  return entry ?? `Unidad ${length}`;
}

export function isValidSize(size) {
  return Object.hasOwn(BOARD_SIZES, size);
}

/**
 * Definición de la flota para un tamaño y un bioma: [{ id: '5-0', length: 5, name: 'Portaaviones' }, ...]
 * El id es único dentro de la flota (longitud + número de orden entre los de igual longitud) y es igual en todos
 * los biomas: el cliente lo usa para elegir el dibujo (sprite) de cada unidad.
 */
export function fleetFor(size, biome = DEFAULT_BIOME) {
  if (!isValidSize(size)) throw new RangeError(`Tamaño de tablero no soportado: ${size}`);
  if (!isValidBiome(biome)) throw new RangeError(`Bioma no soportado: ${biome}`);
  const seen = {};
  return BOARD_SIZES[size].lengths.map((length) => {
    const n = (seen[length] = (seen[length] ?? -1) + 1);
    return { id: `${length}-${n}`, length, name: unitName(biome, length, n) };
  });
}

export function totalShipCells(size) {
  return BOARD_SIZES[size].lengths.reduce((a, b) => a + b, 0);
}
