/** Pruebas sin dependencias: voz fluida, órdenes, identificadores y reemplazo de lectura. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { militaryText } from '../public/js/military-voice.js';
import { clipId, pickNarratorVoice, speechChunks, speak, stopSpeaking, onSpeech } from '../public/js/voice.js';
import { collectTexts } from '../../tools/voz/textos.mjs';
import { settings } from '../public/js/settings.js';

test('el narrador da órdenes reconocibles sin cambiar el relato histórico', () => {
  assert.equal(militaryText('Fortín Boquerón, 1932.', 'start'), 'Atención, unidad. Fortín Boquerón, 1932.');
  assert.equal(militaryText('Retirada.', 'lose'), 'Repliegue ordenado. Retirada.');
  assert.equal(militaryText('Informando.', 'eventoDesconocido'), 'Informando.');
  assert.equal(militaryText(''), '');
});

test('la voz masculina neural prevalece sobre otra voz regional menos natural', () => {
  const voces = [
    { name: 'Voz boliviana estándar', lang: 'es-BO' },
    { name: 'Microsoft Jorge Online (Natural)', lang: 'es-MX' },
    { name: 'Google español', lang: 'es-ES' },
  ];
  const found = pickNarratorVoice(voces);
  assert.equal(found.voice.name, 'Microsoft Jorge Online (Natural)');
  assert.equal(found.male, true);
  assert.equal(found.natural, true);
  assert.equal(pickNarratorVoice([{ name: 'English Dave', lang: 'en-US' }]).voice, null);
});

test('las frases extensas mantienen el orden y la puntuación al separarse', () => {
  const text = 'Orden recibida. '.repeat(26).trim();
  const parts = speechChunks(text, 110);
  assert.ok(parts.length >= 2);
  assert.equal(parts.join(' '), text);
  assert.ok(parts.every((p) => p.length <= 110));
});

test('la generación de audios coincide con el texto militar y la voz se activa por defecto en una instalación nueva', () => {
  assert.equal(settings.get().voice, true);
  const entries = collectTexts();
  assert.ok(entries.length >= 180);
  assert.equal(entries[0].id, clipId(entries[0].text));
  assert.match(entries[0].text, /^Escuchen, tropa\./);
  assert.ok(entries.some((e) => e.text.startsWith('Concentren el fuego.')));
});

test('la lectura fragmentada avisa al empezar y solo termina tras el último fragmento', () => {
  const utterances = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = { getVoices: () => [], cancel() {}, speak: (u) => utterances.push(u) };
  settings.set({voice:true});
  const seen=[]; const off=onSpeech(v=>seen.push(v));
  const text='Aseguren el perímetro. '.repeat(18).trim();
  assert.equal(speak(text), true);
  utterances[0].onstart();
  assert.deepEqual(seen, [true]);
  let i=0;
  while(i<utterances.length) { utterances[i].onend(); i+=1; }
  assert.ok(utterances.length>=2);
  assert.deepEqual(seen, [true,false]);
  off();stopSpeaking();
  delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
});
