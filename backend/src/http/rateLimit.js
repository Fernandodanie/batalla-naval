/** Limitador simple por IP (ventana fija, en memoria). Suficiente para una sola instancia. */
export function rateLimit({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'desconocida';
    let h = hits.get(key);
    if (!h || h.resetAt <= now) { h = { count: 0, resetAt: now + windowMs }; hits.set(key, h); }
    if (++h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'demasiados_intentos' });
    }
    next();
  };
}
