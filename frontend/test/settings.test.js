import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage });
const { DEFAULTS, animationsFull, animationsOff, sanitize, settings } = await import('../public/js/settings.js');

test('sanitize: valores desconocidos, tipos equivocados o basura vuelven al valor por defecto', () => {
  assert.deepEqual(sanitize(undefined), DEFAULTS);
  assert.deepEqual(sanitize('texto'), DEFAULTS);
  assert.deepEqual(sanitize({ animations: 'turbo', shake: 'sí', narration: 1, aula: null, voice: 'sí', music: 'no', musicVolume: 'alto', extra: 1 }), DEFAULTS);
  assert.deepEqual(sanitize({ animations: 'light', shake: false, narration: false, aula: true, voice: true, music: false, musicVolume: 30 }),
    { animations: 'light', shake: false, narration: false, aula: true, voice: true, music: false, musicVolume: 30 });
  // el volumen se limita a 0–100 y se redondea
  assert.equal(sanitize({ musicVolume: 250 }).musicVolume, 100);
  assert.equal(sanitize({ musicVolume: -5 }).musicVolume, 0);
  assert.equal(sanitize({ musicVolume: 42.6 }).musicVolume, 43);
  assert.equal(sanitize({ musicVolume: NaN }).musicVolume, DEFAULTS.musicVolume);
});

test('set guarda en este navegador, avisa a quien escucha y se puede dejar de escuchar', () => {
  const seen = [];
  const off = settings.on((v) => seen.push(v.animations));
  settings.set({ animations: 'light' });
  assert.deepEqual(JSON.parse(localStorage.getItem('bn.settings')).animations, 'light');
  assert.equal(animationsFull(), false);
  assert.equal(animationsOff(), false);
  settings.set({ animations: 'off' });
  assert.equal(animationsOff(), true);
  off();
  settings.set({ animations: 'full' });
  assert.deepEqual(seen, ['light', 'off']);
  assert.equal(animationsFull(), true);
});

test('set ignora valores inválidos y reset vuelve a los de fábrica', () => {
  settings.set({ animations: 'inventada', aula: true });
  assert.equal(settings.get().animations, 'full');
  assert.equal(settings.get().aula, true);
  settings.reset();
  assert.deepEqual(settings.get(), DEFAULTS);
});
