/**
 * Sprites de unidades y marcadores, generados por código (SVG, sin imágenes externas).
 *
 * Cada unidad se dibuja en horizontal, con la proa a la derecha, en una cuadrícula de 10 unidades por casilla
 * (alto fijo 10, ancho 10 × largo). La versión vertical es la misma figura girada 90°. Así un barco de 5 casillas
 * ocupa exactamente 5 casillas y todo escala con el tamaño del tablero.
 *
 * El dibujo depende del bioma y del largo (y del orden entre unidades del mismo largo, el número del id "3-1"):
 *   water  → flota moderna (vista superior)      pirate → barcos piratas con velas
 *   land   → caballería, infantería y cañones (como el atlas de pixel art; sirve para cualquier época de las campañas)
 *   jungle → escuadras de soldados
 *
 * Desde la 0.6 el dibujo principal es el atlas de pixel art (atlas.js). Este módulo es el respaldo si el atlas no carga.
 */

const C = {
  steel: '#58687f', steelD: '#2b3548', steelL: '#a3b5ca', deck: '#7b8da6', gold: '#e8b730', red: '#c9343b', white: '#eaf0f7',
  wood: '#7b4b26', woodD: '#47290f', woodL: '#b0703c', sail: '#f0e4c4', sailD: '#cdb98a', black: '#16181d',
  olive: '#5f6e3a', oliveD: '#37431f', oliveL: '#8d9d5a', tread: '#262922', sand: '#c4b078',
  camoA: '#34532a', camoB: '#6a8036', camoC: '#243a1c', skin: '#d9ab7a', rifle: '#2a2c2a', beret: '#a22b2b',
};

