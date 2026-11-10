/* Service worker de Batalla Naval (script clásico, no módulo).
 *
 * Qué hace: guarda la interfaz para que la app abra sin conexión y se pueda ver el catálogo de campañas, las guías y las láminas
 * ya vistas. NO permite jugar sin conexión (las partidas usan WebSocket y las reglas viven en el servidor).
 * Qué NO guarda, a propósito: nada de cuentas (/api/progress, /api/auth, /api/quiz) ni WebSocket ni peticiones que no sean GET.
 * En un computador compartido, guardar el progreso mostraría los datos de otra persona.
 *
 * Al cambiar archivos del frontend, sube VERSION (así se renueva la caché) y revisa que SHELL los incluya:
 * la prueba frontend/test/sw.test.js falla si falta alguno.
 */
const VERSION = 'bn-0.9.6-pulido-visual-voz-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;

const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'css/pulido-visual.css',
  'js/api.js', 'js/atlas.js', 'js/biomes.js', 'js/board.js',
  'js/campaigns.js', 'js/dom.js', 'js/fx.js', 'js/game-view.js',
  'js/guide.js', 'js/hub-tabs.js', 'js/laminas.js', 'js/lobby.js', 'js/login-bg.js', 'js/main.js',
  'js/messages.js', 'js/military-voice.js', 'js/music.js', 'js/narrator.js', 'js/net.js', 'js/placement.js',
  'js/settings.js', 'js/sound.js', 'js/sprites.js', 'js/theme.js',
  'js/voice.js', 'js/welcome.js', 'js/zip.js', 'fonts/bricolage.woff2', 'fonts/kalam-400.woff2',
  'fonts/kalam-700.woff2', 'fonts/silkscreen-bold.woff2', 'fonts/silkscreen-regular.woff2', 'img/aim.png',
  'img/atlas-16.json', 'img/atlas-16.png', 'img/atlas-32.json', 'img/atlas-32.png',
  'img/narrador-chaco.png', 'img/narrador-corso.png', 'img/narrador-litoral.png', 'img/narrador-siglo19.png',
  'img/icon-192.png', 'img/icon-512.png', 'img/icon-maskable-512.png', 'img/tile-jungle-0.png',
  'img/tile-jungle-1.png', 'img/tile-jungle-2.png', 'img/tile-jungle-3.png', 'img/tile-land-0.png',
  'img/tile-land-1.png', 'img/tile-land-2.png', 'img/tile-land-3.png', 'img/tile-pirate-0.png',
  'img/tile-pirate-1.png', 'img/tile-pirate-2.png', 'img/tile-pirate-3.png', 'img/tile-water-0.png',
  'img/tile-water-1.png', 'img/tile-water-2.png', 'img/tile-water-3.png',
];

/**
 * Qué estrategia usar para una petición.
 *  - 'network-only': no se toca (WebSocket, POST, cuentas, video, otros orígenes)
 *  - 'api-cache':    catálogo público (red primero; si no hay conexión, la última copia)
 *  - 'navigate':     páginas (red primero; sin conexión, la interfaz guardada)
 *  - 'code':         scripts y estilos (red primero, igual que las páginas): así el HTML y el JS nunca se mezclan de versiones distintas
 *  - 'static':       archivos estáticos (primero la copia, y se renueva en segundo plano)
 */
function strategyFor(url, method, mode, origin) {
  const u = new URL(url, origin);
  if (method !== 'GET' || u.origin !== origin) return 'network-only';
  // Video: el navegador lo pide por rangos (respuestas 206) y la Cache API no las guarda; lo maneja la caché HTTP del navegador.
  if (/\.(mp4|webm)$/i.test(u.pathname)) return 'network-only';
  // Voz grabada de la narración: el <audio> pide por rangos (206), que la caché no guarda; la lista sí (red primero).
  if (/^\/audio\/voz\/.+\.mp3$/i.test(u.pathname)) return 'network-only';
  if (u.pathname === '/audio/voz/index.json') return 'api-cache';
  if (u.pathname === '/api/campaigns') return 'api-cache';
  if (/\.(js|css)$/i.test(u.pathname) && u.pathname !== '/sw.js') return 'code';
  if (u.pathname.startsWith('/api/') || u.pathname === '/ws' || u.pathname === '/healthz' || u.pathname === '/metrics') return 'network-only';
  if (mode === 'navigate') return 'navigate';
  return 'static';
}

async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  // Uno por uno: si un archivo falla (por ejemplo, un 404), el resto igual queda guardado.
  await Promise.allSettled(SHELL.map((path) => cache.add(path)));
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackUrl ?? request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackUrl ?? request);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  if (hit) return hit;
  return (await refresh) ?? Response.error();
}

self.addEventListener('install', (event) => { event.waitUntil(precache().then(() => self.skipWaiting())); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (!name.startsWith(VERSION)) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  switch (strategyFor(request.url, request.method, request.mode, self.location.origin)) {
    case 'api-cache': event.respondWith(networkFirst(request, API_CACHE)); break;
    case 'navigate': event.respondWith(networkFirst(request, SHELL_CACHE, 'index.html')); break;
    case 'code': event.respondWith(networkFirst(request, SHELL_CACHE)); break;
    case 'static': event.respondWith(staleWhileRevalidate(request)); break;
    default: break; // network-only: el navegador lo resuelve solo
  }
});

// Para las pruebas (frontend/test/sw.test.js): expone las funciones puras sin afectar al navegador.
if (typeof globalThis.__SW_TEST__ === 'object') Object.assign(globalThis.__SW_TEST__, { strategyFor, SHELL, VERSION });
