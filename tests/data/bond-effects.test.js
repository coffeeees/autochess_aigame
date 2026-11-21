// Migrated from the v0.15.18 suite test-v01517.cjs (tests for: data).
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
test('exact source assignments:45×2,16 themes,45 playable,historical33 four-tier subset and eight six tiers retained', () => {
  a.equal(
    D.roster.reduce((n, u) => n + u.bonds.length, 0),
    90,
  );
  a.equal(D.synergies.length, 16);
  a.equal(D.playableIds.length, 45);
  a(
    D.evaluateSynergies(D.playableIds.filter((id) => D.byId(id).cost <= 3)).every(
      (s) => s.threshold === 4,
    ),
  );
  a.equal(D.evaluateSynergies(D.roster).filter((s) => s.threshold === 6).length, 8);
  const source = fs.readFileSync('docs/specs/INTEGRATED_REQUEST_v0.15.17.md', 'utf8');
  for (const u of D.roster) {
    const line = source.split('\n').find((x) => x.startsWith('| ' + u.id + ' |'));
    a(line, u.id);
    const c = line
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean);
    a.deepEqual(u.bonds, c.slice(-2), u.id);
  }
});
