import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Contrato que debe cumplir CUALQUIER almacén (memoria o Prisma).
 * Se ejecuta contra el de memoria siempre y contra Prisma cuando hay DATABASE_URL.
 * @param {string} name
 * @param {() => Promise<object>} makeStore  crea un almacén limpio
 * @param {{skip?: string|false}} [opts]
 */
export function storeContract(name, makeStore, opts = {}) {
  const t = (title, fn) => test(`[${name}] ${title}`, { skip: opts.skip }, async () => {
    const store = await makeStore();
    try { await fn(store); } finally { await store.close(); }
  });

  const player = (userId, extra = {}) => ({ userId, name: 'x', isAi: false, shots: 30, hits: 17, points: 0, ratingDelta: 0, ...extra });
  const match = (players, over = {}) => ({
    mode: 'pvp', difficulty: 'normal', size: 10, winnerSide: 'A', reason: 'flota_hundida', ranked: true,
    startedAt: new Date(Date.now() - 60_000), endedAt: new Date(), players, ...over,
  });

  t('crea usuarios, normaliza el correo a minúsculas y no permite repetir correo ni nombre', async (store) => {
    const u = await store.createUser({ email: '  Ana@Ejemplo.COM ', username: 'Ana', passwordHash: 'h', avatar: '⚓' });
    assert.equal(u.email, 'ana@ejemplo.com');
    assert.equal(u.points, 0);
    assert.equal(u.rating, 1000);
    await assert.rejects(store.createUser({ email: 'ANA@ejemplo.com', username: 'Otra', passwordHash: 'h' }), { code: 'email_taken' });
    await assert.rejects(store.createUser({ email: 'otra@ejemplo.com', username: 'ana', passwordHash: 'h' }), { code: 'username_taken' });
    assert.equal((await store.findByEmail('  ANA@EJEMPLO.COM ')).id, u.id);
    assert.equal((await store.findByUsername('ANA')).id, u.id);
    assert.equal((await store.findById(u.id)).username, 'Ana');
    assert.equal(await store.findByEmail('nadie@ejemplo.com'), null);
    assert.equal(await store.findByEmail(''), null);
    assert.equal(await store.findByUsername('nadie'), null);
  });

  t('las cuentas previas sin correo (email null) siguen funcionando sin chocar entre sí', async (store) => {
    const v1 = await store.createUser({ email: null, username: 'vieja1', passwordHash: 'h' });
    const v2 = await store.createUser({ email: null, username: 'vieja2', passwordHash: 'h' });
    assert.equal(v1.email, null);
    assert.equal(v2.email, null);
    assert.equal(await store.findByEmail(null), null);
    assert.equal((await store.findById(v1.id)).username, 'vieja1');
  });

  t('recordMatch suma puntos, Elo y victorias/derrotas', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    const b = await store.createUser({ username: 'beto', passwordHash: 'h' });
    const out = await store.recordMatch(match({
      A: player(a.id, { points: 150, ratingDelta: 16 }),
      B: player(b.id, { points: 25, ratingDelta: -16 }),
    }));
    assert.equal(out.A.points, 150);
    assert.equal(out.A.rating, 1016);
    assert.equal(out.A.wins, 1);
    assert.equal(out.B.losses, 1);
    assert.equal(out.B.rating, 984);
    assert.equal((await store.findById(a.id)).gamesPlayed, 1);
  });

  t('recordMatch contra invitado o IA solo actualiza a quien tiene cuenta', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    const out = await store.recordMatch(match({
      A: player(a.id, { points: 80 }),
      B: player(null, { isAi: true, name: 'IA' }),
    }, { mode: 'ai', ranked: false }));
    assert.equal(out.B, null);
    assert.equal(out.A.points, 80);
    assert.equal(out.A.rating, 1000);
  });

  t('el rating nunca baja del mínimo', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    for (let i = 0; i < 3; i++) {
      await store.recordMatch(match({ A: player(null, { name: 'z' }), B: player(a.id, { ratingDelta: -500 }) }));
    }
    assert.equal((await store.findById(a.id)).rating, 100);
  });

  t('leaderboard ordena por puntos y numera', async (store) => {
    const names = ['uno', 'dos', 'tres'];
    const users = [];
    for (const n of names) users.push(await store.createUser({ username: n, passwordHash: 'h' }));
    await store.recordMatch(match({ A: player(users[1].id, { points: 300 }), B: player(users[2].id, { points: 25 }) }));
    const board = await store.leaderboard(10);
    assert.deepEqual(board.map((p) => p.username), ['dos', 'tres', 'uno']);
    assert.deepEqual(board.map((p) => p.rank), [1, 2, 3]);
    assert.equal((await store.leaderboard(2)).length, 2);
    assert.equal('passwordHash' in board[0], false);
  });

  t('recentMatches devuelve las partidas del usuario, la última primero', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    await store.recordMatch(match({ A: player(a.id, { points: 1 }), B: player(null) }, { size: 8 }));
    await store.recordMatch(match({ A: player(a.id, { points: 1 }), B: player(null) }, { size: 12 }));
    const recent = await store.recentMatches(a.id, 5);
    assert.equal(recent.length, 2);
    assert.equal(recent[0].boardSize, 12);
  });

  t('guarda el mejor resultado de cada misión (más estrellas, menos disparos)', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    assert.deepEqual(await store.getCampaignProgress(a.id), []);
    const first = await store.saveMissionResult(a.id, { campaignId: 'chaco', missionId: 1, stars: 2, shots: 40 });
    assert.equal(first.improved, true);
    assert.equal(first.previousStars, 0);
    const worse = await store.saveMissionResult(a.id, { campaignId: 'chaco', missionId: 1, stars: 1, shots: 55 });
    assert.equal(worse.improved, false);
    assert.equal(worse.bestShots, 40, 'una marca peor no pisa la mejor');
    const better = await store.saveMissionResult(a.id, { campaignId: 'chaco', missionId: 1, stars: 3, shots: 35 });
    assert.equal(better.improved, true);
    assert.equal(better.previousStars, 2);
    await store.saveMissionResult(a.id, { campaignId: 'chaco', missionId: 2, stars: 1, shots: 60 });
    const rows = await store.getCampaignProgress(a.id);
    assert.equal(rows.length, 2);
    const m1 = rows.find((r) => r.missionId === 1);
    assert.equal(m1.stars, 3);
    assert.equal(m1.bestShots, 35);
    assert.ok(m1.updatedAt);
  });

  t('el progreso es por cuenta', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    const b = await store.createUser({ username: 'beto', passwordHash: 'h' });
    await store.saveMissionResult(a.id, { campaignId: 'corso', missionId: 1, stars: 1, shots: 50 });
    assert.equal((await store.getCampaignProgress(b.id)).length, 0);
  });

  t('los logros se desbloquean una sola vez y se devuelven solo los nuevos', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    assert.deepEqual(await store.unlockAchievements(a.id, ['perfect', 'win_20']), ['perfect', 'win_20']);
    assert.deepEqual(await store.unlockAchievements(a.id, ['perfect', 'beat_expert', 'beat_expert']), ['beat_expert']);
    assert.deepEqual(await store.unlockAchievements(a.id, []), []);
    const got = await store.getUnlocks(a.id);
    assert.deepEqual(got.map((u) => u.achievementId).sort(), ['beat_expert', 'perfect', 'win_20']);
    assert.ok(got[0].unlockedAt);
  });

  t('resultados del cuestionario: guarda el mejor, cuenta intentos y es por cuenta', async (store) => {
    const a = await store.createUser({ username: 'quiz_a', passwordHash: 'x' });
    const b = await store.createUser({ username: 'quiz_b', passwordHash: 'x' });
    assert.deepEqual(await store.getQuizResults(a.id), []);
    const r1 = await store.saveQuizResult(a.id, { campaignId: 'chaco', missionId: 1, correct: 1, total: 2 });
    assert.deepEqual([r1.bestCorrect, r1.total, r1.attempts, r1.improved], [1, 2, 1, true]);
    const r2 = await store.saveQuizResult(a.id, { campaignId: 'chaco', missionId: 1, correct: 0, total: 2 });
    assert.deepEqual([r2.bestCorrect, r2.attempts, r2.improved], [1, 2, false], 'un peor resultado no baja el mejor');
    const r3 = await store.saveQuizResult(a.id, { campaignId: 'chaco', missionId: 1, correct: 2, total: 2 });
    assert.deepEqual([r3.bestCorrect, r3.attempts, r3.improved], [2, 3, true]);
    await store.saveQuizResult(a.id, { campaignId: 'siglo19', missionId: 2, correct: 2, total: 2 });
    const rows = await store.getQuizResults(a.id);
    assert.deepEqual(rows.map((r) => `${r.campaignId}:${r.missionId}:${r.bestCorrect}/${r.total}:${r.attempts}`).sort(), ['chaco:1:2/2:3', 'siglo19:2:2/2:1']);
    assert.deepEqual(await store.getQuizResults(b.id), [], 'los resultados son de cada cuenta');
  });

  t('achievementFacts resume escenarios ganados, IA experta y 20×20', async (store) => {
    const a = await store.createUser({ username: 'ana', passwordHash: 'h' });
    assert.deepEqual(await store.achievementFacts(a.id), { biomesWon: [], beatExpert: false, won20: false });
    await store.recordMatch(match({ A: player(a.id), B: player(null, { isAi: true }) }, { mode: 'ai', difficulty: 'expert', size: 20, biome: 'jungle' }));
    await store.recordMatch(match({ A: player(a.id), B: player(null, { isAi: true }) }, { mode: 'ai', difficulty: 'easy', size: 8, biome: 'land' }));
    await store.recordMatch(match({ A: player(null, { isAi: true }), B: player(a.id) }, { mode: 'ai', difficulty: 'easy', size: 8, biome: 'water' })); // perdió
    const f = await store.achievementFacts(a.id);
    assert.deepEqual([...f.biomesWon].sort(), ['jungle', 'land']);
    assert.equal(f.beatExpert, true);
    assert.equal(f.won20, true);
  });
}
