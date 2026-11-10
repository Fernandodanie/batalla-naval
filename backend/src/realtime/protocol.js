import { z } from 'zod';
import { DIFFICULTIES } from '../ai/strategies.js';
import { BIOMES } from '../domain/fleet.js';

const name = z.string().max(40).optional();
const avatar = z.string().max(16).optional();
const code = z.string().max(8);

const ship = z.object({
  id: z.string().max(8),
  row: z.number().int(),
  col: z.number().int(),
  horizontal: z.boolean(),
});

/** Mensajes que puede enviar un cliente. Cualquier otra cosa se rechaza con { code: 'formato' }. */
export const clientMessage = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), auth: z.string().max(2048).optional(), session: z.string().max(64).optional() }),
  z.object({
    t: z.literal('create'),
    mode: z.enum(['pvp', 'ai']).default('pvp'),
    size: z.number().int().default(10),
    biome: z.enum(Object.keys(BIOMES)).default('water'),
    difficulty: z.enum(DIFFICULTIES).default('normal'),
    hitKeepsTurn: z.boolean().default(false),
    isPublic: z.boolean().default(true),
    name, avatar,
  }),
  z.object({ t: z.literal('mission'), campaign: z.string().max(16), mission: z.number().int().min(1).max(50), name, avatar }),
  z.object({ t: z.literal('join'), room: code, name, avatar }),
  z.object({ t: z.literal('spectate'), room: code, name }),
  z.object({ t: z.literal('randomize') }),
  z.object({ t: z.literal('ready'), ships: z.array(ship).max(32) }),
  z.object({ t: z.literal('fire'), row: z.number().int(), col: z.number().int() }),
  z.object({ t: z.literal('rematch') }),
  z.object({ t: z.literal('react'), e: z.string().max(8) }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('ping'), ts: z.number().optional() }),
]);
