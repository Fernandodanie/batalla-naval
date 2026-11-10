/** Música: qué pista suena en cada pantalla, fundidos, silencio, ajustes y espera del primer toque (con un AudioContext simulado). */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage });
const { MusicDirector, TRACKS, SCREEN_TRACK, DUCK, trackGain } = await import('../public/js/music.js');
const { settings } = await import('../public/js/settings.js');
const { sound } = await import('../public/js/sound.js');

const param = () => ({ value: 1, ramps: [], setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v, t) { this.ramps.push([v, t]); }, cancelScheduledValues() {}, setTargetAtTime(v) { this.target = v; } });
function fakeEnv({ running = true, failFetch = false } = {}) {
  const made = { sources: [], gains: [], fetched: [], created: 0 };
  class Ctx {
    constructor() { made.created += 1; this.state = running ? 'running' : 'suspended'; this.currentTime = 10; this.destination = {}; }
    createGain() { const g = { gain: param(), connect() {}, disconnect() {} }; made.gains.push(g); return g; }
    createBufferSource() { const s = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; }, loop: false }; made.sources.push(s); return s; }
    async decodeAudioData() { return { duration: 64 }; }
    async resume() { if (made.allowResume) this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
  }
  const fetch = async (src) => { made.fetched.push(src); if (failFetch) return { ok: false }; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  return { env: { AudioContext: Ctx, fetch }, made };
}
const tick = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const reset = () => { settings.reset(); if (sound.muted) sound.toggle(); };

test('cada pantalla tiene su pista y la entrada es la más fuerte', () => {
  assert.deepEqual({ ...SCREEN_TRACK }, { welcome: 'login', home: 'puerto', campaign: 'puerto', game: 'batalla' });
  assert.ok(TRACKS.login.gain >= 0.4, 'la entrada es fuerte');
  assert.ok(TRACKS.puerto.gain <= TRACKS.login.gain / 3, 'el ambiente es mucho más suave que la entrada');
  assert.ok(TRACKS.batalla.gain < TRACKS.puerto.gain, 'en partida, más suave todavía');
  assert.equal(trackGain('puerto', 70), TRACKS.puerto.gain);
  assert.equal(trackGain('puerto', 0), 0);
});

test('los archivos de música existen, son mp3 y pesan lo razonable', () => {
  for (const t of Object.values(TRACKS)) {
    const f = new URL(`../public/${t.src}`, import.meta.url);
    const size = statSync(f).size;
    assert.ok(size > 100_000 && size < 1_500_000, `${t.src}: ${size} bytes`);
    const head = readFileSync(f).subarray(0, 3);
    assert.ok(head.toString('latin1') === 'ID3' || head[0] === 0xff, `${t.src} no parece mp3`);
  }
});

test('entrada → inicio → partida: una pista a la vez, con fundido, y vuelve a sonar la anterior', async () => {
  reset();
  const { env, made } = fakeEnv();
  const m = new MusicDirector({ env });
  m.setScreen('welcome'); await tick(20);
  assert.equal(m.state.track, 'login');
  assert.equal(made.sources.length, 1);
  assert.equal(made.sources[0].loop, true);
  assert.ok(Math.abs(made.gains[1].gain.ramps.at(-1)[0] - 0.5 * (70 / 70)) < 1e-9, 'la entrada llega a su volumen fuerte');
  m.setScreen('home'); await tick(20);
  assert.equal(m.state.track, 'puerto');
  assert.equal(made.sources[0].stopped, true, 'la entrada se apaga con fundido');
  assert.ok(Math.abs(made.gains[2].gain.ramps.at(-1)[0] - TRACKS.puerto.gain) < 1e-9, 'el inicio suena suave');
  m.setScreen('campaign'); await tick(20);
  assert.equal(made.sources.length, 2, 'inicio → campañas es la misma pista: no se reinicia');
  m.setScreen('game'); await tick(20);
  assert.equal(m.state.track, 'batalla');
  assert.equal(made.sources.length, 3);
  m.setScreen('home'); await tick(20);
  assert.equal(m.state.track, 'puerto');
  assert.equal(made.fetched.filter((s) => s === TRACKS.puerto.src).length, 1, 'cada archivo se descarga una sola vez');
});

