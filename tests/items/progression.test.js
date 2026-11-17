// Migrated from the v0.15.18 suite test-progression.cjs (tests for: items).
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
test('items equip, slot limit, free unequip, and actual AD/AP/GD stats', () => {
  for (const [id, stat] of [
    ['sword', 'AD'],
    ['armor', 'GD'],
    ['crystal', 'AP'],
  ]) {
    const s = state(),
      item = P.addItem(s, id),
      base = D.byId('C03').stats[stat];
    assert(P.equip(s, item.uid, 1));
    assert.equal(P.previewStats(s, s.units[0])[stat], base + 10);
    const other = P.addItem(s, 'I26');
    assert(P.equip(s, other.uid, 2));
    const b = new Battle(
      s.units.map((u) => ({ ...u, bonuses: P.unitBonuses(s, u.uid) })),
      [{ id: 'C10', pos: 17 }],
      { allyModifiers: P.allyModifiers(s) },
    );
    assert.equal(b.units[0].stats[stat], base + 10);
    assert(P.unequip(s, item.uid));
    assert.equal(s.gold, 12);
    assert.equal(P.previewStats(s, s.units[0])[stat], base);
  }
});
test('sell/merge release items; unknown or mid-combat equip is rejected', () => {
  const s = state(),
    i = P.addItem(s, 'armor');
  assert(!P.equip(s, i.uid, 999));
  assert(P.equip(s, i.uid, 1));
  P.releaseEquipment(s, [1]);
  assert.equal(i.equippedTo, null);
  s.roundPhase = 'combat';
  assert(!P.equip(s, i.uid, 1));
  s.roundPhase = 'prepare';
  assert(P.equip(s, i.uid, 1));
  s.roundPhase = 'combat';
  assert(!P.unequip(s, i.uid));
});
