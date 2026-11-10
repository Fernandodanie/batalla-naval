import { Board, CELL } from './board.js';
import { DEFAULT_BIOME, fleetFor, isValidBiome, isValidSize } from './fleet.js';

export const SIDES = ['A', 'B'];

/** Estado de una unidad según el daño: normal | damaged (tocada) | smoking (la mitad o más de sus casillas tocadas) | sunk. */
export function unitState(ship) {
  if (ship.sunk) return 'sunk';
  if (!ship.hits) return 'normal';
  return ship.hits * 2 >= ship.length ? 'smoking' : 'damaged';
}
export const other = (side) => (side === 'A' ? 'B' : 'A');

/**
 * Una partida de Batalla Naval entre dos lados (A y B). No sabe nada de red ni de tiempo:
 * la sala (realtime/room.js) la usa como única fuente de verdad.
 *
 * Fases:  placing (colocan la flota)  →  battle (se disparan por turnos)  →  over
 */
export class Game {
  /**
   * @param {object} opts
   * @param {number} opts.size           lado del tablero (8, 10, 12, 15, 20)
   * @param {string} [opts.biome]        escenario: 'water' | 'pirate' | 'land' | 'jungle' (solo cambia nombres y dibujos)
   * @param {boolean} [opts.hitKeepsTurn] si acertar permite volver a disparar
   * @param {'A'|'B'} [opts.starter]     quién abre
   * @param {() => number} [opts.rng]
   */
  constructor({ size, biome = DEFAULT_BIOME, hitKeepsTurn = false, starter = 'A', rng = Math.random }) {
    if (!isValidSize(size)) throw new RangeError(`Tamaño de tablero no soportado: ${size}`);
    if (!isValidBiome(biome)) throw new RangeError(`Bioma no soportado: ${biome}`);
    this.size = size;
    this.biome = biome;
    this.hitKeepsTurn = hitKeepsTurn;
    this.rng = rng;
    this.fleetDef = fleetFor(size, biome);
    this.boards = { A: new Board(size, this.fleetDef), B: new Board(size, this.fleetDef) };
    this.ready = { A: false, B: false };
    this.status = 'placing';
    this.starter = starter;
    this.turn = null;
    this.winner = null;
    this.reason = null; // 'flota_hundida' | 'abandono' | 'tiempo'
    this.lastShot = null;
    this.stats = { A: { shots: 0, hits: 0 }, B: { shots: 0, hits: 0 } };
    this.history = []; // disparos en orden: { side, index, result }; sirve para repetir y analizar la partida
  }

  /** Propone una flota al azar (no se guarda; sirve para el botón "Aleatorio"). */
  randomFleet() {
    const board = new Board(this.size, this.fleetDef);
    board.placeRandomly(this.rng);
    return board.ships.map(({ id, cells }) => {
      const first = cells[0];
      const horizontal = cells.length > 1 ? cells[1] === first + 1 : true;
      return { id, row: Math.floor(first / this.size), col: first % this.size, horizontal };
    });
  }

  /**
   * Guarda la flota de un lado y lo marca listo. Debe venir completa y válida.
   * @param {{id:string,row:number,col:number,horizontal:boolean}[]} placements
   */
  setFleet(side, placements) {
    if (this.status !== 'placing') return { error: 'partida_ya_empezo' };
    if (this.ready[side]) return { error: 'ya_estas_listo' };
    if (!Array.isArray(placements)) return { error: 'formato' };
    const candidate = new Board(this.size, this.fleetDef);
    for (const p of placements) {
      const res = candidate.place(p?.id, p?.row, p?.col, Boolean(p?.horizontal));
      if (res.error) return { error: res.error };
    }
    if (!candidate.isComplete()) return { error: 'flota_incompleta' };
    this.boards[side] = candidate;
    this.ready[side] = true;
    if (this.ready.A && this.ready.B) this.#startBattle();
    return { ok: true };
  }

