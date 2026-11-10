/** La voz avisa cuándo empieza y termina de leer (la música baja mientras tanto). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
const utterances = [];
Object.assign(globalThis, {
  document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage,
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  speechSynthesis: { getVoices: () => [], cancel() {}, speak(u) { utterances.push(u); } },
});
const { onSpeech, speak, stopSpeaking } = await import('../public/js/voice.js');

test('avisa true al empezar y false al terminar', () => {
  const seen = [];
  const off = onSpeech((v) => seen.push(v));
  speak('Hola', { force: true });
  utterances.at(-1).onstart();
  utterances.at(-1).onend();
  assert.deepEqual(seen, [true, false]);
  off();
});

test('el fin tardío de una lectura cancelada no apaga la siguiente', () => {
  const seen = [];
  const off = onSpeech((v) => seen.push(v));
  speak('Uno', { force: true });
  const first = utterances.at(-1);
  first.onstart();
  speak('Dos', { force: true });
  const second = utterances.at(-1);
  first.onerror(); // el navegador avisa tarde de que la primera se canceló
  second.onstart();
  assert.deepEqual(seen, [true, true]);
  stopSpeaking();
  assert.deepEqual(seen, [true, true, false]);
  off();
});
