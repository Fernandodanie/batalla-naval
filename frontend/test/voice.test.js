import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, localStorage: dom.window.localStorage });
const { pickVoice, speak, speakable, stopSpeaking, voiceAvailable } = await import('../public/js/voice.js');
const { settings } = await import('../public/js/settings.js');

const mockSynth = (voices) => {
  const log = { spoken: [], cancels: 0 };
  globalThis.speechSynthesis = { getVoices: () => voices, speak: (u) => log.spoken.push(u), cancel: () => { log.cancels += 1; } };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  return log;
};
const clearSynth = () => { delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; };

test('pickVoice prefiere español de Bolivia/Latinoamérica y acepta guion bajo', () => {
  const v = (lang) => ({ lang, name: lang });
  assert.equal(pickVoice([v('en-US'), v('es-ES'), v('es-MX')]).lang, 'es-MX');
  assert.equal(pickVoice([v('es-ES'), v('es-BO')]).lang, 'es-BO');
  assert.equal(pickVoice([v('es_419'), v('es-ES')]).lang, 'es_419');
  assert.equal(pickVoice([v('es-CL')]).lang, 'es-CL', 'cualquier español sirve');
  assert.equal(pickVoice([v('en-US'), v('fr-FR')]), null);
  assert.equal(pickVoice([]), null);
  assert.equal(pickVoice([{ name: 'sin idioma' }]), null);
});

test('speakable limpia símbolos y espacios', () => {
  assert.equal(speakable('★★★  Victoria →  ×2\n fin'), 'Victoria 2 fin');
  assert.equal(speakable(null), '');
});

test('sin síntesis de voz no hace nada y no falla', () => {
  clearSynth();
  assert.equal(voiceAvailable(), false);
  settings.set({ voice: true });
  assert.equal(speak('hola'), false);
  assert.doesNotThrow(() => stopSpeaking());
});

test('con voz desactivada no lee, salvo que se pida expresamente (botón «Leer»)', () => {
  const log = mockSynth([{ lang: 'es-BO', name: 'x' }]);
  settings.set({ voice: false });
  assert.equal(speak('hola'), false);
  assert.equal(log.spoken.length, 0);
  assert.equal(speak('hola', { force: true }), true);
  assert.equal(log.spoken.length, 1);
});

test('con voz activada corta la lectura anterior, elige voz en español y lee el texto limpio', () => {
  const log = mockSynth([{ lang: 'en-US', name: 'a' }, { lang: 'es-MX', name: 'b' }]);
  settings.set({ voice: true });
  assert.equal(speak('Primera frase ★'), true);
  assert.equal(speak('Segunda frase'), true);
  assert.equal(log.cancels, 2, 'cancela antes de cada lectura');
  assert.deepEqual(log.spoken.map((u) => u.text), ['Primera frase', 'Segunda frase']);
  assert.equal(log.spoken[0].lang, 'es-MX');
  assert.equal(log.spoken[0].voice.name, 'b');
  assert.equal(speak('   '), false, 'un texto vacío no se lee');
  stopSpeaking();
  assert.equal(log.cancels, 3, 'un texto vacío no interrumpe una lectura en curso; stopSpeaking sí');
  clearSynth();
});
