import { api } from './api.js';
import { $, add, clear, el, toast } from './dom.js';
import { THUMB, canShareFiles, downloadLamina, downloadPack, laminaThumbUrl, renderLamina, shareLamina } from './laminas.js';
import { downloadText, guideFileName, guideMarkdown, worksheetHtml } from './guide.js';
import { renderStoryDetails } from './narrator.js';
import { settings } from './settings.js';
import { speak, stopSpeaking, voiceAvailable } from './voice.js';
import { militaryText } from './military-voice.js';

const DIFF = { easy: 'IA fácil', normal: 'IA normal', hard: 'IA difícil', expert: 'IA experta' };
const CATEGORIES = [['progreso', 'Progreso'], ['habilidad', 'Habilidad'], ['variedad', 'Variedad'], ['histórico', 'Históricos']];
const BIOME = { water: 'Mar', pirate: 'Mar (piratas)', land: 'Tierra', jungle: 'Selva' };

const openDialog = (d) => { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); };
const closeDialog = (d) => { if (d.close) d.close(); else d.removeAttribute('open'); };

export const stars = (n, max = 3) => el('span', { class: 'stars', role: 'img', 'aria-label': `${n} de ${max} estrellas` },
  Array.from({ length: max }, (_, i) => el('span', { class: i < n ? 'on' : '' }, '★')));

/** Pantalla de campañas, ficha de misión y panel de logros. */
export class Campaigns {
  /** @param {{lobby: import('./lobby.js').Lobby, show:(name:string)=>void}} deps */
  constructor({ lobby, show }) {
    this.lobby = lobby;
    this.show = show;
    this.catalog = null;
    this.progress = null; // null = invitado
    this.view = null;     // id de la campaña abierta, o null = lista
    this.quota = null;
    $('#btn-achievements').addEventListener('click', () => this.openAchievements());
    $('#camp-back').addEventListener('click', () => { this.view = null; this.show('home'); }); // vuelve a la pestaña «Campañas» del inicio
    $('#md-cancel').addEventListener('click', () => closeDialog($('#mission-dialog')));
    $('#ad-close').addEventListener('click', () => closeDialog($('#achv-dialog')));
    $('#btn-gallery')?.addEventListener('click', () => this.openGallery());
    $('#camp-gallery')?.addEventListener('click', () => this.openGallery());
    $('#gal-close')?.addEventListener('click', () => closeDialog($('#gallery-dialog')));
    $('#gal-zip')?.addEventListener('click', () => this.downloadAllLaminas());
    $('#lam-close')?.addEventListener('click', () => closeDialog($('#lamina-dialog')));
  }

  async init() {
    try { this.catalog = await api.campaigns(); } catch { this.catalog = null; }
    await this.reload();
  }

  /** Vuelve a pedir progreso (cuenta) o cupo (invitado). */
  async reload() {
    this.progress = null;
    if (this.lobby.signedIn) { try { this.progress = await api.progress(); } catch { /* sin conexión */ } }
    else { try { this.quota = await api.quota(); } catch { this.quota = null; } }
    this.#summary();
    this.#tabList();
    if (!$('#screen-campaign').hidden) this.render();
  }

  stars(campaignId, missionId) { return this.progress?.missions.find((m) => m.campaignId === campaignId && m.missionId === missionId)?.stars ?? 0; }

