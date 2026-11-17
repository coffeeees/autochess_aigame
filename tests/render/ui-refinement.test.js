// Migrated from the v0.15.18 suite test-ui-refinement.cjs (tests for: render).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
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
  Policy = require('../../src/legacy/notice-policy');
let count = 0;
let nextTimer = 0;
const timers = new Map(),
  animations = [];
class Node {
  constructor(id) {
    this.id = id;
    this.style = {};
    this.innerHTML = '';
    this.hidden = false;
    this.open = false;
    this.handlers = {};
    this.attrs = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  addEventListener(t, f) {
    (this.handlers[t] ??= []).push(f);
  }
  getBoundingClientRect() {
    return { left: 10, top: 20, width: 80, height: 60 };
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  animate(frames, options) {
    animations.push({ id: this.id, frames, options });
    return { cancel() {}, finished: Promise.resolve() };
  }
}
const nodes = new Map(),
  el = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Node(id));
    return nodes.get(id);
  },
  document = {
    getElementById: el,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    body: { classList: { remove() {} } },
  };
const context = vm.createContext({
  combatView: null,
  AutoData: D,
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: $encounters,
  AutoPreparation: V,
  AutoShop: $shopCore,
  AutoMerge: $mergeCore,
  AutoRun: $runCore,
  AutoNoticePolicy: Policy,
  AutoItems: $items,
  document,
  console,
  localStorage: { setItem() {} },
  setTimeout: (fn, ms) => {
    const id = ++nextTimer;
    timers.set(id, { fn, ms });
    return id;
  },
  clearTimeout: (id) => timers.delete(id),
  clearInterval() {},
  matchMedia: () => ({ matches: false }),
});
const source = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(source.slice(0, source.lastIndexOf('\nload();')), context);
vm.runInContext(fs.readFileSync('src/legacy/interaction-ui.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('src/legacy/content-ui.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('src/legacy/stage-ui.js', 'utf8'), context);
const run = (s) => vm.runInContext(s, context);
run(
  'var events=[];queueMergeEffect=(keep,removed)=>events.push({center:keep.uid,star:keep.star,parts:removed.map(u=>u.uid)});render=()=>{};save=()=>{};',
);
function state(units = []) {
  context.seed = units;
  run(
    "state=P.initialize({units:seed,inventory:[],health:100,gold:20,shop:[]});battle=null;message='';selected=null;events=[];",
  );
}
test('level animation runs only on real level increases, not initialization or XP-only updates', () => {
  vm.runInContext(fs.readFileSync('src/legacy/presentation-effects.js', 'utf8'), context);
  el('gameView').hidden = false;
  run('observeLevelEffects(3);observeLevelEffects(3)');
  a.equal(animations.length, 0);
  run('observeLevelEffects(4)');
  a.equal(animations.length, 1);
  run('observeLevelEffects(4);observeLevelEffects(3)');
  a.equal(animations.length, 1);
  el('gameView').hidden = true;
  run('observeLevelEffects(5)');
  a.equal(animations.length, 1);
});
