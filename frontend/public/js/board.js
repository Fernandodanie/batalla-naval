import { el } from './dom.js';
import { applySprite, atlas, fxSpec, tileFor, unitSpec } from './atlas.js';
import { markerImage, unitImage } from './sprites.js';

/** Marcador permanente de fallo según el terreno (pixel art). */
const MISS_FX = { water: 'rippleMark', pirate: 'rippleMark', land: 'craterMark', jungle: 'bushMark' };

export const colLabel = (col) => String.fromCharCode(65 + col);
export const coord = (row, col) => `${colLabel(col)}${row + 1}`;

const STATE_TEXT = { 0: 'sin disparar', 1: 'agua', 2: 'tocado', 3: 'hundido' };

// No se acumulan listeners ni observadores cuando comienza una nueva ronda.
const mountedBoards = new WeakMap();

/**
 * Dibuja un tablero size × size como una cuadrícula de botones con letras arriba y números al lado.
 * Se crea una vez por tamaño y luego solo se actualizan las clases (paint).
 */
export function createBoard(container, size, { onCell, onHover, onLeave, biome = 'water' } = {}) {
  mountedBoards.get(container)?.destroy();
  container.replaceChildren();
  container.classList.add('board');
  container.dataset.biome = biome;
  container.classList.toggle('px', atlas.ok);
  container.style.setProperty('--n', String(size));

  // Todo se coloca de forma explícita en la cuadrícula (fila 1 y columna 1 son las etiquetas) para que la capa de
  // sprites pueda superponerse sin desplazar a las casillas.
  const at = (node, row, col) => { node.style.setProperty('grid-row', String(row)); node.style.setProperty('grid-column', String(col)); return node; };
  container.append(at(el('span', { class: 'lbl corner' }), 1, 1));
  for (let c = 0; c < size; c++) container.append(at(el('span', { class: 'lbl col' }, colLabel(c)), 1, c + 2));

  // Terreno animado (pixel art): detrás de las casillas, que son transparentes en modo píxel.
  const terrain = at(el('div', { class: 'terrain', 'aria-hidden': 'true' }), 2, 2);
  terrain.style.setProperty('grid-area', `2 / 2 / ${size + 2} / ${size + 2}`);
  container.append(terrain);

  const cells = [];
  for (let r = 0; r < size; r++) {
    container.append(at(el('span', { class: 'lbl row' }, r + 1), r + 2, 1));
    for (let c = 0; c < size; c++) {
      const b = at(el('button', { type: 'button', class: 'cell', tabindex: '-1', dataset: { r, c } }), r + 2, c + 2);
      cells.push(b);
      container.append(b);
    }
  }
  // Capa de unidades y marcadores: encima de las casillas, sin recibir clics.
  const layer = at(el('div', { class: 'layer', 'aria-hidden': 'true' }), 2, 2);
  layer.style.setProperty('grid-area', `2 / 2 / ${size + 2} / ${size + 2}`);
  container.append(layer);
  const sprites = new Map(); // clave → nodo (se reutilizan para no repetir animaciones)
  let lastArgs = null;
  let tile = 32;
  const cellPx = () => (container.clientWidth ? (container.clientWidth - 24) / size : 0);
  const rectOf = (i) => cells[i].getBoundingClientRect();

  const locate = (e) => {
    const b = e.target.closest?.('.cell');
    return b ? [Number(b.dataset.r), Number(b.dataset.c)] : null;
  };
  const handleClick = (e) => { const rc = locate(e); if (rc && onCell) onCell(...rc); };
  const handleHover = (e) => { const rc = locate(e); if (rc && onHover) onHover(...rc); };
  const handleLeave = () => onLeave?.();
  container.addEventListener('click', handleClick);
  container.addEventListener('mouseover', handleHover);
  container.addEventListener('mouseleave', handleLeave);

  /** Posición de una unidad en la capa: fila/columna de inicio y alto/ancho en casillas. */
  const spanOf = (cellIdx) => {
    const first = cellIdx[0];
    const horizontal = cellIdx.length < 2 || cellIdx[1] === first + 1;
    return { r: Math.floor(first / size), c: first % size, horizontal, len: cellIdx.length };
  };
  const place = (node, { r, c, horizontal, len }) => {
    node.style.setProperty('grid-row', `${r + 1} / span ${horizontal ? 1 : len}`);
    node.style.setProperty('grid-column', `${c + 1} / span ${horizontal ? len : 1}`);
  };

  /** Una unidad como sprite del atlas (pixel art) o, si no hay atlas, como el dibujo SVG de antes. */
  const unitNode = (ship, sp, state, ghost = null) => {
    const dead = state === 'sunk';
    const n = el('div', { class: `sprite${dead ? ' dead' : ''}${ghost ? ` ghost ${ghost}` : ''}` });
    const spec = atlas.ok ? unitSpec(tile, container.dataset.biome, ship.length, ship.id, !sp.horizontal, state) : null;
    if (spec) applySprite(n, spec, { offset: ship.cells[0] });
    else n.style.setProperty('--img', unitImage(container.dataset.biome, ship.length, ship.id, !sp.horizontal));
    place(n, sp);
    return n;
  };

  /** Sincroniza unidades, marcadores de disparo y la unidad fantasma de la colocación. */
  function syncLayer({ shots, ships, preview, last, hold }) {
    const want = new Map();
    const mode = atlas.ok ? tile : 'svg';
    const drawnDead = new Set();
    for (const ship of ships ?? []) {
      if (!ship.cells?.length) continue;
      const override = hold?.ships && Object.hasOwn(hold.ships, ship.id) ? hold.ships[ship.id] : undefined;
      if (override === null) continue; // todavía no se revela (se hunde después del impacto)
      const state = override ?? ship.state ?? (ship.sunk ? 'sunk' : 'normal');
      const sp = spanOf(ship.cells);
      if (state === 'sunk') for (const i of ship.cells) drawnDead.add(i);
      want.set(`u:${ship.id}:${ship.cells[0]}:${sp.horizontal ? 'h' : 'v'}:${state}:${mode}`, () => unitNode(ship, sp, state));
    }
    if (preview?.def && preview.cells.length === preview.def.length) {
      const sp = spanOf(preview.cells);
      const ghost = { id: preview.def.id, length: preview.def.length, cells: preview.cells };
      want.set(`g:${preview.def.id}:${preview.cells[0]}:${sp.horizontal ? 'h' : 'v'}:${preview.ok ? 1 : 0}:${mode}`, () => unitNode(ghost, sp, 'normal', preview.ok ? 'ok' : 'bad'));
    }
    if (shots) {
      for (let i = 0; i < shots.length; i++) {
        const v = shots[i];
        if (!v || hold?.index === i) continue;
        const kind = v === 1 ? 'miss' : v === 3 ? 'sunk' : 'hit';
        if (atlas.ok && kind === 'sunk' && drawnDead.has(i)) continue; // los restos de la unidad ya se ven en su sprite
        want.set(`m:${i}:${kind}:${mode}`, () => {
          const n = el('div', { class: `mark ${kind}` });
          const fx = atlas.ok ? fxSpec(tile, kind === 'miss' ? MISS_FX[container.dataset.biome] ?? 'rippleMark' : kind === 'sunk' ? 'smoke' : 'fire') : null;
          if (fx) applySprite(n, fx, { offset: i }); else n.style.setProperty('--img', markerImage(kind, container.dataset.biome));
          n.style.setProperty('grid-row', String(Math.floor(i / size) + 1));
          n.style.setProperty('grid-column', String((i % size) + 1));
          return n;
        });
      }
    }
    if (last != null && hold?.index !== last) {
      want.set(`l:${last}`, () => {
        const n = el('div', { class: 'lastmark' });
        n.style.setProperty('grid-row', String(Math.floor(last / size) + 1));
        n.style.setProperty('grid-column', String((last % size) + 1));
        return n;
      });
    }
    for (const [key, node] of sprites) if (!want.has(key)) { node.remove(); sprites.delete(key); }
    for (const [key, make] of want) if (!sprites.has(key)) { const node = make(); sprites.set(key, node); layer.append(node); }
  }

  // Si cambia el ancho disponible (giro de pantalla, ventana) puede cambiar el tamaño de sprite elegido (16 o 32 px).
  let resizeObserver = null;
  if (globalThis.ResizeObserver) {
    let w = 0;
    resizeObserver = new ResizeObserver(() => {
      const nw = Math.round(container.clientWidth);
      if (nw !== w && lastArgs) { w = nw; if (atlas.ok && tileFor(cellPx()) !== tile) board.paint(lastArgs); } else w = nw;
    });
    resizeObserver.observe(container);
  }

  const board = {
    size,
    biome,
    cells,
    get cellPx() { return cellPx() || 32; },
    /** Rectángulo en pantalla de una casilla y de la unidad que ocupa varias (para ubicar efectos). */
    cellRect: rectOf,
    unitRect(cellIdx) {
      const a = rectOf(cellIdx[0]); const b = rectOf(cellIdx[cellIdx.length - 1]);
      return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), width: Math.abs(b.right - a.left) || a.width, height: Math.abs(b.bottom - a.top) || a.height, right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
    },
    container,
    destroy() {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseover', handleHover);
      container.removeEventListener('mouseleave', handleLeave);
      resizeObserver?.disconnect();
      for (const n of sprites.values()) n.remove();
      sprites.clear();
      if (mountedBoards.get(container) === board) mountedBoards.delete(container);
    },
    /**
     * @param {{shots?:number[], ships?:{cells:number[],sunk?:boolean}[]|null, last?:number|null,
     *          preview?:{cells:number[],ok:boolean}|null, canShoot?:boolean}} view
     */
    paint({ shots = null, ships = null, last = null, preview = null, canShoot = false, hold = null } = {}) {
      lastArgs = { shots, ships, last, preview, canShoot, hold };
      const t = atlas.ok ? tileFor(cellPx()) : 32;
      if (t !== tile) { tile = t; for (const n of sprites.values()) n.remove(); sprites.clear(); }
      syncLayer({ shots, ships, preview, last, hold });
      const owner = new Map();
      if (ships) for (const s of ships) for (const i of s.cells) owner.set(i, s);
      const pv = preview ? new Set(preview.cells) : null;
      container.classList.toggle('live', canShoot);
      for (let i = 0; i < cells.length; i++) {
        const v = shots && hold?.index !== i ? shots[i] : 0;
        const ship = owner.get(i);
        let cls = 'cell';
        if (ship) cls += ship.sunk ? ' ship dead' : ' ship';
        if (v === 1) cls += ' miss'; else if (v === 2) cls += ' hit'; else if (v === 3) cls += ' sunk';
        if (last === i && hold?.index !== i) cls += ' last';
        if (pv?.has(i)) cls += preview.ok ? ' pv-ok' : ' pv-bad';
        if (canShoot && v === 0) cls += ' open';
        const b = cells[i];
        if (b.className !== cls) b.className = cls;
        const label = `${coord(Math.floor(i / size), i % size)}: ${ship && !v ? 'tu barco' : STATE_TEXT[v] ?? ''}`;
        if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
      }
    },
  };
  mountedBoards.set(container, board);
  return board;
}
