/** Tablero con sprites: capas de unidades y marcadores, por bioma (sin servidor, solo jsdom). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="b"></div><div id="c"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window });

const { createBoard } = await import('../public/js/board.js');
const { kindFor, unitImage, markerImage } = await import('../public/js/sprites.js');

test('cada bioma elige un dibujo distinto y coherente con el largo', () => {
  assert.equal(kindFor('water', 5, 0), 'carrier');
  assert.equal(kindFor('water', 3, 1), 'submarine');
  assert.equal(kindFor('pirate', 4, 0), 'pirate');
  assert.equal(kindFor('land', 2, 0), 'cavalry', 'el respaldo de tierra ya no dibuja tanques');
  assert.equal(kindFor('land', 3, 1), 'cannon');
  assert.equal(kindFor('land', 4, 0), 'infantry');
  assert.equal(kindFor('land', 5, 0), 'battery');
  for (const len of [2, 3, 4, 5, 6, 7]) for (const idx of [0, 1]) assert.notEqual(kindFor('land', len, idx), 'tank');
  assert.equal(kindFor('land', 6, 0), 'train');
  assert.equal(kindFor('jungle', 4, 0), 'squad');
  const imgs = new Set(['water', 'pirate', 'land', 'jungle'].map((b) => unitImage(b, 4, '4-0')));
  assert.equal(imgs.size, 4, 'cuatro imágenes distintas');
  assert.notEqual(unitImage('land', 4, '4-0', true), unitImage('land', 4, '4-0', false), 'vertical ≠ horizontal');
  assert.notEqual(markerImage('miss', 'water'), markerImage('miss', 'land'), 'el fallo depende del terreno');
});

test('el tablero dibuja una unidad por barco y un marcador por disparo, y reutiliza los nodos', () => {
  const board = createBoard(document.querySelector('#b'), 8, { biome: 'land' });
  assert.equal(document.querySelector('#b').dataset.biome, 'land');
  assert.equal(board.cells.length, 64);

  const shots = new Array(64).fill(0);
  shots[1] = 2; shots[20] = 1;
  const ships = [{ id: '3-0', length: 3, cells: [0, 1, 2], sunk: false }, { id: '2-0', length: 2, cells: [8, 16], sunk: false }];
  board.paint({ shots, ships, last: 20 });
  const layer = document.querySelector('#b .layer');
  assert.equal(layer.querySelectorAll('.sprite').length, 2);
  assert.equal(layer.querySelectorAll('.mark.hit').length, 1);
  assert.equal(layer.querySelectorAll('.mark.miss').length, 1);
  assert.equal(layer.querySelectorAll('.lastmark').length, 1);

  const first = layer.querySelector('.mark.hit');
  shots[30] = 1;
  board.paint({ shots, ships, last: 30 });
  assert.equal(layer.querySelector('.mark.hit'), first, 'el marcador anterior no se recrea (no repite su animación)');
  assert.equal(layer.querySelectorAll('.mark.miss').length, 2);

  // al hundirse: casillas en 3 y la unidad pasa a "dead"
  shots[8] = 3; shots[16] = 3;
  board.paint({ shots, ships: ships.map((s) => (s.id === '2-0' ? { ...s, sunk: true } : s)), last: 16 });
  assert.equal(layer.querySelectorAll('.sprite.dead').length, 1);
  assert.equal(layer.querySelectorAll('.mark.sunk').length, 2);
});

test('la unidad fantasma de la colocación solo aparece si cabe completa', () => {
  const board = createBoard(document.querySelector('#c'), 8, { biome: 'jungle' });
  const def = { id: '3-0', length: 3 };
  board.paint({ preview: { cells: [0, 1, 2], ok: true, def } });
  assert.equal(document.querySelectorAll('#c .sprite.ghost.ok').length, 1);
  board.paint({ preview: { cells: [6, 7], ok: false, def } }); // se sale del tablero: solo casillas en rojo
  assert.equal(document.querySelectorAll('#c .sprite.ghost').length, 0);
});


test('crear tableros de revancha no duplica clics ni conserva listeners de rondas anteriores', () => {
  const container = document.querySelector('#b');
  let oldClicks = 0, newClicks = 0;
  const old = createBoard(container, 8, { onCell: () => { oldClicks++; } });
  old.cells[0].click();
  assert.equal(oldClicks, 1);
  const current = createBoard(container, 8, { onCell: () => { newClicks++; } });
  current.cells[0].click();
  assert.equal(oldClicks, 1, 'el callback de la ronda anterior no se ejecuta');
  assert.equal(newClicks, 1, 'solo se ejecuta una colocación por clic');
  old.destroy(); // destruir referencia antigua no toca la instancia actual
  current.cells[1].click();
  assert.equal(newClicks, 2);
  current.destroy();
  current.cells[2].click();
  assert.equal(newClicks, 2, 'destruir quita la última suscripción');
});
