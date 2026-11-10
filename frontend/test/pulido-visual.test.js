import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
const pub = new URL('../public/', import.meta.url);
const text = (file) => readFileSync(new URL(file, pub), 'utf8');

test('el pulido visual se carga después del estilo existente, sin alterar JS', () => {
  const html = text('index.html');
  assert.ok(html.indexOf('css/style.css') < html.indexOf('css/pulido-visual.css'));
  const css = text('css/pulido-visual.css');
  for (const rule of ['.board.px', '.ship-chip', '.narrator', '.login-bg::after', 'max-width: 760px', 'prefers-reduced-motion'])
    assert.ok(css.includes(rule), `falta ${rule}`);
  assert.doesNotMatch(css, /#board-place\s*\{[^}]*pointer-events:\s*none/, 'no se desactiva la interacción del tablero');
});

test('16 tiles animados preservan PNG 32×32 y atlas originales siguen disponibles', () => {
  for (const biome of ['water', 'pirate', 'land', 'jungle']) for (let frame = 0; frame < 4; frame++) {
    const f = new URL(`img/tile-${biome}-${frame}.png`, pub);
    const b = readFileSync(f);
    assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(b.readUInt32BE(16), 32, `ancho ${biome}/${frame}`);
    assert.equal(b.readUInt32BE(20), 32, `alto ${biome}/${frame}`);
  }
  for (const tile of [16, 32]) {
    const meta = JSON.parse(text(`img/atlas-${tile}.json`));
    assert.ok(statSync(new URL(`img/atlas-${tile}.png`, pub)).size > 1000);
    assert.ok(meta.sprites && Object.keys(meta.sprites).length > 10);
  }
});

test('videos, música, narrador y recompensas originales siguen en el paquete', () => {
  for (const f of [
    'audio/tambores-guerra.mp3', 'audio/ambiente-puerto.mp3', 'audio/ambiente-batalla.mp3',
    'video/login/naval.mp4', 'video/login/artilleria.mp4', 'video/login/jungla.mp4',
    'js/military-voice.js', 'js/narrator.js', 'js/login-bg.js', 'js/placement.js',
    'img/laminas-hd/chaco-1.png', 'img/laminas-hd/corso-1.png',
  ]) assert.ok(statSync(new URL(f, pub)).size > 0, `falta ${f}`);
});
