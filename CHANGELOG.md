# Cambios

## 0.9.6 — pulido visual ligero y seguro (móvil primero)
- Agrega `frontend/public/css/pulido-visual.css` con mejoras de tablero, lectura de casillas, estados de colocación, sprites, HUD, narrador, campañas, login y efectos de impacto.
- Añade microdetalles poco saturados a los 16 fotogramas de terreno (agua, corsarios, tierra y selva), conservando 32×32 píxeles y los tiempos de animación.
- Foco accesible, hitboxes de fichas de flota de 48 px, hover exclusivo de mouse y menor desenfoque en celulares.
- Se preservan sin cambios la lógica de juego y arrastre, el servidor, los atlas, los 3 MP3 y los 3 MP4, el narrador y las 20 láminas HD.
- Service worker: nueva versión `bn-0.9.6-pulido-visual` y precaché del CSS añadido.
- Documentación: `MEJORAS-RAPIDAS-v0_9_6.md`.

## 0.9.5 — restauración multimedia y voz de oficial
- Recupera videos del login, música completa y 20 láminas HD del respaldo 0.9.2.
- Narración: órdenes breves de mando, selección de voz natural masculina en español, tono menos artificial, división de textos largos y voz activada por defecto solo para nuevos usuarios.
- Conserva arrastre táctil y con mouse, corrección de rondas y gráficos del paquete 0.9.4.
- El generador de voz neural sigue incluido, pero no hay MP3 de voz neural en el ZIP: requiere generación con acceso al proveedor antes de desplegar.
- Invalida la caché anterior de PWA: `bn-0.9.5-audio-mando`. Guía: `RECUPERACION-AUDIO-Y-VOZ.md`.


## 0.9.2
**Narrador con cara y voz grabada**
- **Un oficial por campaña** (`img/narrador-<campaña>.png`, hoja de 6 cuadros con fondo transparente) cuenta la misión desde el panel de narración, con el texto en un globo de diálogo.
  Mueve la boca mientras se escribe el texto o suena la voz y queda quieto con la boca cerrada en reposo (también quieto con animaciones «sin animaciones»).
  Chaco → soldado, Siglo XIX → oficial del kepi, Corsarios → capitán, Litoral → comandante naval. Código: `Avatar` en `js/narrator.js`.
- **Voz grabada con una voz neural masculina** (`es-BO-MarceloNeural`): `tools/voz/generar.mjs` crea un `.mp3` por cada escena y frase de partida en `frontend/public/audio/voz/`
  (≈190 audios, unos 6 MB) y una lista `index.json`. `js/voice.js` los reproduce cuando el texto tiene audio y **cae a la voz del navegador** si falta alguno o el audio no puede sonar.
  El id de cada audio sale del texto (`clipId`): si cambias una frase, se genera su audio nuevo y el viejo se borra. Ver `tools/voz/LEEME.md`.
- Respaldo mejorado: sin audios, se prefiere una voz masculina en español (`pickNarratorVoice`: Marcelo es-BO, Jorge, Álvaro…) con tono grave y ritmo pausado.
- **Service worker** `bn-0.9.3`: los `.mp3` de la voz van directo a la red (el `<audio>` los pide por rangos, que la caché no guarda); la lista de audios, red primero.
  Se corrigió `sw.test.js` para reconocer las imágenes del narrador.

## 0.9.1
**Láminas nuevas en alta calidad (sin marcos «base» y «dorado»)**
- Las 20 láminas ahora son **imágenes terminadas** (1394×1128: arte, marco dorado, título, leyenda y estrellas dentro del PNG) y reemplazan a las anteriores, que se dibujaban
  por código (160×96 + marco dibujado en el navegador). Se **borró** `frontend/public/img/laminas/` y el generador `tools/pixelart/laminas.mjs`.
- **Carpeta nueva y fija:** `frontend/public/img/laminas-hd/<id>.png` (tarjeta completa) y `frontend/public/img/laminas-hd/min/<id>.webp` (miniatura de 480 px para la galería y el aviso
  de recompensa, para no bajar ~36 MB al abrir la galería). `chaco-1` y `chaco-2` llegaron como JPEG con extensión `.jpeg`; se guardaron como PNG para que todas sigan la misma ruta.
