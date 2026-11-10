import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyRating, eloDelta, expectedScore, MIN_RATING, pointsFor, scoreMatch } from '../src/domain/scoring.js';

test('Elo: partido parejo vale ±16 y el favorito gana menos', () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.deepEqual(eloDelta(1000, 1000), { winner: 16, loser: -16 });
  assert.ok(eloDelta(1400, 1000).winner < eloDelta(1000, 1400).winner);
  assert.equal(applyRating(110, -50), MIN_RATING);
});

test('puntos: ganar > perder, más precisión = más puntos, IA difícil > IA fácil', () => {
  const base = { shots: 40, hits: 17, size: 10, mode: 'ai' };
  const win = pointsFor({ ...base, won: true, difficulty: 'normal' });
  assert.ok(win > pointsFor({ ...base, won: false, difficulty: 'normal' }));
  assert.ok(pointsFor({ ...base, hits: 30, won: true, difficulty: 'normal' }) > win);
  assert.ok(pointsFor({ ...base, won: true, difficulty: 'hard' }) > pointsFor({ ...base, won: true, difficulty: 'easy' }));
  assert.ok(pointsFor({ ...base, size: 20, won: true }) > pointsFor({ ...base, won: true }));
  assert.equal(pointsFor({ ...base, won: false, forfeited: true }), 0);
});

test('scoreMatch: solo es rankeada (Elo) si ambos jugadores tienen cuenta', () => {
  const stats = { A: { shots: 30, hits: 17 }, B: { shots: 30, hits: 10 } };
  const common = { mode: 'pvp', size: 10, winner: 'A', reason: 'flota_hundida', stats };

  const ranked = scoreMatch({ ...common, players: { A: { rating: 1000 }, B: { rating: 1000 } } });
  assert.equal(ranked.ranked, true);
  assert.equal(ranked.A.ratingDelta, 16);
  assert.equal(ranked.B.ratingDelta, -16);

  const casual = scoreMatch({ ...common, players: { A: { rating: 1000 }, B: { rating: null } } });
  assert.equal(casual.ranked, false);
  assert.equal(casual.A.ratingDelta, 0);
  assert.ok(casual.A.points < ranked.A.points, 'sin rival registrado vale la mitad');

  const vsAi = scoreMatch({ ...common, mode: 'ai', difficulty: 'hard', players: { A: { rating: 1000 }, B: { rating: null } } });
  assert.equal(vsAi.ranked, false);
});

test('abandonar no da puntos al que se va y sí al que se queda', () => {
  const res = scoreMatch({
    mode: 'pvp', size: 10, winner: 'B', reason: 'abandono',
    stats: { A: { shots: 5, hits: 2 }, B: { shots: 4, hits: 1 } },
    players: { A: { rating: 1000 }, B: { rating: 1000 } },
  });
  assert.equal(res.A.points, 0);
  assert.ok(res.B.points > 0);
});
