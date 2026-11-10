/** Una misión de campaña jugada con la interfaz real: ficha de resultado, estrellas, logros y botón de siguiente misión. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp } from '../../backend/src/app.js';
import { loadConfig } from '../../backend/src/config.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, location: dom.window.location });
const { GameView } = await import('../public/js/game-view.js');
const { CAMPAIGNS } = await import('../../backend/src/domain/campaigns.js');
const { CELL } = await import('../../backend/src/domain/board.js');
const { getStory } = await import('../../backend/src/content/index.js');
const { publicCampaigns } = await import('../../backend/src/domain/campaigns.js');
const { publicLaminas } = await import('../../backend/src/domain/laminas.js');
const { settings } = await import('../public/js/settings.js');

let srv; let base;
before(async () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  config.aiWorkers = 0; config.guestAiDaily = 0; config.wsMessagesPerSecond = 10_000;
  config.timing = { turnMs: 0, placementMs: 0, graceMs: 500, aiThinkMs: [1, 3], idleMs: 60_000 };
  srv = await createApp({ config, bcryptRounds: 4 });
  await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
  base = srv.server.address().port;
});
after(async () => { await srv.close(); });

const $ = (s) => document.querySelector(s);

/**
 * Bot de prueba: ataca alrededor de cada acierto sin hundir y, si no hay, «caza» en tablero de ajedrez.
 * (Disparar casilla por casilla en orden perdía ~20 % de las partidas contra la IA y la prueba esperaba para siempre.)
 */
function pickTarget(shots, size) {
  const free = (r, c) => r >= 0 && c >= 0 && r < size && c < size && shots[r * size + c] === CELL.UNKNOWN;
  for (let i = 0; i < shots.length; i++) {
    if (shots[i] !== CELL.HIT) continue;
    const r = Math.floor(i / size); const c = i % size;
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (free(r + dr, c + dc)) return (r + dr) * size + c + dc;
  }
  for (let i = 0; i < shots.length; i++) if (free(Math.floor(i / size), i % size) && (Math.floor(i / size) + (i % size)) % 2 === 0) return i;
  return shots.findIndex((v) => v === CELL.UNKNOWN);
}

