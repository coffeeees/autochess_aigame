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
// v0.17.0: 이전 버전(8열) 저장을 P.migrate로 이관하던 테스트는 이전 저장 삭제와 함께 지웠다.
// 아래 B.migrate 테스트는 전장 모듈의 열 변환 함수 자체를 확인한다.
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
