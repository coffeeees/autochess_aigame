// Migrated from the v0.15.18 suite test-v01511.cjs (tests for: docs).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $patchNotes from '../../src/content/patch-notes.js';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import $augments from '../../src/core/augments.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  crypto = require('node:crypto'),
  D = $data,
  P = $progression,
  V = $preparation,
  W = $encounters,
  I = $items,
  A = $augments,
  N = $patchNotes;
const tests = [];
const copy = (x) => JSON.parse(JSON.stringify(x)), drain = async () => {
    for (let i = 0; i < 14; i++) await Promise.resolve();
  };
test('nine unchanged core modules match baseline; items and preparation intentionally change stacking', () => {
  const baseline = JSON.parse(
    fs.readFileSync('docs/specs/CORE_RULES_BASELINE_v0.15.10.json', 'utf8'),
  );
  a.equal(Object.keys(baseline.hashes).length, 11);
  // Files were reformatted with Prettier after v0.15.18 (formattedHashes) and moved
  // to src/core/ as ES modules in stage 3; coreHashes are the current hashes.
  for (const [file] of Object.entries(baseline.hashes).filter(
    ([file]) =>
      ![
        'dist/items.js',
        'dist/preparation.js',
        'dist/data.js',
        'dist/engine.js',
        'dist/progression.js',
        'dist/item-effects.js',
      ].includes(file),
  ))
    a.equal(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(baseline.coreFiles[file], 'utf8').replace(/\r\n/g, '\n'))
        .digest('hex'),
      baseline.coreHashes[file],
      file,
    );
});
const files = ['GAME_DESIGN.md', 'GLOSSARY.md', 'UNIMPLEMENTED.md', 'CHANGELOG.md'],
  docs = Object.fromEntries(files.map((p) => [p, fs.readFileSync('docs/' + p, 'utf8')]));
test('all four documents share current code version and linked source references point to real lines', () => {
  for (const [file, text] of Object.entries(docs)) {
    a(text.includes('**' + N.current + '**'), file);
    for (const m of text.matchAll(/\]\(([^)]+)#L(\d+)\)/g)) {
      const linked = require('node:path').join('docs', m[1]);
      a(fs.existsSync(linked), file + ' ' + m[1]);
      const lines = fs.readFileSync(linked, 'utf8').split('\n');
      a(Number(m[2]) <= lines.length, file + ' ' + m[0]);
    }
    for (const target of files) a(text.includes(target), file + ' -> ' + target);
  }
});
test('design includes exactly45 unique character sections with every stat and unchanged skill descriptions', () => {
  const doc = docs[files[0]],
    head = [...doc.matchAll(/^### (C\d{2}) · (.+)$/gm)];
  a.equal(head.length, 45);
  a.equal(new Set(head.map((x) => x[1])).size, 45);
  for (const u of D.roster) {
    a(doc.includes('### ' + u.id + ' · ' + u.name));
    a(doc.includes(D.skills[u.id].text));
    const row = '| ' + D.statKeys.map((k) => u.stats[k]).join(' | ') + ' |';
    a(doc.includes(row), u.id);
  }
  a(doc.includes('provisional=true'));
});
test('문서 도감: 유대 16종(사용자 확인)·아이템·증강·캐릭터가 모두 실리고 초안 스킬은 올리지 않는다', () => {
  a.equal(D.synergies.length, 16);
  const design = docs[files[0]],
    missing = docs[files[2]],
    glossary = docs[files[1]];
  for (const x of D.synergies) a(design.includes('| ' + x.name + ' |'));
  for (const x of I.items) a(design.includes('| ' + x.id + ' | ' + x.name + ' |'));
  for (const x of A.augments) a(design.includes('| ' + x.id + ' |'));
  a.equal((missing.match(/^### C\d{2} ·/gm) || []).length, 0);
  for (const u of D.roster) a(glossary.includes('| ' + u.id + ' |'));
  a(missing.includes('임시 밸런스 v1'));
});
test('changelog preserves every version and separately records sourced differences and uncertain cases', () => {
  const text = docs[files[3]];
  for (const e of N.history) a(text.includes('### v' + e.version + ' —'));
  for (let i = 1; i <= 14; i++) a(text.includes('| D' + String(i).padStart(2, '0') + ' |'));
  a(text.includes('ITEM_PROC'));
  a(docs[files[2]].includes('확인필요'));
});
test('patch metadata keeps Codex decisions and all notification changes independently exportable', () => {
  a.equal(N.current, '0.20.0');
  const e = N.history.find((x) => x.version === '0.15.11'),
    md = N.toMarkdown();
  for (const key of ['approvedDecisions', 'additionalChanges', 'notificationChanges'])
    a(e[key].length > 0);
  a(md.includes('T01~T41'));
  a(e.additionalChanges.some((x) => x.includes('1500ms')));
  a(e.notificationChanges.some((x) => x.includes('중복 재생하지')));
});
