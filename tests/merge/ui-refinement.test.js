// Migrated from the v0.15.18 suite test-ui-refinement.cjs (tests for: merge).
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
test('board merge center retains its unit and returns only consumed copies equipment', () => {
  state([
    { uid: 1, id: 'C01', star: 1, location: 'bench', pos: -1, benchSlot: 0 },
    { uid: 2, id: 'C01', star: 1, location: 'board', pos: 31 },
    { uid: 3, id: 'C01', star: 1, location: 'bench', pos: -1, benchSlot: 5 },
  ]);
  run("state.inventory=[{uid:'a',id:'I01',equippedTo:1},{uid:'b',id:'I02',equippedTo:2}];merge();");
  a.equal(run('state.units.length'), 1);
  a.equal(run('state.units[0].uid'), 2);
  a.equal(run('state.units[0].star'), 2);
  a.equal(run('events[0].center'), 2);
  a.equal(run('events[0].parts.length'), 2);
  a.equal(run('state.inventory[0].equippedTo'), null);
  a.equal(run('state.inventory[1].equippedTo'), 2);
  a.equal(run('message'), '');
});
test('bench merge anchors the leftmost slot rather than source array order', () => {
  state([
    { uid: 1, id: 'C02', star: 1, location: 'bench', pos: -1, benchSlot: 8 },
    { uid: 2, id: 'C02', star: 1, location: 'bench', pos: -1, benchSlot: 1 },
    { uid: 3, id: 'C02', star: 1, location: 'bench', pos: -1, benchSlot: 4 },
  ]);
  run('merge()');
  a.equal(run('state.units[0].uid'), 2);
  a.equal(run('state.units[0].benchSlot'), 1);
  a.equal(run('events[0].center'), 2);
  a.equal(run('state.gold'), 20);
});
test('nine copies still chain to one3star with two consumed units per visual event', () => {
  state(
    Array.from({ length: 9 }, (_, i) => ({
      uid: i + 1,
      id: 'C03',
      star: 1,
      location: 'bench',
      pos: -1,
      benchSlot: i,
    })),
  );
  run('merge()');
  a.equal(run('state.units.length'), 1);
  a.equal(run('state.units[0].star'), 3);
  a.equal(run('events.length'), 4);
  a(run('events.every(e=>e.parts.length===2)'));
  a.equal(run('message'), '');
});
