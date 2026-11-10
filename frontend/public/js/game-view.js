import { capitalize, termsFor } from './biomes.js';
import { applySprite, atlas, tileFor, unitSpec } from './atlas.js';
import { createBoard } from './board.js';
import { $, add, clear, el, toast } from './dom.js';
import { impact, muzzle, popText, projectile, screenFlash, shake } from './fx.js';
import { THUMB, laminaThumbUrl } from './laminas.js';
import { Narrator, renderQuiz } from './narrator.js';
import { settings } from './settings.js';
import { REASONS } from './messages.js';
import { prefersReducedMotion } from './atlas.js';
import { Draft } from './placement.js';
import { unitImage } from './sprites.js';

const other = (side) => (side === 'A' ? 'B' : 'A');
const fmt = (n) => new Intl.NumberFormat('es').format(n);

/**
 * Pantalla de partida. Recibe el estado completo del servidor (render) y lo dibuja;
 * lo único que envía son acciones del jugador (colocar, disparar, revancha...).
 */
export class GameView {
  /** @param {{send:(m:object)=>boolean, sound?:{play:(n:string)=>void}, onLeave:()=>void}} deps */
  constructor({ send, sound = { play() {} }, onLeave }) {
    this.send = send;
    this.sound = sound;
    this.onLeave = onLeave;
    this.state = null;
    this.draft = null;
    this.draftKey = null;
    this.hover = null;
    this.drag = null;
    this.ignorePlacementClicksUntil = 0;
    this.boards = {};
    this.deadlineAt = null;
    this.timerKind = '';
    this.lastKey = null;
    this.fxKey = null;
    this.hold = null;      // { side, index, ships }: lo que todavía no se debe mostrar porque el disparo está en vuelo
    this.shotToken = 0;
    this.hooks = { catalog: () => null, onNextMission() {}, onAchievements() {}, onLamina() {}, quiz: async () => { throw new Error('sin_cuestionario'); } };
    this.streak = { key: null, n: 0 };   // aciertos seguidos del jugador en esta partida
    this.quiz = { key: null, node: null }; // preguntas del modo aula (se conservan mientras se ve el resultado)
    this.narrator = new Narrator({ getStory: (m) => this.#storyOf(m) });
    this.ticker = setInterval(() => this.#tick(), 250);
    this.#bind();
  }

  destroy() {
    this.shotToken += 1;
    clearInterval(this.ticker);
    document.removeEventListener('keydown', this.keyHandler);
    $('#board-place').removeEventListener('pointerdown', this.dragStartHandler);
    $('#fleet-pick').removeEventListener('pointerdown', this.dragStartHandler);
    window.removeEventListener('pointermove', this.dragMoveHandler);
    window.removeEventListener('pointerup', this.dragEndHandler);
    window.removeEventListener('pointercancel', this.dragCancelHandler);
    window.removeEventListener('blur', this.dragCancelHandler);
    Object.values(this.boards).forEach((board) => board?.destroy());
    this.drag = null;
  }

  setReactions(list) {
    const bar = clear($('#react-bar'));
    for (const e of list) {
      bar.append(el('button', { type: 'button', class: 'react', 'aria-label': `Reaccionar con ${e}`, onclick: () => this.send({ t: 'react', e }) }, e));
    }
  }

  #bind() {
    $('#btn-rotate').addEventListener('click', () => { this.draft?.rotate(); this.#paintPlacement(); });
    $('#btn-random').addEventListener('click', () => this.send({ t: 'randomize' }));
    $('#btn-clear').addEventListener('click', () => { this.draft?.clear(); this.#paintPlacement(); });
    $('#btn-ready').addEventListener('click', () => {
      if (this.draft?.complete) this.send({ t: 'ready', ships: this.draft.toShips() });
    });
    $('#btn-rematch').addEventListener('click', () => this.send({ t: 'rematch' }));
    $('#btn-leave').addEventListener('click', () => this.onLeave());
    $('#btn-leave-over').addEventListener('click', () => this.onLeave());
    $('#btn-copy').addEventListener('click', async () => {
      const link = `${location.origin}/?sala=${this.state?.room ?? ''}`;
      try { await navigator.clipboard.writeText(link); toast('Enlace copiado'); } catch { toast(link, 8000); }
    });
    this.keyHandler = (e) => {
      if ((e.key === 'r' || e.key === 'R') && !e.target.closest?.('input, textarea, select')) {
        this.draft?.rotate();
        this.#paintPlacement();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
    // Pointer Events cubre mouse, táctil y lápiz con un único flujo. Los escuchas
    // viven en nodos estables: no se duplican al repintar la lista o el tablero.
    this.dragStartHandler = (e) => this.#dragStart(e);
    this.dragMoveHandler = (e) => this.#dragMove(e);
    this.dragEndHandler = (e) => this.#dragEnd(e);
    this.dragCancelHandler = (e) => this.#dragCancel(e);
    $('#board-place').addEventListener('pointerdown', this.dragStartHandler);
    $('#fleet-pick').addEventListener('pointerdown', this.dragStartHandler);
    window.addEventListener('pointermove', this.dragMoveHandler, { passive: false });
    window.addEventListener('pointerup', this.dragEndHandler);
    window.addEventListener('pointercancel', this.dragCancelHandler);
    window.addEventListener('blur', this.dragCancelHandler);
  }

  /** Servidor → propuesta de flota aleatoria para el borrador. */
  onFleet(ships) {
    if (!this.draft) return;
    this.draft.load(ships);
    this.#paintPlacement();
  }

  onReact({ e }) {
    const span = el('span', { class: 'float-react', 'aria-hidden': 'true' }, e);
    span.style.setProperty('--x', `${10 + Math.random() * 80}%`);
    $('#reactions').append(span);
    setTimeout(() => span.remove(), 2200);
  }

  // ------------------------------------------------------------------ render
  render(s) {
    const prev = this.state;
    this.state = s;
    if (s.status === 'waiting' || s.status === 'placing') { this.hold = null; this.shotToken += 1; }
    const g = s.game;
    const isPlayer = s.you === 'A' || s.you === 'B';
    const me = isPlayer ? s.you : null;
    const placingNow = s.status === 'placing' && isPlayer && !g.ready[me];

    $('#room-code').textContent = s.room;
    $('#spectators').textContent = s.spectators ? `👁 ${s.spectators}` : '';
    $('#spectators').hidden = !s.spectators;
    this.deadlineAt = s.timeLeft != null ? performance.now() + s.timeLeft : null;
    this.timerKind = s.status === 'placing' ? 'Colocación' : 'Tu turno';
    if (s.status === 'battle' && g.turn !== me) this.timerKind = 'Turno rival';

    this.#players(s);
    this.#banner(s, me);
    this.#missionBar(s);
    this.narrator.update(s, me);

    $('#panel-waiting').hidden = s.status !== 'waiting';
    $('#panel-placing').hidden = !placingNow;
    $('#panel-battle').hidden = !g || placingNow;
    $('#panel-over').hidden = s.status !== 'over';
    $('#react-bar').hidden = !g || s.status === 'waiting';

    if (placingNow) this.#enterPlacing(s);
    else {
      this.draft = null; this.drag = null; this.hover = null;
      $('#board-place').classList.remove('dragging');
      $('#fleet-pick').classList.remove('dragging');
    }
    const fresh = g && !placingNow ? this.#newShot(prev, s) : null;
    if (g && !placingNow) this.#paintBattle(s, me);
    if (fresh) this.#animateShot(prev, s, me, fresh);
    if (s.status === 'over') this.#result(s, me);
    this.#feedback(prev, s, me);
    this.#tick();
  }

  #players(s) {
    const box = clear($('#players'));
    const g = s.game;
    for (const side of ['A', 'B']) {
      const p = s.players[side];
      const turn = g?.status === 'battle' && g.turn === side;
      const card = el('div', { class: `pcard${turn ? ' turn' : ''}${side === s.you ? ' me' : ''}`, id: `pcard-${side}` });
      if (!p) {
        card.append(el('div', { class: 'pname muted' }, 'Esperando rival…'));
      } else {
        card.append(
          el('span', { class: 'avatar' }, p.avatar || '🙂'),
          el('div', { class: 'pinfo' },
            el('div', { class: 'pname', title: p.officer ? `${p.name} — ${p.role}` : null },
              p.name, side === s.you ? el('em', {}, ' (tú)') : null,
              // En una misión el nombre es el del jefe del bando: sin etiquetas de «IA» ni «invitado»; en su lugar, una de «ficción» si el nombre es inventado.
              p.officer ? (p.invented ? el('span', { class: 'tag', title: 'Nombre inventado: no es una persona real' }, 'ficción') : null)
                : p.isAi ? el('span', { class: 'tag' }, 'IA') : (p.registered ? null : el('span', { class: 'tag' }, 'invitado'))),
            el('div', { class: `pmeta muted small${p.officer ? ' role' : ''}`, title: p.officer ? p.role : null },
              p.officer ? p.role : (p.registered ? `Elo ${p.rating}` : null),
              p.left ? ' · salió' : (!p.online ? ' · sin conexión' : null),
              s.status === 'placing' ? (p.ready ? ' · flota lista ✓' : ' · colocando…') : null)),
          el('div', { class: 'pscore', title: 'Partidas ganadas en esta sala' }, String(s.wins[side])));
      }
      box.append(card);
      if (side === 'A') box.append(el('div', { class: 'vs', 'aria-hidden': 'true' }, 'VS'));
    }
  }

  #banner(s, me) {
    const g = s.game;
    const b = $('#banner');
    const name = (side) => s.players[side]?.name ?? '?';
    const t = termsFor(s.biome);
    let text = '';
    let mine = false;
    if (s.status === 'waiting') text = 'Esperando a tu rival…';
    else if (s.status === 'placing') {
      if (!me) text = 'Los jugadores están colocando sus flotas.';
      else text = g.ready[me] ? `${capitalize(t.fleet)} lista. Esperando a ${name(other(me))}…` : `Coloca tu ${t.fleet}. Pulsa R o el botón para girar la ${t.unit === 'barco' ? 'unidad' : 'unidad'}.`;
    } else if (s.status === 'battle') {
      mine = g.turn === me;
      text = !me ? `Turno de ${name(g.turn)}.` : mine ? `Tu turno: elige una casilla en ${t.area}.` : `Turno de ${name(g.turn)}…`;
      const last = this.#describeShot(s);
      if (last) text = `${last} ${text}`;
    } else if (s.status === 'over') {
      text = me ? (g.winner === me ? '¡Victoria!' : 'Derrota.') : `Ganó ${name(g.winner)}.`;
      mine = g.winner === me;
    }
    b.textContent = text;
    b.classList.toggle('mine', mine);
  }

  #describeShot(s) {
    const shot = s.game?.lastShot;
    if (!shot) return '';
    const t = termsFor(s.biome);
    const who = shot.by === s.you ? 'Disparaste' : `${s.players[shot.by]?.name ?? '?'} disparó`;
    const where = `${String.fromCharCode(65 + shot.col)}${shot.row + 1}`;
    const what = shot.result === 'miss' ? t.miss : shot.result === 'hit' ? '¡tocado!' : `¡${t.sunk}! (${shot.ship?.name ?? t.unit})`;
    const extra = shot.by === s.you && shot.result !== 'miss' && s.status === 'battle'
      && s.game?.hitKeepsTurn && s.game?.turn === shot.by ? ' ¡Impacto! Tienes otro disparo.' : '';
    return `${who} a ${where}: ${what}.${extra}`;
  }

  // ------------------------------------------------------------------ colocación
  #enterPlacing(s) {
    const g = s.game;
    const me = s.you;
    const key = `${s.room}:${s.round}:${g.size}:${s.biome}`;
    if (this.draftKey !== key || !this.draft) {
      this.draftKey = key;
      this.draft = new Draft(g.size, g.boards[me].fleet.map(({ id, length, name }) => ({ id, length, name })));
      this.hover = null;
      this.drag = null;
      this.ignorePlacementClicksUntil = 0;
      this.boards.place = createBoard($('#board-place'), g.size, {
        biome: s.biome ?? 'water',
        onCell: (r, c) => { if (Date.now() >= this.ignorePlacementClicksUntil) this.#placeClick(r, c); },
        onHover: (r, c) => { if (!this.drag) { this.hover = [r, c]; this.#paintPlacement(); } },
        onLeave: () => { if (!this.drag) { this.hover = null; this.#paintPlacement(); } },
      });
    }
    this.#paintPlacement();
  }

  /** Casilla bajo el puntero, usando rectángulos reales (incluyen etiquetas y escalado del móvil). */
  #cellFromPointer(x, y) {
    const board = this.boards.place;
    if (!board?.cells?.length) return null;
    const first = board.cells[0].getBoundingClientRect();
    const last = board.cells[board.cells.length - 1].getBoundingClientRect();
    const width = last.right - first.left;
    const height = last.bottom - first.top;
    if (width <= 0 || height <= 0 || x < first.left || y < first.top || x >= last.right || y >= last.bottom) return null;
    return [Math.floor((y - first.top) * board.size / height), Math.floor((x - first.left) * board.size / width)];
  }

  /** Comienzo de un gesto desde la flota o desde una casilla, sin levantar aún la unidad. */
  #dragStart(e) {
    if (!this.draft || this.state?.status !== 'placing' || this.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const chip = e.target.closest?.('.ship-chip');
    const cell = e.target.closest?.('.cell');
    if (!chip && !cell) return;
    // Un gesto NUEVO siempre es válido, aunque ocurra justo después de arrastrar.
    this.ignorePlacementClicksUntil = 0;
    const d = this.draft;
    const row = cell ? Number(cell.dataset.r) : null;
    const col = cell ? Number(cell.dataset.c) : null;
    const existing = cell ? d.at(row, col) : null;
    const id = chip?.dataset.shipId ?? existing?.id ?? d.selected;
    if (!id || !d.def(id)) return;
    const original = d.placed.get(id);
    this.drag = {
      pointerId: e.pointerId, id, fromChip: Boolean(chip),
      startX: e.clientX, startY: e.clientY, active: false,
      offsetRow: existing?.offsetRow ?? 0, offsetCol: existing?.offsetCol ?? 0,
      horizontal: existing?.horizontal ?? original?.horizontal ?? d.horizontal,
      previousSelection: d.selected, previousOrientation: d.horizontal,
      captureTarget: e.currentTarget, target: null,
    };
  }

  #dragMove(e) {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = this.draft;
    if (!d || this.state?.status !== 'placing') { this.#dragCancel(); return; }
    if (!drag.active && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 7) return;
    if (!drag.active) {
      drag.active = true;
      // Capturamos recién al detectar arrastre real: antes de eso un toque
      // normal debe generar su click sobre la casilla, no sobre el contenedor.
      try { drag.captureTarget?.setPointerCapture?.(drag.pointerId); } catch { /* navegador antiguo */ }
      d.selected = drag.id;
      d.horizontal = drag.horizontal;
      $('#board-place').classList.add('dragging');
      $('#fleet-pick').classList.add('dragging');
    }
    if (e.cancelable) e.preventDefault();
    const cell = this.#cellFromPointer(e.clientX, e.clientY);
    const target = cell ? [cell[0] - drag.offsetRow, cell[1] - drag.offsetCol] : null;
    if (target?.[0] === drag.target?.[0] && target?.[1] === drag.target?.[1] && Boolean(target) === Boolean(drag.target)) return;
    drag.target = target;
    this.hover = target;
    this.#paintPlacement();
  }

  #dragEnd(e) {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      // El click sintético que algunos navegadores lanzan tras el pointerup no debe volver a colocar la unidad.
      this.ignorePlacementClicksUntil = Date.now() + 450;
      if (e.cancelable) e.preventDefault();
      const cell = this.#cellFromPointer(e.clientX, e.clientY);
      const row = cell ? cell[0] - drag.offsetRow : null;
      const col = cell ? cell[1] - drag.offsetCol : null;
      if (cell && this.draft?.drop(drag.id, row, col, drag.horizontal)) {
        // Colocación válida: avanza a la siguiente unidad todavía sin colocar.
      } else if (cell) {
        toast('No se puede colocar ahí. Prueba otra casilla.');
      }
    }
    this.#stopDrag();
  }

  #dragCancel() {
    if (this.drag?.active && this.draft) {
      this.draft.selected = this.drag.previousSelection;
      this.draft.horizontal = this.drag.previousOrientation;
    }
    this.#stopDrag();
  }

  #stopDrag() {
    const drag = this.drag;
    if (drag?.captureTarget) {
      try { if (drag.captureTarget.hasPointerCapture?.(drag.pointerId)) drag.captureTarget.releasePointerCapture(drag.pointerId); } catch { /* puntero ya finalizado */ }
    }
    this.drag = null;
    this.hover = null;
    $('#board-place').classList.remove('dragging');
    $('#fleet-pick').classList.remove('dragging');
    if (this.draft) this.#paintPlacement();
  }

  #placeClick(r, c) {
    const d = this.draft;
    if (!d) return;
    if (!(d.selected && d.placeSelected(r, c))) d.pickAt(r, c);
    this.#paintPlacement();
  }

  #paintPlacement() {
    const d = this.draft;
    const board = this.boards.place;
    if (!d || !board) return;
    const preview = this.hover && d.selected ? d.preview(...this.hover) : null;
    board.paint({ ships: this.drag?.active ? d.shipCells().filter((unit) => unit.id !== this.drag.id) : d.shipCells(), preview });

    const list = clear($('#fleet-pick'));
    for (const def of d.fleet) {
      const placed = d.placed.has(def.id);
      list.append(el('li', {},
        el('button', {
          type: 'button', class: `ship-chip${d.selected === def.id ? ' sel' : ''}${placed ? ' done' : ''}`,
          dataset: { shipId: def.id },
          'aria-pressed': String(d.selected === def.id), onclick: () => { if (Date.now() >= this.ignorePlacementClicksUntil) { d.select(def.id); this.#paintPlacement(); } },
        }, this.#icon(def, 'icon'),
        el('span', {}, def.name), placed ? el('b', {}, ' ✓') : null)));
    }
    $('#fleet-title').textContent = `Tu ${termsFor(this.state?.biome).fleet}`;
    $('#btn-ready').disabled = !d.complete;
    $('#btn-rotate').textContent = d.horizontal ? '↻ Horizontal' : '↻ Vertical';
  }

  // ------------------------------------------------------------------ batalla
  #ensureBoard(key, container, size, handlers) {
    const biome = this.state?.biome ?? 'water';
    const have = this.boards[key];
    if (have?.size !== size || have?.biome !== biome) this.boards[key] = createBoard(container, size, { ...handlers, biome });
    return this.boards[key];
  }

  /** Icono de una unidad (misma imagen que en el tablero) con ancho proporcional a su largo. */
  #icon(unit, cls) {
    const node = el('span', { class: cls, 'aria-hidden': 'true' });
    node.style.setProperty('--len', String(unit.length));
    const spec = atlas.ok ? unitSpec(tileFor(16), this.state?.biome ?? 'water', unit.length, unit.id, false, 'normal') : null;
    if (spec) applySprite(node, spec);
    else node.style.setProperty('--img', unitImage(this.state?.biome ?? 'water', unit.length, unit.id, false));
    return node;
  }

  #paintBattle(s, me) {
    const g = s.game;
    const size = g.size;
    const sides = me ? [me, other(me)] : ['A', 'B'];
    const [left, right] = sides;
    const canShoot = Boolean(me) && g.status === 'battle' && g.turn === me;
    const shot = g.lastShot;
    const lastIndex = (side) => (shot && other(shot.by) === side ? shot.row * size + shot.col : null);

    const bl = this.#ensureBoard('left', $('#board-left'), size, {});
    const br = this.#ensureBoard('right', $('#board-right'), size, {
      onCell: (r, c) => {
        const st = this.state;
        if (st?.you && st.game?.status === 'battle' && st.game.turn === st.you) this.send({ t: 'fire', row: r, col: c });
      },
    });
    const paintSide = (board, side, interactive) => board.paint({
      shots: g.boards[side].shots, ships: g.boards[side].ships ?? g.boards[side].sunk, last: lastIndex(side), canShoot: interactive,
      hold: this.hold?.side === side ? this.hold : null,
    });
    paintSide(bl, left, false);
    paintSide(br, right, canShoot);

