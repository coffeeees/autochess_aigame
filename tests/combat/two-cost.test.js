// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: combat).
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
test('all11 two-cost units complete quickMana battles and use skills with bonds on/off', () => {
  for (const experimental of [false, true])
    for (const u of D.roster.filter((x) => x.cost === 2)) {
      const b = new Battle(
        [
          { id: u.id, pos: 27 },
          { id: 'C05', pos: 35 },
        ],
        [
          { id: 'E06', pos: 28 },
          { id: 'E01', pos: 31 },
        ],
        { quickMana: true, experimental, rng: () => 0.99 },
      );
      for (let i = 0; i < 2000 && !b.result; i++) b.tick();
      a(b.result, u.id);
      a(b.skillUses[u.id] > 0, u.id);
      const positions = b.alive().map((x) => x.pos);
      a.equal(new Set(positions).size, positions.length);
    }
});
