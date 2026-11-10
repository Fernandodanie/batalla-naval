/**
 * Unidades en vista superior, dibujadas píxel a píxel con paletas fijas. Cada dibujo es horizontal (proa a la derecha),
 * de (32 × largo) × 32 píxeles. La versión vertical se obtiene transponiendo (ver generate.mjs).
 *
 * Para sustituir una unidad por arte de un dibujante: guarda su PNG con el mismo tamaño y nombre en
 * tools/pixelart/manual/<escenario>-<ranura>.png (ver README de esta carpeta).
 */
import { Img, rng } from './canvas.mjs';

export const T = 32;

// ------------------------------------------------------------------ casco con perfil de proa y popa
const hull = (img, x0, x1, yc, hh, pal, { bow = 0.24, stern = 0.08 } = {}) => {
  const L = x1 - x0;
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / L;
    let h = hh;
    if (t > 1 - bow) { const u = (t - (1 - bow)) / bow; h = hh * Math.sqrt(Math.max(0.02, 1 - u * u * 0.97)); }
    if (t < stern) { const u = 1 - t / stern; h = hh * (1 - 0.22 * u * u); }
    const top = Math.round(yc - h); const bot = Math.round(yc + h);
    for (let y = top; y <= bot; y++) {
      const dt = y - top; const db = bot - y;
      let c = pal.mid;
      if (dt === 0) c = pal.hi; else if (dt === 1) c = pal.light; else if (db === 0) c = pal.dark; else if (db === 1 && bot - top > 5) c = pal.dark2 ?? pal.dark;
      img.set(x, y, c);
    }
  }
};

const box = (img, x, y, w, h, base, hi, lo, win = null) => {
  img.rect(x, y, w, h, base);
  img.rect(x, y, w, 1, hi); img.rect(x, y, 1, h, hi);
  img.rect(x, y + h - 1, w, 1, lo); img.rect(x + w - 1, y, 1, h, lo);
  if (win && w > 4 && h > 3) img.rect(x + w - 3, y + 1, 1, h - 2, win);
};

const turret = (img, cx, cy, r, dir = 1, barrels = 2) => {
  const sp = barrels === 1 ? [0] : barrels === 3 ? [-2, 0, 2] : [-1.5, 1.5];
  for (const o of sp) img.rect(dir > 0 ? cx : cx - Math.round(r * 2.2), Math.round(cy + o) - 0, Math.round(r * 2.2), 1, '#0e131c');
  for (const o of sp) img.set(dir > 0 ? cx + Math.round(r * 2.2) : cx - Math.round(r * 2.2), Math.round(cy + o), '#8a97ab');
  img.ellipse(cx, cy, r + 0.7, r + 0.7, '#161d2b');
  img.ellipse(cx, cy, r, r, '#3b4961');
  img.ellipse(cx - 0.6, cy - 0.7, r * 0.55, r * 0.5, '#6d80a0');
  img.set(cx - 1, cy - 1, '#c6d3e6');
};

const funnel = (img, cx, cy, rx, ry) => {
  img.ellipse(cx, cy, rx + 0.6, ry + 0.6, '#161d2b');
  img.ellipse(cx, cy, rx, ry, '#2a3348');
  img.ellipse(cx + 0.5, cy, rx * 0.55, ry * 0.55, '#0c1018');
};

/** Espuma de estela alrededor de la silueta (tramado de píxeles blancos translúcidos). */
const foam = (img, reach = 2) => {
  const add = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.solid(x, y)) continue;
    let near = false;
    for (let dy = -reach; dy <= reach && !near; dy++) for (let dx = -reach; dx <= reach; dx++) if (img.solid(x + dx, y + dy)) { near = true; break; }
    if (near && (x + y) % 2 === 0) add.push([x, y]);
  }
  for (const [x, y] of add) img.set(x, y, '#ffffff', 0.34);
};

const finish = (img, { edge = '#10151f', shadow = [2, 2], water = false } = {}) => {
  // Luz de arriba-izquierda y sombra baja: píxeles de volumen, sin filtros borrosos.
  const highlights = [];
  const shadows = [];
  for (let y = 2; y < img.h - 2; y++) for (let x = 2; x < img.w - 2; x++) {
    if (!img.solid(x, y)) continue;
    if ((!img.solid(x, y - 1) || !img.solid(x - 1, y)) && (x + y) % 3 !== 0) highlights.push([x,y]);
    if ((!img.solid(x, y + 1) || !img.solid(x + 1, y)) && (x * 2 + y) % 4 !== 0) shadows.push([x,y]);
  }
  for (const [x,y] of highlights) img.setOn(x, y, '#f3e6d0', .19);
  for (const [x,y] of shadows) img.setOn(x, y, '#121b20', .22);
  img.outline(edge);
  const out = shadow ? img.withShadow(shadow[0], shadow[1]) : img;
  if (water) foam(out, 2);
  return out;
};

