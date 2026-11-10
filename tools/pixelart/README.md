# Generador de pixel art

Dibuja con código, píxel a píxel y sin dependencias (solo Node), todo el arte del juego y lo empaqueta en `frontend/public/img/`:

```bash
node tools/pixelart/generate.mjs
```

Es **determinista**: el mismo código produce los mismos píxeles (el generador pseudoaleatorio usa semillas fijas), así que el resultado se puede versionar.

| Archivo generado | Contenido |
|---|---|
| `atlas-32.png` / `.json` | Unidades y efectos a 32 px por casilla |
| `atlas-16.png` / `.json` | Lo mismo a 16 px (se usa cuando la casilla es pequeña, por ejemplo en 20×20 en celular) |
| `tile-<escenario>-<0..3>.png` | Terreno de 32×32 en 4 cuadros que el CSS alterna (olas, polvo, follaje) |
| `aim.png` | Mira que aparece al pasar el cursor sobre una casilla disparable |

## Qué contiene el atlas

- 4 escenarios (`water`, `pirate`, `land`, `jungle`) × 7 ranuras (`2`, `3a`, `3b`, `4`, `5`, `6`, `7`: largo en casillas; hay dos unidades de 3) × 2 orientaciones (`h`, `v`) × 5 estados.
- Estados: `normal` (1 cuadro), `damaged` (1), `smoking` (3), `explosion` (3) y `sunk` (2).
- Efectos (`fx/…`): `projectile`, `splash`, `dust`, `leaves`, `impact`, `boom`, `fire`, `smoke`, `rippleMark`, `craterMark`, `bushMark`, `aim`.
- Cada entrada del JSON es `{ x, y, w, h, frames }`: una tira de cuadros en horizontal dentro del atlas.

## Estructura del código

| Archivo | Para qué |
|---|---|
| `canvas.mjs` | Lienzo RGBA, primitivas (rectángulo, línea, elipse, polígono), contorno, sombra, empaquetado y codificador/decodificador PNG |
| `units.mjs` | Las unidades horizontales (proa o frente a la derecha) de cada escenario; la vertical sale transponiendo |
| `states.mjs` | Deriva los estados dañado, con humo, en explosión y hundido a partir del dibujo normal |
| `fx.mjs` | Efectos y terrenos |
| `generate.mjs` | Arma los atlas y los JSON |
| `preview.mjs` | `node tools/pixelart/preview.mjs /tmp/vista.png` dibuja todas las unidades en una hoja para revisarlas |

## Sustituir una unidad por arte de un dibujante

1. Dibuja la unidad en Aseprite, LibreSprite o Piskel: **32 × largo** px de ancho y 32 de alto, horizontal, frente a la derecha (por ejemplo, un portaaviones de 5 casillas mide 160×32). Exporta PNG de 8 bits, RGBA o RGB (sin paleta indexada).
2. Guárdalo en `tools/pixelart/manual/<escenario>-<ranura>.png` (por ejemplo `water-5.png`; ver `manual/LEEME.md`).
3. Ejecuta `node tools/pixelart/generate.mjs`. Ese dibujo pasa a ser el estado «normal»; los demás estados, la versión vertical y el atlas de 16 px se derivan solos. Si el tamaño no coincide, el script avisa con un error claro.

El cliente carga `img/atlas-*.json`, así que no hay que tocar código. Si el atlas no carga (archivo faltante o error de red), el juego usa los sprites SVG de `sprites.js`.

## Íconos de la app (PWA)

```bash
node tools/pixelart/icons.mjs   # icon-192.png, icon-512.png e icon-maskable-512.png en frontend/public/img/
```

## Proyectiles por escenario

`fx.mjs` define cuatro: `projectile` (cometa, mar), `projectile-pirate`, `projectile-land` y `projectile-jungle`. Si agregas un escenario, crea su
`projectile-<nombre>` y súmalo a `PROJECTILE` en `frontend/public/js/fx.js`; luego `node tools/pixelart/generate.mjs`.

## Láminas (recompensas de las campañas)

Ya no se generan por código: son 20 tarjetas terminadas (arte, marco dorado, título, leyenda y estrellas dentro de la imagen), una por misión, que se
guardan en la carpeta fija `frontend/public/img/laminas-hd/`:

- `frontend/public/img/laminas-hd/<id>.png` — la tarjeta completa (1394×1128), por ejemplo `chaco-1.png`.
- `frontend/public/img/laminas-hd/min/<id>.webp` — su miniatura de 480 px (galería y aviso de recompensa).

El catálogo vive en `backend/src/domain/laminas.js`. Para cambiar una lámina, reemplaza su PNG y vuelve a crear su miniatura; `npm run validate:content`
(en `backend/`) avisa si falta alguna.
