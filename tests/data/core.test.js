// Migrated from the v0.15.18 suite test-prototype.cjs (tests for: data).
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
test('45 roster / cost distribution / exact one of each attribute / all 16 bonds', () => {
  assert.equal(D.roster.length, 45);
  assert.equal(D.synergies.length, 16);
  assert.equal(D.playableIds.length, 45);
  assert.equal(Object.keys(D.skills).length, 45);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((c) => D.roster.filter((u) => u.cost === c).length),
    [12, 11, 10, 8, 4],
  );
  for (const u of D.roster) {
    assert.equal(u.bonds.length, 2);
    assert(u.bonds.every((name) => D.synergies.some((s) => s.name === name)));
    if (u.cost > 3) {
      assert(u.stats && u.name);
      assert.equal(D.skills[u.id].implemented, true);
      assert(u.playable);
    }
  }
});
test('all roster combinations exactly match the supplied document', () => {
  const fs = require('node:fs'),
    source = fs.readFileSync('./docs/specs/README_AUTCHESS_CODEX.md', 'utf8');
  const rows = [
    ...source.matchAll(/^\| (C\d{2}) \| ([1-5]) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm),
  ].map((m) => ({
    id: m[1],
    cost: Number(m[2]),
    race: m[3].trim(),
    job: m[4].trim(),
    trait: m[5].trim(),
  }));
  assert.equal(rows.length, 45);
  for (const r of rows) {
    const u = D.byId(r.id);
    for (const key of Object.keys(r)) assert.equal(u[key], r[key], `${r.id} ${key}`);
  }
});
test('all ten proposed stats for C01-C12 exactly match the source table', () => {
  const fs = require('node:fs'),
    source = fs.readFileSync('./docs/specs/README_AUTCHESS_CODEX.md', 'utf8');
  const lines = source.split('\n').filter((s) => /^\| C\d{2} \| [^|]+ \| \d{3} \|/.test(s));
  assert.equal(lines.length, 12);
  for (const line of lines) {
    const cols = line
        .split('|')
        .slice(1, -1)
        .map((s) => s.trim()),
      u = D.byId(cols[0]);
    assert(u.name.length > 0);
    D.statKeys.forEach(
      (key, i) => assert.equal(u.sourceStats[key], parseFloat(cols[i + 2]), u.id + ' ' + key), // 원본(반영본 전)
    );
  }
});
