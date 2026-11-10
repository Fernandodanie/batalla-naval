import { randomInt } from 'node:crypto';
import { Room } from './room.js';

// Sin 0/O ni 1/I para que el código se lea bien por voz o en el celular.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Guarda todas las salas y a qué sala pertenece cada sesión. */
export class RoomManager {
  constructor({ config, store, pool, progress = null, quota = null, log = () => {}, rng }) {
    this.config = config;
    this.store = store;
    this.pool = pool;
    this.progress = progress;
    this.quota = quota;
    this.log = log;
    this.rng = rng;
    this.rooms = new Map();    // código -> Room
    this.sessions = new Map(); // sesión -> código
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  #newCode() {
    for (let i = 0; i < 50; i++) {
      let code = '';
      for (let j = 0; j < 4; j++) code += ALPHABET[randomInt(ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  /** Crea una sala y sienta al creador. Devuelve { room } o { error }. */
  create(options, member) {
    if (this.rooms.size >= this.config.maxRooms) return { error: 'servidor_lleno' };
    const code = this.#newCode();
    if (!code) return { error: 'servidor_lleno' };
    const room = new Room(code, options, {
      pool: this.pool, store: this.store, progress: this.progress, quota: this.quota, timing: this.config.timing, maxSpectators: this.config.maxSpectators,
      rng: this.rng, log: this.log,
      onMemberGone: (session) => this.sessions.delete(session),
      onEmpty: (c) => { this.rooms.delete(c); this.log(`sala ${c} eliminada`); },
    });
    this.rooms.set(code, room);
    this.sessions.set(member.session, code);
    room.seatCreator(member);
    this.log(`sala ${code} creada (${options.mode}, ${options.size}×${options.size}${options.mission ? `, misión ${options.mission.campaignId}#${options.mission.missionId}` : ''})`);
    return { room };
  }

  get(code) {
    return this.rooms.get(String(code ?? '').trim().toUpperCase()) ?? null;
  }

  roomOf(session) {
    const code = this.sessions.get(session);
    return code ? this.rooms.get(code) ?? null : null;
  }

  join(code, member) {
    const room = this.get(code);
    if (!room) return { error: 'sala_no_existe' };
    const error = room.join(member);
    if (error) return { error };
    this.sessions.set(member.session, room.code);
    return { room };
  }

  spectate(code, member) {
    const room = this.get(code);
    if (!room) return { error: 'sala_no_existe' };
    const error = room.spectate(member);
    if (error) return { error };
    this.sessions.set(member.session, room.code);
    return { room };
  }

  /** Salas públicas para el lobby: primero las que esperan rival. */
  listPublic() {
    return [...this.rooms.values()]
      .filter((r) => r.options.isPublic && !r.closedReason)
      .map((r) => r.info())
      .sort((a, b) => Number(b.joinable) - Number(a.joinable));
  }

  counts() {
    let players = 0, spectators = 0;
    for (const r of this.rooms.values()) {
      players += ['A', 'B'].filter((s) => r.seats[s] && !r.seats[s].isAi).length;
      spectators += r.spectators.size;
    }
    return { rooms: this.rooms.size, players, spectators };
  }

  /** Cierra salas abandonadas. */
  sweep() {
    const limit = Date.now() - this.config.timing.idleMs;
    for (const room of [...this.rooms.values()]) {
      if (room.touched >= limit) continue;
      for (const m of [room.seats.A, room.seats.B, ...room.spectators.values()]) {
        if (m && !m.isAi) { m.channel?.close(4001, 'idle'); this.sessions.delete(m.session); }
      }
      room.dispose();
      this.rooms.delete(room.code);
      this.log(`sala ${room.code} cerrada por inactividad`);
    }
  }

  close() {
    clearInterval(this.sweeper);
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
    this.sessions.clear();
  }
}
