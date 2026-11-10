import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { api, Client, startServer } from './helpers.js';
import { seeded } from './seed.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('partida contra la IA experta (Monte Carlo repartido entre hilos)', () => {
  for (const mcMode of ['shared', 'message']) {
    test(`partida completa 10×10 con 2 hilos, modo ${mcMode}`, async () => {
      const srv = await startServer({ rng: seeded(21), aiWorkers: 2, mcMode });
      try {
        const c = await Client.connect(srv);
        c.send({ t: 'create', mode: 'ai', size: 10, difficulty: 'expert', name: 'Ana' });
        await c.untilState((s) => s.status === 'placing');
        const end = await c.autoPlay('hard', 30_000);
        assert.equal(end.status, 'over');
        assert.ok(srv.pool.stats().completed > 0, 'los hilos calcularon jugadas');
        assert.equal(srv.pool.stats().mcMode, mcMode);
        c.close();
      } finally { await srv.close(); }
    });
  }
});

describe('partida contra la IA', () => {
  let srv;
  before(async () => { srv = await startServer({ rng: seeded(11) }); });
  after(async () => { await srv.close(); });

  for (const [size, difficulty] of [[8, 'easy'], [10, 'hard'], [20, 'normal']]) {
    test(`partida completa ${size}×${size} contra IA ${difficulty}`, async () => {
      const c = await Client.connect(srv);
      c.send({ t: 'create', mode: 'ai', size, difficulty, name: 'Ana' });
      const s0 = await c.untilState((s) => s.status === 'placing');
      assert.equal(s0.mode, 'ai');
      assert.equal(s0.players.B.isAi, true);
      assert.equal(s0.players.B.ready, true, 'la IA ya colocó su flota');
      assert.equal(s0.game.boards.B.ships, null, 'no se ven los barcos de la IA');

      const end = await c.autoPlay('hard');
      assert.equal(end.status, 'over');
      assert.ok(['A', 'B'].includes(end.game.winner));
      assert.ok(end.game.boards.B.ships, 'al final se revelan los barcos del rival');
      assert.ok(end.result.points.A >= 0);
      c.close();
    });
  }

  test('revancha contra la IA: alterna quién abre y acumula el marcador', async () => {
    const c = await Client.connect(srv);
    c.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy' });
    const end1 = await c.untilState((s) => s.status === 'placing');
    const starter1 = end1.game.turn ?? null;
    const over1 = await c.autoPlay();
    c.send({ t: 'rematch' });
    const s2 = await c.untilState((s) => s.round === 2 && s.status === 'placing');
    assert.equal(s2.rematch.A, false);
    const over2 = await c.autoPlay();
    assert.equal(over2.wins.A + over2.wins.B, 2);
    assert.equal(over1.round, 1);
    assert.ok(starter1 === null);
    c.close();
  });

  test('abandonar una partida contra la IA cuenta como derrota para el usuario registrado', async () => {
    const reg = await api(srv, 'POST', '/api/auth/register', { body: { email: 'huidizo@ejemplo.com', username: 'Huidizo', password: 'secreto123' } });
    const c = await Client.connect(srv, { auth: reg.body.token });
    c.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy' });
    await c.untilState((s) => s.status === 'placing');
    c.send({ t: 'leave' });
    await c.waitFor((m) => m.t === 'left');
    await sleep(50);
    const me = await api(srv, 'GET', '/api/me', { token: reg.body.token });
    assert.equal(me.body.user.losses, 1);
    assert.equal(me.body.user.points, 0);
    c.close();
  });

  test('los puntos se guardan en la cuenta al ganar y salen en el estado final', async () => {
    const reg = await api(srv, 'POST', '/api/auth/register', { body: { email: 'ganador@ejemplo.com', username: 'Ganador', password: 'secreto123' } });
    const c = await Client.connect(srv, { auth: reg.body.token });
    c.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy' });
    const end = await c.autoPlay('hard');
    const settled = await c.untilState((s) => s.status === 'over' && s.result?.after?.A);
    assert.equal(settled.result.after.A.gamesPlayed, 1);
    assert.equal(settled.result.after.A.points, settled.result.points.A);
    const board = await api(srv, 'GET', '/api/leaderboard');
    assert.ok(board.body.players.some((p) => p.username === 'Ganador'));
    assert.equal(end.you, 'A');
    c.close();
  });
});


