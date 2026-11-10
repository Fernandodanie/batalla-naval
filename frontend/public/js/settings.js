/**
 * Ajustes del jugador (se guardan en este navegador). Son solo de presentación: no cambian las reglas ni se envían al servidor.
 *  - animations: 'full' (todo) · 'light' (solo proyectil e impacto) · 'off' (sin animaciones)
 *  - shake:      sacudida del tablero al hundir una unidad
 *  - narration:  panel de narración durante las misiones
 *  - aula:       modo aula: lectura guiada antes de la misión y preguntas al ganar
 *  - voice:      narrador hablado (activo en instalaciones nuevas; respetar ajustes anteriores)
 *  - music:      música de fondo (la de la entrada es fuerte; en el resto del juego es suave). Los efectos se silencian aparte con 🔊
 *  - musicVolume: volumen de la música, 0–100 (70 = el volumen base de cada pista, medido en js/music.js)
 */
const KEY = 'bn.settings';
export const ANIMATIONS = ['full', 'light', 'off'];
export const DEFAULTS = Object.freeze({ animations: 'full', shake: true, narration: true, aula: false, voice: true, music: true, musicVolume: 70 });

/** Deja solo valores válidos (el almacenamiento puede estar manipulado o venir de otra versión). */
export function sanitize(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    animations: ANIMATIONS.includes(o.animations) ? o.animations : DEFAULTS.animations,
    shake: typeof o.shake === 'boolean' ? o.shake : DEFAULTS.shake,
    narration: typeof o.narration === 'boolean' ? o.narration : DEFAULTS.narration,
    aula: typeof o.aula === 'boolean' ? o.aula : DEFAULTS.aula,
    voice: typeof o.voice === 'boolean' ? o.voice : DEFAULTS.voice,
    music: typeof o.music === 'boolean' ? o.music : DEFAULTS.music,
    musicVolume: Number.isFinite(o.musicVolume) ? Math.min(100, Math.max(0, Math.round(o.musicVolume))) : DEFAULTS.musicVolume,
  };
}

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

let current = sanitize(read());
const listeners = new Set();

export const settings = {
  get: () => current,
  set(patch) {
    current = sanitize({ ...current, ...patch });
    write(current);
    for (const fn of listeners) fn(current);
    return current;
  },
  reset() { return this.set(DEFAULTS); },
  /** Avisa de los cambios; devuelve la función para dejar de escuchar. */
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/** Con 'off' no hay animaciones; con 'light' solo las esenciales. */
export const animationsOff = () => current.animations === 'off';
export const animationsFull = () => current.animations === 'full';
