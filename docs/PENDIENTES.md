# Batalla Naval — Pendientes y nuevas ideas (desde la v0.9.0)

**Documento vivo.** Se actualiza en cada entrega: lo hecho se marca `[x]`, lo pendiente `[ ]`, y lo nuevo se agrega al final de su sección.
**Tamaños:** **S** (horas) · **M** (un par de días) · **L** (una semana o más). **Historias:** formato Como/Quiero/Para con puntos (Fibonacci) en la sección 10.
**Convención de estado:** ✅ hecho y probado · 🟡 hecho pero **sin poder probarlo** en el entorno de desarrollo · ⬜ pendiente · 🔒 depende de una decisión tuya.

---

## 0. Dónde estamos

| Versión | Qué trajo |
|---|---|
| 0.6 | Campañas con estrellas, cuentas con progreso, logros, pixel art animado, disparos animados, cupo de invitados |
| 0.7 | Narración por misión con fuentes, contenido histórico corregido, modo aula, 20 láminas descargables, 32 logros, ajustes de animación |
| 0.8 | **Preguntas corregidas en el servidor** (y resultados por cuenta), **glosario**, **guías y hojas de trabajo**, **voz**, **rangos**, láminas en **3 formatos + ZIP**, **proyectil por escenario**, **app instalable con interfaz sin conexión**, **CI**, 36 logros, exportador de revisión histórica |

| 0.8.x | Video de fondo en la entrada, música de entrada («tambores de guerra»), fondos por escenario, entrada por correo |
| **0.9** | **Música en todo el juego** (fuerte solo en la entrada; suave en inicio y campañas; más suave en partida), ajustes de música, la música baja con la voz, **jefes reales / nombres inventados** en lugar de «Almirante IA» y del nombre de la cuenta |

**Pruebas al entregar la 0.9:** backend 178 (166 pasan, 12 omitidas de Prisma) · frontend 99 · `tools/e2e/musica_y_jefes.py` en Chromium real (22 comprobaciones). **No pude escuchar la música**: solo medirla (ver 1.13).

---

## 1. Pendiente de entrega (necesita tu equipo o a otra persona)

