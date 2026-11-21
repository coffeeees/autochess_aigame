// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: skills).
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
test('C13 AP190% target plus adjacent splash and slow20%/3s', () => {
  const b = cast('C13'),
    u = b.units[0];
  for (const e of b.units.slice(1)) {
    near(e.stats.HP - e.hp, mitigatedDamage(u.stats.AP * 1.9, e.stats.GD));
    near(b.stats(e).AS, e.stats.AS * 0.8);
    a.equal(e.statuses[0].expires, 3);
  }
});
test('C14 threeAD85% hits and exactly3 burn ticks at15%AP', () => {
  const b = cast('C14'),
    u = b.units[0],
    t = b.units[1];
  a.equal(b.logs.filter((l) => l.kind === 'damage').length, 3);
  near(t.stats.HP - t.hp, 3 * mitigatedDamage(u.stats.AD * 0.85, t.stats.GD));
  for (const x of b.units) x.castUntil = 999;
  for (let i = 1; i <= 3; i++) {
    b.time = i - 0.1;
    b.tick(0.1);
  }
  a.equal(b.logs.filter((l) => l.attackKind === 'dot').length, 3);
});
test('C15 lowestHP ally healsAP200% and GD15% lasts4sec', () => {
  const b = battle('C15', [{ id: 'C03', pos: 35 }]),
    u = b.units[0],
    ally = b.units[1];
  ally.hp = 100;
  b.cast(u, b.units[2]);
  near(ally.hp, 100 + u.stats.AP * 2);
  near(b.stats(ally).GD, ally.stats.GD * 1.15);
  b.time = 4.1;
  near(b.stats(ally).GD, ally.stats.GD);
});
test('C16 lightning wolf magicAP55%, cap2, duration8sec', () => {
  const b = battle('C16'),
    u = b.units[0];
  for (let i = 0; i < 3; i++) b.cast(u, b.units[1]);
  const wolves = b.units.filter((x) => x.summon);
  a.equal(wolves.length, 2);
  for (const pet of wolves) {
    near(pet.stats.AD, u.stats.AP * 0.55);
    a.equal(pet.attackType, 'magic');
    a.equal(pet.expires, 8);
  }
  for (const x of b.units) x.castUntil = 999;
  b.time = 8;
  b.tick();
  a(wolves.every((x) => x.dead));
});
test('C17 cost8% of CURRENT HP, AD230%, heals20% actual damage', () => {
  const b = battle('C17'),
    u = b.units[0],
    t = b.units[1];
  u.hp = 400;
  b.cast(u, t);
  const damage = mitigatedDamage(u.stats.AD * 2.3, t.stats.GD);
  near(u.hp, 400 * 0.92 + damage * 0.2);
  near(t.stats.HP - t.hp, damage);
});
test('C18 lowHP ally healsAP180% and shieldAP120% lasts4sec', () => {
  const b = battle('C18', [{ id: 'C03', pos: 35 }]),
    u = b.units[0],
    ally = b.units[1];
  ally.hp = 100;
  b.cast(u, b.units[2]);
  near(ally.hp, 100 + u.stats.AP * 1.8);
  near(ally.shields[0].amount, u.stats.AP * 1.2);
  a.equal(ally.shields[0].expires, 4);
});
test('C19 AP150%, root blocks movement but allows in-range attacks', () => {
  const b = cast('C19'),
    u = b.units[0],
    t = b.units[1];
  near(t.stats.HP - t.hp, mitigatedDamage(u.stats.AP * 1.5, t.stats.GD));
  a.equal(t.statuses[0].key, 'root');
  a.equal(t.statuses[0].expires, 1.5);
  const pos = t.pos;
  a.deepEqual(b.pathToRange(t, { pos: 24 }, 1), []);
  b.tick();
  a.equal(t.pos, pos);
  a(b.logs.some((l) => l.kind === 'damage' && l.source === t.uid));
  b.time = 2;
  a(b.pathToRange(t, { pos: 24 }, 1).length > 0);
});
test('C20 currentHP6%, AS30% and AD20% extra attack expire after5sec', () => {
  const b = battle('C20'),
    u = b.units[0],
    t = b.units[1];
  u.hp = 400;
  b.cast(u, t);
  near(u.hp, 376);
  near(b.stats(u).AS, u.stats.AS * 1.3);
  u.castUntil = 0;
  t.castUntil = 999;
  b.tick();
  const hits = b.logs.filter((l) => l.kind === 'damage' && l.source === u.uid);
  a(hits.some((l) => l.attackKind === 'bonusBasic'));
  near(
    hits.find((l) => l.attackKind === 'bonusBasic').amount,
    mitigatedDamage(u.stats.AD * 0.2, t.stats.GD),
  );
  b.time = 5.1;
  near(b.stats(u).AS, u.stats.AS);
});
test('C21 AP230%, nearest OTHER ally AP100% shield and lonecaster fallback', () => {
  const b = battle('C21', [
      { id: 'C03', pos: 35 },
      { id: 'C05', pos: 32 },
    ]),
    u = b.units[0];
  b.cast(u, b.units[3]);
  near(b.units[1].shields[0].amount, u.stats.AP);
  a.equal(b.units[1].shields[0].expires, 4);
  a.equal(b.units[2].shields.length, 0);
  const alone = cast('C21');
  near(alone.units[0].shields[0].amount, alone.units[0].stats.AP);
});
test('C22 AD170% and ownGD20% for4sec', () => {
  const b = cast('C22'),
    u = b.units[0],
    t = b.units[1];
  near(t.stats.HP - t.hp, mitigatedDamage(u.stats.AD * 1.7, t.stats.GD));
  near(b.stats(u).GD, u.stats.GD * 1.2);
  a.equal(u.statuses[0].expires, 4);
});
test('C23 shields self+adjacent only and retaliates50%AP on melee basic without recursion', () => {
  const b = battle('C23', [
      { id: 'C03', pos: 35 },
      { id: 'C05', pos: 32 },
    ]),
    u = b.units[0],
    enemy = b.units[3];
  b.cast(u, enemy);
  near(u.shields[0].amount, u.stats.AP * 1.4);
  a.equal(b.units[1].shields.length, 1);
  a.equal(b.units[2].shields.length, 0);
  const hp = enemy.hp;
  b.deal(enemy, u, 10, 'physical', { kind: 'basic', canCrit: false });
  near(hp - enemy.hp, mitigatedDamage(u.stats.AP * 0.5, enemy.stats.GD));
  a.equal(b.logs.filter((l) => l.attackKind === 'counter').length, 1);
});