- **Se acabó el sistema doble de marcos:** ganar una misión (1 o más estrellas) entrega directamente su lámina. `GET /api/progress` devuelve `laminas: [{ id }]` (sin `tier`).
  Las estrellas siguen contando para rangos y logros (incluido «Álbum dorado»: tres estrellas en todas las misiones).
- **Cliente** (`laminas.js`): ya no dibuja marco ni leyenda; muestra la imagen, la descarga tal cual (horizontal = archivo original, sin recomprimir), la comparte y arma el ZIP.
  Se mantienen los formatos **cuadrada** y **vertical 9:16**, que colocan la tarjeta centrada, sin deformar, sobre un fondo liso.
- `validate:content` exige el PNG y la miniatura de cada lámina. **Service worker** `bn-0.9.1`.

## 0.9.0
**Música en todo el juego y jefes reales (o inventados) en las campañas**
- **Música en todo el proyecto, fuerte solo en la entrada** (`frontend/public/js/music.js`, reemplaza a `login-music.js`): entrada = «tambores de guerra» (volumen 0,50);
  inicio y campañas = `ambiente-puerto.mp3` (0,11, unos 11 dB más suave); partida = `ambiente-batalla.mp3` (0,075, unos 14 dB más suave y por debajo de los efectos).
  Fundido de 1,8 s al cambiar de pista; la misma pista no se reinicia entre inicio y campañas. Si el navegador no deja sonar sin tocar, espera el primer toque
  (el botón de la entrada sigue latiendo; en el resto, en silencio). Las pistas de ambiente son nuevas, compuestas por código (`tools/make_ambient.py`, Re menor como la
  entrada, bucle sin costura de 64 s, ~770 KB cada una, sin muestras de terceros). Pensadas también para parlantes pequeños (energía en 120–2000 Hz, no solo graves).
- **Ajustes:** «Música de fondo» (sí/no) y «Volumen de la música» (0–100; 70 = volumen base). El botón 🔊 sigue silenciando música y efectos a la vez.
- **La música baja sola mientras se lee la narración en voz alta** (`voice.js` avisa cuándo empieza y termina cada lectura).
- **Jefes en las misiones:** en la sala ya no sale «Almirante IA» ni el nombre de la cuenta. Campañas históricas: los jefes reales de cada batalla (11 misiones, campo
  `commanders` con cargo; sin grados a propósito). Campañas de ficción: nombres inventados al azar (repetibles por sala, con cargo concordante en género), etiqueta «ficción»
  y cargo «(inventado)». La ficha de la misión muestra «Al mando». Partidas libres: sin cambios. Solo cambia lo que se muestra; historial y progreso usan la cuenta real.
- `export:review` incluye los jefes con casilla «Aprobado / Corregir»; `validate:content` exige jefes en misiones reales y los prohíbe en las de ficción.
- **Service worker** `bn-0.9.0` (`music.js` en SHELL; los mp3 se guardan al usarse). **nginx:** caché de 7 días para `mp3`. Versiones de paquetes: 0.9.0.
- **Pruebas:** backend 174 → 178 · frontend 88 → 99 (música: pistas por pantalla, fundidos, silencio, ajustes, primer toque, archivo roto, cambios rápidos; voz: avisos;
  ajustes). Nuevo `tools/e2e/musica_y_jefes.py` en Chromium real (22 comprobaciones: pista y volumen por pantalla, ajustes, jefes en histórica, ficción y partida libre).
- **No se pudo hacer:** escuchar la música (las pistas se midieron —nivel, picos, costura del bucle, balance de frecuencias—, pero el gusto y el volumen reales hay que
  juzgarlos con tus oídos; ajusta `TRACKS` en `music.js`).

## 0.8.3
**Fondo de video en la pantalla de entrada**
- La entrada (`#screen-welcome`) rota entre **tres videos en pixel art** (acorazados, artillería, selva) con fundido de 0,9 s (`frontend/public/js/login-bg.js`).
  Los clips pesan ~1 MB en total (mp4 H.264, sin audio, 1280×670) y se recortaron para quitar la marca de agua del generador.
