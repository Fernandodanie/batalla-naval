/**
 * Genera el atlas de sprites (PNG + JSON) en frontend/public/img/.   Uso:  node tools/pixelart/generate.mjs
 * Es determinista: el mismo código produce los mismos píxeles. Si existe tools/pixelart/manual/<escenario>-<ranura>.png
 * (por ejemplo land-5.png) se usa ese dibujo (estado "normal") en lugar del generado, y los demás estados se derivan de él.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, decodePng, encodePng, pack } from './canvas.mjs';
import { FX, terrain } from './fx.mjs';
import { damaged, exploding, smoking, sunk } from './states.mjs';
import { BIOMES, SLOTS, T, drawUnit, slotName } from './units.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../frontend/public/img');
fs.mkdirSync(outDir, { recursive: true });

export const STATES = { normal: 1, damaged: 1, smoking: 3, explosion: 3, sunk: 2 };

function strip(frames, vertical) {
  const f = vertical ? frames.map((i) => i.transpose()) : frames;
  const out = new Img(f[0].w * f.length, f[0].h);
  f.forEach((im, i) => out.blit(im, i * im.w, 0));
  return out;
}

function loadManual(biome, slot) {
  const file = path.join(here, 'manual', `${biome}-${slot}.png`);
  if (!fs.existsSync(file)) return null;
  const img = decodePng(fs.readFileSync(file));
  const len = slot === '3a' || slot === '3b' ? 3 : Number(slot);
  if (img.w !== T * len || img.h !== T) throw new Error(`${file}: debe medir ${T * len}×${T} px (mide ${img.w}×${img.h})`);
  console.log(`  usando arte manual: ${biome}-${slot}.png`);
  return img;
}

function build(scale) {
  const items = []; const meta = {};
  const tile = T / scale;
  const sc = (im) => (scale === 2 ? im.half() : im);
  let seed = 100;
  for (const biome of BIOMES) {
    for (const [len, variant] of SLOTS) {
      const slot = slotName(len, variant);
      const base = loadManual(biome, slot) ?? drawUnit(biome, len, variant);
      seed += 13;
      const states = {
        normal: [base], damaged: [damaged(base, seed)], smoking: smoking(base, seed), explosion: exploding(base, seed), sunk: sunk(base, biome, seed),
      };
      for (const [state, frames] of Object.entries(states)) {
        for (const orient of ['h', 'v']) {
          const img = strip(frames.map(sc), orient === 'v');
          items.push({ key: `${biome}/${slot}/${orient}/${state}`, img });
          meta[`${biome}/${slot}/${orient}/${state}`] = { w: img.w / frames.length, h: img.h, frames: frames.length };
        }
      }
    }
  }
  for (const [name, make] of Object.entries(FX)) {
    const frames = make().map(sc); const img = strip(frames, false);
    items.push({ key: `fx/${name}`, img }); meta[`fx/${name}`] = { w: img.w / frames.length, h: img.h, frames: frames.length };
  }
  const { atlas, placed } = pack(items, 1280);
  for (const p of placed) Object.assign(meta[p.key], { x: p.x, y: p.y });
  return { atlas, meta: { tile, image: `atlas-${tile}.png`, sprites: meta } };
}

for (const scale of [1, 2]) {
  const { atlas, meta } = build(scale);
  const name = `atlas-${meta.tile}`;
  fs.writeFileSync(path.join(outDir, `${name}.png`), encodePng(atlas));
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(meta)}\n`);
  console.log(`${name}.png  ${atlas.w}×${atlas.h}  ${Object.keys(meta.sprites).length} sprites`);
}

for (const biome of BIOMES) terrain(biome).forEach((img, i) => fs.writeFileSync(path.join(outDir, `tile-${biome}-${i}.png`), encodePng(img)));
fs.writeFileSync(path.join(outDir, 'aim.png'), encodePng(FX.aim()[0]));
console.log('terrenos y mira generados');
