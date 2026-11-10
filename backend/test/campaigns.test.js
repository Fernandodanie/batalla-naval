import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ACHIEVEMENTS, earned, efficientShots } from '../src/domain/achievements.js';
import { CAMPAIGNS, evaluateMission, getMission, isUnlocked, objectiveLabel, publicCampaigns } from '../src/domain/campaigns.js';
import { BOARD_SIZES } from '../src/domain/fleet.js';
import { Game } from '../src/domain/game.js';
import { hasCleanSink, summarize } from '../src/domain/summary.js';
import { createGuestQuota } from '../src/http/quota.js';

describe('campañas: definición', () => {
  test('hay cuatro campañas, una por escenario, con ids únicos', () => {
    assert.deepEqual(CAMPAIGNS.map((c) => c.biome).sort(), ['jungle', 'land', 'pirate', 'water']);
    assert.equal(new Set(CAMPAIGNS.map((c) => c.id)).size, 4);
    assert.equal(getMission('chaco', 1).title, 'Boquerón');
    assert.equal(getMission('chaco', 99), null);
    assert.equal(getMission('nada', 1), null);
  });

  test('las misiones se numeran 1..n y la dificultad y el tablero nunca bajan', () => {
    const order = ['easy', 'normal', 'hard', 'expert'];
    for (const c of CAMPAIGNS) {
      assert.deepEqual(c.missions.map((m) => m.id), c.missions.map((_, i) => i + 1));
      for (let i = 1; i < c.missions.length; i++) {
        assert.ok(c.missions[i].size >= c.missions[i - 1].size, `${c.id}: el tablero no baja`);
        assert.ok(order.indexOf(c.missions[i].difficulty) >= order.indexOf(c.missions[i - 1].difficulty), `${c.id}: la IA no baja`);
      }
      for (const m of c.missions) {
        assert.ok(Object.hasOwn(BOARD_SIZES, m.size), `${c.id}#${m.id}: tamaño válido`);
        assert.ok(m.briefing.length > 40 && m.debrief.length > 10, `${c.id}#${m.id}: tiene briefing y cierre`);
        assert.equal(m.optional.length, 2, 'dos objetivos opcionales → hasta 3 estrellas');
      }
    }
  });

  test('la última misión de cada campaña es IA experta en 20×20', () => {
    for (const c of CAMPAIGNS) {
      const last = c.missions.at(-1);
      assert.equal(last.difficulty, 'expert', c.id);
      assert.equal(last.size, 20, c.id);
    }
  });

  test('la campaña del Chaco sigue la tabla del documento', () => {
    const chaco = CAMPAIGNS.find((c) => c.id === 'chaco');
    assert.deepEqual(chaco.missions.map((m) => [m.size, m.difficulty]), [[8, 'easy'], [10, 'normal'], [12, 'normal'], [15, 'hard'], [15, 'hard'], [20, 'expert']]);
  });

  test('las campañas ficticias están rotuladas', () => {
    assert.deepEqual(CAMPAIGNS.filter((c) => c.fiction).map((c) => c.id).sort(), ['corso', 'litoral']);
    assert.equal(publicCampaigns().find((c) => c.id === 'corso').fiction, true);
  });

  test('desbloqueo en orden', () => {
    const stars = new Map([['chaco:1', 2]]);
    assert.equal(isUnlocked('chaco', 1, new Map()), true);
    assert.equal(isUnlocked('chaco', 2, stars), true);
    assert.equal(isUnlocked('chaco', 3, stars), false);
    assert.equal(isUnlocked('chaco', 2, new Map()), false);
  });
});

