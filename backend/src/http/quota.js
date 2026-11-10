/**
 * Cupo diario de partidas contra la IA para invitados (sin cuenta). Se cuenta por clave (la IP) y por día UTC.
 * Vive en memoria: se reinicia al reiniciar el servidor, y es suficiente para desalentar el abuso sin bloquear el juego casual.
 * `limit` = 0 desactiva el cupo.
 */
export function createGuestQuota({ limit = 10, now = () => Date.now() } = {}) {
  const used = new Map(); // clave → { day, n }
  const day = () => Math.floor(now() / 86_400_000);

  const entry = (key) => {
    const d = day();
    let e = used.get(key);
    if (!e || e.day !== d) { e = { day: d, n: 0 }; used.set(key, e); }
    return e;
  };

  const sweep = setInterval(() => {
    const d = day();
    for (const [k, e] of used) if (e.day !== d) used.delete(k);
  }, 3_600_000);
  sweep.unref();

  return {
    limit,
    /** Cuántas partidas le quedan hoy (null = sin límite). */
    left(key) { return limit > 0 ? Math.max(0, limit - entry(key).n) : null; },
    /** Gasta una partida. Devuelve { ok, left }. */
    take(key) {
      if (limit <= 0) return { ok: true, left: null };
      const e = entry(key);
      if (e.n >= limit) return { ok: false, left: 0 };
      e.n += 1;
      return { ok: true, left: limit - e.n };
    },
    close() { clearInterval(sweep); },
  };
}

/**
 * IP del cliente en una conexión WebSocket. Detrás de nginx se usa la última dirección de X-Forwarded-For (la que vio el proxy);
 * sin proxy, la del socket. Igual que `req.ip` de Express con `trust proxy = 1`.
 */
export function ipOf(req) {
  const xff = String(req.headers?.['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.at(-1) ?? req.socket?.remoteAddress ?? 'desconocida';
}