// ================================================================== MAR · flota moderna
const NAV = { hi: '#b2c3d9', light: '#8396b4', mid: '#5a6c88', dark: '#3a4863', dark2: '#2d3a52' };

function destroyer(len) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  hull(img, 3, W - 3, yc, 7.6, { ...NAV, mid: '#6e819e' }, { bow: 0.34 });
  hull(img, 8, W - 14, yc, 4.8, { hi: '#93a5c0', light: '#7f93b0', mid: '#6a7d9a', dark: '#4a5b78' }, { bow: 0.1 });
  turret(img, W - 18, yc, 2.8, 1, 1);
  box(img, 22, yc - 4, 9, 8, '#8b9db8', '#cbd7e7', '#4a5a76', '#1b2436');
  funnel(img, 18, yc - 1, 2, 2); funnel(img, 12, yc, 2, 2);
  img.rect(9, yc - 2, 2, 4, '#c9343b'); // popa: tubos lanzatorpedos
  turret(img, 6, yc, 1.5, -1, 1);
  img.rect(W - 8, yc - 1, 5, 2, '#d9e3f0'); // helipuerto
  return finish(img, { water: true });
}

function cruiser(len) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  hull(img, 3, W - 3, yc, 10, NAV, { bow: 0.26 });
  hull(img, 9, W - 16, yc, 7, { hi: '#9aadc8', light: '#8497b4', mid: '#6d809e', dark: '#4a5b78' }, { bow: 0.08 });
  turret(img, W - 22, yc, 3.4, 1, 2); turret(img, W - 38, yc, 3.4, 1, 2);
  box(img, 46, yc - 5, 12, 10, '#8d9fba', '#d0dbea', '#44536e', '#1b2436');
  funnel(img, 40, yc, 3, 3);
  turret(img, 14, yc, 3.2, -1, 2);
  img.rect(W - 12, yc - 1, 6, 2, '#e8b730');
  return finish(img, { water: true });
}

function submarine(len) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  const pal = { hi: '#5b7098', light: '#43577c', mid: '#2f3f5e', dark: '#1d2840', dark2: '#161e32' };
  hull(img, 3, W - 3, yc, 7.4, pal, { bow: 0.3, stern: 0.22 });
  hull(img, 4, 20, yc, 5.6, { hi: '#c94a4f', light: '#c9343b', mid: '#a82a33', dark: '#7a1f27' }, { bow: 0, stern: 0.5 }); // popa roja
  for (let x = 26; x < W - 14; x += 5) img.rect(x, yc - 4, 1, 8, '#1a2338', 0.6); // junturas
  box(img, 46, yc - 4, 14, 8, '#56688a', '#9ab0d2', '#222c44', null);
  img.ellipse(52, yc, 2.2, 2.2, '#2a3550'); img.set(51, yc - 1, '#9ab0d2');
  img.rect(54, yc - 1, 5, 1, '#8aa0c4'); // periscopio
  img.rect(8, yc - 1, 3, 2, '#e8b730');
  return finish(img, { water: true });
}

function battleship(len) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  const hh = len >= 6 ? 12 : 11;
  hull(img, 2, W - 2, yc, hh, NAV, { bow: 0.2 });
  hull(img, 8, W - 14, yc, hh - 3, { hi: '#9db0cb', light: '#8699b6', mid: '#6f829f', dark: '#4a5b78' }, { bow: 0.1 });
  const nT = len === 4 ? 3 : len === 6 ? 4 : 5;
  const xs = Array.from({ length: nT }, (_, i) => W - 16 - (i * (W - 46)) / Math.max(1, nT - 1));
  xs.forEach((x, i) => turret(img, Math.round(x), yc, 3.8, i === nT - 1 ? -1 : 1, i % 2 ? 3 : 2));
  const bx = Math.round(W * 0.45);
  box(img, bx, yc - 6, 14, 12, '#8d9fba', '#d3deec', '#44536e', '#1b2436');
  box(img, bx + 3, yc - 4, 6, 8, '#a9b9d0', '#e3ebf5', '#58688a');
  img.rect(bx + 5, yc - 1, 2, 2, '#c9343b');
  funnel(img, bx - 6, yc, 3, 3);
  if (len >= 6) funnel(img, bx + 22, yc, 3, 3);
  if (len >= 7) funnel(img, bx + 30, yc, 3, 3);
  return finish(img, { water: true });
}

