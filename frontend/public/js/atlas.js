/**
 * Atlas de sprites en pixel art (PNG + JSON generados por tools/pixelart). Cada entrada es una tira de cuadros;
 * se dibuja con `background-image` y porcentajes, así que escala con la casilla sin cálculos de píxeles.
 * Si el atlas no carga, `atlas.ok` queda en false y el tablero usa los sprites SVG de sprites.js.
 */

import { animationsOff } from './settings.js';

export const atlas = { ok: false, sheets: {} };

// Sin animaciones si el sistema lo pide (prefers-reduced-motion) o si el jugador las desactivó en Ajustes.
const reduced = () => animationsOff() || (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
export const prefersReducedMotion = reduced;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

async function loadSheet(tile) {
  const meta = await (await fetch(`img/atlas-${tile}.json`)).json();
  const img = await loadImage(`img/${meta.image}`);
  return { tile, meta: meta.sprites, url: `url("img/${meta.image}")`, w: img.naturalWidth, h: img.naturalHeight };
}

/** Carga los atlas de 32 y 16 px. Nunca lanza: si falla, el juego sigue con los sprites SVG. */
export async function loadAtlas() {
  try {
    const [a, b] = await Promise.all([loadSheet(32), loadSheet(16)]);
    atlas.sheets = { 32: a, 16: b };
    atlas.ok = true;
  } catch {
    atlas.ok = false;
  }
  return atlas.ok;
}

/** Tamaño de sprite del atlas según los píxeles reales de la casilla: 16 px si es pequeña, 32 si no. */
export const tileFor = (cellPx) => (cellPx > 0 && cellPx < 24 ? 16 : 32);

/** Ranura de una unidad: el largo, y para el largo 3 la variante a/b según el número del id ("3-1" → 3b). */
export function slotOf(length, id) {
  if (length !== 3) return String(length);
  return (Number(String(id ?? '').split('-')[1]) || 0) % 2 ? '3b' : '3a';
}

const spec = (sheet, key, frame = 0) => {
  const s = sheet.meta[key];
  if (!s) return null;
  const px = (s.x + frame * s.w) / Math.max(1, sheet.w - s.w) * 100;
  const py = s.h >= sheet.h ? 0 : (s.y / (sheet.h - s.h)) * 100;
  return {
    image: sheet.url, frames: s.frames, key,
    size: `${(sheet.w / s.w) * 100}% ${(sheet.h / s.h) * 100}%`,
    pos: (f) => `${((s.x + f * s.w) / Math.max(1, sheet.w - s.w)) * 100}% ${py}%`,
    first: `${px}% ${py}%`,
  };
};

export const unitSpec = (tile, biome, length, id, vertical, state) =>
  spec(atlas.sheets[tile], `${biome}/${slotOf(length, id)}/${vertical ? 'v' : 'h'}/${state}`);
export const fxSpec = (tile, name) => spec(atlas.sheets[tile], `fx/${name}`);

// ------------------------------------------------------------------ animación por cuadros (steps)
const live = new Set();
let timer = null;

function tick() {
  for (const a of live) {
    if (!a.node.isConnected) { if (a.seen) live.delete(a); continue; }
    a.seen = true;
    a.f = (a.f + 1) % a.spec.frames;
    a.node.style.backgroundPosition = a.spec.pos(a.f);
  }
  if (!live.size) { clearInterval(timer); timer = null; }
}

/** Pinta un nodo con un sprite y, si tiene varios cuadros, lo anima en bucle (respetando prefers-reduced-motion). */
export function applySprite(node, sp, { offset = 0 } = {}) {
  node.classList.add('px');
  node.style.backgroundImage = sp.image;
  node.style.backgroundSize = sp.size;
  node.style.backgroundPosition = sp.pos(0);
  if (sp.frames > 1 && !reduced()) {
    live.add({ node, spec: sp, f: offset % sp.frames, seen: false });
    if (!timer) { timer = setInterval(tick, 190); timer.unref?.(); }
  }
}

/** Reproduce un efecto una sola vez sobre un nodo (proyectil, salpicadura, explosión...) y lo quita al terminar. */
export function playOnce(node, sp, { fps = 14, onEnd } = {}) {
  node.classList.add('px');
  node.style.backgroundImage = sp.image;
  node.style.backgroundSize = sp.size;
  let f = 0;
  node.style.backgroundPosition = sp.pos(0);
  const id = setInterval(() => {
    f += 1;
    if (f >= sp.frames) { clearInterval(id); onEnd?.(); return; }
    node.style.backgroundPosition = sp.pos(f);
  }, 1000 / fps);
  return () => clearInterval(id);
}
