// Migrated from the v0.15.18 suite test-prototype.cjs (tests for: board).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';

const assert = require('node:assert/strict'),
  D = $data,
  { Battle, mitigatedDamage, distance } = $engine;
$bondEffects.init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let passed = 0;
const near = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const basicBattle = (id = 'C01', enemy = 'C03') =>
  new Battle([{ id, pos: 27 }], [{ id: enemy, pos: 28 }], { rng: () => 0.99 });
test('only playable IDs allowed; duplicate cells and >10 deployment rejected', () => {
  assert.throws(() => basicBattle('C99'));
  assert.throws(() => new Battle([{ id: 'C01', pos: 15 }], [{ id: 'C02', pos: 15 }]));
  assert.throws(
    () =>
      new Battle(
        Array.from({ length: 11 }, (_, i) => ({
          id: 'C01',
          pos: (i % 7) * 8 + 3 - Math.floor(i / 7),
        })),
        [{ id: 'C03', pos: 7 }],
      ),
  );
});
