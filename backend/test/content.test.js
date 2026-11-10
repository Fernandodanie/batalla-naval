import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { ACHIEVEMENTS, RENAMED, earned, getAchievement } from '../src/domain/achievements.js';
import { CAMPAIGNS, getMission, publicCampaigns } from '../src/domain/campaigns.js';
import { EVENT_KEYS, STORIES, getStory, storyProblems } from '../src/content/index.js';
import { LAMINAS, getLamina, laminasFor, publicLaminas } from '../src/domain/laminas.js';
import { createProgress } from '../src/services/progress.js';
import { createMemoryStore } from '../src/repositories/memoryStore.js';

describe('narración de las misiones', () => {
  test('toda misión tiene una historia completa y bien formada', () => {
    for (const c of CAMPAIGNS) {
      for (const m of c.missions) {
        const problems = storyProblems(getStory(c.id, m.id), { fiction: c.fiction });
        assert.deepEqual(problems, [], `${c.id}#${m.id}: ${problems.join('; ')}`);
      }
    }
  });

  test('no sobran historias: cada una corresponde a una misión existente', () => {
    for (const [campaignId, stories] of Object.entries(STORIES)) {
      for (const id of Object.keys(stories)) assert.ok(getMission(campaignId, id), `${campaignId}#${id} no existe`);
    }
  });

  test('las campañas reales traen fuentes con enlace https y preguntas con respuesta válida', () => {
    for (const c of CAMPAIGNS.filter((x) => !x.fiction)) {
      for (const m of c.missions) {
        const st = getStory(c.id, m.id);
        assert.ok(st.sources.some((s) => s.url), `${c.id}#${m.id}: al menos una fuente con enlace`);
        for (const q of st.quiz) assert.ok(q.options.length >= 2 && q.answer < q.options.length);
      }
    }
  });

  test('las campañas de ficción no inventan fuentes ni preguntas históricas', () => {
    for (const c of CAMPAIGNS.filter((x) => x.fiction)) {
      for (const m of c.missions) {
        const st = getStory(c.id, m.id);
        assert.deepEqual(st.sources, [], `${c.id}#${m.id}`);
        assert.match(st.real, /Ficción/);
      }
    }
  });

  test('una misión es «reinterpretación» exactamente cuando el bando del jugador perdió en la historia', () => {
    for (const c of CAMPAIGNS.filter((x) => !x.fiction)) {
      for (const m of c.missions) assert.equal(Boolean(m.fictionalTwist), !getStory(c.id, m.id).won, `${c.id}#${m.id} ${m.title}`);
    }
    for (const c of CAMPAIGNS.filter((x) => x.fiction)) for (const m of c.missions) assert.ok(!m.fictionalTwist, 'la ficción no se marca como reinterpretación');
  });

  test('el validador de contenido termina bien con el contenido actual', () => {
    const r = spawnSync(process.execPath, ['scripts/validate-content.js'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Contenido correcto: 4 campañas, 20 misiones/);
  });

  test('export:review genera el documento de revisión con todas las misiones, respuestas y casillas', () => {
    const out = join(tmpdir(), `revision-${process.pid}.md`);
    const r = spawnSync(process.execPath, ['scripts/export-review.js', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const md = readFileSync(out, 'utf8');
    unlinkSync(out);
    for (const c of CAMPAIGNS) for (const m of c.missions) assert.ok(md.includes(`### ${c.id} · misión ${m.id}: ${m.title}`), `${c.id}#${m.id}`);
    assert.match(md, /\*\*Resultado histórico:\*\* victoria paraguaya/);
    assert.ok(!/Resultado histórico:\*\* Resultado histórico/.test(md), 'sin frase repetida');
    assert.match(md, /No → la misión se presenta como «reinterpretación»/);
    assert.ok((md.match(/- \[ \] \*\*/g) ?? []).length >= 60, 'casillas de aprobación por sección');
    const q = getStory('chaco', 5).quiz[0];
    assert.ok(md.includes(`**${q.options[q.answer]}**`), 'la respuesta correcta va en negrita para quien revisa');
    assert.ok(md.includes('## Glosario completo'));
  });

  test('storyProblems detecta historias rotas', () => {
    assert.ok(storyProblems(null, { fiction: true }).length);
    const base = JSON.parse(JSON.stringify(getStory('chaco', 1)));
    delete base.events.win;
    assert.ok(storyProblems(base, { fiction: false }).some((p) => p.includes('win')));
    const bad = JSON.parse(JSON.stringify(getStory('chaco', 1)));
    bad.quiz[0].answer = 9;
    assert.ok(storyProblems(bad, { fiction: false }).some((p) => p.includes('fuera de rango')));
    const http = JSON.parse(JSON.stringify(getStory('chaco', 1)));
    http.sources[0].url = 'http://inseguro.example';
    const sinWon = JSON.parse(JSON.stringify(getStory('chaco', 1))); delete sinWon.won;
    assert.ok(storyProblems(sinWon, { fiction: false }).some((p) => p.includes('won')));
    assert.ok(storyProblems(http, { fiction: false }).some((p) => p.includes('https')));
  });

  test('el catálogo público incluye la historia y marca las reinterpretaciones', () => {
    const chaco = publicCampaigns().find((c) => c.id === 'chaco');
    assert.deepEqual(Object.keys(chaco.missions[0].story.events), EVENT_KEYS);
    assert.equal(chaco.missions[0].twist, true);  // Boquerón: en la historia se capituló
    assert.equal(chaco.missions[4].twist, false); // Cañada Strongest: victoria real
  });

  test('correcciones históricas: Strongest en 1934, Villamontes en 1935 y el Corralito aclarado', () => {
    assert.match(getStory('chaco', 5).date, /mayo de 1934/);
    assert.match(getStory('chaco', 6).date, /1935/);
    assert.equal(getMission('chaco', 6).title, 'Defensa de Villamontes');
    assert.ok(getStory('chaco', 6).facts.some((f) => f.includes('Corralito') && f.includes('1934')));
    assert.match(getStory('chaco', 2).date, /1933/);
    assert.match(getStory('chaco', 1).real, /victoria paraguaya/);
  });
});

describe('glosario', () => {
  test('cada misión recibe solo las palabras que usa, sin distinguir tildes ni plurales', async () => {
    const { glossaryFor } = await import('../src/content/glosario.js');
    assert.deepEqual(glossaryFor(['Los FORTINES cayeron tras el asedio']).map((g) => g.term), ['fortín', 'asedio']);
    assert.deepEqual(glossaryFor(['capitulacion']).map((g) => g.term), ['capitulación']);
    assert.deepEqual(glossaryFor(['nada que explicar', null, '']), []);
    assert.deepEqual(glossaryFor(['la pajonalera']), [], 'no confunde una palabra más larga');
    const chaco1 = publicCampaigns().find((c) => c.id === 'chaco').missions[0].story.glossary.map((g) => g.term);
    assert.ok(['fortín', 'asedio', 'capitulación', 'mortero', 'reinterpretación'].every((t) => chaco1.includes(t)), chaco1.join());
    const corso = publicCampaigns().find((c) => c.id === 'corso').missions[0].story.glossary.map((g) => g.term);
    assert.ok(corso.includes('patente de corso') && !corso.includes('fortín'));
  });

  test('todo término se usa en alguna misión y tiene una definición útil', async () => {
    const { GLOSSARY } = await import('../src/content/glosario.js');
    const used = new Set(publicCampaigns().flatMap((c) => c.missions.flatMap((m) => m.story.glossary.map((g) => g.term))));
    for (const g of GLOSSARY) { assert.ok(used.has(g.term), `«${g.term}» no se usa`); assert.ok(g.def.length >= 25); }
    assert.equal(new Set(GLOSSARY.map((g) => g.term)).size, GLOSSARY.length);
  });
});

describe('logros históricos y renombrados', () => {
  test('cada misión real tiene su logro histórico y los ids no se repiten', () => {
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
    for (const c of CAMPAIGNS.filter((x) => !x.fiction)) {
      for (const m of c.missions) {
        const has = ACHIEVEMENTS.some((a) => a.campaign === c.id && a.missions?.includes(m.id));
        if (m.id !== 4 || c.id !== 'chaco') continue; // Campo Vía ya tiene «Cerco roto»
        assert.ok(has, `${c.id}#${m.id}`);
      }
    }
    for (const id of ['hist_boqueron', 'hist_alihuata', 'hist_nanawa', 'hist_cerco', 'hist_strongest', 'hist_villamontes',
      'hist_tumusla', 'hist_ingavi', 'hist_calama', 'hist_alianza', 'hist_ayacucho']) assert.ok(getAchievement(id), id);
  });

  test('el logro renombrado apunta a uno que existe y el id viejo ya no está en el catálogo', () => {
    for (const [old, now] of Object.entries(RENAMED)) {
      assert.equal(getAchievement(old), null);
      assert.ok(getAchievement(now));
    }
  });

  test('«Maestro de campaña», «Historiador» y «Constelación»', () => {
    const win = { won: true, shots: 10, lost: 0, cleanSink: false };
    const match = { mode: 'ai', difficulty: 'easy', size: 8 };
    const ctx = (stars) => ({ summary: win, match, mission: null, stars: new Map(stars), facts: { biomesWon: [], beatExpert: false, won20: false } });
    const all = (id, n, v) => Array.from({ length: n }, (_, i) => [`${id}:${i + 1}`, v]);

    assert.ok(!earned(ctx(all('chaco', 6, 2))).includes('master_campaign'));
    assert.ok(earned(ctx(all('chaco', 6, 3))).includes('master_campaign'));
    assert.ok(!earned(ctx(all('chaco', 5, 3))).includes('master_campaign'), 'faltó la sexta misión');

    const real = [...all('chaco', 6, 1), ...all('siglo19', 5, 1)];
    assert.ok(earned(ctx(real)).includes('historian'));
    assert.ok(!earned(ctx(all('chaco', 6, 1))).includes('historian'));
    // Las campañas de ficción no cuentan para «Historiador».
    assert.ok(!earned(ctx([...all('corso', 4, 1), ...all('litoral', 5, 1)])).includes('historian'));

    // 40 estrellas: las dos históricas completas suman 33 (no alcanza); con las cuatro campañas son 60.
    assert.ok(!earned(ctx(all('chaco', 6, 3).concat(all('siglo19', 5, 3)))).includes('star_constellation'));
    const todas = [...all('chaco', 6, 3), ...all('siglo19', 5, 3), ...all('corso', 4, 3), ...all('litoral', 5, 3)];
    assert.ok(earned(ctx(todas)).includes('star_constellation'));
    assert.ok(earned(ctx(all('chaco', 5, 3))).includes('five_perfect'));
    assert.ok(!earned(ctx(all('chaco', 4, 3))).includes('five_perfect'));
  });
});

describe('láminas (recompensas)', () => {
  test('hay una lámina por misión, con ids únicos', () => {
    const total = CAMPAIGNS.reduce((a, c) => a + c.missions.length, 0);
    assert.equal(LAMINAS.length, total);
    assert.equal(new Set(LAMINAS.map((l) => l.id)).size, total);
    for (const l of LAMINAS) assert.ok(getMission(l.campaignId, l.missionId), l.id);
  });

  test('las de ficción se rotulan como ilustración de ficción', () => {
    for (const l of LAMINAS) assert.equal(l.fiction, /Ficción|ficción/.test(l.caption), l.id);
  });

  test('laminasFor: la misma lámina con 1, 2 o 3 estrellas (sin versiones), nada si no se ganó', () => {
    const got = laminasFor(new Map([['chaco:1', 1], ['chaco:2', 3], ['chaco:3', 0], ['siglo19:1', 2]]));
    assert.deepEqual(got, [{ id: 'chaco-1' }, { id: 'chaco-2' }, { id: 'siglo19-1' }]);
    assert.deepEqual(laminasFor(new Map()), []);
  });

  test('el catálogo público trae solo los datos de cada lámina', () => {
    assert.ok(publicLaminas().every((l) => !('scene' in l) && !('tier' in l)));
    assert.equal(getLamina('chaco-6').title, 'Villamontes');
    assert.equal(getLamina('nada'), null);
  });

  test('el progreso de una cuenta incluye sus láminas y traduce el logro renombrado', async () => {
    const store = createMemoryStore();
    const user = await store.createUser({ username: 'ana', passwordHash: 'x', avatar: '🙂' });
    await store.saveMissionResult(user.id, { campaignId: 'chaco', missionId: 1, stars: 3, shots: 20 });
    await store.saveMissionResult(user.id, { campaignId: 'chaco', missionId: 2, stars: 1, shots: 40 });
    await store.unlockAchievements(user.id, ['hist_corralito', 'hist_boqueron', 'logro_que_no_existe']);
    const overview = await createProgress({ store }).overview(user.id);
    assert.deepEqual(overview.laminas, [{ id: 'chaco-1' }, { id: 'chaco-2' }]);
    const ids = overview.achievements.map((a) => a.id).sort();
    assert.deepEqual(ids, ['hist_boqueron', 'hist_villamontes']);
  });
});