describe('misiones: estrellas', () => {
  const m = getMission('chaco', 1); // 8×8 fácil: ≤ 51 disparos, ≤ 2 bajas
  test('perder da 0 estrellas', () => {
    const ev = evaluateMission(m, { won: false, shots: 10, lost: 0 });
    assert.equal(ev.stars, 0);
    assert.equal(ev.objectives.every((o) => !o.met), true);
  });
  test('ganar da 1; cada objetivo opcional suma otra (máximo 3)', () => {
    assert.equal(evaluateMission(m, { won: true, shots: 63, lost: 4 }).stars, 1);
    assert.equal(evaluateMission(m, { won: true, shots: 40, lost: 4 }).stars, 2);
    assert.equal(evaluateMission(m, { won: true, shots: 63, lost: 1 }).stars, 2);
    const full = evaluateMission(m, { won: true, shots: 40, lost: 0 });
    assert.equal(full.stars, 3);
    assert.deepEqual(full.objectives.map((o) => o.id), ['win', 'maxShots', 'maxLost']);
  });
  test('los textos de los objetivos salen en español', () => {
    assert.match(objectiveLabel({ type: 'maxShots', value: 40 }), /40 disparos/);
    assert.equal(objectiveLabel({ type: 'maxLost', value: 0 }), 'No pierdas ninguna unidad');
    assert.equal(objectiveLabel({ type: 'maxLost', value: 1 }), 'Pierde como máximo 1 unidad');
  });
});

/** Partida con flotas fijas para probar resúmenes. */
function fixedGame() {
  const g = new Game({ size: 8, starter: 'A' });
  const fleet = [{ id: '4-0', row: 0, col: 0, horizontal: true }, { id: '3-0', row: 2, col: 0, horizontal: true }, { id: '3-1', row: 4, col: 0, horizontal: true }, { id: '2-0', row: 6, col: 0, horizontal: true }];
  assert.ok(g.setFleet('A', fleet).ok);
  assert.ok(g.setFleet('B', fleet).ok);
  return g;
}
/** Dispara en orden ignorando el turno (las pruebas solo miran el historial y el resumen). */
const shoot = (g, side, cells) => { for (const [r, c] of cells) { g.turn = side; assert.ok(g.fire(side, r, c).ok, `${r},${c}`); } };

describe('resumen de partida', () => {
  test('tiro certero: una unidad hundida sin disparos de por medio', () => {
    const g = fixedGame();
    shoot(g, 'A', [[2, 0], [2, 1], [2, 2]]); // hunde la de 3 seguido
    assert.equal(hasCleanSink(g, 'A'), true);
  });
  test('un disparo a otro lado de por medio rompe el tiro certero', () => {
    const g = fixedGame();
    shoot(g, 'A', [[2, 0], [7, 7], [2, 1], [2, 2]]);
    assert.equal(hasCleanSink(g, 'A'), false);
  });
  test('las unidades de 2 casillas no cuentan para el tiro certero', () => {
    const g = fixedGame();
    shoot(g, 'A', [[6, 0], [6, 1]]);
    assert.equal(hasCleanSink(g, 'A'), false);
  });
  test('summarize cuenta disparos, bajas y ganador', () => {
    const g = fixedGame();
    shoot(g, 'B', [[6, 0], [6, 1]]); // B hunde la de 2 de A
    g.forfeit('B');
    const a = summarize(g, 'A');
    assert.equal(a.won, true);
    assert.equal(a.lost, 1);
    assert.equal(a.units, 4);
    assert.equal(summarize(g, 'B').shots, 2);
    assert.equal(summarize(g, 'B').won, false);
  });
});