    const name = (side) => s.players[side]?.name ?? '?';
    const t = termsFor(s.biome);
    $('#cap-left').textContent = me ? `Tu ${t.fleet}` : `${capitalize(t.fleet)} de ${name(left)}`;
    $('#cap-right').textContent = me ? `${t.areaOf} ${name(right)}` : `${capitalize(t.fleet)} de ${name(right)}`;
    this.#fleetList($('#fleet-left'), g.boards[left].fleet);
    this.#fleetList($('#fleet-right'), g.boards[right].fleet);

    const st = (side) => {
      const { shots, hits } = g.stats[side];
      return `${shots} disparos · ${shots ? Math.round((hits / shots) * 100) : 0}% de acierto`;
    };
    $('#stats-left').textContent = st(left);
    $('#stats-right').textContent = st(right);
  }

  #fleetList(ul, fleet) {
    clear(ul);
    for (const f of fleet) {
      ul.append(el('li', { class: f.sunk ? 'sunk' : '', title: f.name }, this.#icon(f, 'icon mini')));
    }
  }

  // ------------------------------------------------------------------ disparos animados
  /** Devuelve el disparo si es nuevo (y vale la pena animarlo); si no, null. */
  #newShot(prev, s) {
    const shot = s.game?.lastShot;
    const key = shot ? `${s.room}:${s.round}:${shot.by}${shot.row},${shot.col}` : null;
    const isNew = Boolean(key && key !== this.fxKey && prev?.game);
    this.fxKey = key;
    if (!isNew || !atlas.ok || prefersReducedMotion() || document.hidden) return null;
    return shot;
  }

  /** Fuego → viaje → impacto o salpicadura, y solo entonces aparecen la marca y el nuevo estado de la unidad. */
  async #animateShot(prev, s, me, shot) {
    const token = ++this.shotToken;
    const alive = () => token === this.shotToken;
    const g = s.game;
    const size = g.size;
    const sides = me ? [me, other(me)] : ['A', 'B'];
    const target = other(shot.by);
    const boardOf = (side) => this.boards[side === sides[0] ? 'left' : 'right'];
    const tb = boardOf(target);
    const sb = boardOf(shot.by);
    if (!tb?.cellRect || !sb?.container) return;
    const index = shot.row * size + shot.col;

    // Qué no mostrar todavía: la marca de esa casilla y el estado nuevo de las unidades tocadas.
    const before = new Map((prev?.game?.boards?.[target]?.ships ?? prev?.game?.boards?.[target]?.sunk ?? []).map((u) => [u.id, u.state ?? (u.sunk ? 'sunk' : 'normal')]));
    const ships = {};
    for (const u of g.boards[target].ships ?? g.boards[target].sunk ?? []) {
      const now = u.state ?? (u.sunk ? 'sunk' : 'normal');
      const was = before.get(u.id) ?? (now === 'sunk' ? null : 'normal');
      if (was !== now) ships[u.id] = was;
    }
    this.hold = { side: target, index, ships };
    this.#paintBattle(this.state, me);

    const biome = s.biome ?? 'water';
    muzzle(sb.container.getBoundingClientRect(), biome);
    await projectile(sb.container.getBoundingClientRect(), tb.cellRect(index), tb.cellPx, { biome });
    if (!alive()) return;
    const sunkCells = shot.result === 'sunk' ? (g.boards[target].ships ?? g.boards[target].sunk ?? []).find((u) => u.id === shot.ship?.id)?.cells : null;
    const span = sunkCells ? tb.unitRect(sunkCells) : null;
    const done = impact(shot.result, biome, tb.cellRect(index), { span });
    this.#flourish(s, me, shot, tb);
    // La marca aparece en cuanto cae el proyectil; si se hundió, la unidad pasa por "en explosión" antes de quedar hundida.
    this.hold = { side: target, index: null, ships: shot.result === 'sunk' && shot.ship ? { ...ships, [shot.ship.id]: 'explosion' } : {} };
    this.#paintBattle(this.state, me);
    if (shot.result === 'sunk') shake(tb.container);
    await done;
    if (!alive()) return;
    this.hold = null;
    this.#paintBattle(this.state, me);
  }

  /** Racha de aciertos y destellos: solo adornos, nunca cambian el estado del juego (todo se apaga en Ajustes). */
  #flourish(s, me, shot, targetBoard) {
    if (!me || shot.by !== me) return;
    const key = `${s.room}:${s.round}`;
    if (this.streak.key !== key) this.streak = { key, n: 0 };
    this.streak.n = shot.result === 'miss' ? 0 : this.streak.n + 1;
    const r = targetBoard.container.getBoundingClientRect();
    if (this.streak.n >= 2) popText(`¡Racha ×${this.streak.n}!`, { x: r.left + r.width / 2, y: r.top + r.height * 0.18 });
    if (s.game.status === 'over' && s.game.winner === me && shot.result === 'sunk') screenFlash('#ffffff', { peak: 0.55, ms: 480 }); // último golpe
    else if (shot.result === 'sunk') screenFlash('#ff9a3c', { peak: 0.16, ms: 220 });
  }

  /** Historia (narración, datos, fuentes, preguntas) de una misión, desde el catálogo del servidor. */
  #storyOf(m) {
    return this.hooks.catalog()?.campaigns?.find((c) => c.id === m.campaignId)?.missions.find((x) => x.id === m.missionId)?.story ?? null;
  }

  #missionBar(s) {
    const bar = $('#mission-bar');
    if (!bar) return;
    const m = s.mission;
    bar.hidden = !m;
    if (!m) return;
    add(clear(bar),
      el('strong', {}, `Misión ${m.missionId}/${m.total} · ${m.title}`),
      el('span', { class: 'tag' }, m.campaignTitle),
      m.fiction ? el('span', { class: 'tag fiction' }, 'ficción') : null,
      el('ul', { class: 'objs' }, m.objectives.map((o) => el('li', {}, o.label))));
  }

  // ------------------------------------------------------------------ resultado
  #result(s, me) {
    const g = s.game;
    const r = s.result;
    const name = (side) => s.players[side]?.name ?? '?';
    const won = me && g.winner === me;
    $('#result-title').textContent = me ? (won ? '¡Ganaste la batalla!' : 'Perdiste esta vez') : `Ganó ${name(g.winner)}`;
    const reason = REASONS[g.reason] ?? '';
    const winnerName = name(g.winner);
    $('#result-reason').textContent = g.reason === 'flota_hundida' ? `${winnerName} ${reason}.` : `${winnerName} ganó: ${reason}.`;

    const lines = clear($('#result-lines'));
    if (me && r) {
      const pts = r.points[me];
      lines.append(el('li', {}, el('strong', {}, `+${fmt(pts)} puntos`), ' en esta partida'));
      if (r.ranked) {
        const d = r.ratingDelta[me];
        lines.append(el('li', {}, `Elo ${d >= 0 ? '+' : ''}${d}`, r.after?.[me] ? ` → ${r.after[me].rating}` : ''));
      } else if (s.mode === 'pvp') {
        lines.append(el('li', { class: 'muted' }, 'Partida amistosa: para ganar Elo, los dos jugadores deben tener cuenta.'));
      }
      if (r.after?.[me]) lines.append(el('li', {}, `Total: ${fmt(r.after[me].points)} puntos · ${r.after[me].wins} victorias`));
      else if (!s.players[me].registered) lines.append(el('li', { class: 'muted' }, 'Inicia sesión antes de jugar para guardar tus puntos.'));
      const { shots, hits } = g.stats[me];
      lines.append(el('li', { class: 'muted' }, `Tus disparos: ${shots}, aciertos: ${hits}${shots ? ` (${Math.round((hits / shots) * 100)}%)` : ''}`));
    }

    this.#missionResult(s, me, won);

    const rematch = $('#btn-rematch');
    const canRematch = Boolean(me) && !s.closedReason;
    rematch.hidden = !canRematch;
    if (canRematch) {
      const voted = s.rematch[me];
      rematch.disabled = voted;
      rematch.textContent = voted ? (s.mode === 'ai' ? 'Preparando…' : 'Esperando al rival…') : (s.mission ? 'Reintentar misión' : 'Revancha');
    }
    $('#result-note').textContent = s.closedReason === 'rival_salio' ? 'Tu rival salió de la sala.' : '';
  }

  /** Estrellas, objetivos, cierre histórico y logros nuevos de una partida de campaña. */
  #missionResult(s, me, won) {
    const box = clear($('#mission-result'));
    const next = $('#btn-next-mission');
    next.hidden = true;
    const m = s.mission; const r = s.result?.mission;
    box.hidden = !(m && r && me);
    if (me) {
      const key = `${s.room}:${s.round}`;
      const list = s.result?.newAchievements?.[me] ?? [];
      if (list.length && this.achKey !== key) { this.achKey = key; this.hooks.onAchievements(list); }
    }
    if (!m || !r || !me) return;
    const stars = el('div', { class: 'stars', role: 'img', 'aria-label': `${r.stars} de 3 estrellas` },
      [1, 2, 3].map((n) => el('span', { class: n <= r.stars ? 'on' : '' }, '★')));
    const def = this.hooks.catalog()?.campaigns?.find((c) => c.id === m.campaignId)?.missions.find((x) => x.id === m.missionId);
    add(box,
      el('h3', {}, won ? 'Misión cumplida' : 'Misión fallida'),
      stars,
      el('ul', { class: 'objs done' }, r.objectives.map((o) => el('li', { class: o.met ? 'met' : '' }, `${o.met ? '✓' : '✗'} ${o.label}`))),
      won && def ? el('p', { class: 'debrief' }, def.debrief) : null,
      won ? el('p', { class: 'muted small' }, r.saved ? (r.improved ? 'Progreso guardado: nueva mejor marca.' : 'Progreso guardado (ya tenías una marca igual o mejor).') : (this.hooks.signedIn?.() ? 'Guardando progreso…' : 'Inicia sesión para guardar tus estrellas y logros.')) : null);
    if (won && m.next && (r.saved || this.hooks.signedIn?.())) { next.hidden = false; next.onclick = () => this.hooks.onNextMission(m); }
    if (!won) return;

    const story = def?.story;
    if (story && !m.fiction) box.append(el('p', { class: 'muted small story-real' }, story.real));
    const lamina = this.hooks.catalog()?.laminas?.find((l) => l.id === `${m.campaignId}-${m.missionId}`);
    if (lamina) {
      const thumb = el('img', { class: 'lam-thumb', src: laminaThumbUrl(lamina.id), alt: `Lámina «${lamina.title}»`, width: THUMB.w, height: THUMB.h });
      box.append(el('div', { class: 'lam-reward' }, thumb,
        el('div', {}, el('strong', {}, 'Lámina ganada'), el('div', { class: 'small' }, lamina.title),
          el('button', { type: 'button', class: 'btn small', onclick: () => this.hooks.onLamina?.(lamina) }, 'Ver y descargar'),
          this.hooks.signedIn?.() ? null : el('div', { class: 'muted small' }, 'Inicia sesión para guardarla en tu galería.'))));
    }
    if (settings.get().aula && story?.quiz?.length) {
      const key = `${s.room}:${s.round}`;
      if (this.quiz.key !== key) { this.quiz = { key, node: renderQuiz(el('div', { class: 'quiz' }), story.quiz, (answers) => this.hooks.quiz(m.campaignId, m.missionId, answers), (r) => { if (r.newAchievements?.length) this.hooks.onAchievements(r.newAchievements); }) }; }
      box.append(this.quiz.node);
    }
  }

  // ------------------------------------------------------------------ sonido y reloj
  #feedback(prev, s, me) {
    const shot = s.game?.lastShot;
    const key = shot ? `${s.room}:${s.round}:${shot.by}${shot.row},${shot.col}` : null;
    if (key && key !== this.lastKey && prev) this.sound.play(shot.result === 'miss' ? 'miss' : shot.result);
    this.lastKey = key;
    if (me && s.status === 'battle' && s.game.turn === me && !(prev?.status === 'battle' && prev.game.turn === me)) this.sound.play('turn');
    if (me && s.status === 'over' && prev?.status !== 'over') this.sound.play(s.game.winner === me ? 'win' : 'lose');
  }

  #tick() {
    const t = $('#timer');
    if (!t) return;
    if (this.deadlineAt == null) { t.hidden = true; return; }
    const left = Math.max(0, Math.ceil((this.deadlineAt - performance.now()) / 1000));
    t.hidden = false;
    t.textContent = `${this.timerKind} · ${left} s`;
    t.classList.toggle('warn', left <= 5);
  }
}