| # | Estado | Ítem | Tamaño | Detalle |
|---|:---:|------|:---:|---------|
| 1.1 | ⬜ | **Revisión del contenido histórico por una persona de historia** | M | **Nuevo: `cd backend && npm run export:review`** genera un solo documento con todos los textos, datos, preguntas (con respuesta), fuentes y casillas «Aprobado / Corregir» por misión. Entrégaselo a quien revise. Al terminar, quitar el aviso «pendiente de revisión» (`#brief` en `campaigns.js`, pie de `#story-dialog`, guía y hoja en `guide.js`) |
| 1.2 | ⬜ | **Comprobar los enlaces de fuentes** | S | `npm run check:links` (con internet). Desde mi entorno no se pudo; los enlaces salen de búsquedas reales, pero en una primera versión escribí algunos de memoria y no eran verificables: no te fíes sin correrlo. El CI lo hace cada lunes (`enlaces.yml`) |
| 1.3 | 🟡 | **Migraciones `2_logro_villamontes` y `3_resultados_preguntas` en PostgreSQL real** | S | SQL nuevo, nunca ejecutado. **El CI de GitHub (`ci.yml`, job `prisma`) las aplica en un PostgreSQL 16 y corre el contrato del almacén.** Sube el proyecto a GitHub y revisa que el job quede en verde; si falla, el mensaje dirá qué línea |
| 1.4 | 🟡 | **Prisma contra PostgreSQL** (incluye `QuizResult`, `saveQuizResult`, `getQuizResults`) | S | Mismo job de CI, o a mano: README → «Probar el almacén Prisma». Hay una prueba de contrato nueva para los resultados del cuestionario |
| 1.5 | ⬜ | **Probar `docker compose up --build`** | S | Nunca se construyó. Revisar que los PNG nuevos, `sw.js` y `manifest.webmanifest` lleguen a la imagen de nginx |
| 1.6 | 🟡 | **Probar las reglas nuevas de `nginx.conf`** (`/sw.js` y `/manifest.webmanifest` sin caché y con su tipo) | S | No hay nginx en mi entorno. Sin esto, un `sw.js` cacheado por nginx retrasa las actualizaciones. Comprobar con `curl -I https://TU_SITIO/sw.js` → `Cache-Control: no-cache` |
| 1.7 | ⬜ | **Revisar en Firefox, Safari y un celular real** | S–M | Solo Chromium de escritorio. Mirar: tablero 20×20, galería, **visor y formatos de lámina**, descarga de PNG/ZIP en iOS, **botón Compartir**, **instalar la app** (en iPhone es «Añadir a pantalla de inicio»), **voz** (hay dispositivos sin voz en español) |
| 1.8 | ⬜ | **Calibrar las estrellas jugando** | M | Los topes siguen siendo estimaciones. Con las estadísticas globales (9.4) sería con datos |
| 1.9 | 🔒 | **Qué pasa con «Operación Litoral»** | S | Sigue siendo ficción total. Ver 5.1 |
| 1.10 | ⬜ | **Revisar nombres de logros históricos y del glosario** | S | Que sean apropiados, sobre todo los de derrotas reinterpretadas (Calama, Alianza) |
| 1.11 | ⬜ | **Calibrar el cupo de invitados y los límites por IP** | S | `GUEST_AI_DAILY`, y ahora `AUTH_PER_MINUTE` / `QUIZ_PER_MINUTE`. En un colegio, todo el curso comparte IP |
| 1.12 | ⬜ | **Probar la narración con un lector de pantalla** (NVDA/TalkBack/VoiceOver) | S | El arreglo está hecho (frase completa anunciada una vez, texto visible `aria-hidden`), pero no lo probé con uno real |
| 1.13 | 🟡 | **Escuchar las dos pistas nuevas y ajustar volúmenes** | S | `ambiente-puerto.mp3` y `ambiente-batalla.mp3` se midieron (nivel, picos, costura del bucle, equilibrio de frecuencias, sin saturación) pero **nadie las escuchó**. Prueba en parlantes de portátil y de celular: si suenan muy bajas o muy altas, cambia `gain` en `TRACKS` (`js/music.js`) o regenera con `tools/make_ambient.py`. Comprobar también que el bucle no se note |
| 1.14 | ⬜ | **Revisar los jefes de cada batalla (`commanders`)** | S | Verificados en búsquedas (Wikipedia y prensa), pero con dos dudas: **Calama** (se usa Eleuterio Ramírez, jefe de la columna chilena según Wikipedia; otras fuentes citan a Emilio Sotomayor) y **Campo Vía** (Carlos Banzer, jefe de la 9.ª División, según Wikipedia). Alihuatá: Victorino Gutiérrez. Sin grados a propósito. `npm run export:review` ahora trae casilla «Jefes» por misión |
| 1.15 | ⬜ | **Probar la música en Firefox, Safari y celular real** | S | Solo Chromium. Safari/iOS es el más estricto con el audio: comprobar que arranca con el primer toque y que el bucle no hace clic (los mp3 tienen un pequeño relleno del codificador) |

---

## 2. Riesgos y cosas sin probar (honestidad sobre la 0.9)

- **Música (0.9):** (a) **sin escuchar**, solo medida (1.13). (b) **Memoria:** cada pista decodificada ocupa ~15–23 MB; las dos de ambiente se conservan (~45 MB) y la de la entrada se suelta al salir de ella. En celulares muy modestos conviene vigilar; si pasa, acortar las pistas o soltar la que no suena. (c) **Descarga:** ~2,1 MB de audio en total, cada pista se pide la primera vez que se usa (el service worker las guarda). (d) El mp3 puede dejar un clic mínimo al repetir el bucle en algunos navegadores (1.15). (e) El volumen base está pensado para quedar bajo los efectos; con parlantes muy potentes puede oírse más de lo previsto: para eso existe el control.
- **Jefes (0.9):** los nombres reales salen de búsquedas, no de bibliografía académica; hasta que los revise alguien de historia (1.14) conviene mantener el aviso «pendiente de revisión». Los nombres inventados son listas cortas: pueden coincidir por azar con alguien real.

