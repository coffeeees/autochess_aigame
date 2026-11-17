// Migrated from the v0.15.18 suite test-drag-sales.cjs (tests for: ui).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = $data,
  P = $progression,
  V = $preparation;
let count = 0;
class Node {
  constructor(id = '', dataset = {}) {
    this.id = id;
    this.dataset = dataset;
    this.style = {};
    this.hidden = false;
    this.handlers = {};
    this.attrs = {};
    this.classes = new Set();
    this.classList = {
      add: (...v) => v.forEach((x) => this.classes.add(x)),
      remove: (...v) => v.forEach((x) => this.classes.delete(x)),
      contains: (x) => this.classes.has(x),
      toggle: (x, on) => {
        if (on ?? !this.classes.has(x)) this.classes.add(x);
        else this.classes.delete(x);
      },
    };
  }
  addEventListener(t, f) {
    (this.handlers[t] ??= []).push(f);
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  hasAttribute(k) {
    return k.startsWith('data-')
      ? k.slice(5).replace(/-([a-z])/g, (_, v) => v.toUpperCase()) in this.dataset
      : k in this.attrs;
  }
  closest(selectors) {
    return selectors
      .split(',')
      .some((s) =>
        s.startsWith('#')
          ? this.id === s.slice(1)
          : s.startsWith('[data-')
            ? this.hasAttribute(s.slice(1, -1))
            : s === '.' + this.className,
      )
      ? this
      : null;
  }
  querySelectorAll(s) {
    return this.id === 'saleDropZones'
      ? s === '[data-sale-value]'
        ? prices
        : s === '.drop-target'
          ? zones.filter((x) => x.classes.has('drop-target'))
          : []
      : [];
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  remove() {
    if (ghost === this) ghost = null;
  }
}
const nodes = new Map(),
  get = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Node(id));
    return nodes.get(id);
  },
  prices = [new Node(), new Node()],
  zones = [new Node('', { sellZone: 'left' }), new Node('', { sellZone: 'right' })];
let ghost = null,
  hit = null;
