import http from 'node:http';
import express from 'express';
import { ZodError } from 'zod';
import { DistributedPool } from './ai/distributed.js';
import { AiPool } from './ai/pool.js';
import { createMetrics } from './metrics.js';
import { createGuestQuota } from './http/quota.js';
import { createProgress } from './services/progress.js';
import { loadConfig } from './config.js';
import { buildRouter } from './http/routes.js';
import { attachGateway } from './realtime/gateway.js';
import { RoomManager } from './realtime/roomManager.js';
import { createStore } from './repositories/index.js';
import { AUTH_MESSAGES, AuthError, createAuth } from './services/auth.js';

const CSP = "default-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'";
const KNOWN_ZOD_CODES = new Set(['correo_invalido', 'usuario_invalido', 'password_corta', 'password_larga', 'avatar_invalido']);

/**
 * Arma el servidor completo (HTTP + WebSocket). Todo se puede inyectar para las pruebas:
 * config, store, pool, rng, log.
 */
export async function createApp(options = {}) {
  const config = options.config ?? loadConfig();
  const log = options.log ?? (() => {});
  const store = options.store ?? (await createStore(config));
  const poolOptions = {
    mcSamples: config.mcSamples, mcMode: config.mcMode,
    adaptive: config.aiAdaptive, minParallelCost: config.parallelMinCost, maxQueue: config.aiMaxQueue || undefined,
  };
  // Con AI_NODES la IA se calcula en nodos remotos (con un pool local de respaldo); si no, en hilos locales.
  const pool = options.pool ?? (config.aiNodes.length
    ? new DistributedPool({
      nodes: config.aiNodes, token: config.aiNodeToken, ...poolOptions,
      fallback: new AiPool({ size: config.aiWorkers, ...poolOptions }),
    })
    : new AiPool({ size: config.aiWorkers, ...poolOptions }));
  const auth = createAuth({ store, secret: config.jwtSecret, rounds: options.bcryptRounds ?? 10 });
  const metrics = createMetrics();
  const quota = options.quota ?? createGuestQuota({ limit: config.guestAiDaily });
  const progress = createProgress({ store, log });
  const manager = new RoomManager({ config, store, pool, progress, quota, log, rng: options.rng });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detrás de nginx / un proxy: req.ip es la IP real
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
    next();
  });
  app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));
  app.use('/api', express.json({ limit: '4kb' }), buildRouter({ auth, store, manager, pool, config, metrics, progress, quota }));

  if (config.staticDir) {
    app.use(express.static(config.staticDir, {
      setHeaders: (res) => res.set({ 'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP }),
    }));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ZodError) {
      const msg = err.issues[0]?.message;
      const code = KNOWN_ZOD_CODES.has(msg) ? msg : 'datos_invalidos';
      return res.status(400).json({ error: code, message: AUTH_MESSAGES[code] ?? 'Revisa los datos ingresados.' });
    }
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'json_invalido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'muy_grande' });
    log(`error HTTP: ${err.stack ?? err}`);
    return res.status(500).json({ error: 'error_interno' });
  });

  const server = http.createServer(app);
  const gateway = attachGateway({ server, manager, auth, quota, progress, log, maxPerSecond: config.wsMessagesPerSecond });

  return {
    app, server, config, store, pool, auth, manager, gateway, metrics, quota, progress,
    async close() {
      manager.close();
      await gateway.close();
      if (server.closeAllConnections) server.closeAllConnections();
      await new Promise((resolve) => server.close(() => resolve()));
      metrics.close();
      if (!options.quota) quota.close();
      if (!options.pool) await pool.close();
      if (!options.store) await store.close();
    },
  };
}
