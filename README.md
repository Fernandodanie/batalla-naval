# ⚓ Batalla Naval en tiempo real

> **Actualización audiovisual y móvil (0.9.5):** esta entrega restaura la música, los videos del login y las 20 láminas históricas; conserva el arrastre táctil, el arreglo entre partidas y los nuevos gráficos. La narración incorpora órdenes de oficial y mejor selección de voces en español. **Los MP3 neurales del narrador todavía deben generarse** con `tools/voz`: el ZIP trae voz del navegador como respaldo y la carpeta de grabaciones preparada. Consulta [`RECUPERACION-AUDIO-Y-VOZ.md`](RECUPERACION-AUDIO-Y-VOZ.md).

Evolución del **Tres en Raya web** (INF423, sockets) hacia un juego mucho más grande: **Batalla Naval** con tableros
de hasta 20×20, partidas contra otra persona o contra una **IA con cuatro niveles**, **espectadores**, **cuentas de
usuario con puntos y ranking** guardados en PostgreSQL (Prisma) y un despliegue en **contenedores separados** para
backend y frontend.

> **Versión 0.1 (demo).** El objetivo de esta entrega es tener la base correcta (estructura, reglas, tiempo real, IA,
> datos y pruebas) para ir mejorándola poco a poco. Mira [Estado actual](#estado-actual) para saber qué está
> verificado y qué no.

---

## Índice

1. [Objetivos](#objetivos)
2. [Estado actual](#estado-actual)
3. [Inicio rápido](#inicio-rápido)
4. [Cómo se juega](#cómo-se-juega)
5. [Arquitectura](#arquitectura)
6. [Procesos paralelos: cómo funcionan aquí](#procesos-paralelos-cómo-funcionan-aquí)
7. [Base de datos con Prisma](#base-de-datos-con-prisma)
8. [Sistema de puntos](#sistema-de-puntos)
9. [Protocolo y API](#protocolo-y-api)
10. [Configuración](#configuración)
11. [Pruebas](#pruebas)
12. [Seguridad](#seguridad)
13. [Publicarlo en internet](#publicarlo-en-internet)
14. [Hoja de ruta](#hoja-de-ruta)
15. [Problemas frecuentes](#problemas-frecuentes)
16. [Qué se reutilizó del Tres en Raya](#qué-se-reutilizó-del-tres-en-raya)

---

## Objetivos

### Objetivo general

Construir un juego multijugador en tiempo real, escalable y mantenible, que sirva a la vez como **producto jugable** y
como **proyecto de estudio** de redes (sockets, concurrencia, paralelismo), bases de datos y despliegue con contenedores.

### Objetivos específicos

| # | Objetivo | Cómo se cumple en esta versión |
|---|---|---|
| 1 | **Matrices mucho más grandes** que el 3×3 | Tableros de 8×8, 10×10, 12×12, 15×15 y 20×20 con flotas escaladas (`domain/fleet.js`). Cada tablero es una matriz guardada en un arreglo plano (`índice = fila·size + columna`) |
| 2 | **Entender y aplicar procesos paralelos** | Muchas salas concurrentes en el event loop + una **IA que calcula en worker threads** (`ai/pool.js`) + espectadores. Incluye un benchmark y una explicación honesta de cuándo conviene ([sección](#procesos-paralelos-cómo-funcionan-aquí)) |
| 3 | **Jugar contra una IA** | Tres dificultades: fácil (azar), normal (caza y remata), difícil (mapa de probabilidades) |
| 4 | **Más participantes en la sala** | Dos jugadores + hasta 20 espectadores por sala, con reacciones. *Modo de 3-4 jugadores: en la hoja de ruta* |
| 5 | **Usuarios y puntos persistentes** | Cuentas (registro/login con JWT), puntos, Elo, victorias y ranking en PostgreSQL con **Prisma** |
| 6 | **Estructura profesional** | Monorepo `backend/` + `frontend/`, dominio separado de la red, repositorios intercambiables, configuración por entorno, pruebas automáticas |
| 7 | **Contenedores separados** | `backend` (Node), `frontend` (nginx) y `db` (PostgreSQL) orquestados con `docker-compose.yml` |
| 8 | **Poder probar poco a poco** | Cada capa tiene sus pruebas; el backend funciona sin base de datos (modo memoria) para iterar rápido |
| 9 | **Documentación clara** | Este README, [`docs/PROTOCOLO.md`](docs/PROTOCOLO.md) y comentarios en el código explicando el *por qué* |

### Lo que NO es objetivo (todavía)

Matchmaking automático, chat, torneos, app móvil nativa, escalado a varias instancias del backend. Están
considerados en la [hoja de ruta](#hoja-de-ruta).

---

## Estado actual

Lo que se **ejecutó y verificó** durante el desarrollo:

| Parte | Verificación |
|---|---|
| Reglas del juego, tableros, puntos, IA | **37 pruebas** automáticas (incluye partidas IA vs IA en todos los tamaños y dificultades, el muestreo Monte Carlo y el análisis de partidas) |
| API REST y almacén en memoria | **12 pruebas** (registro, login, validaciones, ranking, contrato del almacén) + 6 del contrato para Prisma, omitidas hasta que haya base de datos |
| Tiempo real por WebSocket | **22 pruebas** con partidas completas: vs IA, persona vs persona, espectadores, reconexión, abandono, temporizadores, Elo, IA en hilos paralelos |
| Pool de hilos e IA distribuida | **16 pruebas**: prioridades, cancelación, contrapresión, granularidad adaptativa, métricas, nodos remotos con token, tolerancia a fallos y una partida completa calculada en nodos remotos |
| Campañas, logros, narración y láminas | definición de las campañas, estrellas, desbloqueo en orden, reglas de cada logro (incluidos los históricos y «Maestro de campaña»), cupo diario, flujo completo por WebSocket, **contenido validado** (cada misión con historia, fuentes https y preguntas; una misión es «reinterpretación» exactamente cuando el bando del jugador perdió en la historia), láminas por estrellas y logro renombrado |
| Frontend | **73 pruebas**: el HTML real en un DOM simulado (jsdom) conectado a un backend real; una partida completa jugada **haciendo clic**; una misión de campaña con su narración, lámina y preguntas del modo aula corregidas por el servidor; ficha, glosario y galería; guías y hojas de trabajo (con escape de HTML); formatos de lámina y ZIP; voz; ajustes; efectos de disparo y sus topes; service worker (qué guarda y qué no); tablero con sprites y respaldo SVG; que **no aparezca «null»/«undefined» en pantalla** |
| Navegador real (Chromium) | Se jugó una misión completa de punta a punta (ficha en modo aula con glosario, guía descargada, colocación, batalla con proyectiles y estela, resultado con lámina, preguntas corregidas y guardadas, galería, ZIP y lámina vertical) y se comprobó que la app **abre sin conexión** con el catálogo guardado, sin errores de consola. Script: [`tools/e2e/mision.py`](tools/e2e/mision.py) |
| Migraciones SQL | `0_init` y `1_campanas_y_logros` aplicadas sobre un **PostgreSQL 16 real** (tablas, índices, claves foráneas y borrado en cascada comprobados) |
| Arranque real | `npm start` sirviendo frontend + API + WebSocket en un puerto |

Lo que **NO se pudo ejecutar** en el entorno donde se creó este código, y por eso debes probar tú primero:

| Parte | Por qué | Qué hacer |
|---|---|---|
| **Prisma + PostgreSQL** | El entorno no podía descargar los motores de Prisma | El código del almacén Prisma y el esquema están escritos, pero **sin ejecutar**. Hay un [contrato de pruebas](backend/test/store.contract.js) que ya pasa con el almacén en memoria; ejecútalo contra Postgres ([cómo](#probar-el-almacén-prisma)) |
| **Docker / docker-compose** | No había Docker | Los archivos están validados en sintaxis, **no construidos**. Si `docker compose up --build` falla, el error casi seguro está en estos archivos |
| **Otros navegadores y celulares** | Solo se probó Chromium de escritorio | Revisa Firefox, Safari y un celular real, sobre todo el tablero 20×20, las 5 paletas con modo oscuro y el rendimiento con «Animaciones: completas» en un equipo de gama baja (si se nota, usa «ligeras») |

---

## Inicio rápido

### Opción A: Docker (recomendada, incluye PostgreSQL)

Requisitos: Docker con Compose.

```bash
node scripts/init-env.mjs        # crea .env con secretos aleatorios (o copia .env.example a .env y edítalo)
docker compose up --build
```

Abre **http://localhost:8080**. Para ver el ranking con datos de ejemplo:

```bash
docker compose exec backend node prisma/seed.js     # cuentas: almirante, capitana, corsario… contraseña: demo1234
```

Para detener: `docker compose down` (los datos quedan en el volumen `db-data`; `docker compose down -v` los borra).

### Opción B: sin Docker y sin base de datos (la más rápida para desarrollar)

Requisitos: Node.js 22 o superior.

```bash
cd backend
npm install
npm start
```

Abre **http://localhost:4000**. En desarrollo el backend sirve también la carpeta `frontend/public`, así que todo
queda en un solo puerto. Los usuarios y puntos viven **en memoria** (se pierden al reiniciar). Para recargar solo con
cada cambio: `npm run dev`.

Para jugar desde el celular en la misma Wi-Fi, usa la dirección "Red local" que imprime el servidor al arrancar.

### Opción C: backend local + PostgreSQL en Docker

```bash
docker compose up -d db            # solo la base de datos (queda en 127.0.0.1:5432)
cd backend
npm install
npx prisma generate
```

Luego (Linux/macOS):

```bash
export DATABASE_URL="postgresql://naval:TU_CLAVE@localhost:5432/naval?schema=public"
npx prisma migrate dev --name init   # crea las tablas y la carpeta prisma/migrations
npm start
```

En PowerShell: `$env:DATABASE_URL="postgresql://naval:TU_CLAVE@localhost:5432/naval?schema=public"`.
`TU_CLAVE` es el `POSTGRES_PASSWORD` de tu `.env`. Con `DATABASE_URL` definida el backend usa Prisma automáticamente
(o fuérzalo con `STORAGE=prisma`; `STORAGE=memory` lo desactiva).

---

## Cómo se juega

1. **Crear partida.** Elige *contra una persona* o *contra la IA*, el tamaño del tablero y (si es la IA) la dificultad.
   Opcional: sala pública (aparece en la lista) y "acertar da otro disparo".
2. **Entrar.** Con el código de 4 letras, con el enlace `/?sala=ABCD`, desde la lista de salas públicas, o como
   **espectador** con el botón *Mirar*.
3. **Colocar la flota.** Elige un barco y toca el tablero; `R` (o el botón) gira el barco; toca un barco colocado
   para moverlo; *Aleatorio* pide una disposición al servidor. Tienes 90 s: si se acaban, el servidor completa por ti.
4. **Batalla.** Por turnos, dispara a una casilla de las aguas enemigas. El servidor responde *agua*, *tocado* o
   *hundido* (y dice cuál barco). Gana quien hunde toda la flota rival. Cada turno dura 30 s; si se acaba, el
   servidor dispara por ti, y tres veces seguidas hacen perder la partida.
5. **Revancha.** Los dos votan y empieza otra ronda alternando quién abre. El marcador de la sala se conserva.

### Campañas, logros y cupo de invitados

- **Campañas:** en «Campañas» eliges una misión (partida contra la IA con reglas fijas) y ganas de 1 a 3 estrellas. Las misiones se
  desbloquean en orden. Cada misión tiene su narración y, al ganar, una **lámina** que puedes descargar.
- **Logros:** 32 en total; se desbloquean solos al terminar partidas (por ejemplo, ganar sin que te hundan una unidad, o completar una campaña).
- **Con cuenta** se guardan tus estrellas, logros y láminas. **Como invitado** puedes jugar libremente con amigos y probar la primera
  misión de cada campaña, pero no se guarda el progreso, y contra la IA hay un cupo diario por IP (10 por defecto). Ojo: si varias
  personas comparten la misma red (universidad, cibercafé), comparten también ese cupo.
- **Ajustes:** animaciones (completas, ligeras o sin), sacudida, narración y **modo aula**.

### Escenarios

| Escenario | Unidades | Dónde se usa |
|---|---|---|
| Mar | flota moderna | partidas normales y la campaña «Operación Litoral» (ficción) |
| Mar · piratas | barcos con velas | campaña «Patente de corso» (ficción) |
| Tierra | infantería, caballería y cañones (siglo XIX) | campaña «Armas de la República» |
| Selva | escuadras de soldados | campaña «Guerra del Chaco» |

Las reglas son las mismas en los cuatro; cambian los dibujos, los efectos y los textos.

### Tableros y flotas

| Tablero | Nombre | Barcos (largos) | Casillas de barco |
|---|---|---|---|
| 8×8 | Pequeño | 4, 3, 3, 2 | 12 |
| 10×10 | Clásico | 5, 4, 3, 3, 2 | 17 |
| 12×12 | Grande | 5, 4, 4, 3, 3, 2, 2 | 23 |
| 15×15 | Armada | 6, 5, 5, 4, 4, 3, 3, 3, 2, 2 | 37 |
| 20×20 | Océano | 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2 | 56 |

Los barcos pueden tocarse entre sí (como en el juego clásico). Cada tamaño escala la flota para que la densidad se
parezca a la del 10×10.

### Las cuatro IA

Las cuatro solo usan información **pública** (lo que sabe cualquier jugador); no hacen trampa.

| Nivel | Estrategia | Disparos que necesita para ganar* (10×10 / 20×20) |
|---|---|---|
| Fácil | Casilla al azar entre las no probadas | ≈ 91 / ≈ 393 |
| Normal | "Caza y objetivo": dispara en tablero de ajedrez; al tocar, explora los vecinos y sigue la línea | ≈ 44 / ≈ 201 |
| Difícil | **Mapa de densidad de probabilidad**: prueba todas las posiciones donde aún cabrían los barcos que quedan y dispara donde más se repiten; las que pasan por un impacto pesan mucho más | ≈ 40 / ≈ 186 |
| Experta | **Monte Carlo paralelo**: genera miles de flotas aleatorias compatibles con lo que se sabe y dispara donde más veces aparece un barco. El cálculo se **reparte entre los worker threads** | ≈ igual que Difícil (medido: 44.2 vs 44.2 en 200 partidas 10×10) |

\* Promedio medido en 20 partidas IA contra IA por celda de la tabla. Las pruebas automáticas comprueban que la
dificultad se nota (difícil ≪ fácil) y que ninguna IA dispara dos veces a la misma casilla.

> **Sobre la Experta (honestidad):** no juega *mejor* que la Difícil; la Difícil ya calcula una densidad muy buena.
> Su razón de existir es otra: es una IA **pesada y divisible**, justo el tipo de carga donde el paralelismo
> compensa (cada jugada dura decenas de ms y se puede partir en trozos independientes). Es el banco de pruebas del
> objetivo de la materia, no una mejora de nivel de juego.

---

## Música y jefes de cada bando (0.9)

- **Música en todo el juego**, fuerte solo en la entrada: «tambores de guerra» al abrir; ambiente suave en inicio y campañas; ambiente aún más suave en partida. Se ajusta
  en **Ajustes → Música de fondo / Volumen de la música**, y 🔊 silencia música y efectos. Baja sola cuando se lee la narración en voz alta. Código: `frontend/public/js/music.js`;
  pistas: `frontend/public/audio/` (compuestas por código con `tools/make_war_drums.py` y `tools/make_ambient.py`).
- **En las misiones ya no sale «Almirante IA» ni tu nombre**: en las campañas históricas verás a los jefes reales de la batalla (por ejemplo Marzana frente a Estigarribia en
  Boquerón) y en las de ficción nombres inventados al azar, rotulados «ficción». La ficha de la misión muestra «Al mando». Detalle y reglas: `docs/NARRATIVA.md`.

## Campañas, narración, logros y láminas (0.8)

**Campañas.** Cuatro campañas, una por escenario; cada misión es una partida contra la IA con tablero, escenario y dificultad fijos
(`backend/src/domain/campaigns.js`). Se desbloquean en orden; la última de cada campaña es **IA experta en 20×20**. Cada misión da de
1 a 3 estrellas (ganar + dos objetivos opcionales: pocos disparos y pocas bajas).

| Campaña | Escenario | Misiones | Tipo |
|---|---|---|---|
| Guerra del Chaco | Selva | 6 (Boquerón → Defensa de Villamontes) | histórica |
| Armas de la República (siglo XIX) | Tierra (infantería, caballería y cañones) | 5 (Tumusla → Ayacucho, por dificultad) | histórica |
| Patente de corso | Mar · piratas | 4 | **ficción** |
| Operación Litoral | Mar · flota moderna | 5 | **ficción** |

**Narración.** Cada misión trae una historia (`backend/src/content/`): fecha y lugar, qué pasó de verdad, datos, **fuentes con enlace**, escenas de
apertura, frases durante la partida (primer impacto, primera unidad hundida, mitad de la flota, victoria…), un **glosario** con las palabras difíciles que
aparecen en esa misión, y preguntas de comprensión. Si en la historia el bando del jugador perdió (Boquerón, Nanawa, Campo Vía, Calama, Alianza), la misión se
marca como **«reinterpretación»** y la pantalla dice qué pasó realmente. El panel no bloquea el juego, se puede ocultar y se anuncia **una sola vez completo**
a los lectores de pantalla (el texto visible se escribe letra a letra y no se lee fragmentado). Un **oficial por campaña** narra con cara animada (se mueve la boca mientras habla). Opcional: **lectura en voz alta** (Ajustes) con audios grabados con voz neural (`tools/voz/`), o con la voz del navegador si no existen.

**Modo aula (en «Ajustes»).** Pensado para clases: la ficha se lee por escenas (hay que llegar a la última para empezar) y, al ganar, aparecen las
preguntas de comprensión. **Las corrige el servidor** (`POST /api/quiz`): el navegador no recibe la respuesta correcta ni su explicación hasta contestar, así
que sirven para evaluar. Con cuenta se guarda el mejor resultado y hay logros de estudio («Buen alumno», «Estudioso», «Sabio de las batallas»); como invitado se
corrige pero no se guarda. Además, en cada misión real, la ficha ofrece una **guía didáctica (.md)** y una **hoja de trabajo imprimible** (se generan en el
navegador; las respuestas no van en la guía).

**Láminas (recompensa).** Cada misión ganada (1 o más estrellas) entrega directamente su lámina: una tarjeta en pixel art ya terminada (marco dorado, título,
leyenda y estrellas dentro de la imagen; paisajes y siluetas, sin retratos). En «🖼️ Láminas» se ven las ganadas (las demás, en silueta con la misión que las
desbloquea) y se **descargan en PNG** en tres formatos: **horizontal** (el archivo original, sin tocar), **cuadrada** y **vertical 9:16** (historias, con la tarjeta
centrada sobre un fondo liso); también todas juntas en un **ZIP**, y en celulares se **comparten** con el menú del sistema. Las 20 imágenes viven en la carpeta
fija `frontend/public/img/laminas-hd/` (tarjeta completa) y `frontend/public/img/laminas-hd/min/` (miniaturas). Con tres estrellas en todas las misiones se gana
«Álbum dorado».

**Rangos.** De Recluta a **Mariscal** según las estrellas reunidas (máximo 60); se ven en el resumen de «Campañas» junto con lo que falta para el siguiente.

**Disparos y animaciones.** Fogonazo → proyectil con arco y **estela del color del escenario** → impacto o salpicadura con **ondas**. Cada escenario tiene
**su proyectil**: cometa en el mar, bala de cañón con mecha (piratas), granada de mortero (tierra) y bala trazadora (selva). «¡Racha ×N!» con aciertos seguidos y
destellos al hundir y en el último golpe. En «Ajustes»: animaciones **completas / ligeras / sin**, sacudida, narración, voz y modo aula; se respeta
`prefers-reduced-motion` y hay un tope de efectos simultáneos para celulares modestos.

**App instalable y sin conexión parcial (PWA).** Se puede instalar desde el navegador. Sin conexión abre la interfaz y muestra las campañas, las guías y las láminas
ya vistas. **Jugar sigue necesitando conexión** (las partidas usan WebSocket y las reglas viven en el servidor). El service worker **no guarda nada de cuentas**
(progreso, ingreso, preguntas), para que en un computador compartido no se vea el progreso de otra persona.

**Cuentas e invitados.** El progreso (`CampaignProgress`), los logros (`AchievementUnlock`) y los resultados del cuestionario (`QuizResult`) se guardan por
cuenta. Un invitado puede jugar libremente con amigos, y probar la primera misión de cada campaña (ve sus estrellas, pero no se guardan). Contra la IA tiene un
cupo diario por IP (`GUEST_AI_DAILY`, 10 por defecto; una revancha cuenta como partida nueva).

**Logros.** 36 logros en cuatro categorías (progreso, habilidad, variedad, históricos), con aviso al desbloquear y panel en «🏆 Logros». Hay uno histórico por cada
misión real, además de «Historiador», «Maestro de campaña», «Mano firme», «Constelación», «Álbum dorado» y los tres de estudio. Las reglas están en
`backend/src/domain/achievements.js` y se evalúan en el servidor.

**Pixel art.** `tools/pixelart/` genera, píxel a píxel y de forma determinista, un atlas PNG + JSON (32 y 16 px por casilla): 4 escenarios × 7 unidades × 2
orientaciones × 5 estados, más proyectiles, salpicadura, polvo, hojas, impacto, explosión, fuego, humo, marcadores y mira. Si el atlas no carga, el tablero
vuelve a sprites SVG (en Tierra: caballería, infantería y cañones). Para reemplazar una unidad por arte de un dibujante, mira
[`tools/pixelart/README.md`](tools/pixelart/README.md).

**Contenido histórico.** Los datos se **contrastaron con fuentes** (y salieron errores del borrador que se corrigieron), pero **aún necesitan la revisión de una
persona de historia** antes de usarse con estudiantes: [`docs/VERIFICACION-HISTORICA.md`](docs/VERIFICACION-HISTORICA.md). Para editar o añadir contenido:
[`docs/NARRATIVA.md`](docs/NARRATIVA.md); para validarlo: `cd backend && npm run validate:content`.

### Uso en clase

- **Servidor local.** Un computador del aula puede ser el servidor (`docker compose up` o `node src/index.js`) y los demás entran por la red local; no hace falta internet
  para jugar entre ustedes. Para proyectar una partida en el pizarrón, entra a la sala como espectador.
- **Muchos estudiantes en la misma red:** todos comparten IP. Sube `AUTH_PER_MINUTE` (p. ej. `120`) para que un curso entero pueda registrarse a la vez y, si usan invitados
  contra la IA, `GUEST_AI_DAILY` (o mejor, que usen cuentas).
- **Cuentas de estudiantes:** el progreso y los resultados del cuestionario se guardan por cuenta. No se pide correo ni datos personales: **usen apodos**. Define con tu
  institución qué datos de menores pueden guardarse antes de publicarlo en internet.
- **Sin conexión:** la app instalada abre sin internet y permite leer campañas, guías y láminas; las partidas necesitan estar conectados al servidor.

## Arquitectura

```mermaid
flowchart LR
    B["Navegador<br/>HTML + ES modules"] -- "HTTP :8080" --> N
    subgraph Docker["docker compose"]
      N["frontend<br/>nginx"] -- "/api (HTTP)<br/>/ws (WebSocket)" --> A
      A["backend<br/>Node.js"] -- "Prisma" --> D[("db<br/>PostgreSQL")]
      A -. "worker threads" .-> W["Pool de IA<br/>(hilos)"]
    end
```

* El navegador solo habla con **nginx** (mismo origen: sin CORS). nginx sirve los archivos estáticos y reenvía
  `/api` y `/ws` al backend.
* El backend **no se expone** al exterior en Docker; solo el frontend publica puerto.
* La IA puede calcular en **hilos** separados del hilo principal.

### Estructura de carpetas

```
batalla-naval/
├── docker-compose.yml          # db + backend + frontend
├── .env.example                # variables de entorno documentadas
├── scripts/init-env.mjs        # genera .env con secretos aleatorios
├── docs/PROTOCOLO.md           # mensajes WebSocket al detalle
├── docs/NARRATIVA.md           # cómo añadir campañas, misiones, logros y láminas
├── docs/PENDIENTES.md          # lo que falta y las ideas nuevas (se actualiza en cada entrega)
├── docs/VERIFICACION-HISTORICA.md  # qué se contrastó, con qué fuentes y qué falta revisar
├── backend/
│   ├── Dockerfile  docker-entrypoint.sh
│   ├── prisma/                 # schema.prisma (usuarios, partidas, puntos, campañas, logros), migrations/ y seed.js
│   ├── scripts/bench-parallel.js   # benchmark con métricas formales
│   ├── scripts/                    # bench-parallel, plot-results, calibrate, latency-test, quality-vs-samples,
│   │                               # tournament, analyze-game, load-test, ai-node, mc-checksum
│   ├── scripts/tournament.js       # torneo IA vs IA en paralelo
│   ├── src/
│   │   ├── domain/             # REGLAS: fleet, board, game, scoring, campaigns, achievements, laminas, summary  (sin red, sin base de datos)
│   │   ├── content/            # NARRACIÓN de las misiones: chaco, siglo19, ficcion + validación (index.js)
│   │   ├── ai/                 # strategies, montecarlo (puro), tasks, pool (prioridades, cancelación), distributed + node-server (IA remota), analysis, wire
│   │   ├── realtime/           # room, roomManager, gateway (WebSocket), protocol (esquemas)
│   │   ├── repositories/       # memoryStore y prismaStore (mismo contrato)
│   │   ├── services/           # auth (registro, login, JWT) y progress (misiones y logros)
│   │   ├── http/               # rutas REST, límite de intentos, cupo diario de invitados
│   │   ├── config.js  app.js  index.js  metrics.js
│   └── test/                   # node:test
├── tools/pixelart/             # generador del atlas (generate.mjs) y de los íconos
├── tools/e2e/                  # prueba de punta a punta en un navegador real (Playwright, opcional)
├── .github/workflows/          # CI: pruebas + contenido + Prisma contra PostgreSQL; enlaces de fuentes cada semana
├── kernels/                    # el mismo núcleo Monte Carlo en C + OpenMP y C + MPI + OpenMP, y ping-pong MPI
├── cluster/                    # clúster de PCs: hostfile, check-cluster.sh, run-experiments.sh
├── informe/                    # Hito 1 y informe IEEE (LaTeX) + results-to-latex.mjs
└── frontend/
    ├── Dockerfile  nginx.conf
    ├── public/                 # index.html, css/, js/ (ES modules), fonts/, img/ (atlas PNG+JSON, terrenos)
    └── test/                   # jsdom + backend real
```

### Capas y por qué están separadas

| Capa | Responsabilidad | No sabe nada de… |
|---|---|---|
| `domain/` | Reglas: colocar, disparar, turnos, victoria, puntos | red, tiempo, base de datos |
| `ai/strategies.js` | Elegir una casilla dado lo que se sabe | partida, red, hilos |
| `realtime/room.js` | Asientos, espectadores, temporizadores, turnos de la IA, revancha | WebSocket (usa "canales" con `send`/`close`) |
| `realtime/gateway.js` | Validar mensajes, identificar al remitente, entregar a la sala | reglas del juego |
| `repositories/` | Guardar y leer usuarios y partidas | todo lo demás |

Esta separación es lo que permite probar las reglas en milisegundos, cambiar la base de datos sin tocar el juego, y
(en el futuro) mover las salas a otro proceso.

### Decisiones importantes

* **El servidor manda.** Valida turnos, límites, tiempos y victoria. El cliente nunca decide nada. Los barcos del rival
  jamás viajan por la red hasta que termina la partida.
* **Estado completo en cada cambio**, no solo la jugada: simplifica la reconexión.
* **Almacén intercambiable.** El mismo contrato de pruebas valida `memoryStore` y `prismaStore`.
* **JavaScript con módulos ES, sin compilador.** Menos piezas para aprender; migrar a TypeScript está en la hoja de ruta.
* **Frontend sin framework ni paso de build.** Se construye con `createElement` y `textContent` (nunca `innerHTML`), así
  un nombre de usuario malicioso no puede inyectar HTML. Hay una prueba para eso.

---

## Procesos paralelos: cómo funcionan aquí

Tu pregunta de partida. Conviene separar dos ideas:

* **Concurrencia**: atender muchas cosas "a la vez" turnándose (una persona atendiendo varias mesas).
* **Paralelismo**: ejecutar de verdad varias cosas **al mismo instante** en núcleos distintos (varias personas atendiendo).

Node ejecuta tu JavaScript en **un solo hilo**. Por eso hay tres niveles en este proyecto:

### 1. Muchas salas a la vez: concurrencia (ya incluida)

Cada sala es un objeto independiente con sus temporizadores. Mientras un jugador piensa, el event loop atiende a los
demás: no hace falta paralelismo para tener cientos de partidas simultáneas, porque casi todo el tiempo se pasa
*esperando* (la persona, la red). Las pruebas juegan varias salas a la vez.

### 2. La IA en worker threads: paralelismo real

`ai/pool.js` mantiene un grupo de hilos (`worker_threads`) con una **cola compartida**: las tareas esperan en una
sola cola y cada hilo, apenas queda libre, toma la siguiente (balanceo de carga dinámico, *work-sharing*). Si un
hilo falla, el pool lo reemplaza; si una tarea no responde a tiempo (5 s por defecto), la sala dispara al azar para
no bloquear la partida.

Hay **tres patrones de paralelismo** en el código, cada uno en un archivo concreto:

| Patrón | Dónde | Qué se reparte | Comunicación |
|---|---|---|---|
| **Paralelismo de datos** (map-reduce) | `pool.density()` + `ai/montecarlo.js` | Las *N* muestras Monte Carlo de **una** jugada se parten en *p* trozos (uno por hilo) | Ninguna entre hilos; al final se **suman** los conteos (reducción) |
| **Paralelismo de tareas** (bolsa de tareas) | `pool.tournament()` + `scripts/tournament.js` | Partidas IA vs IA completas e independientes | Ninguna; cada hilo toma la siguiente partida de la cola |
| **Concurrencia de E/S** | `realtime/` | Muchas salas atendidas por el event loop | No es paralelismo de cálculo |

#### Dos modelos de comunicación entre hilos (`MC_MODE`)

* `message`: el tablero viaja **copiado** por `postMessage` (estructura clonada) y cada hilo devuelve su arreglo de
  densidad, que el hilo principal suma. Es el modelo de **paso de mensajes**.
* `shared` (por defecto): el tablero vive en un `SharedArrayBuffer` que todos leen **sin copiarlo**, y cada hilo
  vuelca su resultado local con `Atomics.add` en un arreglo compartido. Es el modelo de **memoria compartida**.
  Se acumula primero en local y se vuelca una sola vez para que haya poca contención en las operaciones atómicas.

Las pruebas verifican que **ambos modos dan exactamente la misma densidad** (mismas semillas por trozo), de modo que
comparar sus tiempos es una comparación justa. Cada trozo usa una semilla derivada (`ai/rng.js`), por eso los
resultados son **reproducibles** sea cual sea el número de hilos.

#### Planificación y robustez del pool (`ai/pool.js`)

| Mecanismo | Qué hace | Variable / dónde |
|---|---|---|
| **Dos prioridades** | Las tareas `live` (una partida esperando su jugada) pasan delante de las `batch` (torneos, análisis). Un torneo largo no retrasa a nadie que esté jugando | `submit(msg, { priority })` |
| **Granularidad adaptativa** | Si el cálculo cuesta menos que repartirlo, se hace en el hilo principal. El umbral es *muestras × barcos* y se calibra en tu equipo | `PARALLEL_MIN_COST`, `AI_ADAPTIVE`, `npm run calibrate` |
| **Contrapresión** | Con la cola larga, la IA Experta usa **menos muestras** (juega peor pero a tiempo); saturada del todo, rechaza y la sala dispara al azar en vez de acumular trabajo | `AI_MAX_QUEUE` |
| **Cancelación** | Si el jugador se va o la sala se cierra, el cálculo se aborta: lo que espera en cola se retira y lo que ya corre lee una **bandera compartida** (`Atomics`) y se detiene en milisegundos | `AbortSignal` en `choose`/`density`/`submit` |
| **Métricas** | Retraso del event loop (p50/p99/máx) y estado del pool, en `/api/status` y en formato Prometheus en `/api/metrics` | `src/metrics.js` |

#### IA distribuida: varios procesos o máquinas (`ai/distributed.js`)

Con `AI_NODES` el servidor de juego deja de calcular y reparte las tareas por la **red** a **nodos de IA**, cada uno
con sus propios hilos (arquitectura **maestro-trabajadores**). Son dos niveles de paralelismo: entre procesos/máquinas
(memoria separada, comunicación por mensajes) y dentro de cada nodo (hilos).

```
 jugadores ──WebSocket──► backend (DistributedPool) ──HTTP──► ai-node 1 (hilos)
                                      │                 └───► ai-node 2 (hilos)
                                      └── respaldo: pool local si ningún nodo responde
```

```bash
# Prueba local sin Docker: dos nodos y el backend (tres terminales, o con &)
export AI_NODE_TOKEN=un-secreto
cd backend
AI_NODE_PORT=5001 npm run ai-node
AI_NODE_PORT=5002 npm run ai-node
AI_NODES=http://127.0.0.1:5001,http://127.0.0.1:5002 npm start     # y juega contra la IA Experta
curl localhost:4000/api/status                                        # ai.nodes: capacidad, tareas, fallos de cada nodo

# Con Docker:  docker compose --profile distributed up --build --scale ai-node=3   (ver docker-compose.yml)
```

Decisiones de diseño:

* **Mensajes, no memoria compartida:** `SharedArrayBuffer` no cruza procesos, así que entre nodos solo se usa
  `message`. El resultado es **idéntico** al de hilos locales (misma semilla por trozo): las pruebas lo comprueban.
* **Balanceo por carga relativa** (tareas en vuelo ÷ hilos del nodo) y **tolerancia a fallos**: si un nodo falla se
  marca caído unos segundos (*circuit breaker*) y la tarea se **reintenta en otro**. Es seguro porque las tareas son
  *idempotentes* (la semilla fija el resultado). Sin nodos sanos se usa el respaldo local.
* **Seguridad del nodo:** exige un token (comparación en tiempo constante), valida y **acota** cada campo (tamaño,
  muestras ≤ 5 M, partidas ≤ 500…), limita el cuerpo a 256 KB, rechaza con 503 si está saturado y descarta
  cualquier campo desconocido. **No lo expongas a internet:** déjalo en una red privada.
* Si el servidor corta la petición (cancelación o timeout), el nodo **detiene el cálculo**.

#### Análisis de partidas (`ai/analysis.js`)

Repite una partida terminada y mide, para cada disparo, la probabilidad que tenía la casilla elegida frente a la mejor
posible (eficiencia = 1 es una jugada óptima). **Un disparo = una tarea**, así que se reparte sin comunicación entre
hilos. `npm run analyze` juega una partida y la analiza en secuencial y en paralelo.

### 3. Más participantes en la sala

Además de los dos jugadores, entran espectadores (hasta 20). Es concurrencia de conexiones, no de cálculo. Un modo
de 3-4 jugadores (todos contra todos) requiere extender las reglas y está en la hoja de ruta.

### Medir el paralelismo en tu equipo

```bash
cd backend
nproc                                   # cuántos núcleos tienes (Windows: node -e "console.log(require('os').availableParallelism())")
npm run bench                           # los 4 experimentos
npm run bench -- --workers 1,2,4,8 --samples 400000 --reps 5 --csv resultados.csv
node scripts/plot-results.js resultados.csv graficas.html     # gráficas listas para el informe
```

| Comando | Qué responde |
|---|---|
| `npm run bench` | Speedup, eficiencia, Karp-Flatt, escalabilidad fuerte y débil, granularidad y torneo |
| `node scripts/plot-results.js` | Convierte el CSV del benchmark en gráficas (HTML con SVG, sin librerías) |
| `npm run calibrate` | ¿Desde qué tamaño de tarea conviene repartir en TU equipo? Recomienda `PARALLEL_MIN_COST` |
| `npm run latency` | ¿Protegen los hilos al servidor? Mide el retraso del event loop con la IA en el hilo principal vs en hilos |
| `npm run quality` | ¿Más muestras hacen mejor a la IA Experta? Disparos para ganar según las muestras, con error estándar |
| `npm run tournament` | Partidas IA vs IA repartidas entre hilos (bolsa de tareas) |
| `npm run analyze` | Calidad de cada disparo de una partida, calculada en paralelo |
| `npm run load -- --clients 100` | Prueba de carga: jugadores simulados por WebSocket; latencia por disparo y partidas por segundo |
| `kernels/` | El mismo núcleo en **C + OpenMP** y en **C + MPI + OpenMP** (para el clúster), más un ping-pong MPI para medir α y β de la red. Resultado idéntico al de Node, ver `kernels/README.md` |
| `cluster/` | Guía y scripts para armar el clúster de PCs (hostfile, verificación, experimentos de escalabilidad fuerte y débil) |
| `informe/` | Hito 1 e informe técnico en formato IEEE, con generador de tablas y figuras desde tus CSV (`informe/README.md`) |

`npm run bench` ejecuta cuatro experimentos y calcula las métricas clásicas (la línea base **T1** es el cálculo
secuencial en un solo hilo, *sin* pool):

| Experimento | Qué mide | Métricas |
|---|---|---|
| 1. **Escalabilidad fuerte** | Mismo trabajo (muestras fijas), más hilos; modos `message` y `shared` | Speedup `S = T1/Tp`, eficiencia `E = S/p`, **Karp-Flatt** `e = (1/S − 1/p)/(1 − 1/p)` |
| 2. **Escalabilidad débil** | El trabajo crece con los hilos (muestras por hilo constantes) | Eficiencia débil `T(1,N) / T(p,p·N)` |
| 3. **Granularidad** | Tareas diminutas (IA Difícil): cuándo el paralelismo *empeora* | Speedup < 1 = sobrecarga mayor que el cómputo |
| 4. **Torneo** | Bolsa de tareas con cola compartida | Speedup, eficiencia y verificación de que el resultado no depende del reparto |

Cómo leer los resultados:

* **Ley de Amdahl:** si una fracción `f` del trabajo es secuencial, `S_max = 1/f`. Aquí la parte secuencial es
  construir las listas de posiciones, repartir, sumar los conteos y elegir la casilla. La métrica de Karp-Flatt
  estima `f` con tus datos: si `e` se mantiene constante al subir `p`, la limitación es esa fracción serial; si `e`
  **crece**, hay sobrecarga que aumenta con los hilos (comunicación, contención o más hilos que núcleos).
* **Gustafson (escalabilidad débil):** si al tener más hilos también haces *más* trabajo (más muestras = mejor IA),
  la eficiencia se mantiene mucho mejor que en la fuerte.
* **No pidas más hilos que núcleos** (`nproc`): el sistema solo alterna entre ellos y pierdes tiempo.
* **Con 1 núcleo no puede haber aceleración real.** En el entorno donde se escribió esta entrega (1 solo núcleo,
  compartido) el benchmark mostró aceleraciones menores que 1 y números ruidosos: es lo esperado y por eso **no se
  incluyen cifras de rendimiento en este README. Las tuyas, medidas en tu equipo, son las que valen para el informe.**
* El experimento 3 es la otra cara de la moneda: con la IA Difícil (decenas de microsegundos por jugada) enviar la
  tarea a otro hilo cuesta más que calcularla. Paralelizar **tareas finas** no conviene; la IA Experta existe
  precisamente para tener tareas gruesas.

Por defecto `AI_WORKERS` es automático (0 con 1 núcleo, hasta 2 con más). Para la IA Experta conviene
`AI_WORKERS` = número de núcleos − 1 (deja uno libre para el event loop). `AI_WORKERS=0` lo apaga.

### Siguiente nivel: varias instancias del backend

La IA ya puede salir del proceso (sección anterior), pero las **salas** siguen viviendo en la memoria de un solo
backend. Para repartir también a los jugadores hacen falta `cluster` o varios contenedores con **Redis** (pub/sub para
difundir mensajes entre procesos) y *sticky sessions* en el balanceador: un jugador debe volver siempre a la instancia
donde está su sala. Es lo que queda pendiente de la parte distribuida; ver `MEJORAS-Y-ESCALADO.md`.

---

## Base de datos con Prisma

El esquema está en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

```mermaid
erDiagram
    User ||--o{ MatchPlayer : "juega como"
    Match ||--|{ MatchPlayer : "tiene 2"
    User {
        string id PK
        string username
        string usernameLower UK
        string passwordHash
        string avatar
        int points
        int rating
        int wins
        int losses
        int gamesPlayed
    }
    Match {
        string id PK
        enum mode "PVP | AI"
        string difficulty
        int boardSize
        enum winnerSide "A | B"
        string reason
        bool ranked
        datetime startedAt
        datetime endedAt
    }
    MatchPlayer {
        string id PK
        string matchId FK
        enum side "A | B"
        string userId FK "null: invitado o IA"
        string displayName
        bool isAi
        bool won
        int shots
        int hits
        int points
        int ratingDelta
    }
```

Decisiones del modelo:

* `usernameLower` único: "Ana" y "ana" no pueden ser dos cuentas.
* Las estadísticas acumuladas (`points`, `rating`, `wins`…) están en `User` para que el ranking sea una consulta
  simple. Se actualizan con **incrementos atómicos** dentro de una transacción, junto con el registro de la partida.
* `MatchPlayer.userId` puede ser `null` (invitados e IA): el historial guarda **ambos lados** siempre.
* Si se borra una cuenta, sus partidas quedan (`onDelete: SetNull`).
* Las contraseñas se guardan con **bcrypt** (nunca en claro).

### Migraciones

Desde la 0.6 el proyecto incluye `prisma/migrations/` con dos migraciones: `0_init` (esquema original) y
`1_campanas_y_logros` (columna `Match.biome` y las tablas `CampaignProgress` y `AchievementUnlock`). El contenedor usa
`prisma migrate deploy`. Si tu base ya existía de una versión anterior creada con `db push`, el arranque marca `0_init`
como aplicada y aplica solo la nueva (a mano: `npx prisma migrate resolve --applied 0_init && npx prisma migrate deploy`).
Las migraciones SQL se probaron en un PostgreSQL 16 real; el cliente Prisma sigue sin poder ejecutarse en el entorno de
desarrollo (sin descarga de motores), así que corre el contrato de pruebas contra tu base ([cómo](#probar-el-almacén-prisma)).

Para crear una migración nueva cuando cambies el esquema:

```bash
# con la base de datos arriba (docker compose up -d db) y DATABASE_URL definida (ver Opción C)
cd backend
npx prisma migrate dev --name init
git add prisma/migrations
```

A partir de que exista esa carpeta, el contenedor usa `prisma migrate deploy` automáticamente. Cada vez que cambies
`schema.prisma`: `npx prisma migrate dev --name <descripcion>`.

### Útiles

```bash
npx prisma studio        # interfaz web para ver y editar las tablas (necesita DATABASE_URL)
npm run db:seed          # cuentas de ejemplo para el ranking
```

### Probar el almacén Prisma

El almacén Prisma aún no se ha ejecutado. Para validarlo hay un contrato de pruebas compartido:

```bash
cd backend
export TEST_DATABASE_URL="postgresql://naval:TU_CLAVE@localhost:5432/naval?schema=public"
npm test
```

> ⚠️ Esas pruebas **borran las tablas** `User`, `Match` y `MatchPlayer` antes de cada caso. Usa una base de pruebas
> (por ejemplo, crea una llamada `naval_test`), no la de tus datos.

Si fallan 1 o 2, el arreglo estará en `backend/src/repositories/prismaStore.js`: el contrato dice exactamente qué
se espera.

---

## Sistema de puntos

Funciones puras en [`domain/scoring.js`](backend/src/domain/scoring.js), con pruebas.

**Puntos** (acumulados, nunca bajan; ordenan el ranking):

```
base      = ganar ? 100 + round(50 · precisión) : 25        (precisión = aciertos / disparos)
multiplic = modo × (tamaño / 10)
puntos    = round(base × multiplic)
```

| Modo | Multiplicador |
|---|---|
| Persona vs persona (ambos con cuenta) | ×1.5 |
| Persona vs persona (alguien sin cuenta) | ×0.75 |
| IA fácil / normal / difícil | ×0.5 / ×1 / ×1.5 |

Un tablero 20×20 vale el doble que uno 10×10. **Abandonar** una partida en curso da 0 puntos al que se va.

**Elo** (`rating`, empieza en 1000, mínimo 100, K = 32): solo cambia en partidas **entre dos cuentas registradas**. Así
nadie infla su Elo jugando contra invitados desechables ni contra la IA. Las partidas contra la IA y contra invitados
suman puntos, pero no mueven el Elo.

Una misma cuenta no puede sentarse en los dos lados de una sala.

---

## Protocolo y API

### WebSocket (`/ws`)

Mensajes JSON; el servidor valida cada uno con un esquema. Resumen: `hello`, `create`, `join`, `spectate`,
`mission`, `randomize`, `ready`, `fire`, `rematch`, `react`, `leave`, `ping` (cliente → servidor) y `welcome`, `state`, `fleet`,
`react`, `left`, `error`, `pong` (servidor → cliente). **Todo el detalle, la forma de `state`, los errores, la
reconexión y los tiempos están en [`docs/PROTOCOLO.md`](docs/PROTOCOLO.md).**

### REST (`/api`)

| Método y ruta | Descripción |
|---|---|
| `GET /api/meta` | Tamaños, flotas, dificultades, avatares y reacciones (el frontend arma sus pantallas con esto) |
| `POST /api/auth/register` | `{username, password, avatar?}` → `{user, token}` |
| `POST /api/auth/login` | `{username, password}` → `{user, token}` |
| `GET /api/me` | Requiere `Authorization: Bearer <token>`. Tu perfil y últimas partidas |
| `GET /api/leaderboard?limit=20` | Ranking por puntos |
| `GET /api/rooms` | Salas públicas (esperando rival o para mirar) |
| `GET /api/campaigns` | Catálogo público: campañas, misiones (briefing, cierre, objetivos) y logros |
| `GET /api/progress` | Requiere sesión. Estrellas y mejor marca por misión, y logros desbloqueados |
| `GET /api/quota` | Partidas contra la IA que le quedan hoy a quien consulta (invitados) |
| `GET /api/status` | Salas, jugadores, estado del pool de IA (y de cada nodo si es distribuida), retraso del event loop, almacenamiento |
| `GET /api/metrics` | Lo mismo en formato Prometheus (para Grafana) |
| `GET /healthz` | `ok` (lo usan Docker y los balanceadores) |

---

## Configuración

Todo por variables de entorno (en Docker, desde `.env`).

| Variable | Por defecto | Para qué |
|---|---|---|
| `JWT_SECRET` | *(obligatoria en producción)* | Firma los tokens. ≥ 16 caracteres; el backend rechaza el valor de ejemplo |
| `DATABASE_URL` | — | Si existe, se usa PostgreSQL con Prisma |
| `STORAGE` | `prisma` si hay `DATABASE_URL`, si no `memory` | Fuerza el tipo de almacén |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | Dónde escucha el backend |
| `AI_WORKERS` | automático | Hilos para la IA (`0` = en el hilo principal) |
| `MC_SAMPLES` | `20000` | Muestras Monte Carlo por jugada de la IA Experta (más = más cálculo = más para repartir) |
| `MC_MODE` | `shared` | `shared` (SharedArrayBuffer + Atomics) o `message` (postMessage) |
| `PARALLEL_MIN_COST` | `100000` | Costo (muestras × barcos) desde el cual la IA Experta se reparte entre hilos; calibrar con `npm run calibrate` |
| `AI_ADAPTIVE` | `true` | `false` fuerza todo el trabajo por los hilos (útil para medir) |
| `AI_MAX_QUEUE` | automático | Cola a partir de la cual se rechaza trabajo en vivo (contrapresión) |
| `AI_NODES` / `AI_NODE_TOKEN` | — | Nodos de IA remotos separados por comas y el secreto compartido (ver IA distribuida) |
| `AI_NODE_PORT` / `AI_NODE_HOST` / `AI_NODE_WORKERS` | `5001` / `127.0.0.1` / núcleos−1 | Solo para `npm run ai-node` |
| `AUTH_PER_MINUTE` | `20` | Registros/ingresos por IP y minuto en producción. **En un colegio, súbelo** (p. ej. `120`), porque todo el curso comparte IP |
| `QUIZ_PER_MINUTE` | `60` | Cuestionarios corregidos por IP y minuto en producción |
| `GUEST_AI_DAILY` | `10` | Partidas diarias contra la IA para invitados, por IP (`0` = sin límite). No cuentan las salas con amigos ni las cuentas |
| `TURN_SECONDS` | `30` | Tiempo por turno (`0` = sin límite) |
| `PLACEMENT_SECONDS` | `90` | Tiempo para colocar la flota (`0` = sin límite) |
| `GRACE_SECONDS` | `45` | Tiempo para reconectarse antes de perder |
| `MAX_ROOMS` / `MAX_SPECTATORS` | `500` / `20` | Límites |
| `WS_MSGS_PER_SEC` | `20` | Protección contra inundación, por conexión |
| `ROOM_IDLE_MINUTES` | `30` | Cierra salas sin actividad |
| `STATIC_DIR` | autodetectado en desarrollo | Carpeta del frontend que sirve el propio backend |
| `POSTGRES_USER/PASSWORD/DB`, `WEB_PORT`, `DB_PORT` | ver `.env.example` | Solo para `docker compose` |

---

## Pruebas

```bash
cd backend  && npm test        # reglas, IA, puntos, almacén, API, contenido de campañas y partidas completas por WebSocket
cd backend  && npm run validate:content   # valida narración, fuentes, logros y láminas (sin servidor)
cd backend  && npm run check:links        # comprueba que los enlaces de fuentes respondan (necesita internet)
cd frontend && npm install && npm test   # frontend en jsdom contra un backend real (necesita backend/npm install antes)
cd backend  && npm run bench   # benchmark del paralelismo (4 experimentos con speedup, eficiencia y Karp-Flatt)
cd backend  && npm run tournament   # partidas IA vs IA repartidas entre hilos
cd backend  && npm run calibrate && npm run latency && npm run quality && npm run analyze && npm run load -- --clients 50
```

Estado al entregar: **backend 172 pruebas (161 pasan, 11 se omiten a propósito: son las de Prisma y requieren
`TEST_DATABASE_URL`) · frontend 73 pruebas (73 pasan)**.

Prueba de punta a punta en un navegador real (opcional; necesita `pip install playwright && playwright install chromium`):

```bash
cd backend && NODE_ENV=development PORT=4010 STORAGE=memory node src/index.js &   # servidor de pruebas
python3 tools/e2e/mision.py http://localhost:4010                                   # juega una misión y guarda capturas en /tmp/bn-e2e
```

Qué cubren, en lenguaje llano: que no se pueda colocar un barco fuera del tablero ni encima de otro; que el
servidor rechace jugar sin turno o disparar dos veces a la misma casilla; que ningún jugador vea los barcos del
rival; que una partida completa contra la IA termine en todos los tamaños; que una reconexión te devuelva a tu
asiento y que no volver a tiempo cuente como abandono; que el tiempo agotado dispare por ti; que el Elo se
transfiera (lo que sube uno lo baja el otro) y que los puntos queden guardados.

---

## Seguridad

Lo que hay:

* Contraseñas con **bcrypt**; tokens **JWT** de 7 días; el login responde igual para "usuario inexistente" y
  "clave incorrecta" y gasta el mismo tiempo (evita descubrir qué cuentas existen).
* Límite de intentos en registro/login por IP (20 por minuto en producción).
* Validación estricta de todo lo que llega (REST y WebSocket), tamaño máximo de mensaje, límite de mensajes por segundo.
* El servidor valida toda jugada; los barcos ocultos nunca se envían.
* Cabeceras de seguridad y **Content-Security-Policy** estricta (nginx y backend); el frontend no usa `innerHTML`.
* Contenedor del backend sin root; el backend no publica puerto en Docker.
* El backend se niega a arrancar en producción sin un `JWT_SECRET` real.

Límites conocidos (para tenerlos presentes):

* El token JWT se guarda en `localStorage` (si hubiera una vulnerabilidad XSS, podría leerse). Alternativa futura: cookie `HttpOnly`.
* El límite de intentos es en memoria: sirve para una sola instancia.
* Las salas viven en memoria: si el backend se reinicia, las partidas en curso se pierden (los puntos ya guardados no).
* Sin verificación de correo ni recuperación de contraseña.
* `npm audit` reporta una advertencia de severidad alta en una dependencia **de la herramienta de línea de comandos
  de Prisma** (`deepmerge-ts`, usada al leer su configuración). No está en el camino de las partidas; conviene
  revisarla cuando haya una versión estable de Prisma que la actualice.

---

## Publicarlo en internet

Cuando tengas todo funcionando en `docker compose`, hay opciones sencillas (heredadas de la versión web del Tres en Raya):

* **Cloudflare Tunnel** (sin abrir puertos): con el juego corriendo en tu PC, `cloudflared tunnel --url http://localhost:8080`
  entrega una dirección `https://….trycloudflare.com` válida para demostraciones. Con un dominio propio, un túnel
  con nombre da una dirección fija. Cloudflare admite WebSocket en todos los planes.
* **Un VPS o servicio con Docker** (Render, Railway, Fly.io, un servidor propio): sube el repositorio y ejecuta
  `docker compose up -d`. Pon un proxy con **HTTPS** delante y usa un `JWT_SECRET` y una clave de base de datos propias.
  Los servicios gratuitos suelen "dormir" tras unos minutos; ábrelo antes de una demostración.

---

## Hoja de ruta

Orden sugerido para ir mejorando **poco a poco**, probando en cada paso:

- [x] **M0 · Base (esta entrega):** reglas, 5 tamaños de tablero, IA de 3 niveles, salas, espectadores, reconexión,
  temporizadores, cuentas, puntos, Elo, ranking, contenedores separados, pruebas.
- [ ] **M1 · Validar en tu equipo:** ejecutar Docker y Prisma, crear la migración `init`, correr el contrato contra
  Postgres, revisar el diseño en celular y en un tablero 20×20. *(Aquí se corrige lo que haya fallado.)*
- [x] **M2a · Campañas y pixel art (0.6):** cuatro campañas con misiones y estrellas, logros, cuentas con progreso, cupo de invitados, atlas de pixel art con estados y animaciones, disparos animados y piel de interfaz.
- [x] **M2c · Aula y PWA (0.8):** preguntas corregidas en el servidor y resultados por cuenta, glosario, guías y hojas de trabajo, voz, rangos, formatos para redes y ZIP, proyectiles por escenario, app instalable con interfaz sin conexión, CI. **Pendiente:** clases y panel del docente, partidas realmente sin conexión, niveles de lectura ([lista completa](docs/PENDIENTES.md)).
- [x] **M2b · Narración y láminas (0.7):** narración de cada misión con fuentes, modo aula, 20 láminas descargables como recompensa, 10 logros nuevos, animaciones de disparo mejoradas con ajustes, respaldo SVG de Tierra sin tanques, contenido validado y corregido contra fuentes. **Pendiente:** revisión de una persona de historia ([guía](docs/VERIFICACION-HISTORICA.md)), probar Prisma y Docker en tu equipo, revisar Firefox/Safari/celular real y calibrar estrellas jugando.
- [ ] **M2 · Mejor experiencia:** historial de partidas en el perfil, página de perfil
  público, tema "carta náutica" afinado, sonidos mejorables, PWA (instalable en el celular).
- [ ] **M3 · Reglas nuevas:** barcos que no se tocan, salvas (varios disparos por turno), habilidades especiales
  (radar, bombardeo en cruz) y **modo de 3-4 jugadores** todos contra todos.
- [x] **M4 · IA y paralelismo:** IA Experta por Monte Carlo repartida entre hilos (memoria compartida vs mensajes),
  cola compartida, torneo en paralelo y benchmark con speedup/eficiencia/Karp-Flatt. Además: prioridades, cancelación,
  contrapresión, granularidad adaptativa, IA distribuida en nodos, análisis de partidas, prueba de carga y núcleo en C.
  **Pendiente:** medir en tu equipo y ajustar el número de hilos.
- [ ] **M5 · Comunidad:** chat de sala, matchmaking por Elo, torneos, amigos e invitaciones.
- [ ] **M6 · Escalado y calidad:** TypeScript, CI (GitHub Actions) que corra las pruebas, varias instancias con Redis
  (salas y difusión entre procesos) y sticky sessions, métricas (Prometheus/Grafana), cookie `HttpOnly`.

---

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `docker compose up` dice "Falta JWT_SECRET" o "Falta POSTGRES_PASSWORD" | No existe `.env`. Ejecuta `node scripts/init-env.mjs` |
| El backend sale con "JWT_SECRET debe definirse en producción" | Dejaste el valor de ejemplo (`cambia-esto…`) en `.env` |
| La página carga pero no conecta (“Sin conexión”) | El proxy no reenvía WebSocket. En nginx hacen falta las cabeceras `Upgrade`/`Connection` (ya están en `frontend/nginx.conf`) |
| `Error: @prisma/client did not initialize yet` | Falta `npx prisma generate` (en Docker se hace al construir la imagen) |
| `P1001: Can't reach database server` | La base no está arriba o `DATABASE_URL` apunta a otro puerto/clave |
| Con una clave de base de datos con símbolos (`@`, `/`, `#`) falla la conexión | Esos caracteres rompen la URL. Usa solo letras y números (`init-env.mjs` ya lo hace) |
| Desde el celular no entra a `localhost` | `localhost` es el propio celular. Usa la IP de tu PC en la red local, o un túnel |
| Wi-Fi de universidad/café: los equipos no se ven entre sí | Algunas redes aíslan a los clientes. Usa un túnel de Cloudflare o datos móviles |
| Quiero reiniciar los datos | `docker compose down -v` borra el volumen de la base de datos |

---

## Qué se reutilizó del Tres en Raya

* El principio de **servidor autoritativo** y el envío del **estado completo** tras cada cambio.
* **Salas con código de 4 letras** (sin 0/O/1/I), enlace de invitación `/?sala=ABCD`.
* **Reconexión con token**, latido (ping) cada 20 s y **tiempo por turno** controlado por el servidor.
* El **sistema de temas** (modo automático/claro/oscuro + 5 paletas), las fuentes y la estética de hoja cuadriculada.
* **Reacciones con emojis**, sonido y vibración, avatares.
* Las ideas de prueba: servidor real con clientes WebSocket reales, partidas completas, reconexión con y sin gracia.

Lo que cambió: monorepo con contenedores, módulos ES, validación con esquemas, cuentas y base de datos, IA, espectadores,
puntos, y un frontend dividido en módulos en vez de un solo `app.js`.

---

## Créditos y licencias

- **Código:** MIT.
- **Silkscreen** (interfaz pixel y leyendas de las láminas): © 2001 The Silkscreen Project Authors, SIL Open Font License 1.1.
- **Bricolage Grotesque** (© 2022 The Bricolage Grotesque Project Authors) y **Kalam** (© 2014 Indian Type Foundry): SIL Open Font License 1.1.
- Los textos completos de las tres licencias están en `frontend/public/fonts/LICENSE-*-OFL.txt`.
- **Arte (atlas y láminas):** generado por código con `tools/pixelart/`; sin retratos de personas reales.
- **Contenido histórico:** redactado a partir de las fuentes que se listan en cada misión (y en `docs/VERIFICACION-HISTORICA.md`); la mayor parte de las referencias en línea son enciclopedias y prensa, por eso conviene la revisión de una persona de historia.

Licencia: MIT.
