/** Narración de misiones, modo aula (preguntas) y detalle de fuentes. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { getStory, publicStory } from '../../backend/src/content/index.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, location: dom.window.location, localStorage: dom.window.localStorage });
const { Narrator, eventsReached, renderQuiz, renderStoryDetails, typeInto } = await import('../public/js/narrator.js');
const { gradeQuiz } = await import('../../backend/src/domain/quiz.js');
const { settings } = await import('../public/js/settings.js');
const $ = (s) => document.querySelector(s);

const fleet = (n, sunk = 0) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, length: 2, sunk: i < sunk }));
const state = ({ status = 'battle', enemy = fleet(4), mine = fleet(4), hits = 0, winner = null, round = 1 } = {}) => ({
  room: 'ABCD', round, status, you: 'A', mission: { campaignId: 'chaco', missionId: 1 },
  game: { winner, boards: { A: { fleet: mine }, B: { fleet: enemy } }, stats: { A: { hits }, B: { hits: 0 } } },
});

test('eventsReached: cada hito aparece cuando le toca y nunca antes', () => {
  assert.deepEqual(eventsReached(state(), 'A'), ['start']);
  assert.deepEqual(eventsReached(state({ status: 'placing' }), 'A'), []);
  assert.deepEqual(eventsReached(state({ hits: 1 }), 'A'), ['start', 'firstHit']);
  assert.deepEqual(eventsReached(state({ hits: 2, enemy: fleet(4, 1) }), 'A'), ['start', 'firstHit', 'firstSunk']);
  assert.deepEqual(eventsReached(state({ hits: 5, enemy: fleet(4, 2) }), 'A'), ['start', 'firstHit', 'firstSunk', 'half']);
  assert.deepEqual(eventsReached(state({ hits: 8, enemy: fleet(4, 3) }), 'A'), ['start', 'firstHit', 'firstSunk', 'half', 'last']);
  assert.ok(eventsReached(state({ mine: fleet(4, 1) }), 'A').includes('firstLoss'));
  assert.deepEqual(eventsReached(state({ status: 'over', winner: 'A', enemy: fleet(4, 4), hits: 9 }), 'A').slice(-1), ['win']);
  assert.deepEqual(eventsReached(state({ status: 'over', winner: 'B', mine: fleet(4, 4) }), 'A').slice(-1), ['lose']);
});

test('eventsReached: sin misión, sin jugador o sin partida no hay narración', () => {
  assert.deepEqual(eventsReached({ ...state(), mission: null }, 'A'), []);
  assert.deepEqual(eventsReached(state(), null), []);
  assert.deepEqual(eventsReached({ status: 'battle', mission: {}, game: null }, 'A'), []);
});

test('«a medias» no se dispara con una sola unidad ni cuando ya se hundió todo', () => {
  assert.ok(!eventsReached(state({ enemy: fleet(1, 0) }), 'A').includes('half'));
  assert.ok(!eventsReached(state({ status: 'over', winner: 'A', enemy: fleet(3, 3) }), 'A').includes('half'));
});

test('typeInto: instantáneo y también completable de golpe', () => {
  const n = document.createElement('p');
  typeInto(n, 'hola', { instant: true });
  assert.equal(n.textContent, 'hola');
  const finish = typeInto(n, 'una frase larga', { cps: 5 });
  assert.notEqual(n.textContent, 'una frase larga');
  finish();
  assert.equal(n.textContent, 'una frase larga');
});

test('renderStoryDetails: muestra datos y fuentes, con enlaces seguros y sin interpretar HTML', () => {
  const box = document.createElement('div');
  renderStoryDetails(box, { real: 'Resultado: X', date: '1932', place: 'Chaco', facts: ['<img src=x onerror=alert(1)> dato'],
    sources: [{ title: 'Fuente <b>uno</b>', url: 'https://example.org/a' }, { title: 'Libro sin enlace' }] });
  assert.equal(box.querySelectorAll('img, b').length, 0, 'el HTML se muestra como texto');
  assert.match(box.textContent, /<img src=x onerror=alert\(1\)> dato/);
  const a = box.querySelector('a');
  assert.equal(a.getAttribute('href'), 'https://example.org/a');
  assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(a.getAttribute('target'), '_blank');
  assert.equal(box.querySelectorAll('.story-sources li').length, 2);
  renderStoryDetails(box, null);
  assert.equal(box.children.length, 0);
});

test('renderQuiz: se habilita al responder todo, pide la corrección al servidor y marca lo correcto', async () => {
  const quiz = publicStory(getStory('siglo19', 1)).quiz;
  assert.ok(quiz.every((q) => !('answer' in q) && !('why' in q)), 'el navegador no recibe respuestas');
  const box = document.createElement('div');
  document.body.append(box);
  const asked = [];
  let result = null;
  const grade = async (answers) => { asked.push(answers); return { ...gradeQuiz('siglo19', 1, answers), saved: true, newAchievements: [] }; };
  renderQuiz(box, quiz, grade, (r) => { result = r; });
  const check = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar');
  assert.equal(check.disabled, true);
  const real = getStory('siglo19', 1).quiz;
  const pick = (q, k) => { const input = box.querySelectorAll('.quiz-q')[q].querySelectorAll('input')[k]; input.checked = true; input.dispatchEvent(new dom.window.Event('change')); };
  pick(0, real[0].answer);
  assert.equal(check.disabled, true, 'falta una pregunta');
  pick(1, (real[1].answer + 1) % real[1].options.length);
  assert.equal(check.disabled, false);
  check.click();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(asked, [[real[0].answer, (real[1].answer + 1) % real[1].options.length]]);
  assert.equal(result.correct, 1);
  assert.match(box.textContent, /1 de 2 correctas\. Tu resultado quedó guardado/);
  assert.equal(box.querySelectorAll('.quiz-q.right').length, 1);
  assert.equal(box.querySelectorAll('.quiz-q.wrong').length, 1);
  assert.equal(box.querySelectorAll('.quiz-opt.is-right').length, 2, 'se marca la opción correcta de cada pregunta');
  assert.ok([...box.querySelectorAll('input')].every((i) => i.disabled), 'no se puede cambiar después de comprobar');
  box.remove();
});

test('renderQuiz: si falla la conexión avisa y deja reintentar; un invitado ve el aviso de no guardado', async () => {
  const quiz = publicStory(getStory('chaco', 5)).quiz;
  const box = document.createElement('div');
  document.body.append(box);
  let fail = true;
  const grade = async (answers) => {
    if (fail) { const e = new Error('x'); e.code = 'sin_conexion'; throw e; }
    return { ...gradeQuiz('chaco', 5, answers), saved: false, newAchievements: [] };
  };
  renderQuiz(box, quiz, grade);
  box.querySelectorAll('.quiz-q').forEach((fs) => { const i = fs.querySelector('input'); i.checked = true; i.dispatchEvent(new dom.window.Event('change')); });
  const check = [...box.querySelectorAll('button')].find((b) => b.textContent === 'Comprobar');
  check.click();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(box.textContent, /Necesitas conexión/);
  assert.equal(check.disabled, false, 'se puede reintentar');
  fail = false;
  check.click();
  await new Promise((r) => setTimeout(r, 10));
  assert.match(box.textContent, /Inicia sesión para guardar/);
  box.remove();
});

test('Narrator: muestra cada frase una vez, la oculta con «×» y se reinicia en cada partida', () => {
  settings.reset();
  settings.set({ animations: 'off' }); // sin máquina de escribir: el texto sale completo
  const story = publicStory(getStory('chaco', 1));
  const n = new Narrator({ getStory: () => story });
  assert.equal($('#narrator').hidden, true);

  n.update(state({ status: 'placing' }), 'A');
  assert.equal($('#narrator').hidden, true, 'todavía no empezó la batalla');

  n.update(state(), 'A');
  assert.equal($('#narrator').hidden, false);
  assert.equal($('#n-text').textContent, story.events.start);
  assert.equal($('#n-sr').textContent, story.events.start, 'el lector de pantalla recibe la frase completa');
  assert.equal($('#n-text').getAttribute('aria-hidden'), 'true', 'el texto que se escribe letra a letra no se anuncia');
  assert.match($('#n-meta').textContent, /Boquerón/);

  n.update(state({ hits: 1 }), 'A');
  assert.equal($('#n-text').textContent, story.events.firstHit);
  assert.equal($('#n-log').children.length, 1, 'la frase anterior queda en el registro');

  n.update(state({ hits: 1 }), 'A'); // mismo estado: no repite
  assert.equal($('#n-log').children.length, 1);

  $('#n-close').click();
  assert.equal($('#narrator').hidden, true);
  n.update(state({ hits: 2, enemy: fleet(4, 1) }), 'A');
  assert.equal($('#narrator').hidden, true, 'sigue oculto hasta la próxima partida');

  n.update(state({ round: 2 }), 'A');
  assert.equal($('#narrator').hidden, false, 'nueva ronda: vuelve a mostrarse');
  assert.equal($('#n-text').textContent, story.events.start);
});

test('Narrator: respeta el ajuste «Narración» y no aparece fuera de las misiones', () => {
  settings.reset();
  settings.set({ animations: 'off', narration: false });
  const story = publicStory(getStory('chaco', 1));
  const n = new Narrator({ getStory: () => story });
  n.update(state(), 'A');
  assert.equal($('#narrator').hidden, true);
  settings.set({ narration: true });
  n.update({ ...state(), mission: null }, 'A');
  assert.equal($('#narrator').hidden, true, 'una partida normal no tiene narración');
});

test('«Datos y fuentes» abre el diálogo con la historia de la misión en curso', () => {
  settings.reset();
  settings.set({ animations: 'off' });
  const story = publicStory(getStory('chaco', 5));
  const n = new Narrator({ getStory: () => story });
  n.update({ ...state(), mission: { campaignId: 'chaco', missionId: 5 } }, 'A');
  $('#n-facts').click();
  assert.equal($('#story-dialog').hasAttribute('open'), true);
  assert.match($('#story-body').textContent, /mayo de 1934|20 de mayo/);
  assert.ok($('#story-body').querySelectorAll('a[href^="https://"]').length >= 1);
});
