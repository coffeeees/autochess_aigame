// Migrated from the v0.15.18 suite test-vfx18.cjs (tests for: shop).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  Pixels = require('../../src/legacy/pixel-vfx'),
  D = $data,
  { Battle } = $engine,
  Visuals = require('../../src/legacy/combat-visuals');
let count = 0;
function runner() {
  let raf = [],
    messages = [],
    created = 0,
    fail = false;
  const elements = { gameView: { hidden: false }, clock: {}, modal: { open: false } };
  class Worker {
    constructor() {
      if (fail) throw Error('no worker');
      created++;
      this.sent = [];
      messages.push(this);
    }
    postMessage(m) {
      this.sent.push(m);
    }
    terminate() {
      this.closed = true;
    }
  }
  const ctx = vm.createContext({
    Worker,
    performance: { now: () => 0, mark() {}, measure() {} },
    Date,
    document: { hidden: false, addEventListener() {} },
    $: (id) => elements[id],
    requestAnimationFrame: (fn) => (raf.push(fn), raf.length),
    cancelAnimationFrame() {},
    speed: 1,
    battle: { time: 0, events: [] },
    state: { roundPhase: 'combat' },
    renderBoard() {},
    renderDetail() {},
    renderDebug() {},
    positionCombatDamage() {},
    getCombatView: () => ({ consume() {}, clearTransient() {} }),
    num: Math.round,
    runTimer: (x) => (ctx.fallback = x),
    URL: {},
    console,
  });
  vm.runInContext(fs.readFileSync('src/legacy/combat-runner.js', 'utf8'), ctx);
  return {
    ctx,
    elements,
    messages,
    get created() {
      return created;
    },
    fail() {
      fail = true;
    },
    flush() {
      const jobs = raf;
      raf = [];
      jobs.forEach((f) => f());
    },
  };
}
test('each of12 new IDs recruits/merges to3star, excludes/reopens pool on sale and preserves gear/save', () => {
  const P = $progression,
    V = $preparation,
    W = $encounters;
  const elements = new Map();
  const el = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        innerHTML: '',
        addEventListener() {},
        close() {},
        showModal() {},
      });
    return elements.get(id);
  };
  const ctx = vm.createContext({
    AutoData: D,
    AutoEngine: $engine,
    AutoWorld: W,
    AutoProgression: P,
    AutoPreparation: V,
    AutoShop: $shopCore,
    AutoMerge: $mergeCore,
    AutoRun: $runCore,
    AutoItems: $items,
    AutoNoticePolicy: require('../../src/legacy/notice-policy'),
    document: {
      getElementById: el,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      body: { classList: { remove() {} } },
    },
    setTimeout,
    clearTimeout,
    clearInterval,
    console,
    localStorage: { setItem() {} },
  });
  const source = fs.readFileSync('src/legacy/prototype.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nload();')), ctx);
  vm.runInContext(fs.readFileSync('src/legacy/drag-sales.js', 'utf8'), ctx);
  vm.runInContext(
    'function render(){}function save(){}function notify(){}function setRecruitOpen(){}',
    ctx,
  );
  for (const id of D.playableIds.slice(33)) {
    ctx.testId = id;
    vm.runInContext(
      'state=V.normalize(P.initialize({health:88,gold:1000,units:[],shop:[]}));nextUid=0;for(let n=0;n<9;n++)recruit(testId,false);',
      ctx,
    );
    a.equal(vm.runInContext('state.units.length', ctx), 1, id);
    a.equal(vm.runInContext('state.units[0].star', ctx), 3, id);
    a.equal(vm.runInContext('state.gold', ctx), 1000 - D.byId(id).cost * 9, id);
    a.equal(vm.runInContext('V.shopPool(state).includes(testId)', ctx), false);
    vm.runInContext(
      "var gear=P.addItem(state,'I01');P.equip(state,gear.uid,state.units[0].uid);state=V.normalize(P.migrate(JSON.parse(JSON.stringify(state))));sellUnit(state.units[0].uid);",
      ctx,
    );
    a.equal(vm.runInContext('state.gold', ctx), 1000, id);
    a.equal(vm.runInContext('state.inventory[0].equippedTo', ctx), null, id);
    a.equal(vm.runInContext('V.shopPool(state).includes(testId)', ctx), true);
  }
  vm.runInContext("state.gold=0;recruit('C34',true);recruit('C35',false);", ctx);
  a.equal(vm.runInContext('state.gold', ctx), 0);
  a.equal(vm.runInContext('state.units.length', ctx), 1);
  a(!vm.runInContext('recruitCardMarkup(null,0)', ctx).includes('영입 완료'));
});
