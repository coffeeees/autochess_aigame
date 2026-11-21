// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: encounters).
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
    [{ id, pos: 27 }, ...allies],
    [
      { id: 'E06', pos: 28 },
      { id: 'E03', pos: 20 },
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
test('stage scaling adds two promotions per stage then reaches3star cap', () => {
  a.deepEqual(W.stageStars(1, 10), Array(10).fill(1));
  for (let stage = 2; stage <= 11; stage++) {
    const stars = W.stageStars(stage, 10);
    a.equal(
      stars.reduce((n, x) => n + x - 1, 0),
      Math.min(20, (stage - 1) * 2),
    );
    a(stars.every((x) => x >= 1 && x <= 3));
  }
  a.deepEqual(W.stageStars(6, 10), Array(10).fill(2));
  a.deepEqual(W.stageStars(11, 10), Array(10).fill(3));
  a.deepEqual(W.stageStars(99, 10), Array(10).fill(3));
});
test('promoted enemies have actual HP/AD/AP growth; cached encounters stable after reload', () => {
  const s = state(4);
  s.stage = 2;
  s.round = 1;
  const units = W.encounter(s, () => 0.5);
  a.equal(units.filter((u) => u.star === 2).length, 2);
  const b = new Battle([{ id: 'C13', pos: 26 }], units);
  for (let i = 0; i < units.length; i++) {
    const base = W.byId(units[i].id).stats,
      mult = 2 ** (units[i].star - 1) * units[i].scale;
    near(b.units[i + 1].stats.HP, base.HP * mult);
    near(b.units[i + 1].stats.AD, base.AD * mult);
  }
  a.deepEqual(
    W.encounter(JSON.parse(JSON.stringify(s)), () => {
      throw Error('reroll');
    }),
    units,
  );
});