describe('regla de disparo adicional en campañas', () => {
  test('acertar conserva el turno en una misión y fallar lo entrega a la IA', async () => {
    const srv = await startServer({ rng: seeded(41), timing: { aiThinkMs: [1000, 1000] } });
    const c = await Client.connect(srv);
    try {
      c.send({ t: 'mission', campaign: 'chaco', mission: 1, name: 'Ana' });
      const placing = await c.untilState((s) => s.status === 'placing' && s.mission?.campaignId === 'chaco');
      assert.equal(placing.game.hitKeepsTurn, true, 'la misión activa la regla de acierto = disparo adicional');
      const room = srv.manager.get(placing.room);
      room.game.starter = 'A';
      c.send({ t: 'ready', ships: placing.game.boards.A.ships.map((ship) => {
        const first = ship.cells[0];
        return { id: ship.id, row: Math.floor(first / placing.game.size), col: first % placing.game.size,
          horizontal: ship.cells.length < 2 || ship.cells[1] === first + 1 };
      }) });
      let battle = await c.untilState((s) => s.status === 'battle');
      const target = room.game.boards.B.ships[0].cells[0];
      c.send({ t: 'fire', row: Math.floor(target / room.game.size), col: target % room.game.size });
      battle = await c.untilState((s) => s.game.stats.A.hits === 1);
      assert.equal(battle.game.turn, 'A', 'un impacto permite disparar otra vez');
      const miss = room.game.boards.B.owner.findIndex((owner, i) => owner === null && room.game.boards.B.shots[i] === 0);
      c.send({ t: 'fire', row: Math.floor(miss / room.game.size), col: miss % room.game.size });
      const afterMiss = await c.untilState((s) => s.game.stats.A.shots === 2);
      assert.equal(afterMiss.game.lastShot.result, 'miss');
      assert.equal(afterMiss.game.turn, 'B', 'un fallo entrega el turno a la IA');
    } finally {
      c.close();
      await srv.close();
    }
  });
});

