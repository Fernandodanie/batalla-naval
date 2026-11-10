/** Service worker: qué guarda, qué no, y que el listado de archivos esté completo. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const pub = new URL('../public/', import.meta.url);
const code = readFileSync(new URL('sw.js', pub), 'utf8');
const ORIGIN = 'https://juego.example';

/** Entorno mínimo de un service worker: caché en memoria, fetch simulado y los eventos registrados. */
function boot({ online = true } = {}) {
  const handlers = {};
  const stores = new Map();
  const fetched = [];
  const makeCache = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    const key = (r) => (typeof r === 'string' ? new URL(r, `${ORIGIN}/`).href : r.url);
    return {
      match: async (r) => m.get(key(r)), put: async (r, res) => { m.set(key(r), res); }, delete: async (r) => m.delete(key(r)),
      add: async (r) => { const res = await ctx.fetch(new URL(r, `${ORIGIN}/`).href); if (!res.ok) throw new Error(`${res.status}`); m.set(key(r), res); },
    };
  };
  const ctx = {
    __SW_TEST__: {}, URL, Promise, Response: globalThis.Response,
    self: { location: { origin: ORIGIN }, addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async (n) => makeCache(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) },
    state: { online, missing: new Set() },
    fetch: async (url) => {
      const href = typeof url === 'string' ? url : url.url;
      fetched.push(href);
      if (!ctx.state.online) throw new TypeError('network');
      if (ctx.state.missing.has(new URL(href).pathname)) return new Response('no', { status: 404 });
      return new Response(`contenido de ${href}`, { status: 200 });
    },
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(code, ctx);
  const dispatch = async (type, extra = {}) => {
    let p; const event = { waitUntil: (x) => { p = x; }, respondWith: (x) => { p = x; }, ...extra };
    handlers[type](event);
    return { responded: p !== undefined, value: p ? await p : undefined };
  };
  return { ctx, handlers, stores, fetched, dispatch, sw: ctx.__SW_TEST__ };
}

const walk = (dir, base = '') => readdirSync(new URL(dir, pub)).flatMap((f) => {
  const rel = `${base}${f}`;
  return statSync(new URL(`${dir}${f}`, pub)).isDirectory() ? walk(`${dir}${f}/`, `${rel}/`).map((x) => x) : [rel];
});

test('SHELL incluye todo el código, las fuentes y las imágenes de la interfaz, y nada que no exista', () => {
  const sw = { ...boot().sw }; sw.SHELL = Array.from(sw.SHELL); // los datos vienen de otro contexto (vm)
  const need = [
    ...walk('js/').filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...walk('fonts/').filter((f) => f.endsWith('.woff2')).map((f) => `fonts/${f}`),
    ...walk('img/').filter((f) => /^(atlas-\d+\.(png|json)|aim\.png|tile-.*\.png|icon-.*\.png|narrador-.*\.png)$/.test(f)).map((f) => `img/${f}`),
    'index.html', 'manifest.webmanifest', ...walk('css/').filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
  ];
  const missing = need.filter((f) => !sw.SHELL.includes(f));
  assert.deepEqual(missing, [], `faltan en SHELL (agrégalos a frontend/public/sw.js y sube VERSION): ${missing.join(', ')}`);
  const ghost = sw.SHELL.filter((f) => f !== './' && !need.includes(f));
  assert.deepEqual(ghost, [], 'SHELL lista archivos que no existen o que no corresponden');
  assert.equal(new Set(sw.SHELL).size, sw.SHELL.length, 'sin repetidos');
});

