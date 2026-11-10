/**
 * Narración de las campañas de ficción («Patente de corso» y «Operación Litoral»).
 * No describen hechos reales: no llevan fuentes ni preguntas, y los textos pueden ser ligeros.
 */
const ev = (o) => o;

export const CORSO = {
  1: {
    date: 'Ficción · 1879 imaginario', place: 'Una bahía cualquiera del Pacífico',
    real: 'Ficción: no describe hechos reales.',
    facts: ['En 1879 se decretó autorizar patentes de corso, pero en la práctica casi no hubo corsarios bolivianos.'],
    sources: [],
    intro: ['El decreto está firmado y la tinta todavía huele a nuevo. Tienes una chalupa, un loro y mucho entusiasmo.'],
    events: ev({
      start: '¡Viento a favor! El loro grita que hay un velero distraído a estribor.',
      firstHit: 'Primer cañonazo. El loro aplaude con un graznido.',
      firstSunk: '¡Primera presa! El loro exige su parte del botín.',
      firstLoss: 'Perdiste una unidad. El loro ya está haciendo las maletas.',
      half: 'La mitad del velero rival se rindió. ¡El oro huele cerca!',
      last: 'Queda un último mástil. ¡Que no escape!',
      win: '¡Primer botín! La tripulación canta.',
      lose: 'El velero escapó. El loro dice que mañana será otro día.',
    }),
  },
  2: {
    date: 'Ficción', place: 'Aguas brumosas del Pacífico',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['La niebla del Pacífico es perfecta para sorprender a los rivales. Navega con cuidado: tu reputación recién empieza.'],
    events: ev({
      start: 'La niebla lo cubre todo. Hay que adivinar dónde está el rival.',
      firstHit: 'Un golpe en la niebla. El rival ni vio de dónde vino.',
      firstSunk: 'Una nave rival desaparece entre la bruma.',
      firstLoss: 'La niebla juega para los dos lados: perdiste una nave.',
      half: 'La mitad de la flota rival ya no está. La bruma sigue.',
      last: 'Queda una sola nave rival. Se oyen sus campanas entre la niebla.',
      win: 'La niebla fue tu mejor aliada. Corre la voz entre los puertos.',
      lose: 'La niebla te jugó una mala pasada. A volver a zarpar.',
    }),
  },
  3: {
    date: 'Ficción', place: 'Alta mar, ruta del convoy',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['Un convoy cargado de provisiones cruza tus aguas. Es la oportunidad de tu vida (y de tu tripulación, que ya canta).'],
    events: ev({
      start: 'El convoy aparece en el horizonte. Es grande, lento y bien cargado.',
      firstHit: 'Primer tiro certero al convoy. Cunde el pánico entre los mercantes.',
      firstSunk: 'Un barco del convoy se hunde. La tripulación grita de alegría.',
      firstLoss: 'Una nave propia sufre un impacto. La escolta rival reacciona.',
      half: 'Mitad del convoy neutralizado. ¡El botín es enorme!',
      last: 'Queda una sola nave del convoy. ¡A por ella!',
      win: 'El convoy cayó. Los marineros hablan de ti en todas las tabernas imaginarias.',
      lose: 'El convoy escapó. Esta vez la escolta fue más lista.',
    }),
  },
  4: {
    date: 'Ficción', place: 'Un mar inmenso e inventado',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['Una flota entera te persigue y el mar es inmenso. Si sobrevives, tu leyenda será ficticia pero inolvidable.'],
    events: ev({
      start: 'La flota fantasma te persigue. No hay dónde esconderse, solo hay que pelear.',
      firstHit: 'Primer impacto. Las velas fantasmas tiemblan.',
      firstSunk: 'Un barco fantasma se desvanece. Quedan muchos más.',
      firstLoss: 'Pierdes una nave. El mar es inmenso, pero tu flota es pequeña.',
      half: 'La mitad de la flota fantasma se esfumó. Todavía hay lucha.',
      last: 'Último barco fantasma. ¡Que no te alcance!',
      win: 'Corsario legendario... en un mundo que nunca existió. ¡Bravo!',
      lose: 'La flota fantasma te alcanzó. Tu leyenda tendrá que esperar.',
    }),
  },
};

