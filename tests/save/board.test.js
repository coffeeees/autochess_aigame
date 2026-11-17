// Migrated from the v0.15.18 suite test-board.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $board from '../../src/core/board.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  B = $board,
  D = $data,
  P = $progression,
  W = $encounters,
  V = $preparation,
  { Battle, distance } = $engine;
let count = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
test('legacy8column units and enemy cache preserve identities, rewards and gear without collisions', () => {
  const units = Array.from({ length: 11 }, (_, i) => ({
      uid: i + 1,
      id: D.playableIds[i],
      location: 'board',
      star: 1,
      pos: 32 + i,
    })),
    s = {
      version: 2,
      stage: 3,
      round: 5,
      wave: 15,
      level: 10,
      health: 73,
      gold: 49,
      xp: 0,
      units,
      inventory: [{ id: 'I28', uid: 'I1', equippedTo: 8 }],
      itemSequence: 1,
      augments: ['P12'],
      augmentSelections: {},
      completedRounds: { '3-4': { total: 7 } },
      roundPhase: 'prepare',
      shop: ['C03'],
      enemyEncounter: {
        key: '3-5',
        bonusAppeared: true,
        units: [
          { id: 'E99', pos: 23, star: 2, bonus: true },
          { id: 'E06', pos: 22, star: 3 },
          { id: 'E01', pos: 3, star: 1 },
        ],
      },
    };
  const before = clone(s);
  P.migrate(s);
  a.equal(s.boardColumns, 7);
  a.equal(s.gold, before.gold);
  a.equal(s.health, before.health);
  a.deepEqual(s.inventory, before.inventory);
  a.deepEqual(s.completedRounds, before.completedRounds);
  a.equal(s.units.length, 11);
  a.equal(new Set(s.units.map((u) => u.pos)).size, 11);
  a(s.units.every((u) => u.pos >= 28 && u.pos < 56));
  a.deepEqual(
    s.units.map((u) => [u.uid, u.id, u.star]),
    before.units.map((u) => [u.uid, u.id, u.star]),
  );
  a.equal(new Set(s.enemyEncounter.units.map((u) => u.pos)).size, 3);
  a(s.enemyEncounter.units.every((u) => u.pos >= 0 && u.pos < 28));
  a.equal(s.enemyEncounter.bonusAppeared, true);
  a.equal(s.enemyEncounter.units[0].id, 'E99');
  new Battle(s.units, s.enemyEncounter.units, { allyModifiers: P.allyModifiers(s) });
});
test('migration prioritizes surviving columns and moves removed last column to nearest vacancy', () => {
  const s = {
    units: [
      { uid: 1, location: 'board', pos: 39 },
      { uid: 2, location: 'board', pos: 38 },
      { uid: 3, location: 'board', pos: 63 },
    ],
  };
  B.migrate(s);
  a.equal(s.units[1].pos, 34);
  a.equal(s.units[0].pos, 33);
  a.equal(s.units[2].pos, 55);
  const before = clone(s);
  B.migrate(s);
  a.deepEqual(s, before);
});
test('cached bonus encounter remains identical on restore and never rerolls', () => {
  const s = P.initialize({ units: [], gold: 7, health: 100 });
  s.round = 3;
  const old = W.encounter(s, () => 0);
  const snap = clone(s.enemyEncounter);
  P.migrate(s);
  a.deepEqual(
    W.encounter(s, () => {
      throw Error('reroll');
    }),
    old,
  );
  a.deepEqual(s.enemyEncounter, snap);
});
test('legacy corner migrations are deterministic and source marker prevents second conversion', () => {
  for (let n = 1; n <= 11; n++) {
    const source = [38, 39, 46, 47, 54, 55, 62, 63, 32, 40, 48].slice(0, n),
      make = () => ({
        units: source.map((pos, i) => ({ uid: i + 1, location: 'board', pos })),
        enemyEncounter: { key: '1-4', units: [{ pos: 6 }, { pos: 7 }, { pos: 14 }, { pos: 15 }] },
      }),
      one = make(),
      two = make();
    B.migrate(one);
    B.migrate(two);
    a.deepEqual(one, two);
    a.equal(new Set(one.units.map((u) => u.pos)).size, n);
    const before = clone(one);
    B.migrate(one);
    a.deepEqual(one, before);
  }
});
