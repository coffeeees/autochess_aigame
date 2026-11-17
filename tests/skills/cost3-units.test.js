// Migrated from the v0.15.18 suite test-v0159.cjs (tests for: skills).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
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
  { Battle, mitigatedDamage } = $engine,
  H = require('../../src/legacy/health-effects');
$bondEffects.init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
const battle = (
  id,
  allies = [],
  enemies = [
    { id: 'E06', pos: 24 },
    { id: 'E03', pos: 23 },
    { id: 'E01', pos: 3 },
  ],
) => new Battle([{ id, pos: 31 }, ...allies], enemies, { rng: () => 0.99 });
test('C24 heals lowest two and slows their last living basic attackers only at cast', () => {
  const b = battle('C24', [
      { id: 'C03', pos: 32 },
      { id: 'C05', pos: 53 },
    ]),
    [u, x, y, e, f] = b.units;
  x.hp = 100;
  y.hp = 200;
  b.deal(e, x, 1, 'physical', { kind: 'basic' });
  b.deal(f, y, 1, 'physical', { kind: 'basic' });
  const before = [x.hp, y.hp];
  b.cast(u, e);
  near(x.hp - before[0], u.stats.AP * 2.1);
  near(y.hp - before[1], u.stats.AP * 2.1);
  near(b.stats(e).AS, e.stats.AS * 0.8);
  near(b.stats(f).AS, f.stats.AS * 0.8);
  a.equal(e.statuses[0].expires, 2);
  const b2 = battle('C24');
  b2.cast(b2.units[0], b2.units[1]);
  a(b2.units.slice(1).every((e) => !e.statuses.length));
});
test('C24 ignores dead former attacker and does not attach reactive future attacks', () => {
  const b = battle('C24', [{ id: 'C03', pos: 32 }]),
    [u, x, e, f] = b.units;
  x.hp = 100;
  b.deal(e, x, 1, 'physical', { kind: 'basic' });
  b.kill(e);
  b.cast(u, f);
  a(!f.statuses.length);
  b.deal(f, x, 1, 'physical', { kind: 'basic' });
  a(!f.statuses.length);
});
test('C25 chains once per distinct enemy at220/150/100AP in nearest order', () => {
  const b = battle('C25'),
    [u, t, x, y] = b.units;
  b.cast(u, t);
  for (const [e, r] of [
    [t, 2.2],
    [x, 1.5],
    [y, 1],
  ])
    near(e.stats.HP - e.hp, mitigatedDamage(u.stats.AP * r, e.stats.GD));
  a.equal(b.logs.filter((l) => l.kind === 'damage').length, 3);
});
test('C26 execution snapshots pre-hit40percent threshold and adds70AD only then', () => {
  for (const ratio of [0.4, 0.41]) {
    const b = battle('C26'),
      [u, t] = b.units;
    t.hp = t.stats.HP * ratio;
    const hp = t.hp;
    b.cast(u, t);
    near(hp - t.hp, mitigatedDamage(u.stats.AD * (ratio === 0.4 ? 2.9 : 2.2), t.stats.GD));
  }
});
test('C27 direct170AD and poison20AP ticks exactly five times', () => {
  const b = battle('C27'),
    [u, t] = b.units;
  b.cast(u, t);
  near(t.stats.HP - t.hp, mitigatedDamage(u.stats.AD * 1.7, t.stats.GD));
  const dot = t.statuses[0];
  near(dot.amount, u.stats.AP * 0.2);
  a.equal(dot.expires, 5);
  for (const x of b.units) x.castUntil = 999;
  for (let i = 0; i < 51; i++) b.tick();
  a.equal(b.logs.filter((l) => l.attackKind === 'dot').length, 5);
});
test('C28 charges to farthest enemy using existing free-cell path and debuffs3seconds', () => {
  const b = battle('C28'),
    [u, t, x, rear] = b.units;
  b.cast(u, t);
  a(b.adjacent(u, rear));
  near(rear.stats.HP - rear.hp, mitigatedDamage(u.stats.AD * 2.5, rear.stats.GD));
  near(b.stats(rear).AD, rear.stats.AD * 0.85);
  a.equal(rear.statuses[0].expires, 3);
  a.equal(new Set(b.alive().map((x) => x.pos)).size, b.alive().length);
});
test('C28 blocked path has no teleport, no damage and no debuff', () => {
  const b = battle(
      'C28',
      [
        { id: 'C01', pos: 24 },
        { id: 'C03', pos: 30 },
        { id: 'C05', pos: 32 },
        { id: 'C06', pos: 38 },
      ],
      [{ id: 'E06', pos: 3 }],
    ),
    u = b.units[0],
    t = b.units.at(-1);
  b.cast(u, t);
  a.equal(u.pos, 31);
  a.equal(t.hp, t.stats.HP);
  a.equal(t.statuses.length, 0);
});
test('C29 uses200AD before applying20percent GD reduction for4seconds', () => {
  const b = battle('C29'),
    [u, t] = b.units;
  b.cast(u, t);
  near(t.stats.HP - t.hp, mitigatedDamage(u.stats.AD * 2, t.stats.GD));
  near(b.stats(t).GD, t.stats.GD * 0.8);
  a.equal(t.statuses[0].expires, 4);
});
test('C30 shields self250AP five seconds and heals two lowest adjacent others100AP', () => {
  const b = battle('C30', [
      { id: 'C03', pos: 30 },
      { id: 'C05', pos: 32 },
      { id: 'C01', pos: 38 },
      { id: 'C02', pos: 53 },
    ]),
    [u, x, y, z, far] = b.units;
  for (const t of [u, x, y, z, far]) t.hp = 100;
  b.cast(u, b.units[5]);
  near(u.shields[0].amount, u.stats.AP * 2.5);
  a.equal(u.shields[0].expires, 5);
  near(x.hp, 100 + u.stats.AP);
  near(y.hp, 100 + u.stats.AP);
  a.equal(z.hp, 100);
  a.equal(u.hp, 100);
  a.equal(far.hp, 100);
});
test('C31 direct230AD and20AP burn expires after3seconds, no extra movement', () => {
  const b = battle('C31'),
    [u, t] = b.units;
  b.cast(u, t);
  near(t.stats.HP - t.hp, mitigatedDamage(u.stats.AD * 2.3, t.stats.GD));
  near(t.statuses[0].amount, u.stats.AP * 0.2);
  a.equal(t.statuses[0].expires, 3);
  a.equal(u.pos, 31);
});
test('C32 target and orthogonal neighbors200AP, one-second action lock without immunity', () => {
  const b = battle('C32'),
    [u, t, x, far] = b.units;
  b.cast(u, t);
  for (const e of [t, x]) {
    near(e.stats.HP - e.hp, mitigatedDamage(u.stats.AP * 2, e.stats.GD));
    a.equal(e.statuses[0].key, 'stun');
    a.equal(e.statuses[0].expires, 1);
  }
  a.equal(far.hp, far.stats.HP);
  u.castUntil = 999;
  far.castUntil = 999;
  const positions = [t.pos, x.pos];
  b.tick();
  a.deepEqual([t.pos, x.pos], positions);
  a(!b.logs.some((l) => l.attackKind === 'basic'));
  const hp = t.hp;
  b.deal(u, t, 10);
  a(t.hp < hp);
});
test('C33 two targets160AP, max-priority healing reduction and timed expiry', () => {
  const b = battle('C33'),
    [u, t, x, far] = b.units;
  b.cast(u, t);
  for (const e of [t, x]) {
    near(e.stats.HP - e.hp, mitigatedDamage(u.stats.AP * 1.6, e.stats.GD));
    a.equal(e.statuses[0].expires, 4);
  }
  a.equal(far.hp, far.stats.HP);
  t.hp = 100;
  t.healingReduction = 0.1;
  near(b.heal(t, 100, t), 70);
  t.healingReduction = 0.5;
  near(b.heal(t, 100, t), 50);
  t.healingReduction = 0.1;
  b.time = 4;
  near(b.heal(t, 100, t), 90);
});
test('all10 cost3 skills terminate real battles with gear and augments, both bond modes', () => {
  for (const experimental of [false, true])
    for (const id of D.playableIds.filter((id) => D.byId(id).cost === 3)) {
      const b = new Battle(
        [
          { id, pos: 31, itemIds: ['I27', 'I35'] },
          { id: 'C05', pos: 53 },
        ],
        [
          { id: 'E06', pos: 24, star: 2 },
          { id: 'E01', pos: 3 },
        ],
        {
          rng: () => 0.99,
          quickMana: true,
          experimental,
          allyModifiers: { augmentIds: ['G07', 'P05', 'S04'] },
        },
      );
      for (let n = 0; n < 1600 && !b.result; n++) b.tick();
      a(b.result, id);
      a(b.skillUses[id] > 0, id);
      for (const u of b.units) a(Number.isFinite(u.hp));
      a.equal(new Set(b.alive().map((x) => x.pos)).size, b.alive().length);
    }
});
function clock(reduced = false) {
  let now = 0,
    seq = 0,
    jobs = new Map(),
    values = [],
    bursts = 0,
    cleaned = 0;
  const h = H.create({
    paint: (n) => values.push(n),
    burst: () => {
      bursts++;
      return () => cleaned++;
    },
    reduced: () => reduced,
    later: (fn, ms) => {
      jobs.set(++seq, { fn, due: now + ms });
      return seq;
    },
    clear: (id) => jobs.delete(id),
  });
  return {
    h,
    values,
    get now() {
      return now;
    },
    get pending() {
      return jobs.size;
    },
    get bursts() {
      return bursts;
    },
    get cleaned() {
      return cleaned;
    },
    run() {
      while (jobs.size) {
        const [id, j] = [...jobs].sort((a, b) => a[1].due - b[1].due)[0];
        jobs.delete(id);
        now = j.due;
        j.fn();
      }
    },
  };
}
const elements = new Map(),
  el = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        innerHTML: '',
        textContent: '',
        style: {},
        disabled: false,
        checked: false,
        hidden: false,
        open: false,
        setAttribute() {},
        addEventListener() {},
        classList: { add() {}, remove() {}, toggle() {} },
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 50, height: 50 };
        },
      });
    return elements.get(id);
  };
