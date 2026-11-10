import { $, add, clear, el } from './dom.js';
import { settings } from './settings.js';
import { onSpeech, speak, stopSpeaking } from './voice.js';
import { militaryText } from './military-voice.js';

/**
 * Narración de las misiones: durante la partida muestra una frase corta cuando ocurre algo importante
 * (primer impacto, primera unidad hundida, mitad de la flota rival, victoria...), y en el modo aula agrega
 * lectura guiada antes de la misión y preguntas al ganar.
 * Los textos vienen del servidor (backend/src/content); aquí solo se decide cuándo mostrarlos.
 */

/**
 * Eventos de narración que ya ocurrieron en esta partida (pura: solo mira el estado que envía el servidor).
 * @param {object} s  estado de la sala
 * @param {'A'|'B'|null} me
 * @returns {string[]} claves en orden de aparición (ver EVENT_KEYS del servidor)
 */
export function eventsReached(s, me) {
  if (!s?.mission || !me || !s.game) return [];
  const g = s.game;
  const enemy = me === 'A' ? 'B' : 'A';
  const mine = g.boards?.[me]?.fleet ?? [];
  const theirs = g.boards?.[enemy]?.fleet ?? [];
  const total = theirs.length;
  const sunk = theirs.filter((u) => u.sunk).length;
  const lost = mine.filter((u) => u.sunk).length;
  const out = [];
  if (s.status === 'battle' || s.status === 'over') out.push('start');
  if ((g.stats?.[me]?.hits ?? 0) >= 1) out.push('firstHit');
  if (sunk >= 1) out.push('firstSunk');
  if (lost >= 1) out.push('firstLoss');
  if (total >= 2 && sunk * 2 >= total && sunk < total) out.push('half');
  if (sunk >= 1 && total - sunk === 1) out.push('last');
  if (s.status === 'over') out.push(g.winner === me ? 'win' : 'lose');
  return out;
}

/** Escribe un texto letra a letra; devuelve una función para completarlo de golpe. */
export function typeInto(node, text, { cps = 70, instant = false, onDone = () => {} } = {}) {
  if (instant || !text) { node.textContent = text; onDone(); return () => {}; }
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    node.textContent = text.slice(0, i);
    if (i >= text.length) { clearInterval(id); onDone(); }
  }, 1000 / cps);
  id.unref?.();
  return () => { clearInterval(id); node.textContent = text; onDone(); };
}

/**
 * Narrador con cara: un oficial por campaña (hoja de 6 cuadros en img/narrador-<campaña>.png).
 * Cuadros: 0 boca cerrada · 1 entreabierta · 2 abierta («a») · 3 redonda («o») · 4 parpadeo · 5 cabeceo.
 * Mientras habla mueve la boca (cuadros 1-3 al azar, con algún parpadeo); en reposo queda en el 0 y parpadea de vez en cuando.
 */
export const NARRATOR_SPRITES = Object.freeze({ chaco: 'chaco', siglo19: 'siglo19', corso: 'corso', litoral: 'litoral' });
const FRAMES = 6;
const MOUTH = [1, 2, 3, 2, 1, 3, 2, 1];

export class Avatar {
  /** @param {HTMLElement|null} node */
  constructor(node) { this.node = node; this.talking = false; this.timer = null; this.frame = 0; this.n = 0; this.campaign = null; }

  /** Cambia de personaje según la campaña (si no hay uno para ella, el panel se queda sin cara). */
  setCampaign(id) {
    if (!this.node || id === this.campaign) return;
    this.campaign = id;
    const sprite = NARRATOR_SPRITES[id];
    this.node.hidden = !sprite;
    if (sprite) this.node.style.backgroundImage = `url("img/narrador-${sprite}.png")`;
    this.#draw(0);
  }