function carrier(len) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  hull(img, 2, W - 2, yc, 13.5, { hi: '#aebed4', light: '#8b9db9', mid: '#62738f', dark: '#3a4863', dark2: '#2c3750' }, { bow: 0.12, stern: 0.05 });
  hull(img, 4, W - 12, yc, 11.5, { hi: '#5c6679', light: '#4d576b', mid: '#434c5f', dark: '#363e50' }, { bow: 0.1, stern: 0.02 });
  for (let x = 8; x < W - 20; x += 9) img.rect(x, yc, 5, 1, '#e8b730');
  img.rect(8, yc - 10, W - 22, 1, '#d9e3f0', 0.7); img.rect(8, yc + 10, W - 22, 1, '#d9e3f0', 0.7);
  for (let x = W - 24; x < W - 12; x++) img.set(x, yc, '#e8b730');
  box(img, 62, yc - 13, 16, 6, '#8d9fba', '#d3deec', '#44536e', '#1b2436'); // isla (a un costado)
  img.line(70, yc - 14, 70, yc - 15, '#c9d5e6');
  for (const [px, py] of [[14, yc - 4], [24, yc + 3], [34, yc - 3]]) { // aviones
    img.rect(px, py, 8, 1, '#dfe6ef'); img.rect(px + 3, py - 3, 2, 7, '#dfe6ef'); img.rect(px + 7, py, 1, 1, '#c9343b'); img.rect(px, py - 1, 1, 3, '#dfe6ef');
  }
  img.rect(W - 40, yc + 4, 5, 3, '#2d3750'); img.rect(W - 32, yc - 7, 5, 3, '#2d3750'); // ascensores
  return finish(img, { water: true });
}

// ================================================================== MAR · piratas
const WOOD = { hi: '#c98a52', light: '#a8683a', mid: '#7b4b26', dark: '#4e2d13', dark2: '#3a210e' };

function pirate(len, variant) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  const hh = [0, 0, 7, 8.2, 9.2, 10.4, 11.2, 12][len];
  hull(img, 3, W - 6, yc, hh, WOOD, { bow: 0.3, stern: 0.12 });
  hull(img, 7, W - 14, yc, hh - 2.5, { hi: '#c98a52', light: '#b3763f', mid: '#9a6234', dark: '#7b4b26' }, { bow: 0.1 });
  for (let x = 9; x < W - 16; x += 3) img.rect(x, yc - hh + 2, 1, Math.round(hh * 2 - 3), '#4e2d13', 0.5); // tablones
  for (let x = 12; x < W - 18; x += 6) { img.set(x, yc - hh + 0.5, '#161008'); img.set(x, yc + hh - 0.5, '#161008'); } // portas de cañón
  if (len >= 4) { box(img, 6, yc - hh + 3, 12, Math.round(hh * 2 - 6), '#b3763f', '#d9a468', '#6a4020'); } // castillo de popa
  if (len >= 6) for (let x = 20; x < W - 24; x += 5) img.set(x, yc, '#e8b730');
  const masts = len === 2 ? 1 : len === 3 ? 2 : len === 4 ? 3 : len === 5 ? 3 : len === 6 ? 4 : 5;
  const x0 = 18; const x1 = W - 16;
  for (let i = 0; i < masts; i++) {
    const x = Math.round(masts === 1 ? W * 0.5 : x0 + ((x1 - x0) * i) / (masts - 1));
    const s = Math.min(hh + 4, 15) - (i === masts - 1 ? 2 : 0);
    const sail = variant && i % 2 ? '#e2cf9c' : '#f1e6c6';
    img.poly([[x - 3, yc - s], [x + 3, yc - s + 2], [x + 6, yc - 2], [x + 6.6, yc], [x + 6, yc + 2], [x + 3, yc + s - 2], [x - 3, yc + s]], sail);
    img.poly([[x + 2, yc - s + 2], [x + 4, yc - s + 3], [x + 6.6, yc], [x + 4, yc + s - 3], [x + 2, yc + s - 2]], '#d6c391');
    for (let k = -s + 3; k < s - 2; k += 4) img.line(x - 3, yc + k, x + 4, yc + k + 1, '#cdb985', 0.8);
    img.line(x - 3, yc - s, x - 3, yc + s, '#6a5a3a');
    img.ellipse(x - 0.5, yc, 2.2, 2.2, '#3a210e'); img.set(x - 1, yc - 1, '#9a6234');
  }
  const fx = x0 - 4;
  img.poly([[fx, yc - 5], [fx - 7, yc - 3], [fx, yc - 1.5]], variant ? '#11141b' : '#c9343b'); img.line(fx, yc - 6, fx, yc, '#e9e6da');
  img.line(W - 6, yc, W + 0, yc, '#4e2d13'); img.line(W - 9, yc, W - 1, yc - 1, '#4e2d13'); // bauprés
  if (len >= 7) for (let x = 6; x < W - 12; x += 3) { img.setOn(x, yc - hh + 1, '#e8b730'); img.setOn(x, yc + hh - 1, '#e8b730'); }
  return finish(img, { edge: '#1c0f06', water: true });
}

