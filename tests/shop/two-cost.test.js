// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: shop).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  D = $data,
  P = $progression,
  V = $preparation,
  W = $encounters,
  { Battle, mitigatedDamage, distance } = $engine;
let n = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`);
function battle(id, allies = []) {
  return new Battle(
    [{ id, pos: 31 }, ...allies],
    [
      { id: 'E06', pos: 24 },
      { id: 'E03', pos: 23 },
    ],
    { rng: () => 0.99 },
  );
}
function cast(id) {
  const b = battle(id);
  b.cast(b.units[0], b.units[1]);
  return b;
}
function state(level) {
  return V.normalize(
    Object.assign(P.initialize({ health: 100, gold: 50, units: [], shop: [] }), { level }),
  );
}
test('exact referenced level1..10 base table and normalized1/2 cost chances', () => {
  a.deepEqual(Object.values(V.baseOdds), [
    [100, 0, 0, 0, 0],
    [100, 0, 0, 0, 0],
    [100, 0, 0, 0, 0],
    [65, 25, 10, 0, 0],
    [45, 33, 20, 2, 0],
    [30, 40, 25, 5, 0],
    [19, 30, 40, 10, 1],
    [18, 25, 32, 22, 3],
    [15, 20, 25, 30, 10],
    [5, 10, 20, 40, 25],
  ]);
  for (let level = 1; level <= 10; level++) {
    const s = state(level),
      odds = V.shopOdds(s),
      base = V.baseOdds[level];
    near(odds[0], base[0]);
    near(odds[1], base[1]);
    near(
      odds.reduce((x, y) => x + y),
      100,
    );
    near(odds[2], base[2]);
    a.deepEqual(odds.slice(3), base.slice(3));
  }
});
test('boundary tier sampling and uniform per-tier entries, current level used on every roll', () => {
  const s = state(3);
  for (const roll of [0, 0.8, 0.999]) a.equal(D.byId(V.drawShop(s, () => roll)).cost, 1);
  s.level = 4;
  const p = V.shopOdds(s)[0] / 100;
  for (const [roll, cost] of [
    [0, 1],
    [p - 1e-8, 1],
    [p, 2],
    [0.99999, 3],
  ]) {
    let i = 0;
    const rng = () => (i++ ? 0 : roll);
    a.equal(D.byId(V.drawShop(s, rng)).cost, cost);
  }
  const selected = new Set();
  for (let i = 0; i < 11; i++) {
    let j = 0;
    selected.add(V.drawShop(s, () => (j++ ? i / 11 : 0.7)));
  }
  a.equal(selected.size, 11);
});
test('owned3star filtered, sold2cost restored; exhausted tiers renormalized without locked cards', () => {
  const s = state(8);
  s.units = D.roster.filter((u) => u.cost === 1).map((u, i) => ({ id: u.id, uid: i, star: 3 }));
  near(V.shopOdds(s)[1], (25 / 82) * 100);
  near(V.shopOdds(s)[2], (32 / 82) * 100);
  a.equal(D.byId(V.drawShop(s, () => 0)).cost, 2);
  s.units.push({ id: 'C13', uid: 50, star: 3 });
  a(!V.shopPool(s).includes('C13'));
  s.units = s.units.filter((u) => u.id !== 'C13');
  a(V.shopPool(s).includes('C13'));
  s.units = D.playableIds.map((id, i) => ({ id, uid: i, star: 3 }));
  a.equal(V.drawShop(s), null);
});
