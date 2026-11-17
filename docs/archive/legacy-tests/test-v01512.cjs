'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  crypto = require('node:crypto'),
  Art = require('./src/legacy/battle-art'),
  Screens = require('./src/legacy/screen-effects'),
  P = require('./src/legacy/progression');
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log('PASS ' + name);
}
const near = (a, b) => assert(Math.abs(a - b) < 0.000001, `${a} vs ${b}`);
test('unaltered new PNG and measured tracks preserve exactly7x8 rectangular cells', () => {
  const b = fs.readFileSync('public/' + Art.assets.board),
    c = Art.calibration;
  assert.equal(b.readUInt32BE(16), c.source.width);
  assert.equal(b.readUInt32BE(20), c.source.height);
  assert.equal(
    crypto.createHash('sha256').update(b).digest('hex'),
    JSON.parse(fs.readFileSync('docs/specs/BOARD_01512_CALIBRATION.json', 'utf8')).sha256,
  );
  assert.equal(c.columns.length, 8);
  assert.equal(c.rows.length, 9);
  assert(c.columns.every((v, i) => !i || v > c.columns[i - 1]));
  assert(c.rows.every((v, i) => !i || v > c.rows[i - 1]));
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 8; j++)
      assert((c.columns[i + 1] - c.columns[i]) / (c.rows[j + 1] - c.rows[j]) > 1.6);
  near(c.frame.width / c.frame.height, 1659 / 948);
});
test('real combat measurement and positioning use all56 calibrated centres at multiple scales', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync('src/legacy/battle-view.js', 'utf8') + '\nthis.View=CombatView;', ctx);
  const c = Art.calibration;
  for (const scale of [0.35, 0.6, 1]) {
    const left = 120,
      top = 90,
      x0 = c.columns[0],
      y0 = c.rows[0],
      cells = Array.from({ length: 56 }, (_, p) => {
        const col = p % 7,
          row = Math.floor(p / 7);
        return {
          getBoundingClientRect: () => ({
            left: left + (c.columns[col] - x0) * scale,
            top: top + (c.rows[row] - y0) * scale,
            width: (c.columns[col + 1] - c.columns[col]) * scale,
            height: (c.rows[row + 1] - c.rows[row]) * scale,
          }),
        };
      });
    const view = Object.create(ctx.View.prototype);
    view.battle = {};
    view.nodes = new Map();
    view.board = {
      clientLeft: 0,
      clientTop: 0,
      getBoundingClientRect: () => ({
        left,
        top,
        width: (c.columns.at(-1) - x0) * scale,
        height: (c.rows.at(-1) - y0) * scale,
      }),
      querySelectorAll: () => cells,
    };
    view.measure();
    assert.equal(view.points.length, 56);
    for (let p = 0; p < 56; p++) {
      const col = p % 7,
        row = Math.floor(p / 7),
        point = view.point(999, p);
      near(point.x, ((c.columns[col] + c.columns[col + 1]) / 2 - x0) * scale);
      near(point.y, ((c.rows[row] + c.rows[row + 1]) / 2 - y0) * scale);
      const node = {
          style: {},
          getBoundingClientRect() {
            return {};
          },
        },
        entry = { node };
      view.position(entry, { pos: p }, true);
      const xy = node.style.transform.match(/translate3d\(([^p]+)px,([^p]+)px/);
      near(Number(xy[1]) + point.w / 2, point.x);
      near(Number(xy[2]) + point.h / 2, point.y);
    }
  }
});
test('intra-round text never opens a modal and a new scene safely replaces it', () => {
  const nodes = new Set(),
    animations = [];
  class Node {
    constructor(tag) {
      this.tag = tag;
      this.attrs = {};
      this.handlers = {};
    }
    setAttribute(k, v) {
      this.attrs[k] = v;
    }
    addEventListener(t, f) {
      this.handlers[t] = f;
    }
    showModal() {
      this.modal = true;
    }
    close() {}
    remove() {
      nodes.delete(this);
    }
    querySelector() {
      return null;
    }
    animate(frames, options) {
      let resolve, reject;
      const a = {
        frames,
        options,
        finished: new Promise((r, j) => {
          resolve = r;
          reject = j;
        }),
        cancel() {
          reject(Error('cancel'));
        },
      };
      animations.push(a);
      return a;
    }
  }
  const doc = { body: { appendChild: (n) => nodes.add(n) }, createElement: (tag) => new Node(tag) },
    effects = Screens.create({ document: doc }),
    text = effects.stage({ stage: 1, round: 2, type: 'SUPPLY' });
  const node = [...nodes][0];
  assert.equal(node.tag, 'div');
  assert.equal(node.modal, undefined);
  assert.equal(node.attrs.role, 'status');
  assert(node.innerHTML.includes('STAGE 1-2'));
  assert.equal(Object.keys(node.handlers).length, 0);
  assert.equal(animations[0].options.duration, 1600);
  effects.round({ stage: 2, round: 1 });
  assert.equal(nodes.size, 1);
  const cover = [...nodes][0];
  assert.equal(cover.modal, true);
  assert(cover.innerHTML.includes('ROUND 2'));
  assert.equal(animations[1].options.duration, 2200);
  assert.equal(animations[1].frames[0].clipPath, 'inset(0 100% 0 0)');
  effects.cancel();
  void text;
});
test('stage2-1 uses cover, stage2-2 and augment destinations use text without mutating progress', () => {
  const calls = [],
    state = P.initialize({ gold: 7, health: 100, units: [], shop: [] });
  Object.assign(state, { stage: 2, round: 1, roundPhase: 'prepare' });
  const ctx = vm.createContext({
    state,
    P,
    $: () => ({ hidden: false }),
    AutoScreenEffects: {
      round: (p) => calls.push(['round', p.stage, p.round]),
      stage: (p) => calls.push(['stage', p.stage, p.round]),
      cancel() {},
    },
  });
  vm.runInContext(fs.readFileSync('src/legacy/run-flow-ui.js', 'utf8'), ctx);
  const run = () => vm.runInContext('showRoundTransition()', ctx);
  run();
  state.round = 2;
  run();
  state.round = 3;
  state.roundPhase = 'augment';
  run();
  state.roundPhase = 'prepare';
  run();
  assert.deepEqual(calls, [
    ['round', 2, 1],
    ['stage', 2, 2],
    ['stage', 2, 3],
  ]);
  assert.equal(state.round, 3);
  assert.equal(state.gold, 7);
});
console.log('\n' + count + ' v0.15.12 board/transition tests passed.');
