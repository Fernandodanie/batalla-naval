import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { api, Client, startServer } from './helpers.js';
import { seeded } from './seed.js';

async function account(srv, username) {
  const res = await api(srv, 'POST', '/api/auth/register', {
    body: { email: `${username}@ejemplo.com`, username, password: 'secreto123' },
  });
  assert.equal(res.status, 201);
  return res.body.token;
}

describe('misiones de campaña (servidor)', () => {
  let srv;
  before(async () => { srv = await startServer({ rng: seeded(77) }); });
  after(async () => { await srv.close(); });

  test('/api/campaigns es público y lista campañas y logros', async () => {
    const res = await api(srv, 'GET', '/api/campaigns');
    assert.equal(res.status, 200);
    assert.equal(res.body.campaigns.length, 4);
    assert.ok(res.body.achievements.length >= 15);
    assert.ok(res.body.campaigns[0].missions[0].objectives.length === 2);
  });

  test('/api/progress exige cuenta', async () => {
    assert.equal((await api(srv, 'GET', '/api/progress')).status, 401);
  });

  test('ganar una misión guarda estrellas, desbloquea la siguiente y otorga logros', async () => {
    const token = await account(srv, 'ana');
    const c = await Client.connect(srv, { auth: token });
    c.send({ t: 'mission', campaign: 'chaco', mission: 1 });
    const s0 = await c.untilState((s) => s.status === 'placing');
    assert.equal(s0.biome, 'jungle');
    assert.equal(s0.size, 8);
    assert.equal(s0.difficulty, 'easy');
    assert.equal(s0.mode, 'ai');
    assert.equal(s0.isPublic, false);
    assert.equal(s0.mission.title, 'Boquerón');
    assert.equal(s0.mission.next, 2);
    assert.equal(s0.mission.objectives.length, 3);

    const end = await c.autoPlay('hard', 20_000);
    assert.equal(end.game.winner, 'A');
    const done = await c.untilState((s) => s.result?.mission?.saved === true, 8000);
    assert.ok(done.result.mission.stars >= 1);
    assert.equal(done.result.mission.missionId, 1);
    assert.ok(done.result.newAchievements.A.some((a) => a.id === 'first_mission'));
    assert.ok(done.result.newAchievements.A.some((a) => a.id === 'hist_boqueron'));

    const progress = await api(srv, 'GET', '/api/progress', { token });
    assert.equal(progress.status, 200);
    assert.equal(progress.body.missions.length, 1);
    assert.equal(progress.body.missions[0].campaignId, 'chaco');
    assert.ok(progress.body.missions[0].bestShots > 0);
    assert.ok(progress.body.achievements.some((a) => a.id === 'first_mission'));
    c.send({ t: 'leave' });
    await c.waitFor((m) => m.t === 'left');

    // La misión 2 ya está abierta; la 3 sigue bloqueada.
    c.send({ t: 'mission', campaign: 'chaco', mission: 3 });
    await c.expectError('mision_bloqueada');
    c.send({ t: 'mission', campaign: 'chaco', mission: 2 });
    const s2 = await c.untilState((s) => s.status === 'placing');
    assert.equal(s2.size, 10);
    assert.equal(s2.mission.missionId, 2);
    c.close();
  });

  test('el progreso es distinto en cada campaña: la misión 2 de otra campaña sigue bloqueada', async () => {
    const token = await account(srv, 'beto');
    const c = await Client.connect(srv, { auth: token });
    c.send({ t: 'mission', campaign: 'corso', mission: 2 });
    await c.expectError('mision_bloqueada');
    c.close();
  });

  test('misiones y campañas inexistentes se rechazan', async () => {
    const c = await Client.connect(srv);
    c.send({ t: 'mission', campaign: 'luna', mission: 1 });
    await c.expectError('mision_no_existe');
    c.send({ t: 'mission', campaign: 'chaco', mission: 40 });
    await c.expectError('mision_no_existe');
    c.send({ t: 'mission', campaign: 'chaco', mission: 0 });
    await c.expectError('formato');
    c.close();
  });

  test('un invitado puede probar la primera misión (se ven las estrellas pero no se guardan) y no las demás', async () => {
    const g = await Client.connect(srv);
    g.send({ t: 'mission', campaign: 'litoral', mission: 2 });
    await g.expectError('requiere_cuenta');
    g.send({ t: 'mission', campaign: 'litoral', mission: 1, name: 'Invitada' });
    await g.untilState((s) => s.status === 'placing');
    const end = await g.autoPlay('hard', 20_000);
    assert.equal(end.game.winner, 'A');
    assert.ok(end.result.mission.stars >= 1, 'el invitado ve sus estrellas');
    assert.equal(end.result.mission.saved, false);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(g.state.result.mission.saved, false, 'nada se guarda sin cuenta');
    g.close();
  });

  test('perder una misión no guarda progreso', async () => {
    const token = await account(srv, 'carla');
    const c = await Client.connect(srv, { auth: token });
    c.send({ t: 'mission', campaign: 'corso', mission: 1 });
    await c.untilState((s) => s.status === 'placing');
    c.send({ t: 'leave' }); // abandonar = perder
    await c.waitFor((m) => m.t === 'left');
    await new Promise((r) => setTimeout(r, 200));
    const progress = await api(srv, 'GET', '/api/progress', { token });
    assert.deepEqual(progress.body.missions, []);
    c.close();
  });

  test('los logros también salen de partidas normales (20×20 y escenarios)', async () => {
    const token = await account(srv, 'dora');
    const c = await Client.connect(srv, { auth: token });
    c.send({ t: 'create', mode: 'ai', size: 20, biome: 'land', difficulty: 'easy' });
    await c.untilState((s) => s.status === 'placing');
    const end = await c.autoPlay('hard', 30_000);
    assert.equal(end.game.winner, 'A');
    const done = await c.untilState((s) => (s.result?.newAchievements?.A?.length ?? 0) > 0, 8000);
    assert.ok(done.result.newAchievements.A.some((a) => a.id === 'win_20'));
    c.close();
  });
});

