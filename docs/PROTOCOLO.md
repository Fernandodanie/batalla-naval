# Protocolo WebSocket

Ruta: `/ws`. Mensajes JSON de texto, uno por frame. El servidor valida cada mensaje con un esquema
(`backend/src/realtime/protocol.js`); cualquier cosa fuera del esquema recibe `{ "t": "error", "code": "formato" }`.
Límites: 4 KB por mensaje y 20 mensajes por segundo por conexión (`WS_MSGS_PER_SEC`).

Principio de diseño (heredado del Tres en Raya): **el servidor es la única fuente de verdad**. El cliente pide
acciones y dibuja el estado que recibe. Tras cada cambio el servidor envía el estado completo, así un cliente que
se reconecta se pone al día con un solo mensaje.

## Cliente → servidor

| Mensaje | Cuándo | Significado |
|---|---|---|
| `{"t":"hello","auth":"<jwt>","session":"<id>"}` | Primero, siempre | `auth` es opcional (cuenta). `session` es opcional: si el servidor la reconoce, te devuelve a tu asiento |
| `{"t":"create","mode":"pvp"\|"ai","size":10,"biome":"water"\|"pirate"\|"land"\|"jungle","difficulty":"normal","hitKeepsTurn":false,"isPublic":true,"name":"Ana","avatar":"🦈"}` | Fuera de sala | Crea una sala y te sienta como jugador A. Con `mode:"ai"` el rival es la IA y la sala nunca es pública |
| `{"t":"join","room":"ABCD","name":"Beto","avatar":"🐙"}` | Fuera de sala | Entra como jugador B; empieza la colocación |
| `{"t":"spectate","room":"ABCD","name":"Curioso"}` | Fuera de sala | Entra a mirar (máx. `MAX_SPECTATORS`) |
| `{"t":"randomize"}` | Colocación | Pide una flota al azar. **No se guarda**: llega como `fleet` y tú decides si la usas |
| `{"t":"ready","ships":[{"id":"5-0","row":0,"col":0,"horizontal":true}, …]}` | Colocación | Envía la flota completa y queda listo. El servidor la valida |
| `{"t":"fire","row":3,"col":4}` | Batalla, tu turno | Dispara a esa casilla del rival |
| `{"t":"rematch"}` | Partida terminada | Vota revancha (alterna quién abre) |
| `{"t":"react","e":"🔥"}` | En sala | Reacción visible para todos |
| `{"t":"leave"}` | En sala | Sales. Abandonar una partida en curso cuenta como derrota |
| `{"t":"ping","ts":123}` | Siempre | Mide la latencia |

`size` ∈ {8, 10, 12, 15, 20}. `biome` (opcional, por defecto `water`) ∈ {`water`, `pirate`, `land`, `jungle`}: cambia el terreno, los nombres y los dibujos de las unidades, **no** las reglas ni la flota (mismos ids y largos en todos los escenarios). `row` y `col` empiezan en 0.

## Servidor → cliente

| Mensaje | Significado |
|---|---|
| `{"t":"welcome","session":"…","resumed":false,"user":null\|{…}}` | Respuesta a `hello`. Guarda `session` (el cliente web la guarda en `sessionStorage`) |
| `{"t":"state", …}` | Foto completa de la sala (ver abajo) |
| `{"t":"fleet","ships":[…]}` | Respuesta a `randomize` (solo para quien lo pidió) |
| `{"t":"react","e":"🔥","from":"A"\|"B"\|"spectator"}` | Reacción de alguien |
| `{"t":"left","reason"?:"sala_cerrada"}` | Saliste (o la sala se cerró) |
| `{"t":"error","code":"…"}` | Solicitud rechazada |
| `{"t":"pong","ts":123}` | Respuesta al ping |

## Forma de `state`

