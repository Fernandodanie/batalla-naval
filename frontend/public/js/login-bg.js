/**
 * Fondo de la pantalla de entrada: tres videos en pixel art que rotan con un fundido entre uno y otro.
 *
 * Reglas de diseño (por eso el código es como es):
 *  - Solo corre mientras se ve la pantalla de entrada. Al entrar al juego se pausa y se LIBERA (sin decodificar video en segundo plano).
 *  - Se descarga primero un solo video; los otros dos esperan a que el primero ya esté sonando.
 *  - Sin movimiento (preferencia del sistema, «Sin animaciones» en Ajustes, ahorro de datos o 2G) queda solo la imagen fija.
 *  - Si el navegador no deja reproducir solo (modo de bajo consumo), queda la imagen fija hasta el primer toque.
 *  - La política de seguridad (CSP) no permite estilos en línea: todo se hace con clases (ver «entrada» en css/style.css).
 */
import { el } from './dom.js';
import { animationsOff } from './settings.js';

/**
 * Los clips, en el orden en que rotan. Mientras carga (o si no hay movimiento) se ve `video/login/naval.jpg`, que pone el CSS
 * en `.login-bg`: por eso los <video> no llevan `poster` (cada uno obligaría a descargar su .jpg al abrir, y nunca se vería).
 */
export const CLIPS = Object.freeze([
  Object.freeze({ id: 'naval', src: 'video/login/naval.mp4' }),
  Object.freeze({ id: 'artilleria', src: 'video/login/artilleria.mp4' }),
  Object.freeze({ id: 'jungla', src: 'video/login/jungla.mp4' }),
]);

/** Duración del fundido. Debe coincidir con `transition` de `.login-clip` en css/style.css. */
export const FADE_MS = 900;
/** Si el navegador aún no informa la duración, se asume la de los clips actuales (~3 s). */
const FALLBACK_CLIP_S = 3;

/**
 * ¿Se puede animar el fondo?
 * @param {{reducedMotion?:boolean, saveData?:boolean, effectiveType?:string, animationsOff?:boolean}} s
 */
export function shouldAnimate({ reducedMotion = false, saveData = false, effectiveType = '', animationsOff: off = false } = {}) {
  return !(reducedMotion || saveData || off || /^(slow-)?2g$/.test(String(effectiveType)));
}

/** Índice del siguiente clip que no esté roto, o -1 si no queda ninguno distinto del actual. */
export function nextIndex(current, broken, total) {
  for (let step = 1; step < total; step += 1) {
    const i = (current + step) % total;
    if (!broken.has(i)) return i;
  }
  return -1;
}

/** Milisegundos hasta empezar el fundido hacia el siguiente: lo que falta del clip menos lo que dura el fundido. */
export function msUntilNext(duration, currentTime, fadeMs = FADE_MS) {
  const total = Number.isFinite(duration) && duration > 0 ? duration : FALLBACK_CLIP_S;
  return Math.max(0, Math.round((total - (Number.isFinite(currentTime) ? currentTime : 0)) * 1000 - fadeMs));
}

/** Lee del navegador lo necesario para decidir si se anima (con valores seguros si algo no existe). */
export function browserCanAnimate() {
  const conn = typeof navigator !== 'undefined' ? navigator.connection : undefined;
  return shouldAnimate({
    reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(conn?.saveData),
    effectiveType: conn?.effectiveType ?? '',
    animationsOff: animationsOff(),
  });
}

export class LoginBackdrop {
  #root; #animate; #videos = []; #broken = new Set();
  #cur = -1; #active = false; #advancing = false; #warmed = false;
  #timer = 0; #fadeTimer = 0; #unlockArmed = false;

