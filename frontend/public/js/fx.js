import { atlas, fxSpec, playOnce, prefersReducedMotion, tileFor } from './atlas.js';
import { el } from './dom.js';
import { animationsFull, settings } from './settings.js';

/**
 * Capa de efectos sobre la página: un disparo se ve como fogonazo → viaje (con estela) → impacto (acierto), o
 * salpicadura/ondas (fallo). Todo son nodos temporales con posición fija que se eliminan solos; nada toca el estado del juego.
 *
 * Con «Animaciones: ligeras» solo hay proyectil e impacto; con «desactivadas» (o prefers-reduced-motion), nada.
 */
const IMPACT = { water: 'splash', pirate: 'splash', land: 'dust', jungle: 'leaves' };
/** Color de la estela y del fogonazo de cada escenario. */
const STYLE = {
  water: { trail: '#e6f6ff', flash: '#ffe08a' },
  pirate: { trail: '#e6f6ff', flash: '#ffb84a' },
  land: { trail: '#cdb07a', flash: '#ffd45a' },
  jungle: { trail: '#a8d98a', flash: '#fff2a0' },
};
export const TRAVEL_MS = 420;
const MAX_NODES = 40; // tope de nodos de efecto a la vez, para no ahogar celulares modestos

export const styleFor = (biome) => STYLE[biome] ?? STYLE.water;

/** Sprite del proyectil de cada escenario: cometa en el mar, bala de cañón pirata, granada de mortero en tierra y trazadora en la selva. */
export const PROJECTILE = Object.freeze({ water: 'projectile', pirate: 'projectile-pirate', land: 'projectile-land', jungle: 'projectile-jungle' });
export const projectileName = (biome) => PROJECTILE[biome] ?? PROJECTILE.water;

function layer() {
  let l = document.getElementById('fx-layer');
  if (!l) { l = el('div', { id: 'fx-layer', class: 'fx-layer', 'aria-hidden': 'true' }); document.body.append(l); }
  return l;
}

const room = () => layer().childElementCount < MAX_NODES;
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const canAnimate = () => !prefersReducedMotion() && Boolean(globalThis.Element?.prototype.animate);

function sprite(name, tile, size, at) {
  const sp = fxSpec(tile, name);
  if (!sp) return null;
  const n = el('div', { class: 'fx' });
  n.style.width = `${size}px`; n.style.height = `${size}px`;
  n.style.left = `${at.x - size / 2}px`; n.style.top = `${at.y - size / 2}px`;
  layer().append(n);
  return { n, sp };
}

/** Efecto en un punto (una vez). Devuelve una promesa que se cumple al terminar. */
export function burst(name, at, size, { fps = 14 } = {}) {
  if (!atlas.ok || prefersReducedMotion()) return Promise.resolve();
  const tile = size < 28 ? 16 : 32;
  const s = sprite(name, tile, size, at);
  if (!s) return Promise.resolve();
  return new Promise((resolve) => playOnce(s.n, s.sp, { fps, onEnd: () => { s.n.remove(); resolve(); } }));
}

/** Nodo sencillo (cuadrado de píxel, texto...) animado con la API web y retirado al terminar. */
function ephemeral(node, keyframes, options, at) {
  if (!canAnimate() || !room()) return Promise.resolve();
  node.classList.add('fx', 'fx-plain');
  if (at) { node.style.left = `${at.x}px`; node.style.top = `${at.y}px`; }
  layer().append(node);
  return new Promise((resolve) => {
    const a = node.animate(keyframes, { fill: 'forwards', ...options });
    const done = () => { node.remove(); resolve(); };
    a.onfinish = done; a.oncancel = done;
  });
}

/** Posición sobre la trayectoria del proyectil en el instante t (0..1): arco que sube hacia el centro del recorrido. */
export function pointAt(a, b, t, arc) {
  const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2 - arc;
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y };
}

/** Altura del arco según la distancia (más largo el tiro, más arco, con tope). */
export const arcFor = (a, b) => Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);

