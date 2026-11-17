// Migrated from the v0.15.18 suite test-progression.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const assert = require('node:assert/strict'),
  D = require('../../src/legacy/data.js'),
  P = require('../../src/legacy/progression.js'),
  { Battle } = require('../../src/legacy/engine.js');
const clone = (x) => JSON.parse(JSON.stringify(x)),
  near = (a, b) => assert(Math.abs(a - b) < 1e-6);
let count = 0;
function state() {
  return P.initialize({
    health: 100,
    gold: 12,
    units: [
      { uid: 1, id: 'C03', location: 'board', pos: 38, star: 1 },
      { uid: 2, id: 'C05', location: 'board', pos: 53, star: 1 },
    ],
    shop: D.playableIds.slice(0, 5),
  });
}
function at(stage, round, gold = 12) {
  const s = state();
  s.stage = stage;
  s.round = round;
  s.wave = P.ordinal(s);
  s.gold = gold;
  return s;
}
function supply(s, rng = () => 0.1) {
  P.beginSupply(s, rng);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
function combat(s, winner = 'ally', rng = () => 0.8) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner, time: 10, survivingEnemies: winner === 'ally' ? 0 : 2 }, rng);
}
test('old saves retain characters, gold, HP and deployed capacity during migration', () => {
  const old = {
    version: 1,
    wave: 6,
    gold: 43,
    health: 72,
    units: Array.from({ length: 5 }, (_, i) => ({
      id: D.playableIds[i],
      uid: i + 1,
      location: 'board',
      pos: 32 + i,
      star: 1,
    })),
    shop: [],
    done: false,
  };
  const migrated = P.migrate(clone(old));
  assert.equal(migrated.gold, 43);
  assert.equal(migrated.health, 72);
  assert.deepEqual(
    migrated.units.map((u) => ({ ...u, pos: 0 })),
    old.units.map((u) => ({ ...u, pos: 0 })),
  );
  assert.deepEqual(
    migrated.units.map((u) => u.pos),
    [28, 29, 30, 31, 32],
  );
  assert.equal(migrated.level, 5);
  assert.equal(P.label(migrated), '2-1');
  assert.equal(migrated.roundPhase, 'prepare');
});