test('misión: barra de objetivos, resultado con estrellas, logros y siguiente misión', async () => {
  const reg = await fetch(`http://127.0.0.1:${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'misionera@ejemplo.com', username: 'misionera', password: 'secreto123' }) });
  const { token } = await reg.json();
  const ws = new WebSocket(`ws://127.0.0.1:${base}/ws`);
  const send = (m) => { ws.send(JSON.stringify(m)); return true; };
  settings.set({ aula: true }); // modo aula: al ganar aparecen las preguntas
  const lamina = [];
  const view = new GameView({ send, onLeave() {} });
  const achievements = [];
  view.hooks = { catalog: () => ({ campaigns: publicCampaigns(), laminas: publicLaminas() }), signedIn: () => true, onAchievements: (l) => achievements.push(...l), onNextMission() {}, onLamina: (l) => lamina.push([l.id]),
    quiz: async (campaignId, missionId, answers) => (await fetch(`http://127.0.0.1:${base}/api/quiz`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ campaignId, missionId, answers }) })).json() };

  let final;
  // El cronómetro es holgado a propósito: en equipos de un solo núcleo la partida completa tarda más. Pase lo que pase se cierra el WebSocket.
  try { final = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 90_000);
    let sawBar = false; let sawShots = false;
    ws.onopen = () => send({ t: 'hello', auth: token });
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') send({ t: 'mission', campaign: 'chaco', mission: 1 });
      if (m.t === 'fleet') { view.onFleet(m.ships); return; }
      if (m.t !== 'state') return;
      view.render(m);
      if (m.mission && !$('#mission-bar').hidden) sawBar = true;
      if (m.status === 'placing' && !m.game.ready.A) {
        $('#btn-random').click();
        setTimeout(() => $('#btn-ready').click(), 80);
      }
      if (m.status === 'battle' && m.game.turn === 'A') {
        sawShots = true;
        const size = m.game.size; const shots = m.game.boards.B.shots;
        const i = pickTarget(shots, size);
        send({ t: 'fire', row: Math.floor(i / size), col: i % size });
      }
      if (m.status === 'over' && m.result?.mission?.saved) { clearTimeout(timer); resolve({ m, sawBar, sawShots }); }
    };
  }); } catch (err) { view.destroy(); ws.close(); throw err; }

  assert.ok(final.sawBar, 'la barra de misión aparece durante la partida');
  for (const id of ['#mission-bar', '#mission-result', '#narrator']) assert.ok(!/\bnull\b|\bundefined\b/.test($(id).textContent), `${id} no debe mostrar «null»`);
  const s = final.m;
  assert.equal(s.mission.title, 'Boquerón');
  assert.equal(s.game.winner, 'A', 'ganar disparando casilla por casilla en 8×8 siempre es posible');
  assert.ok(!$('#mission-result').hidden);
  assert.ok($('#mission-result').textContent.includes('Misión cumplida'));
  assert.equal($('#mission-result').querySelectorAll('.stars .on').length, s.result.mission.stars);
  assert.equal($('#mission-result').querySelectorAll('.objs li').length, 3);
  assert.match($('#mission-result').textContent, /Progreso guardado/);
  assert.ok($('#mission-result .debrief')?.textContent.length > 10, 'cierre histórico');
  assert.ok(!$('#btn-next-mission').hidden, 'hay siguiente misión');
  // narración, resultado histórico, lámina de recompensa y preguntas del modo aula
  assert.ok(!$('#narrator').hidden, 'el panel de narración está visible');
  assert.match($('#n-meta').textContent, /1932/);
  assert.match($('#mission-result .story-real').textContent, /victoria paraguaya/i);
  const reward = $('#mission-result .lam-reward');
  assert.ok(reward, 'lámina ganada');
  assert.equal(reward.querySelector('img').getAttribute('src'), 'img/laminas-hd/min/chaco-1.webp');
  assert.match(reward.textContent, /Lámina ganada/);
  assert.doesNotMatch(reward.textContent, /dorada/, 'ya no hay versión dorada aparte');
  reward.querySelector('button').click();
  assert.deepEqual(lamina[0], ['chaco-1'], 'se entrega siempre la misma lámina, tenga las estrellas que tenga');
  assert.equal($('#mission-result').querySelectorAll('.quiz .quiz-q').length, 2, 'dos preguntas de comprensión');
  // el cuestionario se corrige en el servidor: contesta bien, comprueba y se guarda en la cuenta
  const right = getStory('chaco', 1).quiz.map((q) => q.answer);
  $('#mission-result').querySelectorAll('.quiz .quiz-q').forEach((fs, i) => { const inp = fs.querySelectorAll('input')[right[i]]; inp.checked = true; inp.dispatchEvent(new dom.window.Event('change')); });
  [...$('#mission-result').querySelectorAll('.quiz button')].find((b) => b.textContent === 'Comprobar').click();
  for (let i = 0; i < 50 && !/correctas/.test($('#mission-result .quiz-result')?.textContent ?? ''); i++) await new Promise((r) => setTimeout(r, 40));
  assert.match($('#mission-result .quiz-result').textContent, /2 de 2 correctas\. Tu resultado quedó guardado/);
  assert.ok(achievements.some((a) => a.id === 'quiz_ace'), 'se avisa del logro «Buen alumno»');
  assert.equal($('#btn-rematch').hidden, false);
  assert.ok(achievements.some((a) => a.id === 'first_mission'), 'aviso de logro');
  assert.ok(CAMPAIGNS[0].missions.length === 6);
  view.destroy();
  ws.close();
});
