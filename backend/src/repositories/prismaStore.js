import { MIN_RATING } from '../domain/scoring.js';
import { toPublicUser } from './memoryStore.js';

/**
 * Almacén real sobre PostgreSQL con Prisma. Implementa el mismo contrato que memoryStore.js
 * (ver test/store.contract.js, que se puede ejecutar contra esta clase con DATABASE_URL).
 */
export async function createPrismaStore(databaseUrl) {
  // Import dinámico: así el modo "memory" funciona aunque el cliente de Prisma no esté generado.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);
  await prisma.$connect();

  const select = {
    id: true, email: true, username: true, avatar: true, points: true, rating: true,
    wins: true, losses: true, gamesPlayed: true, createdAt: true,
  };

  return {
    kind: 'prisma',
    prisma,

    async createUser({ email = null, username, passwordHash, avatar = '' }) {
      const emailKey = email == null ? null : String(email).trim().toLowerCase();
      if (email !== null && !emailKey) throw Object.assign(new Error('invalid_email'), { code: 'invalid_email' });
      try {
        return await prisma.user.create({
          data: { email: emailKey, username, usernameLower: username.toLowerCase(), passwordHash, avatar },
        });
      } catch (err) {
        if (err?.code === 'P2002') {
          const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target ?? '');
          if (target.includes('email') || (emailKey && await prisma.user.findUnique({ where: { email: emailKey } }))) {
            throw Object.assign(new Error('email_taken'), { code: 'email_taken' });
          }
          throw Object.assign(new Error('username_taken'), { code: 'username_taken' });
        }
        throw err;
      }
    },

    findByEmail(email) {
      const key = String(email ?? '').trim().toLowerCase();
      if (!key) return Promise.resolve(null);
      return prisma.user.findUnique({ where: { email: key } });
    },

    findByUsername(username) {
      return prisma.user.findUnique({ where: { usernameLower: String(username).toLowerCase() } });
    },

    findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },

    async leaderboard(limit = 20) {
      const rows = await prisma.user.findMany({
        orderBy: [{ points: 'desc' }, { rating: 'desc' }, { createdAt: 'asc' }],
        take: limit,
        select,
      });
      return rows.map((u, i) => ({
        rank: i + 1, id: u.id, username: u.username, avatar: u.avatar, points: u.points,
        rating: u.rating, wins: u.wins, losses: u.losses, gamesPlayed: u.gamesPlayed,
      }));
    },

    async recordMatch(m) {
      return prisma.$transaction(async (tx) => {
        await tx.match.create({
          data: {
            mode: m.mode === 'pvp' ? 'PVP' : 'AI',
            difficulty: m.mode === 'ai' ? m.difficulty : null,
            boardSize: m.size,
            biome: m.biome ?? 'water',
            winnerSide: m.winnerSide,
            reason: m.reason ?? 'flota_hundida',
            ranked: Boolean(m.ranked),
            startedAt: m.startedAt,
            endedAt: m.endedAt,
            players: {
              create: ['A', 'B'].map((side) => {
                const p = m.players[side];
                return {
                  side, userId: p.userId ?? null, displayName: p.name, isAi: Boolean(p.isAi),
                  won: m.winnerSide === side, shots: p.shots, hits: p.hits,
                  points: p.points, ratingDelta: p.ratingDelta,
                };
              }),
            },
          },
        });

        const updated = { A: null, B: null };
        for (const side of ['A', 'B']) {
          const p = m.players[side];
          if (!p.userId) continue;
          const won = m.winnerSide === side;
          // Incrementos atómicos: dos partidas simultáneas del mismo usuario no se pisan.
          let user = await tx.user.update({
            where: { id: p.userId },
            data: {
              points: { increment: p.points },
              rating: { increment: p.ratingDelta },
              wins: { increment: won ? 1 : 0 },
              losses: { increment: won ? 0 : 1 },
              gamesPlayed: { increment: 1 },
            },
            select,
          });
          if (user.rating < MIN_RATING) {
            user = await tx.user.update({ where: { id: p.userId }, data: { rating: MIN_RATING }, select });
          }
          updated[side] = toPublicUser(user);
        }
        return updated;
      });
    },

    async recentMatches(userId, limit = 10) {
      const rows = await prisma.matchPlayer.findMany({
        where: { userId },
        orderBy: { match: { endedAt: 'desc' } },
        take: limit,
        include: { match: true },
      });
      return rows.map(({ match }) => ({
        id: match.id, mode: match.mode.toLowerCase(), difficulty: match.difficulty,
        boardSize: match.boardSize, endedAt: match.endedAt,
      }));
    },

    // ---------------------------------------------------------------- campañas y logros
    getCampaignProgress(userId) {
      return prisma.campaignProgress.findMany({ where: { userId }, select: { campaignId: true, missionId: true, stars: true, bestShots: true, updatedAt: true } });
    },

    /** Guarda el mejor resultado de una misión ganada (más estrellas; a igualdad, menos disparos). */
    async saveMissionResult(userId, { campaignId, missionId, stars, shots }) {
      return prisma.$transaction(async (tx) => {
        const where = { userId_campaignId_missionId: { userId, campaignId, missionId } };
        const prev = await tx.campaignProgress.findUnique({ where });
        const row = { stars: Math.max(stars, prev?.stars ?? 0), bestShots: Math.min(shots, prev?.bestShots ?? Number.MAX_SAFE_INTEGER) };
        await tx.campaignProgress.upsert({ where, create: { userId, campaignId, missionId, ...row }, update: row });
        return { saved: true, improved: !prev || stars > prev.stars || shots < prev.bestShots, previousStars: prev?.stars ?? 0, bestShots: row.bestShots };
      });
    },

    /** Mejor resultado del cuestionario de una misión (más aciertos) y número de intentos. */
    async saveQuizResult(userId, { campaignId, missionId, correct, total }) {
      return prisma.$transaction(async (tx) => {
        const where = { userId_campaignId_missionId: { userId, campaignId, missionId } };
        const prev = await tx.quizResult.findUnique({ where });
        const bestCorrect = Math.max(correct, prev?.bestCorrect ?? 0);
        const attempts = (prev?.attempts ?? 0) + 1;
        await tx.quizResult.upsert({
          where,
          create: { userId, campaignId, missionId, bestCorrect, total, attempts },
          update: { bestCorrect, total, attempts },
        });
        return { bestCorrect, total, attempts, improved: !prev || correct > prev.bestCorrect };
      });
    },

    getQuizResults(userId) {
      return prisma.quizResult.findMany({ where: { userId }, select: { campaignId: true, missionId: true, bestCorrect: true, total: true, attempts: true, updatedAt: true } });
    },

    getUnlocks(userId) {
      return prisma.achievementUnlock.findMany({ where: { userId }, select: { achievementId: true, unlockedAt: true } });
    },

    /** Desbloquea logros y devuelve solo los que eran nuevos. */
    async unlockAchievements(userId, ids) {
      const wanted = [...new Set(ids)];
      if (!wanted.length) return [];
      return prisma.$transaction(async (tx) => {
        const have = new Set((await tx.achievementUnlock.findMany({ where: { userId, achievementId: { in: wanted } }, select: { achievementId: true } })).map((r) => r.achievementId));
        const fresh = wanted.filter((id) => !have.has(id));
        if (fresh.length) await tx.achievementUnlock.createMany({ data: fresh.map((achievementId) => ({ userId, achievementId })), skipDuplicates: true });
        return fresh;
      });
    },

    /** Datos acumulados de las partidas ganadas de una cuenta (para logros de variedad). */
    async achievementFacts(userId) {
      const where = { userId, won: true };
      const [biomes, expert, big] = await Promise.all([
        prisma.match.findMany({ where: { players: { some: where } }, distinct: ['biome'], select: { biome: true } }),
        prisma.match.count({ where: { mode: 'AI', difficulty: 'expert', players: { some: where } } }),
        prisma.match.count({ where: { boardSize: 20, players: { some: where } } }),
      ]);
      return { biomesWon: biomes.map((b) => b.biome), beatExpert: expert > 0, won20: big > 0 };
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
