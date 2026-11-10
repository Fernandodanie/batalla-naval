/** Cliente de la API REST (mismo origen: nginx reenvía /api al backend). */

const TOKEN_KEY = 'bn.token';
const safe = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
};

export const session = {
  get token() { return safe.get(TOKEN_KEY); },
  save(token) { safe.set(TOKEN_KEY, token); },
  clear() { safe.del(TOKEN_KEY); },
};

/** Invitado guardado en este navegador ({ name, avatar }), para no pedir el nombre en cada visita. */
const GUEST_KEY = 'bn.guest';
export const guestStore = {
  get() {
    try {
      const g = JSON.parse(safe.get(GUEST_KEY) ?? 'null');
      const name = typeof g?.name === 'string' ? g.name.trim().slice(0, 16) : '';
      return name ? { name, avatar: typeof g.avatar === 'string' ? g.avatar : '' } : null;
    } catch { return null; }
  },
  save({ name, avatar = '' }) { safe.set(GUEST_KEY, JSON.stringify({ name, avatar })); },
  clear() { safe.del(GUEST_KEY); },
};

export class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

async function request(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('sin_conexion', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'error', res.status);
  return data;
}

export const api = {
  meta: () => request('GET', '/api/meta'),
  register: (emailOrObj, username, password, avatar) => {
    const body = typeof emailOrObj === 'object' && emailOrObj !== null
      ? emailOrObj
      : { email: emailOrObj, username, password, avatar };
    return request('POST', '/api/auth/register', body);
  },
  login: (emailOrObj, password) => {
    const body = typeof emailOrObj === 'object' && emailOrObj !== null
      ? emailOrObj
      : { email: emailOrObj, password };
    return request('POST', '/api/auth/login', body);
  },
  me: () => request('GET', '/api/me'),
  leaderboard: (limit = 10) => request('GET', `/api/leaderboard?limit=${limit}`),
  rooms: () => request('GET', '/api/rooms'),
  campaigns: () => request('GET', '/api/campaigns'),
  progress: () => request('GET', '/api/progress'),
  /** Corrige las preguntas de una misión (el servidor guarda el mejor resultado si hay cuenta). */
  quiz: (campaignId, missionId, answers) => request('POST', '/api/quiz', { campaignId, missionId, answers }),
  quota: () => request('GET', '/api/quota'),
};
