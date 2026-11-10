/**
 * Conexión WebSocket con reconexión automática.
 * Al abrir envía 'hello' con el token de la cuenta (si hay) y la sesión guardada, así el servidor
 * puede devolverte a tu asiento si se cortó la red (por ejemplo, el celular cambió de Wi-Fi a datos).
 */
const SESSION_KEY = 'bn.session'; // sessionStorage: cada pestaña es un jugador distinto

const store = {
  get: () => { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } },
  set: (v) => { try { sessionStorage.setItem(SESSION_KEY, v); } catch { /* sin almacenamiento */ } },
};

export class Socket {
  /** @param {{getToken:()=>string|null}} opts */
  constructor({ getToken = () => null } = {}) {
    this.getToken = getToken;
    this.handlers = new Map();
    this.ws = null;
    this.attempt = 0;
    this.latency = null;
    this.wanted = false;
    this.reconnectTimer = null;
    this.pingTimer = null;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  #emit(type, payload) {
    for (const fn of this.handlers.get(type) ?? []) fn(payload);
  }

  connect() {
    this.wanted = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws && this.ws.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.#emit('status', 'connecting');
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.attempt = 0;
      ws.send(JSON.stringify({ t: 'hello', auth: this.getToken() || undefined, session: store.get() || undefined }));
    });
    ws.addEventListener('message', (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') {
        store.set(msg.session);
        this.#emit('status', 'online');
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: Date.now() }), 5000);
      } else if (msg.t === 'pong') {
        this.latency = Date.now() - msg.ts;
        this.#emit('latency', this.latency);
      }
      this.#emit(msg.t, msg);
    });
    ws.addEventListener('close', () => {
      clearInterval(this.pingTimer);
      this.#emit('status', 'offline');
      if (!this.wanted || this.ws !== ws) return;
      const delay = Math.min(5000, 400 * 2 ** this.attempt++);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    });
    ws.addEventListener('error', () => {});
  }

  /** Reconecta (por ejemplo después de iniciar o cerrar sesión, para que el servidor vea la cuenta nueva). */
  reconnect() {
    const old = this.ws;
    this.ws = null;
    old?.close();
    this.connect();
  }

  send(msg) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }
}
