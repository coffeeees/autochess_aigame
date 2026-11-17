// Migrated from the v0.15.18 suite test-board.cjs (tests for: board).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  B = require('../../src/legacy/board'),
  D = require('../../src/legacy/data'),
  P = require('../../src/legacy/progression'),
  W = require('../../src/legacy/encounters'),
  V = require('../../src/legacy/preparation'),
  A = require('../../src/legacy/combat-visuals'),
  { Battle, distance } = require('../../src/legacy/engine');
let count = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
test('7columns8rows56cells, player lower28 cells and no wraparound neighbors', () => {
  a.equal(B.size(), 56);
  a.equal(B.playerStart(), 28);
  a.equal(D.prototypeConfig.board.columns, 7);
  a.equal(distance(6, 7), 7);
  a.equal(A.distance(34, 35), 7);
  a.deepEqual(A.point(55), { x: 6.5, y: 7.5 });
  const b = new Battle([{ id: 'C03', pos: 55 }], [{ id: 'E01', pos: 0 }]);
  a.deepEqual(b.neighbors(6), [13, 5]);
  a.deepEqual(b.neighbors(55), [48, 54]);
  a.throws(() => new Battle([{ id: 'C03', pos: 56 }], [{ id: 'E01', pos: 0 }]));
});
test('new states are stamped7columns and only ally positions28..55 accept placement', () => {
  const s = P.initialize({
    units: [{ uid: 1, id: 'C03', star: 1, location: 'bench', pos: -1 }],
    health: 100,
    gold: 7,
    shop: [],
  });
  a.equal(s.boardColumns, 7);
  for (const pos of [27, 56, 63, -1]) a(!V.moveUnit(s, 1, { location: 'board', pos }).ok);
  a(V.moveUnit(s, 1, { location: 'board', pos: 28 }).ok);
  a(V.moveUnit(s, 1, { location: 'board', pos: 55 }).ok);
});
test('item adjacency shield and chain lightning respect seventh-column edge', () => {
  const b = new Battle(
    [
      { id: 'C03', pos: 34, itemIds: ['I37', 'I26'] },
      { id: 'C05', pos: 35 },
    ],
    [
      { id: 'E01', pos: 13 },
      { id: 'E03', pos: 14 },
    ],
    { rng: () => 0 },
  );
  a.equal(b.units[0].shields.length, 1);
  a.equal(b.units[1].shields.length, 0);
  const [u, , first, other] = b.units;
  first.stats.DOD = 0;
  const before = other.hp;
  b.deal(u, first, 10, 'physical', { kind: 'basic', canCrit: false });
  a.equal(other.hp, before);
});
test('summoning and moving from edges never produce outside or overlapping actors', () => {
  const b = new Battle(
    [
      { id: 'C02', pos: 34 },
      { id: 'C11', pos: 55 },
      { id: 'C16', pos: 49 },
    ],
    [
      { id: 'E06', pos: 17 },
      { id: 'E01', pos: 0 },
    ],
    { rng: () => 0.9, quickMana: true },
  );
  for (let t = 0; t < 1400 && !b.result; t++) {
    b.tick();
    const live = b.alive();
    a(live.every((u) => u.pos >= 0 && u.pos < 56));
    a.equal(new Set(live.map((u) => u.pos)).size, live.length);
  }
  a(b.result);
  a(b.statsTotal.summons > 0);
});
