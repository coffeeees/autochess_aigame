// Migrated from the v0.15.18 suite test-vfx18.cjs (tests for: ui).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  Pixels = require('../../src/legacy/pixel-vfx'),
  D = require('../../src/legacy/data'),
  { Battle } = require('../../src/legacy/engine'),
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
test('shop empty card has no visible success text and 200ms heart exit does not retime HP interpolation', () => {
  const p = fs.readFileSync('src/legacy/prototype.js', 'utf8');
  a(p.includes('aria-label="구매한 빈 슬롯"></div>'));
  a(!p.includes('<span>영입 완료</span>'));
  // whitespace-insensitive: the source is Prettier-formatted
  const hp = fs.readFileSync('src/legacy/impact-health.js', 'utf8').replace(/\s+/g, '');
  a(hp.includes('duration=small?500:3000'));
  a(hp.includes('offset:2800/3000'));
  a(hp.includes('(elapsed-900)/800'));
});
