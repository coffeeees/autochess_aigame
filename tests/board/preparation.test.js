// Migrated from the v0.15.18 suite test-preparation.cjs (tests for: board).
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
test('board move, same-cell and swaps preserve UID and equipment', () => {
  const s = state(),
    item = P.addItem(s, 'armor');
  P.equip(s, item.uid, 1);
  a(V.moveUnit(s, 1, { location: 'board', pos: 37 }).ok);
  a.equal(s.units[0].pos, 37);
  a(V.moveUnit(s, 1, { location: 'board', pos: 37 }).ok);
  a(V.moveUnit(s, 1, { location: 'board', pos: 53 }).ok);
  a.equal(s.units[0].pos, 53);
  a.equal(s.units[1].pos, 37);
  a.equal(item.equippedTo, 1);
});
test('duplicate character rejected independent of star and without mutation', () => {
  const s = state();
  s.level = 10;
  s.units[3].star = 2;
  const before = clone(s);
  a(!V.moveUnit(s, 4, { location: 'board', pos: 37 }).ok);
  a.deepEqual(s, before);
  a(!V.moveUnit(s, 4, { location: 'board', pos: 53 }).ok);
  a.deepEqual(s, before);
});
test('same-ID replacement of existing character is legal; different ID swap too', () => {
  const s = state();
  a(V.moveUnit(s, 4, { location: 'board', pos: 38 }).ok);
  a.equal(s.units[0].location, 'bench');
  a.equal(s.units[3].location, 'board');
  a(V.moveUnit(s, 5, { location: 'board', pos: 53 }).ok);
  a.equal(s.units[1].location, 'bench');
  a.equal(s.units[4].pos, 53);
});
test('capacity restriction allows replacements and bench transfer frees capacity', () => {
  const s = state();
  a(!V.moveUnit(s, 5, { location: 'board', pos: 37 }).ok);
  a(V.moveUnit(s, 1, { location: 'bench', slot: 4 }).ok);
  a.equal(s.units[0].benchSlot, 4);
  a(V.moveUnit(s, 5, { location: 'board', pos: 37 }).ok);
  a.equal(s.units[4].pos, 37);
});
test('bench-to-bench swaps exact slots; full bench board transfer cannot add unit', () => {
  const s = state();
  a(V.moveUnit(s, 4, { location: 'bench', slot: 1 }).ok);
  a.equal(s.units[3].benchSlot, 1);
  a.equal(s.units[4].benchSlot, 0);
  for (let i = 0; i < 10; i++)
    s.units.push({ uid: 6 + i, id: 'C04', star: 1, location: 'bench', pos: -1 });
  V.normalize(s);
  a(V.moveUnit(s, 1, { location: 'bench', slot: 0 }).ok);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 12);
});
test('enemy positions, missing targets, invalid slots and nonprepare moves fail atomically', () => {
  for (const target of [
    { location: 'board', pos: 3 },
    { location: 'board', pos: 56 },
    { location: 'bench', slot: 99 },
    null,
  ]) {
    const s = state(),
      before = clone(s);
    a(!V.moveUnit(s, 1, target).ok);
    a.deepEqual(s, before);
  }
  for (const phase of ['combat', 'result', 'augment', 'gameover']) {
    const s = state();
    s.roundPhase = phase;
    const before = clone(s);
    a(!V.moveUnit(s, 1, { location: 'board', pos: 37 }).ok);
    a.deepEqual(s, before);
  }
});
test('engine rejects repeated allied IDs while independent enemy repeats remain valid', () => {
  a.throws(
    () =>
      new Battle(
        [
          { id: 'C03', pos: 35 },
          { id: 'C03', pos: 36 },
        ],
        [{ id: 'E01', pos: 3 }],
      ),
  );
  new Battle(
    [{ id: 'C03', pos: 35 }],
    [
      { id: 'E01', pos: 3 },
      { id: 'E01', pos: 4 },
    ],
  );
});
test('ten-slot reserve fills at10, rejects11th slot and keeps same-slot replacement legal', () => {
  const s = P.initialize({
    health: 100,
    gold: 7,
    shop: [],
    units: Array.from({ length: 10 }, (_, i) => ({
      uid: i + 1,
      id: D.playableIds[i],
      star: 1,
      location: 'bench',
      pos: -1,
      benchSlot: i,
    })),
  });
  s.units.push({ uid: 11, id: 'C15', star: 1, location: 'board', pos: 31 });
  a.equal(D.prototypeConfig.board.benchSize, 10);
  a.equal(V.benchSlots(s), 10);
  a(!V.moveUnit(s, 11, { location: 'bench', slot: 10 }).ok);
  a(V.moveUnit(s, 11, { location: 'bench', slot: 0 }).ok);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 10);
});
