import { api, session } from './api.js';
import { $, $$, clear, el, toast } from './dom.js';

const fmt = (n) => new Intl.NumberFormat('es').format(n);
const MODE_TEXT = { pvp: 'vs persona', ai: 'vs IA' };
const BIOME_ICON = { water: '🌊', pirate: '🏴‍☠️', land: '🪖', jungle: '🌴' };

/**
 * Pantalla principal: barra de quien juega, crear partida, entrar con código, salas abiertas y ranking.
 * Solo se ve con una identidad: { kind:'user', user } (cuenta) o { kind:'guest', name, avatar } (invitado).
 */
export class Lobby {
  /** @param {{send:(m:object)=>boolean, onLogout:()=>void, onUpgrade:()=>void, onNeedIdentity:()=>void}} deps */
  constructor({ send, onLogout = () => {}, onUpgrade = () => {}, onNeedIdentity = () => {} }) {
    this.send = send;
    this.onLogout = onLogout;
    this.onUpgrade = onUpgrade;
    this.onNeedIdentity = onNeedIdentity;
    this.meta = null;
    this.identity = null;
    this.timer = null;
    this.#bind();
  }

  async init(meta) {
    this.meta = meta;
    this.#fillMeta();
    const params = new URLSearchParams(location.search);
    const code = (params.get('sala') || '').toUpperCase().slice(0, 4);
    if (code) {
      $('#join-code').value = code;
      const invite = $('#invite');
      invite.textContent = `Te invitaron a la sala ${code}. Pulsa “Jugar” para entrar.`;
      invite.hidden = false;
    }
  }

  get signedIn() { return this.identity?.kind === 'user'; }
  get user() { return this.signedIn ? this.identity.user : null; }

  /** Inicia una misión de campaña (con el nombre de la cuenta o el de invitado). */
  startMission(campaign, mission) {
    if (this.#needIdentity()) return false;
    return this.send({ t: 'mission', campaign, mission, ...this.#who() });
  }

  start() { this.refresh(); clearInterval(this.timer); this.timer = setInterval(() => this.refresh(), 6000); }
  stop() { clearInterval(this.timer); }

  async refresh() {
    try {
      const [{ rooms }, { players }] = await Promise.all([api.rooms(), api.leaderboard(10)]);
      this.#rooms(rooms);
      this.#leaderboard(players);
    } catch { /* sin conexión: se reintenta en el próximo ciclo */ }
  }

  /** Nombre y avatar con los que se entra a una sala. */
  #who() {
    const id = this.identity;
    if (id?.kind === 'user') return { name: id.user.username, avatar: id.user.avatar || '' };
    return { name: id?.name ?? '', avatar: id?.avatar ?? '' };
  }

  /** Sin cuenta ni invitado no se juega: vuelve a la entrada. */
  #needIdentity() {
    if (this.identity) return false;
    this.onNeedIdentity();
    return true;
  }

  #fillMeta() {
    const { boardSizes, biomes = [{ id: 'water', label: 'Mar · flota moderna' }] } = this.meta;
    const biomeSel = clear($('#biome'));
    for (const b of biomes) biomeSel.append(el('option', { value: b.id }, b.label));
    const sel = clear($('#size'));
    for (const b of boardSizes) {
      sel.append(el('option', { value: b.size, selected: b.size === 10 }, `${b.size}×${b.size} · ${b.label} · ${b.fleet.length} unidades`));
    }
  }

  #bind() {
    $$('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
      const mode = $('input[name="mode"]:checked').value;
      $('#difficulty-field').hidden = mode !== 'ai';
      $('#opt-public-row').hidden = mode === 'ai';
    }));

    $('#create-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.#needIdentity()) return;
      const mode = $('input[name="mode"]:checked').value;
      this.send({
        t: 'create', mode, size: Number($('#size').value), biome: $('#biome').value, difficulty: $('#difficulty').value,
        hitKeepsTurn: $('#opt-hit').checked, isPublic: $('#opt-public').checked, ...this.#who(),
      });
    });
    $('#join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.#enter('join', $('#join-code').value);
    });
    $('#btn-spectate').addEventListener('click', () => this.#enter('spectate', $('#join-code').value));
    $('#join-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('#btn-refresh').addEventListener('click', () => this.refresh());

    $('#btn-logout').addEventListener('click', () => this.onLogout());
    $('#btn-upgrade').addEventListener('click', () => this.onUpgrade());
  }

  #enter(kind, code) {
    if (code.length < 4) { toast('El código tiene 4 caracteres.'); return; }
    if (this.#needIdentity()) return;
    this.send({ t: kind, room: code, ...this.#who() });
  }

  // ---------------------------------------------------------------- quién juega
  /** Cambia la identidad (o la quita con null) y repinta la barra superior. */
  setIdentity(identity) {
    this.identity = identity;
    const guest = identity?.kind === 'guest';
    const who = this.#who();
    $('#player-avatar').textContent = who.avatar || '⚓';
    $('#player-name').textContent = who.name;
    $('#player-kind').hidden = !guest;
    $('#btn-upgrade').hidden = !guest;
    const u = this.user;
    $('#player-stats').textContent = u
      ? `${fmt(u.points)} pts · Elo ${u.rating} · ${u.wins}G ${u.losses}P`
      : guest ? 'Tus puntos no se guardan. Crea una cuenta para aparecer en el ranking.' : '';
  }

  /** Actualiza los puntos mostrados (después de una partida). */
  async reloadUser() {
    if (!this.signedIn || !session.token) return;
    try { this.setIdentity({ kind: 'user', user: (await api.me()).user }); } catch { /* ignorar */ }
  }

  // ---------------------------------------------------------------- listas
  #rooms(rooms) {
    const ul = clear($('#rooms'));
    if (!rooms.length) { ul.append(el('li', { class: 'muted' }, 'No hay salas públicas ahora mismo. ¡Crea la primera!')); return; }
    for (const r of rooms) {
      ul.append(el('li', { class: 'room-row' },
        el('div', {},
          el('strong', {}, r.code), ` · ${r.size}×${r.size} · ${MODE_TEXT[r.mode]} · ${BIOME_ICON[r.biome] ?? '🌊'}`,
          el('div', { class: 'muted small' }, r.players.join(' vs ') || '—', r.spectators ? ` · 👁 ${r.spectators}` : '')),
        el('div', { class: 'row' },
          r.joinable ? el('button', { type: 'button', class: 'btn small primary', onclick: () => this.#enter('join', r.code) }, 'Unirse') : null,
          el('button', { type: 'button', class: 'btn small', onclick: () => this.#enter('spectate', r.code) }, 'Mirar'))));
    }
  }

  #leaderboard(players) {
    const ol = clear($('#leaderboard'));
    if (!players.length) { ol.append(el('li', { class: 'muted' }, 'Aún no hay jugadores con puntos.')); return; }
    for (const p of players) {
      ol.append(el('li', { class: this.user?.id === p.id ? 'me' : '' },
        el('span', { class: 'rank' }, p.rank), el('span', { class: 'avatar sm' }, p.avatar || '⚓'),
        el('span', { class: 'lname' }, p.username), el('span', { class: 'lpts' }, `${fmt(p.points)} pts`),
        el('span', { class: 'muted small' }, `${p.wins}G ${p.losses}P`)));
    }
  }
}
