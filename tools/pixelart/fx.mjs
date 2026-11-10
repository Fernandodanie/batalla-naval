/** Efectos de 32×32: proyectil, salpicadura, polvo, hojas, impacto, explosión, fuego, humo, marcadores y mira. */
import { Img, rng } from './canvas.mjs';

const S = 32;
const frames = (n, fn) => Array.from({ length: n }, (_, i) => { const img = new Img(S, S); fn(img, i, n); return img; });

const droplets = (img, r, cx, cy, n, spread, c, up = 1) => {
  for (let i = 0; i < n; i++) { const a = r() * 6.28; const d = spread * (0.5 + r() * 0.6); img.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 - up * r() * 3, c); }
};

export const FX = {
  /** Proyectil apuntando a la derecha (azul → rojo, como la hoja de referencia: parpadea). */
  projectile: () => frames(6, (img, i) => {
    const hot = ['#4fb3ff', '#2f8cff', '#7fd0ff', '#2f8cff', '#ffb21e', '#ff6a2a'][i];
    for (let k = 1; k <= 8; k++) img.ellipse(16 - k * 1.6, 16, Math.max(0.6, 2.2 - k * 0.22), Math.max(0.6, 2.2 - k * 0.22), hot, 0.55 - k * 0.05);
    img.ellipse(18, 16, 4, 3, hot, 0.5); img.ellipse(19, 16, 2.6, 2.2, '#ffffff', 0.95); img.set(21, 16, '#ffffff');
  }),
  /** Proyectil de tierra: granada de mortero con estela de humo gris y brillo naranja. */
  'projectile-land': () => frames(6, (img, i) => {
    for (let k = 1; k <= 9; k++) img.ellipse(15 - k * 1.7, 16 + Math.sin(k + i) * 0.8, 1.2 + k * 0.35, 1.0 + k * 0.3, k % 2 ? '#6b6258' : '#8a8176', Math.max(0.08, 0.62 - k * 0.06));
    img.ellipse(18, 16, 4.6, 3.4, i % 2 ? '#ffb21e' : '#ff8a2a', 0.35);
    img.ellipse(19, 16, 3.2, 2.4, '#3b4a2a'); img.rect(21, 15, 2, 2, '#c9d1a0'); img.set(17, 15, '#ffe08a');
  }),
  /** Proyectil de selva: disparo trazador, fino y muy brillante, con rastro amarillo. */
  'projectile-jungle': () => frames(6, (img, i) => {
    for (let k = 1; k <= 7; k++) img.rect(Math.round(20 - k * 2.2), 16, 2, 1, '#fff2a0', Math.max(0.1, 0.85 - k * 0.11));
    img.ellipse(21, 16, 3, 1.6, ['#fff7c2', '#ffe36a', '#fff7c2', '#ffd23a', '#fff7c2', '#ffe36a'][i], 0.9);
    img.rect(21, 15, 3, 2, '#ffffff'); img.set(18, 15, '#9fe870', 0.8); img.set(18, 17, '#9fe870', 0.8);
  }),
  /** Proyectil pirata: bala de cañón negra con chispas y humo. */
  'projectile-pirate': () => frames(6, (img, i) => {
    const r = rng(i + 40);
    for (let k = 1; k <= 6; k++) img.ellipse(14 - k * 1.8, 16 + (r() - 0.5) * 2, 1.4 + k * 0.3, 1.2 + k * 0.25, '#7a7f86', Math.max(0.08, 0.5 - k * 0.07));
    for (let k = 0; k < 4; k++) img.set(Math.round(12 - r() * 8), Math.round(14 + r() * 5), k % 2 ? '#ffb21e' : '#ffffff');
    img.ellipse(19, 16, 3.6, 3.6, '#16181c'); img.ellipse(18, 15, 1.2, 1.1, '#5a6068'); img.set(22, 13, '#ffe08a'); img.set(23, 12, '#ff8a2a');
  }),
  splash: () => frames(6, (img, i) => {
    const r = rng(i + 1);
    img.ring(16, 18, 4 + i * 2, 2.6 + i * 1.2, '#cfe9ff', 0.9 - i * 0.11);
    if (i < 5) img.ring(16, 18, 2 + i * 1.2, 1.4 + i * 0.7, '#ffffff', 0.9 - i * 0.12);
    const h = [4, 9, 12, 10, 6, 2][i];
    for (let k = -2; k <= 2; k++) img.rect(16 + k * 2 - 1, 18 - h + Math.abs(k) * 2, 2, h - Math.abs(k) * 2, k === 0 ? '#ffffff' : '#a8d8ff', 0.95);
    droplets(img, r, 16, 14, 9, 6 + i * 1.6, '#e6f4ff');
  }),
  dust: () => frames(6, (img, i) => {
    const r = rng(i + 9);
    const rad = 3 + i * 2.2; const a = 0.95 - i * 0.14;
    for (let k = 0; k < 6; k++) img.ellipse(16 + Math.cos(k) * rad * 0.7, 18 + Math.sin(k * 2) * rad * 0.5 - i, rad * 0.55, rad * 0.5, k % 2 ? '#b59f6a' : '#8c7a4c', a);
    img.ellipse(16, 18, rad * 0.5, rad * 0.4, '#d9c690', a * 0.7);
    droplets(img, r, 16, 16, 8, 5 + i * 1.8, '#5a4a2a');
  }),
  leaves: () => frames(6, (img, i) => {
    const r = rng(i + 21);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * 6.28 + 0.3; const d = 2 + i * 2.4 + r() * 3;
      const x = 16 + Math.cos(a) * d; const y = 17 + Math.sin(a) * d * 0.8 - i * 0.6;
      img.poly([[x, y - 2], [x + 2, y], [x, y + 2], [x - 2, y]], ['#2f6f2a', '#4b9a3d', '#7bc65a'][k % 3], 0.95 - i * 0.12);
    }
    img.ellipse(16, 18, Math.max(1, 5 - i), Math.max(1, 3 - i * 0.5), '#1d3b17', 0.7 - i * 0.1);
  }),
  impact: () => frames(5, (img, i) => {
    const r = rng(i + 33); const rad = [5, 9, 11, 8, 4][i];
    img.ellipse(16, 16, rad + 1, rad + 1, '#b8280f', 0.9 - i * 0.1);
    img.ellipse(16, 16, rad, rad, '#e8501c', 0.95); img.ellipse(15.5, 15.5, rad * 0.7, rad * 0.7, '#ff8a1e');
    img.ellipse(15, 15, rad * 0.42, rad * 0.42, '#ffd23d'); if (i < 3) img.ellipse(15, 15, rad * 0.2, rad * 0.2, '#fff6c8');
    for (let k = 0; k < 10; k++) { const a = r() * 6.28; const d = rad + 2 + r() * 5; img.set(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, k % 2 ? '#ffd23d' : '#ff7a1a'); }
  }),
  boom: () => frames(6, (img, i) => {
    const r = rng(i + 41); const rad = [6, 10, 13, 12, 9, 6][i];
    const c = i > 3 ? ['#3a3d44', '#50545d', '#6a6f79'] : ['#e8501c', '#ff8a1e', '#ffd23d'];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28; img.ellipse(16 + Math.cos(a) * rad * 0.45, 16 + Math.sin(a) * rad * 0.45, rad * 0.55, rad * 0.55, c[0], 0.95 - i * 0.07); }
    img.ellipse(16, 16, rad * 0.8, rad * 0.8, c[1]); img.ellipse(15, 15, rad * 0.45, rad * 0.45, c[2]);
    if (i < 4) img.ellipse(15, 15, rad * 0.2, rad * 0.2, '#fff6c8');
    for (let k = 0; k < 12; k++) { const a = r() * 6.28; const d = rad + 1 + r() * 6; img.set(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, k % 2 ? '#ffd23d' : '#8a8f98'); }
  }),
  /** Marcador permanente de tocado: llamas que bailan (4 cuadros). */
  fire: () => frames(4, (img, i) => {
    const r = rng(i + 5);
    img.ellipse(16, 21, 8, 5, '#17120e', 0.55);
    for (const [bx, w, h] of [[11, 4, 10], [16, 5, 13], [21, 4, 9]]) {
      const hh = h + ((i + bx) % 3) - 1;
      img.poly([[bx - w / 2, 22], [bx, 22 - hh], [bx + w / 2, 22]], '#e8501c');
      img.poly([[bx - w / 3, 22], [bx, 22 - hh * 0.72], [bx + w / 3, 22]], '#ff9a1e');
      img.poly([[bx - w / 6, 22], [bx, 22 - hh * 0.4], [bx + w / 6, 22]], '#ffe27a');
    }
    for (let k = 0; k < 3; k++) img.set(10 + r() * 12, 6 + r() * 6, '#ffb21e');
  }),
  /** Marcador de unidad destruida: humo denso que sube (4 cuadros). */
  smoke: () => frames(4, (img, i) => {
    img.ellipse(16, 22, 8, 4, '#0f0d0b', 0.6);
    for (let k = 0; k < 4; k++) {
      const ph = (i + k) % 4; const y = 21 - ph * 4; const rad = 4 + ph * 1.2;
      img.ellipse(13 + k * 2, y, rad, rad, '#3a3d44', 0.85 - ph * 0.12); img.ellipse(12 + k * 2, y - 1, rad * 0.6, rad * 0.6, '#6a6f79', 0.8 - ph * 0.1);
    }
    img.set(14, 22, '#ff7a1a'); img.set(19, 21, '#ffb21e');
  }),
  /** Fallo en el agua: ondas que se expanden despacio (4 cuadros). */
  rippleMark: () => frames(4, (img, i) => {
    img.ring(16, 16, 5 + i * 1.4, 3.6 + i, '#d6ecff', 0.9 - i * 0.16);
    img.ring(16, 16, 2.5 + i * 0.7, 1.8 + i * 0.5, '#ffffff', 0.95 - i * 0.1);
    img.set(16, 16, '#ffffff');
  }),
  craterMark: () => frames(1, (img) => {
    img.ellipse(16, 17, 9, 6, '#4a3a22', 0.9); img.ellipse(16, 17.5, 7, 4.4, '#2a2014'); img.ellipse(15, 18, 4.4, 2.6, '#150f08');
    for (const [x, y] of [[6, 12], [25, 13], [16, 8], [9, 23], [24, 22]]) img.rect(x, y, 2, 2, '#d6c28b', 0.85);
  }),
  bushMark: () => frames(1, (img) => {
    for (const [x, y, c] of [[16, 16, '#2f6f2a'], [12, 12, '#4b9a3d'], [21, 13, '#3a8032'], [11, 20, '#2a5f26'], [21, 21, '#4b9a3d'], [16, 11, '#7bc65a']]) {
      img.poly([[x, y - 5], [x + 4, y], [x, y + 5], [x - 4, y]], c); img.line(x, y - 4, x, y + 4, '#1d3b17', 0.7);
    }
    img.ellipse(16, 16, 1.6, 1.6, '#d9f5c0');
  }),
  /** Mira: círculo rojo con cruz (como la hoja de referencia). */
  aim: () => frames(1, (img) => {
    img.ring(16, 16, 10, 10, '#ff4a4a', 0.95); img.ring(16, 16, 5, 5, '#ffd0d0', 0.8);
    img.rect(15, 2, 2, 8, '#ff4a4a'); img.rect(15, 22, 2, 8, '#ff4a4a'); img.rect(2, 15, 8, 2, '#ff4a4a'); img.rect(22, 15, 8, 2, '#ff4a4a');
    img.set(16, 16, '#ffffff'); img.set(15, 16, '#ffffff'); img.set(16, 15, '#ffffff');
  }),
};

