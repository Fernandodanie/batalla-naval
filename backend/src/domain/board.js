/**
 * Tablero de Batalla Naval: una matriz size × size guardada en un arreglo plano.
 *
 *   índice = fila * size + columna        fila = floor(índice / size)   columna = índice % size
 *
 * Valores de la matriz de disparos (lo que el rival "sabe" de este tablero):
 */
export const CELL = Object.freeze({ UNKNOWN: 0, MISS: 1, HIT: 2, SUNK: 3 });

export class Board {
  /**
   * @param {number} size  lado del tablero
   * @param {{id:string,length:number,name?:string}[]} fleet  barcos que deben colocarse
   */
  constructor(size, fleet) {
    this.size = size;
    this.fleet = fleet;
    this.ships = [];                                   // barcos colocados
    this.shots = new Array(size * size).fill(CELL.UNKNOWN); // disparos RECIBIDOS
    this.owner = new Array(size * size).fill(null);    // id del barco que ocupa cada casilla
  }

  index(row, col) {
    return row * this.size + col;
  }

  inBounds(row, col) {
    return Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && col >= 0 && row < this.size && col < this.size;
  }

  /** Casillas que ocuparía un barco, o null si se sale del tablero. */
  cellsFor(length, row, col, horizontal) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (!this.inBounds(r, c)) return null;
      cells.push(this.index(r, c));
    }
    return cells;
  }

  canPlace(length, row, col, horizontal) {
    const cells = this.cellsFor(length, row, col, horizontal);
    return Boolean(cells) && cells.every((i) => this.owner[i] === null);
  }

  /** Coloca un barco de la flota. Devuelve { ok:true, ship } o { error }. */
  place(id, row, col, horizontal) {
    const def = this.fleet.find((s) => s.id === id);
    if (!def) return { error: 'barco_desconocido' };
    if (this.ships.some((s) => s.id === id)) return { error: 'barco_repetido' };
    const cells = this.cellsFor(def.length, row, col, horizontal);
    if (!cells) return { error: 'fuera_de_rango' };
    if (cells.some((i) => this.owner[i] !== null)) return { error: 'barcos_superpuestos' };
    const ship = { id, length: def.length, name: def.name, cells, hits: 0, sunk: false };
    this.ships.push(ship);
    for (const i of cells) this.owner[i] = id;
    return { ok: true, ship };
  }

  /** Coloca toda la flota al azar. `rng` devuelve un número en [0,1). */
  placeRandomly(rng = Math.random) {
    // Primero los barcos largos: son los más difíciles de acomodar.
    const order = [...this.fleet].sort((a, b) => b.length - a.length);
    for (let attempt = 0; attempt < 200; attempt++) {
      this.clearShips();
      let ok = true;
      for (const def of order) {
        let placed = false;
        for (let t = 0; t < 500 && !placed; t++) {
          const horizontal = rng() < 0.5;
          const row = Math.floor(rng() * this.size);
          const col = Math.floor(rng() * this.size);
          if (this.canPlace(def.length, row, col, horizontal)) {
            this.place(def.id, row, col, horizontal);
            placed = true;
          }
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return true;
    }
    throw new Error('No se pudo colocar la flota al azar');
  }

  clearShips() {
    this.ships = [];
    this.owner.fill(null);
  }

  isComplete() {
    return this.ships.length === this.fleet.length;
  }

  /** Recibe un disparo. Devuelve { ok, result:'miss'|'hit'|'sunk', ship?, allSunk } o { error }. */
  receiveShot(row, col) {
    if (!this.inBounds(row, col)) return { error: 'fuera_de_rango' };
    const i = this.index(row, col);
    if (this.shots[i] !== CELL.UNKNOWN) return { error: 'ya_disparaste_ahi' };

    const shipId = this.owner[i];
    if (shipId === null) {
      this.shots[i] = CELL.MISS;
      return { ok: true, result: 'miss', allSunk: false };
    }
    const ship = this.ships.find((s) => s.id === shipId);
    ship.hits += 1;
    this.shots[i] = CELL.HIT;
    if (ship.hits === ship.length) {
      ship.sunk = true;
      for (const c of ship.cells) this.shots[c] = CELL.SUNK;
      return { ok: true, result: 'sunk', ship, allSunk: this.allSunk() };
    }
    return { ok: true, result: 'hit', allSunk: false };
  }

  allSunk() {
    return this.ships.length > 0 && this.ships.every((s) => s.sunk);
  }

  /** Largos de los barcos que siguen a flote (dato público: se sabe cuáles se hundieron). */
  remainingLengths() {
    return this.ships.filter((s) => !s.sunk).map((s) => s.length);
  }

  /** Vista como matriz de verdad (filas de arreglos) para depurar o mostrar en consola. */
  toMatrix(values = this.shots) {
    const rows = [];
    for (let r = 0; r < this.size; r++) rows.push(values.slice(r * this.size, (r + 1) * this.size));
    return rows;
  }
}
