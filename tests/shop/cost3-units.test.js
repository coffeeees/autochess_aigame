// Migrated from the v0.15.18 suite test-v0159.cjs (tests for: shop).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = $data,
  P = $progression,
  V = $preparation,
  W = $encounters,
  { Battle, mitigatedDamage } = $engine,
  H = require('../../src/legacy/health-effects');
$bondEffects.init = (b) => {
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
  AutoItems: $items,
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
test('shop ownership covers board and bench, coexists with recommendation, and sale removes badge', () => {
  vm.runInContext('render()', ctx);
  let html = el('shop').innerHTML;
  a.equal((html.match(/owned-badge/g) || []).length, 2);
  a(html.includes('recruit owned recommended'));
  a(!el('bench').innerHTML.includes('owned-badge'));
  vm.runInContext('sellUnit(1)', ctx);
  html = el('shop').innerHTML;
  a.equal((html.match(/owned-badge/g) || []).length, 1);
  a(html.includes('recruit  recommended'));
});
test('cost3 purchase/merge/sale keeps price, returns gear and restores3star excluded pool', () => {
  vm.runInContext(
    "state.units=[];state.gold=100;state.shop=['C24',null,null,null,null];for(let i=0;i<9;i++)recruit('C24');",
    ctx,
  );
  let s = JSON.parse(vm.runInContext('JSON.stringify(state)', ctx));
  a.equal(s.units.length, 1);
  a.equal(s.units[0].star, 3);
  a.equal(s.gold, 73);
  a(!V.shopPool(s).includes('C24'));
  a(!s.shop.includes('C24'));
  ctx.saleUid = s.units[0].uid;
  vm.runInContext('sellUnit(saleUid)', ctx);
  s = JSON.parse(vm.runInContext('JSON.stringify(state)', ctx));
  a.equal(s.gold, 100);
  a(V.shopPool(s).includes('C24'));
});
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