```jsonc
{
  "t": "state",
  "room": "K7QX",
  "you": "A",                       // "A" | "B" | "spectator"
  "mode": "pvp",                    // "pvp" | "ai"
  "difficulty": "normal",           // easy | normal | hard | expert
  "isPublic": true,
  "status": "battle",               // waiting | placing | battle | over
  "size": 10,
  "biome": "water",
  "hitKeepsTurn": false,
  "turnMs": 30000,
  "timeLeft": 12840,                // ms que le quedan a la colocación o al turno actual (null si no hay límite)
  "round": 1,
  "wins": { "A": 0, "B": 0 },       // marcador de la sala
  "rematch": { "A": false, "B": false },
  "spectators": 2,
  "players": {
    "A": { "name": "Ana", "avatar": "🦈", "isAi": false, "registered": true, "rating": 1016,
           "online": true, "left": false, "ready": true },
    "B": { … }
  },
  "game": {                         // null mientras status = waiting
    "size": 10, "status": "battle", "turn": "A", "winner": null, "reason": null,
    "ready": { "A": true, "B": true },
    "stats": { "A": { "shots": 12, "hits": 5 }, "B": { … } },
    "lastShot": { "by": "B", "row": 3, "col": 4, "result": "hit", "ship": null },
    "boards": {
      "A": {
        "shots": [0,0,1,2,3, …],    // size*size valores: 0 sin disparar, 1 agua, 2 tocado, 3 hundido
        "ships": [{ "id":"5-0","length":5,"name":"Portaaviones","cells":[0,1,2,3,4],"sunk":false }],
        "fleet": [{ "id":"5-0","length":5,"name":"Portaaviones","sunk":false }, …]
      },
      "B": { "shots": [...], "ships": null, "fleet": [...] }
    }
  },
  "result": null,                   // al terminar: { ranked, points:{A,B}, ratingDelta:{A,B}, after:{A,B} }
  "closedReason": null              // "rival_salio" cuando el rival se fue para siempre
}
```

* `boards.X.sunk` lista las unidades ya destruidas de X (`{id,length,name,cells,sunk:true}`): son públicas, así que llegan aunque `boards.X.ships` sea `null`.
* `boards.X.shots` son los disparos **recibidos** por el tablero de X. Índice = `fila * size + columna`.
* `boards.X.ships` solo viene para el dueño del tablero, o para todos cuando la partida terminó. Un rival o un
  espectador nunca recibe las posiciones de barcos que siguen ocultos (hay una prueba que lo verifica).
* `fleet` es público: dice qué barcos siguen a flote, sin revelar dónde están.
* `result.after` se completa unos milisegundos después de `over`, cuando la base de datos confirma el guardado.

## Códigos de error

`sin_sesion`, `formato`, `comando_desconocido`, `demasiados_mensajes`, `error_interno`,
`ya_en_sala`, `sin_sala`, `sala_no_existe`, `sala_llena`, `sala_cerrada`, `servidor_lleno`, `tamano_invalido`,
`ya_estas_en_la_sala`, `no_eres_jugador`,
`partida_no_iniciada`, `partida_ya_empezo`, `ya_estas_listo`,
`barco_desconocido`, `barco_repetido`, `fuera_de_rango`, `barcos_superpuestos`, `flota_incompleta`,
`no_es_tu_turno`, `ya_disparaste_ahi`, `sin_casillas`.

## Reconexión

1. El cliente guarda `session` al recibir `welcome`.
2. Si el socket se cae, el servidor marca al jugador "sin conexión" y le guarda el asiento `GRACE_SECONDS` (45 s).
3. El cliente reconecta con backoff (0,4 s → 5 s) y envía `hello` con su `session`.
4. Si el servidor la reconoce: `welcome` con `resumed:true` y un `state` completo. Si no: `resumed:false` y el cliente vuelve al inicio.
5. Pasado el tiempo de gracia, el jugador pierde por abandono.

## Tiempos

* **Colocación** (`PLACEMENT_SECONDS`, 90 s): al vencer, el servidor coloca al azar la flota de quien no estuvo listo.
* **Turno** (`TURN_SECONDS`, 30 s): al vencer, el servidor dispara por ti a una casilla al azar. Tres disparos
  automáticos seguidos hacen perder la partida por `tiempo` (evita bloquear salas dejando el turno correr).
* `0` desactiva el límite.

---

## Novedades de la versión 0.6 (campañas, logros y cupo de invitados)

### Cliente → servidor

`{ "t": "mission", "campaign": "chaco", "mission": 1, "name"?, "avatar"? }` — crea una sala privada contra la IA con la configuración fija de esa misión
(escenario, tablero, dificultad, sin «acertar da otro disparo»). La creadora es el lado `A`.

Reglas del servidor:

- Invitado: solo `mission: 1` de cada campaña (de prueba); las demás → `requiere_cuenta`. No se guarda progreso, pero `result.mission` trae las estrellas.
- Cuenta: la misión `n > 1` exige haber ganado la `n − 1` de esa campaña → si no, `mision_bloqueada`.
- Campaña o misión inexistente → `mision_no_existe`. Un invitado sin cupo diario → `limite_invitado`.

