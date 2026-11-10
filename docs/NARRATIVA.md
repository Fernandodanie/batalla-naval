# Guía: narración, campañas, logros y láminas

Cómo añadir o cambiar contenido sin tocar el motor del juego. Después de cualquier cambio:

```bash
cd backend && npm run validate:content && npm test
```

## 1. Qué hay en cada misión

Una misión tiene dos partes:

- **Reglas** en `backend/src/domain/campaigns.js`: tablero, dificultad, objetivos de estrellas, `briefing` y `debrief`.
- **Historia** en `backend/src/content/<campaña>.js`, con el mismo número de misión:

```js
5: {
  date: '10 al 25 de mayo de 1934',            // se muestra junto al lugar durante la partida
  place: 'Cañada Strongest, Chaco Boreal',
  real: 'Resultado histórico: victoria boliviana. …',   // «qué pasó de verdad»
  won: true,                                    // ¿ganó en la historia el bando del jugador? (false ⇒ misión «reinterpretación»)
  commanders: {                                 // jefes de cada bando (obligatorio en misiones reales; NO se escribe en ficción)
    you: { name: 'Bernardino Bilbao Rioja', role: 'Jefe de las fuerzas bolivianas en Cañada Strongest' },
    foe: { name: 'José Félix Estigarribia', role: 'Comandante en jefe del ejército paraguayo' },
  },
  facts: ['…', '…'],                            // datos para «Contexto histórico» (mínimo 2 en misiones reales)
  sources: [{ title: '…', url: 'https://…' }],  // fuentes (mínimo 1 en misiones reales; los enlaces deben ser https)
  intro: ['párrafo 1', 'párrafo 2'],            // escenas de apertura: se leen una a una en modo aula
  events: { start, firstHit, firstSunk, firstLoss, half, last, win, lose },   // frases durante la partida
  quiz: [{ q, options: ['…','…','…'], answer: 1, why: '…' }],                 // preguntas del modo aula (mínimo 2)
}
```

**Jefes de cada bando (0.9).** En la sala y en la ficha de la misión el jugador ya no aparece con el nombre de su cuenta ni la IA como
«Almirante IA»: se muestran los jefes de la batalla (`commanders`). Reglas: **sin grados** (varían según la fuente y la fecha; el cargo va en `role`),
un nombre por bando (quien mandaba la fuerza en ESA batalla), y solo personas con fuente. En las campañas de **ficción** no se escriben: se inventan
al azar y de forma repetible por sala (`backend/src/content/oficiales.js`), se rotulan «ficción» y su cargo dice «(inventado)». `npm run validate:content`
rechaza una misión real sin jefes y una de ficción con jefes. Solo cambia lo que se MUESTRA: el historial y el progreso siguen usando la cuenta real.

Los ocho eventos se muestran **una sola vez** por partida cuando ocurren: `start` (empieza la batalla), `firstHit`, `firstSunk`
(primera unidad rival hundida), `firstLoss` (primera baja propia), `half` (mitad de la flota rival hundida), `last` (queda una
unidad rival), `win` y `lose`. La lógica está en `eventsReached()` de `frontend/public/js/narrator.js` y se prueba sin navegador.

**Misión «reinterpretación».** Si en la historia el bando del jugador perdió (`won: false`), la misión debe llevar
`fictionalTwist: true` en `campaigns.js`: la ficha muestra la etiqueta «reinterpretación» y el texto del resultado dice qué pasó
realmente. El validador falla si ambas cosas no coinciden.

**Criterios de redacción:** frases cortas; nombrar a ambos ejércitos sin adjetivos hacia el rival; decir siempre qué pasó de verdad;
sin cifras salvo que haya fuente; sin retratos ni diálogos inventados de personas reales. En campañas de ficción, `real` empieza con
«Ficción:», sin fuentes ni preguntas.

## 2. Añadir una campaña nueva

