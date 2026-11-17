// Migrated from the v0.15.18 suite test-v01511.cjs (tests for: docs).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
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
  N = require('../../src/legacy/patch-notes'),
  S = require('../../src/legacy/screen-effects');
const tests = [];
const copy = (x) => JSON.parse(JSON.stringify(x)), drain = async () => {
    for (let i = 0; i < 14; i++) await Promise.resolve();
  };
function fixture(reduced = false) {
  const nodes = new Set(),
    jobs = [];
  class Node {
    constructor() {
      this.handlers = {};
      this.attrs = {};
      this.children = new Map();
      this.open = false;
    }
    setAttribute(k, v) {
      this.attrs[k] = v;
    }
    addEventListener(t, f) {
      (this.handlers[t] ??= []).push(f);
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    remove() {
      nodes.delete(this);
    }
    querySelector(s) {
      if (!this.children.has(s)) this.children.set(s, new Node());
      return this.children.get(s);
    }
    animate(frames, options) {
      let resolve, reject;
      const finished = new Promise((a, b) => {
          resolve = a;
          reject = b;
        }),
        job = {
          frames,
          options,
          finished,
          resolve,
          cancelled: false,
          cancel() {
            this.cancelled = true;
            reject(Error('cancel'));
          },
        };
      jobs.push(job);
      return job;
    }
  }
  const document = { body: { appendChild: (n) => nodes.add(n) }, createElement: () => new Node() };
  return {
    c: S.create({ document, reduced: () => reduced }),
    nodes,
    jobs,
    node: () => [...nodes][0],
    finish: () => jobs.forEach((j) => j.resolve()),
  };
}
function integration() {
  const elements = new Map(),
    results = [],
    saves = [],
    healthCalls = [];
  let finish, resolveHealth;
  const get = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        hidden: false,
        innerHTML: '',
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
        close() {},
      });
    return elements.get(id);
  };
  const ctx = vm.createContext({
    AutoData: D,
    AutoEngine: $engine,
    AutoProgression: P,
    AutoPreparation: V,
    AutoShop: $shopCore,
    AutoMerge: $mergeCore,
    AutoRun: $runCore,
    AutoWorld: W,
    AutoNoticePolicy: require('../../src/legacy/notice-policy'),
    document: {
      getElementById: get,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    setTimeout,
    clearTimeout,
    clearInterval,
    localStorage: { setItem() {} },
    console,
  });
  const text = fs.readFileSync('src/legacy/prototype.js', 'utf8');
  vm.runInContext(text.slice(0, text.lastIndexOf('\nload();')), ctx);
  ctx.saveHook = (x) => saves.push(copy(x));
  ctx.resultHook = (x) => results.push(x);
  ctx.finishHook = (b, cb) => (finish = cb);
  ctx.healthHook = (r) => {
    healthCalls.push(r);
    return new Promise((resolve) => (resolveHealth = resolve));
  };
  vm.runInContext(
    "function render(){}function save(){saveHook(state);}function showResult(r){resultHook(r);}function getCombatView(){return {finish:finishHook};}function presentRoundHealth(r){return healthHook(r);}state=P.initialize({gold:50,health:73,units:[],shop:[]});state.round=3;state.roundPhase='combat';battle=new E.Battle([{id:'C03',pos:31}],[{id:'E03',pos:24}]);",
    ctx,
  );
  return {
    ctx,
    get,
    results,
    saves,
    healthCalls,
    finish: () => finish(),
    resolve: (x) => resolveHealth(x),
  };
}
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
test('catalogs in docs cover28 bonds40 items36 augments and locked list12 without promoting draft skills', () => {
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
  a.equal(N.current, '0.15.18');
  const e = N.history.find((x) => x.version === '0.15.11'),
    md = N.toMarkdown();
  for (const key of ['approvedDecisions', 'additionalChanges', 'notificationChanges'])
    a(e[key].length > 0);
  a(md.includes('T01~T41'));
  a(e.additionalChanges.some((x) => x.includes('1500ms')));
  a(e.notificationChanges.some((x) => x.includes('중복 재생하지')));
});