- **Lo que ejecuté y lo que no.** Probado: backend, frontend, extremo a extremo en Chromium (incluye modo sin conexión), ZIP con `unzip` y Python. **No ejecutado**: Prisma/migraciones 2 y 3, nginx, Docker, CI de GitHub (los YAML se validaron como YAML, pero nunca corrieron), enlaces de fuentes con internet, otros navegadores.
- **PWA — límites que conviene saber.** Sin conexión **no se puede jugar**; solo ver interfaz, campañas, guías y láminas ya vistas. El **progreso de la cuenta no se guarda sin conexión a propósito** (en un computador compartido mostraría el de otra persona), así que la galería sin conexión muestra todo bloqueado. La **primera visita** siempre necesita internet (el service worker se instala después de cargar).
- **Al cambiar archivos del frontend hay que subir `VERSION` en `sw.js`** (si no, los usuarios siguen viendo la copia vieja un rato). La prueba `sw.test.js` falla si agregas un archivo y olvidas listarlo en `SHELL`, pero **no** si olvidas subir `VERSION`.
- **Los cuestionarios se pueden repetir sin límite.** Se guarda el mejor resultado, así que quien repita hasta acertar queda con nota perfecta. Está bien para estudiar; **no** para un examen (ver 4.12).
- **La guía didáctica no trae las respuestas** (a propósito, para no filtrarlas). El docente las ve al contestar en el juego o en el documento de `export:review`.
- **La voz depende del dispositivo.** Algunos no traen voz en español; el ajuste se desactiva si el navegador no tiene síntesis de voz, pero si hay síntesis sin voz en español usará la del sistema.
- **Datos a medias o sin verificar:** Ayacucho aún tiene pocos datos; la **patente de corso de 1879** sigue sin verificar (el texto solo menciona el año); las banderas anteriores a 1851 son banderines neutros (confirmar criterio). Los enlaces de fuentes son sobre todo enciclopedias y prensa; falta bibliografía académica.
- **Alguna lámina dorada podría pasar a base** si algún día cambias la calibración de estrellas (decisión en la sección 11).
- **El test de misión del frontend era intermitente** (~30 %) porque su bot disparaba casilla por casilla y la IA a veces ganaba; ya ataca alrededor de cada acierto (16 de 16). Si vuelve a fallar con «timeout», revisa si cambió la IA o los topes.
- **`tools/e2e/mision.py` no está en CI** (depende de Playwright para Python y de los IDs del HTML).
- **Accesibilidad del pixel art** sigue pendiente en parte: las casillas tienen `aria-label`, pero el estado de las unidades solo se anuncia por el banner.

---

## 3. Hecho en la 0.8 (referencia)

- [x] ✅ **Las respuestas ya no viajan al navegador** y se corrigen en el servidor; resultado guardado por cuenta; logros de estudio (era 4.1)
- [x] ✅ **Glosario** por misión (4.7) · **guía didáctica .md** (4.4) · **hoja de trabajo imprimible** (4.5) · **lectura en voz alta** (4.9)
- [x] ✅ **Accesibilidad de la narración** (anuncio único; falta prueba con lector real → 1.12)
- [x] ✅ **Rangos** Recluta → Mariscal · **«Álbum dorado»** · láminas en **horizontal / cuadrada / vertical 9:16** · **ZIP** de láminas
- [x] ✅ **Proyectil propio por escenario** (cometa, pirata, mortero, trazadora)
- [x] ✅ **App instalable** + interfaz sin conexión + catálogo desde la copia guardada (el arranque ya no depende de la configuración del servidor)
- [x] 🟡 **CI** en GitHub Actions (pruebas, contenido, Prisma con PostgreSQL, enlaces semanales) — sin haberse ejecutado todavía
- [x] ✅ **Uso en clase:** límites por IP configurables y sección del README
- [x] ✅ **Exportador de revisión histórica** (`export:review`) · validador del glosario · prueba de que ningún texto diga «null/undefined»
- [x] ✅ Contenido: Ayacucho (Sucre «Gran Mariscal de Ayacucho») y fuentes reemplazadas por enlaces verificados en búsqueda
- [x] ✅ Respaldo SVG de «Tierra» sin tanques · barcos translúcidos de «La flota fantasma» corregidos

