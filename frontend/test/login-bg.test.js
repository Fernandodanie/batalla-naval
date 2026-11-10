/** Fondo de video de la entrada: reglas puras, archivos, rotación con fundido y casos de respaldo (sin animar, autoplay bloqueado, video roto). */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { afterEach, mock, test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="login-bg"></div></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage, Element: dom.window.Element });
const bg = await import('../public/js/login-bg.js');

const pub = new URL('../public/', import.meta.url);
const flush = () => new Promise((resolve) => setImmediate(resolve)); // deja correr las promesas pendientes (los timers simulados no lo afectan)

/** jsdom no reproduce video: se simula play/pause/load y se cuenta lo que pasa. */
function stubMedia({ playFails = false } = {}) {
  const calls = { play: 0, pause: 0, load: 0 };
  const proto = dom.window.HTMLMediaElement.prototype;
  proto.play = function play() { calls.play += 1; return playFails ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); };
  proto.pause = function pause() { calls.pause += 1; };
  proto.load = function load() { calls.load += 1; };
  return calls;
}
const created = [];
afterEach(() => { // pase lo que pase en una prueba, no deja timers vivos (un timer suelto mantiene el proceso abierto)
  for (const b of created.splice(0)) b.setActive(false);
  mock.timers.reset();
});
const fresh = (animate = () => true) => {
  const root = document.createElement('div');
  document.body.append(root);
  const backdrop = new bg.LoginBackdrop(root, { animate });
  created.push(backdrop);
  return { root, backdrop, videos: () => [...root.querySelectorAll('video')] };
};
const on = (v) => v.classList.contains('on');

// ------------------------------------------------------------------ reglas puras
test('shouldAnimate: se apaga con movimiento reducido, ahorro de datos, 2G o «Sin animaciones»', () => {
  assert.equal(bg.shouldAnimate(), true);
  assert.equal(bg.shouldAnimate({ effectiveType: '4g' }), true);
  assert.equal(bg.shouldAnimate({ reducedMotion: true }), false);
  assert.equal(bg.shouldAnimate({ saveData: true }), false);
  assert.equal(bg.shouldAnimate({ animationsOff: true }), false);
  for (const t of ['2g', 'slow-2g']) assert.equal(bg.shouldAnimate({ effectiveType: t }), false, t);
  assert.equal(bg.shouldAnimate({ effectiveType: '3g' }), true);
});

test('nextIndex: da la vuelta, salta los rotos y avisa si no queda otro', () => {
  assert.equal(bg.nextIndex(0, new Set(), 3), 1);
  assert.equal(bg.nextIndex(2, new Set(), 3), 0, 'después del último vuelve al primero');
  assert.equal(bg.nextIndex(0, new Set([1]), 3), 2, 'salta el roto');
  assert.equal(bg.nextIndex(0, new Set([1, 2]), 3), -1, 'solo queda el actual');
  assert.equal(bg.nextIndex(0, new Set(), 1), -1);
});

test('msUntilNext: lo que falta del clip menos el fundido; sin duración conocida asume ~3 s; nunca negativo', () => {
  assert.equal(bg.msUntilNext(3, 0, 900), 2100);
  assert.equal(bg.msUntilNext(3, 1, 900), 1100);
  assert.equal(bg.msUntilNext(NaN, 0, 900), 2100, 'sin metadatos todavía');
  assert.equal(bg.msUntilNext(3, 2.9, 900), 0, 'si ya casi termina, empieza el fundido de inmediato');
  assert.equal(bg.msUntilNext(3, NaN, 900), 2100);
});

// ------------------------------------------------------------------ archivos y consistencia con HTML/CSS
test('los clips existen, son livianos y hay una imagen fija de respaldo', () => {
  assert.equal(bg.CLIPS.length, 3);
  let total = 0;
  for (const c of bg.CLIPS) {
    const video = statSync(new URL(c.src, pub)).size;
    total += video;
    assert.ok(video > 50_000 && video < 600_000, `${c.src} pesa ${video} bytes`);
    assert.match(c.src, /\.mp4$/, 'mp4 (H.264): lo reproducen todos los navegadores');
  }
  assert.ok(total < 1_500_000, `los tres juntos pesan ${total} bytes`);
  assert.ok(statSync(new URL('video/login/naval.jpg', pub)).size > 5_000, 'la imagen fija que usa el CSS');
});

