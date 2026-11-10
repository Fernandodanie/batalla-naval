/** Textos en español para los códigos de error del servidor. */
const ERRORS = {
  sala_no_existe: 'Esa sala no existe. Revisa el código.',
  sala_llena: 'La sala ya está llena.',
  sala_cerrada: 'La sala ya se cerró.',
  ya_en_sala: 'Ya estás dentro de una sala.',
  ya_estas_en_la_sala: 'Tu cuenta ya está sentada en esa sala.',
  no_es_tu_turno: 'Todavía no es tu turno.',
  ya_disparaste_ahi: 'Ya disparaste a esa casilla.',
  fuera_de_rango: 'Esa casilla está fuera del tablero.',
  partida_no_iniciada: 'La partida todavía no está en esa fase.',
  flota_incompleta: 'Falta colocar barcos.',
  barcos_superpuestos: 'Dos barcos se pisan.',
  no_eres_jugador: 'Los espectadores no pueden jugar.',
  servidor_lleno: 'El servidor está lleno. Intenta en unos minutos.',
  tamano_invalido: 'Tamaño de tablero no válido.',
  demasiados_mensajes: 'Vas demasiado rápido. Espera un momento.',
  formato: 'Mensaje no válido.',
  correo_invalido: 'Ingresa un correo electrónico válido.',
  correo_ocupado: 'Ya existe una cuenta registrada con ese correo.',
  usuario_invalido: 'Nombre para mostrar: 3 a 16 caracteres (letras, números y _).',
  password_corta: 'La contraseña necesita al menos 8 caracteres.',
  password_larga: 'La contraseña es demasiado larga.',
  usuario_ocupado: 'Ese nombre para mostrar ya está en uso.',
  credenciales_invalidas: 'Correo o contraseña incorrectos.',
  demasiados_intentos: 'Demasiados intentos. Espera un minuto.',
  datos_invalidos: 'Revisa los datos ingresados.',
  limite_invitado: 'Llegaste al límite diario de partidas contra la IA como invitado. Inicia sesión para seguir jugando, o juega con amigos.',
  requiere_cuenta: 'Las campañas completas requieren una cuenta. Como invitado puedes probar la primera misión.',
  mision_bloqueada: 'Esa misión todavía está bloqueada: gana la anterior.',
  mision_no_existe: 'Esa misión no existe.',
  no_autorizado: 'Tu sesión venció. Inicia sesión otra vez.',
};

export const errorText = (code) => ERRORS[code] ?? 'Algo salió mal. Intenta de nuevo.';

export const REASONS = {
  flota_hundida: 'hundió toda la flota rival',
  abandono: 'el rival abandonó la partida',
  tiempo: 'el rival se quedó sin tiempo',
};
