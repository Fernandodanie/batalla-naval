import { api, guestStore, session } from './api.js';
import { loadAtlas } from './atlas.js';
import { Campaigns, showAchievements } from './campaigns.js';
import { $, $$, toast } from './dom.js';
import { GameView } from './game-view.js';
import { HubTabs } from './hub-tabs.js';
import { Lobby } from './lobby.js';
import { LoginBackdrop } from './login-bg.js';
import { MusicDirector } from './music.js';
import { errorText } from './messages.js';
import { Socket } from './net.js';
import { settings } from './settings.js';
import { loadClips, onSpeech, stopSpeaking, voiceAvailable } from './voice.js';
import { sound } from './sound.js';
import { Welcome, restoreIdentity } from './welcome.js';

const net = new Socket({ getToken: () => session.token });
let inRoom = false;
let welcome = null;
let game = null;
let lobby = null;
let campaigns = null;
let tabs = null;
let pendingMission = null; // misión que se inicia en cuanto el servidor confirme que salimos de la sala

const loginBg = new LoginBackdrop($('#login-bg'));
// Música de todo el juego (fuerte solo en la entrada; suave de fondo en el resto, ver js/music.js).
// Mientras el navegador espera el primer toque en la entrada, el botón de sonido late.
const music = new MusicDirector({ onWait: (waiting) => $('.login-sound')?.classList.toggle('needs-tap', waiting) });
globalThis.__bnMusic = music; // solo lectura (music.state): lo usan la prueba de punta a punta y la guía de depuración
onSpeech((speaking) => music.duck(speaking)); // la música baja mientras se lee la narración en voz alta
loadClips(); // audios grabados de la narración (audio/voz/); si no hay, se usa la voz del navegador
settings.on(() => { loginBg.refresh(); music.sync(); }); // «Animaciones: sin animaciones» apaga el video de la entrada; la música sigue sus ajustes

// Escenario de la partida o campaña → fondo (img/bg/bg-<nombre>.webp)
const SCENE = { water: 'agua', land: 'tierra', jungle: 'selva', pirate: 'corsarios' };

/** Cambia el fondo con un fundido; `null` lo quita (la entrada trae su propio video). Cada imagen se pide la primera vez que se usa. */
function setScene(name) {
  const body = document.body;
  if (!name) { delete body.dataset.bg; return; }
  $(`#scene-bg .bg-${name}`)?.classList.add('seen');
  body.dataset.bg = name;
}

function showScreen(name) {
  if (name !== 'welcome' && !lobby?.identity) name = 'welcome';
  $('#screen-welcome').hidden = name !== 'welcome';
  document.body.classList.toggle('hub', name === 'home' || name === 'campaign' || name === 'game'); // piel oscura de inicio, campañas y partida (ver «hub» en css/style.css)
  document.body.classList.toggle('in-game', name === 'game'); // en partida el fondo se oscurece más para que el tablero destaque
  if (name === 'home') setScene('inicio');
  else if (name === 'campaign') setScene(SCENE[campaigns?.biome()] ?? 'inicio');
  else if (name !== 'game') setScene(null); // en 'game' lo fija el estado de la sala (su escenario)
  loginBg.setActive(name === 'welcome');
  music.setScreen(name);
  $('#screen-home').hidden = name !== 'home';
  $('#screen-game').hidden = name !== 'game';
  $('#screen-campaign').hidden = name !== 'campaign';
  if (name === 'campaign' || name === 'welcome') inRoom = false;
  if (name === 'home') { lobby?.start(); inRoom = false; history.replaceState({ screen: 'home' }, '', location.pathname); } else lobby?.stop();
  if (name === 'welcome') history.replaceState({ screen: 'welcome' }, '', location.pathname);
}

function logout() {
  if (inRoom) net.send({ t: 'leave' });
  inRoom = false;
  pendingMission = null;
  session.clear();
  guestStore.clear();
  lobby.setIdentity(null);
  net.reconnect();
  campaigns?.reload();
  showScreen('welcome');
  welcome.open();
}

