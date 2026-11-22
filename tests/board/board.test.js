// Migrated from the v0.15.18 suite test-board.cjs (tests for: board).
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
// v0.18.0: 좌우 대치 전장 8열 × 7행(pos = row × 8 + col), 아군 왼쪽 4열
test('8열×7행 56칸, 아군 왼쪽 28칸(col 0~3), 가장자리에서 이웃이 다음 줄로 넘어가지 않는다', () => {
  a.equal(B.size(), 56);
  a.equal(D.prototypeConfig.board.columns, 8);
  a.equal(D.prototypeConfig.board.rows, 7);
  a.equal(Array.from({ length: 56 }, (_, p) => p).filter(B.isAllyCell).length, 28);
  a.equal(distance(7, 8), 8);
  a.equal(distance(31, 32), 8);
  a.deepEqual(B.point(55), { x: 7.5, y: 6.5 });
  a.deepEqual([B.depth(3), B.depth(0), B.depth(4, 'enemy'), B.depth(7, 'enemy')], [3, 0, 3, 0]);
  const b = new Battle([{ id: 'C03', pos: 48 }], [{ id: 'E01', pos: 7 }]);
  a.deepEqual(b.neighbors(7), [6, 15], '오른쪽 끝: 다음 줄 첫 칸으로 넘어가지 않음');
  a.deepEqual(b.neighbors(55), [54, 47]);
  a.deepEqual(b.neighbors(8), [9, 0, 16], '왼쪽 끝');
  a.throws(() => new Battle([{ id: 'C03', pos: 56 }], [{ id: 'E01', pos: 7 }]));
});
test('예전 칸 번호 회전: newRow = oldCol, newCol = 7 − oldRow(되돌리기 포함)', () => {
  // 예전 아래 4행(아군 28..55) → 왼쪽 4열, 예전 위 4행(적 0..27) → 오른쪽 4열
  for (let old = 0; old < 56; old++) {
    const pos = B.rotateOldPos(old);
    a.equal(B.unrotatePos(pos), old);
    a.equal(B.isAllyCell(pos), old >= 28, String(old));
  }
  a.deepEqual([0, 6, 49, 55].map(B.rotateOldPos), [7, 55, 0, 48]);
  a.equal(B.rotateOldPos(28), 3, '예전 아군 첫 줄(전열) → col 3');
});
test('새 원정은 8열로 표시하고, 아군은 왼쪽 4열에만 배치할 수 있다', () => {
  const s = P.initialize({
    units: [{ uid: 1, id: 'C03', star: 1, location: 'bench', pos: -1 }],
    health: 100,
    gold: 7,
    shop: [],
  });
  a.equal(s.boardColumns, 8);
  for (const pos of [4, 7, 12, 55, 56, -1])
    a.deepEqual(V.moveUnit(s, 1, { location: 'board', pos }).ok, false, String(pos));
  a.equal(
    V.moveUnit(s, 1, { location: 'board', pos: 4 }).message,
    '아군 진영 왼쪽 4열에만 배치할 수 있습니다.',
  );
  for (const pos of [0, 3, 51]) a(V.moveUnit(s, 1, { location: 'board', pos }).ok, String(pos));
});
// v0.20.0: 예전 장비(I37 인접 보호막·I26 연쇄 번개) 경계 테스트는 장비를 지우며 함께 지웠다(새 장비에는 인접·연쇄 효과 없음)
test('summoning and moving from edges never produce outside or overlapping actors', () => {
  const b = new Battle(
    [
      { id: 'C02', pos: 51 },
      { id: 'C11', pos: 48 },
      { id: 'C16', pos: 0 },
    ],
    [
      { id: 'E06', pos: 29 },
      { id: 'E01', pos: 7 },
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
