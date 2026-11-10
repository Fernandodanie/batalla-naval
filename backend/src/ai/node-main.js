/**
 * Arranca un NODO de cálculo de IA (ver node-server.js).
 *
 *   AI_NODE_TOKEN=secreto node src/ai/node-main.js [--port 5001] [--host 127.0.0.1] [--workers N]
 *
 * Variables: AI_NODE_TOKEN (obligatoria), AI_NODE_PORT, AI_NODE_HOST, AI_NODE_WORKERS.
 * Por seguridad escucha solo en 127.0.0.1 salvo que indiques otra interfaz (p. ej. 0.0.0.0 para la red local).
 */
import os from 'node:os';
import { createAiNodeServer } from './node-server.js';

const argv = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const port = Number(argv.port ?? process.env.AI_NODE_PORT ?? 5001);
const host = argv.host ?? process.env.AI_NODE_HOST ?? '127.0.0.1';
const workers = Number(argv.workers ?? process.env.AI_NODE_WORKERS ?? Math.max(1, os.availableParallelism() - 1));
const token = process.env.AI_NODE_TOKEN;

if (!token) { console.error('Falta AI_NODE_TOKEN (secreto compartido con el servidor de juego).'); process.exit(1); }

const server = createAiNodeServer({ workers, token });
server.listen(port, host, () => console.log(`Nodo de IA listo en http://${host}:${port}  (${workers} hilos, ${os.availableParallelism()} núcleos)`));

const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