- **Solo corre mientras se ve la entrada**: al entrar al juego se pausa y se libera. Se baja un video al abrir y los otros dos cuando el primero ya suena.
- **Sin movimiento = imagen fija** (`video/login/naval.jpg`): preferencia del sistema «reducir movimiento», «Sin animaciones» en Ajustes, ahorro de datos o 2G.
  Si el navegador bloquea el autoplay, queda la imagen fija y se reintenta con el primer toque. Un video que no carga se salta.
- Título en la fuente pixel del juego; paneles de vidrio esmerilado legibles en modo claro y oscuro. Sin estilos en línea (compatible con la CSP).
- **Service worker** `bn-0.8.3`: agrega `login-bg.js` y deja el video fuera de su caché (llega por rangos 206, que la Cache API no guarda). **nginx**: caché de 7 días para `jpg` y `mp4`.
- **Pruebas:** frontend 73 → 88 (rotación con fundido, liberar al salir, sin animar, autoplay bloqueado, video roto, tamaños de archivo, coherencia con el CSS).
  También verificado en Chromium real (escritorio, móvil, modo oscuro, movimiento reducido).

## 0.8.0
**Modo aula completo, app instalable y más herramientas para docentes**
- **Preguntas corregidas en el servidor** (`POST /api/quiz`): el catálogo público ya **no incluye la respuesta correcta ni la explicación**; se reciben al contestar, así
  que sirven para evaluar. Con cuenta se guarda el **mejor resultado** (`QuizResult`, migración `3_resultados_preguntas`) y hay tres logros de estudio:
  «Buen alumno», «Estudioso» y «Sabio de las batallas». Un invitado recibe la corrección sin guardarla.
- **Glosario por misión** (`content/glosario.js`): solo las palabras que aparecen en esa misión, sin distinguir tildes ni plurales; se ve en «Contexto histórico».
- **Guía didáctica (.md) y hoja de trabajo imprimible** por misión real, generadas en el navegador (todo el texto se escapa; las respuestas no van en la guía).
- **Lectura en voz alta** opcional (síntesis de voz del navegador) para la narración y las escenas del modo aula.
- **Accesibilidad de la narración:** el texto que se escribe letra a letra ya no se anuncia fragmentado; el lector de pantalla recibe la frase completa una sola vez.
- **Rangos** de Recluta a Mariscal según las estrellas, con lo que falta para el siguiente; logro **«Álbum dorado»** (20 láminas doradas). 32 → **36 logros**.
- **Láminas para redes:** formatos **horizontal, cuadrado y vertical 9:16**, y **descarga de todas en un ZIP** (escritor de ZIP propio, validado con `unzip` y Python).
- **Proyectil propio por escenario** (cometa, bala pirata con mecha, granada de mortero, trazadora) y atlas regenerado.
- **App instalable (PWA):** manifiesto, íconos y *service worker*. Sin conexión abre la interfaz y muestra campañas, guías y láminas ya vistas; **no** permite jugar sin
  conexión y **no guarda datos de cuentas**. El arranque ya no depende de la configuración del servidor para cargar el catálogo.
- **CI** (GitHub Actions): pruebas, validación de contenido y **Prisma contra un PostgreSQL real** (aplica las migraciones y corre el contrato del almacén); revisión
  semanal de enlaces de fuentes.
- **Uso en clase:** `AUTH_PER_MINUTE` y `QUIZ_PER_MINUTE` (el límite de ingreso de 20 por minuto por IP bloqueaba a un curso entero que entra a la vez).
- **Contenido:** Ayacucho con más datos y una pregunta nueva; **enlaces de fuentes no verificables reemplazados** por otros que aparecieron en búsquedas reales; Boquerón corregido
  (unos 450 asediados, falta de agua en ambos bandos, ventaja decisiva de los morteros).
- **Errores corregidos:** los barcos de «La flota fantasma» salían oscuros en vez de translúcidos (mal uso de la API de color de mi generador); `wrapLines` de las leyendas.
- **Pruebas:** backend 172 (161 pasan, 11 omitidas de Prisma) · frontend 73 · extremo a extremo en Chromium real (incluye modo sin conexión). El test de misión era **intermitente
  (~30 %)**: su bot disparaba casilla por casilla y la IA ganaba a veces; ahora ataca alrededor de cada acierto (16 de 16 corridas OK). La suite del frontend corre en secuencia.
