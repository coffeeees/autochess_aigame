// Migrated from the v0.15.18 suite test-progression.cjs (tests for: augments).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $progression from '../../src/core/progression.js';

const assert = require('node:assert/strict'),
  D = $data,
  P = $progression,
  { Battle } = $engine;
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
test('augment gates at 1-3,3-3,5-3 and old stage starts are inactive', () => {
  for (let stage = 1; stage <= 8; stage++)
    for (let round = 1; round <= 5; round++) {
      const s = at(stage, round),
        expected = [1, 3, 5].includes(stage) && round === 3;
      assert.equal(
        P.ensureAugment(s, () => 0),
        expected,
      );
      if (expected) {
        assert(!P.advanceRound(s));
        const id = P.availableAugments(s)[0].id;
        assert(P.chooseAugment(s, id));
        assert.equal(s.roundPhase, 'prepare');
        assert(!P.ensureAugment(s));
        assert(!P.chooseAugment(s, id));
      }
    }
});
test('three unique candidates each time, chosen excluded, immediate reward once', () => {
  const s = at(1, 3, 19);
  P.ensureAugment(s, () => 0);
  s.augmentState.pendingPick.optionIds = ['S09', 'S10', 'S11'];
  assert.equal(P.availableAugments(s).length, 3);
  assert(P.chooseAugment(s, 'S09'));
  assert.equal(s.gold, 25);
  assert.equal(s.xp, 0);
  assert.equal(P.label(s), '1-3');
  assert.equal(Object.keys(s.completedRounds).length, 0);
  assert(!P.chooseAugment(s, 'S09'));
  s.stage = 3;
  P.ensureAugment(s, () => 0);
  assert.equal(P.availableAugments(s).length, 3);
  assert(!P.availableAugments(s).some((a) => a.id === 'S09'));
  assert(P.chooseAugment(s, 'S01'));
  s.stage = 5;
  P.ensureAugment(s, () => 0);
  assert.equal(P.availableAugments(s).length, 3);
  assert(!P.availableAugments(s).some((a) => a.id === 'S01'));
  assert(P.chooseAugment(s, 'S02'));
  assert.equal(s.augmentState.completedPicks.length, 3);
  assert.equal(P.availableAugments(s).length, 0);
});
test('pending tier and options survive reload without using RNG again', () => {
  const s = at(3, 3);
  P.ensureAugment(s, () => 0.5);
  const restored = clone(s),
    pending = clone(s.augmentState.pendingPick);
  assert(
    P.ensureAugment(restored, () => {
      throw Error('rerolled');
    }),
  );
  assert.deepEqual(restored.augmentState.pendingPick, pending);
  assert(P.chooseAugment(restored, pending.optionIds[0]));
  assert(!P.ensureAugment(clone(restored)));
});