const ctx = vm.createContext({
  AutoData: D,
  AutoItems: $items,
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: W,
  AutoPreparation: V,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  document: {
    getElementById: el,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { classList: { remove() {} } },
  },
  console,
  setTimeout,
  clearTimeout,
  clearInterval,
  localStorage: { setItem() {} },
});
const code = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(code.slice(0, code.lastIndexOf('\nload();')), ctx);
vm.runInContext(fs.readFileSync('src/legacy/interaction-ui.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/legacy/content-ui.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/legacy/drag-sales.js', 'utf8'), ctx);
vm.runInContext(
  "function renderHealth(){}function renderBoard(){}function renderDetail(){}function renderDebug(){}function renderProgression(){}function setRecruitOpen(){}function hideItemDetail(){}function renderOdds(){} state=V.normalize(P.initialize({gold:100,health:100,shop:['C24','C01','C25',null,null],units:[{id:'C24',uid:1,location:'board',pos:31,star:1},{id:'C01',uid:2,location:'bench',benchSlot:0,star:1}]}));state.recommendedBonds=['흑월'];nextUid=2;",
  ctx,
);
const nodes = new Set(),
  durations = [],
  animations = [];
let reduced = false;
const fx = vm.createContext({
  document: {
    querySelector: () => ({
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 40, height: 40 }),
    }),
    body: { appendChild: (n) => nodes.add(n) },
    createElement: () => ({
      style: {},
      remove() {
        nodes.delete(this);
      },
      animate(frames, options) {
        durations.push(options.duration);
        let resolve, reject;
        const finished = new Promise((a, b) => {
          resolve = a;
          reject = b;
        });
        const job = {
          finished,
          cancel() {
            reject(Error('cancelled'));
          },
          resolve,
        };
        animations.push(job);
        return job;
      },
    }),
  },
  $: (id) => (id === 'gameView' ? { hidden: false } : { open: false }),
  matchMedia: () => ({ matches: reduced }),
  pawn: () => '<i></i>',
});
vm.runInContext(fs.readFileSync('src/legacy/presentation-effects.js', 'utf8'), fx);
const seed = () =>
  vm.runInContext(
    'queueMergeEffect({uid:1},[{uid:2},{uid:3}],{left:0,top:0,width:40,height:40});flushMergeEffects();',
    fx,
  );
