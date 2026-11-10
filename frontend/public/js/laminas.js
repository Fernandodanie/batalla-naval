/**
 * Láminas: tarjetas en pixel art que se ganan al cumplir una misión. Cada una es una imagen ya terminada (marco dorado, título,
 * leyenda y estrellas dentro del PNG), así que aquí no se dibuja nada encima: se muestra, se descarga tal cual, se comparte y
 * se junta en un ZIP. Solo los formatos «cuadrada» y «vertical» (redes) colocan la tarjeta, sin tocarla, sobre un fondo liso.
 *
 * Dónde viven las imágenes (carpeta fija del proyecto):
 *   img/laminas-hd/<id>.png       tarjeta completa, 1394×1128
 *   img/laminas-hd/min/<id>.webp  miniatura de 480 px para la galería y el aviso de recompensa
 */
import { zipStore } from './zip.js';

export const ART = Object.freeze({ w: 1394, h: 1128 });
export const THUMB = Object.freeze({ w: 480, h: 388 });
const MARGIN = 0.05;          // aire a cada lado en los formatos para redes (proporción del ancho de la tarjeta)
const BACKDROP = '#2a2118';   // fondo liso de los formatos para redes

export const laminaUrl = (id) => `img/laminas-hd/${id}.png`;
export const laminaThumbUrl = (id) => `img/laminas-hd/min/${id}.webp`;

/** Formatos de imagen: horizontal (la tarjeta tal cual), cuadrada (publicaciones) y vertical 9:16 (historias). */
export const FORMATS = Object.freeze({ landscape: 'Horizontal', square: 'Cuadrada', story: 'Vertical (historias)' });
const SUFFIX = { landscape: '', square: '-cuadrada', story: '-vertical' };

/** Nombre de archivo al descargar. */
export const fileName = (id, format = 'landscape') => `batalla-naval-${id}${SUFFIX[format] ?? ''}.png`;

/**
 * Medidas del lienzo y dónde va la tarjeta. Horizontal = la tarjeta a su tamaño; cuadrada y vertical = lienzo más grande con la
 * tarjeta centrada y sin deformar. Un formato desconocido se trata como horizontal.
 */
export function layoutFor(format = 'landscape') {
  const fmt = FORMATS[format] ? format : 'landscape';
  const edge = fmt === 'landscape' ? 0 : Math.round(ART.w * MARGIN);
  const width = ART.w + edge * 2;
  const height = fmt === 'landscape' ? ART.h : fmt === 'square' ? width : Math.round((width * 16) / 9);
  return { format: fmt, width, height, art: { x: edge, y: Math.round((height - ART.h) / 2), w: ART.w, h: ART.h } };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`no se pudo cargar ${url}`));
    img.src = url;
  });
}

/**
 * Dibuja la lámina en un lienzo (para verla en el visor).
 * @param {{id:string}} lamina
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderLamina(lamina, { format = 'landscape' } = {}) {
  const L = layoutFor(format);
  const art = await loadImage(laminaUrl(lamina.id));
  const canvas = document.createElement('canvas');
  canvas.width = L.width; canvas.height = L.height;
  const g = canvas.getContext('2d');
  if (L.format !== 'landscape') { g.fillStyle = BACKDROP; g.fillRect(0, 0, L.width, L.height); }
  g.imageSmoothingQuality = 'high';
  g.drawImage(art, L.art.x, L.art.y, L.art.w, L.art.h);
  return canvas;
}

const canvasBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no se pudo crear la imagen'))), 'image/png'));

/** El PNG a entregar: en horizontal, el archivo original sin tocar (misma calidad); en los otros formatos, la tarjeta sobre su fondo. */
async function laminaBlob(lamina, format) {
  if (!FORMATS[format] || format === 'landscape') {
    const res = await fetch(laminaUrl(lamina.id));
    if (!res.ok) throw new Error(`no se pudo cargar ${laminaUrl(lamina.id)}`);
    return new Blob([await res.arrayBuffer()], { type: 'image/png' });
  }
  return canvasBlob(await renderLamina(lamina, { format }));
}

/** Descarga la lámina como PNG. */
export async function downloadLamina(lamina, { format = 'landscape' } = {}) {
  const blob = await laminaBlob(lamina, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName(lamina.id, format);
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** ¿Puede este dispositivo compartir un archivo con el menú del sistema? */
export function canShareFiles() {
  try {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] });
  } catch { return false; }
}

/** Comparte con el menú del sistema (celulares); si no se puede, la descarga. Devuelve 'shared' | 'downloaded' | 'cancelled'. */
export async function shareLamina(lamina, { format = 'landscape' } = {}) {
  if (!canShareFiles()) { await downloadLamina(lamina, { format }); return 'downloaded'; }
  const file = new File([await laminaBlob(lamina, format)], fileName(lamina.id, format), { type: 'image/png' });
  try {
    await navigator.share({ files: [file], title: `${lamina.title} · Batalla Naval`, text: `${lamina.title}: ${lamina.caption}` });
    return 'shared';
  } catch (err) {
    return err?.name === 'AbortError' ? 'cancelled' : (await downloadLamina(lamina, { format }), 'downloaded');
  }
}

/** Descarga todas las láminas indicadas en un solo ZIP. @param {{id:string}[]} laminas */
export async function downloadPack(laminas, { format = 'landscape' } = {}) {
  const files = [];
  for (const lamina of laminas) {
    const blob = await laminaBlob(lamina, format);
    files.push({ name: fileName(lamina.id, format), data: new Uint8Array(await blob.arrayBuffer()) });
  }
  const url = URL.createObjectURL(new Blob([zipStore(files)], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'batalla-naval-laminas.zip';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return files.length;
}
