// Hilo de trabajo: ejecuta tareas (ver tasks.js) fuera del hilo principal.
import { parentPort } from 'node:worker_threads';
import { runTask } from './tasks.js';

parentPort.on('message', (msg) => {
  try {
    const { reply, transfer } = runTask(msg);
    parentPort.postMessage({ id: msg.id, ...reply }, transfer ?? []);
  } catch (err) {
    parentPort.postMessage({ id: msg.id, error: String(err?.message ?? err) });
  }
});