// ================================================================== TIERRA · siglo XIX
const COAT = '#2c4c8f'; const COATH = '#4b72bf'; const COATD = '#1c3262';

const soldierL = (img, x, y, { coat = COAT, hi = COATH, hat = '#b52a2a', pack = '#6b4a2a', rifle = true } = {}) => {
  img.ellipse(x, y, 2.6, 3.6, coat); img.rect(x - 1, y - 3, 3, 1, hi); img.rect(x - 2, y - 2, 1, 3, hi, 0.7);
  img.line(x - 2, y - 2, x + 2, y + 2, '#e9e6da', 0.9); img.line(x + 2, y - 2, x - 2, y + 2, '#e9e6da', 0.9); // correajes cruzados
  img.rect(x - 4, y - 2, 2, 4, pack); // mochila
  img.set(x - 4, y - 2, '#c09a5c'); img.set(x - 1, y + 4, COATD); img.set(x + 2, y + 4, COATD); // herrajes y botas
  img.ellipse(x + 1.2, y, 2.1, 2.1, hat); img.rect(x + 2, y - 1, 1, 2, '#d9ab7a'); img.set(x + 0, y - 1, '#e8b730');
  if (rifle) { img.line(x - 2, y + 4, x + 6, y + 3, '#3b2815'); img.set(x + 7, y + 3, '#b9c2cf'); }
};

const horse = (img, x, y, { body = '#7a4a28', dark = '#4e2d15', light = '#a06a3a', rider = true, coat = COAT } = {}) => {
  img.ellipse(x, y, 7, 3.4, body);
  img.ellipse(x - 0.5, y - 1.2, 6, 1.6, light, 0.8);
  img.ellipse(x + 7, y, 2.8, 1.8, body); img.rect(x + 8, y - 1, 2, 1, light); // cuello y cabeza
  img.rect(x - 8, y - 1, 3, 1, dark); img.rect(x - 9, y, 2, 2, dark); // cola
  img.set(x + 7, y - 2, dark); img.set(x + 7, y + 2, dark);
  if (rider) {
    img.ellipse(x - 0.5, y, 2.6, 2.8, coat); img.rect(x - 2, y - 2, 4, 1, COATH);
    img.ellipse(x, y, 1.4, 1.4, '#b52a2a'); img.set(x + 1, y, '#d9ab7a');
    img.line(x - 3, y + 3, x + 8, y - 5, '#3b2815'); img.set(x + 9, y - 6, '#e9e9e0'); // lanza
  }
};

const cannon = (img, x, y, { dir = 1 } = {}) => {
  img.rect(x - 6, y - 1, 9, 3, '#7b4b26'); img.rect(x - 6, y - 1, 9, 1, '#a8683a'); // cureña
  img.rect(x - 2, y - 5, 4, 2, '#3a210e'); img.rect(x - 2, y + 3, 4, 2, '#3a210e'); // ruedas
  img.set(x - 1, y - 5, '#8a6a3a'); img.set(x - 1, y + 4, '#8a6a3a');
  img.rect(x, y - 1, 15 * dir, 3, '#8a6a2e'); img.rect(x, y - 1, 15 * dir, 1, '#d2a94a'); img.rect(x + 13 * dir, y - 2, 2, 5, '#6e5322');
  img.ellipse(x + 2, y, 2.4, 2.4, '#6e5322'); img.set(x + 1, y - 1, '#d2a94a');
};

