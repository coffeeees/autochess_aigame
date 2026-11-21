// Migrated from the v0.15.18 suite test-prototype.cjs (tests for: skills).
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
test('C01 AD160% and four burn ticks', () => {
  const b = basicBattle(),
    [a, t] = b.units;
  t.stats.HP = t.hp = 100000;
  b.cast(a, t);
  near(t.hp, 100000 - mitigatedDamage(a.stats.AD * 1.6, t.stats.GD));
  assert(t.statuses.some((s) => s.key === 'burn'));
  a.castUntil = 999;
  t.castUntil = 999;
  for (let i = 0; i < 41; i++) b.tick();
  assert.equal(
    b.logs.filter((l) => l.kind === 'damage' && l.kind && l.damageType === 'magic').length,
    4,
  );
});
test('C02 plague summon cap2 / AP40% / poison / expiry', () => {
  const b = basicBattle('C02'),
    [a, t] = b.units;
  b.cast(a, t);
  b.cast(a, t);
  b.cast(a, t);
  const summons = b.units.filter((u) => u.summon);
  assert.equal(summons.length, 2);
  near(summons[0].stats.AD, a.stats.AP * 0.4);
  assert.equal(summons[0].expires, 8);
  summons[0].pos = 20;
  a.castUntil = 999;
  t.castUntil = 999;
  b.tick();
  assert(t.statuses.some((e) => e.key === 'poison'));
  b.time = 8;
  b.tick();
  assert(summons.every((u) => u.dead));
});
test('C03 shadow AD reduction expires', () => {
  const b = basicBattle('C03'),
    [a, t] = b.units;
  b.cast(a, t);
  near(b.stats(t).AD, t.stats.AD * 0.85);
  b.time = 4.1;
  b.tick();
  near(b.stats(t).AD, t.stats.AD);
});
test('C04 special crit +20 percentage points and extra magic damage', () => {
  const b = basicBattle('C04'),
    [a, t] = b.units;
  b.rng = () => 0.2;
  b.cast(a, t);
  const hits = b.logs.filter((l) => l.kind === 'damage');
  assert.equal(hits.length, 2);
  assert(hits[0].critical);
  near(hits[0].amount, mitigatedDamage(a.stats.AD * 2 * 1.5, t.stats.GD));
  assert.equal(hits[1].damageType, 'magic');
});
test('C05 heals lowest ratio ally and removes one harmful effect', () => {
  const b = new Battle(
      [
        { id: 'C05', pos: 27 },
        { id: 'C03', pos: 35 },
      ],
      [{ id: 'C10', pos: 28 }],
      { rng: () => 0.99 },
    ),
    [a, ally, target] = b.units;
  ally.hp = 100;
  b.debuff(ally, target, 'test', '독', 'AD', 0.8, 5);
  b.cast(a, target);
  near(ally.hp, 100 + a.stats.AP * 1.8);
  assert.equal(ally.statuses.length, 0);
});
test('C06 two AD140% hits + temporary AS20%', () => {
  const b = basicBattle('C06'),
    [a, t] = b.units;
  b.cast(a, t);
  assert.equal(b.logs.filter((l) => l.kind === 'damage').length, 2);
  near(b.stats(a).AS, a.stats.AS * 1.2);
});
test('C07 three arrows with one nearby magical ricochet', () => {
  const b = new Battle(
      [{ id: 'C07', pos: 27 }],
      [
        { id: 'C03', pos: 28 },
        { id: 'C10', pos: 20 },
      ],
      { rng: () => 0.99 },
    ),
    [a, t] = b.units;
  b.cast(a, t);
  const hits = b.logs.filter((l) => l.kind === 'damage');
  assert.equal(hits.filter((h) => h.damageType === 'physical').length, 3);
  assert.equal(hits.filter((h) => h.damageType === 'magic').length, 1);
});
test('C08 AP220% magical hit + AS slow15%', () => {
  const b = basicBattle('C08'),
    [a, t] = b.units;
  b.cast(a, t);
  near(t.hp, t.stats.HP - mitigatedDamage(a.stats.AP * 2.2, t.stats.GD));
  near(b.stats(t).AS, t.stats.AS * 0.85);
});
test('C09 charge ends in a free adjacent cell and stuns', () => {
  const b = new Battle([{ id: 'C09', pos: 24 }], [{ id: 'C03', pos: 31 }], { rng: () => 0.99 }),
    [a, t] = b.units;
  b.cast(a, t);
  assert.equal(distance(a.pos, t.pos), 1);
  assert(t.statuses.some((s) => s.key === 'stun'));
  assert.notEqual(a.pos, t.pos);
});
test('C10 GD30% buff and lowest-adjacent ally shield; self excluded', () => {
  const b = new Battle(
      [
        { id: 'C10', pos: 27 },
        { id: 'C03', pos: 35 },
        { id: 'C01', pos: 26 },
      ],
      [{ id: 'C09', pos: 28 }],
      { rng: () => 0.99 },
    ),
    [a, ally] = b.units;
  ally.hp = 10;
  b.cast(a, b.units.at(-1));
  near(b.stats(a).GD, 52);
  near(ally.shields[0].amount, 104);
  assert.equal(a.shields.length, 0);
});
test('C11 fire summon cap1, magic basic, death explosion and expiry explosion', () => {
  for (const expire of [true, false]) {
    const b = basicBattle('C11'),
      [a, t] = b.units;
    b.cast(a, t);
    b.cast(a, t);
    const summons = b.units.filter((u) => u.summon);
    assert.equal(summons.length, 1);
    const summon = summons[0];
    near(summon.stats.AD, a.stats.AP * 0.6);
    assert.equal(summon.attackType, 'magic');
    summon.pos = 20;
    const hp = t.hp;
    if (expire) {
      b.time = 8;
      b.tick();
    } else b.kill(summon);
    assert(summon.dead);
    assert(t.hp < hp);
    assert(b.logs.some((r) => r.message.includes('소멸 폭발')));
  }
});
test('C12 GD250% shield and corrosion on incoming basic attacker', () => {
  const b = basicBattle('C12'),
    [a, t] = b.units;
  b.cast(a, t);
  near(a.shields[0].amount, 95);
  b.deal(t, a, 50, 'physical', { kind: 'basic' });
  assert(t.statuses.some((s) => s.key === 'corrosion'));
  near(b.stats(t).GD, t.stats.GD * 0.85);
});
