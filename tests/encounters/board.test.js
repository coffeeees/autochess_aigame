// Migrated from the v0.15.18 suite test-board.cjs (tests for: encounters).
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