const flag = (img, x, y, c = '#c9343b') => {
  img.line(x, y, x, y - 8, '#e9e6da'); img.poly([[x, y - 8], [x + 6, y - 6.5], [x, y - 5]], c);
};

function rows(img, x, y, cols, rws, dx, dy, opts) {
  if (dy < 7) dy = 7;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rws; r++) soldierL(img, x + c * dx, y + r * dy, opts);
}

function landUnit(len, variant) {
  const W = T * len; const yc = 16; const img = new Img(W, T);
  if (len === 2) {
    horse(img, 20, 10, { body: '#7a4a28' }); horse(img, 42, 21, { body: '#3a2a22', dark: '#1d140f', light: '#5a4034' });
  } else if (len === 3 && !variant) {
    rows(img, 14, 7, 6, 4, 14, 7, {}); flag(img, 6, 18);
  } else if (len === 3) {
    cannon(img, 24, 10); cannon(img, 24, 24); cannon(img, 62, 10, { dir: 1 }); cannon(img, 62, 24);
    soldierL(img, 8, 10, {}); soldierL(img, 8, 24, {}); img.ellipse(80, 12, 2, 2, '#2a2622'); img.ellipse(84, 14, 2, 2, '#2a2622'); img.ellipse(82, 10, 2, 2, '#3a3632');
  } else if (len === 4) {
    horse(img, 18, 8, { body: '#7a4a28' }); horse(img, 18, 24, { body: '#d8d4c8', dark: '#8a857a', light: '#f2efe6' });
    horse(img, 52, 8, { body: '#3a2a22', dark: '#1d140f', light: '#5a4034' }); horse(img, 52, 24, { body: '#8a5a30' });
    horse(img, 86, 8, { body: '#7a4a28' }); horse(img, 86, 24, { body: '#a06a3a', dark: '#4e2d15', light: '#c48a52' });
    horse(img, 114, 16, { body: '#2a211c', dark: '#150f0c', light: '#473830', coat: '#8b2a2a' }); flag(img, 104, 20, '#e8b730');
  } else if (len === 5) {
    rows(img, 12, 5, 9, 4, 15, 7, {}); flag(img, 4, 18);
    img.ellipse(145, 16, 3, 3, '#6b4a2a'); img.ellipse(145, 16, 2, 2, '#e9e6da'); // tambor
    horse(img, 120, 26, { body: '#7a4a28' }); flag(img, 148, 28, '#e8b730');
  } else if (len === 6) {
    rows(img, 12, 5, 7, 4, 15, 7, {}); flag(img, 4, 18);
    cannon(img, 126, 9); cannon(img, 126, 23); cannon(img, 160, 9); cannon(img, 160, 23);
    horse(img, 180, 16, { body: '#d8d4c8', dark: '#8a857a', light: '#f2efe6', coat: '#8b2a2a' });
  } else {
    rows(img, 12, 5, 7, 4, 15, 7, {}); flag(img, 4, 18);
    rows(img, 118, 5, 3, 4, 15, 7, { coat: '#6a2b2b', hi: '#8e4444', hat: '#e9e9e0' });
    cannon(img, 172, 9); cannon(img, 172, 23);
    img.rect(190, 7, 18, 8, '#8a6a3a'); img.rect(190, 7, 18, 1, '#b38a4e'); img.ellipse(194, 15, 2, 2, '#3a210e'); img.ellipse(204, 15, 2, 2, '#3a210e'); // carreta
    horse(img, 214, 22, { body: '#7a4a28' });
  }
  return finish(img, { edge: '#1d140f', shadow: [1, 2] });
}

// ================================================================== SELVA · soldados
const CAMO = ['#35552b', '#6a8036', '#243a1c', '#4a6b32'];

