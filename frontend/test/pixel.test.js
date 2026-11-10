/** Atlas de pixel art, tablero con sprites del atlas (y respaldo SVG) y pantalla de campañas. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp } from '../../backend/src/app.js';
import { loadConfig } from '../../backend/src/config.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, location: dom.window.location });

const img = (name) => new URL(`../public/img/${name}`, import.meta.url);
const pngSize = (name) => { const b = readFileSync(img(name)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const loadSheets = () => Object.fromEntries([32, 16].map((t) => {
  const meta = JSON.parse(readFileSync(img(`atlas-${t}.json`), 'utf8'));
  return [t, { tile: t, meta: meta.sprites, url: `url("img/${meta.image}")`, ...pngSize(meta.image) }];
}));

const { atlas, slotOf, tileFor, unitSpec, fxSpec } = await import('../public/js/atlas.js');
const { createBoard } = await import('../public/js/board.js');

test('el atlas tiene todas las unidades, orientaciones y estados, dentro de los límites de la imagen', () => {
  const sheets = loadSheets();
  const states = { normal: 1, damaged: 1, smoking: 3, explosion: 3, sunk: 2 };
  for (const t of [32, 16]) {
    const sh = sheets[t];
    for (const biome of ['water', 'pirate', 'land', 'jungle']) {
      for (const slot of ['2', '3a', '3b', '4', '5', '6', '7']) {
        const len = slot === '3a' || slot === '3b' ? 3 : Number(slot);
        for (const orient of ['h', 'v']) {
          for (const [state, frames] of Object.entries(states)) {
            const s = sh.meta[`${biome}/${slot}/${orient}/${state}`];
            assert.ok(s, `${t}px ${biome}/${slot}/${orient}/${state}`);
            assert.equal(s.frames, frames);
            assert.equal(orient === 'h' ? s.w : s.h, t * len, 'ancho/alto = tamaño de casilla × largo');
            assert.equal(orient === 'h' ? s.h : s.w, t);
            assert.ok(s.x + s.w * s.frames <= sh.w && s.y + s.h <= sh.h, 'cabe en el atlas');
          }
        }
      }
    }
    for (const fx of ['projectile', 'splash', 'dust', 'leaves', 'impact', 'boom', 'fire', 'smoke', 'rippleMark', 'craterMark', 'bushMark', 'aim']) assert.ok(sh.meta[`fx/${fx}`], fx);
  }
  assert.deepEqual([pngSize('aim.png')], [{ w: 32, h: 32 }]);
});

test('ranura y tamaño de sprite', () => {
  assert.equal(slotOf(5, '5-0'), '5');
  assert.equal(slotOf(3, '3-0'), '3a');
  assert.equal(slotOf(3, '3-1'), '3b');
  assert.equal(slotOf(3, '3-2'), '3a');
  assert.equal(tileFor(40), 32);
  assert.equal(tileFor(16), 16);
  assert.equal(tileFor(0), 32, 'sin medida (jsdom) usa 32');
});

const ships = (state = 'normal') => [{ id: '3-0', length: 3, cells: [0, 1, 2], sunk: state === 'sunk', state }];

test('con atlas: la unidad es un sprite del atlas con su estado, y la marca de disparo es un efecto animado', () => {
  Object.assign(atlas, { ok: true, sheets: loadSheets() });
  const box = document.createElement('div'); document.body.append(box);
  const b = createBoard(box, 8, { biome: 'jungle' });
  assert.ok(box.classList.contains('px'));
  assert.ok(box.querySelector('.terrain'), 'capa de terreno animado');
  const shots = new Array(64).fill(0); shots[1] = 2; shots[20] = 1;
  b.paint({ shots, ships: ships('smoking') });
  const unit = box.querySelector('.sprite.px');
  assert.ok(unit, 'sprite del atlas');
  assert.match(unit.style.backgroundImage, /atlas-32\.png/);
  assert.equal(box.querySelectorAll('.mark.px').length, 2);
  assert.ok(box.querySelector('.mark.hit.px') && box.querySelector('.mark.miss.px'));
  assert.equal(unit.style.gridColumn.replace(/\s/g, ''), '1/span3');
  b.paint({ shots, ships: ships('sunk') });
  assert.ok(box.querySelector('.sprite.dead'));
  box.remove();
});

test('mientras el disparo está en vuelo (hold) no se ve la marca ni el estado nuevo', () => {
  Object.assign(atlas, { ok: true, sheets: loadSheets() });
  const box = document.createElement('div'); document.body.append(box);
  const b = createBoard(box, 8, { biome: 'water' });
  const shots = new Array(64).fill(0); shots[1] = 3;
  b.paint({ shots, ships: ships('sunk'), hold: { index: 1, ships: { '3-0': null } } });
  assert.equal(box.querySelectorAll('.mark').length, 0, 'sin marca');
  assert.equal(box.querySelectorAll('.sprite').length, 0, 'la unidad hundida aún no se revela');
  b.paint({ shots, ships: ships('sunk'), hold: { index: null, ships: { '3-0': 'explosion' } } });
  assert.equal(box.querySelectorAll('.sprite').length, 1, 'en explosión');
  b.paint({ shots, ships: ships('sunk') });
  assert.equal(box.querySelectorAll('.sprite.dead').length, 1);
  box.remove();
});

test('sin atlas el tablero sigue funcionando con los sprites SVG', () => {
  Object.assign(atlas, { ok: false, sheets: {} });
  const box = document.createElement('div'); document.body.append(box);
  const b = createBoard(box, 8, { biome: 'land' });
  assert.ok(!box.classList.contains('px'));
  const shots = new Array(64).fill(0); shots[1] = 2;
  b.paint({ shots, ships: ships('damaged') });
  const unit = box.querySelector('.sprite');
  assert.ok(unit && !unit.classList.contains('px'));
  assert.match(unit.style.getPropertyValue('--img'), /svg/);
  assert.equal(box.querySelectorAll('.mark.hit').length, 1);
  box.remove();
});

// ------------------------------------------------------------------ campañas
test('pantalla de campañas: lista, misiones bloqueadas para invitados, ficha y envío de la misión', async () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  config.aiWorkers = 0; config.guestAiDaily = 3;
  const srv = await createApp({ config, bcryptRounds: 4 });
  await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts) => realFetch(String(url).startsWith('/') ? base + url : url, opts);
  try {
    const { Campaigns } = await import('../public/js/campaigns.js');
    const started = []; const shown = [];
    const lobby = { signedIn: false, startMission: (c, m) => { started.push([c, m]); return true; } };
    const camps = new Campaigns({ lobby, show: (n) => { shown.push(n); document.querySelector('#screen-campaign').hidden = n !== 'campaign'; } });
    await camps.init();
    camps.open();
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(shown, ['campaign']);
    const cards = [...document.querySelectorAll('#camp-body .camp-card')]; // la pantalla de campañas; la pestaña del inicio (#camp-tab-list) repite la lista
    assert.equal(cards.length, 4);
    assert.equal(document.querySelectorAll('#camp-tab-list .camp-card').length, 4, 'la pestaña Campañas del inicio también lista las 4');
    assert.match(document.querySelector('#camp-quota').textContent, /3 de 3/);
    assert.ok(cards.some((c) => c.textContent.includes('ficción')));

    cards.find((c) => c.textContent.includes('Guerra del Chaco')).click();
    const rows = [...document.querySelectorAll('.mission-row')];
    assert.equal(rows.length, 6);
    assert.equal(rows.filter((r) => !r.classList.contains('locked')).length, 1, 'invitado: solo la primera');
    assert.match(rows[1].textContent, /Requiere cuenta/);

    rows[0].querySelector('button').click();
    assert.match(document.querySelector('#md-title').textContent, /Boquerón/);
    assert.equal(document.querySelectorAll('#md-objs li').length, 3);
    assert.match(document.querySelector('#md-note').textContent, /no se guardará/);
    document.querySelector('#md-start').click();
    assert.deepEqual(started, [['chaco', 1]]);

    camps.lobby = { ...lobby, signedIn: true };
    camps.progress = { missions: [{ campaignId: 'chaco', missionId: 1, stars: 2, bestShots: 30 }], achievements: [{ id: 'first_mission' }], totalStars: 2, totalAchievements: 20 };
    camps.render();
    const after = [...document.querySelectorAll('.mission-row')];
    assert.equal(after.filter((r) => !r.classList.contains('locked')).length, 2, 'con cuenta: la 1 y la 2 (ganada la 1)');
    assert.equal(after[0].querySelectorAll('.stars .on').length, 2);

    document.querySelector('#btn-achievements').click();
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    globalThis.fetch = realFetch;
    await srv.close();
  }
});
