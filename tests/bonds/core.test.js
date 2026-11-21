// Migrated from the v0.15.18 suite test-prototype.cjs (tests for: bonds).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';

const assert = require('node:assert/strict'),
  D = $data,
  { Battle, mitigatedDamage, distance } = $engine;
$bondEffects.init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let passed = 0;
const near = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const basicBattle = (id = 'C01', enemy = 'C03') =>
  new Battle([{ id, pos: 27 }], [{ id: enemy, pos: 28 }], { rng: () => 0.99 });
test('bond count deduplicates IDs and ignores summons', () => {
  const e = D.evaluateSynergies([
    { id: 'C01' },
    { id: 'C01' },
    { id: 'C28' },
    { id: 'C02', summon: true },
  ]);
  assert.equal(e.find((s) => s.name === '흑월').count, 2);
  assert.equal(e.find((s) => s.name === '종언').threshold, 2);
  assert.equal(e.find((s) => s.name === '금단').count, 0);
});
test('highest stage only and six tiers reachable with the unlocked pool', () => {
  const e = D.evaluateSynergies(D.roster),
    actual = D.evaluateSynergies(D.playableIds.filter((id) => D.byId(id).cost <= 3));
  assert.equal(e.filter((s) => s.threshold === 6).length, 8);
  assert(actual.every((s) => s.threshold === 4));
  assert.equal(actual.filter((s) => s.stages.at(-1).reachable === false).length, 0);
});
test('bond evaluation is pure and frozen after a member dies', () => {
  const units = [
      { id: 'C03', pos: 27 },
      { id: 'C10', pos: 35 },
    ],
    before = JSON.stringify(units);
  D.evaluateSynergies(units);
  assert.equal(JSON.stringify(units), before);
  const b = new Battle(units, [{ id: 'C10', pos: 23 }], { rng: () => 0.99 }),
    snapshot = JSON.stringify(b.synergySnapshot);
  b.kill(b.units[0]);
  b.tick();
  assert.equal(JSON.stringify(b.synergySnapshot), snapshot);
  assert.equal(b.synergySnapshot.ally.find((s) => s.name === '철혈').threshold, 2);
});
test('legacy experimental toggle has no independent numerical effect', () => {
  const a = [
      { id: 'C03', pos: 27 },
      { id: 'C10', pos: 35 },
    ],
    e = [{ id: 'C01', pos: 28 }];
  assert.deepEqual(
    new Battle(a, e, { experimental: true, rng: () => 0.99 }).units.map((u) => u.stats),
    new Battle(a, e, { rng: () => 0.99 }).units.map((u) => u.stats),
  );
});
