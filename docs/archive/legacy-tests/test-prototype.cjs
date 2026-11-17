'use strict';
const assert = require('node:assert/strict'),
  D = require('./src/legacy/data.js'),
  { Battle, mitigatedDamage, distance } = require('./src/legacy/engine.js');
// Isolate unchanged skill coefficients from the separately tested new bond balance.
require('./src/legacy/bond-effects').init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS ' + name);
  } catch (e) {
    console.error('FAIL ' + name);
    throw e;
  }
}
const near = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const basicBattle = (id = 'C01', enemy = 'C03') =>
  new Battle([{ id, pos: 31 }], [{ id: enemy, pos: 24 }], { rng: () => 0.99 });
test('45 roster / cost distribution / exact one of each attribute / all 16 bonds', () => {
  assert.equal(D.roster.length, 45);
  assert.equal(D.synergies.length, 16);
  assert.equal(D.playableIds.length, 45);
  assert.equal(Object.keys(D.skills).length, 45);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((c) => D.roster.filter((u) => u.cost === c).length),
    [12, 11, 10, 8, 4],
  );
  for (const u of D.roster) {
    assert.equal(u.bonds.length, 2);
    assert(u.bonds.every((name) => D.synergies.some((s) => s.name === name)));
    if (u.cost > 3) {
      assert(u.stats && u.name);
      assert.equal(D.skills[u.id].implemented, true);
      assert(u.playable);
    }
  }
});
test('all roster combinations exactly match the supplied document', () => {
  const fs = require('node:fs'),
    source = fs.readFileSync('./docs/specs/README_AUTCHESS_CODEX.md', 'utf8');
  const rows = [
    ...source.matchAll(/^\| (C\d{2}) \| ([1-5]) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm),
  ].map((m) => ({
    id: m[1],
    cost: Number(m[2]),
    race: m[3].trim(),
    job: m[4].trim(),
    trait: m[5].trim(),
  }));
  assert.equal(rows.length, 45);
  for (const r of rows) {
    const u = D.byId(r.id);
    for (const key of Object.keys(r)) assert.equal(u[key], r[key], `${r.id} ${key}`);
  }
});
test('all ten proposed stats for C01-C12 exactly match the source table', () => {
  const fs = require('node:fs'),
    source = fs.readFileSync('./docs/specs/README_AUTCHESS_CODEX.md', 'utf8');
  const lines = source.split('\n').filter((s) => /^\| C\d{2} \| [^|]+ \| \d{3} \|/.test(s));
  assert.equal(lines.length, 12);
  for (const line of lines) {
    const cols = line
        .split('|')
        .slice(1, -1)
        .map((s) => s.trim()),
      u = D.byId(cols[0]);
    assert(u.name.length > 0);
    D.statKeys.forEach((key, i) =>
      assert.equal(u.stats[key], parseFloat(cols[i + 2]), u.id + ' ' + key),
    );
  }
});
test('only playable IDs allowed; duplicate cells and >10 deployment rejected', () => {
  assert.throws(() => basicBattle('C99'));
  assert.throws(() => new Battle([{ id: 'C01', pos: 1 }], [{ id: 'C02', pos: 1 }]));
  assert.throws(
    () =>
      new Battle(
        Array.from({ length: 11 }, (_, i) => ({ id: 'C01', pos: 28 + i })),
        [{ id: 'C03', pos: 0 }],
      ),
  );
});
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
      { id: 'C03', pos: 31 },
      { id: 'C10', pos: 32 },
    ],
    before = JSON.stringify(units);
  D.evaluateSynergies(units);
  assert.equal(JSON.stringify(units), before);
  const b = new Battle(units, [{ id: 'C10', pos: 2 }], { rng: () => 0.99 }),
    snapshot = JSON.stringify(b.synergySnapshot);
  b.kill(b.units[0]);
  b.tick();
  assert.equal(JSON.stringify(b.synergySnapshot), snapshot);
  assert.equal(b.synergySnapshot.ally.find((s) => s.name === '철혈').threshold, 2);
});
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
  summons[0].pos = 23;
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
        { id: 'C05', pos: 31 },
        { id: 'C03', pos: 32 },
      ],
      [{ id: 'C10', pos: 24 }],
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
      [{ id: 'C07', pos: 31 }],
      [
        { id: 'C03', pos: 24 },
        { id: 'C10', pos: 23 },
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
  const b = new Battle([{ id: 'C09', pos: 52 }], [{ id: 'C03', pos: 3 }], { rng: () => 0.99 }),
    [a, t] = b.units;
  b.cast(a, t);
  assert.equal(distance(a.pos, t.pos), 1);
  assert(t.statuses.some((s) => s.key === 'stun'));
  assert.notEqual(a.pos, t.pos);
});
test('C10 GD30% buff and lowest-adjacent ally shield; self excluded', () => {
  const b = new Battle(
      [
        { id: 'C10', pos: 31 },
        { id: 'C03', pos: 32 },
        { id: 'C01', pos: 38 },
      ],
      [{ id: 'C09', pos: 24 }],
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
    summon.pos = 23;
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
test('legacy experimental toggle has no independent numerical effect', () => {
  const a = [
      { id: 'C03', pos: 31 },
      { id: 'C10', pos: 32 },
    ],
    e = [{ id: 'C01', pos: 24 }];
  assert.deepEqual(
    new Battle(a, e, { experimental: true, rng: () => 0.99 }).units.map((u) => u.stats),
    new Battle(a, e, { rng: () => 0.99 }).units.map((u) => u.stats),
  );
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
        .map((id, i) => ({ id, pos: 28 + i })),
      enemies = ['C03', 'C09', 'C10', 'C12'].map((id, i) => ({ id, pos: 21 + i, scale: 2 })),
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
console.log(`\n${passed} tests passed.`);
