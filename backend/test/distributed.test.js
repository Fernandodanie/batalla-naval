import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DistributedPool } from '../src/ai/distributed.js';
import { createAiNodeServer, validateTask } from '../src/ai/node-server.js';
import { AiPool } from '../src/ai/pool.js';
import { Client, startServer } from './helpers.js';
import { decode, encode } from '../src/ai/wire.js';

const TOKEN = 'secreto-de-pruebas';
const FLEET = [5, 4, 3, 3, 2];
const board = (marks = {}) => { const s = new Array(100).fill(0); for (const [i, v] of Object.entries(marks)) s[i] = v; return s; };

async function startNode(workers = 1) {
  const server = createAiNodeServer({ workers, token: TOKEN });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const stop = () => new Promise((r) => { server.closeAllConnections(); server.close(r); });
  return { server, url, stop };
}

test('wire: los arreglos tipados sobreviven al viaje por JSON', () => {
  const original = { a: 1, density: Int32Array.from([0, 5, -3, 2_000_000_000]), nested: { list: [1, 2] } };
  const back = decode(encode(original));
  assert.ok(back.density instanceof Int32Array);
  assert.deepEqual([...back.density], [...original.density]);
  assert.deepEqual(back.nested, original.nested);
});

test('validateTask: acota cada campo y descarta lo que no conoce', () => {
  const ok = { kind: 'mc', mode: 'message', size: 10, shots: board(), remaining: FLEET, samples: 1000, seed: 7, evil: 'x', __proto__: { y: 1 } };
  const clean = validateTask(JSON.parse(JSON.stringify(ok)));
  assert.equal(clean.evil, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['kind', 'mode', 'remaining', 'samples', 'seed', 'shots', 'size']);

  const reject = (patch, why) => assert.throws(() => validateTask({ ...ok, ...patch }), (e) => e.status === 400, why);
  reject({ mode: 'shared' }, 'memoria compartida no cruza la red');
  reject({ size: 7 }, 'tamaño no soportado');
  reject({ samples: 6_000_000 }, 'demasiadas muestras');
  reject({ samples: 0 }, 'muestras no positivas');
  reject({ seed: -1 }, 'semilla inválida');
  reject({ shots: board().slice(1) }, 'largo del tablero');
  reject({ shots: board({ 3: 9 }) }, 'valor de casilla fuera de rango');
  reject({ remaining: new Array(50).fill(2) }, 'demasiados barcos');
  assert.throws(() => validateTask({ kind: 'rm -rf' }), /kind_desconocido/);
  assert.throws(() => validateTask({ kind: 'game', size: 10, games: 100_000, seed: 1, a: { difficulty: 'hard' }, b: { difficulty: 'hard' } }), /games_invalido/);
  assert.throws(() => validateTask({ kind: 'game', size: 10, games: 2, seed: 1, a: { difficulty: 'dios' }, b: { difficulty: 'hard' } }), /estrategia_invalida/);
});

test('nodo: exige token, informa su capacidad y rechaza tareas inválidas', async () => {
  const node = await startNode(2);
  try {
    assert.equal((await fetch(`${node.url}/health`)).status, 401);
    assert.equal((await fetch(`${node.url}/health`, { headers: { authorization: 'Bearer incorrecto' } })).status, 401);
    const health = await (await fetch(`${node.url}/health`, { headers: { authorization: `Bearer ${TOKEN}` } })).json();
    assert.equal(health.ok, true);
    assert.equal(health.workers, 2);

    const post = (body) => fetch(`${node.url}/task`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body });
    assert.equal((await post('{no es json')).status, 400);
    assert.equal((await post(JSON.stringify({ kind: 'mc', mode: 'shared' }))).status, 400);
    assert.equal((await post('x'.repeat(300 * 1024))).status, 413);
  } finally { await node.stop(); }
});

test('distribuido: el resultado es IDÉNTICO al de hilos locales y las tareas se reparten entre nodos', async () => {
  const [n1, n2] = [await startNode(1), await startNode(1)];
  const dist = new DistributedPool({ nodes: [n1.url, n2.url], token: TOKEN, timeoutMs: 30_000 });
  const local = new AiPool({ size: 2, timeoutMs: 30_000 });
  try {
    await dist.ready;
    assert.equal(dist.parallelism, 2);
    const args = { size: 10, shots: board({ 45: 2, 0: 1 }), remaining: FLEET, samples: 8000, seed: 99 };
    const remote = await dist.density(args);
    const here = await local.density({ ...args, mode: 'message' });
    assert.equal(remote.accepted, here.accepted);
    assert.deepEqual([...remote.density], [...here.density]);
    const [a, b] = dist.stats().nodes.map((n) => n.completed);
    assert.ok(a >= 1 && b >= 1, `cada nodo recibió trabajo (${a}, ${b})`);

    const t = { games: 4, size: 8, a: { difficulty: 'hard' }, b: { difficulty: 'normal' }, seed: 5 };
    assert.deepEqual(await dist.tournament(t), await new AiPool({ size: 0 }).tournament(t));

    const idx = await dist.choose({ size: 10, shots: board({ 45: 2 }), remaining: FLEET, difficulty: 'expert', samples: 40_000 });
    assert.ok([35, 55, 44, 46].includes(idx), `esperaba una casilla junto al impacto, fue ${idx}`);
  } finally { await Promise.all([dist.close(), local.close(), n1.stop(), n2.stop()]); }
});