// ---------------------------------------------------------------- primitivas
const n = (v) => Math.round(v * 100) / 100;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`;
const circ = (x, y, r, fill, extra = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" ${extra}/>`;
const poly = (pts, fill, stroke = '') =>
  `<polygon points="${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.7" stroke-linejoin="round"` : ''}/>`;

/** Casco con proa en punta a la derecha. `m` = margen arriba/abajo, `bow` = largo de la proa. */
const hull = (W, fill, edge, m = 1.4, bow = W * 0.2) =>
  poly([[1.2, m + 1], [2.2, m], [W - bow, m], [W - 0.8, 5], [W - bow, 10 - m], [2.2, 10 - m], [1.2, 9 - m]], fill, edge);

/** Posiciones repartidas entre 18 % y 75 % del largo. */
const spread = (W, count) => Array.from({ length: count }, (_, i) => W * (0.2 + (count === 1 ? 0.2 : (0.55 * i) / (count - 1))));

/** Torreta con cañón; `gun` negativo = apunta hacia atrás. */
const turret = (x, y = 5, r = 2, gun = 3.2) =>
  rect(gun < 0 ? x + gun : x, y - 0.4, Math.abs(gun), 0.8, C.black) + circ(x, y, r, C.steelD) + circ(x - 0.2, y - 0.3, r * 0.62, C.steelL);

// ---------------------------------------------------------------- flota moderna
const NAVAL = {
  carrier(W) {
    const bow = W * 0.16;
    let s = hull(W, C.steel, C.steelD, 1.1, bow) + rect(3, 2.3, W - bow - 3.5, 5.4, C.deck);
    for (let x = 4.5; x < W - bow - 3; x += 4.5) s += rect(x, 4.65, 2.4, 0.7, C.gold);
    s += rect(W * 0.58, 1, 4.8, 2.5, C.steelL, `stroke="${C.steelD}" stroke-width="0.5"`) + rect(W * 0.58 + 1, 1.7, 2.4, 0.9, C.steelD);
    for (const x of [W * 0.2, W * 0.34]) s += rect(x, 4.2, 3, 0.8, C.white) + rect(x + 1, 3.1, 0.9, 3, C.white);
    return s;
  },
  battleship(W) {
    let s = hull(W, C.steel, C.steelD, 1.4, W * 0.2) + rect(2.6, 2.7, W * 0.74, 4.6, C.deck);
    const count = Math.max(2, Math.min(5, Math.round(W / 14)));
    spread(W, count).forEach((x, i) => { s += turret(x, 5, 1.9, i === count - 1 ? -3.2 : 3.2); });
    s += rect(W * 0.52, 3.6, 3.6, 2.8, C.steelL, `stroke="${C.steelD}" stroke-width="0.5"`) + rect(W * 0.52 + 0.8, 4.3, 2, 1.2, C.steelD);
    return s;
  },
  cruiser(W) {
    let s = hull(W, C.steel, C.steelD, 2, W * 0.24) + rect(2.6, 3.2, W * 0.7, 3.6, C.deck);
    spread(W, 2).forEach((x) => { s += turret(x, 5, 1.5, 2.6); });
    s += rect(W * 0.5, 3.8, 2.8, 2.4, C.steelL, `stroke="${C.steelD}" stroke-width="0.5"`);
    return s;
  },
  destroyer(W) {
    let s = hull(W, C.steelL, C.steelD, 2.6, W * 0.3) + rect(2.6, 3.7, W * 0.6, 2.6, C.deck);
    s += turret(W * 0.55, 5, 1.3, 2.2) + rect(W * 0.28, 4, 2.4, 2, C.steelD);
    return s;
  },
  submarine(W) {
    let s = `<rect x="1" y="3" width="${n(W - 2)}" height="4" rx="2" fill="#2d3649" stroke="${C.black}" stroke-width="0.6"/>`;
    s += rect(1.6, 3.6, 2.4, 2.8, C.red) + rect(W * 0.52, 3.4, 3.6, 3.2, '#4a5873', `stroke="${C.black}" stroke-width="0.5"`);
    s += circ(W * 0.52 + 1.8, 5, 0.8, C.steelL) + rect(W * 0.52 + 3.6, 4.85, 2, 0.3, C.steelL);
    return s;
  },
};

// ---------------------------------------------------------------- piratas
const pirateShip = (W, idx) => {
  let s = hull(W, C.wood, C.woodD, 1.6, W * 0.26) + rect(2.6, 2.7, W - W * 0.3, 4.6, C.woodL, 'opacity="0.85"');
  for (let x = 3.4; x < W * 0.74; x += 3) s += rect(x, 2.7, 0.35, 4.6, C.woodD, 'opacity="0.45"'); // tablones
  const masts = Math.max(1, Math.min(4, Math.round(W / 14)));
  spread(W, masts).forEach((x, i) => {
    const sail = i % 2 ? C.sail : '#f6edd2';
    s += poly([[x - 0.6, 0.2], [x + 1.4, 0.7], [x + 1.4, 9.3], [x - 0.6, 9.8]], sail, C.sailD) + circ(x + 0.4, 5, 0.75, C.woodD);
  });
  s += rect(W - W * 0.2, 4.85, W * 0.19, 0.3, C.woodD); // bauprés
  s += poly([[1.6, 4.2], [4.2, 4.8], [1.6, 5.8]], idx % 2 ? C.red : C.black); // bandera
  return s;
};

// ---------------------------------------------------------------- tierra
const translate = (x, inner) => `<g transform="translate(${n(x)} 0)">${inner}</g>`;

const LAND = {
  /** Jinetes vistos desde arriba, mirando a la derecha. */
  cavalry(W) {
    const count = Math.max(1, Math.round(W / 10));
    let s = '';
    for (let i = 0; i < count; i++) {
      const cx = (W / count) * (i + 0.5);
      const cy = count > 1 ? (i % 2 ? 6.3 : 3.7) : 5;
      s += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="3.7" ry="1.8" fill="${C.woodL}" stroke="${C.black}" stroke-width="0.45"/>` +  // cuerpo
        `<ellipse cx="${n(cx + 3.9)}" cy="${n(cy)}" rx="1.5" ry="0.9" fill="${C.wood}" stroke="${C.black}" stroke-width="0.4"/>` +      // cabeza
        rect(cx - 5.6, cy - 0.25, 2.2, 0.5, C.woodD) +                                                                                  // cola
        `<ellipse cx="${n(cx - 0.4)}" cy="${n(cy)}" rx="1.3" ry="1.7" fill="${C.olive}" stroke="${C.black}" stroke-width="0.4"/>` +     // jinete
        circ(cx, cy, 0.95, C.oliveD, `stroke="${C.black}" stroke-width="0.35"`) + rect(cx + 0.4, cy - 0.15, 3.4, 0.3, C.rifle);          // sombrero y lanza
    }
    return s;
  },
  /** Cañón con ruedas, cureña y boca a la derecha. */
  cannon(W) {
    const x0 = Math.max(1.5, W * 0.12);
    return rect(x0 - 1.2, 4.75, W * 0.3, 0.5, C.woodD) +                                                  // cureña (cola)
      rect(x0 + W * 0.1, 1.9, 1.6, 2.4, C.woodD) + rect(x0 + W * 0.1, 5.7, 1.6, 2.4, C.woodD) +            // ruedas
      rect(x0 + W * 0.18, 4.35, W * 0.7 - x0, 1.3, C.black) + rect(W - 1.9, 4.05, 1.3, 1.9, C.black) +      // caña y brocal
      circ(x0 + W * 0.22, 5, 1.5, C.steelD);
  },
  /** Batería: dos cañones en fila. */
  battery(W) {
    const half = W / 2;
    return LAND.cannon(half) + translate(half, LAND.cannon(half));
  },
  /** Columna de infantería de uniforme caqui. */
  infantry(W, idx) {
    return squad(W, idx, [C.olive, C.oliveL]);
  },
  /** Tren de carga con una plataforma de ametralladoras (para las unidades más largas). */
  train(W) {
    const wagons = Math.max(2, Math.round(W / 11));
    const w = (W - 2) / wagons;
    let s = rect(1.2, 4.4, W - 2.4, 1.2, C.tread);
    for (let i = 0; i < wagons; i++) {
      const x = 1.2 + i * w;
      const loco = i === wagons - 1;
      s += rect(x + 0.5, 1.8, w - 1.2, 6.4, loco ? C.oliveD : C.olive, `stroke="${C.black}" stroke-width="0.5"`);
      s += loco ? circ(x + w * 0.5, 5, 1.8, C.black) : circ(x + w * 0.5, 5, 1.6, C.oliveL) + rect(x + w * 0.5, 4.75, 2.4, 0.5, C.black);
    }
    return s;
  },
};