export const LITORAL = {
  1: {
    date: 'Ficción', place: 'Un litoral imaginario',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['La flota sale de puerto con las primeras luces. Reconocimiento de rutina: localiza y neutraliza a los intrusos.'],
    events: ev({
      start: 'Amanece sobre el puerto. La patrulla zarpa sin prisa.',
      firstHit: 'Contacto. Los intrusos no esperaban compañía.',
      firstSunk: 'Primer intruso neutralizado.',
      firstLoss: 'Un buque de la patrulla recibe un impacto.',
      half: 'La mitad de los intrusos ha sido neutralizada.',
      last: 'Queda un último intruso.',
      win: 'Zona despejada. Primera patrulla cumplida.',
      lose: 'Los intrusos escaparon. A repetir la patrulla.',
    }),
  },
  2: {
    date: 'Ficción', place: 'Una ruta marítima imaginaria',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['Un convoy necesita cruzar la zona sin contratiempos. Abre paso con tus unidades.'],
    events: ev({
      start: 'El convoy espera la señal. Abre paso.',
      firstHit: 'Primer impacto. La escolta despeja la ruta.',
      firstSunk: 'Cae un obstáculo. El convoy puede avanzar un tramo.',
      firstLoss: 'Un buque de escolta es alcanzado. El convoy sigue atento.',
      half: 'Mitad de la ruta despejada.',
      last: 'Queda un último obstáculo antes de llegar a puerto.',
      win: 'El convoy llegó a destino. Buen trabajo de escolta.',
      lose: 'La ruta no se despejó. El convoy espera una nueva escolta.',
    }),
  },
  3: {
    date: 'Ficción', place: 'Un paso marítimo imaginario',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['Un bloqueo naval requiere paciencia y orden. Cierra el paso, pieza a pieza.'],
    events: ev({
      start: 'El bloqueo comienza. Hay que cerrar el paso con calma.',
      firstHit: 'Un impacto. El bloqueo empieza a morder.',
      firstSunk: 'Una nave rival no pasará.',
      firstLoss: 'Un buque propio es alcanzado. El bloqueo se estira.',
      half: 'Mitad del tráfico rival detenido.',
      last: 'Una última nave intenta forzar el paso.',
      win: 'El bloqueo se mantuvo. La paciencia fue tu mejor arma.',
      lose: 'Forzaron el bloqueo. A reordenar la línea.',
    }),
  },
  4: {
    date: 'Ficción', place: 'Un estrecho imaginario',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['Aguas angostas, poco margen de error. Cada disparo cuenta cuando el rival está a la vuelta de la isla.'],
    events: ev({
      start: 'El estrecho es angosto. Cada maniobra cuenta.',
      firstHit: 'Impacto. El eco rebota en las paredes del estrecho.',
      firstSunk: 'Una nave rival se hunde en el paso.',
      firstLoss: 'Un buque propio recibe un impacto en aguas estrechas.',
      half: 'Mitad del rival neutralizado. El estrecho se despeja.',
      last: 'Queda una sola nave a la vuelta de la isla.',
      win: 'El estrecho quedó libre. Falta la última operación.',
      lose: 'El estrecho se cerró. Prueba otra vez con más calma.',
    }),
  },
  5: {
    date: 'Ficción', place: 'Un océano imaginario',
    real: 'Ficción: no describe hechos reales.', facts: [], sources: [],
    intro: ['La operación final reúne a todas las flotas en el océano abierto. Tablero enorme, IA experta y nada de improvisar.'],
    events: ev({
      start: 'Todas las flotas reunidas. Es la operación más grande.',
      firstHit: 'Primer impacto. El océano es enorme.',
      firstSunk: 'Cae la primera nave. Quedan muchas.',
      firstLoss: 'Una nave propia cae. Cierra filas.',
      half: 'Mitad del rival neutralizado. Aún queda mucho océano.',
      last: 'Queda una última nave. Ya casi está.',
      win: 'Campaña completada. El litoral imaginario queda a salvo.',
      lose: 'La gran armada fue superada. A repetir la operación final.',
    }),
  },
};