describe('partida entre personas', () => {
  let srv;
  before(async () => { srv = await startServer({ rng: seeded(5), timing: { graceMs: 250 } }); });
  after(async () => { await srv.close(); });

  async function pair(opts = {}) {
    const a = await Client.connect(srv);
    a.send({ t: 'create', mode: 'pvp', size: 8, name: 'Ana', avatar: '🦈', ...opts });
    const waiting = await a.untilState((s) => s.status === 'waiting');
    const b = await Client.connect(srv);
    b.send({ t: 'join', room: waiting.room.toLowerCase(), name: 'Beto' });
    await b.untilState((s) => s.status === 'placing');
    return { a, b, code: waiting.room };
  }

  test('crear, unirse por código, colocar flotas y jugar hasta el final', async () => {
    const { a, b } = await pair();
    const [ea, eb] = await Promise.all([a.autoPlay('hard'), b.autoPlay('normal')]);
    assert.equal(ea.game.winner, eb.game.winner);
    assert.equal(ea.you, 'A');
    assert.equal(eb.you, 'B');
    assert.equal(ea.players.B.name, 'Beto');
    assert.equal(eb.players.A.avatar, '🦈');
    a.close(); b.close();
  });

  test('cada jugador solo ve sus propios barcos mientras juega', async () => {
    const { a, b } = await pair();
    await a.placeAndReady();
    await b.placeAndReady();
    const sa = await a.untilState((s) => s.status === 'battle');
    const sb = await b.untilState((s) => s.status === 'battle');
    assert.ok(sa.game.boards.A.ships && !sa.game.boards.B.ships);
    assert.ok(sb.game.boards.B.ships && !sb.game.boards.A.ships);
    a.close(); b.close();
  });

  test('validaciones: sala inexistente, sala llena, jugar sin turno, casilla repetida', async () => {
    const { a, b, code } = await pair();
    const x = await Client.connect(srv);
    x.send({ t: 'join', room: 'ZZZZ' });
    await x.expectError('sala_no_existe');
    x.send({ t: 'join', room: code });
    await x.expectError('sala_llena');

    a.send({ t: 'fire', row: 0, col: 0 });
    await a.expectError('partida_no_iniciada');
    await a.placeAndReady();
    await b.placeAndReady();
    const s = await a.untilState((st) => st.status === 'battle');
    const mover = s.game.turn === 'A' ? a : b;
    const waiter = s.game.turn === 'A' ? b : a;
    waiter.send({ t: 'fire', row: 0, col: 0 });
    await waiter.expectError('no_es_tu_turno');
    mover.send({ t: 'fire', row: 99, col: 0 });
    await mover.expectError('fuera_de_rango');
    for (const c of [a, b, x]) c.close();
  });

  test('un espectador ve el tablero sin barcos y puede reaccionar', async () => {
    const { a, b, code } = await pair();
    const spec = await Client.connect(srv);
    spec.send({ t: 'spectate', room: code, name: 'Curioso' });
    const s = await spec.untilState((st) => st.you === 'spectator');
    assert.equal(s.game.boards.A.ships, null);
    assert.equal(s.game.boards.B.ships, null);
    await a.untilState((st) => st.spectators === 1);

    spec.send({ t: 'fire', row: 0, col: 0 });
    await spec.expectError('no_eres_jugador');
    spec.send({ t: 'react', e: '🔥' });
    const r = await a.waitFor((m) => m.t === 'react');
    assert.equal(r.from, 'spectator');
    for (const c of [a, b, spec]) c.close();
  });

  test('si un jugador pierde la conexión puede volver con su sesión', async () => {
    const { a, b } = await pair();
    const session = a.session;
    a.close();
    const dropped = await b.untilState((s) => s.players.A.online === false);
    assert.equal(dropped.status, 'placing');
    const back = await Client.connect(srv, { session });
    assert.equal(back.welcome.resumed, true);
    const s = await back.untilState((st) => st.you === 'A');
    assert.equal(s.players.B.name, 'Beto');
    await b.untilState((st) => st.players.A.online === true);
    back.close(); b.close();
  });

  test('si no vuelve a tiempo, pierde por abandono y el rival gana', async () => {
    const { a, b } = await pair();
    await a.placeAndReady();
    await b.placeAndReady();
    await b.untilState((s) => s.status === 'battle');
    a.close();
    const end = await b.untilState((s) => s.status === 'over', 3000);
    assert.equal(end.game.winner, 'B');
    assert.equal(end.game.reason, 'abandono');
    assert.equal(end.closedReason, 'rival_salio');
    b.close();
  });

  test('salir voluntariamente de la sala avisa al rival', async () => {
    const { a, b, code } = await pair();
    a.send({ t: 'leave' });
    await a.waitFor((m) => m.t === 'left');
    const end = await b.untilState((s) => s.status === 'over');
    assert.equal(end.game.winner, 'B');
    b.send({ t: 'leave' });
    await b.waitFor((m) => m.t === 'left');
    await sleep(20);
    assert.equal(srv.manager.get(code), null, 'la sala se elimina cuando queda vacía');
    a.close(); b.close();
  });

  test('mensajes mal formados se rechazan sin tumbar la conexión', async () => {
    const c = await Client.connect(srv);
    c.ws.send('esto no es json');
    await c.expectError('formato');
    c.send({ t: 'fire', row: 'a', col: 1 });
    await c.expectError('formato');
    c.send({ t: 'inventado' });
    await c.expectError('formato');
    c.send({ t: 'create', size: 7 });
    await c.expectError('tamano_invalido');
    c.send({ t: 'ping', ts: 5 });
    assert.equal((await c.waitFor((m) => m.t === 'pong')).ts, 5);
    c.close();
  });

  test('partida rankeada entre dos cuentas: Elo y puntos quedan guardados', async () => {
    const ra = await api(srv, 'POST', '/api/auth/register', { body: { email: 'ranka@ejemplo.com', username: 'RankA', password: 'secreto123' } });
    const rb = await api(srv, 'POST', '/api/auth/register', { body: { email: 'rankb@ejemplo.com', username: 'RankB', password: 'secreto123' } });
    const a = await Client.connect(srv, { auth: ra.body.token });
    const b = await Client.connect(srv, { auth: rb.body.token });
    a.send({ t: 'create', mode: 'pvp', size: 8 });
    const w = await a.untilState((s) => s.status === 'waiting');
    b.send({ t: 'join', room: w.room });
    await Promise.all([a.autoPlay('hard'), b.autoPlay('easy')]);
    const final = await a.untilState((s) => s.status === 'over' && s.result?.after?.A && s.result?.after?.B);
    assert.equal(final.result.ranked, true);
    const [ma, mb] = await Promise.all([ra, rb].map((r) => api(srv, 'GET', '/api/me', { token: r.body.token })));
    assert.equal(ma.body.user.rating + mb.body.user.rating, 2000, 'el Elo se transfiere, no se crea');
    assert.equal(ma.body.user.wins + mb.body.user.wins, 1);
    assert.equal(ma.body.user.gamesPlayed, 1);
    a.close(); b.close();
  });

  test('una misma cuenta no puede sentarse en los dos lados de una sala', async () => {
    const r = await api(srv, 'POST', '/api/auth/register', { body: { email: 'doble@ejemplo.com', username: 'Doble', password: 'secreto123' } });
    const a = await Client.connect(srv, { auth: r.body.token });
    a.send({ t: 'create', mode: 'pvp', size: 8 });
    const w = await a.untilState((s) => s.status === 'waiting');
    const b = await Client.connect(srv, { auth: r.body.token });
    b.send({ t: 'join', room: w.room });
    await b.expectError('ya_estas_en_la_sala');
    a.close(); b.close();
  });

  test('las salas públicas aparecen en el lobby y las privadas no', async () => {
    const pub = await Client.connect(srv);
    pub.send({ t: 'create', mode: 'pvp', size: 12, isPublic: true, name: 'Publica' });
    const priv = await Client.connect(srv);
    priv.send({ t: 'create', mode: 'pvp', size: 8, isPublic: false, name: 'Privada' });
    await Promise.all([pub.untilState((s) => s.status === 'waiting'), priv.untilState((s) => s.status === 'waiting')]);
    const { body } = await api(srv, 'GET', '/api/rooms');
    const names = body.rooms.flatMap((r) => r.players);
    assert.ok(names.includes('Publica'));
    assert.ok(!names.includes('Privada'));
    assert.equal(body.rooms.find((r) => r.players.includes('Publica')).joinable, true);
    pub.close(); priv.close();
  });
});

