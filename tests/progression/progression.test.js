// Migrated from the v0.15.18 suite test-progression.cjs (tests for: progression).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $progression from '../../src/core/progression.js';

const assert = require('node:assert/strict'),
  D = $data,
  P = $progression,
  { Battle } = $engine;
const clone = (x) => JSON.parse(JSON.stringify(x)),
  near = (a, b) => assert(Math.abs(a - b) < 1e-6);
let count = 0;
function state() {
  return P.initialize({
    health: 100,
    gold: 12,
    units: [
      { uid: 1, id: 'C03', location: 'board', pos: 38, star: 1 },
      { uid: 2, id: 'C05', location: 'board', pos: 53, star: 1 },
    ],
    shop: D.playableIds.slice(0, 5),
  });
}
function at(stage, round, gold = 12) {
  const s = state();
  s.stage = stage;
  s.round = round;
  s.wave = P.ordinal(s);
  s.gold = gold;
  return s;
}
function supply(s, rng = () => 0.1) {
  P.beginSupply(s, rng);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
function combat(s, winner = 'ally', rng = () => 0.8) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner, time: 10, survivingEnemies: winner === 'ally' ? 0 : 2 }, rng);
}
test('round schedules exact through stage6 and same temporary fallback after6', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((r) => P.roundType(1, r)),
    ['SUPPLY', 'SUPPLY', 'BATTLE', 'BATTLE', 'BOSS'],
  );
  for (let stage = 2; stage <= 12; stage++)
    assert.deepEqual(
      [1, 2, 3, 4, 5].map((r) => P.roundType(stage, r)),
      ['BATTLE', 'BATTLE', 'SUPPLY', 'BATTLE', 'BOSS'],
    );
});
test('new run starts level3, 0/6XP and 1-1 safe supply', () => {
  const s = state();
  assert.equal(s.level, 3);
  assert.equal(s.xp, 0);
  assert.equal(P.config.level.requirements[s.level], 6);
  assert.equal(P.capacity(s), 3);
  assert.equal(P.label(s), '1-1');
  assert.equal(P.roundType(s.stage, s.round), 'SUPPLY');
});
test('safe supply grants exactly two chosen items, no HP loss or battle gold/interest', () => {
  const s = at(1, 1, 59),
    receipt = supply(s, () => 0.1);
  assert.equal(s.inventory.length, 2);
  assert.equal(receipt.extra.kind, 'items');
  assert.equal(s.health, 100);
  assert.equal(s.gold, 61);
  assert.equal(receipt.bonusGold, 2);
  assert.equal(receipt.interest, 0);
  assert.equal(s.xp, 2);
  assert.equal(s.roundPhase, 'result');
});
test('repeated supply, reload, or result confirmation cannot duplicate rewards/XP', () => {
  const s = state(),
    receipt = supply(s);
  const before = clone(s);
  assert.equal(P.settleRound(s), receipt);
  assert.deepEqual(s, before);
  const reloaded = clone(s);
  P.settleRound(reloaded);
  assert.deepEqual(reloaded, before);
  assert(P.advanceRound(s));
  assert(!P.advanceRound(s));
  assert.equal(P.label(s), '1-2');
});
test('미리보기와 전투 능력치가 같고, 명단·적은 바뀌지 않는다(지운 증강 training·mana는 효과 없음)', () => {
  const before = clone(D.roster),
    s = state();
  s.augments = ['training', 'mana'];
  const item = P.addItem(s, 'I01');
  P.equip(s, item.uid, 1);
  const mods = P.allyModifiers(s);
  assert.deepEqual(mods.augmentIds, [], '지운 증강 ID는 전투에 넘기지 않음');
  assert.equal(mods.adMultiplier, undefined);
  assert.equal(mods.startManaFlat, undefined);
  const b = new Battle(
    s.units.map((u) => ({ ...u, bonuses: P.unitBonuses(s, u.uid) })),
    [{ id: 'C10', pos: 17 }],
    { allyModifiers: mods },
  );
  near(b.units[0].stats.AD, D.byId('C03').stats.AD + 12);
  assert.equal(b.units[0].mp, 0);
  const quick = new Battle(s.units, [{ id: 'C10', pos: 17 }], {
    quickMana: true,
    allyModifiers: mods,
  });
  assert.equal(quick.units[0].mp, 100);
  assert.deepEqual(D.roster, before);
  near(P.previewStats(s, s.units[0]).AD, b.units[0].stats.AD);
});
test('stage transitions across 6 stages; exactly three augment selections', () => {
  const s = state();
  let receipts = 0,
    supplies = 0,
    bosses = 0,
    choices = 0;
  while (s.stage <= 6) {
    if (s.roundPhase === 'augment') {
      const candidate = P.availableAugments(s)[0];
      assert(candidate);
      assert(P.chooseAugment(s, candidate.id));
      choices++;
    }
    const type = P.roundType(s.stage, s.round);
    if (type === 'SUPPLY') {
      supply(s, () => 0.1);
      supplies++;
    } else {
      combat(s);
      if (type === 'BOSS') bosses++;
    }
    receipts++;
    if (s.completionChoice === 'pending') assert(P.chooseCompletion(s, 'continue'));
    assert(P.advanceRound(s));
  }
  assert.equal(receipts, 30);
  assert.equal(supplies, 7);
  assert.equal(bosses, 6);
  assert.equal(choices, 3);
  assert.equal(P.label(s), '7-1');
  assert.equal(s.roundPhase, 'prepare');
  assert.equal(s.done, false);
  assert.equal(Object.keys(s.completedRounds).length, 30);
});
test('loss preserves units; HP0 stops progression and supply has no damage', () => {
  const s = at(1, 3),
    units = clone(s.units);
  s.health = 2;
  const r = combat(s, 'enemy');
  assert.equal(s.health, 0);
  assert(s.done);
  assert.equal(r.loss, 2);
  assert.deepEqual(s.units, units);
  assert(!P.advanceRound(s));
  assert(!P.chooseAugment(s, 'funds'));
});
