// Migrated from the v0.15.18 suite test-preparation.cjs (tests for: items).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  D = require('../../src/legacy/data.js'),
  P = require('../../src/legacy/progression.js'),
  V = require('../../src/legacy/preparation.js'),
  { Battle } = require('../../src/legacy/engine.js');
let count = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function state() {
  return V.normalize(
    P.initialize({
      health: 100,
      gold: 12,
      units: [
        { uid: 1, id: 'C03', star: 1, location: 'board', pos: 38 },
        { uid: 2, id: 'C05', star: 1, location: 'board', pos: 53 },
        { uid: 3, id: 'C01', star: 1, location: 'board', pos: 52 },
        { uid: 4, id: 'C03', star: 1, location: 'bench', pos: -1 },
        { uid: 5, id: 'C02', star: 1, location: 'bench', pos: -1 },
      ],
      shop: ['C03', 'C05', 'C01', 'C02', 'C04'],
    }),
  );
}
test('three equipment slots apply all stats; fourth and duplicate type blocked', () => {
  const s = state();
  for (const id of ['sword', 'armor', 'crystal']) {
    const item = P.addItem(s, id);
    a(P.equip(s, item.uid, 1));
  }
  a.equal(s.inventory.filter((i) => i.equippedTo === 1).length, 3);
  a.deepEqual(P.unitBonuses(s, 1), { AD: 10, GD: 10, AP: 10 });
  const fourth = P.addItem(s, 'sword');
  a(!P.equip(s, fourth.uid, 1));
  a(!V.transferItem(s, fourth.uid, 1).ok);
  const stats = P.previewStats(s, s.units[0]);
  for (const k of ['AD', 'GD', 'AP']) a.equal(stats[k], D.byId('C03').stats[k] + 10);
  a(V.transferItem(s, s.inventory[0].uid, 2).ok);
  a.equal(P.previewStats(s, s.units[0]).AD, D.byId('C03').stats.AD);
  a.equal(P.previewStats(s, s.units[1]).AD, D.byId('C05').stats.AD + 10);
  a(V.transferItem(s, s.inventory[0].uid, 2).ok);
});
test('equipment transfer failure atomic, return to storage, phase guards preserved', () => {
  const s = state(),
    first = P.addItem(s, 'I26'),
    second = P.addItem(s, 'I26');
  P.equip(s, first.uid, 1);
  P.equip(s, second.uid, 2);
  a(V.transferItem(s, first.uid, 2).ok);
  const third = P.addItem(s, 'I26');
  a(P.equip(s, third.uid, 2));
  const fourth = P.addItem(s, 'I26');
  const before = clone(s);
  a(!V.transferItem(s, fourth.uid, 2).ok);
  a.deepEqual(s, before);
  s.roundPhase = 'combat';
  a(!V.transferItem(s, first.uid, 3).ok);
  a(!P.unequip(s, first.uid));
  s.roundPhase = 'prepare';
  a(P.unequip(s, first.uid));
  a.equal(first.equippedTo, null);
  a.equal(s.gold, 12);
});