test('index.html trae el contenedor dentro de la entrada y el CSS usa el mismo fundido y la imagen de respaldo', () => {
  const html = readFileSync(new URL('index.html', pub), 'utf8');
  const welcome = html.slice(html.indexOf('id="screen-welcome"'), html.indexOf('id="screen-home"'));
  assert.match(welcome, /<div id="login-bg" class="login-bg" aria-hidden="true"><\/div>/, 'decorativo: oculto para lectores de pantalla');
  const css = readFileSync(new URL('css/style.css', pub), 'utf8');
  const seconds = String(bg.FADE_MS / 1000).replace(/^0/, '').replace('.', '\\.'); // 900 ms → «.9s»
  assert.match(css, new RegExp(`\\.login-clip \\{[^}]*transition: opacity ${seconds}s`), 'FADE_MS y la transición CSS deben coincidir');
  assert.match(css, /url\("\.\.\/video\/login\/naval\.jpg"\)/, 'imagen fija de respaldo');
  assert.doesNotMatch(readFileSync(new URL('js/login-bg.js', pub), 'utf8'), /\.innerHTML|setAttribute\(['"]style/, 'sin innerHTML ni estilos en línea (CSP)');
});

// ------------------------------------------------------------------ comportamiento
test('al mostrar la entrada: crea 3 videos mudos, baja solo el primero y lo muestra', async () => {
  const calls = stubMedia();
  const { backdrop, videos } = fresh();
  backdrop.setActive(true);
  const v = videos();
  assert.equal(v.length, 3);
  assert.deepEqual(v.map((x) => x.preload), ['auto', 'none', 'none'], 'solo el primero se descarga al inicio');
  assert.ok(v.every((x) => x.muted && x.hasAttribute('playsinline') && x.getAttribute('aria-hidden') === 'true'));
  assert.ok(v.every((x) => !x.hasAttribute('poster')), 'sin poster: no se descargan imágenes que nunca se verían');
  assert.deepEqual(v.map((x) => x.getAttribute('src')), bg.CLIPS.map((c) => c.src));
  await flush();
  assert.ok(on(v[0]) && v[0].classList.contains('front'), 'el primero ya se ve');
  assert.ok(!on(v[1]) && !on(v[2]));
  assert.deepEqual(v.map((x) => x.preload), ['auto', 'auto', 'auto'], 'con el primero sonando, se piden los otros');
  assert.ok(calls.play >= 1);
  backdrop.setActive(false);
});

test('rota 1 → 2 → 3 → 1 con fundido: el que entra se dibuja sobre el que sale y este se apaga después', async () => {
  stubMedia();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { backdrop, videos } = fresh();
    backdrop.setActive(true);
    await flush();
    const v = videos();
    assert.ok(on(v[0]));

    mock.timers.tick(2100); await flush(); // empieza el fundido hacia el 2.º
    assert.ok(on(v[0]) && on(v[1]), 'durante el fundido se ven los dos (sin hueco)');
    assert.ok(v[1].classList.contains('front') && !v[0].classList.contains('front'), 'el que entra va encima');
    mock.timers.tick(1000); await flush(); // termina el fundido
    assert.ok(!on(v[0]) && on(v[1]), 'el que salió se apaga');

    mock.timers.tick(2100); await flush();
    mock.timers.tick(1000); await flush();
    assert.ok(on(v[2]) && !on(v[1]));
    mock.timers.tick(2100); await flush();
    mock.timers.tick(1000); await flush();
    assert.ok(on(v[0]) && !on(v[2]), 'después del tercero vuelve al primero');
    backdrop.setActive(false);
  } finally { mock.timers.reset(); }
});

test('al salir de la entrada se pausa y se libera todo; al volver, empieza de nuevo', async () => {
  const calls = stubMedia();
  const { root, backdrop, videos } = fresh();
  backdrop.setActive(true); await flush();
  const pausesBefore = calls.pause;
  backdrop.setActive(false);
  assert.equal(videos().length, 0, 'los videos se quitan del DOM (no quedan decodificando en segundo plano)');
  assert.ok(calls.pause >= pausesBefore + 3);
  backdrop.setActive(true); await flush();
  assert.equal(videos().length, 3);
  assert.ok(on(videos()[0]));
  assert.equal(root.classList.contains('is-still'), false);
  backdrop.setActive(false);
});

test('sin animar (movimiento reducido, ahorro de datos…): no crea videos y deja la imagen fija', async () => {
  stubMedia();
  const { root, backdrop, videos } = fresh(() => false);
  backdrop.setActive(true); await flush();
  assert.equal(videos().length, 0);
  assert.ok(root.classList.contains('is-still'));
  backdrop.setActive(false);
});

test('refresh: al cambiar la preferencia con la entrada abierta, apaga o enciende el video', async () => {
  stubMedia();
  let animate = true;
  const { root, backdrop, videos } = fresh(() => animate);
  backdrop.setActive(true); await flush();
  assert.equal(videos().length, 3);
  animate = false; backdrop.refresh();
  assert.equal(videos().length, 0); assert.ok(root.classList.contains('is-still'));
  animate = true; backdrop.refresh(); await flush();
  assert.equal(videos().length, 3); assert.ok(!root.classList.contains('is-still'));
  backdrop.setActive(false);
});

test('autoplay bloqueado: no se rompe, queda la imagen fija y se reintenta con el primer toque', async () => {
  stubMedia({ playFails: true });
  const { backdrop, videos } = fresh();
  backdrop.setActive(true); await flush();
  assert.ok(videos().every((v) => !on(v)), 'ningún video visible: se ve la imagen fija de respaldo');
  stubMedia(); // el navegador ya permite reproducir
  window.dispatchEvent(new window.Event('pointerdown'));
  await flush();
  assert.ok(on(videos()[0]), 'tras el toque arranca');
  backdrop.setActive(false);
});

test('un video que falla se salta: la rotación sigue con los demás', async () => {
  stubMedia();
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { backdrop, videos } = fresh();
    backdrop.setActive(true); await flush();
    const v = videos();
    v[1].dispatchEvent(new window.Event('error')); // el 2.º no carga
    mock.timers.tick(2100); await flush();
    assert.ok(on(v[2]) && !on(v[1]), 'del 1.º pasa directo al 3.º');
    backdrop.setActive(false);
  } finally { mock.timers.reset(); }
});

test('si el primero falla al cargar, empieza por el siguiente', async () => {
  stubMedia();
  const { backdrop, videos } = fresh();
  backdrop.setActive(true);
  const v = videos();
  v[0].dispatchEvent(new window.Event('error'));
  await flush();
  assert.ok(on(v[1]) && !on(v[0]));
  backdrop.setActive(false);
});

test('un video que falla MIENTRAS carga no llega a mostrarse', async () => {
  stubMedia();
  const { backdrop, videos } = fresh();
  backdrop.setActive(true);
  const v = videos();
  v[0].dispatchEvent(new window.Event('error')); // falla con su play() todavía pendiente
  await flush();
  assert.ok(!on(v[0]), 'el roto no se muestra');
  assert.ok(on(v[1]));
});

test('si todos los demás fallan, el que queda se repite en lugar de congelarse', async () => {
  stubMedia();
  mock.timers.enable({ apis: ['setTimeout'] });
  const { backdrop, videos } = fresh();
  backdrop.setActive(true); await flush();
  const v = videos();
  v[1].dispatchEvent(new window.Event('error')); v[2].dispatchEvent(new window.Event('error'));
  mock.timers.tick(2100); await flush();
  assert.equal(v[0].loop, true);
  assert.ok(on(v[0]));
});
