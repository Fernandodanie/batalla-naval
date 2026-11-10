import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/domain/game.js';
import { seeded } from './seed.js';

/** Partida de 8×8 con las dos flotas listas. */
function readyGame(opts = {}) {
  const g = new Game({ size: 8, rng: seeded(7), ...opts });
  assert.ok(g.autoFleet('A').ok);
  assert.ok(g.autoFleet('B').ok);
  return g;
}

/** Primera casilla ocupada / libre del tablero de `side`. */
const shipCell = (g, side) => g.boards[side].ships[0].cells[0];
const waterCell = (g, side) => g.boards[side].owner.findIndex((o) => o === null);
const rc = (g, i) => [Math.floor(i / g.size), i % g.size];

test('empieza en colocación y pasa a batalla cuando ambos están listos', () => {
  const g = new Game({ size: 8, rng: seeded(1) });
  assert.equal(g.status, 'placing');
  assert.equal(g.fire('A', 0, 0).error, 'partida_no_iniciada');
  g.autoFleet('A');
  assert.equal(g.status, 'placing');
  assert.equal(g.autoFleet('A').error, 'ya_estas_listo');
  g.autoFleet('B');
  assert.equal(g.status, 'battle');
  assert.equal(g.turn, 'A');
});

test('setFleet rechaza flotas incompletas, repetidas o inválidas', () => {
  const g = new Game({ size: 8, rng: seeded(2) });
  const full = g.randomFleet();
  assert.equal(g.setFleet('A', full.slice(1)).error, 'flota_incompleta');
  assert.equal(g.setFleet('A', [...full.slice(1), full[1]]).error, 'barco_repetido');
  assert.equal(g.setFleet('A', 'hola').error, 'formato');
  const bad = full.map((p, i) => (i === 0 ? { ...p, row: 99 } : p));
  assert.equal(g.setFleet('A', bad).error, 'fuera_de_rango');
  assert.equal(g.ready.A, false);
  assert.ok(g.setFleet('A', full).ok);
});

test('solo dispara quien tiene el turno y el turno alterna', () => {
  const g = readyGame({ starter: 'A' });
  assert.equal(g.fire('B', 0, 0).error, 'no_es_tu_turno');
  const w = waterCell(g, 'B');
  assert.equal(g.fire('A', ...rc(g, w)).result, 'miss');
  assert.equal(g.turn, 'B');
  assert.equal(g.fire('B', 0, 0).ok, true);
  assert.equal(g.turn, 'A');
});

test('hitKeepsTurn: acertar conserva el turno; fallar lo pasa', () => {
  const g = readyGame({ starter: 'A', hitKeepsTurn: true });
  assert.equal(g.fire('A', ...rc(g, shipCell(g, 'B'))).result !== 'miss', true);
  assert.equal(g.turn, 'A');
  assert.equal(g.fire('A', ...rc(g, waterCell(g, 'B'))).result, 'miss');
  assert.equal(g.turn, 'B');
});

test('disparar dos veces a la misma casilla se rechaza sin cambiar el turno', () => {
  const g = readyGame({ starter: 'A' });
  g.fire('A', ...rc(g, waterCell(g, 'B')));
  g.fire('B', 0, 0);
  const again = g.boards.B.shots.findIndex((v) => v !== 0);
  if (again !== -1) {
    assert.equal(g.fire('A', ...rc(g, waterCell(g, 'B'))).error, 'ya_disparaste_ahi');
    assert.equal(g.turn, 'A');
  }
});

test('hundir toda la flota rival gana la partida', () => {
  const g = readyGame({ starter: 'A', hitKeepsTurn: true });
  for (const ship of g.boards.B.ships) for (const c of ship.cells) g.fire('A', ...rc(g, c));
  assert.equal(g.status, 'over');
  assert.equal(g.winner, 'A');
  assert.equal(g.reason, 'flota_hundida');
  assert.equal(g.stats.A.shots, g.stats.A.hits);
  assert.equal(g.fire('A', 0, 0).error, 'partida_no_iniciada');
});

test('forfeit: gana el otro; no se puede abandonar dos veces', () => {
  const g = readyGame();
  assert.ok(g.forfeit('A').ok);
  assert.equal(g.winner, 'B');
  assert.equal(g.reason, 'abandono');
  assert.equal(g.forfeit('B').error, 'partida_terminada');
});

test('randomShot nunca repite casilla y termina agotando el tablero', () => {
  const g = readyGame({ starter: 'A', hitKeepsTurn: true });
  let guard = 0;
  while (g.status === 'battle' && guard++ < 500) {
    const res = g.randomShot(g.turn);
    assert.ok(res.ok, res.error);
  }
  assert.equal(g.status, 'over');
});

test('el snapshot no revela los barcos del rival hasta que termina', () => {
  const g = readyGame({ starter: 'A' });
  const forA = g.snapshot('A');
  assert.ok(forA.boards.A.ships, 'A ve sus barcos');
  assert.equal(forA.boards.B.ships, null, 'A no ve los de B');
  assert.equal(g.snapshot('spectator').boards.A.ships, null);
  assert.equal(g.snapshot('spectator').boards.B.ships, null);
  g.forfeit('B');
  assert.ok(g.snapshot('A').boards.B.ships, 'al terminar se revelan');
});

test('el bioma cambia los nombres de las unidades pero no la flota', async () => {
  const { fleetFor } = await import('../src/domain/fleet.js');
  const water = fleetFor(10, 'water');
  for (const biome of ['pirate', 'land', 'jungle']) {
    const f = fleetFor(10, biome);
    assert.deepEqual(f.map((u) => [u.id, u.length]), water.map((u) => [u.id, u.length]), `${biome}: mismos ids y largos`);
    assert.notDeepEqual(f.map((u) => u.name), water.map((u) => u.name), `${biome}: nombres propios`);
  }
  assert.equal(fleetFor(10, 'land').find((u) => u.length === 5).name, 'Regimiento');
  assert.throws(() => fleetFor(10, 'luna'), RangeError);
  assert.throws(() => new Game({ size: 8, biome: 'luna' }), RangeError);
});

test('las unidades destruidas son públicas aunque el resto siga oculto', () => {
  const g = readyGame({ biome: 'jungle' });
  assert.equal(g.snapshot('A').biome, 'jungle');
  const ship = g.boards.B.ships[g.boards.B.ships.length - 1]; // la más corta
  g.turn = 'A';
  for (const i of ship.cells) { g.turn = 'A'; g.fire('A', ...rc(g, i)); }
  const view = g.snapshot('A').boards.B;
  assert.equal(view.ships, null, 'el resto sigue oculto');
  assert.equal(view.sunk.length, 1);
  assert.deepEqual(view.sunk[0].cells, ship.cells);
});
