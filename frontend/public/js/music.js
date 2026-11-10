/**
 * Música de todo el juego. Una sola pista a la vez, con fundido al cambiar de pantalla:
 *
 *   pantalla de entrada → «tambores de guerra»  (FUERTE: es la presentación)
 *   inicio y campañas   → «ambiente-puerto»     (suave, de fondo)
 *   partida             → «ambiente-batalla»    (más suave todavía: lo importante son los disparos y la narración)
 *
 * Los volúmenes de cada pista (`gain`) están medidos para que el ambiente quede unos 11 dB (puerto) y 14 dB (batalla) por debajo
 * de la entrada y por debajo de los efectos de sonido. Para cambiarlos, toca solo TRACKS. Cada persona los ajusta además con
 * «Volumen de la música» en Ajustes (se guarda en este navegador).
 *
 * Reglas del navegador (por eso el código es como es):
 *  - Nada suena hasta que la persona toca la página. Se intenta arrancar al mostrar la pantalla y, si el navegador lo deja en espera,
 *    empieza con el primer toque, clic o tecla (en la entrada, el botón de sonido late mientras espera).
 *  - Usa Web Audio: decodifica el archivo una vez y lo repite sin cortes (las pistas se compusieron en bucle perfecto).
 *  - Respeta el silencio de los efectos (`sound.muted`, guardado en `bn.muted`) y el ajuste «Música de fondo»; se pausa con la pestaña oculta.
 *  - Memoria: un archivo decodificado pesa ~15–23 MB. La pista de la entrada se suelta al salir de ella; las dos de ambiente se conservan
 *    porque se alternan a menudo (inicio ↔ partida).
 */
import { settings } from './settings.js';
import { sound } from './sound.js';

/** Pistas: archivo, volumen base (0–1) y segundos de fundido de entrada cuando no hay otra sonando. */
export const TRACKS = Object.freeze({
  login:   { src: 'audio/tambores-guerra.mp3',  gain: 0.5,   fadeIn: 0.35, releaseBuffer: true },
  puerto:  { src: 'audio/ambiente-puerto.mp3',  gain: 0.11,  fadeIn: 4.0,  releaseBuffer: false },
  batalla: { src: 'audio/ambiente-batalla.mp3', gain: 0.075, fadeIn: 3.0,  releaseBuffer: false },
});

/** Qué pista corresponde a cada pantalla (`showScreen` en main.js). */
export const SCREEN_TRACK = Object.freeze({ welcome: 'login', home: 'puerto', campaign: 'puerto', game: 'batalla' });

export const CROSSFADE_S = 1.8;   // paso de una pista a otra
export const FADE_OUT_S = 0.7;    // al silenciar
export const RETARGET_S = 0.25;   // al mover el control de volumen
export const DUCK = 0.35;         // multiplicador mientras se lee la narración en voz alta
export const VOLUME_REF = 70;     // valor del control que equivale al volumen base de cada pista

/** Volumen final de una pista según el control de Ajustes (0–100). */
export const trackGain = (id, volume) => TRACKS[id].gain * (volume / VOLUME_REF);

export class MusicDirector {
  #ctx = null; #master = null;
  #loading = new Map();       // id → promesa del buffer decodificado
  #want = null;               // pista que corresponde a la pantalla actual
  #screen = null;
  #cur = null;                // { id, src, gain } la que suena (o está entrando)
  #gen = 0;                   // invalida arranques pendientes cuando cambia el objetivo
  #armed = false; #onWait; #env;

