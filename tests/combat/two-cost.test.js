// Migrated from the v0.15.18 suite test-two-cost.cjs (tests for: combat).
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
test('all11 two-cost units complete quickMana battles and use skills with bonds on/off', () => {
  for (const experimental of [false, true])
    for (const u of D.roster.filter((x) => x.cost === 2)) {
      const b = new Battle(
        [
          { id: u.id, pos: 31 },
          { id: 'C05', pos: 32 },
        ],
        [
          { id: 'E06', pos: 24 },
          { id: 'E01', pos: 3 },
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