describe('temporizadores', () => {
  let srv;
  before(async () => { srv = await startServer({ rng: seeded(3), timing: { turnMs: 120, placementMs: 150, graceMs: 2000 } }); });
  after(async () => { await srv.close(); });

  test('si se acaba el tiempo de colocación, el servidor coloca la flota solo', async () => {
    const c = await Client.connect(srv);
    c.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy' });
    const s = await c.untilState((st) => st.status === 'battle', 2000);
    assert.ok(s.game.boards.A.ships.length > 0);
    c.close();
  });

  test('si se acaba el tiempo del turno, el servidor dispara por ti; 3 seguidos pierdes', async () => {
    const c = await Client.connect(srv);
    c.send({ t: 'create', mode: 'ai', size: 20, difficulty: 'easy' });
    await c.untilState((st) => st.status === 'battle', 2000);
    const end = await c.untilState((st) => st.status === 'over', 6000);
    assert.equal(end.game.winner, 'B');
    assert.equal(end.game.reason, 'tiempo');
    assert.ok(end.game.stats.A.shots >= 3, 'se hicieron disparos automáticos');
    c.close();
  });
});

describe('IA en hilos paralelos', () => {
  let srv;
  before(async () => { srv = await startServer({ aiWorkers: 2, rng: seeded(9) }); });
  after(async () => { await srv.close(); });

  test('varias salas contra la IA a la vez, calculadas por el pool de hilos', async () => {
    assert.equal(srv.pool.stats().mode, 'workers');
    const clients = await Promise.all(Array.from({ length: 4 }, () => Client.connect(srv)));
    clients.forEach((c, i) => c.send({ t: 'create', mode: 'ai', size: 12, difficulty: ['easy', 'normal', 'hard', 'hard'][i] }));
    const ends = await Promise.all(clients.map((c) => c.autoPlay('hard', 20_000)));
    for (const e of ends) assert.equal(e.status, 'over');
    assert.ok(srv.pool.stats().completed > 20, 'la IA decidió sus jugadas en los workers');
    clients.forEach((c) => c.close());
  });
});

describe('escenarios (biomas)', () => {
  let srv;
  before(async () => { srv = await startServer({ rng: seeded(31) }); });
  after(async () => { await srv.close(); });

  for (const [biome, tank] of [['water', 'Portaaviones'], ['pirate', 'Galeón'], ['land', 'Regimiento'], ['jungle', 'Comando']]) {
    test(`partida completa en ${biome} con las unidades de ese escenario`, async () => {
      const c = await Client.connect(srv);
      c.send({ t: 'create', mode: 'ai', size: 10, biome, difficulty: 'easy', name: 'Ana' });
      const s0 = await c.untilState((s) => s.status === 'placing');
      assert.equal(s0.biome, biome);
      assert.equal(s0.game.biome, biome);
      assert.ok(s0.game.boards.A.fleet.some((u) => u.name === tank), `la flota incluye "${tank}"`);
      const end = await c.autoPlay('hard');
      assert.equal(end.status, 'over');
      assert.equal(end.biome, biome);
      c.close();
    });
  }

  test('sin indicar bioma se juega en el mar (compatibilidad) y un bioma inválido se rechaza', async () => {
    const c = await Client.connect(srv);
    c.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy', name: 'Ana' });
    const s0 = await c.untilState((s) => s.status === 'placing');
    assert.equal(s0.biome, 'water');
    c.close();

    const d = await Client.connect(srv);
    d.send({ t: 'create', mode: 'ai', size: 8, biome: 'luna', difficulty: 'easy', name: 'Beto' });
    await d.expectError('formato');
    d.close();
  });

  test('/api/meta lista los escenarios', async () => {
    const meta = await api(srv, 'GET', '/api/meta');
    assert.equal(meta.status, 200);
    assert.deepEqual(meta.body.biomes.map((b) => b.id), ['water', 'pirate', 'land', 'jungle']);
  });
});