  /**
   * @param {{onWait?:(waiting:boolean)=>void, env?:{AudioContext?:Function, fetch?:Function}}} [opts]
   *   `onWait(true)` mientras se espera el primer toque en la entrada (para destacar el botón de sonido).
   *   `env` permite probarlo sin navegador.
   */
  constructor({ onWait = () => {}, env = {} } = {}) {
    this.#onWait = onWait;
    this.#env = env;
    globalThis.document?.addEventListener('visibilitychange', () => this.#onVisibility());
  }

  // ---------------------------------------------------------------- API
  /** Lo llama `showScreen`: la pista sale de la pantalla. */
  setScreen(name) {
    this.#screen = name;
    this.#want = SCREEN_TRACK[name] ?? null;
    this.#apply();
  }

  /** Vuelve a evaluar tras silenciar, activar el sonido o cambiar los ajustes. */
  sync() { this.#apply(); }

  /** Baja la música mientras se lee la narración en voz alta (y la devuelve después). */
  duck(on) {
    if (!this.#master) return;
    const t = this.#ctx.currentTime;
    this.#master.gain.cancelScheduledValues(t);
    this.#master.gain.setTargetAtTime(on ? DUCK : 1, t, 0.15);
  }

  /** Estado para pruebas y para la guía de depuración. */
  get state() {
    return { track: this.#cur?.id ?? null, want: this.#want, ctx: this.#ctx?.state ?? null, gain: this.#cur ? this.#cur.gain.gain.value : null };
  }

  // ---------------------------------------------------------------- decisiones
  #enabled() {
    const s = settings.get();
    return !sound.muted && s.music && s.musicVolume > 0;
  }

  #apply() {
    const want = this.#enabled() ? this.#want : null;
    if (want === (this.#cur?.id ?? null)) { this.#retarget(); return; }
    if (!want) { this.#gen += 1; this.#fadeOut(FADE_OUT_S); this.#onWait(false); return; }
    this.#play(want);
  }

  async #play(id) {
    const gen = ++this.#gen;
    const ctx = this.#context();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      // Sin gesto previo, Chrome deja resume() pendiente (no falla): no se espera mucho y se pasa a esperar el primer toque.
      await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 250))]);
      if (gen !== this.#gen) return;
      if (ctx.state !== 'running') { this.#waitForGesture(); return; }
    }
    this.#onWait(false);
    const buffer = await this.#load(id);
    if (!buffer || gen !== this.#gen) return;
    this.#start(id, buffer);
  }

  // ---------------------------------------------------------------- reproducción
  #start(id, buffer) {
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const prev = this.#cur;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(this.#target(id), t + (prev ? CROSSFADE_S : TRACKS[id].fadeIn));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gain);
    gain.connect(this.#master);
    src.start(t);
    this.#cur = { id, src, gain };
    if (prev) this.#release(prev, CROSSFADE_S);
  }

  #fadeOut(secs) {
    const prev = this.#cur;
    this.#cur = null;
    if (prev) this.#release(prev, secs);
  }

  /** Baja una pista hasta el silencio y la detiene; si es de las que sueltan su buffer (la de la entrada), lo suelta. */
  #release(entry, secs) {
    const ctx = this.#ctx;
    const t = ctx.currentTime;
    const g = entry.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.0001, t + secs);
    try { entry.src.stop(t + secs + 0.05); } catch { /* ya estaba detenida */ }
    entry.src.onended = () => {
      entry.src.disconnect();
      entry.gain.disconnect();
      if (TRACKS[entry.id].releaseBuffer && this.#cur?.id !== entry.id) this.#loading.delete(entry.id);
    };
  }

  /** La pista sigue; solo cambió el volumen (control de Ajustes). */
  #retarget() {
    const cur = this.#cur;
    if (!cur) return;
    const t = this.#ctx.currentTime;
    cur.gain.gain.cancelScheduledValues(t);
    cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
    cur.gain.gain.linearRampToValueAtTime(this.#target(cur.id), t + RETARGET_S);
  }

  #target(id) { return trackGain(id, settings.get().musicVolume); }

  // ---------------------------------------------------------------- piezas
  #context() {
    if (this.#ctx) return this.#ctx;
    const AC = this.#env.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      this.#ctx = new AC();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = 1;
      this.#master.connect(this.#ctx.destination);
    } catch {
      this.#ctx = null;
    }
    return this.#ctx;
  }

  /** Descarga y decodifica una pista una sola vez. Si falla, queda en silencio sin molestar y se reintenta la próxima vez. */
  #load(id) {
    if (!this.#loading.has(id)) {
      const doFetch = this.#env.fetch ?? globalThis.fetch.bind(globalThis);
      this.#loading.set(id, (async () => {
        try {
          const res = await doFetch(TRACKS[id].src);
          if (!res.ok) throw new Error(String(res.status));
          return await this.#ctx.decodeAudioData(await res.arrayBuffer());
        } catch {
          this.#loading.delete(id);
          return null;
        }
      })());
    }
    return this.#loading.get(id);
  }

  #waitForGesture() {
    // El botón de sonido solo late en la entrada: en el resto del juego se espera el primer toque en silencio.
    this.#onWait(this.#screen === 'welcome');
    if (this.#armed) return;
    this.#armed = true;
    const go = () => {
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
      this.#armed = false;
      this.#apply();
    };
    window.addEventListener('pointerdown', go, { capture: true, once: true });
    window.addEventListener('keydown', go, { capture: true, once: true });
  }

  #onVisibility() {
    const ctx = this.#ctx;
    if (!ctx || !this.#cur) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  }
}
