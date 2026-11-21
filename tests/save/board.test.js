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
// v0.18.0: 상하 대치(7열×8행) 저장을 좌우 대치(8열×7행)로 한 번 회전 이관한다(board.migrate)
test('7열 저장의 전장 아군·적 편성 칸을 시계 방향으로 한 번 회전하고, 다시 불러도 두 번 돌리지 않는다', () => {
  const s = {
    boardColumns: 7,
    units: [
      { uid: 1, location: 'board', pos: 28 }, // 예전 아군 전열 왼쪽 끝 → col 3, row 0
      { uid: 2, location: 'board', pos: 55 }, // 예전 아군 후열 오른쪽 끝 → col 0, row 6
      { uid: 3, location: 'bench', pos: -1, benchSlot: 0 },
    ],
    enemyEncounter: { key: '1-4', units: [{ pos: 17 }, { pos: 3 }] },
  };
  B.migrate(s);
  a.equal(s.boardColumns, 8);
  a.deepEqual(
    s.units.map((u) => u.pos),
    [3, 48, -1],
  );
  a.deepEqual(
    s.enemyEncounter.units.map((u) => u.pos),
    [29, 31],
  );
  const before = clone(s);
  B.migrate(s);
  a.deepEqual(s, before, '이미 8열이면 그대로');
  a.throws(() => B.migrate({ boardColumns: 9, units: [] }), /지원하지 않는/);
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
test('예전 아군 28칸·적 28칸 전부가 서로 다른 새 칸으로 가고 진영이 바뀌지 않는다', () => {
  const s = {
    boardColumns: 7,
    units: Array.from({ length: 28 }, (_, i) => ({ uid: i + 1, location: 'board', pos: 28 + i })),
    enemyEncounter: { key: '1-4', units: Array.from({ length: 28 }, (_, i) => ({ pos: i })) },
  };
  B.migrate(s);
  a.equal(new Set(s.units.map((u) => u.pos)).size, 28);
  a(s.units.every((u) => B.isAllyCell(u.pos)));
  a(s.enemyEncounter.units.every((u) => u.pos % 8 >= 4));
});
