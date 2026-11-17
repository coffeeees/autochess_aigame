// Migrated from the v0.15.18 suite test-vfx18.cjs (tests for: combat).
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
test('client warm reuse, ready→initial frame→begin, pause-before-ready, hidden start, failed Worker fallback', () => {
  const f = runner();
  vm.runInContext('warmCombatWorker();warmCombatWorker();startCombatWorker()', f.ctx);
  a.equal(f.created, 1);
  const w = f.messages[0];
  a.equal(w.sent[0].type, 'prepare');
  w.onmessage({ data: { type: 'ready' } });
  a(!w.sent.some((m) => m.type === 'begin'));
  f.flush();
  a(!w.sent.some((m) => m.type === 'begin'));
  f.flush();
  a(w.sent.some((m) => m.type === 'begin'));
  w.onerror();
  a.equal(f.ctx.fallback, true);
  const c = runner();
  vm.runInContext('startCombatWorker()', c.ctx);
  c.elements.gameView.hidden = true;
  c.messages[0].onmessage({ data: { type: 'ready' } });
  c.flush();
  c.flush();
  a(c.messages[0].sent.find((m) => m.type === 'begin').paused);
  const h = runner();
  h.ctx.document.hidden = true;
  vm.runInContext('startCombatWorker()', h.ctx);
  h.messages[0].onmessage({ data: { type: 'ready' } });
  a(h.messages[0].sent.some((m) => m.type === 'begin'));
  const bad = runner();
  bad.fail();
  a.equal(vm.runInContext('startCombatWorker()', bad.ctx), false);
});
test('multi-tick Worker pump preserves early C07 events at4x without extra simulation damage', () => {
  let now = 0,
    pump,
    output = [];
  const math = Object.create(Math);
  math.random = () => 0.99;
  const ctx = vm.createContext({
    Math: math,
    Date: { now: () => now },
    setInterval: (f) => ((pump = f), 1),
    clearInterval() {},
    postMessage: (m) => output.push(structuredClone(m)),
  });
  ctx.importScripts = (...files) =>
    files.forEach((f) => vm.runInContext(fs.readFileSync('src/legacy/' + f, 'utf8'), ctx));
  vm.runInContext(fs.readFileSync('src/legacy/combat-worker.js', 'utf8'), ctx);
  const b = new Battle(
    [{ id: 'C07', pos: 35 }],
    [
      { id: 'E01', pos: 28 },
      { id: 'E02', pos: 27 },
    ],
    { rng: () => 0.99, quickMana: true },
  );
  ctx.input = { type: 'prepare', battle: JSON.parse(JSON.stringify(b)), hidden: false };
  vm.runInContext('onmessage({data:input})', ctx);
  ctx.input = { type: 'begin', now: 0, speed: 4 };
  vm.runInContext('onmessage({data:input})', ctx);
  now = 100;
  pump();
  const snapshot = output.at(-1).battle;
  a(snapshot.events.some((e) => e.kind === 'chainLightning'));
  for (let i = 0; i < 4; i++) b.tick();
  a.deepEqual(
    snapshot.units.map((u) => [u.hp, u.mp, u.pos]),
    b.units.map((u) => [u.hp, u.mp, u.pos]),
  );
});
