/**
 * Borrador de la flota mientras el jugador la acomoda. Lógica pura (sin DOM) para poder probarla.
 * Usa el mismo índice plano que el servidor:  índice = fila * size + columna.
 */
export class Draft {
  /** @param {number} size  @param {{id:string,length:number,name:string}[]} fleet */
  constructor(size, fleet) {
    this.size = size;
    this.fleet = fleet;
    this.placed = new Map(); // id -> { row, col, horizontal }
    this.horizontal = true;
    this.selected = fleet[0]?.id ?? null;
  }

  def(id) { return this.fleet.find((s) => s.id === id); }

  cellsFor(length, row, col, horizontal) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (r < 0 || c < 0 || r >= this.size || c >= this.size) return null;
      cells.push(r * this.size + c);
    }
    return cells;
  }

  #occupied(exceptId = null) {
    const set = new Set();
    for (const [id, p] of this.placed) {
      if (id === exceptId) continue;
      for (const i of this.cellsFor(this.def(id).length, p.row, p.col, p.horizontal)) set.add(i);
    }
    return set;
  }

  canPlace(id, row, col, horizontal = this.horizontal) {
    const def = this.def(id);
    const cells = def && this.cellsFor(def.length, row, col, horizontal);
    if (!cells) return false;
    const busy = this.#occupied(id);
    return cells.every((i) => !busy.has(i));
  }

  place(id, row, col, horizontal = this.horizontal) {
    if (!this.canPlace(id, row, col, horizontal)) return false;
    this.placed.set(id, { row, col, horizontal });
    return true;
  }

  /** Identifica una unidad ya colocada y el punto por donde se agarró (para arrastrar sin saltos). */
  at(row, col) {
    const index = row * this.size + col;
    for (const [id, p] of this.placed) {
      if (this.cellsFor(this.def(id).length, p.row, p.col, p.horizontal)?.includes(index)) {
        return { id, row: p.row, col: p.col, horizontal: p.horizontal, offsetRow: row - p.row, offsetCol: col - p.col };
      }
    }
    return null;
  }

  /** Mueve o coloca, conservando la posición anterior si el destino es inválido. */
  drop(id, row, col, horizontal = this.horizontal) {
    if (!this.place(id, row, col, horizontal)) return false;
    this.horizontal = horizontal;
    this.selected = this.fleet.find((s) => !this.placed.has(s.id))?.id ?? null;
    return true;
  }

  /** Coloca el barco seleccionado y pasa al siguiente sin colocar. */
  placeSelected(row, col) {
    return Boolean(this.selected && this.drop(this.selected, row, col, this.horizontal));
  }

  /** Si hay un barco en esa casilla lo levanta (para moverlo) y lo deja seleccionado. */
  pickAt(row, col) {
    const hit = this.at(row, col);
    if (!hit) return null;
    this.placed.delete(hit.id);
    this.selected = hit.id;
    this.horizontal = hit.horizontal;
    return hit.id;
  }

  select(id) {
    if (!this.def(id)) return;
    this.placed.delete(id); // al elegirlo de la lista se levanta para recolocarlo
    this.selected = id;
  }

  rotate() { this.horizontal = !this.horizontal; }

  clear() {
    this.placed.clear();
    this.selected = this.fleet[0]?.id ?? null;
    this.horizontal = true;
  }

  /** Vista previa del barco seleccionado con la esquina en (row, col). */
  preview(row, col) {
    const def = this.selected && this.def(this.selected);
    if (!def) return null;
    const cells = this.cellsFor(def.length, row, col, this.horizontal);
    if (!cells) {
      // Se sale del tablero: muestra lo que cabe, en rojo.
      const inside = [];
      for (let i = 0; i < def.length; i++) {
        const r = this.horizontal ? row : row + i;
        const c = this.horizontal ? col + i : col;
        if (r >= 0 && c >= 0 && r < this.size && c < this.size) inside.push(r * this.size + c);
      }
      return { cells: inside, ok: false, def };
    }
    return { cells, ok: this.canPlace(def.id, row, col, this.horizontal), def };
  }

  get complete() { return this.placed.size === this.fleet.length; }

  /** Barcos colocados con sus casillas, para pintar el tablero. */
  shipCells() {
    return [...this.placed].map(([id, p]) => {
      const def = this.def(id);
      return { id, length: def.length, sunk: false, cells: this.cellsFor(def.length, p.row, p.col, p.horizontal) };
    });
  }

  toShips() {
    return [...this.placed].map(([id, p]) => ({ id, row: p.row, col: p.col, horizontal: p.horizontal }));
  }

  /** Reemplaza el borrador con una flota completa (por ejemplo la que propone el servidor). */
  load(ships) {
    this.placed.clear();
    for (const s of ships) this.placed.set(s.id, { row: s.row, col: s.col, horizontal: s.horizontal });
    this.selected = null;
  }
}