test('silenciar (🔊), apagar la música o bajar el volumen a 0 la detienen; volver a activarla la reanuda', async () => {
  reset();
  const { env, made } = fakeEnv();
  const m = new MusicDirector({ env });
  m.setScreen('home'); await tick(20);
  assert.equal(m.state.track, 'puerto');
  sound.toggle(); m.sync();
  assert.equal(m.state.track, null);
  assert.equal(made.sources[0].stopped, true);
  sound.toggle(); m.sync(); await tick(20);
  assert.equal(m.state.track, 'puerto');
  settings.set({ music: false }); m.sync();
  assert.equal(m.state.track, null);
  settings.set({ music: true, musicVolume: 0 }); m.sync();
  assert.equal(m.state.track, null);
  settings.set({ musicVolume: 35 }); m.sync(); await tick(20);
  assert.equal(m.state.track, 'puerto');
  reset();
});

test('el control de volumen cambia el nivel sin reiniciar la pista', async () => {
  reset();
  const { env, made } = fakeEnv();
  const m = new MusicDirector({ env });
  m.setScreen('game'); await tick(20);
  const before = made.sources.length;
  settings.set({ musicVolume: 35 }); m.sync();
  assert.equal(made.sources.length, before);
  const last = made.gains.at(-1).gain.ramps.at(-1)[0];
  assert.ok(Math.abs(last - TRACKS.batalla.gain / 2) < 1e-9);
  reset();
});

test('sin gesto previo espera el primer toque y recién entonces suena; en la entrada avisa para que lata el botón', async () => {
  reset();
  const { env, made } = fakeEnv({ running: false });
  const waits = [];
  const m = new MusicDirector({ env, onWait: (w) => waits.push(w) });
  m.setScreen('welcome'); await tick(400);
  assert.equal(m.state.track, null);
  assert.equal(waits.at(-1), true);
  made.allowResume = true;
  window.dispatchEvent(new window.Event('pointerdown'));
  await tick(50);
  assert.equal(m.state.track, 'login');
  assert.equal(waits.at(-1), false);
  // fuera de la entrada, espera en silencio (no hace latir el botón de la entrada)
  const w2 = [];
  const { env: env2 } = fakeEnv({ running: false });
  const m2 = new MusicDirector({ env: env2, onWait: (w) => w2.push(w) });
  m2.setScreen('home'); await tick(400);
  assert.equal(m2.state.track, null);
  assert.ok(!w2.includes(true));
  reset();
});

test('si el archivo no carga, no pasa nada (queda en silencio) y se puede reintentar', async () => {
  reset();
  const { env } = fakeEnv({ failFetch: true });
  const m = new MusicDirector({ env });
  m.setScreen('home'); await tick(30);
  assert.equal(m.state.track, null);
  m.setScreen('game'); await tick(30);
  assert.equal(m.state.track, null);
});

test('un cambio de pantalla rápido no deja sonar la pista vieja (arranques pendientes se descartan)', async () => {
  reset();
  const { env } = fakeEnv();
  const m = new MusicDirector({ env });
  m.setScreen('welcome'); m.setScreen('home'); m.setScreen('game');
  await tick(60);
  assert.equal(m.state.track, 'batalla');
});

test('duck baja y devuelve el volumen general; sin pista no falla', async () => {
  reset();
  const { env } = fakeEnv();
  const m = new MusicDirector({ env });
  m.duck(true); // aún sin contexto: no pasa nada
  m.setScreen('home'); await tick(20);
  m.duck(true);
  m.duck(false);
  assert.ok(DUCK > 0 && DUCK < 1);
});
