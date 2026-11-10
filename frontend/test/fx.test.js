/** Efectos de disparo: trayectoria, estilos por escenario y respeto de los ajustes. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage, Element: dom.window.Element });
const fx = await import('../public/js/fx.js');
const { settings } = await import('../public/js/settings.js');

const rect = (x, y, w = 20, h = 20) => ({ left: x, top: y, width: w, height: h });
const nodes = () => document.querySelectorAll('#fx-layer > *').length;

test('pointAt: parte del origen, termina en el blanco y el arco sube en medio', () => {
  const a = { x: 0, y: 100 }; const b = { x: 200, y: 100 };
  assert.deepEqual(fx.pointAt(a, b, 0, 40), a);
  assert.deepEqual(fx.pointAt(a, b, 1, 40), b);
  const m = fx.pointAt(a, b, 0.5, 40);
  assert.equal(m.x, 100);
  assert.ok(m.y < 100 && m.y > 100 - 40, 'sube, pero menos que el arco completo (curva suave)');
  const q = fx.pointAt(a, b, 0.25, 40);
  assert.ok(q.x > 0 && q.x < 100 && q.y < 100);
});

test('cada escenario tiene su proyectil y el atlas lo trae', async () => {
  assert.equal(fx.projectileName('water'), 'projectile');
  assert.equal(fx.projectileName('land'), 'projectile-land');
  assert.equal(fx.projectileName('jungle'), 'projectile-jungle');
  assert.equal(fx.projectileName('pirate'), 'projectile-pirate');
  assert.equal(fx.projectileName('marte'), 'projectile', 'uno desconocido usa el del mar');
  assert.equal(new Set(Object.values(fx.PROJECTILE)).size, 4, 'los cuatro son distintos');
  const { readFileSync } = await import('node:fs');
  for (const tile of [16, 32]) {
    const sprites = JSON.parse(readFileSync(new URL(`../public/img/atlas-${tile}.json`, import.meta.url), 'utf8')).sprites;
    for (const name of Object.values(fx.PROJECTILE)) assert.equal(sprites[`fx/${name}`]?.frames, 6, `${name} @${tile}`);
  }
});

test('arcFor crece con la distancia, con tope', () => {
  assert.ok(fx.arcFor({ x: 0, y: 0 }, { x: 40, y: 0 }) < fx.arcFor({ x: 0, y: 0 }, { x: 200, y: 0 }));
  assert.equal(fx.arcFor({ x: 0, y: 0 }, { x: 5000, y: 0 }), 90);
});

test('cada escenario tiene su color de estela y fogonazo; uno desconocido usa el del mar', () => {
  const colors = ['water', 'pirate', 'land', 'jungle'].map((b) => fx.styleFor(b).trail);
  assert.equal(new Set(colors).size >= 3, true, 'tierra y selva se distinguen del mar');
  assert.deepEqual(fx.styleFor('marte'), fx.styleFor('water'));
});

test('sin API de animación (jsdom) o con animaciones desactivadas, los efectos terminan al instante y no dejan nodos', async () => {
  settings.reset();
  await fx.muzzle(rect(0, 0), 'land');
  await fx.ripple({ x: 5, y: 5 }, 30);
  await fx.popText('¡Racha ×2!', { x: 10, y: 10 });
  await fx.screenFlash();
  assert.equal(nodes(), 0, 'jsdom no anima: no queda nada colgado');

  settings.set({ animations: 'off' });
  await fx.muzzle(rect(0, 0));
  await fx.popText('x', { x: 1, y: 1 });
  await fx.projectile(rect(0, 0), rect(100, 100), 24, { biome: 'water' });
  assert.equal(nodes(), 0);
});

test('con animaciones «ligeras» no hay adornos (ondas, racha, destello, fogonazo)', async () => {
  settings.set({ animations: 'light' });
  // Simula un navegador que sí anima, para comprobar que el nivel decide y no la falta de API.
  let created = 0;
  dom.window.Element.prototype.animate = function animate() { created += 1; const a = { onfinish: null, oncancel: null }; setTimeout(() => a.onfinish?.(), 0); return a; };
  try {
    await Promise.all([fx.muzzle(rect(0, 0)), fx.ripple({ x: 1, y: 1 }, 30), fx.popText('x', { x: 1, y: 1 }), fx.screenFlash()]);
    assert.equal(created, 0, 'ningún adorno en modo ligero');
    settings.set({ animations: 'full' });
    await Promise.all([fx.muzzle(rect(0, 0)), fx.popText('x', { x: 1, y: 1 }), fx.screenFlash()]);
    assert.ok(created >= 3, 'con animaciones completas sí se crean');
    assert.equal(nodes(), 0, 'y se retiran solos al terminar');
  } finally { delete dom.window.Element.prototype.animate; }
});

test('shake respeta el ajuste de sacudida y las animaciones desactivadas', () => {
  let shakes = 0;
  const node = { animate() { shakes += 1; } };
  settings.reset();
  fx.shake(node);
  assert.equal(shakes, 1);
  settings.set({ shake: false });
  fx.shake(node);
  assert.equal(shakes, 1, 'sacudida desactivada');
  settings.set({ shake: true, animations: 'off' });
  fx.shake(node);
  assert.equal(shakes, 1, 'sin animaciones no sacude');
  fx.shake(null); // no lanza
});

test('hay un tope de nodos de efecto a la vez', async () => {
  settings.set({ animations: 'full' });
  dom.window.Element.prototype.animate = function animate() { const a = { onfinish: null, oncancel: null }; setTimeout(() => a.onfinish?.(), 20); return a; };
  try {
    const all = Array.from({ length: 80 }, (_, i) => fx.popText(`n${i}`, { x: i, y: i }));
    assert.ok(nodes() <= 40, `no pasa de 40 nodos (hay ${nodes()})`);
    await Promise.all(all);
    assert.equal(nodes(), 0);
  } finally { delete dom.window.Element.prototype.animate; }
});
