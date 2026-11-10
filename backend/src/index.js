import os from 'node:os';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const log = (m) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);
const app = await createApp({ config, log });

app.server.listen(config.port, config.host, () => {
  console.log(`\nBatalla Naval (backend) listo en el puerto ${config.port}`);
  console.log(`  Almacenamiento: ${app.store.kind}   IA: ${app.pool.stats().mode} (${app.pool.stats().workers} hilos)`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) console.log(`  Red local: http://${i.address}:${config.port}`);
  }
  console.log('');
});

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await app.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
