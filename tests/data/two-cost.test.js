// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: data).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  D = require('../../src/legacy/data.js'),
  P = require('../../src/legacy/progression.js'),
  V = require('../../src/legacy/preparation.js'),
  W = require('../../src/legacy/encounters.js'),
  { Battle, mitigatedDamage, distance } = require('../../src/legacy/engine.js');
let n = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`);
function battle(id, allies = []) {
  return new Battle(
    [{ id, pos: 31 }, ...allies],
    [
      { id: 'E06', pos: 24 },
      { id: 'E03', pos: 23 },
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
