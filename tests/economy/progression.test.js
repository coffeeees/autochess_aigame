// Migrated from the v0.15.18 suite test-progression.cjs (tests for: economy).
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
test('BATTLE win3 lose1; before-base interest boundaries unchanged', () => {
  for (const [gold, interest] of [
    [0, 0],
    [9, 0],
    [10, 1],
    [49, 4],
    [50, 5],
    [100, 5],
  ])
    for (const winner of ['ally', 'enemy']) {
      const s = at(1, 3, gold),
        r = combat(s, winner);
      assert.equal(r.base, winner === 'ally' ? 3 : 1);
      assert.equal(r.interest, interest);
      assert.equal(s.gold, gold + r.base + interest + r.streakBonus);
    }
});
test('BOSS win5 lose3 and extra gold is separate, stage amounts correct', () => {
  for (const [stage, extra] of [
    [1, 5],
    [2, 7],
    [3, 9],
    [4, 11],
    [5, 13],
    [6, 15],
    [7, 15],
  ]) {
    const s = at(stage, 5, 50),
      r = combat(s, 'ally', () => 0.9);
    assert.equal(r.base, 5);
    assert.equal(r.interest, 5);
    assert.equal(r.bonusGold, extra);
    assert.equal(r.total, 5 + 5 + extra + 1);
    assert.equal(s.inventory.length, 1);
    const lost = at(stage, 5, 50),
      loss = combat(lost, 'enemy');
    assert.equal(loss.base, 3);
    assert.equal(loss.interest, 5);
    assert.equal(loss.extra, null);
    assert.equal(loss.bonusGold, 0);
  }
});
test('boss guaranteed item plus unchanged60% gold boundary; one item only', () => {
  for (const [roll, isGold] of [
    [0, false],
    [0.39999, false],
    [0.4, true],
    [0.9999, true],
  ]) {
    const s = at(1, 5),
      r = combat(s, 'ally', () => roll);
    assert.equal(r.bossItem.kind, 'item');
    assert.equal(s.inventory.length, 1);
    assert.equal(r.extra?.kind, isGold ? 'gold' : undefined);
    assert.equal(r.bonusGold, isGold ? 5 : 0);
  }
});
test('boss roll and payment occur exactly once after repeated callbacks / reload', () => {
  const s = at(1, 5);
  let rolls = 0;
  const rng = () => {
    rolls++;
    return 0.9;
  };
  const r = combat(s, 'ally', rng),
    before = clone(s);
  P.settleRound(s, { winner: 'ally' }, rng);
  P.settleRound(clone(s), { winner: 'ally' }, rng);
  assert.equal(rolls, 2);
  assert.deepEqual(s, before);
  assert(P.advanceRound(s));
  assert.equal(s.stage, 2);
  assert.equal(s.round, 1);
  assert.equal(s.roundPhase, 'prepare');
  assert.equal(s.completedRounds['1-5'].bonusGold, r.bonusGold);
});
test('XP purchase4G/4XP, carry, multi-level overflow, maximum10', () => {
  const s = state();
  assert(P.buyXp(s));
  assert.equal(s.gold, 8);
  assert.equal(s.xp, 4);
  assert(P.buyXp(s));
  assert.equal(s.level, 4);
  assert.equal(s.xp, 2);
  assert.equal(s.gold, 4);
  P.addXp(s, 10000);
  assert.equal(s.level, 10);
  assert.equal(s.xp, 0);
  const gold = s.gold;
  assert(!P.buyXp(s));
  assert.equal(s.gold, gold);
});
test('XP cannot be bought during result, combat, augment, gameover, or without funds', () => {
  for (const phase of ['result', 'combat', 'augment', 'gameover']) {
    const s = state();
    s.roundPhase = phase;
    const before = clone(s);
    assert(!P.buyXp(s));
    assert.deepEqual(s, before);
  }
  const s = state();
  s.gold = 3;
  assert(!P.buyXp(s));
});
