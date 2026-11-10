# Batalla Naval · Plan de fondos y rediseño visual

Documento de traspaso: resume qué se hizo, qué se decidió y qué falta, para retomar el trabajo en cualquier sesión sin perder el hilo.
Última actualización: 8 de noviembre de 2026.

> **ACTUALIZACIÓN (8 nov 2026, mediodía): los 5 fondos ya están integrados.**
> Imágenes procesadas (saturación ×0,72, WebP de 63–154 KB) en `frontend/public/img/bg/bg-{inicio,agua,tierra,selva,corsarios}.webp`.
> Sistema: `<div id="scene-bg">` + `body[data-bg]` (JS: `setScene()` en `js/main.js`; CSS al final de `css/style.css`), fundido de 0,7 s, capa oscura más fuerte con `body.in-game`.
> Inicio → `inicio` · campaña → su escenario (`Campaigns.biome()`) · partida → escenario de la sala. SW `bn-0.8.8`.
> **FASE 2 HECHA (8 nov, tarde):** la partida usa la misma piel de cristal (`body.hub` también en `game`; overrides al final de `css/style.css`). Se quitó el botón «Colores» de la partida (paleta fija); el código de `theme.js` sigue ahí por si se quiere volver. SW `bn-0.8.9`.
> ~~Falta (siguiente fase):~~ pasar los paneles/botones de la partida al estilo oscuro + ámbar (hoy siguen azules sobre el nuevo fondo) y decidir el botón «Colores» (opción A recomendada).

---

## 1. Idea general

Todo el juego debe sentirse como el login nuevo: **oscuro, limpio y cálido (negro verdoso + ámbar)**, sin el azul con cuadrícula ni los recuadros pesados con borde de píxeles.

- **Fondos distintos según lo que se esté haciendo** (inicio, cada escenario de partida, cada campaña).
- Fondos **sin mucho detalle** para no distraer: lo cargado va en los bordes y el centro queda calmado y oscuro.
- Se mantiene la identidad pixel art: el **tablero, los sprites y la tipografía pixel de los títulos** no se tocan.
- Orden de trabajo acordado: **primero los fondos**, después el resto del rediseño de la partida, y al final cambios mínimos.

---

## 2. Estado actual (ya hecho y probado)

| Parte | Estado |
|---|---|
| Login | Rediseñado: una sola tarjeta de cristal oscuro, paleta fija `--lg-*` (no cambia con el tema), sin selector de colores. Video de fondo se mantiene. |
| Música del login | `frontend/public/audio/tambores-guerra.mp3` (tambores de guerra, 43 s, loop; compuesta por código en `tools/make_war_drums.py`, sin derechos de autor). Se reproduce con `js/login-music.js` (Web Audio, fundidos, arranca con el primer toque porque los navegadores bloquean el audio antes). Botón de sonido arriba a la derecha. |
| Inicio (hub) | Tres pestañas: **Salas y ranking**, **Crear o unirse**, **Campañas** (`js/hub-tabs.js`). Las 4 campañas se listan dentro de la pestaña; «Volver» desde una campaña regresa a su pestaña. |
| Piel del inicio | Clase `body.hub` (activada desde `showScreen` en `js/main.js` para las pantallas `home` y `campaign`). Fondo actual: `video/login/naval.jpg` oscurecido. |
| Partida | **Sin cambiar todavía**: sigue azul con cuadrícula, paneles con borde pixel y botones de «Colores», «Ajustes», «Salir». |
| Service worker | `bn-0.8.7`: JS, CSS y HTML van **red primero** (antes mezclaba JS viejo con HTML nuevo → pantalla en blanco tras actualizar). |
| nginx | `Cache-Control: no-cache` para `.js`, `.css` y la página (con las cabeceras de seguridad repetidas, porque `add_header` en un `location` reemplaza las del `server`). |
| Pruebas | `cd frontend && npm test` → 88 pasan. Se ajustó `test/pixel.test.js` (cuenta tarjetas en `#camp-body`) y `test/sw.test.js`. `tools/e2e/mision.py` ahora entra por `#tab-campanas`. |

### Si el navegador muestra pantalla en blanco tras actualizar
1. `Ctrl + Shift + R`.
2. Si sigue: F12 → Application → Storage → **Clear site data**, y recargar.
3. Reconstruir Docker con lo último: `docker compose up -d --build`.

---

## 3. Paleta del nuevo diseño (referencia)