  #draw(f) {
    this.frame = f;
    // Hoja de 6 cuadros en horizontal: el cuadro f ocupa de f/(6-1) a (f+1)/6 del ancho
    this.node?.style.setProperty('background-position', `${(f / (FRAMES - 1)) * 100}% 0`);
  }

  /** Empieza o termina de hablar. Con animaciones apagadas (o «reducir movimiento») la cara no se mueve. */
  setTalking(on) {
    on = Boolean(on) && settings.get().animations !== 'off';
    if (on === this.talking) return;
    this.talking = on;
    clearInterval(this.timer);
    this.timer = null;
    if (!this.node) return;
    this.node.classList.toggle('talking', on);
    if (!on) { this.#draw(0); return; }
    this.timer = setInterval(() => { this.n += 1; this.#draw(this.n % 11 === 10 ? 4 : MOUTH[this.n % MOUTH.length]); }, 130);
    this.timer.unref?.();
  }
}

/** Datos, resultado histórico y fuentes de una historia, dentro de `box`. Todo se arma sin innerHTML. */
export function renderStoryDetails(box, story) {
  clear(box);
  if (!story) return box;
  add(box,
    el('p', { class: 'story-real' }, story.real),
    story.date ? el('p', { class: 'muted small' }, `${story.date} · ${story.place}`) : null,
    story.facts?.length ? el('ul', { class: 'story-facts' }, story.facts.map((f) => el('li', {}, f))) : null);
  if (story.glossary?.length) {
    add(box, el('h4', {}, 'Glosario'), el('dl', { class: 'story-gloss' }, story.glossary.flatMap((g) => [el('dt', {}, g.term), el('dd', {}, g.def)])));
  }
  if (story.sources?.length) {
    box.append(el('h4', {}, 'Fuentes consultadas'),
      el('ul', { class: 'story-sources' }, story.sources.map((s) => el('li', {},
        s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title) : s.title))));
  }
  return box;
}

/**
 * Preguntas de comprensión (modo aula). Las respuestas correctas NO están en el navegador: `grade(answers)` las manda al
 * servidor (POST /api/quiz) y recibe `{ correct, total, details:[{ok, right, why}], saved, newAchievements }`.
 * @param {HTMLElement} box
 * @param {{q:string, options:string[]}[]} quiz
 * @param {(answers:number[]) => Promise<object>} grade
 * @param {(result:object) => void} [onDone]
 */
export function renderQuiz(box, quiz, grade, onDone = () => {}) {
  clear(box);
  if (!quiz?.length) return box;
  const answers = quiz.map(() => null);
  const check = el('button', { type: 'button', class: 'btn small primary', disabled: true }, 'Comprobar');
  const result = el('p', { class: 'quiz-result', role: 'status' });
  box.append(el('h4', {}, 'Preguntas'));
  quiz.forEach((q, i) => {
    const name = `quiz-${i}-${Math.random().toString(36).slice(2, 7)}`;
    box.append(el('fieldset', { class: 'quiz-q' },
      el('legend', {}, q.q),
      q.options.map((opt, k) => el('label', { class: 'quiz-opt' },
        el('input', { type: 'radio', name, value: String(k), onchange: () => { answers[i] = k; check.disabled = answers.some((a) => a === null); } }),
        el('span', {}, opt))),
      el('p', { class: 'quiz-why muted small', hidden: true })));
  });
  check.addEventListener('click', async () => {
    check.disabled = true;
    result.textContent = 'Comprobando…';
    let r;
    try { r = await grade(answers.slice()); } catch (err) {
      result.textContent = err?.code === 'sin_conexion' ? 'Necesitas conexión para comprobar las respuestas.' : 'No se pudo comprobar. Inténtalo de nuevo.';
      check.disabled = false;
      return;
    }
    [...box.querySelectorAll('.quiz-q')].forEach((fs, i) => {
      const d = r.details[i];
      fs.classList.add(d.ok ? 'right' : 'wrong');
      fs.querySelectorAll('.quiz-opt')[d.right]?.classList.add('is-right');
      const why = fs.querySelector('.quiz-why');
      why.hidden = false;
      why.textContent = `${d.ok ? '✓ Correcto. ' : '✗ '}${d.why}`;
      fs.querySelectorAll('input').forEach((inp) => { inp.disabled = true; });
    });
    result.textContent = `${r.correct} de ${r.total} correctas. ${r.saved ? 'Tu resultado quedó guardado.' : 'Inicia sesión para guardar tu resultado.'}`;
    onDone(r);
  });
  box.append(check, result);
  return box;
}

/** Panel de narración dentro de la pantalla de partida. */
export class Narrator {
  /** @param {{getStory:(m:object)=>object|null}} deps */
  constructor({ getStory }) {
    this.getStory = getStory;
    this.key = null;
    this.fired = new Set();
    this.lines = [];
    this.finish = () => {};
    this.hidden = false; // el jugador lo ocultó con la «×» (hasta la próxima misión)
    this.avatar = new Avatar($('#n-avatar'));
    this.typing = false;   // el texto se está escribiendo
    this.speaking = false; // la voz está leyendo
    onSpeech((on) => { this.speaking = on; this.#syncAvatar(); });
    $('#n-close')?.addEventListener('click', () => { this.hidden = true; this.#visible(false); });
    $('#n-facts')?.addEventListener('click', () => this.openFacts());
    $('#n-text')?.addEventListener('click', () => this.finish());
    $('#story-close')?.addEventListener('click', () => { const d = $('#story-dialog'); if (d.close) d.close(); else d.removeAttribute('open'); });
  }

  #visible(v) { const p = $('#narrator'); if (p) p.hidden = !v; }

  /** La cara mueve la boca mientras se escribe el texto o suena la voz. */
  #syncAvatar() { this.avatar.setTalking(this.typing || this.speaking); }

  /** Se llama en cada estado nuevo de la sala. */
  update(s, me) {
    const key = s.mission ? `${s.room}:${s.round}:${s.mission.campaignId}:${s.mission.missionId}` : null;
    if (key !== this.key) {
      this.key = key; this.fired = new Set(); this.lines = []; this.hidden = false; this.finish(); stopSpeaking();
      this.typing = false; this.speaking = false; this.#syncAvatar();
      const log = $('#n-log'); if (log) clear(log);
    }
    this.currentMission = s.mission;
    this.avatar.setCampaign(s.mission?.campaignId ?? null);
    const story = s.mission ? this.getStory(s.mission) : null;
    if (!key || !story || !me || !settings.get().narration) { this.#visible(false); return; }
    const fresh = eventsReached(s, me).filter((k) => !this.fired.has(k));
    for (const k of fresh) this.fired.add(k);
    const texts = fresh.map((k) => ({ event: k, text: story.events?.[k] })).filter((item) => Boolean(item.text));
    $('#n-meta').textContent = `${story.date} · ${story.place}`;
    if (texts.length) this.#show(texts);
    this.#visible(!this.hidden && this.lines.length > 0);
  }

  #show(texts) {
    this.lines.push(...texts.map(({ text }) => text));
    const log = clear($('#n-log'));
    for (const t of this.lines.slice(-4, -1)) log.append(el('li', {}, t));
    const { event, text: last } = texts.at(-1);
    this.finish();
    const sr = $('#n-sr');
    speak(militaryText(last, event));
    if (sr) sr.textContent = last; // lector de pantalla: la frase completa, una sola vez (el texto visible se escribe letra a letra)
    const reduce = settings.get().animations === 'off';
    this.typing = !reduce;
    this.#syncAvatar();
    this.finish = typeInto($('#n-text'), last, { instant: reduce, onDone: () => { this.typing = false; this.#syncAvatar(); } });
  }

  openFacts() {
    const story = this.getStory?.(this.currentMission ?? {}) ?? null;
    if (!story) return;
    renderStoryDetails($('#story-body'), story);
    const d = $('#story-dialog');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
}
