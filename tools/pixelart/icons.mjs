/**
 * Genera los íconos de la app instalable (PWA) en frontend/public/img/: icon-192.png, icon-512.png y
 * icon-maskable-512.png (con margen de seguridad). Determinista, como el resto del arte.
 *   node tools/pixelart/icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, encodePng, rng } from './canvas.mjs';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/public/img');
const N = 64;

/** Ícono base de 64×64: cielo al amanecer, mar con olas, un buque y una estrella dorada. */
export function baseIcon({ safe = false } = {}) {
  const img = new Img(N, N);
  const bandsList = ['#1c2f66', '#2c3f86', '#5a5e9c', '#c9788a', '#f2a577', '#fbd098'];
  const sea = ['#3e6a96', '#345c88', '#2a4e78', '#204068'];
  const horizon = 38;
  for (let y = 0; y < horizon; y++) { const k = Math.min(bandsList.length - 1, Math.floor((y / horizon) * bandsList.length)); img.rect(0, y, N, 1, bandsList[k]); }
  for (let y = horizon; y < N; y++) { const k = Math.min(sea.length - 1, Math.floor(((y - horizon) / (N - horizon)) * sea.length)); img.rect(0, y, N, 1, sea[k]); }
  img.ellipse(44, horizon - 1, 9, 9, '#fff2c0', 0.35); img.ellipse(44, horizon - 1, 6, 6, '#fff2c0');
  const r = rng(7);
  for (let y = horizon + 3; y < N; y += 4) for (let x = Math.floor(r() * 5); x < N; x += 8 + Math.floor(r() * 4)) img.rect(x, y, 3, 1, r() > 0.5 ? '#86b4d6' : '#204068');
  // buque (silueta)
  const hull = '#56626e'; const top = '#9aa6b2';
  img.poly([[10, 40], [54, 40], [49, 48], [15, 48]], hull);
  img.rect(22, 33, 20, 7, top); img.rect(28, 27, 8, 6, hull); img.rect(31, 18, 2, 9, '#2a2e34'); img.rect(44, 36, 8, 3, top);
  // estrella dorada
  const star = [[32, 6], [35, 13], [43, 13], [37, 18], [39, 26], [32, 21], [25, 26], [27, 18], [21, 13], [29, 13]];
  img.poly(star.map(([x, y]) => [x, y - 2]), '#f2b823');
  img.rect(31, 12, 2, 5, '#fff0b0');
  if (!safe) return img;
  // versión «maskable»: se reduce y se centra para que el recorte circular/redondeado no corte nada importante
  const m = new Img(N, N); m.rect(0, 0, N, N, '#204068');
  const k = 0.72; const off = Math.round((N - N * k) / 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = Math.min(N - 1, Math.floor((x - off) / k)); const sy = Math.min(N - 1, Math.floor((y - off) / k));
    if (sx < 0 || sy < 0 || x < off || y < off || x >= N - off || y >= N - off) continue;
    const p = img.get(sx, sy); m.set(x, y, p);
  }
  return m;
}

/** Amplía sin suavizar (vecino más cercano). */
export function upscale(src, size) {
  const k = size / src.w;
  const dst = new Img(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const p = src.get(Math.floor(x / k), Math.floor(y / k)); dst.set(x, y, p); }
  return dst;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(out, { recursive: true });
  const plain = baseIcon(); const safe = baseIcon({ safe: true });
  fs.writeFileSync(path.join(out, 'icon-192.png'), encodePng(upscale(plain, 192)));
  fs.writeFileSync(path.join(out, 'icon-512.png'), encodePng(upscale(plain, 512)));
  fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), encodePng(upscale(safe, 512)));
  console.log('íconos generados en frontend/public/img/');
}
