// Migrated from the v0.15.18 suite test-higher-drafts.cjs (tests for: data).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  D = require('../../src/legacy/data.js'),
  { Battle } = require('../../src/legacy/engine.js');
const baseline = JSON.parse(fs.readFileSync('docs/specs/onecost-baseline.json', 'utf8')),
  source = fs.readFileSync('docs/specs/AUTOCHESS_02.md', 'utf8');
let passed = 0;
test('existing C01-C12 data, skills, pool subset and old metadata unchanged; new bonds explicitly added', () => {
  assert.deepEqual(
    D.roster.filter((u) => u.cost === 1).map(({ bonds, ...u }) => u),
    baseline.roster.map((u) => ({ ...u, name: D.byId(u.id).name })),
  );
  assert.deepEqual(
    D.playableIds.filter((id) => D.byId(id).cost === 1),
    baseline.playableIds,
  );
  assert.equal(D.synergies.length, 16);
  for (const id of baseline.playableIds.filter((id) => id !== 'C07'))
    assert.deepEqual(D.skills[id], baseline.skills[id]);
});
test('new 33 names/classes/attributes and ten stats match original Markdown exactly', () => {
  const lines = source.split(/\r?\n/),
    header = lines.find((line) => line.startsWith('| ID | 코스트 | 이름 |')),
    keys = header
      .split('|')
      .slice(1, -1)
      .map((s) => s.trim()),
    rows = lines.filter((line) => /^\| C\d{2} \| [2-5] \|/.test(line));
  assert.equal(rows.length, 33);
  for (const line of rows) {
    const columns = line
        .split('|')
        .slice(1, -1)
        .map((s) => s.trim()),
      fields = Object.fromEntries(keys.map((key, i) => [key, columns[i]])),
      unit = D.byId(fields.ID);
    assert(unit.name.length > 0);
    assert.equal(unit.cost, Number(fields['코스트']));
    for (const [key, label] of [
      ['race', '종족'],
      ['job', '직업'],
      ['trait', '특성'],
    ])
      assert.equal(unit[key], fields[label]);
    for (const key of D.statKeys)
      assert.equal(unit.stats[key], parseFloat(fields[key]), unit.id + ' ' + key);
    assert(unit.provisional);
  }
});
test('all 33 skill names and descriptions registered verbatim, all higher costs activated', () => {
  const rows = source
    .split(/\r?\n/)
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((s) => s.trim()),
    )
    .filter((c) => /^C\d{2}$/.test(c[0]) && c.length === 4);
  assert.equal(rows.length, 33);
  assert.equal(Object.keys(D.skills).length, 45);
  for (const [id, name, skill, text] of rows) {
    assert(D.byId(id).name.length > 0);
    assert.equal(D.skills[id].name, skill);
    assert.equal(D.skills[id].text, text);
    assert.equal(D.skills[id].implemented, true);
    if (D.byId(id).cost > 3) assert.equal(D.skills[id].todo.length, 0);
  }
});
test('cost4+ entries now enter both battle constructors with preserved IDs', () => {
  assert.equal(D.roster.filter((u) => !u.playable).length, 0);
  for (const u of D.roster.filter((u) => u.cost > 3)) {
    assert(D.playableIds.includes(u.id));
    assert(new Battle([{ id: u.id, pos: 35 }], [{ id: 'C01', pos: 0 }]));
    assert(new Battle([{ id: 'C01', pos: 35 }], [{ id: u.id, pos: 0 }]));
  }
});
test('HP consumption metadata uses current HP for C17/C20/C37', () => {
  for (const id of ['C17', 'C20', 'C37']) assert.equal(D.skills[id].hpCostBasis, 'currentHP');
});
test('complete 45 roster has ten finite stats and unchanged cost distribution', () => {
  assert.equal(D.roster.length, 45);
  for (const u of D.roster)
    for (const key of D.statKeys) assert(Number.isFinite(u.stats[key]), u.id + ' ' + key);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((cost) => D.roster.filter((u) => u.cost === cost).length),
    [12, 11, 10, 8, 4],
  );
});
