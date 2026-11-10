import { createMemoryStore } from '../src/repositories/memoryStore.js';
import { storeContract } from './store.contract.js';

storeContract('memoria', async () => createMemoryStore());