describe('cupo diario de invitados (servidor)', () => {
  let srv;
  before(async () => { srv = await startServer({ rng: seeded(78), guestAiDaily: 2 }); });
  after(async () => { await srv.close(); });

  test('el invitado agota su cupo contra la IA; las salas con personas y las cuentas no se limitan', async () => {
    const q0 = await api(srv, 'GET', '/api/quota');
    assert.deepEqual(q0.body, { limit: 2, left: 2 });

    const g = await Client.connect(srv);
    for (let i = 0; i < 2; i++) {
      g.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy', name: 'Ana' });
      await g.untilState((s) => s.status === 'placing');
      g.send({ t: 'leave' });
      await g.waitFor((m) => m.t === 'left');
    }
    g.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy', name: 'Ana' });
    await g.expectError('limite_invitado');
    g.send({ t: 'mission', campaign: 'chaco', mission: 1 });
    await g.expectError('limite_invitado');
    assert.equal((await api(srv, 'GET', '/api/quota')).body.left, 0);

    g.send({ t: 'create', mode: 'pvp', size: 8, name: 'Ana' });
    const s = await g.untilState((x) => x.status === 'waiting');
    assert.equal(s.mode, 'pvp', 'jugar con amigos sigue libre');
    g.send({ t: 'leave' });
    await g.waitFor((m) => m.t === 'left');
    g.close();

    const token = (await api(srv, 'POST', '/api/auth/register', { body: { email: 'eva@ejemplo.com', username: 'eva', password: 'secreto123' } })).body.token;
    const acc = await Client.connect(srv, { auth: token });
    acc.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy' });
    await acc.untilState((x) => x.status === 'placing');
    acc.close();
  });

  test('la revancha contra la IA también gasta cupo', async () => {
    const srv2 = await startServer({ rng: seeded(79), guestAiDaily: 2 });
    try {
      const g = await Client.connect(srv2);
      g.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy', name: 'Ana' });
      await g.untilState((s) => s.status === 'placing');
      await g.autoPlay('hard', 20_000);
      g.send({ t: 'rematch' });
      await g.untilState((s) => s.status === 'placing' && s.round === 2);
      await g.autoPlay('hard', 20_000);
      g.send({ t: 'rematch' });
      await g.expectError('limite_invitado');
      g.close();
    } finally { await srv2.close(); }
  });
});
