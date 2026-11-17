// Migrated from the v0.15.18 suite test-v01510.cjs (tests for: render).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $augments from '../../src/core/augments.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
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
  A = $augments,
  I = $items,
  N = require('../../src/legacy/patch-notes');
let count = 0;
const copy = (x) => JSON.parse(JSON.stringify(x)),
  near = (x, y) => a(Math.abs(x - y) < 1e-7);
function state(stage = 1, round = 3) {
  const s = P.initialize({
    gold: 25,
    health: 75,
    units: [],
    shop: ['C01', null, 'C24', 'C03', 'C05'],
  });
  Object.assign(s, { stage, round });
  s.wave = P.ordinal(s);
  return s;
}
function combat(s, winner = 'ally') {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner }, () => 0.99);
}
function supply(s, rng) {
  P.beginSupply(s, () => 0.1);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
const els = new Map(),
  get = (id) => {
    if (!els.has(id))
      els.set(id, {
        id,
        innerHTML: '',
        textContent: '',
        hidden: false,
        style: {},
        attrs: {},
        handlers: {},
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(t, fn) {
          (this.handlers[t] ??= []).push(fn);
        },
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        getBoundingClientRect() {
          return { left: 10, top: 10, width: 50, height: 50 };
        },
      });
    return els.get(id);
  },
  doc = {
    getElementById: get,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { appendChild() {}, classList: { remove() {} } },
  };
const ctx = vm.createContext({
  AutoData: D,
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: W,
  AutoPreparation: V,
  AutoItems: I,
  AutoAugments: A,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  AutoPatchNotes: N,
  document: doc,
  console,
  setTimeout,
  clearTimeout,
  clearInterval,
  localStorage: { setItem() {} },
});
const src = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(src.slice(0, src.lastIndexOf('\nload();')), ctx);
for (const p of ['interaction-ui', 'content-ui', 'catalog-ui', 'run-flow-ui'])
  vm.runInContext(fs.readFileSync('src/legacy/' + p + '.js', 'utf8'), ctx);
vm.runInContext(
  "function renderHealth(){}function renderBoard(){}function renderDetail(){}function renderDebug(){}function renderProgression(){}function setRecruitOpen(){} state=P.initialize({gold:25,health:75,units:[],shop:['C24']});setupRunFlowUI();setupCatalogUI();",
  ctx,
);
test('round transition wrapper delegates current node without changing state', () => {
  const calls = [],
    scene = vm.createContext({
      AutoScreenEffects: { round: (p) => calls.push(p), cancel: (k) => calls.push(k) },
      state: state(2, 1),
      P,
      $: () => ({ hidden: false }),
    });
  vm.runInContext(fs.readFileSync('src/legacy/run-flow-ui.js', 'utf8'), scene);
  const before = copy(scene.state);
  vm.runInContext('showRoundTransition()', scene);
  a.equal(calls.length, 1);
  a.equal(calls[0].stage, 2);
  a.equal(calls[0].round, 1);
  a.deepEqual(scene.state, before);
});
test('round transition wrapper skips ended/hidden scenes and exposes scoped cancellation', () => {
  const calls = [],
    scene = vm.createContext({
      AutoScreenEffects: { round: (p) => calls.push(p), cancel: (k) => calls.push(k) },
      state: state(),
      P,
      $: () => ({ hidden: true }),
    });
  vm.runInContext(fs.readFileSync('src/legacy/run-flow-ui.js', 'utf8'), scene);
  vm.runInContext('showRoundTransition();cancelRoundTransition()', scene);
  a.deepEqual(calls, ['round', 'stage']);
});