---

## 3b. Hecho en la 0.9 (referencia)

- [x] ✅ **Música en todo el proyecto**, fuerte solo en la entrada; ambiente suave en inicio/campañas y más suave en partida, con fundidos (`js/music.js`)
- [x] 🟡 Dos pistas nuevas de ambiente compuestas por código (`tools/make_ambient.py`) — medidas, sin escuchar (1.13)
- [x] ✅ Ajustes «Música de fondo» y «Volumen de la música»; la música baja sola mientras se lee la narración en voz alta
- [x] ✅ **Jefes en las misiones:** reales en las históricas (11 misiones), inventados y rotulados «ficción» en las de ficción; «Al mando» en la ficha; sin «Almirante IA» ni nombre de cuenta
- [x] ✅ `export:review` y `validate:content` conocen los jefes · prueba de punta a punta nueva (`tools/e2e/musica_y_jefes.py`)

---

## 4. Educación y modo aula (lo que más valor da a tu proyecto)

| # | Estado | Idea | Tamaño | Por qué |
|---|:---:|------|:---:|---------|
| 4.1 | ✅ | Guardar resultados de las preguntas por cuenta y corregir en el servidor | M | Hecho |
| 4.2 | 🔒 | **Clases y panel del docente:** el docente crea una «clase» con código; los estudiantes se unen con su cuenta; ve estrellas, láminas y aciertos por estudiante; exportar CSV | L | El mayor valor para un curso. **Necesita tu decisión** sobre guardar datos de estudiantes (sección 11). Diseño sugerido: modelos `Class` y `ClassMember`; se une quien pone el código (consentimiento explícito); el docente solo ve lo que el estudiante generó en el juego; sin correo ni nombre real (apodos); poder salir de la clase y borrar la cuenta |
| 4.3 | ⬜ | **Pausa en la batalla (opcional en modo aula):** al ocurrir un hito, mostrar la escena y pedir «Continuar» | S–M | Para leer en grupo. Cuidado con el cronómetro de turno: hay que pausarlo también |
| 4.4 | ✅ | Guía didáctica exportable | M | Hecho (sin respuestas, a propósito) |
| 4.5 | 🟡 | Hojas de trabajo imprimibles | M | Hecha la hoja HTML; **faltan** una línea de tiempo con fechas para completar y una sopa de letras/crucigrama con el glosario (S–M) |
| 4.6 | ⬜ | **Línea de tiempo y mapa de campaña** (mapa de Bolivia y la región con las batallas; al ganar, se «enciende» el lugar) | M–L | Contexto espacial; reemplaza la lista de misiones |
| 4.7 | ✅ | Glosario | S–M | Hecho. Falta mostrarlo **dentro** del texto (tocar la palabra) y no solo en «Contexto» |
| 4.8 | ⬜ | **Dos niveles de lectura** (básico / avanzado) para la misma narración | M | Primaria y secundaria. Implica redactar y revisar el doble de texto |
| 4.9 | ✅ | Voz | S | Hecho. Pendiente: velocidad ajustable y resaltar la frase que se lee |
| 4.10 | ⬜ | **«Modo fiel a la historia»:** en las misiones de derrota reinterpretadas, un objetivo alternativo que respete lo ocurrido (p. ej. «resiste N turnos» en Boquerón) | M | Enseña lo que de verdad ocurrió sin dejar de ser un juego. Necesita objetivos nuevos (6.1) |
| 4.11 | 🟡 | **Modo clase en red local** | S–M | Documentado en el README («Uso en clase»). Falta: un script que levante el servidor y muestre la dirección y un código QR para que los estudiantes entren |
| 4.12 | ⬜ | **Modo examen:** intentos limitados, preguntas en orden aleatorio, sin ver la explicación hasta cerrar, banco de preguntas más grande que lo que se muestra | M | Hoy se puede repetir sin límite. Con 4.2 el docente fija las reglas por clase |
| 4.13 | ⬜ | **Estadísticas de aprendizaje** (qué preguntas se fallan más; anónimas) | S–M | Ayuda al docente y a mejorar el texto. Requiere guardar cada intento (hoy solo el mejor) |
| 4.14 | ⬜ | **Documento de revisión más amigable** (Word/PDF con casillas) | S–M | `export:review` hoy produce Markdown; un historiador quizá prefiera Word/PDF |
| 4.15 | ⬜ | **Repasar las preguntas de una misión ya ganada** sin volver a jugarla | S | Hoy las preguntas solo aparecen al ganar |