function leaveRoom() {
  const wasMission = Boolean(game.state?.mission);
  net.send({ t: 'leave' });
  if (wasMission) { showScreen('campaign'); campaigns.reload(); } else showScreen('home');
  lobby.reloadUser();
}

function bindTheme() {
  const dlg = $('#theme-dialog');
  const paint = () => {
    const t = window.BnTheme.get();
    $$('#mode-opts button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.m === t.mode)));
    $$('#palette-opts button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.p === t.palette)));
  };
  const open = () => { paint(); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
  $$('.js-theme').forEach((b) => b.addEventListener('click', open));
  $('#mode-opts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { window.BnTheme.set({ mode: b.dataset.m }); paint(); } });
  $('#palette-opts').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { window.BnTheme.set({ palette: b.dataset.p }); paint(); } });
  $('#theme-close').addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); });
}

/** Instala el service worker (interfaz sin conexión) y avisa cuando se pierde o vuelve la conexión. */
function bindOffline() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin service worker la app funciona igual */ });
  }
  window.addEventListener('offline', () => toast('Sin conexión: puedes ver campañas, guías y láminas; para jugar necesitas conexión.'));
  window.addEventListener('online', () => toast('Conexión recuperada.'));
}

function bindSettings() {
  const dlg = $('#settings-dialog');
  const paint = () => {
    const v = settings.get();
    $$('#set-anim button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v.animations)));
    $('#set-shake').checked = v.shake;
    $('#set-narration').checked = v.narration;
    $('#set-aula').checked = v.aula;
    $('#set-voice').checked = v.voice && voiceAvailable();
    $('#set-voice').disabled = !voiceAvailable();
    $('#set-voice-note').textContent = voiceAvailable() ? '' : '(este navegador no tiene voz disponible)';
    $('#set-music').checked = v.music;
    $('#set-music-vol').value = String(v.musicVolume);
    $('#set-music-vol').disabled = !v.music;
  };
  const open = () => { paint(); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
  $$('.js-settings').forEach((b) => b.addEventListener('click', open));
  $('#set-anim').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { settings.set({ animations: b.dataset.v }); paint(); } });
  $('#set-shake').addEventListener('change', (e) => settings.set({ shake: e.target.checked }));
  $('#set-narration').addEventListener('change', (e) => settings.set({ narration: e.target.checked }));
  $('#set-aula').addEventListener('change', (e) => settings.set({ aula: e.target.checked }));
  $('#set-voice').addEventListener('change', (e) => { settings.set({ voice: e.target.checked }); if (!e.target.checked) stopSpeaking(); });
  $('#set-music').addEventListener('change', (e) => { settings.set({ music: e.target.checked }); paint(); });
  $('#set-music-vol').addEventListener('input', (e) => settings.set({ musicVolume: Number(e.target.value) }));
  $('#set-close').addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); });
}

function bindSound() {
  // El botón de la entrada trae sus propios íconos (SVG, se alternan por CSS con aria-pressed): no se le cambia el texto.
  const paint = () => $$('.js-sound').forEach((b) => {
    if (!b.classList.contains('login-sound')) b.textContent = sound.muted ? '🔇' : '🔊';
    b.setAttribute('aria-pressed', String(!sound.muted));
  });
  $$('.js-sound').forEach((b) => b.addEventListener('click', () => { sound.toggle(); paint(); music.sync(); }));
  paint();
}