| Uso | Valor |
|---|---|
| Fondo base | `#0b1210` / `#131813` |
| Cristal de tarjetas | `rgba(10, 15, 12, .6–.66)` + `backdrop-filter: blur(14–18px)` |
| Texto | `#f5efe3` (principal) · `rgba(245,239,227,.68)` (secundario) |
| Borde fino | `rgba(255,255,255,.15)` |
| Acento (botón principal, pestaña activa) | `#e9a63b` · hover `#f4bd5c` · texto sobre acento `#1d1305` |
| Error | `#ff9b8a` |
| Acentos por campaña | Chaco `#6cc077` · República `#d2bd7c` · Corso `#45b8d6` · Litoral `#5aa6e6` |

Dónde viven las variables: login en `#screen-welcome { --lg-* }`; inicio y campañas en `body.hub { ... }` (ambos en `frontend/public/css/style.css`).

---

## 4. Plan de fondos

### 4.1 Qué fondos y dónde se usan

| Archivo | Se usa en |
|---|---|
| `bg-inicio` | Pestañas del inicio |
| `bg-agua` | Partida con escenario **agua** · campaña «Operación Litoral» |
| `bg-tierra` | Partida con escenario **tierra** · campaña «Armas de la República» |
| `bg-selva` | Partida con escenario **selva** · campaña «Guerra del Chaco» |
| `bg-corsarios` | Partida con escenario **corsarios** · campaña «Patente de corso» |

Los escenarios del juego son 4 (`water`, `land`, `jungle`, `pirate`). El login ya tiene videos de agua, tierra y selva (`video/login/naval.mp4`, `artilleria.mp4`, `jungla.mp4`); **no existe todavía nada de corsarios**.

### 4.2 Reglas de los fondos
- 16:9, ideal 2560×1440 (se reduce al publicar). Sin texto, personajes ni interfaz.
- Sin negros puros ni blancos fuertes; bajo contraste; viñeta suave.
- Lo cargado en **bordes y parte inferior**; el **centro vacío y oscuro** (ahí va el tablero o el contenido).
- Pixel art real: 16-bit, ~24 colores, sin anti-aliasing, dithering sutil.

### 4.3 Prompts para generar las imágenes (en inglés, funcionan mejor)

**Bloque de estilo (pegar al inicio de cada prompt):**

```
16-bit pixel art background, wide cinematic landscape, limited palette of about 24 colors, crisp pixels with no anti-aliasing, subtle dithering, dark moody dusk atmosphere. Palette: deep green-black (#0b1210), dark teal (#0f2a33), smoke brown (#3a2a22), ember orange (#c8641e), warm amber glow (#e9a63b). Low contrast, soft vignette, calm and uncluttered center, details only along the left and right edges and the bottom. No text, no UI, no characters in the center, no bright whites.
```

**`bg-inicio`**
```
Night sea under a huge dark sky, a faint amber glow on the horizon, calm dark water with soft pixel waves, distant silhouettes of two warships at the far left and far right edges, a few small embers drifting in the air.
```
**`bg-agua`**
```
Open sea at dusk, low amber sun half hidden behind a layer of smoke, flat dark teal water with gentle wave rows, the silhouette of a battleship at the far right edge and a coastline of dark cliffs at the far left, empty center.
```
**`bg-tierra`**
```
19th-century battlefield plain at sunset, wide flat dark ground, drifting smoke banks, a distant line of cannons and a tiny cavalry silhouette at the left and right edges, orange glow along the horizon, empty open center.
```
**`bg-selva`**
```
Dense jungle at dusk seen from a clearing, dark layered foliage framing the left and right sides, an orange sunset glow through the trees at the horizon, low mist, empty dark clearing in the center.
```
**`bg-corsarios`**
```
Pirate-era bay at night, dark sea, a lone old sailing ship silhouette with torn sails at the far left edge, rocky cliffs with a faint lantern light at the far right edge, a thin amber moonlit horizon, empty center.
```

Consejo: los generadores rara vez dan pixel art de verdad. Opciones: pedir 480×270 y escalar ×4 sin suavizado, o entregar la imagen grande y reducirla a una paleta pixel con código.

