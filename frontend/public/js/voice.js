import { settings } from './settings.js';

/**
 * Lectura en voz alta de la narración. Dos caminos:
 *  1. Audios grabados con una voz neural (audio/voz/<id>.mp3, los genera `tools/voz/generar.mjs`): suenan igual en todos los
 *     dispositivos y mucho más naturales. Solo se usan si el texto tiene su audio (lista en audio/voz/index.json).
 *  2. Respaldo: la síntesis de voz del navegador (sin servidor y sin enviar nada a ninguna parte). La calidad y los idiomas
 *     dependen del dispositivo; si no hay voz en español, se usa la que traiga el sistema con idioma «es».
 */
const synthAvailable = () => typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';
export const voiceAvailable = () => synthAvailable() || clips.size > 0;

// ---------- audios grabados ----------
const CLIPS_DIR = 'audio/voz/';
let clips = new Set(); // ids de los textos que tienen audio
let clipAudio = null;  // el <audio> que suena ahora

/** Identificador estable de un texto (cyrb53, el mismo en el navegador y en el generador de audios). Recibe el texto ya limpio (`speakable`). */
export function clipId(text) {
  let h1 = 0xdeadbeef; let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Lee la lista de audios disponibles (si no existe o falla, todo sigue con la voz del navegador). @returns {Promise<number>} cuántos hay */
export async function loadClips(fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(`${CLIPS_DIR}index.json`, { cache: 'no-cache' });
    if (!res.ok) return 0;
    const data = await res.json();
    clips = new Set(Array.isArray(data?.clips) ? data.clips.filter((id) => typeof id === 'string' && /^[a-z0-9]+$/.test(id)) : []);
  } catch { clips = new Set(); }
  return clips.size;
}

const stopClip = () => {
  if (!clipAudio) return;
  const a = clipAudio;
  clipAudio = null;
  a.onplaying = a.onended = a.onerror = null;
  try { a.pause(); } catch { /* ya estaba detenido */ }
};

/** Preferencia de voces: español de Latinoamérica/Bolivia primero, luego cualquier español. */
const PREFERRED = ['es-BO', 'es-419', 'es-MX', 'es-AR', 'es-US', 'es-ES'];

/** Elige la mejor voz en español de la lista (o null si no hay ninguna). */
export function pickVoice(voices = []) {
  const es = voices.filter((v) => /^es([-_]|$)/i.test(v.lang ?? ''));
  for (const lang of PREFERRED) {
    const hit = es.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    if (hit) return hit;
  }
  return es[0] ?? null;
}

/**
 * Voz del narrador (un oficial): prefiere una voz masculina en español. Los navegadores no dicen el género de la voz,
 * así que se reconoce por el nombre (Edge trae «Marcelo» es-BO, «Jorge», «Álvaro», «Raúl»…; Chrome/Android suelen traer solo voces femeninas).
 * Si no hay ninguna masculina, se usa la mejor voz en español y se baja el tono para que suene más grave.
 */
const MALE = /\b(marcelo|jorge|alvaro|álvaro|raul|raúl|pablo|diego|pelayo|alonso|tomas|tomás|gonzalo|lorenzo|federico|juan|carlos|miguel|andres|andrés|enrique|manuel|david|jesus|jesús|luis|mateo|emilio|oscar|óscar|ricardo|sergio|male|hombre)\b/i;
const FEMALE = /\b(sofia|sofía|helena|laura|paola|elena|dalia|paulina|sabina|lucia|lucía|monica|mónica|camila|salome|salomé|valentina|elvira|ximena|marina|maria|maría|paloma|lupe|female|mujer|google espa)/i;

/**
 * El timbre de una voz natural importa más que la región: primero buscamos una voz masculina
 * en español y, entre ellas, preferimos las neurales/naturales. No basta con bajar el pitch:
 * los cambios drásticos hacen que la voz parezca robótica, especialmente en Android.
 * @returns {{voice: object|null, male: boolean, natural: boolean}}
 */
export function pickNarratorVoice(voices = []) {
  const es = voices.filter((v) => /^es([-_]|$)/i.test(v.lang ?? ''));
  const male = (v) => MALE.test(v.name ?? '') && !FEMALE.test(v.name ?? '');
  const natural = (v) => /natural|online|neural|premium|enhanced/i.test(v.name ?? '');
  const rankLang = (v) => {
    const i = PREFERRED.findIndex((l) => l.toLowerCase() === (v.lang ?? '').replace('_', '-').toLowerCase());
    return i < 0 ? 99 : i;
  };
  // Primero timbre masculino; dentro del mismo tipo gana la calidad y luego la variedad regional.
  const ranked = [...es].sort((a, b) =>
    Number(male(b)) - Number(male(a)) ||
    Number(natural(b)) - Number(natural(a)) ||
    rankLang(a) - rankLang(b));
  const voice = ranked[0] ?? null;
  return { voice, male: Boolean(voice && male(voice)), natural: Boolean(voice && natural(voice)) };
}

