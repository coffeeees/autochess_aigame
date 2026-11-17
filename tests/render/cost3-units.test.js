// Migrated from the v0.15.18 suite test-v0159.cjs (tests for: render).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = require('../../src/legacy/data'),
  P = require('../../src/legacy/progression'),
  V = require('../../src/legacy/preparation'),
  W = require('../../src/legacy/encounters'),
  { Battle, mitigatedDamage } = require('../../src/legacy/engine'),
  H = require('../../src/legacy/health-effects');
require('../../src/legacy/bond-effects').init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
const battle = (
  id,
  allies = [],
  enemies = [
    { id: 'E06', pos: 24 },
    { id: 'E03', pos: 23 },
    { id: 'E01', pos: 3 },
  ],
) => new Battle([{ id, pos: 31 }, ...allies], enemies, { rng: () => 0.99 });
function clock(reduced = false) {
  let now = 0,
    seq = 0,
    jobs = new Map(),
    values = [],
    bursts = 0,
    cleaned = 0;
  const h = H.create({
    paint: (n) => values.push(n),
    burst: () => {
      bursts++;
      return () => cleaned++;
    },
    reduced: () => reduced,
    later: (fn, ms) => {
      jobs.set(++seq, { fn, due: now + ms });
      return seq;
    },
    clear: (id) => jobs.delete(id),
  });
  return {
    h,
    values,
    get now() {
      return now;
    },
    get pending() {
      return jobs.size;
    },
    get bursts() {
      return bursts;
    },
    get cleaned() {
      return cleaned;
    },
    run() {
      while (jobs.size) {
        const [id, j] = [...jobs].sort((a, b) => a[1].due - b[1].due)[0];
        jobs.delete(id);
        now = j.due;
        j.fn();
      }
    },
  };
}
test('HP display decrements by1 at80ms while target is immediately final', () => {
  const c = clock();
  c.h.render(100);
  c.h.render(90);
  a.equal(c.h.target, 90);
  a.equal(c.h.displayed, 100);
  c.h.render(90);
  a.equal(c.pending, 1);
  c.run();
  a.deepEqual(
    c.values,
    Array.from({ length: 11 }, (_, i) => 100 - i),
  );
  a.equal(c.now, 800);
  a.equal(c.bursts, 1);
  a.equal(c.cleaned, 1);
});
test('large HP loss reaches0 within1.6seconds with no skipped integer', () => {
  const c = clock();
  c.h.render(100);
  c.h.render(0);
  c.run();
  a.equal(c.values.length, 101);
  a.equal(c.h.displayed, 0);
  a(c.now <= 1600.001);
  a.equal(c.pending, 0);
});
test('HP cancellation/scene end snaps and removes outstanding jobs, new run increases instantly', () => {
  const c = clock();
  c.h.render(100);
  c.h.render(70);
  c.h.cancel();
  a.equal(c.h.displayed, 70);
  a.equal(c.pending, 0);
  c.h.render(100);
  a.equal(c.h.displayed, 100);
  c.run();
  a.equal(c.h.displayed, 100);
});
test('reduced motion snaps HP without shards or timers', () => {
  const c = clock(true);
  c.h.render(100);
  c.h.render(80);
  a.equal(c.h.displayed, 80);
  a.equal(c.pending, 0);
  a.equal(c.bursts, 0);
});
const elements = new Map(),
  el = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        innerHTML: '',
        textContent: '',
        style: {},
        disabled: false,
        checked: false,
        hidden: false,
        open: false,
        setAttribute() {},
        addEventListener() {},
        classList: { add() {}, remove() {}, toggle() {} },
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 50, height: 50 };
        },
      });
    return elements.get(id);
  };
const ctx = vm.createContext({
  AutoData: D,
  AutoItems: require('../../src/legacy/items'),
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: W,
  AutoPreparation: V,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  document: {
    getElementById: el,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { classList: { remove() {} } },
  },
  console,
  setTimeout,
  clearTimeout,
  clearInterval,
  localStorage: { setItem() {} },
});
const code = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(code.slice(0, code.lastIndexOf('\nload();')), ctx);
vm.runInContext(fs.readFileSync('src/legacy/interaction-ui.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/legacy/content-ui.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/legacy/drag-sales.js', 'utf8'), ctx);
vm.runInContext(
  "function renderHealth(){}function renderBoard(){}function renderDetail(){}function renderDebug(){}function renderProgression(){}function setRecruitOpen(){}function hideItemDetail(){}function renderOdds(){} state=V.normalize(P.initialize({gold:100,health:100,shop:['C24','C01','C25',null,null],units:[{id:'C24',uid:1,location:'board',pos:31,star:1},{id:'C01',uid:2,location:'bench',benchSlot:0,star:1}]}));state.recommendedBonds=['흑월'];nextUid=2;",
  ctx,
);
const nodes = new Set(),
  durations = [],
  animations = [];
let reduced = false;
const fx = vm.createContext({
  document: {
    querySelector: () => ({
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 40, height: 40 }),
    }),
    body: { appendChild: (n) => nodes.add(n) },
    createElement: () => ({
      style: {},
      remove() {
        nodes.delete(this);
      },
      animate(frames, options) {
        durations.push(options.duration);
        let resolve, reject;
        const finished = new Promise((a, b) => {
          resolve = a;
          reject = b;
        });
        const job = {
          finished,
          cancel() {
            reject(Error('cancelled'));
          },
          resolve,
        };
        animations.push(job);
        return job;
      },
    }),
  },
  $: (id) => (id === 'gameView' ? { hidden: false } : { open: false }),
  matchMedia: () => ({ matches: reduced }),
  pawn: () => '<i></i>',
});
vm.runInContext(fs.readFileSync('src/legacy/presentation-effects.js', 'utf8'), fx);
const seed = () =>
  vm.runInContext(
    'queueMergeEffect({uid:1},[{uid:2},{uid:3}],{left:0,top:0,width:40,height:40});flushMergeEffects();',
    fx,
  );
test('merge900ms flights then680ms flare and cleanup', async () => {
  seed();
  a.deepEqual(durations, [900, 900]);
  animations[0].resolve();
  animations[1].resolve();
  for (let n = 0; n < 12; n++) await Promise.resolve();
  a.equal(durations[2], 680);
  animations[2].resolve();
  for (let n = 0; n < 8; n++) await Promise.resolve();
  a.equal(nodes.size, 0);
});
test('reduced merge120ms and cancellation prevents stale flare', async () => {
  durations.length = 0;
  animations.length = 0;
  reduced = true;
  seed();
  a.deepEqual(durations, [120, 120]);
  vm.runInContext('cancelPresentationEffects()', fx);
  for (let n = 0; n < 12; n++) await Promise.resolve();
  a.equal(nodes.size, 0);
  a.equal(durations.length, 2);
});