1. En `domain/campaigns.js`, agrega la campaña a `CAMPAIGNS` con `mission(id, título, tamaño, dificultad, briefing, debrief, extras)`.
2. Crea `content/<id>.js` con la historia de cada misión y regístrala en `content/index.js` (`STORIES`).
3. Agrega una lámina por misión en `domain/laminas.js` y dibújala (sección 4).
4. Agrega logros históricos en `domain/achievements.js` (sección 3).
5. `npm run validate:content`: dice qué falta.

## 2b. Preguntas, glosario y material para el aula

- **Preguntas** (`quiz` en cada historia): `{ q, options[], answer, why }`. `answer` y `why` **nunca viajan al navegador**: `publicStory` los quita y el servidor
  (`domain/quiz.js`, `POST /api/quiz`) corrige y devuelve la explicación después de contestar. Con cuenta se guarda el mejor resultado.
- **Glosario** (`content/glosario.js`): `{ term, def, forms[] }`. Cada misión muestra solo los términos que aparecen en sus textos (sin distinguir tildes ni
  plurales). `npm run validate:content` falla si un término no se usa en ninguna misión o su definición es muy corta. «reinterpretación» se agrega solo en las misiones marcadas así.
- **Guía didáctica y hoja de trabajo:** salen de los mismos datos (`frontend/public/js/guide.js`); si agregas campos nuevos a la historia, agrégalos ahí también.

## 3. Logros

En `domain/achievements.js`. Un logro histórico se declara así y se desbloquea al ganar esas misiones:

```js
{ id: 'hist_strongest', category: 'histórico', icon: '🌵', name: 'Cañada Strongest', text: '…', campaign: 'chaco', missions: [5] },
```

Si **cambias el id** de un logro que ya existe, anótalo en `RENAMED` (id antiguo → nuevo) y agrega una migración SQL que mueva los
desbloqueos guardados (ejemplo: `prisma/migrations/2_logro_villamontes`). `progress.overview` ya traduce los ids antiguos.

## 4. Láminas (recompensas)

- Catálogo en `domain/laminas.js`: una por misión (`<campaña>-<misión>`). Se ganan con 1+ estrellas y siempre es la misma lámina (ya no hay versión base y dorada).
- Cada lámina es una tarjeta terminada (arte + marco dorado + título + leyenda + estrellas, 1394×1128). Para una lámina nueva, guarda su PNG como
  `frontend/public/img/laminas-hd/<id>.png` y su miniatura de 480 px como `frontend/public/img/laminas-hd/min/<id>.webp`; `npm run validate:content` comprueba que existan.
- En el cliente (`frontend/public/js/laminas.js`) se muestran tal cual, se descargan en PNG (horizontal = el archivo original; cuadrada y vertical = la tarjeta sobre fondo liso) y, en
  celulares, se comparten con el menú del sistema.
- Sin retratos de personas reales; en escenas anteriores a 1851 usa banderines neutros (la bandera actual de Bolivia es de 1851).

## 4a. Música (0.9)

Una pista a la vez, con fundido (`frontend/public/js/music.js`): **entrada** = «tambores de guerra» (fuerte) · **inicio y campañas** = `ambiente-puerto.mp3`
(suave) · **partida** = `ambiente-batalla.mp3` (más suave todavía). Los volúmenes base están en `TRACKS`; cada persona los ajusta en Ajustes
(«Música de fondo» y «Volumen de la música»). La música baja sola mientras se lee la narración en voz alta. Las tres pistas se componen por código
(`tools/make_war_drums.py`, `tools/make_ambient.py`): sin muestras de terceros. Para regenerar el ambiente: `python3 tools/make_ambient.py frontend/public/audio`
(después borra los `*.check.wav` que deja al lado).

## 4b. Ajustes del jugador (0.8)

En «Ajustes» (se guardan en el navegador, `frontend/public/js/settings.js`): animaciones completas / ligeras / sin; sacudida del
tablero; narración durante las misiones; **lectura en voz alta**; **modo aula** (lectura guiada por escenas antes de la misión y preguntas de comprensión al ganar); **música de fondo** y su volumen (0.9).
Ninguno cambia las reglas ni se envía al servidor. Además se respeta `prefers-reduced-motion` del sistema.
