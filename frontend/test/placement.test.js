import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Draft } from '../public/js/placement.js';

const fleet = [{ id: '3-0', length: 3, name: 'Destructor' }, { id: '2-0', length: 2, name: 'Patrullera' }];

test('coloca el barco seleccionado y pasa al siguiente', () => {
  const d = new Draft(10, fleet);
  assert.equal(d.selected, '3-0');
  assert.ok(d.placeSelected(0, 0));
  assert.equal(d.selected, '2-0');
  assert.equal(d.complete, false);
  assert.ok(d.placeSelected(5, 5));
  assert.equal(d.complete, true);
  assert.equal(d.selected, null);
});

test('rechaza salirse del tablero y superponer', () => {
  const d = new Draft(10, fleet);
  assert.equal(d.placeSelected(0, 8), false);       // horizontal de 3 desde la col 8
  d.rotate();
  assert.equal(d.placeSelected(8, 0), false);       // vertical de 3 desde la fila 8
  d.rotate();
  assert.ok(d.placeSelected(2, 2));                 // (2,2) (2,3) (2,4)
  d.rotate();
  assert.equal(d.placeSelected(1, 3), false);       // vertical (1,3) (2,3): pisa
  assert.ok(d.placeSelected(3, 3));
});

test('pickAt levanta un barco para moverlo y conserva su orientación', () => {
  const d = new Draft(10, fleet);
  d.rotate();
  d.placeSelected(0, 0);                            // vertical
  d.rotate(); d.rotate();
  assert.equal(d.pickAt(1, 0), '3-0');
  assert.equal(d.placed.size, 0);
  assert.equal(d.selected, '3-0');
  assert.equal(d.horizontal, false);
  assert.equal(d.pickAt(9, 9), null);
});

test('preview marca en rojo lo que no cabe y toShips coincide con el formato del servidor', () => {
  const d = new Draft(10, fleet);
  assert.deepEqual(d.preview(0, 0), { cells: [0, 1, 2], ok: true, def: fleet[0] });
  const bad = d.preview(0, 9);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.cells, [9]);
  d.placeSelected(4, 4);
  assert.deepEqual(d.toShips(), [{ id: '3-0', row: 4, col: 4, horizontal: true }]);
  d.clear();
  assert.equal(d.placed.size, 0);
});

test('load reemplaza el borrador con la flota del servidor', () => {
  const d = new Draft(10, fleet);
  d.load([{ id: '3-0', row: 0, col: 0, horizontal: true }, { id: '2-0', row: 5, col: 5, horizontal: false }]);
  assert.ok(d.complete);
  assert.deepEqual(d.shipCells().map((s) => s.cells), [[0, 1, 2], [55, 65]]);
});


test('arrastrar una unidad conserva su orientación y la posición anterior si se suelta mal', () => {
  const d = new Draft(8, fleet);
  d.rotate();
  assert.equal(d.placeSelected(0, 0), true); // 3 vertical: (0,0), (1,0), (2,0)
  assert.equal(d.placeSelected(3, 3), true); // 2 vertical
  assert.deepEqual(d.at(1, 0), { id: '3-0', row: 0, col: 0, horizontal: false, offsetRow: 1, offsetCol: 0 });
  assert.equal(d.drop('3-0', 3, 3, false), false, 'rechaza destino ocupado por otra unidad');
  assert.deepEqual(d.placed.get('3-0'), { row: 0, col: 0, horizontal: false }, 'no pierde la unidad al fallar');
  assert.equal(d.drop('3-0', 4, 6, false), true);
  assert.deepEqual(d.placed.get('3-0'), { row: 4, col: 6, horizontal: false });
  assert.equal(d.complete, true);
  assert.equal(d.selected, null);
  assert.equal(d.drop('3-0', 6, 6, false), false, 'no cabe fuera del tablero');
  assert.deepEqual(d.placed.get('3-0'), { row: 4, col: 6, horizontal: false });
});

test('vista previa arrastrada fuera del borde no dibuja índices negativos', () => {
  const d = new Draft(8, fleet);
  assert.deepEqual(d.preview(-1, 0).cells, [], 'arrastre horizontal fuera de la fila superior');
  d.rotate();
  assert.deepEqual(d.preview(0, -1).cells, [], 'arrastre vertical fuera del borde izquierdo');
});
