import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { api, startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

test('GET /healthz y /api/meta entregan lo que necesita el frontend', async () => {
  const health = await fetch(`${srv.http}/healthz`);
  assert.equal(await health.text(), 'ok');
  const { body } = await api(srv, 'GET', '/api/meta');
  assert.deepEqual(body.boardSizes.map((b) => b.size), [8, 10, 12, 15, 20]);
  assert.equal(body.boardSizes[1].fleet.length, 5);
  assert.deepEqual(body.difficulties, ['easy', 'normal', 'hard', 'expert']);
  assert.ok(body.avatars.length >= 8);
});

test('registro: crea la cuenta con correo en minúsculas, devuelve token y nunca el hash', async () => {
  const res = await api(srv, 'POST', '/api/auth/register', {
    body: { email: '  Capitan_1@Correo.BO ', username: 'Capitan_1', password: 'secreto123', avatar: '⚓' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'capitan_1@correo.bo');
  assert.equal(res.body.user.username, 'Capitan_1');
  assert.equal(res.body.user.points, 0);
  assert.equal(res.body.user.passwordHash, undefined);
  assert.ok(res.body.token);
  const me = await api(srv, 'GET', '/api/me', { token: res.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, res.body.user.id);
  assert.equal(me.body.user.username, 'Capitan_1');
});

test('registro: valida correo, nombre, contraseña de mínimo 8 caracteres y rechaza correo duplicado', async () => {
  const bad = (body) => api(srv, 'POST', '/api/auth/register', { body });
  const rEmail = await bad({ email: 'no-es-correo', username: 'valido', password: 'secreto123' });
  assert.equal(rEmail.status, 400);
  assert.equal(rEmail.body.error, 'correo_invalido');
  assert.match(rEmail.body.message, /correo/i);

  assert.equal((await bad({ email: 'a@b.co', username: 'ab', password: 'secreto123' })).body.error, 'usuario_invalido');
  assert.equal((await bad({ email: 'a@b.co', username: 'con espacio', password: 'secreto123' })).body.error, 'usuario_invalido');
  assert.equal((await bad({ email: 'a@b.co', username: 'valido', password: '1234567' })).body.error, 'password_corta');
  assert.equal((await bad({ email: 'a@b.co', username: 'valido', password: 'secreto123', avatar: '💩' })).body.error, 'avatar_invalido');
  assert.equal((await bad({})).body.error, 'datos_invalidos');

  await bad({ email: 'Repetido@Ejemplo.com', username: 'Repetido1', password: 'secreto123' });
  const dup = await bad({ email: '  repetido@EJEMPLO.com ', username: 'Repetido2', password: 'otraclave123' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'correo_ocupado');
  assert.match(dup.body.message, /correo/i);
});

test('login: acepta correo + contraseña (normalizando mayúsculas y espacios) y no revela si el correo existe', async () => {
  await api(srv, 'POST', '/api/auth/register', {
    body: { email: 'Marinero@Mar.org', username: 'Marinero', password: 'claveSegura123' },
  });
  const ok = await api(srv, 'POST', '/api/auth/login', {
    body: { email: '  marinero@MAR.org ', password: 'claveSegura123' },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.username, 'Marinero');
  assert.ok(ok.body.token);

  const badEmail = await api(srv, 'POST', '/api/auth/login', { body: { email: 'invalido', password: 'claveSegura123' } });
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.error, 'correo_invalido');

  const wrongPass = await api(srv, 'POST', '/api/auth/login', { body: { email: 'marinero@mar.org', password: 'equivocada' } });
  const noUser = await api(srv, 'POST', '/api/auth/login', { body: { email: 'fantasma@mar.org', password: 'equivocada' } });
  assert.equal(wrongPass.status, 401);
  assert.equal(noUser.status, 401);
  assert.equal(wrongPass.body.error, 'credenciales_invalidas');
  assert.deepEqual(wrongPass.body, noUser.body);
});

test('rutas protegidas, JSON roto y rutas inexistentes', async () => {
  assert.equal((await api(srv, 'GET', '/api/me')).status, 401);
  assert.equal((await api(srv, 'GET', '/api/me', { token: 'falso' })).status, 401);
  const res = await fetch(`${srv.http}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{roto' });
  assert.equal(res.status, 400);
  assert.equal((await api(srv, 'GET', '/api/nada')).status, 404);
});

test('leaderboard y salas públicas responden listas', async () => {
  const lb = await api(srv, 'GET', '/api/leaderboard?limit=5');
  assert.equal(lb.status, 200);
  assert.ok(Array.isArray(lb.body.players));
  assert.ok(lb.body.players.length >= 1);
  assert.equal(lb.body.players[0].passwordHash, undefined);
  const rooms = await api(srv, 'GET', '/api/rooms');
  assert.deepEqual(rooms.body.rooms, []);
  const status = await api(srv, 'GET', '/api/status');
  assert.equal(status.body.ai.mode, 'inline');
  assert.equal(status.body.storage, 'memory');
});
