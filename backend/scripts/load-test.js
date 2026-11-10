/**
 * Prueba de carga: N jugadores simulados (WebSocket) juegan partidas completas contra la IA.
 *
 *   node scripts/load-test.js [--clients 50] [--games 3] [--size 8] [--difficulty normal] [--spawn] [--url ws://localhost:4000/ws]
 *
 * Con --spawn levanta el servidor él mismo (proceso aparte, en un puerto libre, con la IA "pensando" 1-3 ms y
 * sin límites de mensajes) y lo apaga al terminar: así mides el servidor sin que el generador de carga le quite
 * CPU dentro del mismo proceso. Sin --spawn apunta a un servidor ya corriendo en --url (con AI_THINK_MIN_MS=1,
 * AI_THINK_MAX_MS=3 y WS_MSGS_PER_SEC alto, o las partidas durarán minutos por el "tiempo de pensar" de la IA).
 *
 * Mide, por disparo: tiempo desde que el cliente dispara hasta recibir el estado con el resultado (latencia de
 * ida y vuelta del servidor), y en total partidas por segundo y errores. También lee /api/status al final
 * (retraso del event loop y estado del pool de IA).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import WebSocket from 'ws';
import { chooseShot } from '../src/ai/strategies.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const CLIENTS = Number(args.clients) || 50;
const GAMES = Number(args.games) || 3;
const SIZE = Number(args.size) || 8;
const DIFFICULTY = args.difficulty ?? 'normal';
const GAME_TIMEOUT = 60_000;

const freePort = () => new Promise((resolve) => {
  const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

let child = null;
let url = args.url ?? 'ws://127.0.0.1:4000/ws';
if (args.spawn) {
  const port = await freePort();
  child = spawn(process.execPath, ['src/index.js'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'development', STATIC_DIR: '', AI_THINK_MIN_MS: '1', AI_THINK_MAX_MS: '3',
      WS_MSGS_PER_SEC: '100000', MAX_ROOMS: String(CLIENTS * 2), TURN_SECONDS: '0', PLACEMENT_SECONDS: '0' },
  });
  url = `ws://127.0.0.1:${port}/ws`;
  for (let i = 0; i < 100; i++) { // espera a que el servidor responda
    try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) break; } catch { /* aún no */ }
    await new Promise((r) => setTimeout(r, 100));
  }
}
const httpBase = url.replace(/^ws/, 'http').replace(/\/ws$/, '');

const latencies = [];
let finished = 0, errors = 0, shotsFired = 0;

/** Un jugador: crea sala contra la IA, coloca la flota y dispara hasta terminar. Repite `GAMES` veces. */
async function player(id) {
  for (let g = 0; g < GAMES; g++) {
    try { await playOne(); finished += 1; } catch { errors += 1; }
  }
}

function playOne() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let you = null, placed = false, lastShots = -1, sentAt = 0;
    const fail = (why) => { clearTimeout(timer); ws.terminate(); reject(new Error(why)); };
    const timer = setTimeout(() => fail('timeout'), GAME_TIMEOUT);
    ws.on('error', () => fail('ws'));
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello' })));
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m.t === 'welcome') ws.send(JSON.stringify({ t: 'create', mode: 'ai', size: SIZE, difficulty: DIFFICULTY, name: 'bot' }));
      else if (m.t === 'fleet') ws.send(JSON.stringify({ t: 'ready', ships: m.ships }));
      else if (m.t === 'error') fail(m.code);
      else if (m.t === 'state') {
        you = m.you;
        const g = m.game;
        if (!g) return;
        if (sentAt && g.stats[you].shots > lastShots) { latencies.push(performance.now() - sentAt); sentAt = 0; }
        if (g.status === 'placing' && !g.ready[you] && !placed) { placed = true; ws.send(JSON.stringify({ t: 'randomize' })); }
        if (m.status === 'over') { clearTimeout(timer); ws.close(); resolve(); return; }
        if (g.status === 'battle' && g.turn === you && !sentAt) {
          const enemy = g.boards[you === 'A' ? 'B' : 'A'];
          const remaining = enemy.fleet.filter((f) => !f.sunk).map((f) => f.length);
          const i = chooseShot({ size: g.size, shots: enemy.shots, remaining, difficulty: 'normal' });
          lastShots = g.stats[you].shots;
          sentAt = performance.now();
          shotsFired += 1;
          ws.send(JSON.stringify({ t: 'fire', row: Math.floor(i / g.size), col: i % g.size }));
        }
      }
    });
  });
}

const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;
console.log(`\nCarga: ${CLIENTS} jugadores × ${GAMES} partidas ${SIZE}×${SIZE} contra IA "${DIFFICULTY}" en ${url}\n`);
const t0 = performance.now();
await Promise.all(Array.from({ length: CLIENTS }, (_, i) => player(i)));
const secs = (performance.now() - t0) / 1000;

let status = null;
try { status = await (await fetch(`${httpBase}/api/status`)).json(); } catch { /* servidor sin /api/status */ }
if (child) { child.kill('SIGTERM'); }

console.log(`Partidas completas : ${finished} de ${CLIENTS * GAMES}   (errores/timeouts: ${errors})`);
console.log(`Duración           : ${secs.toFixed(1)} s   →   ${(finished / secs).toFixed(1)} partidas/s,  ${(shotsFired / secs).toFixed(0)} disparos/s`);
console.log(`Latencia por disparo (cliente → resultado): p50 ${pct(latencies, 50).toFixed(1)} ms | p95 ${pct(latencies, 95).toFixed(1)} ms | p99 ${pct(latencies, 99).toFixed(1)} ms | máx ${Math.max(0, ...latencies).toFixed(1)} ms`);
if (status?.eventLoop) console.log(`Servidor           : retraso del event loop p50 ${status.eventLoop.p50} ms | p99 ${status.eventLoop.p99} ms | máx ${status.eventLoop.max} ms; IA ${status.ai.mode} (${status.ai.workers} hilos), ${status.ai.completed} tareas, ${status.ai.inlineRuns} en hilo principal`);
console.log('');
process.exit(errors > 0 ? 1 : 0);
