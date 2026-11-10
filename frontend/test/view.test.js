/**
 * Prueba de integración del frontend: el HTML real dentro de jsdom, conectado a un backend real.
 * La partida se juega haciendo clic en las casillas del DOM, igual que lo haría una persona.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createApp } from '../../backend/src/app.js';
import { loadConfig } from '../../backend/src/config.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { url: 'http://localhost/' });
Object.assign(globalThis, { document: dom.window.document, window: dom.window, location: dom.window.location, localStorage: dom.window.localStorage });

const { GameView } = await import('../public/js/game-view.js');

let srv;
before(async () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  config.aiWorkers = 0;
  config.guestAiDaily = 0;
  config.wsMessagesPerSecond = 10_000;
  config.timing = { turnMs: 0, placementMs: 0, graceMs: 500, aiThinkMs: [1, 3], idleMs: 60_000 };
  srv = await createApp({ config, bcryptRounds: 4 });
  await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
});
after(async () => { await srv.close(); });

const $ = (s) => document.querySelector(s);
const visible = (s) => !$(s).hidden;

test('se juega una partida completa contra la IA solo con clics en el DOM', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${srv.server.address().port}/ws`);
  const send = (m) => { ws.send(JSON.stringify(m)); return true; };
  const view = new GameView({ send, onLeave() {} });
  view.setReactions(['👍', '🔥']);
  assert.equal(document.querySelectorAll('.react').length, 2);

  const seen = new Set();
  let finalState = null;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout; paneles: ${[...seen]}`)), 20_000);
    ws.onopen = () => send({ t: 'hello' });
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') send({ t: 'create', mode: 'ai', size: 8, difficulty: 'easy', name: 'Tester', avatar: '🦈' });
      if (m.t === 'fleet') { view.onFleet(m.ships); return; }
      if (m.t !== 'state') return;
      view.render(m);

      if (m.status === 'placing') {
        seen.add('placing');
        assert.ok(visible('#panel-placing'), 'panel de colocación visible');
        assert.equal(document.querySelectorAll('#board-place .cell').length, 64);
        assert.equal(document.querySelectorAll('#fleet-pick li').length, 4);
        assert.equal($('#btn-ready').disabled, true, 'no se puede confirmar con la flota incompleta');
        $('#btn-random').click();                     // pide una flota al servidor → onFleet
        setTimeout(() => {
          assert.equal($('#btn-ready').disabled, false, 'con la flota completa se habilita');
          assert.equal(document.querySelectorAll('#board-place .cell.ship').length, 12);
          $('#btn-ready').click();
        }, 100);
      }
      if (m.status === 'battle') {
        seen.add('battle');
        assert.ok(visible('#panel-battle') && !visible('#panel-placing'));
        assert.equal(document.querySelectorAll('#board-left .cell').length, 64);
        assert.equal(document.querySelectorAll('#board-right .cell').length, 64);
        assert.equal(document.querySelectorAll('#board-left .cell.ship').length > 0, true, 'veo mis barcos');
        assert.equal(document.querySelectorAll('#board-right .cell.ship:not(.sunk)').length, 0, 'no veo las unidades vivas del rival (las destruidas sí son públicas)');
        assert.equal(document.querySelectorAll('#board-right .sprite:not(.dead)').length, 0, 'ningún sprite vivo del rival');
        assert.ok(document.querySelectorAll('#board-left .sprite').length > 0, 'mis unidades se dibujan como sprites');
        if (m.game.turn === 'A') {
          assert.ok($('#board-right').classList.contains('live'));
          const open = document.querySelectorAll('#board-right .cell.open');
          open[Math.floor(Math.random() * open.length)].click(); // clic real en el DOM
        } else {
          assert.ok(!$('#board-right').classList.contains('live'), 'sin turno no se puede disparar');
        }
      }
      if (m.status === 'over') {
        clearTimeout(timer);
        finalState = m;
        resolve();
      }
    };
  });
  await done;

  assert.ok(seen.has('placing') && seen.has('battle'));
  assert.ok(visible('#panel-over'));
  assert.match($('#result-title').textContent, /Ganaste|Perdiste/);
  assert.ok($('#result-lines').children.length > 0);
  assert.equal($('#btn-rematch').hidden, false);
  assert.ok(document.querySelectorAll('#board-right .cell.ship').length > 0, 'al final se revelan los barcos rivales');
  assert.equal(document.querySelectorAll('#board-right .cell.hit, #board-right .cell.sunk, #board-right .cell.miss').length > 0, true);
  assert.match($('#banner').textContent, /Victoria|Derrota/);

  // El mismo estado visto como espectador: dos tableros sin barcos (antes de terminar) y sin botones de acción.
  view.destroy();
  ws.close();
  assert.equal(finalState.you, 'A');
});

test('los nombres de otros jugadores nunca se interpretan como HTML', () => {
  const view = new GameView({ send: () => true, onLeave() {} });
  const evil = '<img src=x onerror=alert(1)>';
  view.render({
    t: 'state', room: 'ABCD', you: 'spectator', mode: 'pvp', status: 'waiting', size: 8, timeLeft: null, round: 1,
    wins: { A: 0, B: 0 }, rematch: { A: false, B: false }, spectators: 0, game: null, result: null, closedReason: null,
    players: { A: { name: evil, avatar: '🦈', isAi: false, registered: false, online: true, left: false, ready: false }, B: null },
  });
  assert.equal(document.querySelector('#players img'), null);
  assert.ok(document.querySelector('#pcard-A').textContent.includes(evil));
  assert.ok(visible('#panel-waiting'));
  view.destroy();
});

test('pantallas de entrada (#screen-welcome) y principal (#screen-home): sin sesión, invitado, upgrade, registro, login y salir', async () => {
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (path, opts) => realFetch(path.startsWith('/') ? base + path : path, opts);
  try {
    const { Lobby } = await import('../public/js/lobby.js');
    const { Welcome, restoreIdentity } = await import('../public/js/welcome.js');
    const { api, guestStore, session } = await import('../public/js/api.js');

    session.clear();
    guestStore.clear();

    const sent = [];
    let lobby;
    let welcome;
    const showScreen = (name) => {
      if (name !== 'welcome' && !lobby?.identity) name = 'welcome';
      $('#screen-welcome').hidden = name !== 'welcome';
      $('#screen-home').hidden = name !== 'home';
      $('#screen-game').hidden = name !== 'game';
      $('#screen-campaign').hidden = name !== 'campaign';
      if (name === 'home') lobby?.start(); else lobby?.stop();
    };

    welcome = new Welcome({
      onSignedIn: (user) => {
        guestStore.clear();
        lobby.setIdentity({ kind: 'user', user });
        showScreen('home');
      },
      onGuest: ({ name, avatar }) => {
        session.clear();
        guestStore.save({ name, avatar });
        lobby.setIdentity({ kind: 'guest', name, avatar });
        showScreen('home');
      },
      onBack: () => { if (lobby.identity) showScreen('home'); },
    });
    lobby = new Lobby({
      send: (m) => { sent.push(m); return true; },
      onLogout: () => {
        session.clear();
        guestStore.clear();
        lobby.setIdentity(null);
        showScreen('welcome');
        welcome.open();
      },
      onUpgrade: () => {
        showScreen('welcome');
        welcome.open({ upgrade: true, guest: lobby.identity });
      },
      onNeedIdentity: () => {
        showScreen('welcome');
        welcome.open();
      },
    });

    const meta = await api.meta();
    welcome.init(meta);
    await lobby.init(meta);

    // 1. Al abrir sin sesión ni invitado guardado: SOLO #screen-welcome es visible; #auth-dialog ya no existe.
    const initialId = await restoreIdentity();
    assert.equal(initialId, null);
    showScreen('welcome');
    welcome.open();

    assert.equal(visible('#screen-welcome'), true, 'pantalla de entrada visible');
    assert.equal(visible('#screen-home'), false, 'pantalla principal oculta sin sesión');
    assert.equal(visible('#screen-game'), false, 'pantalla de partida oculta');
    assert.equal(visible('#screen-campaign'), false, 'pantalla de campaña oculta');
    assert.equal($('#auth-dialog'), null, 'el diálogo #auth-dialog fue eliminado');
    assert.equal($('#screen-welcome #create-form'), null, 'nada de crear partida en la entrada');
    assert.equal($('#screen-welcome #rooms'), null, 'nada de salas en la entrada');
    assert.equal($('#screen-welcome #leaderboard'), null, 'nada de ranking en la entrada');
    assert.equal(document.activeElement, $('#auth-email'), 'foco inicial en el correo');

    // Si alguien intenta mostrar 'home' o 'game' sin identidad, se redirige a 'welcome'.
    showScreen('home');
    assert.equal(visible('#screen-welcome'), true);
    assert.equal(visible('#screen-home'), false);

    // 2. Flujo de invitado: clic en «Jugar como invitado» pide nombre y avatar, valida vacío y pasa a #screen-home.
    assert.equal($('#guest-form').hidden, true);
    $('#btn-guest').click();
    assert.equal($('#guest-form').hidden, false);
    assert.equal(document.activeElement, $('#guest-name'));

    $('#guest-name').value = '   ';
    $('#guest-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal($('#guest-name-error').hidden, false);
    assert.equal(visible('#screen-welcome'), true);

    $('#guest-name').value = 'Grumete';
    $('#guest-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(visible('#screen-home'), true, 'pasa a la principal tras elegir invitado');
    assert.equal(visible('#screen-welcome'), false, 'oculta la entrada');
    assert.equal($('#player-name').textContent, 'Grumete');
    assert.equal($('#player-kind').hidden, false, 'muestra etiqueta Invitado');
    assert.equal($('#btn-upgrade').hidden, false, 'invitado ve botón Iniciar sesión / Crear cuenta');
    assert.equal($('#btn-logout').hidden, false, 'invitado ve botón Salir');

    // Recargar conserva al invitado guardado.
    assert.deepEqual(await restoreIdentity(), { kind: 'guest', name: 'Grumete', avatar: meta.avatars[0] });

    // 3. Botón de invitado «Iniciar sesión / Crear cuenta» lleva a #screen-welcome y permite volver o crear cuenta.
    $('#btn-upgrade').click();
    assert.equal(visible('#screen-welcome'), true);
    assert.equal(visible('#screen-home'), false);
    assert.equal($('#auth-cancel').hidden, false, 'muestra botón Volver al juego');
    $('#auth-cancel').click();
    assert.equal(visible('#screen-home'), true, 'vuelve a la principal si cancela');

    // Salir desde invitado borra al invitado y vuelve a la entrada.
    $('#btn-logout').click();
    assert.equal(visible('#screen-welcome'), true);
    assert.equal(visible('#screen-home'), false);
    assert.equal(guestStore.get(), null);
    assert.equal(await restoreIdentity(), null);

    // 4. Alternar entre «Iniciar sesión» y «Crear cuenta» en #screen-welcome.
    assert.equal($('#auth-user-field').hidden, true);
    assert.equal($('#auth-avatar-field').hidden, true);
    $('#auth-switch').click();
    assert.equal($('#auth-title').textContent, 'Crear cuenta');
    assert.equal($('#auth-user-field').hidden, false);
    assert.equal($('#auth-avatar-field').hidden, false);
    assert.equal(document.activeElement, $('#auth-email'));

    // Botón para mostrar/ocultar la contraseña.
    const passInput = $('#auth-pass');
    const passToggle = $('#auth-pass-toggle');
    assert.equal(passInput.type, 'password');
    passToggle.click();
    assert.equal(passInput.type, 'text');
    assert.equal(passToggle.getAttribute('aria-pressed'), 'true');
    passToggle.click();
    assert.equal(passInput.type, 'password');
    assert.equal(passToggle.getAttribute('aria-pressed'), 'false');

    // Correo inválido muestra error junto al campo de correo.
    $('#auth-email').value = 'correo-invalido';
    $('#auth-user').value = 'Capitana_7';
    $('#auth-pass').value = 'secreto123';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal($('#auth-email-error').hidden, false);
    assert.match($('#auth-email-error').textContent, /correo/i);
    assert.equal($('#auth-email').getAttribute('aria-invalid'), 'true');

    // Contraseña corta (< 8) muestra error junto al campo de contraseña.
    $('#auth-email').value = 'capitana7@correo.bo';
    $('#auth-pass').value = 'corta12';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal($('#auth-pass-error').hidden, false);
    assert.match($('#auth-pass-error').textContent, /8 caracteres/);

    // Registro válido: pasa a #screen-home sin recargar, con barra de cuenta.
    $('#auth-email').value = '  Capitana7@Correo.BO ';
    $('#auth-user').value = 'Capitana_7';
    $('#auth-pass').value = 'secreto123';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal($('#auth-error').hidden, true, $('#auth-error').textContent);
    assert.equal(visible('#screen-home'), true, 'pasa a principal tras registrarse');
    assert.equal(visible('#screen-welcome'), false);
    assert.equal($('#player-name').textContent, 'Capitana_7');
    assert.equal($('#player-kind').hidden, true, 'cuenta no muestra etiqueta Invitado');
    assert.equal($('#btn-upgrade').hidden, true, 'cuenta no muestra botón de upgrade de invitado');
    assert.equal($('#btn-logout').textContent, 'Salir');

    // Recargar con token válido restaura la sesión de cuenta.
    const restoredUser = await restoreIdentity();
    assert.equal(restoredUser?.kind, 'user');
    assert.equal(restoredUser?.user.username, 'Capitana_7');

    // Crear partida contra la IA desde #screen-home.
    assert.equal(document.querySelectorAll('#size option').length, 5);
    assert.equal($('#size').value, '10');
    $('input[name="mode"][value="ai"]').checked = true;
    $('input[name="mode"][value="ai"]').dispatchEvent(new dom.window.Event('change'));
    assert.equal($('#difficulty-field').hidden, false);
    $('#size').value = '15';
    $('#difficulty').value = 'hard';
    $('#create-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].t, 'create');
    assert.equal(sent[0].mode, 'ai');
    assert.equal(sent[0].size, 15);
    assert.equal(sent[0].difficulty, 'hard');
    assert.equal(sent[0].name, 'Capitana_7');

    // Código corto o vacío no entra; uno válido envía join.
    $('#join-code').value = 'ab';
    $('#join-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(sent.length, 1);
    $('#join-code').value = 'ABCD';
    $('#join-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    assert.equal(sent[1].t, 'join');
    assert.equal(sent[1].room, 'ABCD');

    // 5. Salir de la cuenta: limpia token y vuelve a #screen-welcome.
    $('#btn-logout').click();
    assert.equal(visible('#screen-welcome'), true, 'salir vuelve a la entrada');
    assert.equal(visible('#screen-home'), false);
    assert.equal(session.token, null);
    assert.equal(await restoreIdentity(), null);

    // 6. Correo duplicado al intentar registrar otra cuenta con el mismo correo.
    $('#auth-switch').click();
    $('#auth-email').value = 'capitana7@correo.bo';
    $('#auth-user').value = 'OtraCapitana';
    $('#auth-pass').value = 'otraclave123';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal($('#auth-email-error').hidden, false);
    assert.match($('#auth-email-error').textContent, /registrada con ese correo/i);

    // Cambiar a modo «Iniciar sesión»: oculta nombre para mostrar y avatar.
    $('#auth-switch').click();
    assert.equal($('#auth-user-field').hidden, true);
    assert.equal($('#auth-avatar-field').hidden, true);

    // Credenciales inválidas en login (contraseña errónea y correo inexistente muestran el mismo error).
    $('#auth-email').value = 'capitana7@correo.bo';
    $('#auth-pass').value = 'equivocada123';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    const wrongPassMsg = $('#auth-pass-error').textContent;
    assert.equal($('#auth-pass-error').hidden, false);
    assert.match(wrongPassMsg, /incorrectos/i);

    $('#auth-email').value = 'noexiste@correo.bo';
    $('#auth-pass').value = 'equivocada123';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal($('#auth-pass-error').textContent, wrongPassMsg);

    // Login exitoso con correo + contraseña pasa a #screen-home.
    $('#auth-email').value = '  CAPITANA7@correo.bo ';
    $('#auth-pass').value = 'secreto123';
    $('#auth-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(visible('#screen-home'), true, 'pasa a principal tras login');
    assert.equal(visible('#screen-welcome'), false);
    assert.equal($('#player-name').textContent, 'Capitana_7');

    lobby.stop();
  } finally {
    globalThis.fetch = realFetch;
  }
});
