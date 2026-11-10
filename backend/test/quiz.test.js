import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ACHIEVEMENTS, quizEarned } from '../src/domain/achievements.js';
import { CAMPAIGNS, publicCampaigns } from '../src/domain/campaigns.js';
import { getStory } from '../src/content/index.js';
import { QuizError, gradeQuiz, quizMissions } from '../src/domain/quiz.js';
import { RANKS, rankFor } from '../src/domain/ranks.js';
import { createProgress } from '../src/services/progress.js';
import { createMemoryStore } from '../src/repositories/memoryStore.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const right = (c, m) => getStory(c, m).quiz.map((q) => q.answer);
const wrong = (c, m) => getStory(c, m).quiz.map((q) => (q.answer + 1) % q.options.length);

describe('corrección de cuestionarios', () => {
  test('el catálogo público NO trae respuestas ni explicaciones', () => {
    const text = JSON.stringify(publicCampaigns());
    for (const c of CAMPAIGNS.filter((x) => !x.fiction)) for (const m of c.missions) {
      for (const q of getStory(c.id, m.id).quiz) assert.ok(!text.includes(q.why), `la explicación de «${q.q}» no debe viajar`);
    }
    const q = publicCampaigns()[0].missions[0].story.quiz[0];
    assert.deepEqual(Object.keys(q).sort(), ['options', 'q']);
  });

  test('gradeQuiz acierta, falla y explica', () => {
    const ok = gradeQuiz('chaco', 5, right('chaco', 5));
    assert.deepEqual([ok.correct, ok.total, ok.perfect], [2, 2, true]);
    const bad = gradeQuiz('chaco', 5, wrong('chaco', 5));
    assert.deepEqual([bad.correct, bad.perfect], [0, false]);
    assert.ok(bad.details.every((d) => !d.ok && d.why.length > 10 && Number.isInteger(d.right)));
    const mixed = gradeQuiz('chaco', 5, [right('chaco', 5)[0], wrong('chaco', 5)[1]]);
    assert.equal(mixed.correct, 1);
  });

  test('rechaza lo que no sean respuestas válidas', () => {
    for (const bad of [null, 'a', [], [0], [0, 1, 2], [0, 'x'], [0, 9], [0, -1], [0, 1.5]]) {
      assert.throws(() => gradeQuiz('chaco', 5, bad), (e) => e instanceof QuizError && e.code === 'respuestas_invalidas', JSON.stringify(bad));
    }
    assert.throws(() => gradeQuiz('chaco', 99, [0, 0]), (e) => e.code === 'sin_preguntas');
    assert.throws(() => gradeQuiz('corso', 1, [0]), (e) => e.code === 'sin_preguntas', 'la ficción no tiene preguntas');
  });

  test('las misiones con preguntas son las 11 reales', () => {
    assert.equal(quizMissions(CAMPAIGNS).length, 11);
  });
});

describe('logros de estudio y rangos', () => {
  const row = (c, m, best, total = 2) => ({ campaignId: c, missionId: m, bestCorrect: best, total });
  const all = quizMissions(CAMPAIGNS);

  test('quizEarned: buen alumno, estudioso y sabio', () => {
    assert.deepEqual(quizEarned([], all), []);
    assert.deepEqual(quizEarned([row('chaco', 1, 1)], all), [], 'con una respuesta mal no cuenta');
    assert.deepEqual(quizEarned([row('chaco', 1, 2)], all), ['quiz_ace']);
    const five = all.slice(0, 5).map((k) => { const [c, m] = k.split(':'); return row(c, Number(m), 2); });
    assert.deepEqual(quizEarned(five, all), ['quiz_ace', 'quiz_scholar']);
    const every = all.map((k) => { const [c, m] = k.split(':'); return row(c, Number(m), 2); });
    assert.deepEqual(quizEarned(every, all), ['quiz_ace', 'quiz_scholar', 'quiz_sage']);
    assert.ok(['quiz_ace', 'quiz_scholar', 'quiz_sage', 'album_dorado'].every((id) => ACHIEVEMENTS.some((a) => a.id === id)));
  });

  test('rankFor: umbrales, siguiente rango y tope', () => {
    assert.equal(rankFor(0).name, 'Recluta');
    assert.equal(rankFor(2).name, 'Recluta');
    assert.equal(rankFor(3).name, 'Soldado');
    assert.deepEqual(rankFor(10).next, { id: 'sargento', name: 'Sargento', min: 14, missing: 4 });
    assert.equal(rankFor(60).name, 'Mariscal');
    assert.equal(rankFor(60).next, null);
    assert.equal(rankFor(-5).name, 'Recluta');
    assert.equal(rankFor('x').name, 'Recluta');
    const total = CAMPAIGNS.reduce((a, c) => a + c.missions.length * 3, 0);
    assert.equal(RANKS.at(-1).min, total, 'el último rango pide todas las estrellas posibles');
    assert.ok(RANKS.every((r, i) => i === 0 || r.min > RANKS[i - 1].min), 'umbrales crecientes');
  });

  test('«Álbum dorado» necesita tres estrellas en todas las misiones', async () => {
    const { earned } = await import('../src/domain/achievements.js');
    const ctx = (stars) => ({ summary: { won: true, shots: 10, lost: 0, cleanSink: false }, match: { mode: 'ai', difficulty: 'easy', size: 8 }, mission: null, stars: new Map(stars), facts: { biomesWon: [], beatExpert: false, won20: false } });
    const every = (v) => CAMPAIGNS.flatMap((c) => c.missions.map((m) => [`${c.id}:${m.id}`, v]));
    assert.ok(earned(ctx(every(3))).includes('album_dorado'));
    assert.ok(!earned(ctx(every(2))).includes('album_dorado'));
    const almost = every(3); almost[0][1] = 2;
    assert.ok(!earned(ctx(almost)).includes('album_dorado'));
  });
});