### 4.4 Qué hará la implementación cuando lleguen las imágenes
1. Procesar: (si es pequeña) escalar ×4 con *nearest neighbor*; reducir paleta (~32 colores); oscurecer; exportar **WebP/JPG de 100–150 KB** a `frontend/public/img/bg/`.
2. Cargar el fondo según el contexto, **sin estilos en línea** (la CSP es `style-src 'self'`): JavaScript solo cambia un atributo, p. ej. `document.body.dataset.bg = 'agua'`, y el CSS hace el resto:
   ```css
   body[data-bg="agua"]::before { background-image: url("../img/bg/bg-agua.webp"); }
   ```
3. Dibujar el fondo en `body::before` (fijo, `position: fixed; inset: 0; z-index: -1`) con capa oscura y un leve `filter: blur(…)` para suavizar; **transición de opacidad (~0,4 s)** al cambiar de fondo; respetar `prefers-reduced-motion`.
4. Dónde poner el atributo:
   - `showScreen` en `js/main.js`: `home` → `inicio`; `campaign` → según la campaña abierta (`this.view` en `js/campaigns.js`).
   - Al entrar a la partida: según el escenario de la sala (`biome`: water→agua, land→tierra, jungle→selva, pirate→corsarios).
5. Caché: son imágenes → el service worker ya las trata como `static`; no hace falta precargarlas.
6. **Provisional** (mientras llegan las imágenes): fotogramas extraídos de los mp4 con `ffmpeg` (`naval`, `artilleria`, `jungla`) y corsarios usando el de agua. Al llegar las imágenes solo se reemplazan los archivos.

---

## 5. Rediseño de la partida (siguiente fase)

Aplicar a la pantalla de partida (`#screen-game` y sus diálogos) el mismo estilo del inicio:
- Quitar el azul y la **cuadrícula del `body`**; paneles de cristal oscuro con borde fino y esquinas suaves; botón principal ámbar.
- **No tocar**: el tablero, los sprites, los colores propios de cada escenario y la tipografía pixel en títulos/etiquetas pequeñas.
- Sugerencia técnica: generalizar la piel `body.hub` a una clase común (por ejemplo `body.skin`) que se active también en la partida, en vez de duplicar CSS.

### Decisión pendiente: botón «Colores» de la partida
- **Opción A (recomendada):** el tema oscuro + ámbar queda como **predeterminado** y «Colores» ofrece solo alternativas.
- **Opción B:** quitar «Colores» y dejar la paleta fija, como en el login.

Pendiente de confirmar con Fernando.

---

## 6. Lista de tareas (en orden)

- [x] Fernando genera las 5 imágenes con los prompts de la sección 4.3.
- [x] (Ya no hacen falta provisionales.)
- [x] Implementar capa de fondos + `data-bg` + transición; conectar inicio, campañas y partida.
- [x] Procesar y publicar las imágenes definitivas.
- [ ] Decidir A/B de «Colores» y rediseñar la partida con la piel común.
- [ ] Ajustar pruebas si cambia el HTML/CSS, correr `npm test` (88 deben pasar) y revisar capturas en escritorio y celular.
- [ ] Cambios mínimos finales (pulido).

---

## 7. Datos técnicos para retomar

- Proyecto: `batalla-naval/` → `frontend/public` (HTML, `css/style.css`, `js/*`), `backend` (Node + Prisma), `frontend/nginx.conf`, `docker-compose.yml` (db + backend + frontend en **http://localhost:8080**).
- Probar sin Docker: en `backend`, `PORT=4000 STATIC_DIR=../frontend/public node src/index.js` y abrir `http://localhost:4000`.
- Pruebas: `npm ci` en `frontend` y `backend` (con `--ignore-scripts` en backend), luego `cd frontend && npm test`.
- Archivos clave del trabajo hecho: `index.html` (login y pestañas), `css/style.css` (bloques «entrada» y «hub» al final), `js/main.js` (`showScreen`, `loginMusic`, `tabs`), `js/hub-tabs.js`, `js/login-music.js`, `js/campaigns.js` (`#tabList`), `sw.js` (versión `bn-0.8.7`), `tools/make_war_drums.py`.
- Cada vez que cambie el HTML o el JS: **subir la `VERSION` de `sw.js`** y, si se añade un archivo JS nuevo, agregarlo a la lista `SHELL`.
- La CSP no permite estilos en línea: nada de `style="..."` ni `element.style`; usar clases o `data-*` y CSS.
- Limitaciones de quien asiste (Claude): su entorno no tiene acceso a internet general y **no genera imágenes**; las imágenes las crea Fernando y se integran por código.
