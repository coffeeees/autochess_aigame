// Migrated from the v0.15.18 suite test-v01510.cjs (tests for: shop).
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
test('purchase preview matches full carry arithmetic for every one/two star count without mutation', () => {
  for (let ones = 0; ones < 12; ones++)
    for (let twos = 0; twos < 4; twos++) {
      const s = state();
      s.units = [
        ...Array.from({ length: ones }, () => ({ id: 'C24', star: 1, location: 'bench' })),
        ...Array.from({ length: twos }, () => ({ id: 'C24', star: 2, location: 'board' })),
      ];
      const before = copy(s);
      const expected = Math.floor((ones + 1) / 3)
        ? twos + Math.floor((ones + 1) / 3) >= 3
          ? 3
          : 2
        : twos >= 3
          ? 3
          : 0;
      a.equal(V.mergePreview(s, 'C24'), expected);
      a.deepEqual(s, before);
    }
  a.equal(V.mergePreview({ units: [{ id: 'C24', star: 3 }] }, 'C24'), 0);
  a.equal(V.mergePreview({ units: [] }, 'C34'), 0);
});
test('one-shot lock keeps purchased holes and offers then unlocks before normal following reroll', () => {
  const s = state(2, 1);
  s.shopLocked = true;
  const offers = [...s.shop];
  combat(s);
  a(P.advanceRound(s));
  a.equal(s.shopLocked, false);
  a.deepEqual(s.shopCarry.offers, offers);
  V.enterShop(s, () => {
    throw Error('locked RNG');
  });
  a.deepEqual(s.shop, offers);
  a.equal(s.shopCarry, null);
  combat(s);
  a(P.advanceRound(s));
  let calls = 0;
  V.enterShop(s, () => {
    calls++;
    return 0.1;
  });
  a(calls > 0);
  a.notDeepEqual(s.shop, offers);
});
test('lock survives saved results and augment gates, consumed only at the destination', () => {
  const s = state(1, 2);
  s.shopLocked = true;
  supply(s, () => 0.9);
  const reload = P.migrate(copy(s));
  a(P.advanceRound(reload, () => 0));
  a.equal(reload.roundPhase, 'augment');
  a.equal(reload.shopLocked, false);
  a.equal(reload.shopCarry.node, '1-3');
  const again = P.migrate(copy(reload));
  a(P.chooseAugment(again, P.availableAugments(again)[0].id));
  V.enterShop(again, () => {
    throw Error('carry reroll');
  });
  a.deepEqual(again.shop, s.shop);
  a.equal(again.shopCarry, null);
});
test('manual reroll succeeds for correct price and unlocks; rejected action is fully inert', () => {
  for (const augments of [[], ['S11']]) {
    const s = state();
    s.augments = augments;
    s.shopLocked = true;
    const price = P.rerollCost(s);
    a(V.manualReroll(s, () => 0.1));
    a.equal(s.gold, 25 - price);
    a.equal(s.shopLocked, false);
    a.equal(s.shopCarry, null);
  }
  for (const mode of ['poor', 'combat', 'gameover']) {
    const s = state();
    s.shopLocked = true;
    if (mode === 'poor') s.gold = 0;
    if (mode === 'combat') s.roundPhase = 'combat';
    if (mode === 'gameover') s.done = true;
    const before = copy(s);
    a(!V.manualReroll(s));
    a.deepEqual(s, before);
  }
});
test('잠근 후보는 3성 보유 캐릭터도 그대로 넘기고(v0.18.3) lock defaults do not change old fields', () => {
  const s = state();
  s.shopCarry = { node: '1-3', offers: ['C01', null, 'C24', 'C03', 'C05'] };
  s.units = [{ id: 'C24', star: 3 }];
  V.enterShop(s);
  a.deepEqual(s.shop, ['C01', null, 'C24', 'C03', 'C05']);
  const old = state();
  delete old.shopLocked;
  delete old.shopCarry;
  delete old.completionChoice;
  const before = copy(old);
  P.migrate(old);
  a.equal(old.shopLocked, false);
  a.equal(old.shopCarry, null);
  for (const key of ['units', 'gold', 'health', 'inventory', 'shop', 'augments', 'completedRounds'])
    a.deepEqual(old[key], before[key]);
});