- **Sin ejecutar** (como antes): Prisma y migraciones 2 y 3 contra PostgreSQL (el CI de GitHub lo hará), `docker compose up --build`, Firefox/Safari/celular real, y los enlaces
  de fuentes con internet.
## 0.7.0
**Narración, modo aula, láminas descargables y mejores animaciones de disparo**
- **Contenido histórico corregido contra fuentes** (`backend/src/content/`, `docs/VERIFICACION-HISTORICA.md`). El borrador de la 0.6 tenía errores:
  Cañada Strongest fue en **mayo de 1934** (no a fines de 1934); el «Corralito de Villamontes» fue el golpe contra Salamanca (noviembre de 1934), no la
  defensa de la ciudad (febrero de 1935), así que la misión pasó a llamarse **«Defensa de Villamontes»**; Alihuatá y Campo Jordán fueron en 1933 (no en 1932);
  Boquerón se rindió (había unos 450 asediados y la ventaja decisiva fueron los morteros, y la falta de agua afectó a ambos bandos); Nanawa tuvo dos batallas.
  Un dato que se había escrito mal en una primera redacción (1 200 asediados, «la sed fue decisiva») se corrigió al contrastar con la fuente.
- **Narración por misión:** fecha, lugar, resultado histórico real, datos, **fuentes con enlace** (se muestran en el juego), escenas de apertura, 8 frases
  durante la partida (primer impacto, primera unidad hundida, mitad, última, baja propia, victoria, derrota) y preguntas de comprensión.
  Las misiones donde el bando del jugador perdió en la historia llevan la etiqueta **«reinterpretación»** y el resultado dice qué pasó de verdad.
- **Modo aula** (en «Ajustes»): lectura guiada por escenas antes de empezar y preguntas con explicación al ganar.
- **Láminas como recompensa:** 20 cuadros en pixel art (160×96; uno por misión) generados por `tools/pixelart/laminas.mjs`; se ganan al completar la misión
  y son **doradas con 3 estrellas**. Galería con las ganadas y las bloqueadas, visor, **descarga en PNG** con marco y leyenda, y **compartir** con el menú del
  sistema en celulares. Sin retratos de personas reales; banderines neutros antes de 1851.
- **Logros:** 22 → **32** (uno histórico por cada misión real, «Historiador», «Maestro de campaña», «Mano firme», «Constelación»). El logro
  `hist_corralito` pasa a `hist_villamontes` con la migración `2_logro_villamontes` (conserva los desbloqueos).
- **Disparos:** fogonazo, proyectil con arco y **estela del color del escenario**, ondas en el agua, «¡Racha ×N!», destello al hundir y en el último golpe.
  **Ajustes** (en el navegador): animaciones completas/ligeras/sin, sacudida, narración y modo aula; tope de 40 efectos simultáneos.
- **Respaldo SVG de «Tierra» (pendiente 1.6):** caballería, infantería y cañones en lugar de tanques.
- **Errores encontrados y corregidos al probar en un navegador real** (ya existían en la 0.6; jsdom no los mostraba): aparecía el texto **«null»** en la
  barra de cada misión real, en la ficha de una misión fallida y en las campañas sin nota. Nuevo helper `add()` en `dom.js` y pruebas que impiden que
  vuelva a aparecer «null»/«undefined».
- **Herramientas:** `npm run validate:content` (valida historias, fuentes https, preguntas, logros y láminas), `npm run check:links` (comprueba que los
  enlaces de fuentes respondan; necesita internet) y `tools/e2e/mision.py` (juega una misión completa en Chromium).
- **Documentación:** `docs/NARRATIVA.md` (cómo añadir campañas, misiones, logros y láminas), README con campañas, logros, cupo, los cuatro escenarios y créditos
  (fuente Silkscreen), `docs/VERIFICACION-HISTORICA.md` reescrito.
