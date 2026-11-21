// Migrated from the v0.15.18 suite test-board.cjs (tests for: encounters).
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
test('적 편성은 모든 스테이지에서 칸이 겹치지 않고 오른쪽 적 진영(col 4~7) 안에 있다(v0.18.0)', () => {
  for (let stage = 1; stage <= 10; stage++)
    for (let round = 1; round <= 5; round++) {
      const s = P.initialize({ units: [], health: 100, gold: 7 });
      s.stage = stage;
      s.round = round;
      const units = W.encounter(s, () => 0.5);
      a.equal(new Set(units.map((u) => u.pos)).size, units.length);
      a(units.every((u) => u.pos >= 0 && u.pos < 56 && u.pos % 8 >= 4));
    }
});
