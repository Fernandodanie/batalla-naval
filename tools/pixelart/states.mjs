/** Estados de una unidad: normal · dañada · con humo · en explosión · hundida. Todos derivan del dibujo normal. */
import { Img, rng } from './canvas.mjs';

/** Puntos de daño repartidos por la unidad (deterministas). */
function spots(img, seed, n) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < n * 8 && out.length < n; i++) {
    const x = Math.floor(((out.length + 0.5) / n) * img.w + (r() - 0.5) * 14);
    const y = 16 + Math.round((r() - 0.5) * 12);
    if (img.solid(x, y)) out.push([x, y]);
  }
  return out;
}

const scorch = (img, x, y, r) => {
  img.ellipse(x, y, r, r * 0.8, '#15110e', 0.9);
  img.ellipse(x - 1, y - 1, r * 0.55, r * 0.45, '#2b211a');
  for (const [dx, dy] of [[-r, 0], [r, 1], [0, -r * 0.8], [1, r * 0.8]]) img.set(x + dx, y + dy, '#e8601c', 0.9);
  img.set(x + 1, y, '#ffb21e'); img.set(x, y - 1, '#ffd84d');
};

export function damaged(base, seed = 1) {
  const img = base.clone(); const r = rng(seed);
  for (const [x, y] of spots(img, seed, Math.max(1, Math.round(base.w / 52)))) {
    scorch(img, x, y, 2.4 + r() * 1.4);
    for (let k = 0; k < 5; k++) img.setOn(x + Math.round((r() - 0.5) * 9), y + Math.round((r() - 0.5) * 7), '#1a1612');
  }
  return img;
}

const puff = (img, x, y, rad, tone) => {
  const c = [['#4a4e57', '#6a6f79', '#8e939c'], ['#555a63', '#777c86', '#a3a8b0']][tone % 2];
  img.ellipse(x + 1, y + 1, rad, rad, c[0], 0.85);
  img.ellipse(x, y, rad, rad, c[1], 0.9);
  img.ellipse(x - rad * 0.3, y - rad * 0.3, rad * 0.5, rad * 0.5, c[2], 0.85);
};

/** Con humo: daño + nubes que suben y se agrandan (3 cuadros). */
export function smoking(base, seed, frames = 3) {
  const dm = damaged(base, seed); const pts = spots(dm, seed + 7, Math.max(2, Math.round(base.w / 40)));
  return Array.from({ length: frames }, (_, f) => {
    const img = dm.clone();
    pts.forEach(([x, y], i) => {
      const ph = (f + i) % frames;
      img.ellipse(x, y, 1.6, 1.6, f % 2 ? '#ffb21e' : '#ff7a1a'); // brasa
      puff(img, x + ph * 1.5, y - 3 - ph * 3, 3 + ph * 0.9, i + f);
      if (ph < 2) puff(img, x - 2, y - 1 - ph * 2, 2, i);
    });
    return img;
  });
}

const fireball = (img, x, y, r) => {
  img.ellipse(x, y, r + 1, r + 1, '#b8280f', 0.9);
  img.ellipse(x, y, r, r * 0.92, '#e8501c');
  img.ellipse(x - 0.5, y - 0.5, r * 0.72, r * 0.68, '#ff8a1e');
  img.ellipse(x - 1, y - 1, r * 0.45, r * 0.42, '#ffd23d');
  img.ellipse(x - 1, y - 1, r * 0.2, r * 0.2, '#fff6c8');
};

/** En explosión: la unidad se oscurece y estallan bolas de fuego (3 cuadros). */
export function exploding(base, seed, frames = 3) {
  const dark = base.map((p) => [p[0] * 0.55, p[1] * 0.5, p[2] * 0.5, p[3]]);
  const pts = spots(dark, seed + 3, Math.max(2, Math.round(base.w / 34)));
  const R = [[4, 6, 5], [6, 8, 6], [5, 4, 7]];
  return Array.from({ length: frames }, (_, f) => {
    const img = dark.clone(); const r = rng(seed + f * 11);
    pts.forEach(([x, y], i) => {
      fireball(img, x, y, R[f % 3][i % 3] + (base.w > 150 ? 1 : 0));
      for (let k = 0; k < 5; k++) { const a = r() * 6.28; const d = 6 + r() * 7 + f * 2; img.set(x + Math.cos(a) * d, y + Math.sin(a) * d, k % 2 ? '#ffd23d' : '#ff7a1a'); }
    });
    return img;
  });
}

/** Hundida: silueta oscura bajo el agua (mar) o restos calcinados (tierra, selva). 2 cuadros. */
export function sunk(base, biome, seed, frames = 2) {
  const water = biome === 'water' || biome === 'pirate';
  const r0 = rng(seed);
  return Array.from({ length: frames }, (_, f) => {
    const img = new Img(base.w, base.h);
    if (water) {
      const wreck = base.map((p, x, y) => [p[0] * 0.16 + 10, p[1] * 0.2 + 28, p[2] * 0.28 + 52, p[3] * 0.82]);
      img.blit(wreck.map((p, x, y) => ((x + y + f) % 7 === 0 ? [p[0] + 14, p[1] + 26, p[2] + 40, p[3]] : p)));
      const r = rng(seed);
      for (let i = 0; i < 4; i++) img.ellipse(10 + r() * (base.w - 20), 16 + (r() - 0.5) * 14, 5 + r() * 5, 2 + r() * 2, '#050a14', 0.45); // mancha de aceite
      for (let i = 0; i < Math.max(3, base.w / 22); i++) { // burbujas
        const bx = 8 + ((i * 37 + f * 13 + seed) % (base.w - 16)); const by = 8 + ((i * 11 + f * 7) % 16);
        img.ring(bx, by, 2.2, 2.2, '#cfe8ff', 0.8); img.set(bx - 1, by - 1, '#ffffff');
      }
      for (let x = 0; x < base.w; x++) for (let y = 0; y < base.h; y++) if (!img.solid(x, y) && base.solid(x, y)) img.set(x, y, '#9fd0ff', 0.25);
    } else {
      const char = base.map((p, x, y) => { const g = (p[0] + p[1] + p[2]) / 3; return [g * 0.22 + 22, g * 0.2 + 20, g * 0.2 + 18, p[3] * 0.95]; });
      img.blit(char);
      for (let i = 0; i < base.w / 5; i++) {
        const x = Math.floor(r0() * base.w); const y = 5 + Math.floor(r0() * 22);
        if (img.solid(x, y)) img.set(x, y, (i + f) % 3 === 0 ? '#ff7a1a' : '#3a342e');
      }
      for (let i = 0; i < Math.max(2, base.w / 40); i++) puff(img, 14 + ((i * 41 + f * 9) % (base.w - 24)), 10 + f * 2 - (i % 2) * 3, 2.5 + (i + f) % 2, i);
    }
    return img;
  });
}
