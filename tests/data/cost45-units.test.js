// Migrated from the v0.15.18 suite test-v01518.cjs (tests for: data).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  D = $data,
  P = $progression,
  V = $preparation,
  E = $engine,
  F = $bondEffects;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function setup(id, allies = [], positions = [24, 23, 3, 4, 5]) {
  const b = new E.Battle(
    [{ id, pos: 27 }, ...allies],
    positions.map((pos) => ({ id: 'E01', pos })),
    { rng: () => 0.99 },
  );
  for (const e of b.units.filter((u) => u.team === 'enemy')) {
    e.stats.HP = e.hp = 100000;
    e.stats.DOD = 0;
  }
  return [b, ...b.units];
}
test('45 playable/unmodified draft stats, raw original odds every level, real cost4/5 samples and six tiers', () => {
  a.equal(D.playableIds.length, 45);
  for (let l = 1; l <= 10; l++) a.deepEqual(V.shopOdds({ level: l, units: [] }), V.baseOdds[l]);
  for (const [l, roll, cost] of [
    [5, 0.99, 4],
    [7, 0.999, 5],
    [10, 0.4, 4],
    [10, 0.9, 5],
  ]) {
    let n = 0;
    a.equal(D.byId(V.drawShop({ level: l, units: [] }, () => (n++ ? 0 : roll))).cost, cost);
  }
  for (const bond of D.synergies.filter((b) => b.thresholds.includes(6))) {
    const ids = D.roster
      .filter((u) => u.bonds.includes(bond.name))
      .slice(0, 6)
      .map((u) => u.id);
    a.equal(D.evaluateSynergies(ids).find((b) => b.name === bond.name).threshold, 6);
    const b = new E.Battle(
      ids.map((id, i) => ({ id, pos: 2 + 8 * i })),
      [{ id: 'E01', pos: 7 }],
      { rng: () => 0.99 },
    );
    a.equal(b.synergySnapshot.ally.find((e) => e.name === bond.name).threshold, 6);
  }
});
