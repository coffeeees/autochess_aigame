// Migrated from the v0.15.18 suite test-v01515.cjs (tests for: items).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $combatClock from '../../src/core/combat/clock.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';
import { allows } from '../../src/ui/notices.ts';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { StepClock } = $combatClock,
  { Battle } = $engine,
  P = $progression,
  V = $preparation;
test('duplicateT3 three-slot limit, migration and bonuses survive round-trip; T24 disabled', () => {
  const s = P.initialize({
    units: [{ uid: 1, id: 'C01', star: 1, location: 'board', pos: 31 }],
    health: 100,
    gold: 7,
    shop: [],
  });
  for (let i = 0; i < 3; i++) a(V.transferItem(s, P.addItem(s, 'I28').uid, 1).ok);
  a(!V.transferItem(s, P.addItem(s, 'I28').uid, 1).ok);
  const copy = V.normalize(P.migrate(JSON.parse(JSON.stringify(s))));
  a.equal(copy.inventory.filter((i) => i.equippedTo === 1).length, 3);
  a.deepEqual(P.unitBonuses(copy, 1), P.unitBonuses(s, 1));
  a.equal(allows('T24'), false);
});
