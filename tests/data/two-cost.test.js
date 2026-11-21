// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: data).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  D = $data,
  P = $progression,
  V = $preparation,
  W = $encounters,
  { Battle, mitigatedDamage, distance } = $engine;
let n = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`);
function battle(id, allies = []) {
  return new Battle(
    [{ id, pos: 27 }, ...allies],
    [
      { id: 'E06', pos: 28 },
      { id: 'E03', pos: 20 },
    ],
    { rng: () => 0.99 },
  );
}
function cast(id) {
  const b = battle(id);
  b.cast(b.units[0], b.units[1]);
  return b;
}
function state(level) {
  return V.normalize(
    Object.assign(P.initialize({ health: 100, gold: 50, units: [], shop: [] }), { level }),
  );
}
test('45 playable, exact cost colors; original 12 stats/skills unchanged covered by baseline', () => {
  a.equal(D.playableIds.length, 45);
  a.equal(D.roster.filter((x) => x.cost === 2 && x.playable).length, 11);
  a.deepEqual(Object.keys(D.costColors), ['1', '2', '3', '4', '5']);
  for (const id of D.playableIds.filter((id) => D.byId(id).cost === 2))
    a.equal(D.skills[id].implemented, true);
});
