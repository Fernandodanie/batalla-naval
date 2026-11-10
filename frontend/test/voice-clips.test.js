/** Audios grabados de la narración: lista, reproducción, respaldo a la voz del navegador y coherencia con el generador. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { STORIES } from '../../backend/src/content/index.js';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage });
const { clipId, loadClips, onSpeech, speak, speakable, stopSpeaking, voiceAvailable } = await import('../public/js/voice.js');
const { settings } = await import('../public/js/settings.js');
const { collectTexts } = await import('../../tools/voz/textos.mjs');
const { militaryText } = await import('../public/js/military-voice.js');

class FakeAudio {
  static made = [];
  constructor(src) { this.src = src; this.paused = true; FakeAudio.made.push(this); }
  play() { this.paused = false; this.onplaying?.(); return Promise.resolve(); }
  pause() { this.paused = true; }
}
const spoken = [];
const synth = () => {
  globalThis.speechSynthesis = { getVoices: () => [], cancel() {}, speak: (u) => spoken.push(u) };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
};
const noSynth = () => { delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; };
const listOf = (ids) => async () => ({ ok: true, json: async () => ({ clips: ids }) });

test('clipId es estable, corto y distinto para cada texto', () => {
  assert.equal(clipId('Hola'), clipId('Hola'));
  assert.notEqual(clipId('Hola'), clipId('Hola.'));
  assert.match(clipId('Soldado, a sus puestos.'), /^[a-z0-9]{6,14}$/);
});

test('loadClips: sin lista o con una lista rota no falla y todo sigue con la voz del navegador', async () => {
  noSynth();
  assert.equal(await loadClips(async () => ({ ok: false })), 0);
  assert.equal(await loadClips(async () => { throw new Error('sin red'); }), 0);
  assert.equal(await loadClips(async () => ({ ok: true, json: async () => ({ clips: 'no' }) })), 0);
  assert.equal(await loadClips(listOf(['ok1', '../mal', 7, 'ok2'])), 2, 'solo ids válidos (nada de rutas)');
  assert.equal(voiceAvailable(), true, 'con audios hay voz aunque el navegador no tenga síntesis');
  await loadClips(listOf([]));
  assert.equal(voiceAvailable(), false);
});

test('un texto con audio suena desde su .mp3 y avisa cuándo empieza y termina', async () => {
  noSynth(); settings.set({ voice: true });
  globalThis.Audio = FakeAudio;
  const text = 'Soldado, a sus puestos.';
  await loadClips(listOf([clipId(text)]));
  const seen = [];
  const off = onSpeech((v) => seen.push(v));
  assert.equal(speak(text), true);
  const a = FakeAudio.made.at(-1);
  assert.equal(a.src, `audio/voz/${clipId(text)}.mp3`);
  assert.equal(a.paused, false);
  a.onended();
  assert.deepEqual(seen, [true, false]);
  off();
});

test('stopSpeaking corta el audio y una lectura nueva reemplaza a la anterior', async () => {
  noSynth(); settings.set({ voice: true });
  globalThis.Audio = FakeAudio;
  await loadClips(listOf([clipId('Uno'), clipId('Dos')]));
  speak('Uno');
  const a = FakeAudio.made.at(-1);
  speak('Dos');
  assert.equal(a.paused, true, 'el primero se detiene');
  const b = FakeAudio.made.at(-1);
  assert.equal(b.paused, false);
  a.onended?.(); // el fin tardío del primero no apaga el segundo
  stopSpeaking();
  assert.equal(b.paused, true);
});

test('si el audio falla, se lee con la voz del navegador; un texto sin audio también', async () => {
  synth(); settings.set({ voice: true });
  spoken.length = 0;
  globalThis.Audio = class extends FakeAudio { play() { return Promise.reject(new Error('sin permiso')); } };
  await loadClips(listOf([clipId('Con audio')]));
  assert.equal(speak('Con audio'), true);
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(spoken.map((u) => u.text), ['Con audio'], 'cayó a la síntesis');
  speak('Sin audio');
  assert.deepEqual(spoken.map((u) => u.text), ['Con audio', 'Sin audio']);
  delete globalThis.Audio; noSynth();
  await loadClips(listOf([]));
});

test('el generador cubre las escenas de apertura y las frases de partida de todas las misiones', () => {
  const texts = collectTexts();
  const ids = new Set(texts.map((t) => t.id));
  let esperados = 0;
  for (const missions of Object.values(STORIES)) {
    for (const s of Object.values(missions)) {
      for (const [i, t] of s.intro.entries()) { esperados += 1; assert.ok(ids.has(clipId(speakable(militaryText(t, `intro${Math.min(i, 1)}`))))); }
      for (const [event, t] of Object.entries(s.events)) { esperados += 1; assert.ok(ids.has(clipId(speakable(militaryText(t, event)))), `falta el audio del evento ${event}`); }
    }
  }
  assert.ok(texts.length > 100 && texts.length <= esperados);
  assert.equal(new Set(texts.map((t) => t.id)).size, texts.length, 'ids sin repetir');
});

test('si ya se generaron los audios, index.json y los .mp3 coinciden con los textos actuales', () => {
  const dir = new URL('../public/audio/voz/', import.meta.url);
  if (!existsSync(new URL('index.json', dir))) return; // aún no se han generado: el juego usa la voz del navegador
  const { clips } = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
  const files = readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  assert.deepEqual([...clips].sort(), files, 'cada id de index.json tiene su .mp3 y viceversa');
});