### Errores nuevos

| Código | Cuándo |
|---|---|
| `limite_invitado` | Un invitado agotó sus partidas diarias contra la IA (`GUEST_AI_DAILY`). Se aplica al crear una sala contra la IA, al iniciar una misión y a la revancha contra la IA. No afecta a las salas con personas ni a las cuentas |
| `requiere_cuenta` | Un invitado intentó una misión que no es la primera de su campaña |
| `mision_bloqueada` | Falta ganar la misión anterior |
| `mision_no_existe` | Campaña o misión desconocida |

### Campos nuevos en `state`

- `mission` (o `null`): `{ campaignId, campaignTitle, fiction, missionId, title, total, next, objectives: [{ id, label }] }`. `next` es el número de la siguiente misión o `null` si es la última.
- `game.boards.X.ships[]` y `game.boards.X.sunk[]`: cada unidad lleva ahora `hits` (casillas tocadas) y `state`: `normal` | `damaged` (tocada) | `smoking` (la mitad o más de sus casillas tocadas) | `sunk`. Solo se envían las unidades que el jugador puede ver (las propias, y las rivales ya hundidas o al terminar).
- `result.mission` (solo en partidas de misión): `{ campaignId, missionId, won, stars, objectives: [{ id, label, met }], saved, improved, previousStars, bestShots }`. Se calcula al terminar la partida; `saved`, `improved`, `previousStars` y `bestShots` se completan en el siguiente `state` (después de guardar en la base de datos).
- `result.newAchievements`: `{ A: [...], B: [...] }`, logros desbloqueados con esa partida (`{ id, category, icon, name, text }`); también llegan en el `state` posterior al guardado.

### REST nuevo

| Ruta | Respuesta |
|---|---|
| `GET /api/campaigns` | `{ campaigns: [{ id, title, subtitle, biome, fiction, icon, intro, note, missions: [{ id, title, size, difficulty, briefing, debrief, objectives: [{ id, label }] }] }], achievements: [{ id, category, icon, name, text }] }` |
| `GET /api/progress` (sesión) | `{ missions: [{ campaignId, missionId, stars, bestShots, date }], achievements: [{ id, date }], totalStars, totalAchievements }` |
| `GET /api/quota` | `{ limit, left }` — `left` es `null` si no hay límite |

La IP del cupo es la del socket o, detrás de nginx, la última dirección de `X-Forwarded-For`. Si expones el backend directamente a internet, un cliente podría falsear esa cabecera: pon siempre el proxy delante.

## Novedades de la versión 0.8 (preguntas en el servidor)

- `POST /api/quiz` · cuerpo `{ campaignId, missionId, answers: number[] }` · sesión **opcional** (`Authorization: Bearer …`).
  Respuesta: `{ correct, total, perfect, details:[{ok, chosen, right, why}], saved, best?, attempts?, newAchievements[] }`. Errores 400: `datos_invalidos`,
  `sin_preguntas` (misión sin preguntas, p. ej. de ficción), `respuestas_invalidas`. Límite por IP: `QUIZ_PER_MINUTE`.
- `GET /api/campaigns`: las preguntas de `story.quiz` traen solo `{ q, options }` (sin `answer` ni `why`); `story.glossary` trae `[{ term, def }]`.
- `GET /api/progress`: además `quiz: [{ campaignId, missionId, best, total, attempts }]` y `rank: { id, name, icon, min, next: { name, min, missing } | null }`.

## Novedades de la versión 0.7 (narración y láminas)

No hay mensajes WebSocket nuevos. Cambia el REST:

- `GET /api/campaigns` → `{ campaigns, achievements, laminas }`. Cada misión trae ahora `twist` (booleano: reinterpretación de un hecho real) y `story`
  `{ date, place, real, facts[], sources[{title,url?}], intro[], events{start,firstHit,firstSunk,firstLoss,half,last,win,lose}, quiz[{q,options[],answer,why}] }`.
  `laminas` es el catálogo `{ id, campaignId, missionId, title, caption, fiction }`. Todo es público (las preguntas llevan la respuesta: se corrigen en el cliente).
- `GET /api/progress` (con sesión) → además `laminas: [{ id }]` (una por misión ganada, derivada de las estrellas; desde 0.9.1 ya no hay `tier`) y los logros con ids actuales.
- El logro `hist_corralito` ahora es `hist_villamontes` (ver `RENAMED` en `domain/achievements.js` y la migración `2_logro_villamontes`).

