// Migrated from the v0.15.18 suite test-home-enemies.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  D = require('../../src/legacy/data.js'),
  P = require('../../src/legacy/progression.js'),
  W = require('../../src/legacy/encounters.js'),
  { Battle } = require('../../src/legacy/engine.js');
let n = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function state(round = 3) {
  const s = P.initialize({
    health: 100,
    gold: 12,
    units: [{ uid: 1, id: 'C03', location: 'board', pos: 38, star: 1 }],
    shop: [],
  });
  s.round = round;
  return W.ensureRunDefaults(s);
}
function settle(s, win = true) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner: win ? 'ally' : 'enemy' }, () => 0.8);
}
test('migration preserves existing HP and units; meta profile is separate', () => {
  const s = state();
  s.health = 72;
  const units = clone(s.units);
  W.ensureRunDefaults(s);
  a.equal(s.health, 72);
  a.deepEqual(s.units, units);
  const profile = W.newProfile();
  settle(s);
  a.deepEqual(profile, { version: 1, metaLevel: 1, metaXp: 0, growthEnabled: false });
});
