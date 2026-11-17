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
test('enemy formations through all stages stay unique and inside7-column enemy area', () => {
  for (let stage = 1; stage <= 10; stage++)
    for (let round = 1; round <= 5; round++) {
      const s = P.initialize({ units: [], health: 100, gold: 7 });
      s.stage = stage;
      s.round = round;
      const units = W.encounter(s, () => 0.5);
      a.equal(new Set(units.map((u) => u.pos)).size, units.length);
      a(units.every((u) => u.pos >= 0 && u.pos < 28));
    }
});
