/**
 * Narración de la campaña «Guerra del Chaco» (1932–1935).
 *
 * Los datos (fechas, lugares, resultados) se contrastaron con las fuentes de cada misión; aun así, antes de usarlo
 * en un aula conviene que lo revise una persona de historia (ver docs/VERIFICACION-HISTORICA.md).
 * Criterio: se nombra a ambos ejércitos sin adjetivos hacia el rival y se dice siempre qué pasó de verdad.
 *
 * Estructura de cada misión: ver `content/index.js`.
 */
export const CHACO = {
  1: {
    date: '9 al 29 de septiembre de 1932',
    place: 'Fortín Boquerón, Chaco Boreal',
    real: 'Resultado histórico: victoria paraguaya. Los defensores que quedaban, unos 240 y en su mayoría heridos, se rindieron el 29 de septiembre.',
    won: false,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Manuel Marzana', role: 'Jefe de la guarnición boliviana de Boquerón' },
      foe: { name: 'José Félix Estigarribia', role: 'Jefe de las fuerzas paraguayas del asedio' },
    },
    facts: [
      'Fue la primera gran batalla de la guerra: el asedio duró unos veinte días.',
      'Dentro del fortín había alrededor de 450 soldados bolivianos; una columna de socorro de unos 3 500 fue rechazada el 12 de septiembre.',
      'Los morteros, un arma que las tropas bolivianas no conocían hasta entonces, dieron una ventaja decisiva a las fuerzas paraguayas, según la fuente.',
      'Los dos bandos sufrieron por la falta de agua potable; los pozos del fortín se contaminaron bajo el fuego.',
    ],
    sources: [
      { title: 'Battle of Boquerón (1932) — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Boquer%C3%B3n_(1932)' },
      { title: '«Batalla de Boquerón», ABC Color (Paraguay), sección escolar', url: 'https://www.abc.com.py/escolar/tercer-ciclo/historia-y-geografia/2025/09/23/batalla-de-boqueron/' },
      { title: 'Crespo Torrico, C. R.: «De Boquerón a la Revolución Nacional: el legado militar y político de Clemente Inofuentes» (Universidad Católica Boliviana)', url: 'https://cienciaycultura.ucb.edu.bo/a/article/download/1333/1344/2390' },
    ],
    intro: [
      'Septiembre de 1932. Desde finales de julio las tropas bolivianas ocupan el fortín Boquerón; ahora el ejército paraguayo lo rodea para recuperarlo.',
      'Dentro hay unos cuatrocientos cincuenta hombres, trincheras y pozos de agua que se irán contaminando. En la historia real el cerco terminó en rendición. En esta misión tu tarea es distinta: resistir y rechazar a las fuerzas que lo acechan.',
    ],
    events: {
      start: 'Amanece sobre el fortín. Cada casilla que descubras es una trinchera, un claro o un pozo de agua.',
      firstHit: 'Primer impacto. En el Chaco, un buen disparo valía el peso de la poca munición que había.',
      firstSunk: 'Una posición enemiga cae. Los defensores de Boquerón sabían que cada hora ganada era una hora más de espera por refuerzos.',
      firstLoss: 'Perdiste una unidad. Dentro del fortín el agua escaseaba y cada baja pesaba más.',
      half: 'La mitad del cerco está rota. Aguanta: la paciencia es el recurso que más se agota en el monte.',
      last: 'Queda una sola posición enemiga. Es el último esfuerzo antes de levantar el cerco.',
      win: 'Cerco roto. En la realidad Boquerón se rindió el 29 de septiembre de 1932; aquí lograste lo que entonces no se pudo.',
      lose: 'El cerco se cerró. Así ocurrió en la historia: tras unos veinte días de asedio, Boquerón se rindió.',
    },
    quiz: [
      { q: '¿Cuánto duró aproximadamente la batalla de Boquerón?', options: ['Unos tres días', 'Unos veinte días', 'Más de seis meses'], answer: 1, why: 'Se libró del 9 al 29 de septiembre de 1932.' },
      { q: '¿Qué arma, desconocida hasta entonces para las tropas bolivianas, dio una ventaja decisiva a las fuerzas paraguayas según la fuente?', options: ['Los morteros', 'Los tanques', 'Los barcos fluviales'], answer: 0, why: 'La ventaja de los morteros se menciona como decisiva en el asedio.' },
    ],
  },

  2: {
    date: 'Febrero y marzo de 1933',
    place: 'Alihuatá y Campo Jordán, Chaco Boreal',
    real: 'Resultado histórico: victoria boliviana. El ejército boliviano retomó Alihuatá y la 1.ª División paraguaya se retiró de la zona.',
    won: true,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Victorino Gutiérrez', role: 'Jefe de la 9.ª División boliviana' },
      foe: { name: 'José Félix Estigarribia', role: 'Comandante en jefe del ejército paraguayo' },
    },
    facts: [
      'Meses antes, en el «Kilómetro 7» (noviembre de 1932), una defensa boliviana había frenado el avance paraguayo.',
      'Las fuentes difieren en algunas fechas exactas; coinciden en que los combates se concentraron entre febrero y marzo de 1933.',
      'Este fue uno de los momentos favorables para Bolivia en una guerra que después se inclinó hacia el otro lado.',
    ],
    sources: [
      { title: 'First Battle of Alihuatá — Wikipedia', url: 'https://en.wikipedia.org/wiki/First_Battle_of_Alihuat%C3%A1' },
      { title: 'Battle of Campo Jordán — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Campo_Jord%C3%A1n' },
      { title: 'Battle of Kilometer 7 — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Kilometer_7' },
    ],
    intro: [
      'Principios de 1933. Después de resistir en el Kilómetro 7, el ejército boliviano pasa a la ofensiva y busca cortar el camino de abastecimiento que sostiene a las fuerzas paraguayas.',
      'El objetivo es el fortín de Alihuatá. Avanza por el pajonal, despeja la zona y no pierdas el contacto: en el monte, quien pierde el rumbo pierde la batalla.',
    ],
    events: {
      start: 'Marcha de aproximación. En el pajonal, ver al enemigo antes de ser visto lo es todo.',
      firstHit: 'Contacto. La maniobra sorpresa funcionó: el rival no esperaba un golpe por ese camino.',
      firstSunk: 'Primer punto de apoyo enemigo neutralizado. El camino de abastecimiento empieza a quedar cortado.',
      firstLoss: 'Pérdida en tus filas. La ofensiva tiene costo, pero el ritmo no se puede perder.',
      half: 'Mitad de la zona despejada. El ejército rival ya considera replegarse.',
      last: 'Queda un último foco. Si lo despejas, Alihuatá queda en tus manos.',
      win: 'Alihuatá retomado. Fue una de las victorias bolivianas del año, aunque la guerra estaba lejos de terminar.',
      lose: 'La maniobra fracasó. En esta etapa el éxito dependía de la sorpresa y de no dejar huecos en el avance.',
    },
    quiz: [
      { q: '¿En qué año ocurrieron los combates de Alihuatá y Campo Jordán que retrata esta misión?', options: ['1932, a fines de año', '1933, entre febrero y marzo', '1935'], answer: 1, why: 'Las fuentes los ubican a inicios de 1933.' },
      { q: '¿Qué buscaba cortar el ejército boliviano en Alihuatá?', options: ['El camino de abastecimiento rival', 'El río Pilcomayo', 'El ferrocarril a La Paz'], answer: 0, why: 'La maniobra apuntaba a la ruta que abastecía a la 1.ª División paraguaya.' },
    ],
  },

  3: {
    date: '20 al 26 de enero y julio de 1933',
    place: 'Fortín Nanawa, Chaco Boreal',
    real: 'Resultado histórico: victoria paraguaya en ambas batallas. Los asaltos bolivianos contra el fortín no lograron romper la línea.',
    won: false,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Hans Kundt', role: 'Comandante en jefe del ejército boliviano' },
      foe: { name: 'Luis Irrazábal', role: 'Jefe de la defensa paraguaya de Nanawa' },
    },
    facts: [
      'Hubo dos grandes batallas en Nanawa: la primera en enero de 1933 y la segunda siete meses después, en julio.',
      'Por su dureza y las trincheras, se la ha comparado con Verdún, en la Primera Guerra Mundial.',
      'Las defensas preparadas mostraron lo costoso que era atacar de frente.',
    ],
    sources: [
      { title: 'First Battle of Nanawa — Wikipedia', url: 'https://en.wikipedia.org/wiki/First_Battle_of_Nanawa' },
      { title: 'Second Battle of Nanawa — Wikipedia', url: 'https://en.wikipedia.org/wiki/Second_Battle_of_Nanawa' },
    ],
    intro: [
      '1933. Nanawa es un fortín rodeado de trincheras y defensas preparadas. El mando boliviano quiere romper la línea para amenazar Concepción.',
      'En la historia los asaltos frontales fracasaron. En esta misión no repites el asalto: exploras la línea con paciencia, cada trinchera descubierta cuenta.',
    ],
    events: {
      start: 'Silencio antes del primer disparo. La línea fortificada es larga y cada casilla puede esconder una trinchera.',
      firstHit: 'Impacto. Descubrir una trinchera es avanzar un paso; el siguiente cuesta el doble.',
      firstSunk: 'Una posición cae. En Nanawa conquistar una sola trinchera ya era una hazaña.',
      firstLoss: 'Perdiste una unidad. El fuego de la línea fortificada se cobra caro.',
      half: 'Mitad de la línea reconocida. La paciencia empieza a dar fruto.',
      last: 'La última trinchera. Si cae, la línea queda rota.',
      win: 'Línea rota. En la historia no se logró; aquí lo conseguiste con paciencia y buenos tiros.',
      lose: 'La línea aguantó. Es lo que ocurrió en la historia: los asaltos frontales no rompieron las defensas.',
    },
    quiz: [
      { q: '¿Cuántas grandes batallas hubo en Nanawa?', options: ['Una', 'Dos', 'Cinco'], answer: 1, why: 'La primera fue en enero de 1933 y la segunda en julio de 1933.' },
      { q: '¿Qué hizo tan costoso atacar Nanawa de frente?', options: ['Trincheras y defensas preparadas', 'La falta de luz de luna', 'Una inundación'], answer: 0, why: 'Las defensas fortificadas hacían muy dura cualquier ofensiva.' },
    ],
  },

  4: {
    date: '3 al 11 de diciembre de 1933',
    place: 'Campo Vía, Chaco Boreal',
    real: 'Resultado histórico: victoria paraguaya. Las divisiones bolivianas 4.ª y 9.ª quedaron cercadas y se rindieron el 11 de diciembre.',
    won: false,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Carlos Banzer', role: 'Jefe de la 9.ª División boliviana, una de las dos cercadas' },
      foe: { name: 'José Félix Estigarribia', role: 'Comandante en jefe del ejército paraguayo' },
    },
    facts: [
      'Fue una de las batallas más decisivas de la guerra: miles de soldados bolivianos cayeron prisioneros.',
      'Tras el desastre fue relevado el general alemán Hans Kundt, que mandaba el ejército boliviano; lo reemplazó Enrique Peñaranda.',
      'Las fuentes difieren en el inicio exacto (noviembre o el 3 de diciembre) y en las cifras: hablan de entre unos 8 000 y 9 000 soldados bolivianos muertos o capturados.',
    ],
    sources: [
      { title: 'Campo Vía pocket — Wikipedia', url: 'https://en.wikipedia.org/wiki/Campo_V%C3%ADa_pocket' },
      { title: 'OmniAtlas: South America 1935, Paraguayan Chaco Offensive', url: 'https://omniatlas.com/maps/south-america/19361125/' },
      { title: 'Paraguay — Country Studies (Library of Congress)', url: 'https://countrystudies.us/paraguay/15.htm' },
    ],
    intro: [
      'Diciembre de 1933. Dos divisiones bolivianas, la 4.ª y la 9.ª, están cercadas en Campo Vía por las fuerzas paraguayas.',
      'En la historia el cerco terminó en rendición. Esta misión es una reinterpretación jugable: tu objetivo es romper el cerco y abrir paso. Es una licencia del juego, no un hecho histórico.',
    ],
    events: {
      start: 'Cerco cerrado. Hay que encontrar el punto débil antes de que el anillo se estreche.',
      firstHit: 'Primer impacto. Las fuerzas que te rodean son más numerosas, pero no están en todas partes.',
      firstSunk: 'Una posición enemiga cede. Aparece una grieta en el cerco.',
      firstLoss: 'Una unidad propia cae. El cerco aprieta y las bajas se acumulan.',
      half: 'Mitad del cerco roto. Ya se ve el camino hacia el sur.',
      last: 'Queda un último bloqueo. Rómpelo y el paso queda libre.',
      win: 'Cerco roto. En la historia las divisiones se rindieron el 11 de diciembre de 1933; aquí lograste lo que entonces no se pudo.',
      lose: 'El cerco se cerró del todo. Así terminó en la historia: el 11 de diciembre las divisiones cercadas se rindieron.',
    },
    quiz: [
      { q: '¿Qué ocurrió en realidad con las divisiones cercadas en Campo Vía?', options: ['Rompieron el cerco', 'Se rindieron el 11 de diciembre de 1933', 'Fueron relevadas por aire'], answer: 1, why: 'El cerco terminó en una rendición tras varios días de combate.' },
      { q: '¿Qué licencia se toma el juego en esta misión?', options: ['Cambia la fecha', 'Te deja romper el cerco, algo que no ocurrió', 'Cambia el país que gana'], answer: 1, why: 'La misión es una reinterpretación: en la historia el cerco no se rompió.' },
    ],
  },

  5: {
    date: '10 al 25 de mayo de 1934',
    place: 'Cañada Strongest (Cañada Esperanza), Chaco Boreal',
    real: 'Resultado histórico: victoria boliviana. Fuerzas paraguayas fueron rodeadas y capturadas.',
    won: true,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Bernardino Bilbao Rioja', role: 'Jefe de las fuerzas bolivianas en Cañada Strongest' },
      foe: { name: 'José Félix Estigarribia', role: 'Comandante en jefe del ejército paraguayo' },
    },
    facts: [
      'Bolivia recuerda esta batalla cada 20 de mayo como día histórico (decreto de 1972).',
      'Recibe el nombre de The Strongest porque soldados que eran miembros de ese club paceño combatieron allí.',
      'El combate se libró en realidad cerca de una quebrada seca llamada Cañada Esperanza.',
    ],
    sources: [
      { title: 'Battle of Cañada Strongest — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Ca%C3%B1ada_Strongest' },
      { title: 'Decreto 10263 (1972): Día de la batalla de Cañada Strongest', url: 'https://www.pixilegal.com/normativa/decreto-10263-1972-05-19' },
      { title: 'Ley 611 (1984): Héroes nacionales de Cañada Strongest', url: 'https://www.pixilegal.com/normativa/ley-611-1984-03-23' },
      { title: 'The Strongest (club) — Wikipedia', url: 'https://en.wikipedia.org/wiki/The_Strongest' },
    ],
    intro: [
      'Mayo de 1934. Fuerzas bolivianas al mando del coronel Bernardino Bilbao Rioja maniobran en el monte para cercar a un destacamento paraguayo que vigila sus movimientos.',
      'Repite la maniobra: reconoce el terreno seco, cierra los caminos y asegura la zona.',
    ],
    events: {
      start: 'Silencio en la cañada seca. Hay que moverse sin ser vistos.',
      firstHit: 'Contacto. El destacamento rival empieza a darse cuenta de que está en peligro.',
      firstSunk: 'Cae una posición enemiga. El cerco se cierra poco a poco.',
      firstLoss: 'Una unidad propia queda fuera de combate. Hay que cerrar filas.',
      half: 'La mitad de las posiciones rivales ha caído. La maniobra está funcionando.',
      last: 'Un último foco. Si lo neutralizas, el cerco se completa.',
      win: 'Cerco completo. La batalla de Cañada Strongest quedó en la memoria boliviana como una victoria de la etapa central de la guerra.',
      lose: 'La maniobra falló. En esta batalla el éxito dependió de cerrar los caminos a tiempo.',
    },
    quiz: [
      { q: '¿En qué mes y año se libró Cañada Strongest?', options: ['Diciembre de 1933', 'Mayo de 1934', 'Febrero de 1935'], answer: 1, why: 'Del 10 al 25 de mayo de 1934; Bolivia la conmemora cada 20 de mayo.' },
      { q: '¿Por qué lleva ese nombre?', options: ['Por un general apellidado Strongest', 'Por soldados del club The Strongest que combatieron allí', 'Por el río que cruza la zona'], answer: 1, why: 'Se la conoce así por soldados miembros de ese club paceño.' },
    ],
  },

  6: {
    date: '13 de febrero de 1935 en adelante',
    place: 'Villamontes, Gran Chaco tarijeño',
    real: 'Resultado histórico: la defensa boliviana resistió el ataque paraguayo iniciado el 13 de febrero de 1935.',
    won: true,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Bernardino Bilbao Rioja', role: 'Jefe de la defensa de Villamontes' },
      foe: { name: 'José Félix Estigarribia', role: 'Comandante en jefe del ejército paraguayo' },
    },
    facts: [
      'La defensa de Villamontes estuvo a cargo del coronel (luego mariscal) Bernardino Bilbao Rioja.',
      'Bolivia había movilizado a un tercer ejército y contaba con más hombres y material que meses antes.',
      'El 19 de abril de 1935 las fuerzas bolivianas eliminaron la cuña que los paraguayos habían abierto en febrero.',
      'No confundir con el «Corralito de Villamontes»: fue otro episodio, de noviembre de 1934, con el que los generales depusieron al presidente Salamanca; no es la batalla de 1935.',
    ],
    sources: [
      { title: 'Villamontes — Wikipedia', url: 'https://en.wikipedia.org/wiki/Villamontes' },
      { title: '1934 in Bolivia — Wikipedia (golpe contra Salamanca, 27 de noviembre)', url: 'https://en.wikipedia.org/wiki/1934_in_Bolivia' },
      { title: 'Enrique Peñaranda del Castillo (ANDES), cronología con el «Corralito de Villamontes»', url: 'https://www.andesacd.org/wp-content/uploads/2015/11/Enrique-Peñaranda-del-Castillo.pdf' },
    ],
    intro: [
      'Febrero de 1935. La guerra entra en su última etapa. Villamontes, en el Chaco tarijeño, es el centro de la defensa boliviana: si cae, el avance paraguayo llegaría a la región de Tarija.',
      'El coronel Bilbao Rioja organiza las líneas. Es la prueba definitiva: tablero grande y una IA experta.',
    ],
    events: {
      start: 'Empieza la última gran prueba. Las líneas de defensa de Villamontes no pueden ceder.',
      firstHit: 'Primer impacto. Las defensas escalonadas comienzan a mostrar su valor.',
      firstSunk: 'Cae un primer ataque. Quienes defendieron Villamontes sabían que cada rechazo cuenta.',
      firstLoss: 'Una de tus unidades cae. Reorganiza: el frente tiene que sostenerse.',
      half: 'Mitad del ataque rechazada. La defensa aguanta.',
      last: 'Último foco del ataque. Una vez neutralizado, el frente queda asegurado.',
      win: 'Villamontes resistió. Es parte central de la memoria de la guerra en el Chaco tarijeño. Cumpliste la campaña.',
      lose: 'La defensa cedió. En la historia aguantó, con más hombres y material que antes; aquí, intenta otra vez.',
    },
    quiz: [
      { q: '¿Cuándo comenzó el ataque paraguayo a Villamontes que retrata esta misión?', options: ['El 13 de febrero de 1935', 'En septiembre de 1932', 'En diciembre de 1933'], answer: 0, why: 'La defensa resistió el ataque iniciado el 13 de febrero de 1935.' },
      { q: '¿Qué fue el «Corralito de Villamontes»?', options: ['La defensa de la ciudad', 'Un golpe contra el presidente Salamanca en 1934', 'Una batalla naval'], answer: 1, why: 'Fue la deposición de Salamanca por el ejército en noviembre de 1934; no es la batalla de 1935.' },
    ],
  },
};
