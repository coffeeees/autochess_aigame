// Migrated from the v0.15.18 suite test-v01517.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  fs = require('fs'),
  D = require('../../src/legacy/data'),
  B = require('../../src/legacy/bonds'),
  F = require('../../src/legacy/bond-effects'),
  { Battle, mitigatedDamage } = require('../../src/legacy/engine'),
  P = require('../../src/legacy/progression'),
  V = require('../../src/legacy/preparation');
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function setup(name, tier = 2) {
  const b = new Battle(
    [
      { id: 'C01', pos: 35 },
      { id: 'C03', pos: 36 },
    ],
    [
      { id: 'E01', pos: 28 },
      { id: 'E02', pos: 29 },
    ],
    { rng: () => 0.99 },
  );
  b.synergySnapshot.ally = [{ name, tier, threshold: tier * 2, members: ['C01'] }];
  b.synergySnapshot.enemy = [];
  F.init(b);
  return [b, ...b.units];
}
test('legacy recommendation migration drops invalid IDs only, preserves units/items/augments and three valid themes', () => {
  const s = P.initialize({
    health: 88,
    gold: 34,
    units: [{ uid: 1, id: 'C01', star: 2, location: 'bench', benchSlot: 0 }],
    shop: ['C03'],
  });
  P.addItem(s, 'I01');
  s.augments = ['G07'];
  s.recommendedBonds = ['언데드', '흑월', '철혈', '종언', '심연'];
  const before = JSON.stringify({ units: s.units, items: s.inventory, augments: s.augments });
  V.normalize(s);
  a.deepEqual(s.recommendedBonds, ['흑월', '철혈', '종언']);
  a.equal(JSON.stringify({ units: s.units, items: s.inventory, augments: s.augments }), before);
  a.deepEqual(V.recommendedFor(s, 'C01'), ['흑월', '종언']);
  a.deepEqual(P.recommendedMembers('철혈'), ['C03', 'C10', 'C22', 'C23', 'C36']);
});
