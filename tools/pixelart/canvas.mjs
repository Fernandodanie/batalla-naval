/** Lienzo de píxeles RGBA y codificador PNG sin dependencias (solo node:zlib). */
import zlib from 'node:zlib';

const cache = new Map();
export function rgba(c, a = 1) {
  if (Array.isArray(c)) return c;
  const key = `${c}|${a}`;
  let v = cache.get(key);
  if (!v) {
    let h = String(c).replace('#', '');
    if (h.length === 3) h = [...h].map((x) => x + x).join('');
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(a * 255)];
    cache.set(key, v);
  }
  return v;
}

/** Generador pseudoaleatorio determinista (mulberry32): el arte sale igual en cada ejecución. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { if (!this.inb(x, y)) return [0, 0, 0, 0]; const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  solid(x, y) { return this.inb(x, y) && this.d[(y * this.w + x) * 4 + 3] > 127; }
  /** Pone un píxel componiendo "por encima" si el color es translúcido. */
  set(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (!this.inb(x, y)) return;
    const [r, g, b, al] = rgba(c, a);
    const i = (y * this.w + x) * 4;
    const d = this.d;
    if (al >= 255) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; return; }
    const sa = al / 255; const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }
  /** Solo pinta donde ya hay algo (para detalles encima de un casco, sin salirse). */
  setOn(x, y, c, a = 1) { if (this.solid(Math.round(x), Math.round(y))) this.set(x, y, c, a); }
  rect(x, y, w, h, c, a = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0); const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  ellipse(cx, cy, rx, ry, c, a = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx; const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c, a);
      }
    }
  }
  ring(cx, cy, rx, ry, c, a = 1) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx; const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        const inner = ((rx - 1) / rx) ** 2;
        if (d <= 1 && d >= Math.max(0, inner)) this.set(x, y, c, a);
      }
    }
  }
  poly(pts, c, a = 1) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
        const yy = y + 0.5;
        if ((y1 <= yy && y2 > yy) || (y2 <= yy && y1 > yy)) xs.push(x1 + ((yy - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c, a);
    }
  }
  blit(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const p = src.get(x, y);
      if (p[3]) this.set(ox + x, oy + y, p);
    }
    return this;
  }
  clone() { const c = new Img(this.w, this.h); c.d.set(this.d); return c; }
  /** Intercambia filas y columnas: la figura horizontal (proa a la derecha) queda vertical (proa hacia abajo). */
  transpose() { const t = new Img(this.h, this.w); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const p = this.get(x, y); if (p[3]) t.set(y, x, p); } return t; }
  crop(x0, y0, w, h) { const t = new Img(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = this.get(x0 + x, y0 + y); if (p[3]) t.set(x, y, p); } return t; }
  /** Borde de 1 píxel alrededor de todo lo opaco (convención del pixel art). */
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.solid(x, y)) continue;
      if (this.solid(x + 1, y) || this.solid(x - 1, y) || this.solid(x, y + 1) || this.solid(x, y - 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }
  /** Sombra proyectada: la silueta desplazada, translúcida, debajo de la figura. */
  withShadow(dx, dy, c = '#000', a = 0.28) {
    const out = new Img(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.solid(x, y)) out.set(x + dx, y + dy, c, a);
    return out.blit(this);
  }
  map(fn) { const o = new Img(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const p = this.get(x, y); if (p[3]) { const q = fn(p, x, y); if (q) o.set(x, y, q); } } return o; }
  /** Reducción a la mitad eligiendo el color más frecuente de cada bloque de 2×2 (conserva la paleta). */
  half() {
    const o = new Img(this.w >> 1, this.h >> 1);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const px = [this.get(2 * x, 2 * y), this.get(2 * x + 1, 2 * y), this.get(2 * x, 2 * y + 1), this.get(2 * x + 1, 2 * y + 1)];
      const solid = px.filter((p) => p[3] > 127);
      if (solid.length < 2) continue;
      const count = new Map();
      for (const p of solid) { const k = p.join(','); count.set(k, (count.get(k) ?? 0) + 1); }
      let best = null; let n = 0;
      for (const [k, v] of count) if (v > n || (v === n && k < best)) { best = k; n = v; }
      const [r, g, b] = best.split(',').map(Number);
      const al = Math.round(solid.reduce((s, p) => s + p[3], 0) / solid.length);
      o.set(x, y, [r, g, b, al]);
    }
    return o;
  }
}

// ------------------------------------------------------------------ PNG
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

export function encodePng(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    Buffer.from(img.d.buffer, img.d.byteOffset + y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Empaqueta tiras (cada una con su ancho y alto) en un atlas con estantes. */
export function pack(items, maxW = 1024, gap = 1) {
  const sorted = [...items].sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w);
  let x = 0; let y = 0; let rowH = 0; let width = 0;
  const placed = [];
  for (const it of sorted) {
    if (x + it.img.w > maxW) { x = 0; y += rowH + gap; rowH = 0; }
    placed.push({ ...it, x, y });
    x += it.img.w + gap; rowH = Math.max(rowH, it.img.h); width = Math.max(width, x);
  }
  const atlas = new Img(width, y + rowH);
  for (const p of placed) atlas.blit(p.img, p.x, p.y);
  return { atlas, placed };
}

/** Lee un PNG de 8 bits (RGBA o RGB, sin entrelazado): lo que exportan Aseprite, LibreSprite y Piskel. */
export function decodePng(buf) {
  let p = 8; let w = 0; let h = 0; let ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG: solo 8 bits y sin entrelazado'); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (ct !== 6 && ct !== 2) throw new Error('PNG: usa RGBA o RGB (no paleta indexada)');
  const bpp = ct === 6 ? 4 : 3; const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp;
  const cur = Buffer.alloc(stride); let prev = Buffer.alloc(stride); const img = new Img(w, h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0; const b = prev[i]; const c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = x * bpp; img.set(x, y, [cur[o], cur[o + 1], cur[o + 2], bpp === 4 ? cur[o + 3] : 255]); }
    prev = Buffer.from(cur);
  }
  return img;
}