test('tolerancia a fallos: si un nodo cae, la tarea se reintenta en otro y el resultado no cambia', async () => {
  const [n1, n2] = [await startNode(1), await startNode(1)];
  const dist = new DistributedPool({ nodes: [n1.url, n2.url], token: TOKEN, timeoutMs: 30_000, healthIntervalMs: 0 });
  const local = new AiPool({ size: 2 });
  try {
    await dist.ready;
    const args = { size: 10, shots: board(), remaining: FLEET, samples: 6000, seed: 3 };
    const expected = await local.density({ ...args, mode: 'message' });
    await n1.stop(); // se cae un nodo
    const got = await dist.density(args);
    assert.deepEqual([...got.density], [...expected.density]);
    const stats = dist.stats();
    assert.ok(stats.nodes[0].failures >= 1);
    assert.equal(stats.nodes[0].healthy, false);
    assert.ok(stats.nodes[1].completed >= 2, 'el nodo sano absorbió los trozos del caído');
  } finally { await Promise.all([dist.close(), local.close(), n2.stop()]); }
});

test('sin nodos: usa el pool local de respaldo; sin respaldo falla con "sin_nodos"', async () => {
  const dead = await startNode(1);
  const url = dead.url;
  await dead.stop();
  const args = { size: 10, shots: board(), remaining: FLEET, samples: 2000, seed: 1 };

  const withFallback = new DistributedPool({ nodes: [url], token: TOKEN, retries: 1, healthIntervalMs: 0, fallback: new AiPool({ size: 0 }) });
  const without = new DistributedPool({ nodes: [url], token: TOKEN, retries: 1, healthIntervalMs: 0 });
  try {
    const r = await withFallback.density(args);
    assert.equal(r.accepted, 2000);
    assert.ok(withFallback.stats().fellBack >= 1);
    await assert.rejects(without.density(args), /sin_nodos/);
  } finally { await Promise.all([withFallback.close(), without.close()]); }
});

test('token incorrecto: el nodo rechaza y el coordinador cae al respaldo local', async () => {
  const node = await startNode(1);
  const pool = new DistributedPool({ nodes: [node.url], token: 'otro-token', retries: 0, healthIntervalMs: 0, fallback: new AiPool({ size: 0 }) });
  try {
    const r = await pool.density({ size: 10, shots: board(), remaining: FLEET, samples: 1000, seed: 1 });
    assert.equal(r.accepted, 1000);
    assert.equal(pool.stats().fellBack, 1);
  } finally { await Promise.all([pool.close(), node.stop()]); }
});

test('cancelar la petición detiene el cálculo en el nodo y libera sus hilos', async () => {
  const node = await startNode(1);
  const dist = new DistributedPool({ nodes: [node.url], token: TOKEN, timeoutMs: 120_000, healthIntervalMs: 0 });
  try {
    await dist.ready;
    const ctrl = new AbortController();
    const big = dist.density({ size: 10, shots: board(), remaining: FLEET, samples: 4_000_000, signal: ctrl.signal });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(node.server.pool.stats().busy, 1, 'el nodo está calculando');
    ctrl.abort();
    await assert.rejects(big, /cancelado/);
    const t0 = Date.now();
    while (node.server.pool.stats().busy > 0 && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 25));
    assert.equal(node.server.pool.stats().busy, 0, 'el hilo del nodo quedó libre tras la cancelación');
  } finally { await Promise.all([dist.close(), node.stop()]); }
});

test('integración: una partida completa contra la IA experta se juega con el cálculo en nodos remotos', async () => {
  const [n1, n2] = [await startNode(1), await startNode(1)];
  const pool = new DistributedPool({ nodes: [n1.url, n2.url], token: TOKEN, mcSamples: 1500, minParallelCost: 0, timeoutMs: 20_000 });
  let srv;
  try {
    srv = await startServer({ pool });
    await pool.ready;
    const c = await Client.connect(srv);
    c.send({ t: 'create', mode: 'ai', size: 8, difficulty: 'expert', name: 'Ana' });
    await c.untilState((s) => s.status === 'placing');
    const end = await c.autoPlay('hard', 40_000);
    assert.equal(end.status, 'over');
    const [a, b] = pool.stats().nodes.map((n) => n.completed);
    assert.ok(a + b > 0, 'los nodos calcularon jugadas de la IA');
    c.close();
  } finally { await Promise.all([srv?.close(), pool.close(), n1.stop(), n2.stop()]); }
});
