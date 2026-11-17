// Migrated from the v0.15.18 suite test-v01510.cjs (tests for: economy).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $patchNotes from '../../src/content/patch-notes.js';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import $augments from '../../src/core/augments.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';
const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = $data,
  P = $progression,
  V = $preparation,
  W = $encounters,
  A = $augments,
  I = $items,
  N = $patchNotes;
let count = 0;
const copy = (x) => JSON.parse(JSON.stringify(x)),
  near = (x, y) => a(Math.abs(x - y) < 1e-7);
function state(stage = 1, round = 3) {
  const s = P.initialize({
    gold: 25,
    health: 75,
    units: [],
    shop: ['C01', null, 'C24', 'C03', 'C05'],
  });
  Object.assign(s, { stage, round });
  s.wave = P.ordinal(s);
  return s;
}
function combat(s, winner = 'ally') {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner }, () => 0.99);
}
function supply(s, rng) {
  P.beginSupply(s, () => 0.1);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
test('every supply stage uses50percent chance then50/50 amounts with exact boundaries', () => {
  for (const [stage, round] of [
    [1, 1],
    [1, 2],
    [2, 3],
    [6, 3],
    [9, 3],
  ])
    for (const [chance, amount, expected] of [
      [0, 0, 2],
      [0.499999, 0.499999, 2],
      [0.499999, 0.5, 3],
      [0.499999, 0.999999, 3],
      [0.5, 0, 0],
      [0.999999, 0, 0],
    ]) {
      const s = state(stage, round),
        seq = [chance, amount],
        r = supply(s, () => seq.shift());
      a.equal(r.bonusGold, expected);
      a.equal(s.gold, 25 + expected);
      a.equal(r.base, 0);
      a.equal(r.interest, 0);
      a.equal(r.extra.itemIds.length, 2);
      a.equal(s.inventory.length, 2);
    }
});
test('supply RNG occurs only on valid confirmation and awarded gold survives replay/reload exactly once', () => {
  const s = state(1, 1);
  let rolls = 0;
  P.beginSupply(s, () => 0.1);
  a.equal(
    P.confirmSupply(s, () => {
      rolls++;
      return 0;
    }),
    null,
  );
  a.equal(rolls, 0);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  const r = P.confirmSupply(s, () => {
    rolls++;
    return 0.1;
  });
  a.equal(rolls, 2);
  const after = copy(s);
  for (const x of [s, P.migrate(copy(s))]) {
    P.confirmSupply(x, () => {
      throw Error('reroll');
    });
    P.settleRound(x, {}, () => {
      throw Error('reroll');
    });
    a.equal(x.gold, after.gold);
    a.equal(x.inventory.length, 2);
    a.equal(x.lastResult.bonusGold, r.bonusGold);
  }
});
test('large seeded supply distribution is50percent none/25percent2G/25percent3G', () => {
  let seed = 191;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    counts = { 0: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 12000; i++) counts[supply(state(2, 3), rng).bonusGold]++;
  for (const [value, ratio] of [
    [0, 0.5],
    [2, 0.25],
    [3, 0.25],
  ])
    a(Math.abs(counts[value] / 12000 - ratio) < 0.018);
});