  #unlocked(c, m) {
    if (m.id === 1) return true;
    return this.lobby.signedIn && this.stars(c.id, m.id - 1) >= 1;
  }

  #summary() {
    const p = this.progress; const total = this.catalog ? this.catalog.campaigns.reduce((a, c) => a + c.missions.length, 0) : 0;
    $('#camp-summary').textContent = p ? `${p.rank ? `${p.rank.icon} ${p.rank.name} · ` : ''}${p.missions.length}/${total} misiones · ${p.totalStars} ★ · ${p.achievements.length}/${p.totalAchievements} logros${p.rank?.next ? ` · te faltan ${p.rank.next.missing} ★ para ${p.rank.next.name}` : ''}` : 'Como invitado puedes probar la primera misión de cada campaña.';
  }

  /** Las cuatro campañas, en la pestaña «Campañas» del inicio. */
  #tabList() {
    const box = clear($('#camp-tab-list'));
    if (!this.catalog) { box.append(el('p', { class: 'muted' }, 'No se pudieron cargar las campañas. Revisa tu conexión.')); return; }
    this.#list(box);
  }

  /** Escenario de la campaña abierta (para el fondo), o undefined si se está en la lista. */
  biome() { return this.catalog?.campaigns.find((c) => c.id === this.view)?.biome; }

  open() { this.view = null; this.show('campaign'); this.reload(); this.render(); }
  openCampaign(id) { this.view = id; this.render(); }

  render() {
    const body = clear($('#camp-body'));
    const q = this.quota;
    $('#camp-quota').textContent = !this.lobby.signedIn && q?.left != null ? `Partidas contra la IA hoy: ${q.left} de ${q.limit}` : '';
    if (!this.catalog) { body.append(el('p', { class: 'muted' }, 'No se pudieron cargar las campañas. Revisa tu conexión.')); return; }
    const camp = this.catalog.campaigns.find((c) => c.id === this.view);
    $('#camp-screen-title').textContent = camp ? camp.title : 'Campañas';
    if (!this.lobby.signedIn) body.append(el('p', { class: 'invite' }, 'Inicia sesión para guardar estrellas y logros y desbloquear todas las misiones. Como invitado puedes probar la primera de cada campaña.'));
    if (!camp) { this.#list(body); return; }
    this.#missions(body, camp);
  }

  #list(body) {
    const grid = el('div', { class: 'camp-grid' });
    for (const c of this.catalog.campaigns) {
      const done = c.missions.filter((m) => this.stars(c.id, m.id) >= 1).length;
      const st = c.missions.reduce((a, m) => a + this.stars(c.id, m.id), 0);
      grid.append(el('button', { type: 'button', class: 'camp-card', dataset: { biome: c.biome }, onclick: () => { this.openCampaign(c.id); this.show('campaign'); } },
        el('span', { class: 'camp-icon', 'aria-hidden': 'true' }, c.icon),
        el('span', { class: 'camp-text' },
          el('strong', {}, c.title, c.fiction ? el('span', { class: 'tag fiction' }, 'ficción') : null),
          el('span', { class: 'muted small' }, `${c.subtitle} · ${c.missions.length} misiones`),
          el('span', { class: 'small' }, this.progress ? `${done}/${c.missions.length} cumplidas · ${st}/${c.missions.length * 3} ★` : c.intro.slice(0, 90) + '…'))));
    }
    body.append(grid);
  }

  #missions(body, c) {
    add(body, el('p', {}, c.intro), c.note ? el('p', { class: 'muted small' }, c.note) : null);
    const ul = el('ol', { class: 'mission-list' });
    for (const m of c.missions) {
      const open = this.#unlocked(c, m);
      const st = this.stars(c.id, m.id);
      const why = open ? '' : this.lobby.signedIn ? 'Gana la misión anterior' : 'Requiere cuenta';
      ul.append(el('li', { class: `mission-row${open ? '' : ' locked'}` },
        el('span', { class: 'mnum' }, m.id),
        el('div', { class: 'mmain' },
          el('strong', {}, m.title),
          el('span', { class: 'muted small' }, `${m.size}×${m.size} · ${DIFF[m.difficulty]}`)),
        stars(st),
        el('button', { type: 'button', class: 'btn small primary', disabled: !open, onclick: () => this.#brief(c, m) }, open ? (st ? 'Repetir' : 'Jugar') : `🔒 ${why}`)));
    }
    body.append(ul);
  }

  #brief(c, m) {
    $('#md-title').textContent = `${c.title} · ${m.id}. ${m.title}`;
    const story = m.story;
    const tags = clear($('#md-tags'));
    add(tags, el('span', { class: 'tag' }, BIOME[c.biome]), el('span', { class: 'tag' }, `${m.size}×${m.size}`), el('span', { class: 'tag' }, DIFF[m.difficulty]),
      c.fiction ? el('span', { class: 'tag fiction' }, 'ficción') : null,
      m.twist ? el('span', { class: 'tag twist', title: 'En la historia terminó distinto; la misión propone otro final' }, 'reinterpretación') : null);
    $('#md-briefing').textContent = m.briefing;
    // «Al mando»: en las misiones históricas, los jefes reales de cada bando (en las de ficción los nombres se inventan al empezar).
    const cmd = $('#md-command');
    const cm = story?.commanders;
    cmd.hidden = !(cm?.you && cm?.foe && !c.fiction);
    cmd.replaceChildren();
    if (!cmd.hidden) add(cmd, el('b', {}, 'Al mando'), el('br'), `Tú: ${cm.you.name} — ${cm.you.role}.`, el('br'), `Rival: ${cm.foe.name} — ${cm.foe.role}.`);
    const real = $('#md-real');
    real.hidden = !(story && !c.fiction);
    real.textContent = story && !c.fiction ? story.real : '';

    // contexto: datos y fuentes (si la misión los tiene)
    const ctx = $('#md-context');
    ctx.hidden = !(story && (story.facts?.length || story.sources?.length));
    ctx.open = false;
    if (!ctx.hidden) {
      const body = renderStoryDetails($('#md-context-body'), story);
      if (!c.fiction) {
        add(body, el('div', { class: 'row wrap guide-actions' },
          el('button', { type: 'button', class: 'btn small', onclick: () => downloadText(guideFileName(c, m), 'text/markdown', guideMarkdown(c, m)) }, 'Guía didáctica (.md)'),
          el('button', { type: 'button', class: 'btn small', onclick: () => downloadText(guideFileName(c, m, 'hoja'), 'text/html', worksheetHtml(c, m)) }, 'Hoja de trabajo (imprimible)')));
      }
    }

    // objetivos
    const ul = clear($('#md-objs'));
    ul.append(el('li', {}, 'Gana la misión (★)'), ...m.objectives.map((o) => el('li', {}, `${o.label} (★)`)));

    const notes = [];
    if (!c.fiction) notes.push('Texto histórico contrastado con fuentes (ver «Contexto histórico»); pendiente de revisión por una persona de historia antes de usarlo en clase.');
    if (!this.lobby.signedIn) notes.push('Como invitado puedes jugarla, pero no se guardará tu progreso.');
    $('#md-note').textContent = notes.join(' ');

    // modo aula: lectura guiada por escenas; hay que llegar a la última para empezar
    const start = $('#md-start');
    const pager = $('#md-story');
    const scenes = settings.get().aula && story?.intro?.length ? story.intro : null;
    const listen = $('#md-listen');
    listen.hidden = !(scenes && voiceAvailable());
    stopSpeaking();
    pager.hidden = !scenes;
    $('#md-briefing').hidden = Boolean(scenes);
    start.disabled = false;
    if (scenes) {
      let i = 0;
      const next = $('#md-next');
      const paint = () => {
        $('#md-scene').textContent = scenes[i];
        speak(militaryText(scenes[i], `intro${Math.min(i, 1)}`));
        $('#md-page').textContent = `Escena ${i + 1} de ${scenes.length}`;
        const last = i === scenes.length - 1;
        next.hidden = last;
        start.disabled = !last;
      };
      next.onclick = () => { i = Math.min(scenes.length - 1, i + 1); paint(); };
      listen.onclick = () => speak(militaryText(scenes[i], `intro${Math.min(i, 1)}`), { force: true });
      paint();
    }
    start.onclick = () => { stopSpeaking(); closeDialog($('#mission-dialog')); this.lobby.startMission(c.id, m.id); };
    openDialog($('#mission-dialog'));
  }

  async openAchievements() {
    if (!this.catalog) await this.init();
    await this.reload();
    const got = new Map((this.progress?.achievements ?? []).map((a) => [a.id, a.date]));
    const list = clear($('#ad-list'));
    for (const [cat, label] of CATEGORIES) {
      const items = (this.catalog?.achievements ?? []).filter((a) => a.category === cat);
      if (!items.length) continue;
      list.append(el('h3', { class: 'cat' }, label),
        el('ul', { class: 'achv-list' }, items.map((a) => el('li', { class: got.has(a.id) ? 'got' : 'todo' },
          el('span', { class: 'aicon', 'aria-hidden': 'true' }, got.has(a.id) ? a.icon : '🔒'),
          el('div', {}, el('strong', {}, a.name), el('div', { class: 'muted small' }, a.text))))));
    }
    $('#ad-sum').textContent = this.progress
      ? `${got.size} de ${this.catalog?.achievements.length ?? 0} desbloqueados · ${this.progress.totalStars} ★`
      : 'Inicia sesión para guardar tus logros. Aquí ves todos los que puedes conseguir.';
    openDialog($('#achv-dialog'));
  }

  // ------------------------------------------------------------------ láminas
  /** Galería: las láminas ganadas se ven completas; las demás, en silueta con la misión que las desbloquea. */
  async openGallery() {
    if (!this.catalog) await this.init();
    await this.reload();
    const owned = new Set((this.progress?.laminas ?? []).map((l) => l.id));
    const list = clear($('#gal-list'));
    const all = this.catalog?.laminas ?? [];
    for (const c of this.catalog?.campaigns ?? []) {
      const items = all.filter((l) => l.campaignId === c.id);
      if (!items.length) continue;
      list.append(el('h3', { class: 'cat' }, c.title, c.fiction ? el('span', { class: 'tag fiction' }, 'ficción') : null),
        el('div', { class: 'gal-grid' }, items.map((l) => this.#galleryItem(l, c, owned.has(l.id)))));
    }
    $('#gal-zip').disabled = owned.size === 0;
    $('#gal-sum').textContent = this.progress
      ? `${owned.size} de ${all.length} láminas${owned.size === all.length ? ' · ¡Álbum completo!' : ''}`
      : 'Inicia sesión para guardar las láminas que ganes. Cada misión cumplida desbloquea un cuadro en pixel art que puedes descargar y compartir.';
    openDialog($('#gallery-dialog'));
  }

  #galleryItem(l, c, got) {
    const mission = c.missions.find((m) => m.id === l.missionId);
    const img = el('img', { class: 'lam-thumb', src: laminaThumbUrl(l.id), alt: got ? `Lámina «${l.title}»` : 'Lámina por desbloquear', width: THUMB.w, height: THUMB.h, loading: 'lazy' });
    const body = [img, el('strong', {}, got ? l.title : '???'), el('small', {}, got ? 'Ganada' : `Gana «${mission?.title ?? 'la misión'}»`)];
    if (!got) return el('div', { class: 'gal-item locked' }, body);
    return el('button', { type: 'button', class: 'gal-item', onclick: () => this.openLamina(l) }, body);
  }

  /** Descarga en un ZIP todas las láminas ganadas. */
  async downloadAllLaminas() {
    const owned = new Set((this.progress?.laminas ?? []).map((l) => l.id));
    const items = (this.catalog?.laminas ?? []).filter((l) => owned.has(l.id));
    if (!items.length) return;
    const btn = $('#gal-zip');
    btn.disabled = true;
    try { toast(`Preparando ${items.length} láminas…`); await downloadPack(items); } catch { toast('No se pudo crear el ZIP.'); } finally { btn.disabled = false; }
  }

  /** Vista grande de una lámina, con descarga en PNG (horizontal, cuadrada o vertical) y, en celulares, el menú de compartir. */
  async openLamina(lamina) {
    $('#lam-title').textContent = lamina.title;
    $('#lam-note').textContent = lamina.caption;
    const select = $('#lam-format');
    select.value = 'landscape';
    const view = clear($('#lam-view'));
    const draw = async () => {
      clear(view).append(el('p', { class: 'muted' }, 'Preparando la lámina…'));
      try { clear(view).append(await renderLamina(lamina, { format: select.value })); } catch { clear(view).append(el('p', { class: 'error' }, 'No se pudo cargar la lámina.')); }
    };
    select.onchange = draw;
    $('#lam-download').onclick = async () => {
      try { await downloadLamina(lamina, { format: select.value }); toast('Lámina descargada'); } catch { toast('No se pudo crear la imagen.'); }
    };
    const share = $('#lam-share');
    share.hidden = !canShareFiles();
    share.onclick = async () => { try { await shareLamina(lamina, { format: select.value }); } catch { toast('No se pudo compartir la imagen.'); } };
    openDialog($('#lamina-dialog'));
    await draw();
  }
}

/** Avisos en pantalla al desbloquear logros (uno tras otro). */
export function showAchievements(list) {
  const box = $('#achv-toasts');
  if (!box) return;
  list.forEach((a, i) => setTimeout(() => {
    const n = el('div', { class: 'achv' }, el('span', { class: 'aicon', 'aria-hidden': 'true' }, a.icon),
      el('div', {}, el('small', {}, 'Logro desbloqueado'), el('strong', {}, a.name), el('div', { class: 'small' }, a.text)));
    box.append(n);
    setTimeout(() => n.remove(), 6500);
  }, i * 900));
}