---

## 5. Campañas y contenido

- [ ] **5.1 Reemplazar «Operación Litoral» por una campaña real** (S de estructura + M de redacción y verificación). Candidatas, siempre con ≥2 fuentes de bandos distintos antes de redactar: **Guerra del Acre (1899–1903)**, **Armada Boliviana** (Titicaca y ríos), **Guerra Federal (1898–1899)**, **Guerra de la Confederación (1836–1839)**, **Túpac Katari y el cerco de La Paz (1781)**, **Revolución de 1952**. La guía `docs/NARRATIVA.md` y `npm run validate:content` ya cubren el proceso.
- [ ] **Más datos en Ayacucho y en las campañas del siglo XIX** (hoy tienen menos contexto que el Chaco) — S–M.
- [ ] **Fuentes de los dos bandos:** para cada batalla, al menos una fuente del país rival o neutral, y mostrarlo en «Datos y fuentes» — S.
- [ ] **Dificultad por campaña** (recluta / oficial / mariscal; combina con los rangos) — S–M.
- [ ] **Misiones con reglas propias** (sección 6) para que no todo sea «hunde todo» con un tablero más grande.
- [ ] **Localización** (guaraní para el Chaco, quechua/aymara para las campañas andinas, inglés): separar los textos a archivos por idioma — M. Valioso para colegios; revisar con hablantes.
- [ ] **Retratos y escenas con más detalle** hechos por un dibujante — M–L.
- [ ] **Jefes con retrato y breve biografía** (al tocar el nombre en la sala): hoy solo nombre y cargo — S–M. Con **fuentes de ambos bandos** para cada persona.
- [ ] **Jefes por escena** (que la narración nombre al jefe: «Marzana ordena…») — S.
- [ ] **Verificar la patente de corso de 1879** o dejar la campaña claramente fuera de la historia — S.

---

## 6. Jugabilidad y reglas

| # | Idea | Tamaño | Comentario |
|---|------|:---:|-----------|
| 6.1 | **Objetivos de misión distintos** (proteger una unidad, límite de turnos, hundir una unidad concreta, obstáculos/islas) | L | **Prioridad alta:** variedad real; habilita el «modo fiel» (4.10) |
| 6.2 | **Habilidades especiales** (radar, bombardeo en cruz, reparación) con enfriamiento | L | Opcional por misión |
| 6.3 | **Niebla de guerra / reconocimiento** | L | Muy temático para selva y tierra |
| 6.4 | **Modo desafío diario** | M | Reutiliza el motor de misiones; fomenta volver |
| 6.5 | **Repetición de partidas** (ya se guarda el historial) | M | También para clase: «revisemos esta batalla paso a paso» |
| 6.6 | **Salvas**, **barcos que no se tocan**, **3–4 jugadores** | M / M / L | Hoja de ruta anterior |
| 6.7 | **Clima y terreno con efecto** | L | Solo si hay mecánicas que lo justifiquen |

---

## 7. Logros, recompensas y progresión

- [x] ✅ Rangos (Recluta → Mariscal) y «Álbum dorado» · [x] ✅ ZIP y formatos para redes
- [ ] **Rango visible en la sala** y en el perfil (hoy solo en «Campañas») — S.
- [ ] **Vista de álbum por campaña** (páginas con las láminas y sus huecos; hoy es una lista) — S–M.
- [ ] **Recompensas cosméticas** (avatares, marcos de perfil, apodos, skins de unidades) conectadas a láminas y logros — M. Las láminas ya son la primera recompensa.
- [ ] **Perfil público** con estadísticas, logros, láminas y campañas completadas — M.
- [ ] **Más logros** (rachas, ganar sin fallar el primer disparo) y **logros ocultos** — S.
- [ ] **Temporadas** con reinicio parcial del Elo — M · **Clasificación de campañas** (estrellas, menos disparos) además del Elo — S–M.
- [ ] **Hacer permanente la lámina dorada** una vez ganada (🔒 decisión, sección 11) — S.
- [ ] **GIF/animación** corta de la lámina para compartir — M.