  /**
   * @param {HTMLElement} root contenedor (`#login-bg`)
   * @param {{animate?:()=>boolean}} [opts] `animate` se puede reemplazar en pruebas
   */
  constructor(root, { animate = browserCanAnimate } = {}) {
    this.#root = root;
    this.#animate = animate;
    document.addEventListener('visibilitychange', () => this.#onVisibility());
  }

  /** Lo llama `showScreen`: true al mostrar la entrada, false al salir de ella. */
  setActive(on) {
    if (on === this.#active) return;
    this.#active = on;
    if (on) this.#begin(); else this.#release();
  }

  /** Vuelve a evaluar si se anima (por ejemplo, tras cambiar «Animaciones» en Ajustes). */
  refresh() {
    if (!this.#active) return;
    this.#release();
    this.#begin();
  }

  // ---------------------------------------------------------------- ciclo de vida
  #begin() {
    const animate = this.#animate();
    this.#root.classList.toggle('is-still', !animate);
    if (!animate) return;
    this.#build();
    this.#playFirst();
  }

  /** Detiene todo y suelta los videos (el navegador libera su memoria y su decodificador). */
  #release() {
    clearTimeout(this.#timer);
    clearTimeout(this.#fadeTimer);
    this.#advancing = false;
    this.#cur = -1;
    this.#warmed = false;
    for (const v of this.#videos) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.remove();
    }
    this.#videos = [];
    this.#broken.clear();
  }

  #build() {
    if (this.#videos.length) return;
    CLIPS.forEach((clip, i) => {
      const v = el('video', {
        class: 'login-clip', muted: true, playsinline: true, preload: i === 0 ? 'auto' : 'none',
        tabindex: '-1', 'aria-hidden': 'true', disablepictureinpicture: true,
      });
      v.muted = true; // el atributo solo no basta en algunos navegadores para permitir el autoplay
      v.src = clip.src;
      v.addEventListener('error', () => this.#onBroken(i));
      v.addEventListener('ended', () => { if (this.#active && this.#cur === i) this.#advance(); });
      this.#videos.push(v);
      this.#root.append(v);
    });
  }

  // ---------------------------------------------------------------- reproducción
  async #playFirst() {
    const usable = () => [...this.#videos.keys()].find((i) => !this.#broken.has(i));
    for (let i = usable(); i !== undefined; i = usable()) {
      if (await this.#show(i)) { this.#schedule(); return; }
      if (!this.#active || !this.#broken.has(i)) return; // se salió de la entrada, o autoplay bloqueado (ya se armó el reintento)
    }
  }

  /** Muestra el clip `i` con fundido sobre el actual. Devuelve false si el navegador no lo deja reproducir. */
  async #show(i) {
    const v = this.#videos[i];
    if (!v || this.#broken.has(i)) return false;
    try { v.currentTime = 0; } catch { /* aún sin metadatos: arranca desde el principio igual */ }
    try {
      await v.play();
    } catch {
      this.#armUnlock();
      return false;
    }
    if (!this.#active || this.#videos[i] !== v || this.#broken.has(i)) { v.pause(); return false; } // se salió de la entrada, o el video falló, mientras cargaba

    const prev = this.#cur;
    if (prev >= 0 && prev !== i) this.#videos[prev]?.classList.remove('front'); // sigue visible debajo mientras entra el nuevo
    v.classList.add('on', 'front');
    this.#cur = i;

    clearTimeout(this.#fadeTimer);
    if (prev >= 0 && prev !== i) {
      const out = this.#videos[prev];
      this.#fadeTimer = setTimeout(() => { out?.classList.remove('on'); out?.pause(); }, FADE_MS + 100);
    }
    this.#warm();
    return true;
  }

  /** Con el primer video ya sonando, pide los otros dos. */
  #warm() {
    if (this.#warmed) return;
    this.#warmed = true;
    for (const v of this.#videos) {
      if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
    }
  }

  #schedule() {
    clearTimeout(this.#timer);
    const v = this.#videos[this.#cur];
    if (!v) return;
    this.#timer = setTimeout(() => this.#advance(), msUntilNext(v.duration, v.currentTime));
  }

  async #advance() {
    if (!this.#active || this.#advancing || this.#cur < 0) return;
    this.#advancing = true;
    clearTimeout(this.#timer);
    try {
      let n = nextIndex(this.#cur, this.#broken, this.#videos.length);
      while (n >= 0) {
        if (await this.#show(n)) { this.#schedule(); return; }
        if (!this.#active || !this.#broken.has(n)) break; // salió de la entrada, o el navegador no deja reproducir
        n = nextIndex(this.#cur, this.#broken, this.#videos.length); // ese falló: se prueba con el que sigue
      }
      // No hay otro que mostrar (solo queda uno usable, o no se pudo): el actual se repite en vez de congelarse en el último cuadro.
      const v = this.#videos[this.#cur];
      if (this.#active && v) { v.loop = true; v.play().catch(() => {}); }
    } finally {
      this.#advancing = false;
    }
  }

  #onBroken(i) {
    this.#broken.add(i);
    if (this.#active && this.#cur === i) this.#advance(); // si era el que se veía, pasa al siguiente (los demás casos los resuelven #playFirst y #advance)
  }

  // ---------------------------------------------------------------- pestaña oculta y autoplay bloqueado
  #onVisibility() {
    if (!this.#active || this.#cur < 0) return;
    const v = this.#videos[this.#cur];
    if (document.hidden) {
      clearTimeout(this.#timer);
      v?.pause();
    } else if (v) {
      v.play().then(() => this.#schedule()).catch(() => {});
    }
  }

  /** Si el navegador bloqueó el autoplay, se reintenta una vez con el primer toque o tecla. */
  #armUnlock() {
    if (this.#unlockArmed) return;
    this.#unlockArmed = true;
    const retry = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
      this.#unlockArmed = false;
      if (this.#active && this.#cur < 0) this.#playFirst();
    };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  }
}