/** Fogonazo en el punto de disparo. Solo con animaciones completas. */
export function muzzle(fromRect, biome = 'water') {
  if (!animationsFull()) return Promise.resolve();
  const at = center(fromRect);
  const c = styleFor(biome).flash;
  const n = el('div', { class: 'fx-flash' });
  n.style.setProperty('--c', c);
  return ephemeral(n, [{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 170, easing: 'steps(4)' }, at);
}

function trailDot(at, color, size) {
  const n = el('div', { class: 'fx-dot' });
  n.style.width = `${size}px`; n.style.height = `${size}px`; n.style.background = color;
  return ephemeral(n, [{ opacity: 0.9, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }], { duration: 320, easing: 'steps(4)' }, at);
}

/**
 * Proyectil desde `from` (rect del tablero que dispara) hasta la casilla `to` (rect), con arco, giro hacia el blanco
 * y, con animaciones completas, una estela de puntos del color del escenario.
 * @returns {Promise<void>} se cumple cuando llega
 */
export function projectile(from, to, cellPx, { biome = 'water' } = {}) {
  if (!atlas.ok || prefersReducedMotion() || !globalThis.Element?.prototype.animate) return Promise.resolve();
  const size = Math.max(22, Math.round(cellPx * 1.5));
  const a = center(from); const b = center(to);
  const tile = tileFor(cellPx);
  // Si el atlas es de una versión anterior (sin proyectil propio del escenario), se usa el genérico.
  const s = sprite(projectileName(biome), tile, size, a) ?? sprite('projectile', tile, size, a);
  if (!s) return Promise.resolve();
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  s.n.style.transformOrigin = 'center';
  playLoop(s);
  const arc = arcFor(a, b);
  // El sprite sigue exactamente la misma curva que la estela: se muestrea en 8 tramos.
  const STEPS = 8;
  const frames = Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS; const p = pointAt(a, b, t, arc);
    const scale = 0.7 + 0.55 * Math.sin(Math.PI * t) - 0.1 * t; // crece hacia lo alto del arco y vuelve a achicarse
    return { transform: `translate(${p.x - a.x}px,${p.y - a.y}px) rotate(${ang}rad) scale(${scale.toFixed(3)})`, opacity: i === 0 ? 0.9 : 1, offset: t };
  });
  const anim = s.n.animate(frames, { duration: TRAVEL_MS, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' });

  // Estela: un punto cada ~45 ms sobre la posición real del proyectil (progreso ya con la aceleración aplicada).
  let timer = null;
  if (animationsFull()) {
    const color = styleFor(biome).trail;
    const dot = Math.max(3, Math.round(cellPx * 0.18));
    timer = setInterval(() => {
      const t = anim.effect?.getComputedTiming?.().progress ?? Math.min(1, Number(anim.currentTime ?? 0) / TRAVEL_MS);
      if (t > 0.04 && t < 0.96) trailDot(pointAt(a, b, t, arc), color, dot);
    }, 45);
    timer.unref?.();
  }
  const stop = () => { s.stop?.(); clearInterval(timer); s.n.remove(); };
  return new Promise((resolve) => { anim.onfinish = () => { stop(); resolve(); }; anim.oncancel = () => { stop(); resolve(); }; });
}

function playLoop(s) {
  let f = 0;
  const id = setInterval(() => { f = (f + 1) % s.sp.frames; s.n.style.backgroundPosition = s.sp.pos(f); }, 70);
  s.n.classList.add('px'); s.n.style.backgroundImage = s.sp.image; s.n.style.backgroundSize = s.sp.size; s.n.style.backgroundPosition = s.sp.pos(0);
  s.stop = () => clearInterval(id);
}

/** Ondas que se expanden en el agua después de una salpicadura. */
export function ripple(at, size) {
  if (!animationsFull()) return Promise.resolve();
  const ring = (delay) => {
    const n = el('div', { class: 'fx-ring' });
    n.style.width = `${size}px`; n.style.height = `${Math.round(size * 0.6)}px`; n.style.marginLeft = `${-size / 2}px`; n.style.marginTop = `${-size * 0.3}px`;
    return ephemeral(n, [{ transform: 'scale(.3)', opacity: 0.9 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520, delay, easing: 'steps(6)' }, at);
  };
  return Promise.all([ring(0), ring(140)]);
}

/** Impacto en una casilla: salpicadura/polvo/hojas si falla; explosión si acierta; explosión grande al hundir (sobre toda la unidad). */
export function impact(kind, biome, cellRect, { span = null } = {}) {
  const at = center(cellRect);
  const base = Math.round(cellRect.width * 1.5);
  if (kind === 'miss') {
    const splash = burst(IMPACT[biome] ?? 'splash', at, base, { fps: 14 });
    if (biome === 'water' || biome === 'pirate') ripple(at, Math.round(cellRect.width * 2.2));
    return splash;
  }
  const hit = burst('impact', at, base, { fps: 16 });
  if (kind !== 'sunk') return hit;
  const c = span ? center(span) : at;
  const big = span ? Math.max(span.width, span.height) * 1.1 : base * 2;
  return hit.then(() => burst('boom', c, Math.round(big), { fps: 12 }));
}

/** Aviso flotante (por ejemplo «¡Racha ×3!») que sube y se desvanece. */
export function popText(text, at, { color = '#f2b823' } = {}) {
  if (!animationsFull()) return Promise.resolve();
  const n = el('div', { class: 'fx-text' }, text);
  n.style.color = color;
  return ephemeral(n, [
    { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-14px) scale(1.15)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-34px) scale(1)', opacity: 0 },
  ], { duration: 1100, easing: 'steps(10)' }, at);
}

/** Destello de pantalla completa (hundimiento / último golpe). */
export function screenFlash(color = '#ffffff', { peak = 0.35, ms = 260 } = {}) {
  if (!animationsFull()) return Promise.resolve();
  const n = el('div', { class: 'fx-screen' });
  n.style.background = color;
  return ephemeral(n, [{ opacity: peak }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}

/** Sacude un elemento un instante (hundimiento), si el jugador no la desactivó. */
export function shake(node) {
  if (prefersReducedMotion() || !settings.get().shake || !node?.animate) return;
  node.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(-2px,-1px)' }, { transform: 'translate(0,0)' }], { duration: 320, easing: 'ease-out' });
}