---

## 8. Pixel art, animación y sonido

- [ ] **Revisión de las láminas por un dibujante** (el sistema acepta `tools/pixelart/manual/lamina-<id>.png` de 160×96) — M.
- [ ] **Láminas más grandes** (320×192) para impresión — S.
- [ ] **Efectos propios por escenario en acierto y hundimiento** (cráter, polvo, maleza) — S.
- [ ] **Humo y fuego persistentes más ricos** en unidades dañadas — S.
- [ ] **Cinemáticas cortas** al ganar/perder — M.
- [x] ✅ **Música de fondo en todo el juego** y **volumen propio de la música** (0.9). Falta: efectos de disparo/impacto/hundimiento más ricos y **volumen propio de los efectos** — M.
- [ ] **Música por escenario** (selva, tierra, corsarios, mar: hoy una sola pista de ambiente para todas las partidas) y **un acorde o pulso que suba al ganar/perder** — M.
- [ ] **Volumen de la música según la tensión** (más presencia al quedar pocas unidades) — S–M.
- [ ] **Unidades enemigas con paleta distinta** (uniformes) — M.
- [ ] **Interfaz pixel completa** (botones, marcos 9-slice, cursor propio, pantalla de título) — M–L.
- [ ] **Exportar el atlas a formato Aseprite** — S–M.
- [ ] **Íconos de la app hechos por el dibujante** (los actuales son generados) — S.

---

## 9. Experiencia, social y técnica

**Experiencia**
- [ ] **9.1 Partidas realmente sin conexión** — **L**. Los módulos de reglas e IA del backend (`domain/`, `ai/`) son JavaScript puro: se podrían empaquetar para el navegador y crear un «servidor local» en memoria que hable el mismo protocolo de mensajes que el WebSocket. El progreso se guardaría en el navegador (IndexedDB) y se sincronizaría al volver la conexión. Riesgos: que las reglas de estrellas y logros se evalúen en el cliente (hay que decidir qué se confía), y mantener dos formas de ejecutar el juego. **Es lo que más ayuda a colegios con internet inestable.**
- [ ] **Guardar el progreso en el navegador para verlo sin conexión** de forma segura (por usuario, borrado al cerrar sesión) — S–M.
- [ ] **Tutorial interactivo** de la primera partida — M.
- [ ] **Mejor móvil:** gestos para girar unidades, zoom del 20×20, vibración al tocar/hundir — M.
- [ ] **Atajos de teclado y navegación completa por teclado** — S–M.
- [ ] **Modo daltónico / alto contraste** — S · **Notificaciones de turno** con la pestaña en segundo plano — S · **Pantalla de carga con los sprites** — S.
- [ ] **Aviso de «hay una versión nueva» con botón de recargar** cuando el service worker se actualiza — S.

**Social** (si hay menores, definir primero moderación y privacidad)
- [ ] Chat de sala y reacciones, amigos e invitaciones, matchmaking por Elo, torneos, espectador mejorado — M a L.

**Backend, datos y seguridad**
- [ ] **Cookie `HttpOnly` / sesiones** en lugar de token en `localStorage` — M.
- [ ] **Recuperar contraseña / correo opcional** — M (hoy no hay forma de recuperarla; en un colegio, el docente podría restablecerla con 4.2).
- [ ] **9.4 Estadísticas globales** (victorias por misión, disparos medios) para calibrar estrellas con datos — S–M.
- [ ] **Copias de seguridad y retención de datos** — S · **Registro de auditoría** de logros y progreso — S.
- [ ] **Cupo de invitados en base de datos/Redis** y **varias instancias** del backend — S–M / L.
- [ ] **Privacidad si lo usan menores:** qué datos se guardan, cuánto tiempo, consentimiento de la institución — M (documento y política, más borrar cuenta).

