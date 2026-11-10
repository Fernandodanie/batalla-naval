import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AVATARS } from '../domain/profile.js';
import { toPublicUser } from '../repositories/memoryStore.js';

export const AUTH_MESSAGES = {
  correo_invalido: 'Ingresa un correo electrónico válido.',
  correo_ocupado: 'Ya existe una cuenta registrada con ese correo.',
  usuario_invalido: 'El nombre debe tener entre 3 y 16 caracteres (letras, números y _).',
  usuario_ocupado: 'Ese nombre para mostrar ya está en uso.',
  password_corta: 'La contraseña necesita al menos 8 caracteres.',
  password_larga: 'La contraseña es demasiado larga.',
  avatar_invalido: 'El avatar elegido no es válido.',
  credenciales_invalidas: 'Correo o contraseña incorrectos.',
};

export const emailSchema = z.string().trim().toLowerCase().max(254, 'correo_invalido').email('correo_invalido');

export const registerSchema = z.object({
  email: emailSchema,
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,16}$/, 'usuario_invalido'),
  password: z.string().min(8, 'password_corta').max(72, 'password_larga'),
  avatar: z.string().refine((a) => AVATARS.includes(a), 'avatar_invalido').optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export class AuthError extends Error {
  constructor(code, status = 400) {
    super(AUTH_MESSAGES[code] ?? code);
    this.code = code;
    this.status = status;
  }
}

export function createAuth({ store, secret, rounds = 10, expiresIn = '7d' }) {
  // Hash falso para gastar el mismo tiempo cuando el usuario no existe (evita revelar cuentas).
  const dummyHash = bcrypt.hashSync('no-existe', rounds);
  const sign = (user) => jwt.sign({ sub: user.id }, secret, { expiresIn });

  return {
    async register(input) {
      const { email, username, password, avatar = '' } = registerSchema.parse(input);
      const passwordHash = await bcrypt.hash(password, rounds);
      try {
        const user = await store.createUser({ email, username, passwordHash, avatar });
        return { user: toPublicUser(user), token: sign(user) };
      } catch (err) {
        if (err.code === 'email_taken') throw new AuthError('correo_ocupado', 409);
        if (err.code === 'username_taken') throw new AuthError('usuario_ocupado', 409);
        throw err;
      }
    },

    async login(input) {
      const { email, password } = loginSchema.parse(input);
      const user = await store.findByEmail(email);
      const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
      if (!user || !ok) throw new AuthError('credenciales_invalidas', 401);
      return { user: toPublicUser(user), token: sign(user) };
    },

    /** Devuelve el usuario público si el token es válido y la cuenta existe; si no, null. */
    async userFromToken(token) {
      try {
        const { sub } = jwt.verify(String(token), secret);
        return toPublicUser(await store.findById(sub));
      } catch {
        return null;
      }
    },
  };
}