  /** Coloca la flota al azar y marca listo (lo usa la IA y el autocompletado por tiempo). */
  autoFleet(side) {
    return this.setFleet(side, this.randomFleet());
  }

  #startBattle() {
    this.status = 'battle';
    this.turn = this.starter;
  }

  /** Dispara a la casilla (row, col) del rival. */
  fire(side, row, col) {
    if (this.status !== 'battle') return { error: 'partida_no_iniciada' };
    if (side !== this.turn) return { error: 'no_es_tu_turno' };
    const target = other(side);
    const res = this.boards[target].receiveShot(row, col);
    if (res.error) return res;

    this.stats[side].shots += 1;
    if (res.result !== 'miss') this.stats[side].hits += 1;
    this.history.push({ side, index: row * this.size + col, result: res.result });
    this.lastShot = {
      by: side, row, col, result: res.result,
      ship: res.result === 'sunk' ? { id: res.ship.id, length: res.ship.length, name: res.ship.name } : null,
    };

    if (res.allSunk) {
      this.#finish(side, 'flota_hundida');
    } else if (res.result === 'miss' || !this.hitKeepsTurn) {
      this.turn = target;
    }
    return { ok: true, result: res.result, ship: res.ship ?? null, gameOver: this.status === 'over' };
  }

  /** Dispara a una casilla al azar que aún no se haya probado (se usa cuando se acaba el tiempo). */
  randomShot(side) {
    const board = this.boards[other(side)];
    const free = [];
    board.shots.forEach((v, i) => { if (v === CELL.UNKNOWN) free.push(i); });
    if (free.length === 0) return { error: 'sin_casillas' };
    const i = free[Math.floor(this.rng() * free.length)];
    return this.fire(side, Math.floor(i / this.size), i % this.size);
  }

  /** Un lado abandona (o pierde por tiempo): gana el otro. */
  forfeit(side, reason = 'abandono') {
    if (this.status === 'over') return { error: 'partida_terminada' };
    this.#finish(other(side), reason);
    return { ok: true };
  }

  #finish(winner, reason) {
    this.status = 'over';
    this.winner = winner;
    this.reason = reason;
    this.turn = null;
  }

  /** Lo que el rival "ve" del tablero de `side`: solo los disparos recibidos. */
  #boardView(side, reveal) {
    const b = this.boards[side];
    return {
      shots: [...b.shots],
      ships: reveal ? b.ships.map((s) => ({ id: s.id, length: s.length, name: s.name, cells: s.cells, sunk: s.sunk, hits: s.hits, state: unitState(s) })) : null,
      // Las unidades ya destruidas son públicas (el rival sabe dónde cayeron): el cliente las dibuja aunque `ships` sea null.
      sunk: b.ships.filter((s) => s.sunk).map(({ id, length, name, cells, hits }) => ({ id, length, name, cells, sunk: true, hits, state: 'sunk' })),
      fleet: this.fleetDef.map((def) => {
        const placed = b.ships.find((s) => s.id === def.id);
        return { id: def.id, length: def.length, name: def.name, sunk: Boolean(placed?.sunk) };
      }),
    };
  }

  /**
   * Foto de la partida para un observador: 'A', 'B' o 'spectator'.
   * Los jugadores ven sus propios barcos; los rivales y espectadores no, hasta que termina.
   */
  snapshot(viewer) {
    const over = this.status === 'over';
    return {
      size: this.size,
      biome: this.biome,
      status: this.status,
      turn: this.turn,
      winner: this.winner,
      reason: this.reason,
      hitKeepsTurn: this.hitKeepsTurn,
      ready: { ...this.ready },
      stats: { A: { ...this.stats.A }, B: { ...this.stats.B } },
      lastShot: this.lastShot,
      boards: {
        A: this.#boardView('A', over || viewer === 'A'),
        B: this.#boardView('B', over || viewer === 'B'),
      },
    };
  }
}
