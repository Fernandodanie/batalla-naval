import { prometheusText } from '../metrics.js';
import { Router } from 'express';
import { DIFFICULTIES } from '../ai/strategies.js';
import { publicAchievements } from '../domain/achievements.js';
import { publicCampaigns } from '../domain/campaigns.js';
import { publicLaminas } from '../domain/laminas.js';
import { QuizError } from '../domain/quiz.js';
import { BIOMES, BOARD_SIZES, fleetFor } from '../domain/fleet.js';
import { AVATARS, REACTIONS } from '../domain/profile.js';
import { rateLimit } from './rateLimit.js';

export function buildRouter({ auth, store, manager, pool, config, metrics, progress, quota }) {
  const router = Router();
  // Límites por IP y minuto. En un colegio muchas personas comparten IP: sube AUTH_PER_MINUTE (README → «Uso en clase»).
  const authLimit = rateLimit({ windowMs: 60_000, max: config.production ? config.authPerMinute : 200 });
  const quizLimit = rateLimit({ windowMs: 60_000, max: config.production ? config.quizPerMinute : 600 });

  const bearer = async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const user = header.startsWith('Bearer ') ? await auth.userFromToken(header.slice(7)) : null;
    if (!user) return res.status(401).json({ error: 'no_autorizado' });
    req.user = user;
    next();
  };

  // Igual que `bearer`, pero un invitado también puede pasar (sin guardar nada).
  const optionalBearer = async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    req.user = header.startsWith('Bearer ') ? await auth.userFromToken(header.slice(7)) : null;
    next();
  };

  // Datos que el frontend necesita para armar sus pantallas (una sola fuente de verdad).
  router.get('/meta', (req, res) => {
    res.json({
      boardSizes: Object.entries(BOARD_SIZES).map(([size, { label }]) => ({
        size: Number(size), label, fleet: fleetFor(Number(size)),
      })),
      biomes: Object.entries(BIOMES).map(([id, { label, terrain, unit }]) => ({ id, label, terrain, unit })),
      difficulties: DIFFICULTIES,
      avatars: AVATARS,
      reactions: REACTIONS,
      turnSeconds: config.timing.turnMs / 1000,
      placementSeconds: config.timing.placementMs / 1000,
      guestAiDaily: config.guestAiDaily,
    });
  });

  // Catálogo de campañas (misiones, objetivos, textos) y de logros. Es público: no depende de la cuenta.
  router.get('/campaigns', (req, res) => res.json({ campaigns: publicCampaigns(), achievements: publicAchievements(), laminas: publicLaminas() }));

  // Corrección de las preguntas del modo aula (el catálogo no trae las respuestas).
  router.post('/quiz', quizLimit, optionalBearer, async (req, res) => {
    const { campaignId, missionId, answers } = req.body ?? {};
    if (typeof campaignId !== 'string' || !Number.isInteger(missionId)) return res.status(400).json({ error: 'datos_invalidos' });
    try {
      res.json(await progress.answerQuiz({ userId: req.user?.id ?? null, campaignId, missionId, answers }));
    } catch (err) {
      if (err instanceof QuizError) return res.status(400).json({ error: err.code });
      throw err;
    }
  });

  // Progreso de la cuenta: estrellas por misión, mejor marca y logros desbloqueados.
  router.get('/progress', bearer, async (req, res) => res.json(await progress.overview(req.user.id)));

  // Cuántas partidas contra la IA le quedan hoy a quien consulta (solo cuenta para invitados).
  router.get('/quota', (req, res) => res.json({ limit: config.guestAiDaily, left: quota.left(req.ip) }));

  router.post('/auth/register', authLimit, async (req, res) => res.status(201).json(await auth.register(req.body)));
  router.post('/auth/login', authLimit, async (req, res) => res.json(await auth.login(req.body)));
  router.get('/me', bearer, async (req, res) => {
    res.json({ user: req.user, recent: await store.recentMatches(req.user.id, 10) });
  });

  router.get('/leaderboard', async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    res.json({ players: await store.leaderboard(limit) });
  });

  router.get('/rooms', (req, res) => res.json({ rooms: manager.listPublic() }));

  router.get('/status', (req, res) => {
    res.json({
      ...manager.counts(), ai: pool.stats(), eventLoop: metrics.snapshot(),
      storage: store.kind, uptime: Math.round(process.uptime()),
    });
  });

  // Métricas en formato Prometheus (para Grafana). Solo números agregados: no hay datos de personas.
  router.get('/metrics', (req, res) => {
    res.type('text/plain; version=0.0.4').send(prometheusText({
      counts: manager.counts(), ai: pool.stats(), eventLoop: metrics.snapshot(), uptime: Math.round(process.uptime()),
    }));
  });

  router.use((req, res) => res.status(404).json({ error: 'no_encontrado' }));
  return router;
}
