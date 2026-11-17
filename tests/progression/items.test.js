// Migrated from the v0.15.18 suite test-items.cjs (tests for: progression).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $itemEffects from '../../src/core/combat/item-effects.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  I = $items,
  P = $progression,
  D = $data,
  V = $preparation,
  F = $itemEffects,
  { Battle, mitigatedDamage } = $engine;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`),
  clone = (x) => JSON.parse(JSON.stringify(x));
function state(stage = 1, round = 1) {
  const s = P.initialize({
    health: 100,
    gold: 12,
    units: [
      { id: 'C03', uid: 1, star: 1, pos: 31, location: 'board' },
      { id: 'C05', uid: 2, star: 1, pos: 32, location: 'board' },
    ],
    shop: [],
  });
  s.stage = stage;
  s.round = round;
  return s;
}
function battle(ids = [], id = 'C03', options = {}) {
  return new Battle(
    [
      { id, uid: 1, pos: 31, itemIds: ids, bonuses: I.bonuses(ids) },
      { id: id === 'C05' ? 'C03' : 'C05', uid: 2, pos: 32 },
    ],
    [
      { id: 'E06', pos: 24 },
      { id: 'E03', pos: 23 },
      { id: 'E01', pos: 17 },
    ],
    { rng: () => 0.99, ...options },
  );
}
function choose(s, rng = () => 0.1) {
  P.beginSupply(s, rng);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
function freeze(b) {
  for (const u of b.units) u.castUntil = 999;
}
test('new start7G and exactly2 unique1cost+1two-cost through many seeds', () => {
  a.equal(D.prototypeConfig.economy.startingGold, 7);
  for (let i = 0; i < 150; i++) {
    const ids = V.startingRoster(() => i / 150);
    a.equal(new Set(ids).size, 3);
    a.deepEqual(
      ids.map((id) => D.byId(id).cost),
      [1, 1, 2],
    );
  }
});