describe('servicio y API del cuestionario', () => {
  test('con cuenta guarda el mejor resultado, cuenta intentos y desbloquea logros', async () => {
    const store = createMemoryStore();
    const progress = createProgress({ store });
    const u = await store.createUser({ username: 'sofi', passwordHash: 'x' });
    const a = await progress.answerQuiz({ userId: u.id, campaignId: 'chaco', missionId: 1, answers: wrong('chaco', 1) });
    assert.deepEqual([a.saved, a.correct, a.best, a.attempts], [true, 0, 0, 1]);
    assert.deepEqual(a.newAchievements, []);
    const b = await progress.answerQuiz({ userId: u.id, campaignId: 'chaco', missionId: 1, answers: right('chaco', 1) });
    assert.deepEqual([b.correct, b.best, b.attempts], [2, 2, 2]);
    assert.deepEqual(b.newAchievements.map((x) => x.id), ['quiz_ace']);
    const c = await progress.answerQuiz({ userId: u.id, campaignId: 'chaco', missionId: 1, answers: right('chaco', 1) });
    assert.deepEqual(c.newAchievements, [], 'un logro se avisa una sola vez');
    const ov = await progress.overview(u.id);
    assert.deepEqual(ov.quiz, [{ campaignId: 'chaco', missionId: 1, best: 2, total: 2, attempts: 3 }]);
    assert.equal(ov.rank.name, 'Recluta');
  });

  test('un invitado recibe la corrección pero no se guarda nada', async () => {
    const store = createMemoryStore();
    const progress = createProgress({ store });
    const r = await progress.answerQuiz({ campaignId: 'chaco', missionId: 2, answers: right('chaco', 2) });
    assert.deepEqual([r.saved, r.perfect, r.newAchievements], [false, true, []]);
  });

  test('POST /api/quiz: invitado, cuenta, validaciones y sin filtrar respuestas antes de contestar', async () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    config.aiWorkers = 0;
    const srv = await createApp({ config, bcryptRounds: 4 });
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.server.address().port}/api`;
    const post = (body, token) => fetch(`${base}/quiz`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    try {
      const guest = await post({ campaignId: 'chaco', missionId: 1, answers: right('chaco', 1) });
      assert.equal(guest.status, 200);
      const g = await guest.json();
      assert.deepEqual([g.correct, g.saved], [2, false]);

      const reg = await (await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'quizera@ejemplo.com', username: 'quizera', password: 'secreto123' }) })).json();
      const mine = await (await post({ campaignId: 'chaco', missionId: 1, answers: right('chaco', 1) }, reg.token)).json();
      assert.deepEqual([mine.saved, mine.best, mine.newAchievements[0]?.id], [true, 2, 'quiz_ace']);
      const prog = await (await fetch(`${base}/progress`, { headers: { authorization: `Bearer ${reg.token}` } })).json();
      assert.equal(prog.quiz[0].best, 2);
      assert.equal(prog.rank.id, 'recluta');
      assert.ok(prog.achievements.some((a) => a.id === 'quiz_ace'));

      for (const body of [{}, { campaignId: 'chaco' }, { campaignId: 'chaco', missionId: '1', answers: [0, 0] }, { campaignId: 'chaco', missionId: 1, answers: [0] }, { campaignId: 'corso', missionId: 1, answers: [0] }]) {
        const r = await post(body);
        assert.equal(r.status, 400, JSON.stringify(body));
        assert.ok((await r.json()).error);
      }
      const cat = await (await fetch(`${base}/campaigns`)).text();
      assert.ok(!/"answer"|"why"/.test(cat), 'el catálogo no trae respuestas');
    } finally { await srv.close(); }
  });
});
