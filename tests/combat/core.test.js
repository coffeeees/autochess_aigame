// Migrated from the v0.15.18 suite test-prototype.cjs (tests for: combat).
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
test('physical and magical damage use same GD formula', () => {
  near(mitigatedDamage(100, 100), 50);
  for (const damageType of ['physical', 'magic']) {
    const b = basicBattle(),
      [a, t] = b.units;
    t.stats.GD = 100;
    near(b.deal(a, t, 100, damageType).damage, 50);
  }
});
test('magic classes basic attack is AD physical, and mana gains faster', () => {
  for (const id of ['C02', 'C05', 'C08', 'C11']) {
    const b = basicBattle(id),
      [a, t] = b.units;
    b.tick();
    const hit = b.logs.find((l) => l.kind === 'damage' && l.source === a.uid);
    assert.equal(hit.damageType, 'physical');
    near(hit.amount, mitigatedDamage(a.stats.AD, t.stats.GD));
    assert(a.mp >= 18);
  }
  const b = basicBattle('C03');
  b.tick();
  assert.equal(b.units[0].mp, 18); /* 12 attack + 6 incoming */
});
test('shield absorption, dodge, status refresh, and mana cap', () => {
  const b = basicBattle(),
    [a, t] = b.units;
  b.shield(t, 999, 2, t);
  const hp = t.hp;
  b.deal(a, t, 50);
  assert.equal(t.hp, hp);
  b.debuff(t, a, 'test', '약화', 'AD', 0.8, 4);
  b.debuff(t, a, 'test', '약화', 'AD', 0.8, 4);
  assert.equal(t.statuses.length, 1);
  b.gainMana(a, 99999);
  assert.equal(a.mp, a.stats.MP);
  t.stats.DOD = 100;
  b.rng = () => 0;
  assert(b.deal(a, t, 100, 'physical', { kind: 'basic' }).evaded);
});
test('headless simulated battles finish, conserve occupancy, and use every one-cost skill', () => {
  const observed = new Set();
  for (let group = 0; group < 3; group++) {
    const allies = D.playableIds
        .slice(group * 4, group * 4 + 4)
        .map((id, i) => ({ id, pos: 3 + 8 * i })),
      enemies = ['C03', 'C09', 'C10', 'C12'].map((id, i) => ({ id, pos: 4 + 8 * i, scale: 2 })),
      b = new Battle(allies, enemies, { quickMana: true, rng: () => 0.85 });
    let ticks = 0;
    while (!b.result && ticks++ < 1000) {
      b.tick();
      const alive = b.alive(),
        positions = alive.map((u) => u.pos);
      assert.equal(new Set(positions).size, positions.length);
      assert(alive.every((u) => D.playableIds.includes(u.id)));
      assert(alive.every((u) => u.mp <= u.stats.MP));
    }
    assert(b.result, 'battle must terminate');
    Object.keys(b.skillUses).forEach((id) => observed.add(id));
  }
  assert.deepEqual(
    [...observed].sort(),
    D.playableIds.filter((id) => D.byId(id).cost === 1),
  );
});
