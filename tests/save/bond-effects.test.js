// Migrated from the v0.15.18 suite test-v01517.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $bonds from '../../src/core/data/bonds.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('fs'),
  D = $data,
  B = $bonds,
  F = $bondEffects,
  { Battle, mitigatedDamage } = $engine,
  P = $progression,
  V = $preparation;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function setup(name, tier = 2) {
  const b = new Battle(
    [
      { id: 'C01', pos: 2 },
      { id: 'C03', pos: 10 },
    ],
    [
      { id: 'E01', pos: 3 },
      { id: 'E02', pos: 11 },
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