**Calidad y mantenimiento**
- [x] 🟡 CI con pruebas, contenido y Prisma (falta que corra por primera vez)
- [ ] **Playwright en CI** (hoy `tools/e2e/mision.py` es manual y en Python) y **capturas automáticas** para revisar cambios visuales — M.
- [ ] **Aviso en CI si cambian archivos del frontend sin subir `VERSION` de `sw.js`** — S.
- [ ] **TypeScript o JSDoc con `checkJs`** (al menos el protocolo y el dominio) — L · **Versionado del protocolo** (campo `v`) — S · **Linter/formateador** — S.
- [ ] **Presupuesto de rendimiento** (atlas ~0,5 MB; láminas ~170 KB; catálogo ~50 KB, ~13 KB comprimido) — S.
- [ ] **Guía de contribución y guía de arte** (paleta, luz arriba-izquierda, cómo exportar de Aseprite) — S · **Manual para docentes** — M · **Página pública del proyecto** (portafolio) — S–M.

**IA y paralelismo** (sin cambios): IA con personalidad por campaña (M), dificultad adaptativa (M), análisis de partida y mapa de calor (M), medir hilos en tu equipo (S), generador de flotas temáticas (M), misiones donde la IA oculta su flota con reglas distintas (S–M).

---

## 10. Priorización sugerida

**Sprint A — dejar la 0.8 sólida (1–2 semanas)**
1. Subir a GitHub y mirar el CI: migraciones 2 y 3 y contrato Prisma (1.3, 1.4); `curl -I` de `sw.js` (1.6).
2. `npm run check:links` (1.2) · Docker (1.5) · Firefox/Safari/celular y lector de pantalla (1.7, 1.12).
3. **Entregar `export:review` a la persona de historia** (1.1) y empezar a corregir.
4. Calibrar estrellas jugando (1.8) y los límites por IP del curso (1.11).

**Sprint B — para usarlo en un curso real**
- 4.2 **clases y panel docente** (si decides guardar datos de estudiantes) + 4.12 modo examen + 9.4 estadísticas.
- 4.11 script de «clase» con QR · 4.15 repasar preguntas sin volver a jugar.
- **9.1 partidas sin conexión** (diseño y prueba de concepto).

**Sprint C — contenido y variedad**
- 5.1 campaña real nueva · 6.1 objetivos distintos + 4.10 modo fiel · 4.6 mapa de campaña · 4.8 niveles de lectura.

**Largo plazo:** dibujante, sonido y música, torneos y chat con moderación, `HttpOnly`/Redis/TypeScript, localización.

### Backlog en formato Scrum

