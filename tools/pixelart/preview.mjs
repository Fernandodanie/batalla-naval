import fs from 'node:fs';
import { Img, encodePng } from './canvas.mjs';
import { BIOMES, SLOTS, drawUnit, T } from './units.mjs';
const out = process.argv[2] ?? '/tmp/preview.png';
const bg = { water: '#1f5a96', pirate: '#1a6a8a', land: '#9b8b5d', jungle: '#2b6330' };
const sheet = new Img(T * 7 + 8, (T + 4) * SLOTS.length * BIOMES.length);
let y = 0;
for (const b of BIOMES) for (const [len, v] of SLOTS) {
  sheet.rect(0, y, sheet.w, T + 4, bg[b]);
  sheet.blit(drawUnit(b, len, v), 4, y + 2);
  y += T + 4;
}
fs.writeFileSync(out, encodePng(sheet));
