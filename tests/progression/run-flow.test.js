// Migrated from the v0.15.18 suite test-v01510.cjs (tests for: progression).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $patchNotes from '../../src/content/patch-notes.js';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
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
  N = $patchNotes;
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
test('victory heals2 at100 cap for battle and boss, and receipt replay never heals twice', () => {
  for (const round of [3, 5])
    for (const hp of [50, 98, 99, 100]) {
      const s = state(1, round);
      s.health = hp;
      const r = combat(s);
      a.equal(s.health, Math.min(100, hp + 2));
      a.equal(r.healing, Math.min(2, 100 - hp));
      a.equal(r.healthBefore, hp);
      const settled = copy(s);
      a.equal(P.settleRound(s, { winner: 'ally' }), r);
      a.deepEqual(s, settled);
      const restored = P.migrate(copy(s));
      P.settleRound(restored, { winner: 'ally' });
      a.equal(restored.health, settled.health);
    }
});
test('difficulty affects startHP but player maximum stays100 and victory can recover above start', () => {
  for (let level = 1; level <= 10; level++) {
    const s = W.configureNewRun(state(), level);
    a.equal(s.maxHealth, 100);
    a.equal(s.health, W.difficulty(level).startingHealth);
    combat(s);
    a.equal(s.health, Math.min(100, W.difficulty(level).startingHealth + 2));
  }
});
test('supplies, augment picks and defeat do not grant victory healing; loss formula unchanged', () => {
  const s = state(1, 1),
    r = supply(s, () => 0.9);
  a.equal(s.health, 75);
  a.equal(r.healing, 0);
  const lost = state(1, 3),
    l = combat(lost, 'enemy');
  a.equal(lost.health, 59);
  a.equal(l.loss, 16);
  a.equal(l.healing, 0);
  const aug = state();
  P.requestAugment(aug, '1-3', () => 0);
  P.chooseAugment(aug, P.availableAugments(aug)[0].id);
  a.equal(aug.health, 75);
});
test('6-5 settlement gates advance only after rewards; pending choice survives reload', () => {
  const s = state(6, 5);
  const r = combat(s),
    after = copy(s);
  a.equal(s.completionChoice, 'pending');
  a.equal(s.roundPhase, 'result');
  a(!P.advanceRound(s));
  a.deepEqual(s, after);
  const restored = P.migrate(copy(s));
  a.equal(restored.completionChoice, 'pending');
  a.equal(P.settleRound(restored, { winner: 'ally' }).total, r.total);
  a.equal(restored.gold, after.gold);
  a.equal(restored.inventory.length, 1);
  a(!P.buyXp(restored));
});
test('continue preserves all progress, enters7-1 once and never prompts again', () => {
  const s = state(6, 5);
  s.units = [{ id: 'C24', uid: 1, star: 2, location: 'board', pos: 31 }];
  s.augments = ['S01'];
  combat(s);
  s.shopLocked = true;
  const before = copy(s);
  a(P.chooseCompletion(s, 'continue'));
  a(!P.chooseCompletion(s, 'continue'));
  a(!P.chooseCompletion(s, 'end'));
  a(P.advanceRound(s));
  V.enterShop(s);
  a.equal(P.label(s), '7-1');
  for (const key of ['gold', 'health', 'inventory', 'units', 'augments', 'completedRounds'])
    a.deepEqual(s[key], before[key]);
  a.deepEqual(s.shop, before.shop);
  a(!P.advanceRound(s));
  s.stage = 7;
  s.round = 5;
  combat(s);
  a.equal(s.completionChoice, 'continue');
  a(P.advanceRound(s));
  a.equal(P.label(s), '8-1');
});
test('end preserves paid receipts and assets without bonus, blocks progression after reload', () => {
  const s = state(6, 5);
  combat(s);
  const before = copy(s);
  a(P.chooseCompletion(s, 'end'));
  a.equal(s.done, true);
  a.equal(s.roundPhase, 'complete');
  for (const key of ['gold', 'health', 'inventory', 'units', 'augments', 'completedRounds'])
    a.deepEqual(s[key], before[key]);
  const restored = P.migrate(copy(s));
  a.equal(restored.completionChoice, 'end');
  a(!P.advanceRound(restored));
  a(!P.chooseCompletion(restored, 'continue'));
  a(!P.beginSupply(restored));
  a(!V.manualReroll(restored));
  a.deepEqual(P.settleRound(restored), restored.lastResult);
});
test('6-5 loss withHP left still offers completion, lethal loss uses gameover, old7+ saves skip retroactive choice', () => {
  const loss = state(6, 5);
  loss.health = 100;
  combat(loss, 'enemy');
  a.equal(loss.completionChoice, 'pending');
  a(loss.health > 0);
  const dead = state(6, 5);
  dead.health = 1;
  combat(dead, 'enemy');
  a.equal(dead.health, 0);
  a.equal(dead.roundPhase, 'gameover');
  a.equal(dead.completionChoice, null);
  a(!P.chooseCompletion(dead, 'continue'));
  const old = state(7, 2);
  delete old.completionChoice;
  P.migrate(old);
  a.equal(old.completionChoice, 'legacy');
  const fresh = state();
  fresh.completionChoice = 'end';
  fresh.shopLocked = true;
  P.initialize(fresh);
  a.equal(fresh.completionChoice, null);
  a.equal(fresh.shopLocked, false);
});
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
  AutoShop: $shopCore,
  AutoMerge: $mergeCore,
  AutoRun: $runCore,
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
