/**
 * Datos de demostración para el ranking. Uso:  npm run db:seed
 * Crea 5 cuentas (contraseña: demo1234) con puntos de ejemplo. No toca cuentas existentes.
 */
import bcrypt from 'bcryptjs';
import { loadConfig } from '../src/config.js';
import { createStore } from '../src/repositories/index.js';

const DEMO = [
  { email: 'almirante@batallanaval.local', username: 'almirante', avatar: '⚓', points: 2450, wins: 14 },
  { email: 'capitana@batallanaval.local', username: 'capitana', avatar: '🦈', points: 1820, wins: 10 },
  { email: 'corsario@batallanaval.local', username: 'corsario', avatar: '🏴‍☠️', points: 960, wins: 6 },
  { email: 'grumete@batallanaval.local', username: 'grumete', avatar: '🐙', points: 410, wins: 3 },
  { email: 'novato@batallanaval.local', username: 'novato', avatar: '🐧', points: 80, wins: 1 },
];

const store = await createStore(loadConfig());
const passwordHash = await bcrypt.hash('demo1234', 10);

for (const demo of DEMO) {
  if ((await store.findByEmail(demo.email)) || (await store.findByUsername(demo.username))) {
    console.log(`= ${demo.username} ya existe`);
    continue;
  }
  const user = await store.createUser({ email: demo.email, username: demo.username, passwordHash, avatar: demo.avatar });
  const perWin = Math.round(demo.points / demo.wins);
  for (let i = 0; i < demo.wins; i++) {
    await store.recordMatch({
      mode: 'ai', difficulty: 'normal', size: 10, winnerSide: 'A', reason: 'flota_hundida', ranked: false,
      startedAt: new Date(Date.now() - 600_000), endedAt: new Date(),
      players: {
        A: { userId: user.id, name: user.username, isAi: false, shots: 45, hits: 17, points: perWin, ratingDelta: 0 },
        B: { userId: null, name: 'Almirante IA', isAi: true, shots: 30, hits: 9, points: 0, ratingDelta: 0 },
      },
    });
  }
  console.log(`+ ${demo.username} (${demo.points} pts)`);
}
await store.close();
