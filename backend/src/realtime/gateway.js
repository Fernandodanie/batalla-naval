import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { getCampaign, getMission, isUnlocked } from '../domain/campaigns.js';
import { isValidSize } from '../domain/fleet.js';
import { cleanAvatar, cleanName } from '../domain/profile.js';
import { ipOf } from '../http/quota.js';
import { clientMessage } from './protocol.js';

/**
 * Pasarela WebSocket (ruta /ws): valida cada mensaje, resuelve quién lo envía y lo
 * entrega a la sala. No contiene reglas del juego.
 *
 * Cada conexión procesa sus mensajes en orden (cola), porque 'hello' y 'create' hacen
 * trabajo asíncrono (consultar la cuenta) y no deben adelantarse unos a otros.
 */
export function attachGateway({ server, manager, auth, quota = null, progress = null, log = () => {}, maxPerSecond = 20 }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

  const fail = (conn, code) => conn.channel.send({ t: 'error', code });

  async function makeMember(conn, msg) {
    let user = null;
    if (conn.user) user = (await manager.store.findById(conn.user.id)) ?? conn.user; // rating al día
    return {
      session: conn.session,
      userId: user?.id ?? null,
      name: user ? user.username : cleanName(msg.name),
      avatar: user ? (user.avatar || cleanAvatar(msg.avatar)) : cleanAvatar(msg.avatar),
      rating: user ? user.rating : null,
      channel: conn.channel,
      online: true,
      graceTimer: null,
      ip: conn.ip,
    };
  }

  /** Un invitado sin cupo no puede empezar otra partida contra la IA hoy. */
  const noQuota = (conn) => !conn.user && quota && quota.left(conn.ip) === 0;

  async function handle(conn, msg) {
    if (msg.t === 'ping') return conn.channel.send({ t: 'pong', ts: msg.ts });

    if (msg.t === 'hello') {
      conn.user = msg.auth ? await auth.userFromToken(msg.auth) : null;
      const room = msg.session ? manager.roomOf(msg.session) : null;
      if (room?.member(msg.session)) {
        conn.session = msg.session;
        conn.channel.send({ t: 'welcome', session: conn.session, resumed: true, user: conn.user });
        room.connect(conn.session, conn.channel);
        log(`${room.code}: ${room.seatOf(conn.session)} volvió`);
      } else {
        conn.session = randomUUID();
        conn.channel.send({ t: 'welcome', session: conn.session, resumed: false, user: conn.user });
      }
      return;
    }

    if (!conn.session) return fail(conn, 'sin_sesion');

    switch (msg.t) {
      case 'create': {
        if (manager.roomOf(conn.session)) return fail(conn, 'ya_en_sala');
        if (!isValidSize(msg.size)) return fail(conn, 'tamano_invalido');
        if (msg.mode === 'ai' && noQuota(conn)) return fail(conn, 'limite_invitado');
        const member = await makeMember(conn, msg);
        const res = manager.create({
          mode: msg.mode, size: msg.size, biome: msg.biome, difficulty: msg.difficulty,
          hitKeepsTurn: msg.hitKeepsTurn, isPublic: msg.mode === 'pvp' && msg.isPublic,
        }, member);
        if (res.error) return fail(conn, res.error);
        if (msg.mode === 'ai' && !conn.user) quota?.take(conn.ip);
        res.room.broadcast();
        return;
      }
      case 'mission': {
        if (manager.roomOf(conn.session)) return fail(conn, 'ya_en_sala');
        const campaign = getCampaign(msg.campaign);
        const def = getMission(msg.campaign, msg.mission);
        if (!campaign || !def) return fail(conn, 'mision_no_existe');
        // Invitados: solo la primera misión de cada campaña (de prueba). Cuentas: hay que ganar la anterior.
        if (!conn.user && def.id > 1) return fail(conn, 'requiere_cuenta');
        if (conn.user && progress && !isUnlocked(campaign.id, def.id, await progress.starsOf(conn.user.id))) return fail(conn, 'mision_bloqueada');
        if (noQuota(conn)) return fail(conn, 'limite_invitado');
        const member = await makeMember(conn, msg);
        const res = manager.create({
          mode: 'ai', size: def.size, biome: campaign.biome, difficulty: def.difficulty, hitKeepsTurn: true, isPublic: false,
          mission: { campaignId: campaign.id, missionId: def.id },
        }, member);
        if (res.error) return fail(conn, res.error);
        if (!conn.user) quota?.take(conn.ip);
        res.room.broadcast();
        return;
      }
      case 'join':
      case 'spectate': {
        if (manager.roomOf(conn.session)) return fail(conn, 'ya_en_sala');
        const member = await makeMember(conn, msg);
        const res = msg.t === 'join' ? manager.join(msg.room, member) : manager.spectate(msg.room, member);
        if (res.error) return fail(conn, res.error);
        res.room.broadcast();
        return;
      }
      default:
    }

    const room = manager.roomOf(conn.session);
    if (!room) return fail(conn, 'sin_sala');

    switch (msg.t) {
      case 'randomize': {
        const res = room.randomize(conn.session);
        if (res.error) return fail(conn, res.error);
        return conn.channel.send({ t: 'fleet', ships: res.ships });
      }
      case 'ready': {
        const err = room.ready(conn.session, msg.ships);
        if (err) fail(conn, err);
        return;
      }
      case 'fire': {
        const err = room.fire(conn.session, msg.row, msg.col);
        if (err) fail(conn, err);
        return;
      }
      case 'rematch': {
        const err = room.rematch(conn.session);
        if (err) fail(conn, err);
        return;
      }
      case 'react': {
        const err = room.react(conn.session, msg.e);
        if (err) fail(conn, err);
        return;
      }
      case 'leave':
        room.leave(conn.session);
        conn.channel.send({ t: 'left' });
        return;
      default:
        fail(conn, 'comando_desconocido');
    }
  }

  wss.on('connection', (ws, req) => {
    const conn = {
      ws, ip: ipOf(req), session: null, user: null, alive: true, burst: 0, burstAt: Date.now(), queue: Promise.resolve(),
      channel: {
        send: (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); },
        close: (code = 4000, reason = 'replaced') => ws.close(code, reason),
      },
    };
    ws._conn = conn;
    ws.on('pong', () => { conn.alive = true; });
    ws.on('message', (data, isBinary) => {
      const now = Date.now();
      if (now - conn.burstAt > 1000) { conn.burst = 0; conn.burstAt = now; }
      if (++conn.burst > maxPerSecond) {
        if (conn.burst === maxPerSecond + 1) fail(conn, 'demasiados_mensajes'); // avisa una sola vez por ventana
        return;
      }
      if (isBinary) return fail(conn, 'formato');
      let raw;
      try { raw = JSON.parse(data.toString()); } catch { return fail(conn, 'formato'); }
      const parsed = clientMessage.safeParse(raw);
      if (!parsed.success) return fail(conn, 'formato');
      conn.queue = conn.queue
        .then(() => handle(conn, parsed.data))
        .catch((err) => { log(`error en gateway: ${err.stack ?? err}`); fail(conn, 'error_interno'); });
    });
    ws.on('close', () => {
      conn.queue = conn.queue.then(() => {
        if (conn.session) manager.roomOf(conn.session)?.disconnect(conn.session, conn.channel);
      });
    });
    ws.on('error', () => {});
  });

  // Latido: detecta conexiones muertas y evita que proxies corten por silencio (Cloudflare ~100 s).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws._conn.alive) { ws.terminate(); continue; }
      ws._conn.alive = false;
      ws.ping();
    }
  }, 20_000);
  heartbeat.unref();

  return {
    wss,
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      return new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}
