'use strict';
const a = require('node:assert/strict'),
  A = require('./src/legacy/combat-visuals.js'),
  I = require('./src/legacy/items.js'),
  { Battle } = require('./src/legacy/engine.js');
let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log('PASS ' + name);
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const units = [
  { uid: 1, id: 'C03', pos: 31, team: 'ally', stats: { RNG: 1 } },
  { uid: 2, id: 'E01', pos: 24, team: 'enemy', stats: { RNG: 4 } },
  { uid: 3, id: 'C05', pos: 53, team: 'ally', stats: { RNG: 3 } },
];
test('readable integer/fractional damage text without negativezero', () => {
  a.equal(A.numberText(1234.2), '1,234');
  a.equal(A.numberText(0.4), '<1');
  a.equal(A.numberText(0), '0');
  a.equal(A.numberText(9.6), '10');
});
test('physical/magic/incoming/critical figures use actual event values and distinct tones', () => {
  const out = A.plan(
    [
      {
        kind: 'damage',
        source: 1,
        target: 2,
        amount: 83,
        damageType: 'physical',
        attackKind: 'basic',
      },
      {
        kind: 'damage',
        source: 2,
        target: 1,
        amount: 24.6,
        damageType: 'magic',
        attackKind: 'skill',
      },
      { kind: 'damage', source: 3, target: 2, amount: 40, damageType: 'magic', critical: true },
    ],
    units,
  );
  a.equal(out[0].text, '−83');
  a.equal(out[0].tone, 'physical');
  a.equal(out[1].text, '−25');
  a.equal(out[1].tone, 'incoming');
  a.equal(out[2].text, '치명타 −40');
  a.equal(out[2].tone, 'critical');
  a(out[1].ranged);
});
test('adjacent melee and ranged or magic projectiles can be distinguished', () => {
  const near = clone(units);
  near[1].pos = 24;
  const out = A.plan(
    [
      { kind: 'damage', source: 1, target: 2, amount: 10, attackKind: 'basic' },
      { kind: 'damage', source: 2, target: 1, amount: 10, attackKind: 'basic' },
    ],
    near,
  );
  a.equal(out[0].ranged, false);
  a.equal(out[1].ranged, true);
});
test('periodic damage keeps DOT marker and proc events keep source tag', () => {
  const out = A.plan(
    [
      {
        kind: 'damage',
        source: 1,
        target: 2,
        amount: 0.2,
        attackKind: 'dot',
        sourceTag: 'ITEM_PROC',
      },
    ],
    units,
  );
  a.equal(out[0].attackKind, 'dot');
  a.equal(out[0].tone, 'dot');
  a.equal(out[0].text, '−<1');
  a(out[0].itemProc);
});
test('heals/shields/dodge are separate feedback; zero heals are suppressed', () => {
  const out = A.plan(
    [
      { kind: 'heal', source: 3, target: 1, amount: 30 },
      { kind: 'shield', source: 3, target: 1, amount: 100 },
      { kind: 'evade', target: 1 },
      { kind: 'heal', source: 3, target: 1, amount: 0 },
    ],
    units,
  );
  a.deepEqual(
    out.map((e) => e.kind),
    ['heal', 'shield', 'evade'],
  );
  a.deepEqual(
    out.map((e) => e.text),
    ['+30', '보호막 +100', '회피'],
  );
});
test('casting/spawn/death events include stable actors and dead targets', () => {
  const list = [
    ...units,
    { uid: 4, id: 'C02', pos: 32, team: 'ally', dead: true, stats: { RNG: 1 } },
  ];
  const out = A.plan(
    [
      { kind: 'skill', source: 1 },
      { kind: 'summon', source: 1, target: 4 },
      { kind: 'death', target: 4 },
    ],
    list,
  );
  a.deepEqual(
    out.map((e) => e.kind),
    ['cast', 'spawn', 'death'],
  );
  a.equal(out[0].sourceId, 'C03');
  a.equal(out[2].targetPos, 32);
});
test('nonvisual logs and missing unit references are safe and ignored', () => {
  a.deepEqual(
    A.plan(
      [
        { kind: 'system' },
        { kind: 'move', source: 1 },
        { kind: 'damage', target: 999, amount: 1 },
        { kind: 'skill', source: 999 },
        { kind: 'item', source: 1 },
      ],
      units,
    ),
    [],
  );
});
test('visual planning is pure and leaves all battle/log state intact', () => {
  const events = [{ kind: 'damage', source: 1, target: 2, amount: 22, critical: true }],
    before = clone({ events, units });
  A.plan(events, units);
  a.deepEqual({ events, units }, before);
});
test('floating damage reflects defense, shield absorption and capped remaining HP', () => {
  const b = new Battle([{ id: 'C03', pos: 31 }], [{ id: 'E06', pos: 24 }], { rng: () => 0.99 }),
    [u, t] = b.units;
  t.stats.GD = 100;
  b.shield(t, 20, 10, t);
  b.deal(u, t, 100, 'physical', { kind: 'basic', canCrit: false });
  const row = A.plan(b.events, b.units).find((e) => e.kind === 'damage');
  a.equal(row.amount, 30);
  a.equal(row.text, '−30');
  t.hp = 5;
  b.events = [];
  b.deal(u, t, 100, 'physical', { kind: 'basic', canCrit: false });
  a.equal(A.plan(b.events, b.units)[0].text, '−5');
});
test('fully shielded hits show absorption without invented HP damage', () => {
  const b = new Battle([{ id: 'C03', pos: 31 }], [{ id: 'E06', pos: 24 }], { rng: () => 0.99 }),
    [u, t] = b.units;
  b.shield(t, 1000, 10, t);
  b.events = [];
  b.deal(u, t, 10, 'physical', { kind: 'basic', canCrit: false });
  const row = A.plan(b.events, b.units)[0];
  a.equal(row.amount, 0);
  a.equal(row.text, '흡수');
});
test('every cell maps to the same7x8 logical coordinate space', () => {
  a.deepEqual(A.point(0), { x: 0.5, y: 0.5 });
  a.deepEqual(A.point(55), { x: 6.5, y: 7.5 });
  a.equal(A.distance(0, 8), 2);
  a.equal(A.distance(6, 7), 7);
});
test('visual event consumption does not change seeded battles, RNG, gear procs or damage totals', () => {
  function run(withVisuals) {
    let seed = 941;
    const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
      ids = ['I26', 'I27', 'I39'],
      b = new Battle(
        [
          { id: 'C13', pos: 38, itemIds: ids, bonuses: I.bonuses(ids) },
          { id: 'C05', pos: 53 },
        ],
        [
          { id: 'E06', pos: 17 },
          { id: 'E03', pos: 18 },
          { id: 'E01', pos: 3 },
        ],
        { rng, quickMana: true },
      );
    let frames = 0;
    while (!b.result && frames++ < 2000) {
      b.tick();
      if (withVisuals) A.plan(b.events, b.units);
    }
    a(b.result);
    return {
      result: b.result,
      seed,
      units: clone(b.units),
      stats: b.statsTotal,
      skills: b.skillUses,
      logs: b.logs,
    };
  }
  a.deepEqual(run(true), run(false));
});
console.log('\n' + n + ' combat-presentation tests passed.');
