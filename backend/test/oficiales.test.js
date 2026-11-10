/** Jefes de cada bando en las misiones: reales en las campañas históricas, inventados (y repetibles) en las de ficción. */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { CAMPAIGNS } from '../src/domain/campaigns.js';
import { getStory, storyProblems } from '../src/content/index.js';
import { officersFor } from '../src/content/oficiales.js';
import { api, Client, startServer } from './helpers.js';
import { seeded } from './seed.js';

const missions = CAMPAIGNS.flatMap((c) => c.missions.map((m) => ({ c, m })));

test('toda misión histórica trae sus dos jefes con cargo, y se validan', () => {
  for (const { c, m } of missions.filter(({ c }) => !c.fiction)) {
    const story = getStory(c.id, m.id);
    assert.deepEqual(storyProblems(story, { fiction: false }), [], `${c.id}#${m.id}`);
    const o = officersFor(c.id, m.id, 'ABCD');
    assert.equal(o.invented, false);
    assert.equal(o.A.name, story.commanders.you.name);
    assert.equal(o.B.name, story.commanders.foe.name);
    assert.notEqual(o.A.name, o.B.name);
    assert.ok(o.A.role.length > 5 && o.B.role.length > 5);
  }
});

test('las misiones de ficción NO llevan jefes reales: se inventan', () => {
  for (const { c, m } of missions.filter(({ c }) => c.fiction)) {
    assert.equal(getStory(c.id, m.id).commanders, undefined);
    const o = officersFor(c.id, m.id, 'XYZ1');
    assert.equal(o.invented, true);
    assert.ok(o.A.name.length > 3 && o.B.name.length > 3);
    assert.notEqual(o.A.name, o.B.name);
    assert.match(o.A.role, /inventado/);
    assert.ok(!/undefined|null/.test(o.A.name + o.B.name));
  }
  assert.ok(storyProblems({ ...getStory('corso', 1), commanders: { you: { name: 'X', role: 'Y' } } }, { fiction: true }).length > 0, 'ficción con jefes reales se rechaza');
});

test('los nombres inventados son los mismos para la misma sala y varían entre salas', () => {
  const a = officersFor('litoral', 3, 'K7QD');
  assert.deepEqual(officersFor('litoral', 3, 'K7QD'), a);
  const distintos = new Set(['AAAA', 'BBBB', 'CCCC', 'DDDD', 'EEEE', 'FFFF', 'GGGG', 'HHHH'].map((code) => officersFor('litoral', 3, code).B.name));
  assert.ok(distintos.size >= 5, `poca variedad: ${[...distintos]}`);
});

test('lo que ve el cliente: ya no sale «Almirante IA» ni el nombre de la cuenta, y el cliente conoce a los jefes antes de jugar', async () => {
  const srv = await startServer({ rng: seeded(5) });
  try {
    // el catálogo público incluye los jefes de las históricas
    const cat = await api(srv, 'GET', '/api/campaigns');
    const chaco = cat.body.campaigns.find((c) => c.id === 'chaco');
    assert.equal(chaco.missions[0].story.commanders.you.name, 'Manuel Marzana');
    const corso = cat.body.campaigns.find((c) => c.id === 'corso');
    assert.equal(corso.missions[0].story.commanders, null);

    const reg = await api(srv, 'POST', '/api/auth/register', { body: { email: 'oficial@ejemplo.com', username: 'oficial', password: 'secreto123' } });
    const c = await Client.connect(srv, { auth: reg.body.token });
    c.send({ t: 'mission', campaign: 'chaco', mission: 1 });
    const s = await c.untilState((st) => st.status === 'placing');
    assert.equal(s.players.A.name, 'Manuel Marzana');
    assert.equal(s.players.B.name, 'José Félix Estigarribia');
    assert.equal(s.players.A.officer, true);
    assert.equal(s.players.B.officer, true);
    assert.equal(s.players.B.invented, false);
    assert.match(s.players.A.role, /Boquer/);
    assert.ok(![s.players.A.name, s.players.B.name].some((n) => /Almirante|oficial/i.test(n)));
    c.send({ t: 'leave' });

    // ficción: nombres inventados, marcados como tales y estables si se vuelve a pedir el estado
    const d = await Client.connect(srv, { auth: reg.body.token });
    d.send({ t: 'mission', campaign: 'litoral', mission: 1 });
    const f = await d.untilState((st) => st.status === 'placing');
    assert.equal(f.players.A.invented, true);
    assert.ok(!/Almirante IA/.test(f.players.B.name));
    d.send({ t: 'ready' });
    const again = await d.untilState(() => true);
    assert.equal(again.players.B.name, f.players.B.name);

    // una partida libre contra la IA sigue igual que antes
    const e = await Client.connect(srv, { auth: reg.body.token });
    e.send({ t: 'create', mode: 'ai', size: 10, difficulty: 'easy', hitKeepsTurn: false });
    const free = await e.untilState((st) => st.status === 'placing');
    assert.equal(free.players.B.name, 'Almirante IA');
    assert.equal(free.players.A.name, 'oficial');
    assert.equal(free.players.A.officer, false);
  } finally { await srv.close(); }
});
