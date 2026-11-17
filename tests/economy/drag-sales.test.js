// Migrated from the v0.15.18 suite test-drag-sales.cjs (tests for: economy).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
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
test('sale prices retain cost times3^(star-1) for every playable character', () => {
  for (const id of D.playableIds)
    for (let star = 1; star <= 3; star++) {
      context.unitPrice = { id, star };
      a.equal(run('unitSalePrice(unitPrice)'), D.byId(id).cost * 3 ** (star - 1));
    }
});