test('el manifiesto es válido y sus íconos existen', () => {
  const m = JSON.parse(readFileSync(new URL('manifest.webmanifest', pub), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.start_url && m.theme_color && m.background_color);
  for (const i of m.icons) assert.ok(statSync(new URL(i.src, pub)).size > 500, i.src);
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  assert.ok(m.icons.some((i) => i.sizes === '192x192'));
  const html = readFileSync(new URL('index.html', pub), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
});

test('estrategias: qué se guarda y qué NO (cuentas, WebSocket, POST, otros orígenes)', () => {
  const { sw } = boot();
  const s = (path, method = 'GET', mode = 'no-cors', origin = ORIGIN) => sw.strategyFor(`${origin}${path}`, method, mode, ORIGIN);
  assert.equal(s('/api/campaigns'), 'api-cache');
  for (const p of ['/api/progress', '/api/auth/login', '/api/quiz', '/api/me', '/ws', '/healthz', '/metrics']) assert.equal(s(p), 'network-only', p);
  assert.equal(s('/api/campaigns', 'POST'), 'network-only');
  assert.equal(s('/js/main.js', 'POST'), 'network-only');
  assert.equal(s('/js/main.js', 'GET', 'no-cors', 'https://otro.example'), 'network-only');
  assert.equal(s('/js/main.js'), 'code', 'el JS va red primero: si no, una versión vieja en caché se mezcla con el HTML nuevo');
  assert.equal(s('/css/style.css'), 'code');
  assert.equal(s('/fonts/bricolage.woff2'), 'static');
  assert.equal(s('/img/laminas-hd/chaco-1.png'), 'static');
  assert.equal(s('/img/laminas-hd/min/chaco-1.webp'), 'static');
  assert.equal(s('/video/login/naval.mp4'), 'network-only', 'el video llega por rangos (206) y la Cache API no los guarda');
  assert.equal(s('/audio/voz/1bni519sap9.mp3'), 'network-only', 'la voz grabada llega por rangos (206) como el video');
  assert.equal(s('/audio/voz/index.json'), 'api-cache', 'la lista de audios: red primero, con copia por si no hay conexión');
  assert.equal(s('/audio/tambores-guerra.mp3'), 'static', 'la música sigue como antes');
  assert.equal(s('/video/login/naval.jpg'), 'static', 'el fotograma fijo sí se guarda');
  assert.equal(s('/', 'GET', 'navigate'), 'navigate');
  assert.equal(s('/sala/ABCD', 'GET', 'navigate'), 'navigate');
});

test('instalación: guarda la interfaz aunque un archivo falle (404)', async () => {
  const t = boot();
  t.ctx.state.missing.add('/img/aim.png');
  await t.dispatch('install');
  const cache = [...t.stores.entries()].find(([n]) => n.endsWith('-shell'))[1];
  assert.equal(cache.size, t.sw.SHELL.length - 1, 'todos menos el que falló');
  assert.ok([...cache.keys()].some((k) => k.endsWith('/js/main.js')));
});

test('activación: borra cachés de versiones anteriores y conserva las actuales', async () => {
  const t = boot();
  await t.ctx.caches.open('bn-0.1.0-shell'); await t.ctx.caches.open(`${t.sw.VERSION}-shell`); await t.ctx.caches.open(`${t.sw.VERSION}-api`);
  await t.dispatch('activate');
  assert.deepEqual([...t.stores.keys()].sort(), [`${t.sw.VERSION}-api`, `${t.sw.VERSION}-shell`]);
});

test('catálogo: con red lo trae y lo guarda; sin red usa la última copia; sin copia falla', async () => {
  const t = boot();
  const req = (path, extra = {}) => ({ url: `${ORIGIN}${path}`, method: 'GET', mode: 'cors', ...extra });
  const r1 = await t.dispatch('fetch', { request: req('/api/campaigns') });
  assert.equal(await r1.value.text(), `contenido de ${ORIGIN}/api/campaigns`);
  t.ctx.state.online = false;
  const r2 = await t.dispatch('fetch', { request: req('/api/campaigns') });
  assert.match(await r2.value.text(), /api\/campaigns/, 'sin conexión sirve la copia guardada');
  const t2 = boot({ online: false });
  await assert.rejects(t2.dispatch('fetch', { request: req('/api/campaigns') }), /network/);
});

test('cuentas y partidas nunca se guardan ni se interceptan', async () => {
  const t = boot();
  for (const [path, method] of [['/api/progress', 'GET'], ['/api/quiz', 'POST'], ['/api/auth/login', 'POST'], ['/ws', 'GET']]) {
    const r = await t.dispatch('fetch', { request: { url: `${ORIGIN}${path}`, method, mode: 'cors' } });
    assert.equal(r.responded, false, `${method} ${path} no debe pasar por el service worker`);
  }
  assert.equal([...t.stores.values()].reduce((a, m) => a + m.size, 0), 0, 'no se guardó nada');
});

test('navegación sin conexión: abre la interfaz guardada; estáticos: primero la copia', async () => {
  const t = boot();
  await t.dispatch('install');
  t.ctx.state.online = true;
  await t.dispatch('fetch', { request: { url: `${ORIGIN}/`, method: 'GET', mode: 'navigate' } }); // guarda index.html
  t.ctx.state.online = false;
  const nav = await t.dispatch('fetch', { request: { url: `${ORIGIN}/sala/XYZ`, method: 'GET', mode: 'navigate' } });
  assert.equal(await nav.value.text(), `contenido de ${ORIGIN}/`, 'cualquier ruta abre la interfaz guardada (la página principal)');
  const js = await t.dispatch('fetch', { request: { url: `${ORIGIN}/js/main.js`, method: 'GET', mode: 'no-cors' } });
  assert.match(await js.value.text(), /js\/main\.js/, 'un archivo guardado se sirve sin red');
});