// ---------------------------------------------------------------- selva
/** Un soldado visto desde arriba, mirando a la derecha. `lead` lleva boina roja. */
const soldier = (cx, cy, camo, lead) => {
  const k = 1.5;
  return rect(cx - 2.2 * k, cy - 0.45 * k, 4.8 * k, 0.9 * k, '#9aa19a', `stroke="${C.black}" stroke-width="0.35"`) +
    `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(1.5 * k)}" ry="${n(2.3 * k)}" fill="${camo}" stroke="${C.black}" stroke-width="0.45"/>` +
    rect(cx - 1.9 * k, cy - 0.9 * k, 1.1 * k, 1.8 * k, C.camoC) + // mochila
    circ(cx + 0.2 * k, cy, 1.15 * k, lead ? C.beret : '#8a9a52', `stroke="${C.black}" stroke-width="0.4"`) + circ(cx + 1.0 * k, cy + 0.3 * k, 0.35 * k, C.skin);
};

const squad = (W, idx, palette = [C.camoA, C.camoB]) => {
  const camos = idx % 2 ? [palette[1], palette[0]] : palette;
  const count = Math.max(2, Math.round(W / 10));
  let s = '';
  for (let i = 0; i < count; i++) {
    const cx = (W / count) * (i + 0.5);
    const cy = i % 2 ? 6.7 : 3.3; // marchan en zigzag
    s += soldier(cx, cy, camos[i % 2], i === count - 1);
  }
  if (W >= 40) s += rect(W * 0.5, 4.7, 4, 1.6, C.camoC) + circ(W * 0.5 + 1, 5.5, 0.6, C.sand); // equipo/radio
  return s;
};

// ---------------------------------------------------------------- selección y dibujo
/** Qué dibujo usa cada unidad. `idx` es el número de orden del id ("3-1" → 1). */
export function kindFor(biome, length, idx = 0) {
  switch (biome) {
    case 'pirate': return 'pirate';
    case 'land': return length <= 2 ? 'cavalry' : length === 3 ? (idx % 2 ? 'cannon' : 'infantry') : length === 4 ? 'infantry' : length === 5 ? 'battery' : 'train';
    case 'jungle': return 'squad';
    default: return length <= 2 ? 'destroyer' : length === 3 ? (idx % 2 ? 'submarine' : 'cruiser') : length === 4 ? 'cruiser' : length === 5 ? 'carrier' : 'battleship';
  }
}

const idxOf = (id) => Number(String(id ?? '').split('-')[1]) || 0;

