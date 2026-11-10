import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Toda la configuración sale de variables de entorno (ver .env.example). */

const int = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET || (production ? '' : 'dev-secret-solo-para-desarrollo');
  if (production && (jwtSecret.length < 16 || jwtSecret.startsWith('dev-') || jwtSecret.includes('cambia'))) {
    throw new Error('JWT_SECRET debe definirse en producción (mínimo 16 caracteres, no el valor de ejemplo).');
  }
  const storage = env.STORAGE || (env.DATABASE_URL ? 'prisma' : 'memory');
  if (storage === 'prisma' && !env.DATABASE_URL) throw new Error('STORAGE=prisma requiere DATABASE_URL.');

  const nodeEnv = env.NODE_ENV || 'development';
  // En desarrollo, si el frontend está en la carpeta hermana, el backend lo sirve (todo en un solo puerto).
  const sibling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/public');
  const staticDir = env.STATIC_DIR || (nodeEnv === 'development' && existsSync(sibling) ? sibling : '');
  // Con un solo núcleo un pool de hilos solo agrega costo (ver README, sección de paralelismo).
  const defaultWorkers = Math.max(0, Math.min(2, os.availableParallelism() - 1));

  return {
    nodeEnv,
    staticDir,
    production,
    port: int(env.PORT, 4000),
    host: env.HOST || '0.0.0.0',
    jwtSecret,
    storage,
    databaseUrl: env.DATABASE_URL,
    aiWorkers: int(env.AI_WORKERS, defaultWorkers), // 0 = la IA calcula en el hilo principal
    mcSamples: int(env.MC_SAMPLES, 20_000),          // muestras Monte Carlo por jugada de la IA experta
    mcMode: env.MC_MODE === 'message' ? 'message' : 'shared', // 'shared' = SharedArrayBuffer + Atomics, 'message' = postMessage
    aiAdaptive: env.AI_ADAPTIVE !== 'false',        // tareas baratas se calculan en el mismo hilo (granularidad adaptativa)
    parallelMinCost: int(env.PARALLEL_MIN_COST, 100_000), // costo (muestras × barcos) desde el cual se reparte; calibrar con `npm run calibrate`
    aiMaxQueue: int(env.AI_MAX_QUEUE, 0),            // 0 = automático; cola a partir de la cual se rechaza trabajo en vivo
    aiNodes: (env.AI_NODES ?? '').split(',').map((u) => u.trim()).filter(Boolean), // nodos de IA remotos (ver node-server.js)
    aiNodeToken: env.AI_NODE_TOKEN ?? '',
    maxRooms: int(env.MAX_ROOMS, 500),
    authPerMinute: int(env.AUTH_PER_MINUTE, 20),       // intentos de registro/login por IP y minuto (en un colegio, súbelo)
    quizPerMinute: int(env.QUIZ_PER_MINUTE, 60),       // cuestionarios corregidos por IP y minuto
    guestAiDaily: int(env.GUEST_AI_DAILY, 10),        // partidas diarias contra la IA para invitados (por IP); 0 = sin límite
    maxSpectators: int(env.MAX_SPECTATORS, 20),
    wsMessagesPerSecond: int(env.WS_MSGS_PER_SEC, 20), // protección contra inundación por conexión
    timing: {
      turnMs: int(env.TURN_SECONDS, 30) * 1000,           // 0 = sin límite
      placementMs: int(env.PLACEMENT_SECONDS, 90) * 1000, // 0 = sin límite
      graceMs: int(env.GRACE_SECONDS, 45) * 1000,         // tiempo para reconectar
      aiThinkMs: [int(env.AI_THINK_MIN_MS, 600), int(env.AI_THINK_MAX_MS, 1400)],
      idleMs: int(env.ROOM_IDLE_MINUTES, 30) * 60_000,
    },
  };
}