- **API:** `GET /api/campaigns` incluye `story`, `twist` por misión y `laminas`; `GET /api/progress` incluye `laminas`. Sin cambios en el WebSocket.

**Pruebas**: backend 157 (147 pasan, 10 omitidas de Prisma) · frontend 48 · prueba de punta a punta en Chromium real.
**Sin ejecutar** (como antes): Prisma contra PostgreSQL y `docker compose up --build`; los enlaces de fuentes no se pudieron comprobar con internet desde el entorno de desarrollo.

## 0.6.0
**Campañas, cuentas con progreso, logros y pixel art**
- **Campañas** (`domain/campaigns.js`): Guerra del Chaco (6 misiones, según la tabla de la hoja de ruta), Armas de la República / siglo XIX (5),
  Patente de corso (4, ficción) y Operación Litoral (5, ficción). Dificultad creciente en IA y tablero; la última misión de cada una es IA
  experta en 20×20; desbloqueo en orden; 1–3 estrellas por misión (ganar + «pocos disparos» + «pocas bajas»). Cada misión trae briefing y cierre.
- **Tierra pasa a ser del siglo XIX** (opción A de la hoja de ruta): infantería, caballería y cañones en lugar de tanques (cambian nombres, dibujos y textos; las reglas no).
- **Cuentas e invitados:** tablas Prisma `CampaignProgress` y `AchievementUnlock`, columna `Match.biome`, migraciones `0_init` y `1_campanas_y_logros`
  (probadas en PostgreSQL 16). Los invitados juegan con amigos libremente y prueban la primera misión de cada campaña; cupo diario contra la IA por IP
  (`GUEST_AI_DAILY`, por defecto 10; la revancha gasta cupo).
- **Protocolo:** mensaje `mission`; `state.mission`, `state.result.mission` y `state.result.newAchievements`; cada unidad lleva `hits` y `state`
  (`normal` | `damaged` | `smoking` | `sunk`) calculados en el servidor; errores `limite_invitado`, `requiere_cuenta`, `mision_bloqueada`, `mision_no_existe`.
  REST: `GET /api/campaigns`, `GET /api/progress`, `GET /api/quota`; `/api/meta` incluye `guestAiDaily`.
- **Logros** (`domain/achievements.js`): 22 en progreso, habilidad (victoria perfecta, tiro certero, pocos disparos, tres estrellas), variedad y
  históricos («Defensor de Boquerón», «Tres pasos al frente», «Corralito de Villamontes», «Patente de corso»…). Aviso al desbloquear y panel de logros.
- **Pixel art real** (`tools/pixelart/`): generador determinista sin dependencias que produce atlas PNG + JSON a 32 y 16 px, con 5 estados
  por unidad (algunos animados), efectos (proyectil, salpicadura, polvo, hojas, impacto, explosión, fuego, humo), terrenos animados y mira.
  Admite sustituir cualquier unidad por un PNG dibujado a mano (`tools/pixelart/manual/`).
- **Cliente:** `atlas.js` (carga, selección 16/32 px, animación por cuadros), `fx.js` (proyectil con arco, impacto y sacudida al hundir), tablero con
  terreno animado y respaldo SVG si falla el atlas, marca y estado nuevo retenidos hasta que cae el proyectil, `prefers-reduced-motion` respetado.
- **Interfaz:** piel pixel (esquinas escalonadas, sombra dura, fuente Silkscreen con su licencia OFL), pantalla de campañas, ficha de misión,
  resultado con estrellas y objetivos, botón «Siguiente misión».
- **Contenido histórico:** borrador pendiente de revisión; ver `docs/VERIFICACION-HISTORICA.md`.
- `docker-entrypoint.sh`: si la base venía de `db push`, marca `0_init` como aplicada y aplica solo lo nuevo.

**Pruebas**: backend 140 (130 pasan, 10 omitidas de Prisma) · frontend 18.

## 0.5.0
**Escenarios (biomas) y sprites**
- Cuatro escenarios al crear la sala: **Mar · flota moderna**, **Mar · piratas**, **Tierra · tanques** y **Selva · soldados**
  (`biome`: `water` | `pirate` | `land` | `jungle`; por defecto `water`). Cambian el terreno, los nombres y los dibujos de las
  unidades; las reglas, la flota (ids y largos) y la IA son idénticas, así que todos son equivalentes en juego.
