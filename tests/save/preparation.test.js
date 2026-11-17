// Migrated from the v0.15.18 suite test-preparation.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  D = $data,
  P = $progression,
  V = $preparation,
  { Battle } = $engine;
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
test('legacy duplicate deployment repaired without losing units or gear, even full bench', () => {
  const s = state();
  s.units[3].location = 'board';
  s.units[3].pos = 37;
  for (let i = 0; i < 11; i++)
    s.units.push({ uid: 6 + i, id: 'C04', star: 1, location: 'bench', pos: -1 });
  const item = P.addItem(s, 'sword');
  item.equippedTo = 4;
  const n = s.units.length;
  a.equal(V.repairDeployment(s), 1);
  a.equal(s.units.length, n);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 13);
  a.equal(item.equippedTo, 4);
  a.equal(V.repairDeployment(s), 0);
  a.equal(V.benchSlots(s), 13);
});
test('legacy12 reserve units and equipment survive, overflow compacts as units leave', () => {
  const s = P.initialize({
      health: 100,
      gold: 7,
      shop: [],
      units: Array.from({ length: 12 }, (_, i) => ({
        uid: i + 1,
        id: D.playableIds[i],
        star: 1,
        location: 'bench',
        pos: -1,
        benchSlot: i,
      })),
    }),
    item = P.addItem(s, 'I28');
  item.equippedTo = 12;
  V.normalize(s);
  a.equal(s.units.length, 12);
  a.equal(new Set(s.units.map((u) => u.benchSlot)).size, 12);
  a.equal(s.units.filter((u) => u.benchSlot >= 10).length, 2);
  a(V.moveUnit(s, 11, { location: 'board', pos: 31 }).ok);
  V.normalize(s);
  a.equal(s.units.filter((u) => u.location === 'bench' && u.benchSlot >= 10).length, 1);
  a(V.moveUnit(s, 12, { location: 'board', pos: 32 }).ok);
  V.normalize(s);
  a.equal(V.benchSlots(s), 10);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 10);
  a.equal(item.equippedTo, 12);
  a.equal(s.gold, 7);
});