const trooper = (img, x, y, i, { lead = false, kind = 'rifle' } = {}) => {
  img.ellipse(x, y, 3.4, 4.2, '#5f8a3c');
  for (let k = 0; k < 7; k++) img.setOn(x - 3 + ((k * 3 + i) % 6), y - 3 + ((k * 2 + i) % 7), CAMO[(k + i) % 3 === 0 ? 2 : 1], 1);
  img.rect(x - 2, y - 4, 4, 1, '#9bbf5a'); // reflejo en el hombro
  img.rect(x - 5, y - 2, 2, 4, '#3a4a2a'); // mochila
  img.set(x - 5, y - 2, '#a7a57b'); img.set(x - 2, y + 4, '#223321'); img.set(x + 1, y + 4, '#223321'); // equipo y botas
  img.ellipse(x + 1.4, y, 2.4, 2.4, lead ? '#b3302f' : '#8fae5e'); img.set(x + 1, y - 1, lead ? '#e56a68' : '#c4dc92'); // casco o boina
  img.rect(x + 3, y - 1, 1, 2, '#d9ab7a');
  if (kind === 'rifle') { img.line(x - 1, y + 3, x + 7, y + 2, '#171a17'); img.set(x + 8, y + 2, '#9aa19a'); }
  if (kind === 'machete') { img.line(x + 2, y + 3, x + 6, y + 4, '#aeb7b2'); }
  if (kind === 'radio') { img.rect(x - 6, y - 2, 3, 5, '#2a2f2a'); img.line(x - 5, y - 2, x - 7, y - 7, '#cfd6d2'); }
};

const tent = (img, x, y, w, h) => {
  img.rect(x, y, w, h, '#556b3a'); img.rect(x, y, w, 1, '#7a9150'); img.rect(x, y + h - 1, w, 1, '#2f3f22');
  img.rect(x + Math.floor(w / 2), y, 1, h, '#2f3f22');
};

const sandbags = (img, x, y, n, vertical = false) => {
  for (let i = 0; i < n; i++) { const px = vertical ? x : x + i * 4; const py = vertical ? y + i * 4 : y; img.ellipse(px + 2, py + 1.5, 2.4, 1.8, '#b59f6a'); img.set(px + 1, py + 1, '#d9c690'); }
};

function jungleUnit(len, variant) {
  const W = T * len; const img = new Img(W, T);
  const zig = (n, x0, step, opts = (i) => ({})) => { for (let i = 0; i < n; i++) trooper(img, x0 + i * step, i % 2 ? 22 : 10, i, opts(i)); };
  if (len === 2) { zig(3, 10, 18, (i) => ({ lead: i === 2 })); }
  else if (len === 3 && !variant) { zig(6, 10, 15, (i) => ({ lead: i === 5, kind: i === 1 ? 'radio' : 'rifle' })); }
  else if (len === 3) { zig(5, 10, 17, (i) => ({ kind: i % 2 ? 'machete' : 'rifle', lead: i === 4 })); }
  else if (len === 4) { zig(8, 10, 14, (i) => ({ lead: i === 7, kind: i === 3 ? 'radio' : 'rifle' })); }
  else if (len === 5) { zig(9, 10, 16, (i) => ({ lead: i % 4 === 3, kind: i === 4 ? 'radio' : 'rifle' })); sandbags(img, 140, 6, 5, true); sandbags(img, 140, 24, 4); }
  else if (len === 6) { zig(9, 10, 15, (i) => ({ lead: i === 8 })); tent(img, 150, 6, 18, 10); sandbags(img, 150, 22, 6); tent(img, 172, 18, 16, 9); }
  else { zig(10, 10, 15, (i) => ({ lead: i === 9, kind: i === 4 ? 'radio' : 'rifle' })); tent(img, 166, 5, 20, 10); tent(img, 190, 14, 22, 10); sandbags(img, 166, 23, 8); img.line(214, 8, 214, 0 + 1, '#e9e6da'); img.poly([[214, 1], [221, 3], [214, 5]], '#e8b730'); }
  return finish(img, { edge: '#0e140d', shadow: [1, 2] });
}

// ================================================================== tabla de unidades
export const BIOMES = ['water', 'pirate', 'land', 'jungle'];
/** Ranuras por escenario: largo y variante (solo el largo 3 tiene dos: a y b). */
export const SLOTS = [[2, 0], [3, 0], [3, 1], [4, 0], [5, 0], [6, 0], [7, 0]];
export const slotName = (len, variant) => (len === 3 ? (variant ? '3b' : '3a') : String(len));

export function drawUnit(biome, len, variant) {
  switch (biome) {
    case 'pirate': return pirate(len, variant);
    case 'land': return landUnit(len, variant);
    case 'jungle': return jungleUnit(len, variant);
    default:
      if (len === 2) return destroyer(len);
      if (len === 3) return variant ? submarine(len) : cruiser(len);
      if (len === 5) return carrier(len);
      return battleship(len);
  }
}

export { rng };
