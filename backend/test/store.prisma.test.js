import { storeContract } from './store.contract.js';

// Solo corre con una base real:  DATABASE_URL=postgresql://... npm test
// Cuidado: limpia las tablas User/Match/MatchPlayer antes de cada prueba.
const url = process.env.TEST_DATABASE_URL;

storeContract('prisma', async () => {
  const { createPrismaStore } = await import('../src/repositories/prismaStore.js');
  const store = await createPrismaStore(url);
  await store.prisma.matchPlayer.deleteMany();
  await store.prisma.match.deleteMany();
  await store.prisma.user.deleteMany();
  return store;
}, { skip: url ? false : 'define TEST_DATABASE_URL para probar contra PostgreSQL' });
