/**
 * Narración de la campaña «Armas de la República» (siglo XIX).
 * Misiones ordenadas por dificultad, no por fecha. Ver `content/index.js` para la estructura.
 */
export const SIGLO19 = {
  1: {
    date: '1 de abril de 1825',
    place: 'Tumusla, Potosí',
    real: 'Resultado histórico: victoria patriota. Pedro Antonio Olañeta, jefe realista, fue herido de muerte.',
    won: true,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Carlos Medinaceli', role: 'Jefe de las tropas patriotas' },
      foe: { name: 'Pedro Antonio Olañeta', role: 'Jefe realista del Alto Perú' },
    },
    facts: [
      'Se la considera el último combate de la independencia en el Alto Perú.',
      'El coronel Carlos Medinaceli se había pasado al bando patriota con parte de las tropas de Olañeta.',
      'Olañeta murió al día siguiente, el 2 de abril. La declaración de independencia llegó el 6 de agosto de 1825.',
      'En 2014 una ley declaró patrimonio cultural e histórico a la batalla de Tumusla.',
    ],
    sources: [
      { title: 'Battle of Tumusla — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Tumusla' },
      { title: 'Ley 606 (2014): Batalla de Tumusla', url: 'https://www.lexivox.org/norms/BO-L-N606.html' },
      { title: '«Tumusla: La batalla innegable», Correo del Sur (Ecos), 2020', url: 'https://correodelsur.com/ecos/20200405_tumusla-la-batalla-innegable.html' },
    ],
    intro: [
      'Marzo de 1825. Los grandes ejércitos realistas ya fueron derrotados en el continente, pero en el Alto Perú queda una fuerza al mando de Pedro Antonio Olañeta.',
      'Parte de sus tropas se ha pasado al bando patriota. Es una escaramuza sin grandes ejércitos: perfecta para el primer paso.',
    ],
    events: {
      start: 'Amanece junto al río Tumusla. Es un combate pequeño, pero con un enorme peso histórico.',
      firstHit: 'Primer impacto. En el monte de Potosí las fuerzas son pocas y cada disparo importa.',
      firstSunk: 'Cae la primera posición realista. Las filas rivales empiezan a dudar.',
      firstLoss: 'Pierdes una unidad. Los defensores de la causa patriota eran pocos y no podían permitirse descuidos.',
      half: 'La mitad de las fuerzas rivales ha caído. El final del combate se acerca.',
      last: 'Queda un último foco de resistencia realista.',
      win: 'Victoria. Tumusla cerró la lucha por la independencia en el Alto Perú; pocos meses después nacería la República de Bolivia.',
      lose: 'El combate se perdió. En la historia la victoria fue patriota: inténtalo de nuevo.',
    },
    quiz: [
      { q: '¿En qué fecha se libró el combate de Tumusla?', options: ['1 de abril de 1825', '6 de agosto de 1825', '18 de noviembre de 1841'], answer: 0, why: 'La independencia se declaró recién el 6 de agosto de 1825.' },
      { q: '¿Quién era el jefe realista derrotado en Tumusla?', options: ['Pedro Antonio Olañeta', 'Agustín Gamarra', 'Narciso Campero'], answer: 0, why: 'Olañeta fue herido de muerte y falleció al día siguiente.' },
    ],
  },

  2: {
    date: '18 de noviembre de 1841',
    place: 'Ingavi, cerca de Viacha (La Paz)',
    real: 'Resultado histórico: victoria boliviana. Murió el presidente peruano Agustín Gamarra, que había invadido Bolivia.',
    won: true,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'José Ballivián', role: 'Jefe del ejército boliviano' },
      foe: { name: 'Agustín Gamarra', role: 'Presidente del Perú y jefe del ejército invasor' },
    },
    facts: [
      'Se la recuerda como una «segunda independencia» de Bolivia.',
      'Antes de la batalla, los bandos políticos bolivianos enfrentados se unieron en torno a José Ballivián.',
      'Historiadores señalan que Ballivián usó la victoria para legitimar su gobierno.',
    ],
    sources: [
      { title: 'Battle of Ingavi — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Ingavi' },
      { title: 'Colàs, P.: «Auge y caída de José Ballivián», Estudios Americanos (CSIC)', url: 'https://estudiosamericanos.revistas.csic.es/index.php/estudiosamericanos/article/download/913/906/927' },
    ],
    intro: [
      'Noviembre de 1841. El presidente peruano Agustín Gamarra ha invadido Bolivia. En la pampa de Ingavi, cerca de Viacha, lo espera el ejército que reunió José Ballivián.',
      'Dirige a tus columnas en la planicie y busca la victoria.',
    ],
    events: {
      start: 'Los dos ejércitos se miran sobre la planicie del altiplano. La batalla está por comenzar.',
      firstHit: 'Primer impacto. En campo abierto, cada columna que cae cambia el equilibrio.',
      firstSunk: 'Se rompe una columna rival. Cunde la confusión en las filas enemigas.',
      firstLoss: 'Pierdes una columna. Las filas se reordenan.',
      half: 'Mitad del ejército rival neutralizado. La batalla se inclina a tu favor.',
      last: 'Queda un último núcleo de resistencia.',
      win: 'Victoria. Ingavi quedó como una de las grandes victorias bolivianas y se conmemora cada año.',
      lose: 'La batalla se perdió. Intenta otra vez: en Ingavi el orden de las columnas decidió el combate.',
    },
    quiz: [
      { q: '¿Quién era el presidente peruano que murió en Ingavi?', options: ['Agustín Gamarra', 'Ramón Castilla', 'Mariano Prado'], answer: 0, why: 'Gamarra murió en la batalla durante su invasión a Bolivia.' },
      { q: '¿Qué se dice de Ingavi en la memoria boliviana?', options: ['Que fue una segunda independencia', 'Que fue una derrota', 'Que no existió'], answer: 0, why: 'La victoria se recuerda como una especie de segunda independencia del país.' },
    ],
  },

  3: {
    date: '23 de marzo de 1879',
    place: 'Calama, puente del Topáter',
    real: 'Resultado histórico: victoria chilena. Un grupo reducido de bolivianos defendió Calama; Eduardo Abaroa murió en el puente.',
    won: false,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Ladislao Cabrera', role: 'Organizador de la defensa de Calama' },
      foe: { name: 'Eleuterio Ramírez', role: 'Jefe de la columna chilena' },
    },
    facts: [
      'Fue el primer enfrentamiento armado de la Guerra del Pacífico.',
      'La defensa fue organizada por Ladislao Cabrera, con voluntarios civiles y algunos militares.',
      'Cada 23 de marzo se conmemora en Bolivia el Día del Mar.',
    ],
    sources: [
      { title: 'Battle of Topáter — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Top%C3%A1ter' },
      { title: '«Valentín Navarro y los héroes de Calama», Correo del Sur (Ecos), 2016', url: 'https://correodelsur.com/ecos/20160320/valentin-navarro-y-los-heroes-de-calama.html' },
      { title: 'Ley del 22 de marzo de 1929: cincuentenario de la defensa de Calama', url: 'https://www.lexivox.org/norms/BO-L-19290322-2.xhtml' },
    ],
    intro: [
      '23 de marzo de 1879. Las fuerzas chilenas llegan a Calama. Frente a ellas hay un grupo reducido de voluntarios y soldados bolivianos, con Ladislao Cabrera a la cabeza y Eduardo Abaroa entre ellos.',
      'En la historia fue una derrota con mucho valor simbólico. En esta misión resiste todo lo posible y defiende el puente.',
    ],
    events: {
      start: 'Las fuerzas son muy desiguales. Aun así, hay un puente que defender.',
      firstHit: 'Primer impacto. Cada tiro cuenta cuando son tan pocos.',
      firstSunk: 'Cae una posición rival. Cada una cuenta cuando se defiende un puente con tan pocas personas.',
      firstLoss: 'Pierdes una unidad. Los defensores de Calama eran voluntarios y cada baja se sentía.',
      half: 'La mitad de las fuerzas rivales ha caído. Mantén el puente.',
      last: 'Queda un último foco. Si lo neutralizas, el puente queda a salvo.',
      win: 'Resististe. En la historia Calama cayó, y Abaroa se volvió un símbolo; en el juego, lograste sostener la posición.',
      lose: 'El puente cayó. Así terminó en la historia: Calama fue tomada, y la defensa quedó como símbolo.',
    },
    quiz: [
      { q: '¿Qué se conmemora cada 23 de marzo en Bolivia?', options: ['El Día del Mar', 'La fundación de La Paz', 'La batalla de Ingavi'], answer: 0, why: 'Recuerda la defensa de Calama, primer choque de la Guerra del Pacífico.' },
      { q: '¿Quién organizó la defensa de Calama?', options: ['Ladislao Cabrera', 'Hilarión Daza', 'José Ballivián'], answer: 0, why: 'Cabrera organizó la defensa; Abaroa fue uno de los voluntarios.' },
    ],
  },

  4: {
    date: '26 de mayo de 1880',
    place: 'Alto de la Alianza, Tacna (Perú)',
    real: 'Resultado histórico: victoria chilena. Fue la última gran participación de Bolivia en la Guerra del Pacífico.',
    won: false,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Narciso Campero', role: 'General en jefe del ejército aliado' },
      foe: { name: 'Manuel Baquedano', role: 'General en jefe del ejército chileno' },
    },
    facts: [
      'También se la conoce como batalla de Tacna o Campo de la Alianza.',
      'El ejército aliado de Perú y Bolivia estaba al mando del presidente boliviano Narciso Campero.',
      'Después de esta batalla Bolivia se retiró de la guerra.',
    ],
    sources: [
      { title: 'Battle of Tacna — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Tacna' },
      { title: '«La épica batalla del Alto de la Alianza», Los Tiempos, 2017', url: 'https://www.lostiempos.com/actualidad/cultura/20170529/epica-batalla-del-alto-alianza' },
    ],
    intro: [
      'Mayo de 1880. Cerca de Tacna, los ejércitos aliados de Bolivia y Perú se enfrentan a las fuerzas chilenas que avanzan. Es una batalla difícil.',
      'En la historia fue una derrota aliada. En esta misión lee el terreno con cuidado y busca resistir.',
    ],
    events: {
      start: 'El ejército aliado ocupa el Alto de la Alianza. Se espera el ataque.',
      firstHit: 'Primer impacto. En la meseta el terreno favorece a quien ve primero.',
      firstSunk: 'Cae una unidad rival. Los aliados resisten.',
      firstLoss: 'Pierdes una unidad. La batalla fue muy dura y las bajas pesaron.',
      half: 'La mitad de las fuerzas rivales ha caído. Todavía hay batalla por delante.',
      last: 'Queda un último núcleo enemigo.',
      win: 'Resististe. En la historia la batalla se perdió y Bolivia se retiró de la guerra; en el juego la posición se sostuvo.',
      lose: 'La línea se rompió. Así terminó en la historia: tras esta batalla, Bolivia se retiró de la guerra.',
    },
    quiz: [
      { q: '¿Quién mandaba el ejército aliado en el Alto de la Alianza?', options: ['Narciso Campero', 'Antonio José de Sucre', 'José Ballivián'], answer: 0, why: 'Campero, presidente de Bolivia, fue general en jefe del ejército aliado.' },
      { q: '¿Qué ocurrió con la participación de Bolivia en la guerra después de esta batalla?', options: ['Se retiró de la guerra', 'Duplicó su ejército', 'Ganó el litoral'], answer: 0, why: 'La derrota marcó el final de la participación boliviana.' },
    ],
  },

  5: {
    date: '9 de diciembre de 1824',
    place: 'Pampa de la Quinua, Ayacucho (Perú)',
    real: 'Resultado histórico: victoria patriota al mando de Antonio José de Sucre.',
    won: true,  // ¿ganó en la historia el bando del jugador? (si no, la misión es una reinterpretación)
    commanders: {  // quién mandaba cada bando (se muestra en la sala y en la ficha; ver docs/NARRATIVA.md)
      you: { name: 'Antonio José de Sucre', role: 'General en jefe del ejército patriota' },
      foe: { name: 'José de la Serna', role: 'Virrey del Perú y jefe del ejército realista' },
    },
    facts: [
      'Fue una de las batallas decisivas de la independencia sudamericana.',
      'El general realista José de Canterac firmó la capitulación de Ayacucho.',
      'En el Alto Perú aún quedaba la fuerza de Olañeta, que se enfrentó a los patriotas en Tumusla en 1825.',
      'Por esta victoria, Sucre recibió el título de «Gran Mariscal de Ayacucho».',
    ],
    sources: [
      { title: 'Battle of Ayacucho — Wikipedia', url: 'https://en.wikipedia.org/wiki/Battle_of_Ayacucho' },
      { title: 'Antonio José de Sucre — Wikipedia', url: 'https://en.wikipedia.org/wiki/Antonio_Jos%C3%A9_de_Sucre' },
      { title: '«La liberación de Bolivia», Correo del Sur (Ecos), 2025', url: 'https://correodelsur.com/ecos/20250330/la-liberacion-de-bolivia.html' },
      { title: 'Pampa de Ayacucho (Quinua) — UNESCO, lista tentativa', url: 'https://whc.unesco.org/en/tentativelists/6413' },
    ],
    intro: [
      'Diciembre de 1824. En la pampa de la Quinua, el ejército patriota al mando de Antonio José de Sucre se enfrenta al ejército realista.',
      'De esta batalla depende buena parte de la independencia de Sudamérica. Gran tablero y una IA experta.',
    ],
    events: {
      start: 'Las dos líneas se miran en la pampa. La batalla decidirá mucho más que un territorio.',
      firstHit: 'Primer impacto. En una batalla tan grande cada columna cuenta.',
      firstSunk: 'Cae una columna realista. El frente comienza a moverse.',
      firstLoss: 'Pierdes una columna. Reorganiza las filas.',
      half: 'Mitad del ejército realista neutralizado. La victoria empieza a verse.',
      last: 'Queda una última fuerza. Si cae, la batalla estará decidida.',
      win: 'Victoria. Ayacucho abrió el camino a la independencia de Bolivia, que se declararía meses después. Completaste la campaña.',
      lose: 'La batalla se perdió. En la historia la victoria fue patriota: reordena tus fuerzas e inténtalo otra vez.',
    },
    quiz: [
      { q: '¿Quién mandaba el ejército patriota en Ayacucho?', options: ['Antonio José de Sucre', 'Narciso Campero', 'Pedro Antonio Olañeta'], answer: 0, why: 'Sucre comandó al ejército patriota en la batalla.' },
      { q: '¿En qué año fue la batalla de Ayacucho?', options: ['1824', '1841', '1879'], answer: 0, why: 'Fue el 9 de diciembre de 1824, meses antes de Tumusla.' },
      { q: '¿Qué título recibió Sucre por la victoria de Ayacucho?', options: ['Gran Mariscal de Ayacucho', 'Libertador de América', 'Protector del Perú'], answer: 0, why: 'Se le conoce como «Gran Mariscal de Ayacucho».' },
    ],
  },
};
