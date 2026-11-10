# Verificación del contenido histórico

**Estado (0.7):** los datos de cada misión real (fecha, lugar, resultado) se **contrastaron con fuentes** y quedan listados abajo.
Eso **no reemplaza** la revisión de una persona de historia: antes de usar el juego con estudiantes, que alguien la haga
(la interfaz lo avisa en la ficha de cada misión real). Las fuentes de cada misión también se muestran en el juego, en
«Contexto histórico y fuentes».

## Correcciones que salieron de la verificación

El borrador de la 0.6 tenía errores que se corrigieron:

| Misión | Borrador 0.6 | Lo que dicen las fuentes | Cambio |
|---|---|---|---|
| Cañada Strongest | «A fines de 1934» | **10 al 25 de mayo de 1934**; Bolivia la conmemora el 20 de mayo | Fecha corregida |
| Villamontes | «Villamontes, el “Corralito”» | El «Corralito de Villamontes» fue el golpe del ejército contra el presidente Salamanca, en **noviembre de 1934**. La defensa de la ciudad fue el ataque paraguayo del **13 de febrero de 1935** | Misión renombrada «Defensa de Villamontes»; logro `hist_corralito` → `hist_villamontes` (con migración `2_logro_villamontes`); el dato del «Corralito» se aclara en las fuentes de la misión |
| Alihuatá y Campo Jordán | «Hacia fines de 1932» | **Febrero–marzo de 1933** (las fuentes difieren en días exactos) | Fecha corregida; se avisa de la diferencia |
| Boquerón | «La defensa resistió varias semanas» | Asedio del 9 al 29 de septiembre de 1932; los defensores restantes (unos 240, mayormente heridos) **se rindieron**. Había ~450 asediados, la falta de agua afectó a **ambos** bandos y los morteros fueron la ventaja decisiva | Texto corregido y misión marcada como reinterpretación. En una primera redacción de la 0.7 se había escrito «1 200 hombres» y «la sed fue decisiva»: ambos datos se corrigieron al contrastar con la fuente |
| Nanawa | «En 1933» | Dos batallas: **20–26 de enero** y **julio de 1933**; ambas fueron victorias paraguayas | Texto y fechas corregidos; reinterpretación |
| Campo Vía | «A fines de 1933» | **3 al 11 de diciembre de 1933**; rendición de las divisiones 4.ª y 9.ª | Fecha precisada |

## Estado de cada misión

`won` = ¿ganó en la historia el bando del jugador? Si es **no**, la misión se muestra como «reinterpretación» (el juego propone otro final y lo dice).

| Misión | Fecha | Resultado histórico | `won` | Fuentes principales |
|---|---|---|---|---|
| Chaco · Boquerón | 9–29 sep 1932 | Victoria paraguaya (rendición del fortín) | no | Wikipedia *Battle of Boquerón (1932)*; ABC Color (escolar); Univ. Católica Boliviana (artículo sobre Boquerón) |
| Chaco · Alihuatá y Campo Jordán | feb–mar 1933 | Victoria boliviana | sí | Wikipedia *First Battle of Alihuatá*, *Battle of Campo Jordán*, *Battle of Kilometer 7* |
| Chaco · Nanawa | 20–26 ene y jul 1933 | Victoria paraguaya (ambas) | no | Wikipedia *First/Second Battle of Nanawa* |
| Chaco · Campo Vía | 3–11 dic 1933 | Victoria paraguaya (rendición de dos divisiones) | no | Wikipedia *Campo Vía pocket*; OmniAtlas; Library of Congress, *Paraguay* |
| Chaco · Cañada Strongest | 10–25 may 1934 | Victoria boliviana | sí | Wikipedia *Battle of Cañada Strongest* y *The Strongest*; Decreto 10263 (1972); Ley 611 (1984) |
| Chaco · Defensa de Villamontes | desde 13 feb 1935 | La defensa resistió | sí | Wikipedia *Villamontes* y *1934 in Bolivia*; cronología de Peñaranda (ANDES) para el «Corralito» |
| Siglo XIX · Tumusla | 1 abr 1825 | Victoria patriota | sí | Wikipedia *Battle of Tumusla*; Ley 606 (2014); Correo del Sur (2020) |
| Siglo XIX · Ingavi | 18 nov 1841 | Victoria boliviana (murió Gamarra) | sí | Wikipedia *Battle of Ingavi*; Estudios Americanos (CSIC) |
| Siglo XIX · Calama (Topáter) | 23 mar 1879 | Victoria chilena | no | Wikipedia *Battle of Topáter*; Correo del Sur (2016); ley de 1929 |
| Siglo XIX · Alto de la Alianza | 26 may 1880 | Victoria chilena | no | Wikipedia *Battle of Tacna*; Los Tiempos (2017) |
| Siglo XIX · Ayacucho | 9 dic 1824 | Victoria patriota | sí | Wikipedia *Battle of Ayacucho* y *Antonio José de Sucre*; UNESCO (lista tentativa); Correo del Sur (2025) |

