// Migrated from the v0.15.18 suite test-v01517.cjs (tests for: bonds).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $bonds from '../../src/core/data/bonds.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('fs'),
  D = $data,
  B = $bonds,
  F = $bondEffects,
  { Battle, mitigatedDamage } = $engine,
  P = $progression,
  V = $preparation;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function setup(name, tier = 2) {
  const b = new Battle(
    [
      { id: 'C01', pos: 2 },
      { id: 'C03', pos: 10 },
    ],
    [
      { id: 'E01', pos: 3 },
      { id: 'E02', pos: 11 },
    ],
    { rng: () => 0.99 },
  );
  b.synergySnapshot.ally = [{ name, tier, threshold: tier * 2, members: ['C01'] }];
  b.synergySnapshot.enemy = [];
  F.init(b);
  return [b, ...b.units];
}
test('all16 tiers replace rather than add base stats, and summoned units do not inherit themes', () => {
  for (const [name, tiers] of Object.entries(B.rules))
    for (let i = 0; i < tiers.length; i++) {
      const [b, u] = setup(name, i + 1),
        r = tiers[i],
        base = D.byId(u.id).stats;
      for (const k of ['HP', 'AD', 'AP', 'AS']) {
        const fate =
          name === '운명' && i === 1 && ['AD', 'AP'].includes(k) && u.bondState.fate === 0
            ? 1.1
            : 1;
        near(u.stats[k], base[k] * (1 + (r[k] || 0)) * fate);
      }
      for (const k of ['GD', 'CTC'])
        near(
          u.stats[k],
          base[k] + (r[k] || 0) + (k === 'GD' && r.fate && u.bondState.fate === 1 ? 15 : 0),
        );
      const pet = b.summon(u, 'fire');
      a(!pet.bondRules);
    }
});
test('혈광 thresholds dynamically change AS; six-tier leeches actual damage', () => {
  for (const tier of [1, 2, 3]) {
    const [b, u, x, t] = setup('혈광', tier),
      r = B.rules.혈광[tier - 1];
    u.hp = u.stats.HP * (tier === 3 ? 0.6 : 0.5);
    near(b.stats(u).AS, u.stats.AS * (1 + (r.lowAS || 0)));
    const hp = u.hp,
      result = b.deal(u, t, 100, 'physical', { kind: 'basic' });
    near(u.hp, hp + (tier === 3 ? result.damage * 0.1 : 0));
    u.hp = u.stats.HP;
    near(b.stats(u).AS, u.stats.AS);
  }
});
test('월하 same-target stacks cap at four and target change resets', () => {
  const [b, u, x, t, z] = setup('월하');
  t.hp = t.stats.HP = 1e6;
  for (let i = 0; i < 7; i++)
    near(
      b.deal(u, t, 100, 'physical', { kind: 'basic' }).damage,
      mitigatedDamage(100 * (1 + Math.min(i, 4) * 0.05), t.stats.GD),
    );
  near(b.deal(u, z, 100, 'physical', { kind: 'basic' }).damage, mitigatedDamage(100, z.stats.GD));
});
test('종언 currentHP threshold and capped flat kill MP without mage multiplier', () => {
  const [b, u, x, t] = setup('종언', 3);
  t.hp = t.stats.HP * 0.4;
  near(b.deal(u, t, 10).damage, mitigatedDamage(13.5, t.stats.GD));
  u.mp = 0;
  t.hp = 1;
  b.deal(u, t, 9999);
  near(u.mp, 20);
});
test('흑월 critical extra physical is nonrecursive; next basic forced only after crit kill', () => {
  const [b, u, x, t, z] = setup('흑월', 3);
  u.stats.CTC = 100;
  t.hp = 1;
  b.deal(u, t, 100, 'physical', { kind: 'basic' });
  a(u.bondState.forceCrit);
  u.stats.CTC = 0;
  const result = b.deal(u, z, 10, 'physical', { kind: 'basic' });
  a(result.critical);
  a(!u.bondState.forceCrit);
  const hits = b.logs.filter((e) => e.kind === 'damage' && e.target === z.uid);
  a.equal(hits.length, 2);
  a.equal(hits[1].attackKind, 'bond');
});
test('무극 basic-only AS stacks and full-stack basic damage cap', () => {
  const [b, u, x, t] = setup('무극', 3);
  t.hp = t.stats.HP = 1e6;
  for (let i = 0; i < 10; i++) b.deal(u, t, 1, 'physical', { kind: 'basic' });
  a.equal(u.bondState.attacks, 8);
  near(b.stats(u).AS, u.stats.AS * 1.32);
  near(b.deal(u, t, 100, 'physical', { kind: 'basic' }).damage, mitigatedDamage(120, t.stats.GD));
  near(b.deal(u, t, 100).damage, mitigatedDamage(100, t.stats.GD));
});
test('철혈 eight-second self shield only at four tier', () => {
  for (const tier of [1, 2]) {
    const [b, u, x] = setup('철혈', tier);
    a.equal(u.shields.length, tier === 2 ? 1 : 0);
    a.equal(x.shields.length, 0);
    if (tier === 2) {
      near(u.shields[0].amount, u.stats.HP * 0.15);
      near(u.shields[0].expires, 8);
    }
  }
});
test('성약 post-mitigation transfer is once, no second mitigation/difficulty/onhit/counter', () => {
  const [b, u, x, t] = setup('성약');
  u.stats.GD = 900;
  x.stats.GD = 100;
  t.stats.CTC = 0;
  b.enemyDamageMultiplier = 2;
  const uh = u.hp,
    xh = x.hp,
    mp = u.mp,
    hit = b.deal(t, x, 100, 'physical', { kind: 'basic' });
  near(xh - x.hp, 85);
  near(uh - u.hp, 15);
  near(hit.damage, 85);
  near(t.damageDone, 100);
  near(u.mp, mp);
  a.equal(b.logs.filter((e) => e.attackKind === 'bondTransfer').length, 1);
});
test('성약 routed lethal respects I28 then P04 then 윤회 and never loops', () => {
  const [b, u, x, t] = setup('성약');
  u.itemIds = ['I28'];
  u.hp = 1;
  b.deal(t, x, 100, 'physical', { kind: 'basic' });
  a.equal(u.hp, 1);
  a(u.itemState.immortalUsed);
  a(!u.dead);
});
test('생명 one pulse per team every5s, lowest ratio+UID and source healing/shield power once', () => {
  const [b, u, x] = setup('생명', 3);
  u.hp = u.stats.HP * 0.5;
  x.hp = x.stats.HP * 0.1;
  const hp = x.hp;
  b.time = 5;
  F.update(b);
  near(x.hp - hp, x.stats.HP * 0.08 * 1.35);
  near(x.shields[0].amount, x.stats.HP * 0.08 * 1.35);
  a.equal(x.shields[0].expires, 10);
  F.update(b);
  a.equal(x.shields.length, 1);
});
test('윤회 allies death stacks cap, one immediate revive after survival guards, no phantom kill callback', () => {
  const [b, u, x, t] = setup('윤회', 3);
  let kills = 0;
  b.onUnitKilled = () => kills++;
  b.kill(x, t);
  near(b.stats(u).AD, u.stats.AD * 1.07);
  for (let i = 0; i < 9; i++) {
    x.dead = false;
    x.hp = 1;
    b.kill(x, t);
  }
  a.equal(u.bondState.deaths, 5);
  u.hp = 1;
  b.deal(t, u, 99999);
  a(!u.dead);
  near(u.hp, u.stats.HP * 0.3);
  a.equal(kills, 10);
  b.deal(t, u, 99999);
  a(u.dead);
  a.equal(kills, 11);
});
test('천명 starting adjacent ally GD only, aura does not duplicate per provider', () => {
  const [b, u, x] = setup('천명');
  near(x.stats.GD, D.byId(x.id).stats.GD + 10);
  near(u.stats.GD, D.byId(u.id).stats.GD + 15);
  x.pos = 32;
  near(x.stats.GD, D.byId(x.id).stats.GD + 10);
});
test('왕권 only actual stun/root marks damage vulnerability3s; armor debuff does not', () => {
  const [b, u, x, t] = setup('왕권');
  b.debuff(t, u, 'armor', 'GD', 'GD', 0.9, 3);
  a(!t.bondCrownUntil);
  b.addStatus(t, { key: 'stun', source: u.uid, harmful: true, label: '기절', expires: 1 });
  near(t.bondCrownUntil, 3);
  near(b.deal(x, t, 100).damage, mitigatedDamage(110, b.stats(t).GD));
  b.time = 3;
  near(b.deal(x, t, 100).damage, mitigatedDamage(100, b.stats(t).GD));
});
test('아르카나 flat15MP returns after cast and respects cap', () => {
  const [b, u, x, t] = setup('아르카나');
  b.cast(u, t);
  near(u.mp, 15);
  u.stats.MP = 10;
  b.cast(u, t);
  near(u.mp, 10);
});
test('공명 direct cast per-target once despite C07 multihit; adjacent one half extra; no DOT recursion', () => {
  const [b, u, x, t, z] = setup('공명', 3);
  u.skillId = 'C07';
  t.hp = t.stats.HP = 1e6;
  z.hp = z.stats.HP = 1e6;
  b.cast(u, t);
  const hits = b.logs.filter((e) => e.kind === 'damage' && e.attackKind === 'bond');
  a.equal(hits.filter((e) => e.target === t.uid).length, 2);
  a.equal(hits.filter((e) => e.target === z.uid).length, 2);
  const n = hits.length;
  b.deal(u, t, 10, 'magic', { kind: 'dot' });
  a.equal(b.logs.filter((e) => e.attackKind === 'bond').length, n);
});
test('심연 timed30% healing reduction uses highest overlap, skill direct hit only', () => {
  const [b, u, x, t] = setup('심연');
  b.cast(u, t);
  t.hp = 100;
  near(b.heal(t, 100, t), 70);
  t.healingReduction = 0.5;
  near(b.heal(t, 100, t), 50);
  t.healingReduction = 0;
  b.time = 4;
  near(b.heal(t, 100, t), 100);
});
test('운명 one RNG draw per team, same buff for all members, no reroll on stats/tick', () => {
  const b = new Battle(
    [
      { id: 'C05', pos: 2 },
      { id: 'C07', pos: 10 },
      { id: 'C16', pos: 1 },
      { id: 'C33', pos: 9 },
    ],
    [{ id: 'E01', pos: 7 }],
    { rng: () => 0.99 },
  );
  a(b.units.slice(0, 4).every((u) => u.bondState.fate === 2));
  for (const u of b.units.slice(0, 4)) near(u.mp, 20);
  b.rng = () => {
    throw Error('unexpected fate reroll');
  };
  for (const u of b.units) b.stats(u);
});
test('금단 currentHP cost min1; next cast charge is not current, not stacked; skill leech excludes DOT', () => {
  const [b, u, x, t] = setup('금단', 3);
  t.hp = t.stats.HP = 1e6;
  u.hp = 500;
  let hp = t.hp;
  b.cast(u, t);
  near(hp - t.hp, mitigatedDamage(u.stats.AD * 1.6 * 1.3, t.stats.GD));
  near(u.hp, 475 + (hp - t.hp) * 0.1);
  hp = t.hp;
  b.cast(u, t);
  near(hp - t.hp, mitigatedDamage(u.stats.AD * 1.6 * 1.55, t.stats.GD));
  near(u.bondState.nextSkill, 0.25);
  u.hp = 1;
  b.cast(u, t);
  a(u.hp >= 1);
});
test('old experimental toggle cannot restore28 effects; new combat per battle state resets', () => {
  const args = [
    [
      { id: 'C03', pos: 2 },
      { id: 'C10', pos: 10 },
      { id: 'C22', pos: 1 },
      { id: 'C23', pos: 9 },
    ],
    [{ id: 'E01', pos: 7 }],
  ];
  const x = new Battle(...args, { rng: () => 0.99 }),
    y = new Battle(...args, { rng: () => 0.99, experimental: true });
  a.deepEqual(x.units, y.units);
  x.units[0].bondState.attacks = 7;
  const z = new Battle(...args, { rng: () => 0.99 });
  a.equal(z.units[0].bondState.attacks, 0);
});
test('혈광 includes attributed proc/transfer damage once; 금단 excludes I27 costs/charges', () => {
  const [b, u, x, t] = setup('혈광', 3);
  u.hp = 100;
  t.bondRules.성약 = { share: 0.15 };
  t.pos = 11;
  b.units[3].pos = 3;
  b.units[3].stats.GD = 0;
  const hp = u.hp,
    damage = u.damageDone;
  b.deal(u, b.units[3], 100, 'physical', { kind: 'basic' });
  near(u.hp - hp, (u.damageDone - damage) * 0.1);
  const before = u.hp;
  b.itemProcDepth = 1;
  b.deal(u, t, 100, 'magic', { kind: 'item', itemProc: true, canCrit: false });
  b.itemProcDepth = 0;
  a(u.hp > before);
  const [f, a1, other, e] = setup('금단', 3);
  a1.hp = 500;
  a1.itemIds = ['I27'];
  f.rng = () => 0;
  e.hp = e.stats.HP = 1e6;
  f.cast(a1, e);
  near(a1.bondState.nextSkill, 0.25);
  const ownHeals = f.logs
    .filter((l) => l.kind === 'heal' && l.source === a1.uid)
    .reduce((n, l) => n + l.amount, 0);
  near(a1.hp, 475 + ownHeals);
  a.equal(f.skillUses.C01, 2);
});
