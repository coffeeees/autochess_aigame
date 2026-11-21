// Migrated from the v0.15.18 suite test-preparation.cjs (tests for: combat).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  D = $data,
  P = $progression,
  V = $preparation,
  { Battle } = $engine;
let count = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function state() {
  return V.normalize(
    P.initialize({
      health: 100,
      gold: 12,
      units: [
        { uid: 1, id: 'C03', star: 1, location: 'board', pos: 26 },
        { uid: 2, id: 'C05', star: 1, location: 'board', pos: 32 },
        { uid: 3, id: 'C01', star: 1, location: 'board', pos: 24 },
        { uid: 4, id: 'C03', star: 1, location: 'bench', pos: -1 },
        { uid: 5, id: 'C02', star: 1, location: 'bench', pos: -1 },
      ],
      shop: ['C03', 'C05', 'C01', 'C02', 'C04'],
    }),
  );
}
test('damage aggregation includes dead summons, excludes enemies and zero allies retained', () => {
  const b = new Battle(
    [
      { id: 'C02', uid: 1, pos: 26 },
      { id: 'C05', uid: 2, pos: 32 },
    ],
    [{ id: 'E01', pos: 31 }],
    { rng: () => 0.99 },
  );
  const pet = b.summon(b.units[0], 'plague');
  b.units[0].damageDone = 100;
  b.units[2].damageDone = 900;
  pet.damageDone = 250;
  pet.dead = true;
  const rows = V.damageRows(b);
  a.equal(rows.length, 2);
  a.equal(rows[0].id, 'C02');
  a.equal(rows[0].damage, 350);
  a.equal(rows[1].damage, 0);
  a.equal(
    rows.reduce((n, r) => n + r.damage, 0),
    350,
  );
});
test('actual battle damage conserved in report and survives settlement/reload without mutating receipt', () => {
  const b = new Battle(
    [
      { id: 'C02', uid: 1, pos: 26 },
      { id: 'C05', uid: 2, pos: 32 },
    ],
    [{ id: 'E01', pos: 31 }],
    { quickMana: true, rng: () => 0.99 },
  );
  while (!b.result) b.tick();
  const rows = V.damageRows(b);
  a(
    Math.abs(
      rows.reduce((sum, r) => sum + r.damage, 0) -
        b.units.filter((u) => u.team === 'ally').reduce((sum, u) => sum + u.damageDone, 0),
    ) < 1e-6,
  );
  const s = state();
  s.round = 3;
  s.roundPhase = 'combat';
  const r = P.settleRound(s, { winner: 'ally', damageRows: rows });
  a.deepEqual(r.damageRows, rows);
  rows[0].damage = 999999;
  a.notEqual(r.damageRows[0].damage, 999999);
  a.deepEqual(clone(s).lastResult.damageRows, r.damageRows);
});
