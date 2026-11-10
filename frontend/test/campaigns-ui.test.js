/** Ficha de misión (contexto, modo aula), galería de láminas y ausencia de textos «null»/«undefined» en pantalla. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp } from '../../backend/src/app.js';
import { loadConfig } from '../../backend/src/config.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, location: dom.window.location, localStorage: dom.window.localStorage });
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const noStray = (where, text) => assert.ok(!/\bnull\b|\bundefined\b|\[object/.test(text), `${where}: aparece texto suelto «${text.match(/null|undefined|\[object[^\]]*\]/)?.[0]}»`);

let srv; let restore; let camps; const started = [];
before(async () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  config.aiWorkers = 0; config.guestAiDaily = 3;
  srv = await createApp({ config, bcryptRounds: 4 });
  await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  const realFetch = globalThis.fetch;
  restore = () => { globalThis.fetch = realFetch; };
  globalThis.fetch = (url, opts) => {
    if (String(url) === '/api/progress') {
      return Promise.resolve(new Response(JSON.stringify({ missions: [{ campaignId: 'chaco', missionId: 1, stars: 3, bestShots: 25 }, { campaignId: 'siglo19', missionId: 2, stars: 1, bestShots: 50 }],
        achievements: [], laminas: [{ id: 'chaco-1' }, { id: 'siglo19-2' }], totalStars: 4, totalAchievements: 32 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    return realFetch(String(url).startsWith('/') ? base + url : url, opts);
  };
  const { Campaigns } = await import('../public/js/campaigns.js');
  const lobby = { signedIn: false, startMission: (c, m) => { started.push([c, m]); return true; } };
  camps = new Campaigns({ lobby, show: (n) => { $('#screen-campaign').hidden = n !== 'campaign'; } });
  await camps.init();
});
after(async () => { restore(); await srv.close(); });

const openMission = (campaignTitle, n = 0) => {
  $$('.camp-card').find((c) => c.textContent.includes(campaignTitle)).click();
  $$('.mission-row')[n].querySelector('button').click();
};

test('la lista de campañas, la de misiones y la ficha no muestran «null» ni «undefined»', () => {
  camps.open();
  noStray('campañas', $('#camp-body').textContent);
  for (const t of ['Guerra del Chaco', 'Armas de la República', 'Patente de corso', 'Operación Litoral']) {
    camps.view = null; camps.render();
    openMission(t);
    noStray(`misiones de ${t}`, $('#camp-body').textContent);
    noStray(`ficha de ${t}`, $('#mission-dialog').textContent);
  }
});

test('la ficha de una misión real muestra resultado histórico, contexto con fuentes y avisa si es reinterpretación', () => {
  camps.view = null; camps.render();
  openMission('Guerra del Chaco', 0); // Boquerón
  assert.match($('#md-real').textContent, /victoria paraguaya/i);
  assert.equal($('#md-real').hidden, false);
  assert.ok($$('#md-tags .tag.twist').length === 1, 'Boquerón es una reinterpretación');
  assert.equal($('#md-context').hidden, false);
  assert.ok($$('#md-context-body a[href^="https://"]').length >= 2);
  assert.match($('#md-note').textContent, /revisión/);
  assert.equal($('#md-story').hidden, true, 'sin modo aula no hay lectura guiada');
  assert.equal($('#md-briefing').hidden, false);

  camps.view = null; camps.render();
  openMission('Guerra del Chaco', 0);
  $('#md-cancel').click();
});

test('una misión de ficción no muestra resultado histórico ni pide revisión', () => {
  camps.view = null; camps.render();
  openMission('Patente de corso', 0);
  assert.equal($('#md-real').hidden, true);
  assert.ok(!/revisión/.test($('#md-note').textContent));
  assert.equal($$('#md-tags .tag.fiction').length, 1);
  assert.equal($$('#md-tags .tag.twist').length, 0);
});

test('modo aula: lectura por escenas y «Comenzar» solo se habilita en la última', async () => {
  const { settings } = await import('../public/js/settings.js');
  settings.set({ aula: true });
  camps.view = null; camps.render();
  openMission('Guerra del Chaco', 0);
  assert.equal($('#md-story').hidden, false);
  assert.equal($('#md-briefing').hidden, true);
  assert.match($('#md-page').textContent, /Escena 1 de 2/);
  assert.equal($('#md-start').disabled, true);
  assert.equal($('#md-next').hidden, false);
  $('#md-next').click();
  assert.match($('#md-page').textContent, /Escena 2 de 2/);
  assert.equal($('#md-start').disabled, false);
  assert.equal($('#md-next').hidden, true);
  $('#md-start').click();
  assert.deepEqual(started.at(-1), ['chaco', 1]);

  settings.set({ aula: false });
  camps.view = null; camps.render();
  openMission('Guerra del Chaco', 0);
  assert.equal($('#md-story').hidden, true);
  assert.equal($('#md-start').disabled, false);
});

test('galería para invitados: 20 láminas en silueta, sin revelar títulos ni misiones ocultas', async () => {
  await camps.openGallery();
  assert.equal($$('.gal-item').length, 20);
  assert.equal($$('.gal-item.locked').length, 20);
  assert.match($('#gal-sum').textContent, /Inicia sesión/);
  assert.ok($$('.gal-item strong').every((s) => s.textContent === '???'), 'una lámina bloqueada no muestra su título');
  noStray('galería', $('#gallery-dialog').textContent);
  assert.ok($$('.gal-item.locked').every((i) => i.tagName === 'DIV'), 'no se puede abrir una lámina bloqueada');
});

test('galería con cuenta: las ganadas se distinguen de las bloqueadas y se pueden abrir', async () => {
  camps.lobby.signedIn = true;
  await camps.openGallery();
  assert.equal($$('.gal-item').length, 20);
  assert.equal($$('.gal-item:not(.locked)').length, 2);
  assert.match($('#gal-sum').textContent, /2 de 20/);
  const won = $$('.gal-item:not(.locked)');
  assert.ok(won.every((i) => !i.querySelector('.lam-thumb.gold') && !/dorada/.test(i.textContent)), 'ya no hay versión base y dorada: todas son iguales');
  const first = won.find((i) => /Boquerón/.test(i.textContent));
  assert.ok(first, 'la misión 1 del Chaco está ganada');
  assert.match(first.textContent, /Ganada/);
  assert.match(won.find((i) => /Ingavi/.test(i.textContent)).textContent, /Ganada/);
  assert.ok($$('.gal-item.locked small').some((s) => /Gana «/.test(s.textContent)), 'dice qué misión la desbloquea');
  assert.equal(first.querySelector('img').getAttribute('src'), 'img/laminas-hd/min/chaco-1.webp', 'la galería usa la miniatura liviana');
  assert.ok($$('.gal-item img').every((i) => /^img\/laminas-hd\/min\/.+\.webp$/.test(i.getAttribute('src'))), 'también las bloqueadas (silueta) usan la miniatura');

  first.click(); // abre el visor (jsdom no dibuja canvas; se comprueban título, nota y botones)
  assert.equal($('#lamina-dialog').hasAttribute('open'), true);
  assert.match($('#lam-title').textContent, /Fortín Boquerón/);
  assert.doesNotMatch($('#lam-note').textContent, /dorada/);
  assert.equal(typeof $('#lam-download').onclick, 'function');
  noStray('visor', $('#lamina-dialog').textContent);
  camps.lobby.signedIn = false;
});
