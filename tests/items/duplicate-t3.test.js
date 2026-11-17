// Migrated from the v0.15.18 suite test-v01515.cjs (tests for: items).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { StepClock } = require('../../src/legacy/combat-clock'),
  { Battle } = require('../../src/legacy/engine'),
  P = require('../../src/legacy/progression'),
  V = require('../../src/legacy/preparation');
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
  a.equal(require('../../src/legacy/notice-policy').allows('T24'), false);
});