describe('logros', () => {
  const win = { won: true, shots: 30, lost: 0, cleanSink: false };
  const base = { summary: win, match: { mode: 'ai', difficulty: 'normal', size: 10 }, mission: null, stars: new Map(), facts: { biomesWon: [], beatExpert: false, won20: false } };
  const ids = (ctx) => earned({ ...base, ...ctx });

  test('el catálogo tiene ids únicos, las cuatro categorías y textos', () => {
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
    assert.deepEqual([...new Set(ACHIEVEMENTS.map((a) => a.category))].sort(), ['habilidad', 'histórico', 'progreso', 'variedad']);
    for (const a of ACHIEVEMENTS) assert.ok(a.name && a.text && a.icon, a.id);
    for (const n of ['Tres pasos al frente', 'Defensor de Boquerón', 'Defensor de Villamontes', 'Patente de corso']) assert.ok(ACHIEVEMENTS.some((a) => a.name === n), n);
  });

  test('victoria perfecta y pocos disparos exigen una IA que no sea fácil', () => {
    assert.ok(ids({}).includes('perfect'));
    assert.ok(ids({}).includes('efficient'));
    const easy = ids({ match: { mode: 'ai', difficulty: 'easy', size: 10 } });
    assert.ok(!easy.includes('perfect'));
    assert.ok(!easy.includes('efficient'));
    assert.ok(ids({ match: { mode: 'pvp', difficulty: 'normal', size: 10 } }).includes('perfect'));
    assert.ok(!ids({ summary: { ...win, lost: 1 } }).includes('perfect'));
    assert.ok(!ids({ summary: { ...win, shots: efficientShots(10) + 1 } }).includes('efficient'));
    assert.equal(efficientShots(10), 50);
  });

  test('tiro certero se concede aunque se pierda la partida', () => {
    assert.ok(ids({ summary: { won: false, shots: 20, lost: 4, cleanSink: true } }).includes('clean_sink'));
    assert.ok(!ids({}).includes('clean_sink'));
  });

  test('variedad: todos los escenarios, IA experta y 20×20', () => {
    const facts = { biomesWon: ['water', 'pirate', 'land'], beatExpert: true, won20: true };
    const r = ids({ facts });
    assert.ok(r.includes('beat_expert') && r.includes('win_20'));
    assert.ok(!r.includes('win_all_biomes'));
    assert.ok(ids({ facts: { ...facts, biomesWon: [...facts.biomesWon, 'jungle'] } }).includes('win_all_biomes'));
  });

  test('progreso e históricos salen de las estrellas guardadas', () => {
    const stars = new Map([['chaco:1', 1]]);
    let r = ids({ stars });
    assert.ok(r.includes('first_mission') && r.includes('hist_boqueron'));
    assert.ok(!r.includes('hist_tres_pasos'));
    stars.set('chaco:2', 1); stars.set('chaco:3', 2);
    r = ids({ stars });
    assert.ok(r.includes('hist_tres_pasos'));
    assert.ok(!r.includes('camp_chaco'));
    for (const m of CAMPAIGNS[0].missions) stars.set(`chaco:${m.id}`, 1);
    assert.ok(ids({ stars }).includes('camp_chaco'));
    assert.ok(!ids({ stars }).includes('all_campaigns'));
    for (const c of CAMPAIGNS) for (const m of c.missions) stars.set(`${c.id}:${m.id}`, 1);
    assert.ok(ids({ stars }).includes('all_campaigns'));
  });

  test('tres estrellas y coleccionista', () => {
    assert.ok(ids({ mission: { stars: 3 } }).includes('three_stars'));
    assert.ok(!ids({ mission: { stars: 2 } }).includes('three_stars'));
    const stars = new Map(CAMPAIGNS[0].missions.map((m) => [`chaco:${m.id}`, 3]).concat(CAMPAIGNS[1].missions.map((m) => [`siglo19:${m.id}`, 3])));
    assert.ok(ids({ stars }).includes('star_collector'), `${[...stars.values()].reduce((a, b) => a + b, 0)} estrellas`);
  });
});

describe('cupo diario de invitados', () => {
  test('permite N partidas por clave y día, y se reinicia al día siguiente', () => {
    let now = Date.UTC(2026, 9, 30, 12);
    const q = createGuestQuota({ limit: 2, now: () => now });
    assert.equal(q.left('1.1.1.1'), 2);
    assert.deepEqual(q.take('1.1.1.1'), { ok: true, left: 1 });
    assert.deepEqual(q.take('1.1.1.1'), { ok: true, left: 0 });
    assert.deepEqual(q.take('1.1.1.1'), { ok: false, left: 0 });
    assert.equal(q.take('2.2.2.2').ok, true, 'otra IP tiene su propio cupo');
    now += 86_400_000;
    assert.equal(q.left('1.1.1.1'), 2);
    q.close();
  });
  test('límite 0 = sin cupo', () => {
    const q = createGuestQuota({ limit: 0 });
    for (let i = 0; i < 50; i++) assert.equal(q.take('x').ok, true);
    assert.equal(q.left('x'), null);
    q.close();
  });
});
