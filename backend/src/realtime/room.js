import { Game, other } from '../domain/game.js';
import { REACTIONS } from '../domain/profile.js';
import { scoreMatch } from '../domain/scoring.js';
import { evaluateMission, getCampaign, getMission, objectiveLabel as objectiveLabelOf } from '../domain/campaigns.js';
import { summarize } from '../domain/summary.js';
import { officersFor } from '../content/oficiales.js';

const MAX_AFK_SHOTS = 3; // disparos automáticos seguidos antes de perder por tiempo

/**
 * Una sala: dos asientos (A y B), espectadores y la partida en curso.
 *
 * Responsabilidades: quién está sentado, temporizadores (colocación y turnos), turnos de la IA,
 * revancha y puntos al terminar. Las reglas del juego viven en domain/game.js; el transporte
 * (WebSocket) vive en gateway.js. La sala solo conoce "canales" con { send(msg), close() }.
 *
 * Miembro: { session, userId|null, name, avatar, rating|null, channel|null, online, graceTimer }
 */
export class Room {
  /**
   * @param {string} code
   * @param {{mode:'pvp'|'ai', size:number, biome?:string, difficulty:string, hitKeepsTurn:boolean, isPublic:boolean,
   *          mission?:{campaignId:string, missionId:number}}} options   `mission` = partida de campaña con configuración fija
   * @param {{pool, store, progress?, quota?, timing, maxSpectators:number, rng?:()=>number, log?:Function,
   *          onMemberGone:(session:string)=>void, onEmpty:(code:string)=>void}} deps
   */
  constructor(code, options, deps) {
    this.code = code;
    this.options = options;
    this.deps = deps;
    this.timing = deps.timing;
    this.rng = deps.rng ?? Math.random;
    this.log = deps.log ?? (() => {});

    // Misión de campaña: los jefes de cada bando (reales en campañas históricas, inventados en las de ficción).
    // Solo cambia lo que se MUESTRA; el historial y el progreso siguen usando la cuenta real (ver `roster`).
    this.cast = options.mission ? officersFor(options.mission.campaignId, options.mission.missionId, code) : null;

    this.seats = { A: null, B: null };
    this.roster = { A: null, B: null }; // datos de quien se sentó (persisten aunque se vaya)
    this.spectators = new Map();
    this.game = null;
    this.round = 0;
    this.wins = { A: 0, B: 0 };
    this.rematchVotes = { A: false, B: false };
    this.closedReason = null;
    this.result = null;
    this.settled = false;
    this.startedAt = null;
    this.touched = Date.now();
    this.disposed = false;

    this.timer = null;
    this.deadline = null;
    this.placeDeadline = null;
    this.turnKey = null;
    this.turnDeadline = null;
    this.afk = { A: 0, B: 0 };
    this.aiJob = null;
    this.aiTimer = null;
    this.starter = this.rng() < 0.5 ? 'A' : 'B';
  }

  // ------------------------------------------------------------ asientos
  get isAi() { return this.options.mode === 'ai'; }

  get status() { return this.game ? this.game.status : 'waiting'; }

  seatOf(session) {
    if (this.seats.A?.session === session) return 'A';
    if (this.seats.B?.session === session) return 'B';
    if (this.spectators.has(session)) return 'spectator';
    return null;
  }

  member(session) {
    const s = this.seatOf(session);
    return s === 'spectator' ? this.spectators.get(session) : s ? this.seats[s] : null;
  }

  /** Primer jugador (crea la sala). */
  seatCreator(member) {
    this.#sit('A', member);
    if (this.isAi) {
      this.#sit('B', { session: `ai:${this.code}`, userId: null, name: 'Almirante IA', avatar: '🤖', rating: null, isAi: true });
      this.#newGame();
      this.#afterChange(); // arma el temporizador de colocación
    }
  }

  /** Segundo jugador. Devuelve null si pudo sentarse, o un código de error. */
  join(member) {
    if (this.closedReason) return 'sala_cerrada';
    if (this.isAi || this.seats.B || this.status !== 'waiting') return 'sala_llena';
    if (member.userId && this.seats.A?.userId === member.userId) return 'ya_estas_en_la_sala';
    this.#sit('B', member);
    this.#newGame();
    this.#afterChange();
    return null;
  }

