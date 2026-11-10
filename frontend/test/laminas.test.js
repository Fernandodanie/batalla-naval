import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { LAMINAS } from '../../backend/src/domain/laminas.js';
import { ART, FORMATS, THUMB, fileName, laminaThumbUrl, laminaUrl, layoutFor } from '../public/js/laminas.js';
import { crc32, zipStore } from '../public/js/zip.js';

const dir = new URL('../public/img/laminas-hd/', import.meta.url);
const png = (id) => readFileSync(new URL(`${id}.png`, dir));
const thumb = (id) => readFileSync(new URL(`min/${id}.webp`, dir));

test('cada lámina del catálogo tiene su PNG de 1394×1128 y su miniatura WebP en la carpeta laminas-hd', () => {
  for (const l of LAMINAS) {
    const b = png(l.id);
    assert.equal(b.subarray(1, 4).toString(), 'PNG', `${l.id}: es un PNG de verdad (no un JPEG con extensión .png)`);
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [ART.w, ART.h], l.id);
    assert.ok(b.length > 100_000 && b.length < 6_000_000, `${l.id}: tamaño razonable (${b.length} B)`);
    const t = thumb(l.id);
    assert.equal(t.subarray(0, 4).toString(), 'RIFF', `${l.id}: miniatura WebP`);
    assert.equal(t.subarray(8, 12).toString(), 'WEBP', l.id);
    assert.ok(t.length > 5_000 && t.length < 250_000, `${l.id}: miniatura liviana (${t.length} B)`);
  }
});

test('la carpeta laminas-hd no tiene archivos de más y las láminas viejas ya no existen', () => {
  const ids = new Set(LAMINAS.map((l) => l.id));
  assert.deepEqual(readdirSync(dir).filter((f) => f !== 'min').sort(), [...ids].map((id) => `${id}.png`).sort());
  assert.deepEqual(readdirSync(new URL('min/', dir)).sort(), [...ids].map((id) => `${id}.webp`).sort());
  assert.equal(existsSync(new URL('../public/img/laminas/', import.meta.url)), false, 'la carpeta de las láminas viejas se borró');
  assert.equal(THUMB.w / THUMB.h > 1.2 && THUMB.w / THUMB.h < 1.25, true);
});

test('los nombres de archivo y las rutas son predecibles', () => {
  assert.equal(laminaUrl('chaco-1'), 'img/laminas-hd/chaco-1.png');
  assert.equal(laminaThumbUrl('chaco-1'), 'img/laminas-hd/min/chaco-1.webp');
  assert.equal(fileName('chaco-1'), 'batalla-naval-chaco-1.png');
  assert.equal(fileName('chaco-1', 'story'), 'batalla-naval-chaco-1-vertical.png');
  assert.equal(fileName('chaco-1', 'square'), 'batalla-naval-chaco-1-cuadrada.png');
  assert.equal(fileName('chaco-1', 'otro'), 'batalla-naval-chaco-1.png');
});

test('formatos: horizontal es la tarjeta tal cual, cuadrada es 1:1, vertical es 9:16, y la tarjeta siempre cabe centrada y sin deformar', () => {
  const land = layoutFor('landscape');
  assert.deepEqual([land.width, land.height], [ART.w, ART.h]);
  assert.deepEqual(land.art, { x: 0, y: 0, w: ART.w, h: ART.h });
  const sq = layoutFor('square');
  assert.equal(sq.width, sq.height);
  const st = layoutFor('story');
  assert.ok(Math.abs(st.height / st.width - 16 / 9) < 0.01, `9:16 (${st.width}×${st.height})`);
  for (const f of Object.keys(FORMATS)) {
    const L = layoutFor(f);
    assert.deepEqual([L.art.w, L.art.h], [ART.w, ART.h], `${f}: no se deforma ni se reescala`);
    assert.ok(L.art.x >= 0 && L.art.y >= 0 && L.art.x + L.art.w <= L.width && L.art.y + L.art.h <= L.height, `${f}: cabe`);
    assert.ok(Math.abs(L.art.x - (L.width - L.art.w - L.art.x)) <= 1 && Math.abs(L.art.y - (L.height - L.art.h - L.art.y)) <= 1, `${f}: centrada`);
  }
  assert.deepEqual(layoutFor('inventado'), layoutFor('landscape'), 'un formato desconocido usa el horizontal');
  assert.deepEqual(layoutFor(), layoutFor('landscape'));
});

test('crc32 coincide con el valor de referencia', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('zipStore arma un ZIP válido: encabezados, directorio central y contenido intacto', () => {
  const a = new Uint8Array(readFileSync(new URL('../public/img/laminas-hd/min/chaco-1.webp', import.meta.url)));
  const b = new TextEncoder().encode('hola ñandú');
  const zip = zipStore([{ name: 'uno.webp', data: a }, { name: 'ñ.txt', data: b }], new Date(2026, 10, 4, 10, 30, 0));
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2, 'dos archivos');
  let p = v.getUint32(end + 16, true); // inicio del directorio central
  const seen = [];
  for (let i = 0; i < 2; i++) {
    assert.equal(v.getUint32(p, true), 0x02014b50);
    const crc = v.getUint32(p + 16, true); const size = v.getUint32(p + 24, true);
    const nLen = v.getUint16(p + 28, true); const off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nLen));
    // el encabezado local apunta al mismo contenido
    assert.equal(v.getUint32(off, true), 0x04034b50);
    const start = off + 30 + v.getUint16(off + 26, true);
    const data = zip.subarray(start, start + size);
    assert.equal(crc32(data), crc, `crc de ${name}`);
    seen.push([name, data]);
    p += 46 + nLen;
  }
  assert.deepEqual(seen.map((s) => s[0]), ['uno.webp', 'ñ.txt']);
  assert.deepEqual([...seen[0][1]], [...a], 'el PNG queda byte a byte igual');
  assert.equal(new TextDecoder().decode(seen[1][1]), 'hola ñandú');
});

test('un ZIP vacío es válido', () => {
  const z = zipStore([]);
  assert.equal(z.length, 22);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x06054b50);
});
