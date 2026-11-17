// Migrated from the v0.15.18 suite test-vfx18.cjs (tests for: render).
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
test('only real C07 skill compound events select chains; basic gray/C01 yellow mappings unchanged', () => {
  require('../../src/legacy/vfx-events').install(Battle);
  const b = new Battle(
    [{ id: 'C07', pos: 35 }],
    [
      { id: 'E01', pos: 28 },
      { id: 'E02', pos: 27 },
      { id: 'E03', pos: 21 },
    ],
    { rng: () => 0.99 },
  );
  b.cast(b.units[0], b.units[1]);
  const commands = Visuals.plan(b.events, b.units),
    chain = commands.find((c) => c.kind === 'chainLightning');
  a(chain);
  a.equal(chain.sourceId, 'C07');
  a.equal(chain.chains.length, 2);
  a(chain.eventId);
  a.equal(commands.filter((c) => c.skillVisual === 'c07-primary').length, 3);
  a.equal(commands.filter((c) => c.skillVisual === 'c07-chain').length, 2);
  a.equal(
    Pixels.mapping({ kind: 'damage', sourceId: 'C07', attackKind: 'basic', ranged: true }).theme,
    'gray',
  );
  a.equal(Pixels.mapping({ kind: 'damage', sourceId: 'C01', attackKind: 'skill' }).theme, 'yellow');
  a.equal(Pixels.mapping({ kind: 'damage', sourceId: 'C07', attackKind: 'skill' }), null);
});
test('chain pixels/steps opaque, event dedup, actual0/1/2 recipients, lifespan, resize/pause cleanup and caps', () => {
  const old = {
    document: global.document,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  };
  const rects = [],
    strokes = [],
    ctx = {
      globalAlpha: 1,
      setTransform() {},
      clearRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {
        strokes.push({ alpha: this.globalAlpha, color: this.strokeStyle });
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
      fillRect() {
        rects.push({ alpha: this.globalAlpha, color: this.fillStyle });
      },
    },
    canvas = { style: {}, setAttribute() {}, getContext: () => ctx, remove() {} };
  global.document = { createElement: () => canvas };
  global.requestAnimationFrame = () => 1;
  global.cancelAnimationFrame = () => {};
  try {
    for (let targets = 0; targets <= 2; targets++) {
      const p = new Pixels.PixelVfx(
          { appendChild() {}, clientWidth: 700, clientHeight: 600 },
          { random: () => 0.5 },
        ),
        s = { x: 20, y: 60, w: 100 },
        t = { x: 250, y: 60, w: 100 },
        others = [
          { x: 380, y: 20, w: 100 },
          { x: 380, y: 180, w: 100 },
        ].slice(0, targets),
        now = performance.now();
      a(
        p.playChain(
          { eventId: 'c' + targets, sourceId: 'C07', primary: { landed: true } },
          s,
          t,
          others,
          1,
        ),
      );
      a(!p.playChain({ eventId: 'c' + targets, primary: { landed: true } }, s, t, others, 1));
      p.draw(now + 250);
      for (const row of rects.filter((r) => Pixels.themes.electric.particles.includes(r.color)))
        a.equal(row.alpha, 1);
      a(strokes.every((s) => s.alpha === 1));
      p.draw(now + 1000);
      a.equal(p.chains.length, 0);
      a.equal(p.particles.length, 0);
      p.playChain({ eventId: 'more', primary: { landed: false } }, s, t, [], 1);
      p.draw(performance.now() + 200);
      a(!p.bursts.some((b) => b.kind === 'impact'));
      for (let i = 0; i < 80; i++)
        p.playChain({ eventId: 'n' + i, primary: { landed: true } }, s, t, others, 4);
      a(p.chains.length <= 24);
      a(p.particles.length <= 720);
      p.resize(500, 300);
      a.equal(p.chains.length, 0);
      a.equal(p.particles.length, 0);
      p.destroy();
    }
  } finally {
    Object.assign(global, old);
  }
});
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