const document = {
  getElementById: get,
  handlers: {},
  addEventListener(t, f) {
    (this.handlers[t] ??= []).push(f);
  },
  querySelector: (s) => (s === '.drag-ghost' ? ghost : null),
  querySelectorAll: (s) =>
    s === '.drop-target' ? zones.filter((x) => x.classes.has('drop-target')) : [],
  elementFromPoint: () => hit,
  createElement: () => new Node(),
  body: new Node(),
};
document.body.appendChild = (n) => {
  ghost = n;
};
const window = {
  handlers: {},
  addEventListener(t, f) {
    (this.handlers[t] ??= []).push(f);
  },
};
const context = vm.createContext({
  AutoData: D,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: $encounters,
  AutoPreparation: V,
  AutoShop: $shopCore,
  AutoMerge: $mergeCore,
  AutoRun: $runCore,
  document,
  window,
  console,
  setTimeout: () => 1,
  clearTimeout() {},
  clearInterval() {},
  localStorage: { setItem() {} },
  CSS: { escape: (s) => s },
});
const source = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(source.slice(0, source.lastIndexOf('\nload();')), context);
vm.runInContext(fs.readFileSync('src/legacy/drag-sales.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('src/legacy/interaction-ui.js', 'utf8'), context);
vm.runInContext(
  'var renders=0,saves=0;render=()=>renders++;save=()=>saves++;setupInteractions();',
  context,
);
function run(code) {
  return vm.runInContext(code, context);
}
function reset(star = 1, id = 'C13') {
  run(
    `state=P.initialize({units:[{uid:1,id:'${id}',star:${star},location:'bench',pos:-1,benchSlot:0}],inventory:[],gold:7,health:100,shop:[]});battle=null;message='';selected=1;renders=0;saves=0;finishDrag();`,
  );
  get('saleDropZones').classList.remove('is-visible');
  hit = null;
}
const unit = new Node('', { unitUid: '1' }),
  item = new Node('', { itemUid: 'gear' });
function send(type, target = unit, extra = {}) {
  const e = {
    target,
    button: 0,
    pointerId: 10,
    clientX: 200,
    clientY: 300,
    preventDefault() {},
    ...extra,
  };
  for (const f of document.handlers[type] || []) f(e);
}
function drag() {
  send('pointerdown');
  send('pointermove', unit, { clientX: 225 });
}
test('click and movement below7px never show sale zones or pay gold', () => {
  reset();
  send('pointerdown');
  send('pointermove', unit, { clientX: 206 });
  a(!get('saleDropZones').classes.has('is-visible'));
  send('pointerup');
  a.equal(run('state.gold'), 7);
  a.equal(run('state.units.length'), 1);
});
test('actual unit drag shows only sale value on both sides and highlights target', () => {
  reset(2);
  drag();
  a(get('saleDropZones').classes.has('is-visible'));
  a.deepEqual(
    prices.map((x) => x.textContent),
    ['6G', '6G'],
  );
  hit = zones[1];
  send('pointermove', unit, { clientX: 300 });
  a(zones[1].classes.has('drop-target'));
  send('pointercancel');
  a(!get('saleDropZones').classes.has('is-visible'));
});
test('left drop sells once, refunds exact gold and releases equipped items', () => {
  reset(2);
  run("state.inventory=[{uid:'gear',id:'I01',equippedTo:1}]");
  drag();
  hit = zones[0];
  send('pointerup');
  send('pointerup');
  a.equal(run('state.gold'), 13);
  a.equal(run('state.units.length'), 0);
  a.equal(run('state.inventory[0].equippedTo'), null);
  a.equal(run('saves'), 1);
  a.equal(run('renders'), 1);
  a.equal(run('message'), '');
  a(!get('saleDropZones').classes.has('is-visible'));
});
test('right drop sells three-star once and reopens its existing shop pool', () => {
  reset(3);
  a(!run("V.shopPool(state).includes('C13')"));
  drag();
  hit = zones[1];
  send('pointerup');
  send('pointerup');
  a.equal(run('state.gold'), 25);
  a.equal(run('state.units.length'), 0);
  a(run("V.shopPool(state).includes('C13')"));
  a.equal(run('saves'), 1);
});
test('outside drop preserves unit and gold with original feedback', () => {
  reset();
  drag();
  hit = null;
  send('pointerup');
  a.equal(run('state.gold'), 7);
  a.equal(run('state.units.length'), 1);
  a.equal(run('message'), '');
  a(!get('saleDropZones').classes.has('is-visible'));
});
test('pointer cancellation, Escape and window blur never sell and clear all targets', () => {
  for (const mode of ['cancel', 'escape', 'blur']) {
    reset();
    drag();
    hit = zones[0];
    if (mode === 'cancel') send('pointercancel');
    else if (mode === 'escape') send('keydown', unit, { key: 'Escape' });
    else for (const f of window.handlers.blur) f();
    send('pointerup');
    a.equal(run('state.gold'), 7);
    a.equal(run('state.units.length'), 1);
    a(!get('saleDropZones').classes.has('is-visible'));
    a.equal(ghost, null);
  }
});
test('opening a modal during drag immediately clears sale zones without sale', () => {
  reset();
  drag();
  run("showModal('<h2>테스트</h2>')");
  a(!get('saleDropZones').classes.has('is-visible'));
  a.equal(run('state.gold'), 7);
  a.equal(run('dragAction'), null);
});
test('item dragging never activates unit sale zones', () => {
  reset();
  run("state.inventory=[{uid:'gear',id:'I01',equippedTo:null}]");
  send('pointerdown', item);
  send('pointermove', item, { clientX: 225 });
  a(!get('saleDropZones').classes.has('is-visible'));
  send('pointercancel', item);
  a.equal(run('state.gold'), 7);
});
test('sale button uses same transaction and locked or stale sales remain inert', () => {
  reset();
  run('battle={};');
  a.equal(run('sellUnit(1)'), false);
  run('battle=null;state.done=true;');
  a.equal(run('sellUnit(1)'), false);
  run("state.done=false;state.roundPhase='result';");
  a.equal(run('sellUnit(1)'), false);
  run("state.roundPhase='prepare';");
  get('sellBtn').onclick();
  get('sellBtn').onclick();
  a.equal(run('state.gold'), 9);
  a.equal(run('saves'), 1);
  a.equal(run('sellUnit(999)'), false);
});