Los enlaces completos están en `backend/src/content/*.js` (campo `sources`) y se ven en el juego.

**Cómo se verificaron los enlaces.** Cada enlace se incluyó solo si apareció en una búsqueda real (3 de noviembre de 2026) o se pudo abrir.
Algunos enlaces escritos de memoria en una primera versión **no se pudieron verificar y se reemplazaron** (por ejemplo la
página de Boquerón de Correo del Sur y la ley 1208 sobre Bilbao Rioja). Las páginas cambian: ejecuta `npm run check:links`
(en `backend/`, con internet) antes de entregar. Un 403 o 429 suele ser un bloqueo a robots; ábrelo en el navegador antes de quitarlo.

## Lo que sigue pendiente (necesita a una persona de historia)

1. **Revisión de todos los textos** de `backend/src/content/` (narración, datos, preguntas) y de `briefing`/`debrief` en `domain/campaigns.js`.
   Se usaron sobre todo fuentes de referencia en línea (muchas de Wikipedia); lo ideal es contrastar con bibliografía académica
   (por ejemplo Roberto Querejazu Calvo, *Masamaclay* / historia de la Guerra del Chaco) y archivos nacionales.
2. **Equilibrio entre bandos:** los textos nombran a ambos ejércitos sin adjetivos hacia el rival. Confirmar que se mantiene así,
   en especial en Chaco y Guerra del Pacífico, donde la memoria de cada país es distinta.
3. **Cifras:** el juego casi no da cifras (de tropas, bajas, prisioneros) porque las fuentes difieren. Si se agregan, citar la fuente.
4. **Ayacucho:** se agregó el título de «Gran Mariscal de Ayacucho» (Sucre) y una pregunta; sigue con pocos datos: ampliar con fuentes específicas si se quiere más contexto.
4b. **Glosario:** las definiciones de `content/glosario.js` son cortas y neutrales; que las revise la misma persona de historia (en especial «Chaco Boreal», «Día del Mar» y «patente de corso»).
5. **Patente de corso:** el decreto de 1879 y el caso del *Laura* siguen **sin verificar**; el texto del juego solo menciona el año.
6. **Banderas:** en las láminas de 1824–1841 se dibujan banderines neutros (la bandera actual de Bolivia es de 1851). Confirmar el criterio.
7. **Nombres de los logros históricos:** son títulos de juego; confirmar que son apropiados.

Al terminar la revisión, quitar el aviso «pendiente de revisión por una persona de historia» de la ficha de misión (`#brief` en
`frontend/public/js/campaigns.js`) y el pie del diálogo «Datos y fuentes» (`frontend/public/index.html`).

## Decisiones tomadas que conviene confirmar

- **Cuarta campaña:** «Operación Litoral» sigue siendo ficción total (nombres y operaciones inventados). Es fácil de reemplazar
  por una campaña real (¿la Armada Boliviana en el Titicaca y los ríos?) con la guía [`NARRATIVA.md`](NARRATIVA.md).
- **Tierra = siglo XIX** (infantería, caballería y cañones, sin tanques); la campaña mezcla independencia, Ingavi y Guerra del Pacífico, ordenada por dificultad.
- **Misiones por campaña:** 6 (Chaco), 5 (siglo XIX y Litoral) y 4 (corso).
- **Escenario de selva** para el Chaco.
