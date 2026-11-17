// Migrated from the v0.15.18 suite test-augments.cjs (tests for: augments).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  A = require('../../src/legacy/augments'),
  P = require('../../src/legacy/progression'),
  D = require('../../src/legacy/data'),
  I = require('../../src/legacy/items'),
  V = require('../../src/legacy/preparation'),
  F = require('../../src/legacy/augment-effects'),
  { Battle } = require('../../src/legacy/engine');
const clone = (x) => JSON.parse(JSON.stringify(x)),
  near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
let count = 0;
const state = () =>
  P.initialize({ gold: 7, health: 100, units: [], shop: [], recommendedBond: null });
function pending(id, node = '1-3') {
  const s = state(),
    def = A.byId(id);
  s.augmentState.pendingPick = {
    node,
    pick: A.config.nodes.indexOf(node) + 1,
    tier: def.tier,
    optionIds: [
      id,
      ...A.augments
        .filter((t) => t.tier === def.tier && t.id !== id)
        .slice(0, 2)
        .map((t) => t.id),
    ],
  };
  s.roundPhase = 'augment';
  return s;
}
function battle(ids = [], id = 'C03', gear = []) {
  return new Battle(
    [
      { id, pos: 38, itemIds: gear, bonuses: I.bonuses(gear) },
      { id: id === 'C05' ? 'C03' : 'C05', pos: 53 },
    ],
    [
      { id: 'E06', pos: 31 },
      { id: 'E01', pos: 3 },
    ],
    { rng: () => 0.99, allyModifiers: { augmentIds: ids } },
  );
}
test('36 exact unique IDs with12 per tier and editable numeric effects', () => {
  a.equal(A.augments.length, 36);
  a.equal(new Set(A.augments.map((t) => t.id)).size, 36);
  for (const [prefix, tier] of [
    ['S', 'silver'],
    ['G', 'gold'],
    ['P', 'prism'],
  ])
    for (let i = 1; i <= 12; i++) {
      const def = A.byId(prefix + String(i).padStart(2, '0'));
      a(def?.name && def.text && Object.keys(def.effect).length);
      a.equal(def.tier, tier);
    }
  a.deepEqual(A.config.nodes, ['1-3', '3-3', '5-3']);
});
test('uniform independent tier boundaries and unbiased three-without-replacement candidate sampling', () => {
  for (const [roll, tier] of [
    [0, 'silver'],
    [1 / 3 - 1e-9, 'silver'],
    [1 / 3, 'gold'],
    [2 / 3 - 1e-9, 'gold'],
    [2 / 3, 'prism'],
    [0.999999, 'prism'],
  ]) {
    let first = true;
    const x = A.draw([], () => (first ? ((first = false), roll) : 0));
    a.equal(x.tier, tier);
    a.equal(new Set(x.optionIds).size, 3);
    a(x.optionIds.every((id) => A.byId(id).tier === tier));
  }
  let seed = 124;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    counts = { silver: 0, gold: 0, prism: 0 },
    ids = {};
  for (let i = 0; i < 24000; i++) {
    const draw = A.draw([], rng);
    counts[draw.tier]++;
    for (const id of draw.optionIds) ids[id] = (ids[id] || 0) + 1;
  }
  for (const n of Object.values(counts)) a(Math.abs(n - 8000) < 350);
  for (const n of Object.values(ids)) a(Math.abs(n - 2000) < 220);
});
test('selected IDs excluded; offered but unchosen may return; repeated grades allowed', () => {
  let selected = [];
  for (let pick = 0; pick < 3; pick++) {
    const d = A.draw(selected, () => 0);
    a.equal(d.tier, 'silver');
    a.equal(d.optionIds.length, 3);
    a(d.optionIds.every((id) => !selected.includes(id)));
    if (pick === 1) a(d.optionIds.includes('S02'));
    selected.push(d.optionIds[0]);
  }
  a.deepEqual(selected, ['S01', 'S02', 'S03']);
});
test('gates happen before node entry, supply3-3/5-3 preserved and completed picks never reopen', () => {
  for (const node of A.config.nodes) {
    const [stage, round] = node.split('-').map(Number),
      s = state();
    s.stage = stage;
    s.round = round - 1;
    s.wave = P.ordinal(s);
    s.roundPhase = 'result';
    s.completedRounds[P.label(s)] = { key: P.label(s) };
    const before = P.label(s);
    a(P.advanceRound(s, () => 0));
    a.equal(P.label(s), before);
    a.equal(s.roundPhase, 'augment');
    a.equal(s.augmentState.pendingPick.node, node);
    a(!P.advanceRound(s));
    a.equal(P.beginSupply(s), null);
    a(!P.buyXp(s));
    const choice = P.availableAugments(s)[0].id;
    a(P.chooseAugment(s, choice));
    a.equal(P.label(s), node);
    a.equal(s.roundPhase, 'prepare');
    a.equal(P.roundType(s.stage, s.round), stage === 1 ? 'BATTLE' : 'SUPPLY');
    a(!P.ensureAugment(s));
  }
  for (const stage of [2, 4, 6]) {
    const s = state();
    s.stage = stage;
    a(!P.ensureAugment(s));
  }
});
test('pending tier/options survive migrate, refresh and confirmation; stale double click is inert', () => {
  const s = pending('G10');
  const restored = P.migrate(clone(s));
  a(
    P.ensureAugment(restored, () => {
      throw Error('reroll');
    }),
  );
  a.deepEqual(restored.augmentState.pendingPick, s.augmentState.pendingPick);
  a(P.chooseAugment(restored, 'G10'));
  const before = clone(restored);
  a(!P.chooseAugment(restored, 'G10'));
  a(!P.chooseAugment(restored, 'G01'));
  a.deepEqual(restored, before);
  P.migrate(restored);
  a.deepEqual(restored, before);
});
test('all36 choices execute once, immediate gold/XP/T3 match data and others do not pay', () => {
  for (const def of A.augments) {
    const s = pending(def.id),
      expected = state();
    if (def.effect.xp) P.addXp(expected, def.effect.xp);
    a(P.chooseAugment(s, def.id, () => 0));
    a.equal(s.gold, 7 + (def.effect.gold || 0));
    a.equal(s.level, expected.level);
    a.equal(s.xp, expected.xp);
    a.equal(s.inventory.length, def.effect.items?.count || 0);
    a(s.inventory.every((i) => I.byId(i.id).tier === 3));
    const before = clone(s);
    a(!P.chooseAugment(s, def.id));
    a.deepEqual(P.migrate(clone(s)), before);
  }
});
test('P11 follows existing independent T3 draws, permits two identical IDs, atomic on failure', () => {
  const s = pending('P11');
  a(P.chooseAugment(s, 'P11', () => 0));
  a.deepEqual(
    s.inventory.map((i) => i.id),
    ['I26', 'I26'],
  );
  a.notEqual(s.inventory[0].uid, s.inventory[1].uid);
  const bad = pending('P11'),
    before = clone(bad);
  let calls = 0;
  a.throws(() =>
    P.chooseAugment(bad, 'P11', () => {
      if (++calls === 2) throw Error('draw failure');
      return 0;
    }),
  );
  a.deepEqual(bad, before);
});
test('S11 reroll1G and G12/P09 win gold stack with original interest/boss/streak', () => {
  const s = state();
  a.equal(P.rerollCost(s), 2);
  s.augments = ['S11', 'G12', 'P09'];
  a.equal(P.rerollCost(s), 1);
  for (const type of ['BATTLE', 'BOSS', 'SUPPLY'])
    for (const win of [true, false]) {
      const x = state();
      x.augments = ['G12', 'P09'];
      x.gold = 50;
      x.round = type === 'BOSS' ? 5 : type === 'SUPPLY' ? 1 : 3;
      x.roundPhase = type === 'SUPPLY' ? 'prepare' : 'combat';
      let r;
      if (type === 'SUPPLY') {
        P.beginSupply(x, () => 0);
        P.toggleSupply(x, 0);
        P.toggleSupply(x, 1);
        r = P.confirmSupply(x, () => 0);
      } else r = P.settleRound(x, { winner: win ? 'ally' : 'enemy' }, () => 0.9);
      a.equal(r.augmentGold, win && type !== 'SUPPLY' ? 4 : 0);
      a.equal(r.interest, type === 'SUPPLY' ? 0 : 5);
      a.equal(r.total, r.base + r.interest + r.streakBonus + r.bonusGold + r.augmentGold);
      a.equal(x.inventory.length, type === 'BOSS' && win ? 1 : type === 'SUPPLY' ? 2 : 0);
      const before = x.gold;
      P.settleRound(x, { winner: 'ally' }, () => 0.9);
      a.equal(x.gold, before);
    }
});
test('all passive stat augments affect actual units, preview equals battle and base/enemies stay intact', () => {
  const before = clone(D.roster),
    base = D.byId('C03').stats;
  for (const def of A.augments.filter(
    (t) => t.effect.flat || t.effect.as || t.effect.mpReduction,
  )) {
    const b = battle([def.id]),
      u = b.units[0],
      e = def.effect;
    for (const key of D.statKeys) {
      let value = base[key] + (e.flat?.[key] || 0);
      if (key === 'AS') value *= 1 + (e.as || 0);
      if (key === 'MP') value *= 1 - (e.mpReduction || 0);
      near(u.stats[key], value);
    }
    const s = state();
    s.augments = [def.id];
    s.units = [{ id: 'C03', uid: 1, star: 1 }];
    a.deepEqual(P.previewStats(s, s.units[0]), u.stats);
    a.deepEqual(b.units[2].stats, require('../../src/legacy/encounters').byId('E06').stats);
  }
  a.deepEqual(D.roster, before);
});
test('flat boosts add after star/gear, AS/MP percentages stack and probabilities use points', () => {
  const s = state();
  s.augments = ['S07', 'G03', 'P03', 'S05', 'G02', 'P02', 'S06', 'G05', 'S12', 'G04', 'P08'];
  const e = A.aggregate(s.augments),
    base = D.byId('C03').stats,
    scaled = I.applyStats(base, { ASMultiplier: 1.2, HP: 100 }, 2),
    stats = A.applyStats(scaled, s.augments);
  near(stats.MP, base.MP * 0.6);
  near(stats.AS, base.AS * 1.2 * 1.5);
  near(stats.CTC, base.CTC + 8 + 12 + 15);
  near(stats.CTH, base.CTH + 25);
  near(stats.DOD, base.DOD + 6 + 8 + 15);
  a.equal(stats.HP, base.HP * 2 + 100 + 250);
  a.equal(e.capacity, 0);
});
test('S08/G09 start shields use final maxHP, independent5/6sec durations and reset next battle', () => {
  const ids = ['S08', 'G09', 'P01'];
  for (let i = 0; i < 2; i++) {
    const b = battle(ids);
    for (const u of b.alive('ally')) {
      a.equal(u.shields.length, 2);
      near(u.shields[0].amount, u.stats.HP * 0.08);
      near(u.shields[1].amount, u.stats.HP * 0.15);
      a.deepEqual(
        u.shields.map((s) => s.expires),
        [5, 6],
      );
    }
    a.equal(b.units[2].shields.length, 0);
  }
});
test('G06/P05 heal only attacker based on actual HP damage, shield/overkill/dot/proc exclusions', () => {
  const b = battle(['G06', 'P05']),
    [u, , t] = b.units;
  u.hp = 100;
  t.stats.GD = 100;
  const before = t.hp,
    hit = b.deal(u, t, 100, 'physical', { kind: 'basic', canCrit: false });
  near(hit.damage, 50);
  near(u.hp, 100 + 50 * 0.27);
  near(t.hp, before - 50);
  const hp = u.hp;
  b.shield(t, 100, 5, t);
  b.deal(u, t, 10, 'physical', { kind: 'skill', canCrit: false });
  near(u.hp, hp);
  t.shields = [];
  t.hp = 5;
  b.deal(u, t, 100, 'physical', { kind: 'skill', canCrit: false });
  near(u.hp, hp + 5 * 0.15);
  const target = b.units[3];
  b.deal(u, target, 10, 'magic', { kind: 'dot' });
  b.deal(u, target, 10, 'magic', { kind: 'item', itemProc: true });
  near(u.hp, hp + 5 * 0.15);
});
test('augment leech stacks with I29 and cannot trigger healing-skill I35 shielding', () => {
  const b = battle(['G06', 'P05'], 'C03', ['I29', 'I35']),
    [u, , t] = b.units;
  u.hp = 100;
  const hit = b.deal(u, t, 100, 'physical', { kind: 'basic', canCrit: false });
  near(u.hp, 100 + hit.damage * 0.47);
  b.cast(u, t);
  a.equal(u.shields.length, 0);
});
test('G07 exactly5/10/15/20sec, caps4, excludes dead and resets across battles', () => {
  const b = battle(['G07']),
    u = b.units[0],
    base = u.stats.AD;
  for (const [time, stacks] of [
    [4.999, 0],
    [5, 1],
    [10, 2],
    [15, 3],
    [20, 4],
    [60, 4],
  ]) {
    b.time = time;
    F.update(b);
    near(b.stats(u).AD, base * (1 + stacks * 0.05));
    near(b.stats(u).AP, u.stats.AP * (1 + stacks * 0.05));
  }
  a.equal(battle(['G07']).units[0].augmentState.heat, undefined);
  const dead = battle(['G07']);
  dead.units[0].dead = true;
  dead.time = 10;
  F.update(dead);
  a.equal(dead.units[0].augmentState.heat, undefined);
});
test('P06 once at10sec on living allies, no retroactive grant to later summons', () => {
  const b = battle(['P06'], 'C02'),
    u = b.units[0];
  b.time = 9.99;
  F.update(b);
  near(b.stats(u).AD, u.stats.AD);
  b.time = 10;
  F.update(b);
  near(b.stats(u).AD, u.stats.AD * 1.4);
  near(b.stats(u).AS, u.stats.AS * 1.2);
  b.time = 30;
  F.update(b);
  near(b.stats(u).AD, u.stats.AD * 1.4);
  const pet = b.summon(u, 'plague');
  a.equal(pet.augmentState.dominion, undefined);
});
test('G08 MP15% refund with per-character5sec CD, no loop from I27 bonus casts', () => {
  const b = battle(['G08'], 'C05', ['I27']),
    [u, other, t] = b.units;
  b.rng = () => 0;
  b.cast(u, t);
  near(u.mp, u.stats.MP * 0.15);
  a.equal(b.skillUses.C05, 2);
  b.time = 4.99;
  b.cast(u, t);
  a.equal(u.mp, 0);
  b.time = 5;
  b.cast(u, t);
  near(u.mp, u.stats.MP * 0.15);
  b.cast(other, t);
  near(other.mp, other.stats.MP * 0.15);
  a(b.logs.length < 70);
});
test('P07 starts with50% final maxMP, quick-mana override and future summons MP0', () => {
  const b = battle(['P07', 'P03'], 'C02');
  near(b.units[0].mp, b.units[0].stats.MP * 0.5);
  a.equal(b.units[2].mp, 0);
  const pet = b.summon(b.units[0], 'plague');
  a.equal(pet.mp, 0);
  a.equal(pet.stats.MP, 0);
  const quick = new Battle([{ id: 'C03', pos: 38 }], [{ id: 'E06', pos: 31 }], {
    quickMana: true,
    allyModifiers: { augmentIds: ['P07', 'P03'] },
  });
  near(quick.units[0].mp, quick.units[0].stats.MP);
});
test('P04 and I28 use independent states; I28 first, next lethal P04, then death', () => {
  const b = battle(['P04'], 'C03', ['I28']),
    u = b.units[0],
    enemy = b.units[2];
  b.deal(enemy, u, 1e6, 'physical', { kind: 'skill' });
  a.equal(u.hp, 1);
  a(u.itemState.immortalUsed);
  a(!u.augmentState.immortalUsed);
  near(u.shields.at(-1).amount, u.stats.HP * 0.3);
  u.shields = [];
  b.deal(enemy, u, 1e6, 'physical', { kind: 'skill' });
  a.equal(u.hp, 1);
  a(u.augmentState.immortalUsed);
  near(u.shields.at(-1).amount, u.stats.HP * 0.2);
  near(u.shields.at(-1).expires, 3);
  u.shields = [];
  b.deal(enemy, u, 1e6, 'physical', { kind: 'skill' });
  a(u.dead);
  const fresh = battle(['P04']);
  a(!fresh.units[0].augmentState.immortalUsed);
});
test('P04 also prevents lethal DOT/item damage, protects allied summons and never enemies', () => {
  for (const kind of ['dot', 'item']) {
    const b = battle(['P04'], 'C02'),
      u = b.units[0],
      pet = b.summon(u, 'plague'),
      enemy = b.units[2];
    b.deal(enemy, pet, 1e6, 'magic', { kind, itemProc: kind === 'item' });
    a.equal(pet.hp, 1);
    a(pet.augmentState.immortalUsed);
    b.deal(u, enemy, 1e6, 'magic', { kind: 'skill' });
    a(enemy.dead);
  }
});
test('P12 capacity level+1 up to11, real move/swap/save/battle limits without level11', () => {
  const s = state();
  s.augments = ['P12'];
  a.equal(P.capacity(s), 4);
  s.level = 10;
  a.equal(P.capacity(s), 11);
  s.units = D.playableIds.slice(0, 11).map((id, i) => ({
    id,
    uid: i + 1,
    star: 1,
    location: i < 10 ? 'board' : 'bench',
    pos: i < 10 ? 28 + i : -1,
    benchSlot: 0,
  }));
  a(V.moveUnit(s, 11, { location: 'board', pos: 38 }).ok);
  const b = new Battle(s.units, [{ id: 'E06', pos: 17 }], { allyModifiers: P.allyModifiers(s) });
  a.equal(b.alive('ally').length, 11);
  a.equal(P.capacity(P.migrate(clone(s))), 11);
  a.equal(s.level, 10);
  a.throws(() => new Battle(s.units, [{ id: 'E06', pos: 17 }]));
  const plain = state();
  plain.level = 10;
  a.equal(P.capacity(plain), 10);
});
test('summons inherit ongoing flat buffs once, later heat only at future ticks, start shields not reapplied', () => {
  const b = battle(['S01', 'G07', 'G09'], 'C02'),
    u = b.units[0];
  b.time = 6;
  F.update(b);
  const pet = b.summon(u, 'plague');
  a.equal(pet.stats.HP, b.config.summons.plague.HP + 150);
  a.equal(pet.shields.length, 0);
  a.equal(pet.augmentState.heat, undefined);
  b.time = 10;
  F.update(b);
  a.equal(pet.augmentState.heat, 1);
});
test('fresh run resets all selections and36 augments combined with all33 skills terminate safely', () => {
  let seed = 892;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 69; i++) {
    const ids =
        i < 36
          ? [A.augments[i].id]
          : Array.from({ length: 3 }, () => A.augments[Math.floor(rng() * 36)].id),
      id = D.playableIds[i % D.playableIds.length],
      b = new Battle(
        [
          {
            id,
            pos: 38,
            itemIds: ['I27', 'I28', 'I35'],
            bonuses: I.bonuses(['I27', 'I28', 'I35']),
          },
          { id: id === 'C05' ? 'C03' : 'C05', pos: 53 },
        ],
        [
          { id: 'E06', pos: 17, star: 2 },
          { id: 'E01', pos: 3 },
        ],
        { rng, quickMana: true, allyModifiers: { augmentIds: ids } },
      );
    for (let t = 0; t < 1600 && !b.result; t++) b.tick();
    a(b.result);
    for (const u of b.units) {
      a(Number.isFinite(u.hp));
      a(u.hp <= u.stats.HP + 1e-6);
      for (const n of Object.values(b.stats(u))) a(Number.isFinite(n));
    }
    a(b.logs.length <= 600);
  }
  const s = pending('P09');
  P.chooseAugment(s, 'P09');
  P.initialize(s);
  a.deepEqual(s.augments, []);
  a.deepEqual(s.augmentState, {
    version: 1,
    completedPicks: [],
    skippedPicks: [],
    pendingPick: null,
  });
});