function bindNet() {
  net.on('status', (s) => {
    const label = { connecting: 'Conectando…', online: 'En línea', offline: 'Sin conexión' }[s];
    $$('.js-conn').forEach((n) => { n.textContent = label; n.dataset.s = s; });
  });
  net.on('latency', (ms) => $$('.js-conn').forEach((n) => { if (n.dataset.s === 'online') n.textContent = `En línea · ${ms} ms`; }));
  net.on('welcome', (m) => {
    if (inRoom && !m.resumed) { toast('Se perdió tu lugar en la sala.'); showScreen('home'); }
  });
  net.on('state', (s) => {
    if (!inRoom) { inRoom = true; showScreen('game'); history.replaceState(null, '', `?sala=${s.room}`); }
    setScene(SCENE[s.biome] ?? 'agua');
    game.render(s);
    if (s.status === 'over') { lobby.reloadUser(); if (s.mission && s.result?.mission?.saved) campaigns.reload(); }
  });
  net.on('fleet', (m) => game.onFleet(m.ships));
  net.on('react', (m) => game.onReact(m));
  net.on('left', (m) => {
    if (pendingMission) {
      const next = pendingMission;
      pendingMission = null;
      inRoom = false;
      if (!lobby.startMission(next.campaignId, next.next)) showScreen('campaign');
      return;
    }
    if (m.reason === 'sala_cerrada') toast('La sala se cerró.');
    if (!$('#screen-campaign').hidden) return; // ya estamos en la pantalla de campañas
    showScreen('home');
  });
  net.on('error', (m) => toast(errorText(m.code)));
}

async function boot() {
  bindTheme();
  bindOffline();
  bindSettings();
  bindSound();
  welcome = new Welcome({
    onSignedIn: (user) => {
      guestStore.clear();
      lobby.setIdentity({ kind: 'user', user });
      net.reconnect();
      campaigns?.reload();
      showScreen('home');
    },
    onGuest: ({ name, avatar }) => {
      session.clear();
      guestStore.save({ name, avatar });
      lobby.setIdentity({ kind: 'guest', name, avatar });
      net.reconnect();
      campaigns?.reload();
      showScreen('home');
    },
    onBack: () => {
      if (lobby.identity) showScreen('home');
    },
  });
  lobby = new Lobby({
    send: (m) => net.send(m) || (toast('Sin conexión con el servidor.'), false),
    onLogout: logout,
    onUpgrade: () => {
      showScreen('welcome');
      welcome.open({ upgrade: true, guest: lobby.identity });
    },
    onNeedIdentity: () => {
      showScreen('welcome');
      welcome.open();
    },
  });
  game = new GameView({ send: (m) => net.send(m), sound, onLeave: leaveRoom });
  campaigns = new Campaigns({ lobby, show: showScreen });
  tabs = new HubTabs({ onSelect: (name) => { if (name === 'campanas') campaigns.reload(); } });
  game.hooks = {
    catalog: () => campaigns.catalog,
    signedIn: () => lobby.signedIn,
    onAchievements: showAchievements,
    onLamina: (l) => campaigns.openLamina(l),
    quiz: (campaignId, missionId, answers) => api.quiz(campaignId, missionId, answers),
    onNextMission: (m) => { pendingMission = m; net.send({ t: 'leave' }); },
  };
  window.addEventListener('popstate', () => {
    if (lobby?.identity && !$('#screen-welcome').hidden) showScreen(inRoom ? 'game' : 'home');
  });
  bindNet();
  net.connect();
  await loadAtlas(); // pixel art; si falla, el juego usa los sprites SVG
  try {
    const meta = await api.meta();
    game.setReactions(meta.reactions);
    welcome.init(meta);
    await lobby.init(meta);
    if (!$('#invite').hidden) tabs.select('jugar'); // llegó con un enlace de invitación: va directo a «Crear o unirse»
  } catch {
    toast(navigator.onLine === false ? 'Sin conexión: puedes ver campañas, guías y láminas; para jugar necesitas conexión.' : 'No se pudo cargar la configuración del servidor.');
  }
  const identity = await restoreIdentity();
  // El catálogo de campañas se pide aparte: sin conexión puede llegar de la copia que guarda el service worker.
  await campaigns.init();
  if (identity) {
    lobby.setIdentity(identity);
    showScreen('home');
  } else {
    showScreen('welcome');
    welcome.open();
  }
}

boot();