function body(biome, length, id) {
  const W = 10 * length;
  const idx = idxOf(id);
  const kind = kindFor(biome, length, idx);
  switch (kind) {
    case 'carrier': return NAVAL.carrier(W);
    case 'battleship': return NAVAL.battleship(W);
    case 'cruiser': return length >= 4 ? NAVAL.battleship(W) : NAVAL.cruiser(W);
    case 'destroyer': return NAVAL.destroyer(W);
    case 'submarine': return NAVAL.submarine(W);
    case 'pirate': return pirateShip(W, idx);
    case 'cavalry': return LAND.cavalry(W);
    case 'cannon': return LAND.cannon(W);
    case 'battery': return LAND.battery(W);
    case 'infantry': return LAND.infantry(W, idx);
    case 'train': return LAND.train(W);
    default: return squad(W, idx);
  }
}

const svgCache = new Map();
const dataUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Imagen (CSS `url(...)`) de una unidad. La vertical es la horizontal girada 90°. */
export function unitImage(biome, length, id, vertical = false) {
  const key = `${biome}|${length}|${idxOf(id)}|${vertical ? 'v' : 'h'}`;
  let url = svgCache.get(key);
  if (!url) {
    const W = 10 * length;
    const inner = body(biome, length, id);
    const svg = vertical
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 ${W}" preserveAspectRatio="none" shape-rendering="crispEdges"><g transform="translate(10,0) rotate(90)">${inner}</g></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 10" preserveAspectRatio="none" shape-rendering="crispEdges">${inner}</svg>`;
    url = dataUrl(svg);
    svgCache.set(key, url);
  }
  return url;
}

// ---------------------------------------------------------------- marcadores (10 × 10)
const MARKERS = {
  hit: () =>
    poly([[5, 0.6], [6.6, 3], [8.4, 2.6], [7.6, 5.4], [9.2, 7.4], [6.6, 7.8], [5, 9.6], [3.4, 7.8], [0.8, 7.4], [2.4, 5.4], [1.6, 2.6], [3.4, 3]], '#e8421f') +
    poly([[5, 2.4], [6.2, 4.4], [7.4, 6.4], [5, 8.6], [2.6, 6.4], [3.8, 4.4]], '#ffb21e') +
    poly([[5, 4.4], [5.9, 6], [5, 7.4], [4.1, 6]], '#fff1a8'),
  sunk: () =>
    circ(3.6, 5.6, 2.6, '#3a3d44', 'opacity="0.9"') + circ(6.4, 4.4, 2.8, '#50545d', 'opacity="0.9"') + circ(5, 7, 2.2, '#2b2d33', 'opacity="0.9"') +
    poly([[5, 3.2], [6, 5], [5, 6.2], [4, 5]], '#ff8a1e'),
  'miss-water': () =>
    `<ellipse cx="5" cy="5" rx="4.2" ry="3.2" fill="none" stroke="#bfe3ff" stroke-width="0.8" opacity="0.9"/>` +
    `<ellipse cx="5" cy="5" rx="2.5" ry="1.8" fill="none" stroke="#ffffff" stroke-width="0.8"/>` + circ(5, 5, 0.7, '#ffffff'),
  'miss-land': () =>
    `<ellipse cx="5" cy="5.4" rx="3.6" ry="2.5" fill="#3a2f1d" opacity="0.8"/><ellipse cx="5" cy="5.2" rx="2.4" ry="1.5" fill="#1d1710"/>` +
    circ(2.4, 2.8, 1, '#d6c28b', 'opacity="0.7"') + circ(7.6, 3, 0.9, '#d6c28b', 'opacity="0.7"') + circ(5, 1.9, 0.8, '#d6c28b', 'opacity="0.7"'),
  'miss-jungle': () =>
    poly([[5, 5], [1.4, 2.4], [3.6, 5]], '#2f6f2a') + poly([[5, 5], [8.6, 2.2], [6.4, 5.2]], '#4b9a3d') + poly([[5, 5], [2, 8.6], [4.4, 6.4]], '#3a8032') +
    poly([[5, 5], [8.2, 8], [5.8, 6.4]], '#2a5f26') + circ(5, 5, 0.8, '#d9f5c0'),
};

const markerCache = new Map();

/** Imagen de un marcador: 'hit' | 'sunk' | 'miss' (el de fallo depende del terreno). */
export function markerImage(type, biome = 'water') {
  const terrain = biome === 'land' ? 'land' : biome === 'jungle' ? 'jungle' : 'water';
  const key = type === 'miss' ? `miss-${terrain}` : type;
  let url = markerCache.get(key);
  if (!url) {
    url = dataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" shape-rendering="crispEdges">${MARKERS[key]()}</svg>`);
    markerCache.set(key, url);
  }
  return url;
}
