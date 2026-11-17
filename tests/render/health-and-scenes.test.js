// Migrated from the v0.15.18 suite test-v01511.cjs (tests for: render).
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
const copy = (x) => JSON.parse(JSON.stringify(x)),
  drain = async () => {
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
test('health model reads settled before/after values without mutating receipt', () => {
  const r = { healthBefore: 73, health: 75, healing: 2, win: true },
    before = copy(r);
  a.deepEqual(S.healthModel(r), { before: 73, after: 75, delta: 2, win: true });
  a.deepEqual(r, before);
});
test('loss/zero/maxHP and legacy receipts display actual deltas without inventing healing', () => {
  a.deepEqual(S.healthModel({ healthBefore: 96, health: 6, loss: 90, win: false }), {
    before: 96,
    after: 6,
    delta: -90,
    win: false,
  });
  a.equal(S.healthModel({ healthBefore: 100, health: 100, win: true }).delta, 0);
  a.equal(S.healthModel({ health: 0, loss: 6 }).before, 6);
  a.equal(S.healthModel({ health: 100, healing: 1, win: true }).before, 99);
  a(
    S.healthMarkup(S.healthModel({ healthBefore: 100, health: 100, win: true })).includes(
      '현재 체력 100',
    ),
  );
});
test('health scene shows only heart and current health without card labels or meter', () => {
  const html = S.healthMarkup(S.healthModel({ healthBefore: 96, health: 6, win: false }));
  for (const x of ['heart-empty', 'heart-outline', '현재 체력 6', 'height="89"'])
    a(html.includes(x), x);
  for (const x of ['scene-hp-track', '전투 전', '정산 후', '-90', '/ 100', '<p>'])
    a(!html.includes(x), x);
});
test('heart animates73to75; final result resolves after root', async () => {
  const f = fixture(),
    p = f.c.health({ healthBefore: 73, health: 75, win: true });
  a.equal(f.nodes.size, 1);
  a.equal(f.c.active, 'health');
  a.equal(f.jobs[0].options.duration, 1500);
  a.equal(f.jobs[1].options.duration, 900);
  a.equal(f.jobs[1].frames[0].transform, 'scaleY(0.73)');
  a.equal(f.jobs[1].frames[1].transform, 'scaleY(0.75)');
  a.equal(f.jobs.length, 2);
  let finished = false;
  p.then(() => (finished = true));
  f.jobs.slice(1).forEach((j) => j.resolve());
  await drain();
  a.equal(f.node().attrs['data-fill-complete'], 'true');
  a.equal(finished, false);
  f.jobs[0].resolve();
  a.equal(await p, true);
  a.equal(f.nodes.size, 0);
  a.equal(f.c.active, null);
});
test('loss track really empties96to6 and zeroHP has an empty final fill', async () => {
  for (const after of [6, 0]) {
    const f = fixture(),
      p = f.c.health({ healthBefore: 96, health: after, win: false });
    a.equal(f.jobs[1].frames[0].transform, 'scaleY(0.96)');
    a.equal(f.jobs[1].frames[1].transform, 'scaleY(' + after / 100 + ')');
    f.finish();
    a.equal(await p, true);
  }
});
test('reduced health is short fade with immediate fill and same state model', async () => {
  const f = fixture(true),
    r = { healthBefore: 75, health: 100, win: true },
    before = copy(r),
    p = f.c.health(r);
  a.equal(f.jobs[0].options.duration, 500);
  a.equal(f.jobs[1].options.duration, 1);
  a.equal(f.jobs[1].options.delay, 0);
  a(!JSON.stringify(f.jobs[0].frames).includes('translate'));
  f.finish();
  a.equal(await p, true);
  a.deepEqual(r, before);
});
test('round overlay replaces small banner with exactly one full dialog and ROUND N plus node', async () => {
  const f = fixture(),
    p = f.c.round({ stage: 7, round: 1, type: 'BATTLE' });
  a(f.node().className.includes('round-cover'));
  a(f.node().innerHTML.includes('ROUND 7'));
  a(f.node().innerHTML.includes('7-1'));
  a.equal(f.nodes.size, 1);
  a.equal(f.jobs[0].options.duration, 2200);
  f.finish();
  a.equal(await p, true);
});
test('reduced full transition lasts600ms and contains no moving title track', async () => {
  const f = fixture(true),
    p = f.c.round({ stage: 2, round: 3, type: 'SUPPLY' });
  a.equal(f.jobs.length, 1);
  a.equal(f.jobs[0].options.duration, 600);
  a(f.node().innerHTML.includes('보급'));
  f.finish();
  a.equal(await p, true);
});
test('native scene blocks Escape/outside events until cleanup without gameplay callback', async () => {
  const f = fixture(),
    p = f.c.health({ healthBefore: 80, health: 50 });
  let prevented = 0,
    stopped = 0;
  for (const h of f.node().handlers.cancel) h({ preventDefault: () => prevented++ });
  for (const t of ['click', 'pointerdown', 'pointerup'])
    for (const h of f.node().handlers[t]) h({ stopPropagation: () => stopped++ });
  a.equal(prevented, 1);
  a.equal(stopped, 3);
  a.equal(f.node().open, true);
  f.c.cancel();
  a.equal(await p, false);
  a.equal(f.nodes.size, 0);
});
test('scene cancellation rejects visual completion and stale animations never reopen or resolve true', async () => {
  const f = fixture(),
    p = f.c.health({ healthBefore: 100, health: 0 });
  f.c.cancel();
  a.equal(await p, false);
  a(f.jobs.every((j) => j.cancelled));
  f.finish();
  await drain();
  a.equal(f.nodes.size, 0);
  a.equal(f.c.active, null);
});
test('reentry and scoped cancellation cannot remove an unrelated scene or leave stale nodes', async () => {
  const f = fixture(),
    old = f.c.round({ stage: 1, round: 2 }),
    next = f.c.health({ healthBefore: 90, health: 92 });
  a.equal(await old, false);
  a.equal(f.nodes.size, 1);
  f.c.cancel('round');
  a.equal(f.c.active, 'health');
  f.finish();
  a.equal(await next, true);
  a.equal(f.nodes.size, 0);
});
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
test('actual endBattle saves settlement immediately but opens result only after health presentation', async () => {
  const f = integration();
  vm.runInContext("endBattle({winner:'ally',time:1})", f.ctx);
  a.equal(vm.runInContext('state.health', f.ctx), 75);
  a.equal(vm.runInContext('state.gold', f.ctx), 59);
  a.equal(f.saves.length, 1);
  a.equal(f.results.length, 0);
  f.finish();
  a.equal(f.healthCalls.length, 1);
  a.equal(f.results.length, 0);
  f.resolve(true);
  await drain();
  a.equal(f.results.length, 1);
  vm.runInContext("endBattle({winner:'ally',time:1})", f.ctx);
  a.equal(f.saves.length, 1);
  a.equal(f.results.length, 1);
});
test('cancelled health display leaves paid rewards and result phase intact without duplicate popup', async () => {
  const f = integration();
  vm.runInContext("endBattle({winner:'ally',time:1})", f.ctx);
  f.finish();
  f.resolve(false);
  await drain();
  a.equal(f.results.length, 0);
  a.equal(vm.runInContext('state.roundPhase', f.ctx), 'result');
  a.equal(vm.runInContext('state.health', f.ctx), 75);
  a.equal(f.saves.length, 1);
});
test('hidden or replaced run prevents stale result after a successful visual completion', async () => {
  for (const mode of ['hidden', 'reset']) {
    const f = integration();
    vm.runInContext("endBattle({winner:'ally',time:1})", f.ctx);
    f.finish();
    if (mode === 'hidden') f.get('gameView').hidden = true;
    else vm.runInContext('state=P.initialize({gold:7,health:100,units:[],shop:[]});', f.ctx);
    f.resolve(true);
    await drain();
    a.equal(f.results.length, 0);
  }
});
test('gameoverHP0 is settled first and its own result survives presentation', async () => {
  const f = integration();
  vm.runInContext("state.health=2;endBattle({winner:'enemy',time:1})", f.ctx);
  a.equal(vm.runInContext('state.health', f.ctx), 0);
  a.equal(vm.runInContext('state.done', f.ctx), true);
  f.finish();
  a.equal(f.healthCalls[0].health, 0);
  f.resolve(true);
  await drain();
  a.equal(f.results[0].done, true);
});
const files = ['GAME_DESIGN.md', 'GLOSSARY.md', 'UNIMPLEMENTED.md', 'CHANGELOG.md'],
  docs = Object.fromEntries(files.map((p) => [p, fs.readFileSync('docs/' + p, 'utf8')]));