- `frontend/public/js/sprites.js`: unidades y marcadores en SVG generados por código (portaaviones, acorazado, crucero,
  submarino, destructor; galeones con velas; jeeps, tanques, obuses y trenes blindados; escuadras en zigzag). Horizontal y vertical,
  escalan con el tablero. Marcadores de acierto (fuego), hundimiento (humo) y fallo según el terreno (salpicadura, cráter, maleza).
- `board.js`: capa de unidades encima de las casillas (las casillas ya no se desplazan: todo va con posición explícita en la
  cuadrícula), unidad fantasma al colocar y animaciones que respetan `prefers-reduced-motion`.
- Las unidades **destruidas** del rival se dibujan durante la partida (`boards.X.sunk`, campo nuevo del protocolo).
- Textos por escenario (`js/biomes.js`): «aguas enemigas» / «territorio enemigo» / «la selva enemiga», «hundido» / «destruido» / «neutralizado».
- Compatible hacia atrás: sin `biome` se juega en el mar. Los nombres de la flota moderna ahora siguen la hoja de sprites
  (Destructor, Crucero, Submarino, Acorazado, Portaaviones…).

**Pruebas**: backend 101 (95 pasan, 6 omitidas de Prisma) · frontend 11.

## 0.4.0
**Clúster y entrega académica**
- `kernels/montecarlo_mpi.c`: versión **MPI + OpenMP** (modelo híbrido) con medición separada de cómputo, comunicación y
  desbalance; `kernels/pingpong_mpi.c` mide latencia α y ancho de banda β de la red. El núcleo común está en `mc_core.h`;
  Node, OpenMP y MPI dan el mismo conteo y la misma suma de control.
- `cluster/`: guía de montaje del clúster de PCs, `check-cluster.sh` y `run-experiments.sh` (escalabilidad fuerte y débil).
- `informe/`: Hito 1 (1 página) e informe técnico IEEE (LaTeX) con 8 secciones y marcadores donde faltan tus datos;
  `results-to-latex.mjs` genera tablas, figuras y cifras del resumen desde los CSV medidos.

## 0.3.0
**Paralelismo y distribución**
- Pool con **dos prioridades** (`live`/`batch`), **contrapresión** (menos muestras con cola larga, rechazo al saturar),
  **cancelación** (`AbortSignal` + bandera compartida con `Atomics`) y **granularidad adaptativa** (`PARALLEL_MIN_COST`).
- **IA distribuida**: `DistributedPool` + nodos de IA (`npm run ai-node`) por HTTP con token, validación estricta,
  balanceo por carga, reintentos con *circuit breaker* y respaldo local. Perfil `distributed` en docker-compose.
- **Análisis de partidas** en paralelo (`ai/analysis.js`) y tarea `solo` para medir estrategias sin sesgo.
- Retraso del **event loop** en `/api/status` y endpoint `/api/metrics` (Prometheus).
- Núcleo Monte Carlo en **C + OpenMP** (`kernels/`) con resultado idéntico al de Node.

**Herramientas de medición**: `calibrate`, `latency`, `quality`, `analyze`, `load` (prueba de carga por WebSocket),
`plot-results` (gráficas HTML desde el CSV del benchmark), `mc-checksum`.

**Cambios de comportamiento**
- Las decisiones baratas (IA fácil/normal/difícil y Experta con pocas muestras) ya no pasan por los hilos: se calculan
  en el hilo principal. `AI_ADAPTIVE=false` devuelve el comportamiento anterior.
- `Game` guarda `history` (disparos en orden). No cambia el protocolo WebSocket.

**Pruebas**: backend 93 (87 pasan, 6 omitidas de Prisma) · frontend 8.

## 0.2.0
- IA Experta (Monte Carlo repartido entre hilos), memoria compartida vs mensajes, cola compartida, torneo en paralelo y
  benchmark con speedup, eficiencia y Karp-Flatt.

## 0.1.0
- Versión inicial: juego, salas, espectadores, cuentas, Elo, IA de tres niveles, pool de hilos básico.
