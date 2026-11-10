import { randomUUID } from 'node:crypto';
import { MIN_RATING, START_RATING } from '../domain/scoring.js';

/** Quita el hash de la contraseña antes de entregar un usuario hacia afuera. */
export function toPublicUser(u) {
  if (!u) return null;
  const { passwordHash, usernameLower, ...rest } = u; // eslint-disable-line no-unused-vars
  return { ...rest };
}

/**
 * Almacén en memoria. Mismo contrato que prismaStore.js; se usa en pruebas, en desarrollo
 * rápido (sin base de datos) y como respaldo. Se pierde todo al reiniciar el servidor.
 */
export function createMemoryStore() {
  const users = new Map();   // id -> usuario
  const byEmail = new Map(); // email (en minúsculas) -> id
  const byName = new Map();  // usernameLower -> id
  const matches = [];
  const progress = new Map(); // userId -> Map("campaña:misión" -> fila)
  const unlocks = new Map();  // userId -> Map(achievementId -> fecha)
  const quiz = new Map();     // userId -> Map("campaña:misión" -> mejor resultado del cuestionario)

  return {
    kind: 'memory',

    async createUser({ email = null, username, passwordHash, avatar = '' }) {
      const emailKey = email == null ? null : String(email).trim().toLowerCase();
      if (email !== null && !emailKey) throw Object.assign(new Error('invalid_email'), { code: 'invalid_email' });
      const key = username.toLowerCase();
      if (emailKey && byEmail.has(emailKey)) throw Object.assign(new Error('email_taken'), { code: 'email_taken' });
      if (byName.has(key)) throw Object.assign(new Error('username_taken'), { code: 'username_taken' });
      const user = {
        id: randomUUID(), email: emailKey, username, usernameLower: key, passwordHash, avatar,
        points: 0, rating: START_RATING, wins: 0, losses: 0, gamesPlayed: 0, createdAt: new Date(),
      };
      users.set(user.id, user);
      if (emailKey) byEmail.set(emailKey, user.id);
      byName.set(key, user.id);
      return { ...user };
    },

    async findByEmail(email) {
      const key = String(email ?? '').trim().toLowerCase();
      if (!key) return null;
      const id = byEmail.get(key);
      return id ? { ...users.get(id) } : null;
    },

    async findByUsername(username) {
      const id = byName.get(String(username).toLowerCase());
      return id ? { ...users.get(id) } : null;
    },

    async findById(id) {
      const u = users.get(id);
      return u ? { ...u } : null;
    },

    async leaderboard(limit = 20) {
      return [...users.values()]
        .sort((a, b) => b.points - a.points || b.rating - a.rating || a.createdAt - b.createdAt)
        .slice(0, limit)
        .map((u, i) => ({
          rank: i + 1, id: u.id, username: u.username, avatar: u.avatar,
          points: u.points, rating: u.rating, wins: u.wins, losses: u.losses, gamesPlayed: u.gamesPlayed,
        }));
    },

    /**
     * Guarda la partida y actualiza a los jugadores con cuenta.
     * @returns {{A: object|null, B: object|null}} usuario actualizado por lado (null si no tiene cuenta)
     */
    async recordMatch(m) {
      const record = { id: randomUUID(), ...m, players: { A: { ...m.players.A }, B: { ...m.players.B } } };
      matches.push(record);
      const updated = { A: null, B: null };
      for (const side of ['A', 'B']) {
        const p = m.players[side];
        const u = p.userId ? users.get(p.userId) : null;
        if (!u) continue;
        const won = m.winnerSide === side;
        u.points += p.points;
        u.rating = Math.max(MIN_RATING, u.rating + p.ratingDelta);
        u.wins += won ? 1 : 0;
        u.losses += won ? 0 : 1;
        u.gamesPlayed += 1;
        updated[side] = toPublicUser(u);
      }
      return updated;
    },

    async recentMatches(userId, limit = 10) {
      return matches
        .filter((m) => ['A', 'B'].some((s) => m.players[s].userId === userId))
        .slice(-limit).reverse()
        .map((m) => ({ id: m.id, mode: m.mode, difficulty: m.difficulty ?? null, boardSize: m.size, endedAt: m.endedAt }));
    },

    // ---------------------------------------------------------------- campañas y logros
    async getCampaignProgress(userId) {
      return [...(progress.get(userId)?.values() ?? [])].map((r) => ({ ...r }));
    },

    /** Guarda el mejor resultado de una misión ganada (más estrellas; a igualdad, menos disparos). */
    async saveMissionResult(userId, { campaignId, missionId, stars, shots }) {
      const rows = progress.get(userId) ?? new Map();
      progress.set(userId, rows);
      const k = `${campaignId}:${missionId}`;
      const prev = rows.get(k);
      const row = {
        campaignId, missionId, stars: Math.max(stars, prev?.stars ?? 0), bestShots: Math.min(shots, prev?.bestShots ?? Infinity),
        updatedAt: new Date(),
      };
      rows.set(k, row);
      return { saved: true, improved: !prev || stars > prev.stars || shots < prev.bestShots, previousStars: prev?.stars ?? 0, bestShots: row.bestShots };
    },

    async getUnlocks(userId) {
      return [...(unlocks.get(userId) ?? [])].map(([achievementId, unlockedAt]) => ({ achievementId, unlockedAt }));
    },

    /** Desbloquea logros y devuelve solo los que eran nuevos. */
    async unlockAchievements(userId, ids) {
      const have = unlocks.get(userId) ?? new Map();
      unlocks.set(userId, have);
      const fresh = [...new Set(ids)].filter((id) => !have.has(id));
      for (const id of fresh) have.set(id, new Date());
      return fresh;
    },

    /** Mejor resultado del cuestionario de una misión (más aciertos) y número de intentos. */
    async saveQuizResult(userId, { campaignId, missionId, correct, total }) {
      const rows = quiz.get(userId) ?? new Map();
      quiz.set(userId, rows);
      const k = `${campaignId}:${missionId}`;
      const prev = rows.get(k);
      const row = { campaignId, missionId, bestCorrect: Math.max(correct, prev?.bestCorrect ?? 0), total, attempts: (prev?.attempts ?? 0) + 1, updatedAt: new Date() };
      rows.set(k, row);
      return { bestCorrect: row.bestCorrect, total, attempts: row.attempts, improved: !prev || correct > prev.bestCorrect };
    },

    async getQuizResults(userId) {
      return [...(quiz.get(userId)?.values() ?? [])].map((r) => ({ ...r }));
    },

    /** Datos acumulados de las partidas ganadas de una cuenta (para logros de variedad). */
    async achievementFacts(userId) {
      const won = matches.filter((m) => ['A', 'B'].some((s) => m.players[s].userId === userId && m.winnerSide === s));
      return {
        biomesWon: [...new Set(won.map((m) => m.biome ?? 'water'))],
        beatExpert: won.some((m) => m.mode === 'ai' && m.difficulty === 'expert'),
        won20: won.some((m) => m.size === 20),
      };
    },

    async close() {},
  };
}
