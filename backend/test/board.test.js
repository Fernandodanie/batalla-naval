import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Board, CELL } from '../src/domain/board.js';
import { BOARD_SIZES, fleetFor, totalShipCells } from '../src/domain/fleet.js';
import { seeded } from './seed.js';

const small = () => new Board(10, [{ id: '3-0', length: 3, name: 'Destructor' }, { id: '2-0', length: 2, name: 'Patrullera' }]);

test('la flota de cada tamaño tiene ids únicos y cabe en el tablero', () => {
  for (const size of Object.keys(BOARD_SIZES).map(Number)) {
    const fleet = fleetFor(size);
    assert.equal(new Set(fleet.map((s) => s.id)).size, fleet.length);
    assert.ok(totalShipCells(size) < size * size * 0.2, `densidad razonable en ${size}x${size}`);
  }
  assert.throws(() => fleetFor(7), RangeError);
});

test('place: valida límites, repetidos y superposición', () => {
  const b = small();
  assert.equal(b.place('3-0', 0, 8, true).error, 'fuera_de_rango');
  assert.equal(b.place('3-0', 9, 0, false).error, 'fuera_de_rango');
  assert.equal(b.place('x', 0, 0, true).error, 'barco_desconocido');
  assert.ok(b.place('3-0', 0, 0, true).ok);
  assert.equal(b.place('3-0', 5, 5, true).error, 'barco_repetido');
  assert.equal(b.place('2-0', 0, 2, false).error, 'barcos_superpuestos');
  assert.ok(b.place('2-0', 1, 0, true).ok);
  assert.ok(b.isComplete());
});

test('el índice plano y la matriz coinciden (fila*size+col)', () => {
  const b = small();
  b.place('3-0', 2, 4, false); // vertical: (2,4) (3,4) (4,4)
  assert.deepEqual(b.ships[0].cells, [24, 34, 44]);
  assert.equal(b.toMatrix()[2].length, 10);
  assert.equal(b.toMatrix().length, 10);
});

test('receiveShot: agua, tocado, hundido y victoria', () => {
  const b = small();
  b.place('3-0', 0, 0, true);
  b.place('2-0', 5, 5, false);
  assert.equal(b.receiveShot(9, 9).result, 'miss');
  assert.equal(b.receiveShot(9, 9).error, 'ya_disparaste_ahi');
  assert.equal(b.receiveShot(10, 0).error, 'fuera_de_rango');
  assert.equal(b.receiveShot(0, 0).result, 'hit');
  assert.equal(b.receiveShot(0, 1).result, 'hit');
  const sunk = b.receiveShot(0, 2);
  assert.equal(sunk.result, 'sunk');
  assert.equal(sunk.allSunk, false);
  assert.deepEqual([b.shots[0], b.shots[1], b.shots[2]], [CELL.SUNK, CELL.SUNK, CELL.SUNK]);
  assert.deepEqual(b.remainingLengths(), [2]);
  b.receiveShot(5, 5);
  assert.equal(b.receiveShot(6, 5).allSunk, true);
});

test('placeRandomly coloca toda la flota sin superponer, en todos los tamaños', () => {
  for (const size of Object.keys(BOARD_SIZES).map(Number)) {
    for (let seed = 1; seed <= 20; seed++) {
      const b = new Board(size, fleetFor(size));
      b.placeRandomly(seeded(seed));
      assert.ok(b.isComplete());
      const occupied = b.owner.filter(Boolean).length;
      assert.equal(occupied, totalShipCells(size), `sin superposición (${size}, semilla ${seed})`);
    }
  }
});
