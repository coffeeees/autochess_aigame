// Migrated from the v0.15.18 suite test-items.cjs (tests for: items).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $itemEffects from '../../src/core/combat/item-effects.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  I = $items,
  P = $progression,
  D = $data,
  V = $preparation,
  F = $itemEffects,
  { Battle, mitigatedDamage } = $engine;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`),
  clone = (x) => JSON.parse(JSON.stringify(x));
function state(stage = 1, round = 1) {
  const s = P.initialize({
    health: 100,
    gold: 12,
    units: [
      { id: 'C03', uid: 1, star: 1, pos: 31, location: 'board' },
      { id: 'C05', uid: 2, star: 1, pos: 32, location: 'board' },
    ],
    shop: [],
  });
  s.stage = stage;
  s.round = round;
  return s;
}
function battle(ids = [], id = 'C03', options = {}) {
  return new Battle(
    [
      { id, uid: 1, pos: 31, itemIds: ids, bonuses: I.bonuses(ids) },
      { id: id === 'C05' ? 'C03' : 'C05', uid: 2, pos: 32 },
    ],
    [
      { id: 'E06', pos: 24 },
      { id: 'E03', pos: 23 },
      { id: 'E01', pos: 17 },
    ],
    { rng: () => 0.99, ...options },
  );
}
function choose(s, rng = () => 0.1) {
  P.beginSupply(s, rng);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
function freeze(b) {
  for (const u of b.units) u.castUntil = 999;
}
test('all40 IDs, exact names/text/stats from Markdown and tier10/15/15', () => {
  a.equal(I.items.length, 40);
  a.equal(new Set(I.items.map((i) => i.id)).size, 40);
  a.deepEqual(
    [1, 2, 3].map((t) => I.items.filter((i) => i.tier === t).length),
    [10, 15, 15],
  );
  const rows = fs
    .readFileSync('docs/specs/AUTOCHESS_ITEMS_CODEX.md', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\| I\d\d \|/.test(l));
  for (const row of rows) {
    const [id, name, stats, effect = ''] = row
        .split('|')
        .slice(1, -1)
        .map((x) => x.trim()),
      def = I.byId(id);
    a.equal(def.name, name);
    a.equal(def.statsText, stats);
    a.equal(def.effect, effect);
    for (const m of stats.matchAll(/(AD|AP|HP|GD|AS|CTC|CTH|MP|DOD|RNG)\s*\+(\d+)/g))
      a.equal(def.stats[m[1] === 'AS' ? 'ASPercent' : m[1]], Number(m[2]));
  }
});
test('이전 장비(sword·armor·crystal)는 v0.17.0에서 지웠다', () => {
  a.equal(I.legacy, undefined);
  for (const id of ['sword', 'armor', 'crystal']) a.equal(I.byId(id), undefined, id);
  a.equal(I.items.length, 40);
});
test('all tiers allow identical equipment and preserve3slots', () => {
  for (const id of ['I01', 'I11', 'I26']) {
    const s = state();
    for (let i = 0; i < 3; i++) a(P.equip(s, P.addItem(s, id).uid, 1));
    a(!P.equip(s, P.addItem(s, id).uid, 1));
    a.equal(P.unitBonuses(s, 1).AD, I.byId(id).stats.AD * 3);
  }
  const s = state(),
    first = P.addItem(s, 'I26'),
    same = P.addItem(s, 'I26'),
    other = P.addItem(s, 'I27');
  a(P.equip(s, first.uid, 1));
  a(P.equip(s, same.uid, 1));
  a(P.equip(s, other.uid, 1));
  a(V.transferItem(s, same.uid, 2).ok);
  a(V.transferItem(s, same.uid, 1).ok);
});
test('all10 stats, relativeAS, flatHP/MP, ranges and preview match actual battle', () => {
  for (const id of I.items.map((i) => i.id)) {
    const s = state(),
      item = P.addItem(s, id);
    a(P.equip(s, item.uid, 1));
    const preview = P.previewStats(s, s.units[0]),
      b = new Battle(
        [{ ...s.units[0], itemIds: P.unitItemIds(s, 1), bonuses: P.unitBonuses(s, 1) }],
        [{ id: 'E06', pos: 24 }],
      );
    for (const key of D.statKeys) near(preview[key], b.units[0].stats[key]);
  }
  const s = state();
  P.equip(s, P.addItem(s, 'I05').uid, 1);
  P.equip(s, P.addItem(s, 'I05').uid, 1);
  near(P.previewStats(s, s.units[0]).AS, D.byId('C03').stats.AS * 1.24);
});
test('supply4 unique slots, choose2, prohibit third, selection/offer survives reload', () => {
  const s = state(),
    offer = P.beginSupply(s, () => 0.1);
  a.equal(offer.options.length, 4);
  a.equal(new Set(offer.options).size, 4);
  a(offer.options.every((id) => I.byId(id).tier === 1));
  a(!P.confirmSupply(s));
  a(P.toggleSupply(s, 0));
  a(P.toggleSupply(s, 1));
  a(!P.toggleSupply(s, 2));
  a(!P.toggleSupply(s, -1));
  a(!P.toggleSupply(s, 4));
  const restored = clone(s);
  a.deepEqual(
    P.beginSupply(restored, () => {
      throw Error('reroll');
    }),
    offer,
  );
  a.equal(restored.inventory.length, 0);
  const r = P.confirmSupply(restored, () => 0.99);
  a.equal(r.extra.itemIds.length, 2);
  a.equal(restored.inventory.length, 2);
  a.equal(restored.gold, 12);
  a.equal(restored.health, 100);
  a.equal(restored.xp, 2);
  const before = clone(restored);
  a.deepEqual(P.confirmSupply(clone(restored)), r);
  a.deepEqual(P.settleRound(restored), r);
  a.deepEqual(restored, before);
});
test('supply slot deselection/reselection persists and no rewards before confirmation', () => {
  const s = state();
  P.beginSupply(s);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  a(P.toggleSupply(s, 0));
  a(P.toggleSupply(s, 3));
  a.deepEqual(s.supplyOffer.selected, [1, 3]);
  a.equal(s.inventory.length, 0);
  a.equal(s.xp, 0);
  a(P.confirmSupply(s));
  a(!P.toggleSupply(s, 2));
});
test('all supply tier boundaries and large seeded distributions match each stage', () => {
  let seed = 881;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let stage = 1; stage <= 8; stage++) {
    const expected = I.tierOdds[Math.min(stage, 6)],
      counts = [0, 0, 0],
      samples = 14000;
    for (let i = 0; i < samples; i++) counts[I.byId(I.draw(stage, rng)).tier - 1]++;
    for (let i = 0; i < 3; i++)
      a(Math.abs((counts[i] / samples) * 100 - expected[i]) < 1.5, [stage, counts, expected]);
    const s = state(stage, stage === 1 ? 1 : 3),
      offer = P.beginSupply(s, rng);
    a.equal(new Set(offer.options).size, 4);
    if (stage >= 6) a(offer.options.every((id) => I.byId(id).tier === 3));
  }
});
test('boss guaranteed1 correct tier, loss0 and gold/interest/streak unchanged for all branches', () => {
  for (let stage = 1; stage <= 8; stage++)
    for (const win of [true, false])
      for (const roll of [0, 0.39999, 0.4, 0.99999]) {
        const s = state(stage, 5);
        s.gold = 50;
        s.roundPhase = 'combat';
        const r = P.settleRound(s, { winner: win ? 'ally' : 'enemy' }, () => roll),
          bonus = win && roll >= 0.4 ? (P.config.rewards.bossExtraGold[stage] ?? 15) : 0;
        a.equal(r.base, win ? 5 : 3);
        a.equal(r.interest, 5);
        a.equal(r.streakBonus, win ? 1 : 0);
        a.equal(r.bonusGold, bonus);
        a.equal(r.total, (win ? 5 : 3) + 5 + (win ? 1 : 0) + bonus);
        a.equal(s.inventory.length, win ? 1 : 0);
        if (win) a.equal(I.byId(r.bossItem.itemId).tier, stage === 1 ? 1 : stage <= 4 ? 2 : 3);
        else a.equal(r.bossItem, null);
        const before = clone(s);
        P.settleRound(s, { winner: 'ally' });
        a.deepEqual(s, before);
      }
});
test('regular1..6 supplies14 + bosses6 exactly20 items, endless supply/boss T3', () => {
  const s = state();
  while (s.stage <= 6) {
    if (s.roundPhase === 'augment')
      // 아이템을 주는 증강(S10·P11)은 피한다: 보급·보스 지급 수만 센다
      P.chooseAugment(s, P.availableAugments(s).find((option) => !option.effect.items).id);
    if (P.roundType(s.stage, s.round) === 'SUPPLY') choose(s);
    else {
      s.roundPhase = 'combat';
      P.settleRound(s, { winner: 'ally' }, () => 0.8);
    }
    if (s.completionChoice === 'pending') a(P.chooseCompletion(s, 'continue'));
    a(P.advanceRound(s));
  }
  a.equal(s.inventory.length, 20);
  s.round = 3;
  const r = choose(s);
  a(r.extra.itemIds.every((id) => I.byId(id).tier === 3));
  s.round = 5;
  s.roundPhase = 'combat';
  a.equal(I.byId(P.settleRound(s, { winner: 'ally' }).bossItem.itemId).tier, 3);
});
test('trash only loose items in preparation, one-level undo persists and no duplication', () => {
  const s = state(),
    first = P.addItem(s, 'I01'),
    second = P.addItem(s, 'I02');
  a(P.equip(s, second.uid, 1));
  a(!P.discardItem(s, second.uid));
  a(P.discardItem(s, first.uid));
  a.equal(s.inventory.length, 1);
  const restored = clone(s);
  a(P.undoDiscard(restored));
  a.equal(restored.inventory.length, 2);
  a(!P.undoDiscard(restored));
  a(P.discardItem(restored, first.uid));
  restored.roundPhase = 'combat';
  a(!P.undoDiscard(restored));
  a(!P.discardItem(restored, second.uid));
  a.equal(restored.gold, 12);
});
test('I26 25% chain max2 AD60% magic, only other nearby foes, no recursive procs', () => {
  const b = battle(['I26', 'I33', 'I39']),
    u = b.units[0],
    target = b.units[2];
  b.rng = () => 0.1;
  b.deal(u, target, 10, 'physical', { kind: 'basic', canCrit: false });
  const hits = b.logs.filter((l) => l.kind === 'damage' && l.sourceTag === 'ITEM_PROC');
  a.equal(hits.length, 2);
  for (const hit of hits) {
    a.notEqual(hit.target, target.uid);
    const foe = b.units.find((x) => x.uid === hit.target);
    near(hit.amount, mitigatedDamage(b.stats(u).AD * 0.6, foe.stats.GD));
    a.equal(foe.statuses.filter((x) => x.key === 'itemFrost').length, 0);
  }
  a.equal(b.logs.filter((l) => l.itemId === 'I26').length, 1);
});
test('I27 free cast once, no repeated I27/I30 from bonus and normal skill effect retained', () => {
  const b = battle(['I27', 'I30']),
    u = b.units[0];
  b.rng = () => 0;
  b.cast(u, b.units[2]);
  a.equal(b.skillUses.C03, 2);
  a.equal(u.mp, 0);
  a.equal(u.itemState.manaReturns.length, 1);
  a.equal(b.logs.filter((l) => l.itemId === 'I27').length, 1);
  a.equal(b.units[2].statuses.filter((x) => x.key === 'shadow').length, 1);
});
test('I27 supports all33 skills including heals/summons/AOE with safe targets', () => {
  for (const id of D.playableIds) {
    const b = battle(['I27'], id),
      u = b.units[0];
    b.rng = () => 0;
    b.cast(u, b.units[2]);
    a.equal(b.skillUses[id], 2, id);
    a(
      b.units.every((x) => Number.isFinite(x.hp)),
      id,
    );
  }
});
test('I28 lethal hit survivesHP1 shield30%/4s once, resets next battle', () => {
  const b = battle(['I28']),
    u = b.units[0],
    e = b.units[2];
  b.deal(e, u, 1e6, 'physical', { canCrit: false });
  a.equal(u.hp, 1);
  a(!u.dead);
  near(u.shields[0].amount, u.stats.HP * 0.3);
  a.equal(u.shields[0].expires, 4);
  b.deal(e, u, 1e6, 'physical', { canCrit: false });
  a(u.dead);
  const next = battle(['I28']);
  a(!next.units[0].itemState.immortalUsed);
});
test('I29 heals20% actual basic HP damage, excludes shielded/overkill excess', () => {
  const b = battle(['I29']),
    u = b.units[0],
    e = b.units[2];
  u.hp = 100;
  e.hp = 20;
  const r = b.deal(u, e, 10000, 'physical', { kind: 'basic', canCrit: false });
  near(r.damage, 20);
  near(u.hp, 104);
  const t = b.units[3];
  b.shield(t, 10000, 4, t);
  const hp = u.hp;
  b.deal(u, t, 50, 'physical', { kind: 'basic', canCrit: false });
  near(u.hp, hp);
});
test('I30 delay3s maxMP30%, cooldown8s and dead unit cannot refund', () => {
  const b = battle(['I30']),
    u = b.units[0];
  b.cast(u, b.units[2]);
  freeze(b);
  b.tick(2.9);
  a.equal(u.mp, 0);
  b.tick(0.1);
  near(u.mp, u.stats.MP * 0.3);
  b.cast(u, b.units[2]);
  a.equal(u.itemState.manaReturns.length, 0);
  b.time = 8;
  b.cast(u, b.units[2]);
  a.equal(u.itemState.manaReturns.length, 1);
  u.dead = true;
  b.time = 11;
  F.update(b);
  a.equal(u.mp, 0);
});
test('I31 only own summons: attack30%, lifetime40%, no poison/explosion rewrite', () => {
  const b = battle(['I31'], 'C02'),
    u = b.units[0],
    pet = b.summon(u, 'plague'),
    other = b.summon(b.units[1], 'fire');
  near(pet.stats.AD, b.stats(u).AP * 0.4 * 1.3);
  near(pet.expires, 11.2);
  near(pet.poisonDamage, b.stats(u).AP * b.config.summons.plague.poisonApRatio);
  near(other.expires, 8);
  near(other.stats.AD, b.stats(b.units[1]).AP * 0.6);
});
test('I32 fourAP25% burn ticks, refresh without double stacking, proc-tagged DOT', () => {
  const b = battle(['I32']),
    u = b.units[0],
    e = b.units[2];
  b.deal(u, e, 1, 'physical', { kind: 'basic', canCrit: false });
  b.deal(u, e, 1, 'physical', { kind: 'basic', canCrit: false });
  a.equal(e.statuses.filter((s) => s.key === 'itemHellfire').length, 1);
  freeze(b);
  for (let i = 0; i < 4; i++) b.tick(1);
  const dots = b.logs.filter((l) => l.attackKind === 'dot' && l.sourceTag === 'ITEM_PROC');
  a.equal(dots.length, 4);
  for (const hit of dots) near(hit.amount, mitigatedDamage(b.stats(u).AP * 0.25, e.stats.GD));
});
test('I33 target-specific3hit freeze counts reset, no DOT or proc trigger', () => {
  const b = battle(['I33']),
    u = b.units[0],
    e = b.units[2],
    other = b.units[3];
  for (let i = 0; i < 2; i++) b.deal(u, e, 1, 'magic');
  a(!e.statuses.some((s) => s.key === 'stun'));
  b.deal(u, other, 1, 'magic');
  b.deal(u, e, 1, 'magic');
  a(e.statuses.some((s) => s.key === 'stun' && s.expires === 1));
  a.equal(u.itemState.frostCounts[e.uid], 0);
  a.equal(u.itemState.frostCounts[other.uid], 1);
  b.deal(u, other, 1, 'magic', { kind: 'dot' });
  b.deal(u, other, 1, 'magic', { kind: 'item', itemProc: true });
  a.equal(u.itemState.frostCounts[other.uid], 1);
});
test('I34 threshold uses prehitHP25% and only normal basic damage50%', () => {
  for (const ratio of [0.25, 0.250001]) {
    const b = battle(['I34']),
      u = b.units[0],
      e = b.units[2];
    e.hp = e.stats.HP * ratio;
    const r = b.deal(u, e, 10, 'physical', { kind: 'basic', canCrit: false });
    near(r.damage, mitigatedDamage(ratio === 0.25 ? 15 : 10, e.stats.GD));
  }
});
test('I35 healing skill30% and actualheal25% shield3s, excludes overheal and lifesteal', () => {
  const b = battle(['I35'], 'C05'),
    u = b.units[0],
    ally = b.units[1];
  ally.hp = 100;
  b.cast(u, b.units[2]);
  const actual = b.stats(u).AP * 1.8 * 1.3;
  near(ally.hp, 100 + actual);
  near(ally.shields[0].amount, actual * 0.25);
  a.equal(ally.shields[0].expires, 3);
  ally.hp = ally.stats.HP - 10;
  u.hp = u.stats.HP;
  b.cast(u, b.units[2]);
  near(ally.shields.at(-1).amount, 2.5);
  const before = u.shields.length;
  u.hp -= 10;
  b.heal(u, 10, u);
  a.equal(u.shields.length, before);
});
test('I36 evadeAS20%/4s cooldown6s', () => {
  const b = battle(['I36']),
    u = b.units[0],
    e = b.units[2],
    base = u.stats.AS;
  b.rng = () => 0;
  a(b.deal(e, u, 10, 'physical', { kind: 'basic' }).evaded);
  near(b.stats(u).AS, base * 1.2);
  b.time = 4.1;
  near(b.stats(u).AS, base);
  b.deal(e, u, 10, 'physical', { kind: 'basic' });
  near(b.stats(u).AS, base);
  b.time = 6;
  b.deal(e, u, 10, 'physical', { kind: 'basic' });
  near(b.stats(u).AS, base * 1.2);
});
test('I37 start self/adjacent shield maxHP15%/6s only', () => {
  const b = battle(['I37']),
    u = b.units[0];
  near(u.shields[0].amount, u.stats.HP * 0.15);
  a.equal(u.shields[0].expires, 6);
  near(b.units[1].shields[0].amount, u.stats.HP * 0.15);
  a.equal(b.units[2].shields.length, 0);
});
test('I38 continuous targetAS5% capped8, target switch resets', () => {
  const b = battle(['I38']),
    u = b.units[0],
    t = b.units[2],
    base = u.stats.AS;
  for (let i = 0; i < 10; i++) b.deal(u, t, 1, 'physical', { kind: 'basic', canCrit: false });
  a.equal(u.itemState.frenzyStacks, 8);
  near(b.stats(u).AS, base * 1.4);
  b.deal(u, b.units[3], 1, 'physical', { kind: 'basic', canCrit: false });
  a.equal(u.itemState.frenzyStacks, 1);
  near(b.stats(u).AS, base * 1.05);
});
test('I39 splash actualskill35% as magic, maxonce per recipient per cast and no proc chain', () => {
  const b = battle(['I39', 'I33'], 'C13'),
    u = b.units[0];
  b.cast(u, b.units[2]);
  const procHits = b.logs.filter((l) => l.kind === 'damage' && l.sourceTag === 'ITEM_PROC');
  a.equal(new Set(procHits.map((h) => h.target)).size, procHits.length);
  a(procHits.length > 0);
  for (const foe of b.units.slice(2)) a.equal(u.itemState.frostCounts[foe.uid], 1);
});
test('I40 killsAD/AP5% capped5, no item-proc kills and state fresh next battle', () => {
  const b = battle(['I40']),
    u = b.units[0],
    ad = u.stats.AD,
    ap = u.stats.AP;
  for (let i = 0; i < 7; i++) {
    const target = b.makeUnit({ id: 'E03', pos: i }, 'enemy');
    b.units.push(target);
    b.deal(u, target, 1e6, 'physical', { canCrit: false });
  }
  a.equal(u.itemState.warStacks, 5);
  near(b.stats(u).AD, ad * 1.25);
  near(b.stats(u).AP, ap * 1.25);
  const fresh = battle(['I40']);
  a(!fresh.units[0].itemState.warStacks);
  const t = b.makeUnit({ id: 'E03', pos: 6 }, 'enemy');
  b.units.push(t);
  u.itemState.warStacks = 0;
  b.deal(u, t, 1e6, 'magic', { kind: 'item', itemProc: true });
  a.equal(u.itemState.warStacks, 0);
});
test('injected duplicateT3 IDs never duplicate unique effect; stats still sum defensively', () => {
  const b = battle(['I37', 'I37']),
    u = b.units[0];
  a.equal(u.shields.length, 1);
  near(u.stats.HP, D.byId('C03').stats.HP + 800);
});
test('item-proc extra skills cannot trigger other active unique effects recursively', () => {
  const b = battle(['I27', 'I35', 'I30'], 'C05'),
    u = b.units[0],
    ally = b.units[1];
  ally.hp = 10;
  b.rng = () => 0;
  b.cast(u, b.units[2]);
  a.equal(b.skillUses.C05, 2);
  a.equal(ally.shields.length, 1);
  a.equal(u.itemState.manaReturns.length, 1);
  a(b.logs.length < 50);
});
test('all40 random combat combinations finish, no nonfinite stats, no recursive explosion', () => {
  let seed = 831;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 60; i++) {
    const ids = Array.from({ length: 3 }, () => I.items[Math.floor(rng() * 40)].id),
      b = battle(ids, D.playableIds[i % D.playableIds.length], { rng, quickMana: true });
    for (let tick = 0; tick < 1500 && !b.result; tick++) b.tick();
    a(b.result);
    for (const u of b.units) {
      a(Number.isFinite(u.hp));
      for (const value of Object.values(b.stats(u))) a(Number.isFinite(value));
    }
    a(b.logs.length <= 600);
  }
});
