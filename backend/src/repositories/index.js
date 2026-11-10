import { createMemoryStore } from './memoryStore.js';

/** Elige el almacén según la configuración: 'prisma' (PostgreSQL) o 'memory'. */
export async function createStore(config) {
  if (config.storage === 'prisma') {
    const { createPrismaStore } = await import('./prismaStore.js');
    return createPrismaStore(config.databaseUrl);
  }
  return createMemoryStore();
}