  spectate(member) {
    if (this.closedReason) return 'sala_cerrada';
    if (this.spectators.size >= this.deps.maxSpectators) return 'sala_llena';
    member.online = true;
    this.spectators.set(member.session, member);
    this.touched = Date.now();
    return null;
  }

  #sit(side, member) {
    member.online = true;
    member.graceTimer = null;
    this.seats[side] = member;
    this.roster[side] = {
      userId: member.userId ?? null, name: member.name, avatar: member.avatar,
      rating: member.rating ?? null, isAi: Boolean(member.isAi),
    };
  }

  #newGame() {
    this.#cancelAi();
    this.round += 1;
    this.game = new Game({ size: this.options.size, biome: this.options.biome, hitKeepsTurn: this.options.hitKeepsTurn, starter: this.starter, rng: this.rng });
    this.rematchVotes = { A: false, B: false };
    this.afk = { A: 0, B: 0 };
    this.result = null;
    this.settled = false;
    this.startedAt = new Date();
    this.turnKey = null;
    this.placeDeadline = this.timing.placementMs > 0 ? Date.now() + this.timing.placementMs : null;
    if (this.isAi) this.game.autoFleet('B');
  }

  // ------------------------------------------------------------ conexión
  /** Asocia (o re-asocia) un canal a un miembro y le manda el estado. */
  connect(session, channel) {
    const m = this.member(session);
    if (!m) return false;
    if (m.channel && m.channel !== channel) m.channel.close();
    clearTimeout(m.graceTimer);
    m.channel = channel;
    m.online = true;
    this.touched = Date.now();
    this.broadcast();
    return true;
  }

  /** Se cayó el socket. Los jugadores tienen un tiempo de gracia; los espectadores se van. */
  disconnect(session, channel) {
    const m = this.member(session);
    if (!m || m.channel !== channel) return; // ya lo reemplazó otra conexión
    m.channel = null;
    m.online = false;
    const seat = this.seatOf(session);
    if (seat === 'spectator') {
      this.#removeSpectator(session);
      return;
    }
    this.broadcast();
    m.graceTimer = setTimeout(() => this.#removePlayer(seat), this.timing.graceMs);
  }

  leave(session) {
    const seat = this.seatOf(session);
    if (seat === 'spectator') this.#removeSpectator(session);
    else if (seat) this.#removePlayer(seat);
  }

  #removeSpectator(session) {
    this.spectators.delete(session);
    this.deps.onMemberGone(session);
    this.broadcast();
  }

  #removePlayer(side) {
    const m = this.seats[side];
    if (!m || this.disposed) return;
    clearTimeout(m.graceTimer);
    this.deps.onMemberGone(m.session);
    this.seats[side] = null;

    // Abandonar una partida en curso es perderla (también contra la IA).
    if (this.game && this.game.status !== 'over') {
      this.game.forfeit(side, 'abandono');
      this.#settle();
    }
    const humansLeft = ['A', 'B'].filter((s) => this.seats[s] && !this.seats[s].isAi).length;
    if (humansLeft === 0) {
      this.#closeAll('sala_cerrada');
      return;
    }
    this.closedReason ??= 'rival_salio';
    this.#afterChange();
  }

  #closeAll(reason) {
    for (const m of this.spectators.values()) {
      m.channel?.send({ t: 'left', reason });
      this.deps.onMemberGone(m.session);
    }
    this.spectators.clear();
    this.dispose();
    this.deps.onEmpty(this.code);
  }

  // ------------------------------------------------------------ acciones
  randomize(session) {
    const side = this.seatOf(session);
    if (!['A', 'B'].includes(side)) return { error: 'no_eres_jugador' };
    if (!this.game || this.game.status !== 'placing') return { error: 'partida_no_iniciada' };
    return { ok: true, ships: this.game.randomFleet() };
  }

  ready(session, ships) {
    const side = this.seatOf(session);
    if (!['A', 'B'].includes(side)) return 'no_eres_jugador';
    if (!this.game) return 'partida_no_iniciada';
    const res = this.game.setFleet(side, ships);
    if (res.error) return res.error;
    this.#afterChange();
    return null;
  }

  fire(session, row, col) {
    const side = this.seatOf(session);
    if (!['A', 'B'].includes(side)) return 'no_eres_jugador';
    if (!this.game) return 'partida_no_iniciada';
    const res = this.game.fire(side, row, col);
    if (res.error) return res.error;
    this.afk[side] = 0;
    this.#afterChange();
    return null;
  }

  rematch(session) {
    const side = this.seatOf(session);
    if (!['A', 'B'].includes(side)) return 'no_eres_jugador';
    if (!this.game || this.game.status !== 'over' || this.closedReason) return 'partida_no_iniciada';
    // Cada partida nueva contra la IA de un invitado gasta una del cupo diario.
    const seat = this.seats[side];
    if (this.isAi && this.deps.quota && seat && !seat.userId && !this.rematchVotes[side]) {
      if (!this.deps.quota.take(seat.ip ?? 'desconocida').ok) return 'limite_invitado';
    }
    this.rematchVotes[side] = true;
    if (this.isAi) this.rematchVotes.B = true;
    if (this.rematchVotes.A && this.rematchVotes.B) {
      this.starter = other(this.starter); // alterna quién abre
      this.#newGame();
    }
    this.#afterChange();
    return null;
  }

  react(session, emoji) {
    if (!REACTIONS.includes(emoji)) return 'formato';
    const from = this.seatOf(session);
    if (!from) return 'sin_sala';
    this.#everyone((m) => m.channel?.send({ t: 'react', e: emoji, from }));
    return null;
  }

  // ------------------------------------------------------------ cambios de estado
  #afterChange() {
    if (this.disposed) return;
    this.touched = Date.now();
    if (this.game?.status === 'over' && !this.settled) this.#settle();
    this.#arm();
    this.broadcast();
    this.#maybeAiTurn();
  }

  /** Puntos y registro al terminar la partida. Se ejecuta una sola vez por partida. */
  #settle() {
    this.settled = true;
    const g = this.game;
    this.wins[g.winner] += 1;

    const scored = scoreMatch({
      mode: this.options.mode, difficulty: this.options.difficulty, size: g.size,
      winner: g.winner, reason: g.reason, stats: g.stats,
      players: { A: { rating: this.roster.A?.rating ?? null }, B: { rating: this.roster.B?.rating ?? null } },
    });
    const summaries = { A: summarize(g, 'A'), B: summarize(g, 'B') };
    this.result = {
      ranked: scored.ranked,
      points: { A: scored.A.points, B: scored.B.points },
      ratingDelta: { A: scored.A.ratingDelta, B: scored.B.ratingDelta },
      after: { A: null, B: null },
      mission: null,                       // resultado de la misión (solo en partidas de campaña)
      newAchievements: { A: [], B: [] },   // logros que se desbloquearon con esta partida
    };
    const ref = this.options.mission;
    const def = ref ? getMission(ref.campaignId, ref.missionId) : null;
    if (def) {
      // La evaluación no necesita base de datos: un invitado también ve sus estrellas (aunque no se guarden).
      this.result.mission = { ...ref, ...evaluateMission(def, summaries.A), saved: false, improved: false, previousStars: 0, bestShots: null };
    }

    const registered = ['A', 'B'].some((s) => this.roster[s]?.userId);
    if (!registered) return;
    const player = (s) => ({
      userId: this.roster[s]?.userId ?? null, name: this.roster[s]?.name ?? '?', isAi: Boolean(this.roster[s]?.isAi),
      shots: g.stats[s].shots, hits: g.stats[s].hits, points: scored[s].points, ratingDelta: scored[s].ratingDelta,
    });
    const record = {
      mode: this.options.mode, difficulty: this.options.difficulty, size: g.size,
      winnerSide: g.winner, reason: g.reason, ranked: scored.ranked,
      biome: this.options.biome ?? 'water',
      startedAt: this.startedAt, endedAt: new Date(), players: { A: player('A'), B: player('B') },
    };
    const result = this.result;
    this.deps.store.recordMatch(record)
      .then(async (after) => {
        result.after = after;
        await this.#rewards(result, summaries);
        if (!this.disposed && this.result === result) this.broadcast();
      })
      .catch((err) => this.log(`sala ${this.code}: no se pudo guardar la partida (${err.message})`));
  }

  /** Progreso de campaña y logros de cada persona con cuenta. Un fallo aquí nunca debe afectar a la partida. */
  async #rewards(result, summaries) {
    const progress = this.deps.progress;
    if (!progress) return;
    const match = { mode: this.options.mode, difficulty: this.options.difficulty, size: this.game.size, biome: this.options.biome ?? 'water' };
    await Promise.all(['A', 'B'].map(async (side) => {
      const r = this.roster[side];
      if (!r?.userId || r.isAi) return;
      try {
        const out = await progress.afterMatch({ userId: r.userId, summary: summaries[side], match, missionRef: side === 'A' ? this.options.mission ?? null : null });
        result.newAchievements[side] = out.newAchievements;
        if (side === 'A' && out.mission && result.mission) {
          const { saved = false, improved = false, previousStars = 0, bestShots = null } = out.mission;
          Object.assign(result.mission, { saved, improved, previousStars, bestShots });
        }
      } catch (err) {
        this.log(`sala ${this.code}: no se pudo guardar el progreso de ${side} (${err.message})`);
      }
    }));
  }

  /** Datos públicos de la misión (para el cliente). */
  #missionView() {
    const ref = this.options.mission;
    const camp = ref && getCampaign(ref.campaignId);
    const def = ref && getMission(ref.campaignId, ref.missionId);
    if (!camp || !def) return null;
    return {
      campaignId: camp.id, campaignTitle: camp.title, fiction: camp.fiction, missionId: def.id, title: def.title,
      total: camp.missions.length, next: camp.missions.some((m) => m.id === def.id + 1) ? def.id + 1 : null,
      objectives: [{ id: 'win', label: 'Gana la misión' }, ...def.optional.map((o) => ({ id: o.type, label: objectiveLabelOf(o) }))],
    };
  }

  /** Programa (o cancela) el único temporizador activo según la fase de la partida. */
  #arm() {
    clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
    const g = this.game;
    if (!g || this.disposed || g.status === 'over') return;

    let handler = null;
    if (g.status === 'placing') {
      this.deadline = this.placeDeadline;
      handler = () => this.#placementExpired();
    } else if (g.status === 'battle' && !this.roster[g.turn]?.isAi) {
      const key = `${g.turn}:${g.stats.A.shots + g.stats.B.shots}`;
      if (key !== this.turnKey) {
        this.turnKey = key;
        this.turnDeadline = this.timing.turnMs > 0 ? Date.now() + this.timing.turnMs : null;
      }
      this.deadline = this.turnDeadline;
      handler = () => this.#turnExpired();
    }
    if (handler && this.deadline) {
      this.timer = setTimeout(handler, Math.max(0, this.deadline - Date.now()));
    }
  }

  #placementExpired() {
    this.timer = null;
    if (!this.game || this.game.status !== 'placing') return;
    for (const side of ['A', 'B']) if (!this.game.ready[side]) this.game.autoFleet(side);
    this.log(`sala ${this.code}: flota colocada automáticamente por tiempo`);
    this.#afterChange();
  }

  #turnExpired() {
    this.timer = null;
    const g = this.game;
    if (!g || g.status !== 'battle') return;
    const side = g.turn;
    g.randomShot(side);
    this.afk[side] += 1;
    if (this.afk[side] >= MAX_AFK_SHOTS && g.status === 'battle') g.forfeit(side, 'tiempo');
    this.log(`sala ${this.code}: ${side} se quedó sin tiempo`);
    this.#afterChange();
  }

  // ------------------------------------------------------------ IA
  #cancelAi() {
    clearTimeout(this.aiTimer);
    this.aiTimer = null;
    this.aiJob?.abort.abort(); // si la IA ya estaba calculando en los hilos, el pool lo detiene
    this.aiJob = null;
  }

  /** Si le toca a la IA, piensa un momento (para que se sienta natural) y dispara. */
  #maybeAiTurn() {
    const g = this.game;
    if (!this.isAi || !g || g.status !== 'battle' || g.turn !== 'B' || this.aiJob) return;
    const job = { abort: new AbortController() };
    this.aiJob = job;
    const [min, max] = this.timing.aiThinkMs;
    const delay = min + Math.floor(this.rng() * Math.max(0, max - min));
    this.aiTimer = setTimeout(async () => {
      const enemy = g.boards.A;
      let index = null;
      try {
        // El cálculo se reparte entre los hilos del pool: el hilo principal sigue libre.
        index = await this.deps.pool.choose({
          size: g.size, shots: [...enemy.shots], remaining: enemy.remainingLengths(), difficulty: this.options.difficulty,
        }, { signal: job.abort.signal });
      } catch (err) {
        this.log(`sala ${this.code}: IA falló (${err.message}), dispara al azar`);
      }
      if (this.disposed || this.aiJob !== job || this.game !== g || g.status !== 'battle' || g.turn !== 'B') return;
      this.aiJob = null;
      let res = index === null ? { error: 'x' } : g.fire('B', Math.floor(index / g.size), index % g.size);
      if (res.error) res = g.randomShot('B');
      this.#afterChange();
    }, delay);
  }

  // ------------------------------------------------------------ difusión
  #everyone(fn) {
    for (const s of ['A', 'B']) if (this.seats[s] && !this.seats[s].isAi) fn(this.seats[s]);
    for (const m of this.spectators.values()) fn(m);
  }

  broadcast() {
    this.#everyone((m) => m.channel?.send(this.snapshot(m.session)));
  }

  #playerView(side) {
    const r = this.roster[side];
    if (!r) return null;
    const seat = this.seats[side];
    const o = this.cast?.[side] ?? null; // en una misión se muestra el jefe del bando, no el nombre de la cuenta ni «Almirante IA»
    return {
      name: o ? o.name : r.name, avatar: o && r.isAi ? o.badge : r.avatar, isAi: r.isAi, registered: Boolean(r.userId), rating: r.rating,
      online: r.isAi ? true : Boolean(seat?.online), left: !seat, ready: Boolean(this.game?.ready[side]),
      officer: Boolean(o), role: o?.role ?? null, invented: o ? this.cast.invented : null,
    };
  }

  snapshot(session) {
    const viewer = this.seatOf(session) ?? 'spectator';
    const now = Date.now();
    return {
      t: 'state',
      room: this.code,
      you: viewer,
      mode: this.options.mode,
      difficulty: this.options.difficulty,
      isPublic: this.options.isPublic,
      status: this.status,
      size: this.options.size,
      biome: this.options.biome ?? 'water',
      hitKeepsTurn: this.options.hitKeepsTurn,
      mission: this.#missionView(),
      turnMs: this.timing.turnMs,
      timeLeft: this.deadline ? Math.max(0, this.deadline - now) : null, // colocación o turno actual
      round: this.round,
      wins: { ...this.wins },
      rematch: { ...this.rematchVotes },
      spectators: this.spectators.size,
      players: { A: this.#playerView('A'), B: this.#playerView('B') },
      game: this.game ? this.game.snapshot(viewer) : null,
      result: this.result,
      closedReason: this.closedReason,
    };
  }

  /** Datos públicos para el listado de salas. */
  info() {
    return {
      code: this.code, mode: this.options.mode, size: this.options.size, biome: this.options.biome ?? 'water', difficulty: this.options.difficulty,
      status: this.status, players: ['A', 'B'].map((s) => this.roster[s]?.name).filter(Boolean),
      spectators: this.spectators.size, joinable: !this.isAi && !this.closedReason && this.status === 'waiting',
    };
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.#cancelAi();
    for (const s of ['A', 'B']) if (this.seats[s]) clearTimeout(this.seats[s].graceTimer);
  }
}