/**
 * Android y Chrome pueden interrumpir lecturas demasiado largas. Cortar por oraciones
 * mantiene las pausas naturales y evita truncar el final de un informe extenso.
 */
export function speechChunks(text, limit = 190) {
  const clean = String(text ?? '').trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];
  const sentences = clean.split(/(?<=[.!?;])\s+(?=[¡¿A-ZÁÉÍÓÚÜÑ])/u);
  const chunks = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (buffer && (buffer.length + sentence.length + 1 > limit)) {
      chunks.push(buffer); buffer = '';
    }
    if (sentence.length <= limit) { buffer = buffer ? `${buffer} ${sentence}` : sentence; continue; }
    // Frases sin punto: preferir cortar en un espacio y nunca perder texto.
    const words = sentence.split(/\s+/);
    for (const word of words) {
      if (buffer && (buffer.length + word.length + 1 > limit)) { chunks.push(buffer); buffer = ''; }
      buffer = buffer ? `${buffer} ${word}` : word;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

/** Texto apto para leer: sin símbolos de estrella, flechas ni espacios repetidos. */
export const speakable = (text) => String(text ?? '').replace(/[★☆→←▸►×]/g, ' ').replace(/\s+/g, ' ').trim();

// Quien quiera enterarse de cuándo se habla (la música baja mientras se lee la narración).
const listeners = new Set();
let current = null; // la lectura en curso: solo su final apaga el aviso (cancelar una lectura dispara el «fin» de la anterior tarde)
const emit = (speaking) => { for (const fn of listeners) { try { fn(speaking); } catch { /* un oyente roto no debe cortar la voz */ } } };

/** Avisa con `fn(true)` al empezar a leer y `fn(false)` al terminar o cortarse. Devuelve la función para dejar de escuchar. */
export function onSpeech(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Corta cualquier lectura en curso. */
export function stopSpeaking() {
  const was = current;
  current = null;
  stopClip();
  if (synthAvailable()) globalThis.speechSynthesis.cancel();
  if (was) emit(false);
}

/** Lee con voz del dispositivo, sin exagerar el tono y con pausas entre oraciones largas. */
function speakSynth(clean) {
  if (!synthAvailable()) return false;
  const synth = globalThis.speechSynthesis;
  synth.cancel();
  const { voice: v, male, natural } = pickNarratorVoice(synth.getVoices?.() ?? []);
  const token = { kind: 'synth' };
  const pending = speechChunks(clean);
  if (!pending.length) return false;
  current = token;
  const done = () => { if (current === token) { current = null; emit(false); } };
  const next = () => {
    if (current !== token) return;
    const part = pending.shift();
    if (!part) { done(); return; }
    const u = new globalThis.SpeechSynthesisUtterance(part);
    u.lang = v?.lang ?? 'es-419';
    if (v) u.voice = v;
    // Un oficial transmite serenidad y autoridad, no un efecto de voz artificial.
    // Las voces neurales ya tienen sus propias curvas de entonación.
    u.rate = natural ? 0.99 : 0.96;
    u.pitch = natural ? 1 : (male ? 0.96 : 0.98);
    u.volume = 1;
    u.onstart = () => { if (current === token && !token.started) { token.started = true; emit(true); } };
    u.onend = () => { if (current === token) next(); };
    u.onerror = done;
    try { synth.speak(u); } catch { done(); }
  };
  next();
  return true;
}

/** Reproduce el audio grabado; si no se puede (archivo ausente, sin permiso para sonar), cae a la voz del navegador. */
function speakClip(id, clean) {
  const token = { clip: id };
  current = token;
  const a = new globalThis.Audio(`${CLIPS_DIR}${id}.mp3`);
  clipAudio = a;
  const done = () => { if (current === token) { current = null; stopClip(); emit(false); } };
  const fallback = () => { if (current === token) { current = null; stopClip(); speakSynth(clean); } };
  a.onplaying = () => { if (current === token) emit(true); };
  a.onended = done;
  a.onerror = fallback;
  Promise.resolve(a.play()).catch(fallback);
  return true;
}

/**
 * Lee un texto. Sin `force`, solo si el jugador activó la voz en Ajustes.
 * @returns {boolean} true si se pidió la lectura
 */
export function speak(text, { force = false } = {}) {
  if (!voiceAvailable() || (!force && !settings.get().voice)) return false;
  const clean = speakable(text);
  if (!clean) return false;
  stopClip();
  const id = clipId(clean);
  if (clips.has(id) && typeof globalThis.Audio === 'function') {
    if (synthAvailable()) globalThis.speechSynthesis.cancel();
    return speakClip(id, clean);
  }
  return speakSynth(clean);
}