| ID | Historia | Pts | Estado |
|----|----------|:---:|:---:|
| H-01 | **Como** docente, **quiero** que el sistema guarde las respuestas de cada estudiante, **para** saber quién comprendió la batalla | 8 | ✅ (por cuenta; el docente aún no las ve → H-02) |
| H-02 | **Como** docente, **quiero** crear una clase con código y ver el progreso de mis estudiantes, **para** usarlo como actividad de curso | 13 | 🔒 |
| H-03 | **Como** estudiante, **quiero** jugar misiones sin internet, **para** usar el juego aunque falle la conexión del colegio | 21 | 🟡 interfaz sin conexión hecha; jugar sin conexión pendiente (9.1) |
| H-04 | **Como** persona con baja visión, **quiero** que la narración se lea con lector de pantalla y en voz alta, **para** seguir la historia | 5 | 🟡 hecho; falta probar con lector real |
| H-05 | **Como** docente, **quiero** descargar una guía didáctica de cada misión, **para** preparar la clase | 8 | ✅ |
| H-06 | **Como** jugador, **quiero** misiones con objetivos distintos a «hundir todo», **para** que la campaña sea variada | 13 | ⬜ |
| H-07 | **Como** jugador, **quiero** ver un álbum con mis láminas y compartirlas en formato vertical, **para** mostrarlas en mis redes | 5 | ✅ (galería; álbum por campaña pendiente) |
| H-08 | **Como** equipo, **queremos** CI con pruebas, validación de contenido y revisión de enlaces, **para** no romper nada al agregar campañas | 3 | 🟡 escrito, sin ejecutar |
| H-09 | **Como** docente, **quiero** un modo examen (intentos limitados, orden aleatorio), **para** evaluar de verdad | 5 | ⬜ |
| H-10 | **Como** docente, **quiero** levantar el servidor del aula con un solo comando y un QR, **para** empezar la clase en minutos | 3 | ⬜ |
| H-11 | **Como** historiador, **quiero** un documento de revisión con casillas por misión, **para** aprobar o corregir el contenido sin leer código | 3 | ✅ (`export:review`) |
| H-12 | **Como** estudiante, **quiero** un mapa con las batallas de la campaña, **para** ubicarlas en el territorio | 8 | ⬜ |
| H-13 | **Como** estudiante de primaria, **quiero** una versión más sencilla de cada texto, **para** entender la historia | 8 | ⬜ |
| H-14 | **Como** equipo, **queremos** una campaña real nueva en lugar de «Litoral», **para** aumentar el contenido histórico | 13 | 🔒 |
| H-15 | **Como** jugador, **quiero** música de fondo suave en todo el juego y fuerte solo en la entrada, **para** sentirme dentro de la historia sin que me canse | 5 | 🟡 hecho; falta escucharla (1.13) |
| H-16 | **Como** jugador, **quiero** ver los nombres de los jefes de cada batalla en lugar de «Almirante IA» y mi nombre, **para** vivir la misión como parte de la historia | 5 | ✅ (revisión histórica pendiente: 1.14) |
| H-17 | **Como** docente, **quiero** controlar el volumen de la música y apagarla, **para** usar el juego en clase sin molestar | 2 | ✅ |

---

## 11. Decisiones que necesito de ti para seguir

- [ ] ¿El juego se usará **en clase/localmente** o se **publicará en internet**? (afecta seguridad, cupo, privacidad de menores y cuánto vale la PWA)
- [ ] ¿Quieres que el **docente pueda ver el progreso y los resultados de sus estudiantes**? (implica guardar datos de menores: ¿con apodos y consentimiento de la institución?) → desbloquea H-02, H-09
- [ ] ¿Quién hará la **revisión histórica** y con qué fuentes? ¿Hay fecha límite? (usa `npm run export:review`)
- [ ] ¿La campaña **«Operación Litoral»** se queda como ficción, se reemplaza por una real (¿cuál?) o se elimina?
- [ ] ¿Habrá un **dibujante** para las láminas y los íconos, o seguimos 100 % por código?
- [ ] ¿Qué se prioriza: **más contenido** (campañas), **más educación** (clases, examen, niveles de lectura) o **más pulido** (sonido, tutorial, juego sin conexión)?
- [ ] ¿Las láminas doradas, una vez ganadas, deben ser **permanentes** aunque cambie la calibración de estrellas?
- [ ] ¿Se quiere **chat/amigos** (implica moderación) o se mantiene simple?
- [ ] ¿El cupo de invitados y los límites por IP deben ser más estrictos o más flexibles para tu curso (número aproximado de estudiantes)?
- [ ] ¿Idiomas a localizar primero (guaraní, quechua, aymara, inglés)?
- [ ] ¿El **modo examen** debe poder repetirse (solo se guarda el mejor) o tener un solo intento?

---

- [ ] ¿La **música** debe ser distinta por escenario (selva, tierra, mar, corsarios) o basta una de ambiente? ¿Hace falta **música propia de victoria/derrota**?
- [ ] ¿En las misiones históricas, el jugador debe poder **elegir el bando** (por ejemplo, jugar como Estigarribia) o siempre juega del lado boliviano?

---

## 12. Historial de este documento

- **0.9:** música en todo el juego y jefes de cada bando: sección 0 y 3b, ítems 1.13–1.15, sonido (sección 8), historias H-15 a H-17 y dos decisiones nuevas (sección 11).
- **0.8:** se marcó lo hecho (sección 3), se agregaron 4.12–4.15, 9.1 con diseño, 1.6, 1.12, riesgos de la PWA y de lo no ejecutado, historias H-09 a H-14 y la herramienta `export:review`.
- **0.7:** versión inicial (pendientes de la 0.6 + ideas nuevas).