// ------------------------------------------------------------------ terrenos (4 cuadros de 32×32, sin costuras)
const rand = (seed) => rng(seed);
/**
 * Terrenos de 32px de detalle fino y una paleta contenida: mar profundo,
 * litoral corsario, suelo seco y sotobosque. Las cuatro fases animan solo
 * reflejos/vegetación; la textura base se conserva para que no parpadee.
 */
export function terrain(biome) {
  const pal = {
    water:  { base: '#244d69', low: '#193d57', mid: '#315f7a', shine: '#83acb8', glint: '#b0c8c8' },
    pirate: { base: '#245363', low: '#16414c', mid: '#326b72', shine: '#89b9ab', glint: '#c6d1ae' },
    land:   { base: '#96835f', low: '#6b6149', mid: '#ae9a70', shine: '#c4b68d', glint: '#dfcea0' },
    jungle: { base: '#31573b', low: '#1b3e2d', mid: '#4e7146', shine: '#779364', glint: '#a9ad70' },
  }[biome];
  if (!pal) throw new Error(`Bioma desconocido: ${biome}`);
  return Array.from({ length: 4 }, (_, frame) => {
    const im = new Img(S, S);
    const seed = { water: 1701, pirate: 2813, land: 3929, jungle: 4177 }[biome];
    const r = rand(seed);
    im.rect(0, 0, S, S, pal.base);
    const put = (x, y, color, opacity = 1) => im.set((Math.round(x) + S * 3) % S, (Math.round(y) + S * 3) % S, color, opacity);
    const dab = (x, y, rx, ry, color, opacity = 1) => {
      for (let oy = -ry; oy <= ry; oy++) for (let ox = -rx; ox <= rx; ox++)
        if ((ox * ox) / Math.max(1, rx * rx) + (oy * oy) / Math.max(1, ry * ry) <= 1) put(x + ox, y + oy, color, opacity);
    };
    // Formas de fondo, deliberadamente de bajo contraste para no tapar las unidades.
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(r() * S), y = Math.floor(r() * S);
      dab(x, y, 2 + Math.floor(r() * 5), 1 + Math.floor(r() * 3), i % 3 ? pal.low : pal.mid, .28);
    }
    for (let i = 0; i < 108; i++) {
      put(Math.floor(r() * S), Math.floor(r() * S), i % 5 === 0 ? pal.shine : i % 3 ? pal.low : pal.mid, .22 + r() * .33);
    }
    if (biome === 'water' || biome === 'pirate') {
      // Olas oblicuas, pequeñas espumas y fragmentos de luz difusa, sin azul eléctrico.
      for (const [x, y, length] of [[4, 8, 8], [20, 24, 9], [25, 6, 6], [7, 27, 7], [13, 15, 5]]) {
        const shift = [0, 1, 2, 1][frame];
        for (let k = 0; k < length; k++) {
          if (k % 4 !== 3) put(x + k + shift, y + (k % 5 === 2 ? -1 : 0), pal.shine, .43 + (k % 3) * .12);
          if (k % 3 === 1) put(x + k + shift, y + 2, pal.low, .52);
        }
        put(x + 1 + shift, y - 2, pal.glint, .42);
      }
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(r() * S), y = Math.floor(r() * S);
        put(x, y, pal.mid, .6); if (i % 4 === 0) put(x + 1, y - 1, pal.shine, .38);
      }
    } else if (biome === 'land') {
      // Piedra, tierra compacta, grietas muy finas y matas secas sobre suelo beige.
      for (let i = 0; i < 17; i++) {
        const x = Math.floor(r() * S), y = Math.floor(r() * S);
        dab(x, y, 1 + (i % 3 === 0 ? 1 : 0), 1, i % 2 ? pal.low : pal.mid, .58);
        put(x - 1, y - 1, pal.glint, .36);
      }
      for (const [x, y] of [[5, 6], [22, 11], [14, 23], [28, 27], [9, 17]]) {
        put(x, y, '#64654c', .66); put(x + 1, y - 1, '#73734e', .6); put(x, y - 2, '#c8be91', .5);
        if (frame % 2 === 0) put(x + 2, y, '#a9a36d', .32);
      }
      for (const [x,y] of [[3,20],[19,5],[26,17]]) {
        for (let i=0;i<4;i++) put(x+i, y+(i===2?1:0), '#64553f', .27);
      }
    } else {
      // Copas diminutas, hojas superpuestas, raíces y helechos en 32 píxeles.
      for (const [x,y] of [[5,6],[21,11],[11,23],[29,26],[28,3]]) {
        dab(x + 1, y + 2, 5, 4, '#173927', .7);
        dab(x, y, 4, 3, '#315f3a', .9);
        dab(x - 1, y - 1, 2, 2, '#5f8250', .76);
        put(x - 2, y - 2, '#a4ab75', .47);
        put(x + 3, y + 1, '#6d9455', .62);
        const flutter = [0, 0, 1, 0][frame];
        put(x - 1 + flutter, y - 3, pal.shine, .7);
      }
      for (let i = 0; i < 15; i++) {
        const x = Math.floor(r() * S), y = Math.floor(r() * S);
        put(x, y, '#1c442b', .9); put(x + 1, y - 1, '#708c56', .6);
      }
      for (const [x,y] of [[2,17],[14,3],[24,23]]) {
        put(x,y,'#294d2d',.9);put(x+1,y-1,'#8c9b5b',.62);put(x-1,y+1,'#1b3b29',.82);
      }
    }
    return im;
  });
}

export const FX_NAMES = Object.keys(FX);
