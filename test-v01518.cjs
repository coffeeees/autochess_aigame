'use strict';
const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  D = require('./src/legacy/data'),
  P = require('./src/legacy/progression'),
  V = require('./src/legacy/preparation'),
  E = require('./src/legacy/engine'),
  F = require('./src/legacy/bond-effects');
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function test(n, fn) {
  fn();
  count++;
  console.log('PASS ' + n);
}
function setup(id, allies = [], positions = [24, 23, 3, 4, 5]) {
  const b = new E.Battle(
    [{ id, pos: 31 }, ...allies],
    positions.map((pos) => ({ id: 'E01', pos })),
    { rng: () => 0.99 },
  );
  for (const e of b.units.filter((u) => u.team === 'enemy')) {
    e.stats.HP = e.hp = 100000;
    e.stats.DOD = 0;
  }
  return [b, ...b.units];
}
test('C07 primary3×75AD physical, nearest0/1/2 other living targets70AD magic across board, stable ties', () => {
  for (const positions of [[24], [24, 0], [24, 0, 1, 2]]) {
    const [b, u, t] = setup('C07', [], positions);
    b.cast(u, t);
    const hits = b.logs.filter((e) => e.kind === 'damage');
    a.equal(hits.filter((h) => h.damageType === 'physical').length, 3);
    const magic = hits.filter((h) => h.damageType === 'magic');
    a.equal(magic.length, Math.min(2, positions.length - 1));
    for (const h of magic)
      near(
        h.amount,
        E.mitigatedDamage(u.stats.AD * 0.7, b.units.find((t) => t.uid === h.target).stats.GD),
      );
    const event = b.logs.find((e) => e.kind === 'chainLightning');
    a.equal(event.chains.length, magic.length);
    a(!event.chains.some((t) => t.uid === u.uid || t.uid === b.units[1].uid));
  }
  const [b, u, t, x, y] = setup('C07', [], [24, 23, 25]);
  b.cast(u, t);
  a.deepEqual(
    b.logs.find((e) => e.kind === 'chainLightning').chains.map((t) => t.uid),
    [x.uid, y.uid],
  );
});
test('C07 dead primary can anchor confirmed chain, dead/exhausted extra targets never duplicated', () => {
  const [b, u, t, x, y] = setup('C07');
  t.hp = 1;
  x.dead = true;
  x.hp = 0;
  b.cast(u, t);
  const event = b.logs.find((e) => e.kind === 'chainLightning');
  a(event.primary.landed);
  a(!event.chains.some((p) => p.uid === x.uid));
  a.equal(new Set(event.chains.map((p) => p.uid)).size, event.chains.length);
});
test('C34 team140AP plus lowest-ratio additional160AP, stable UID', () => {
  const [b, u, x, t] = setup('C34', [{ id: 'C01', pos: 32 }]);
  u.stats.HP = x.stats.HP = 10000;
  u.hp = 100;
  x.hp = 200;
  b.cast(u, t);
  near(u.hp, 100 + u.stats.AP * 3);
  near(x.hp, 200 + u.stats.AP * 1.4);
});
test('C35 at most4 targets210AP and four25AP poison ticks', () => {
  const [b, u, t] = setup('C35');
  b.cast(u, t);
  const hits = b.logs.filter((e) => e.attackKind === 'skill');
  a.equal(hits.length, 4);
  for (const e of b.enemies(u).slice(0, 4)) {
    a(e.statuses.some((s) => s.key === 'venomStorm' && s.expires === 4));
  }
  for (const x of b.units) x.castUntil = 999;
  for (let i = 0; i < 41; i++) b.tick();
  a.equal(b.logs.filter((e) => e.attackKind === 'dot' && e.source === u.uid).length, 16);
});
test('C36 physical300AD then25%GD debuff4s', () => {
  const [b, u, t] = setup('C36');
  b.cast(u, t);
  near(t.stats.HP - t.hp, E.mitigatedDamage(u.stats.AD * 3, t.stats.GD));
  near(b.stats(t).GD, t.stats.GD * 0.75);
  a.equal(t.statuses[0].expires, 4);
});
test('C37 costs currentHP8%, minimum1, three210AD hits', () => {
  const [b, u, t] = setup('C37');
  u.hp = 500;
  b.cast(u, t);
  near(u.hp, 460);
  a.equal(b.logs.filter((e) => e.attackKind === 'skill').length, 3);
  u.hp = 1;
  b.cast(u, t);
  near(u.hp, 1);
});
test('C38 exactly2 specters,400HP×star,70AP magic,10sec duration/cap2, existing BFS/gear hooks', () => {
  const [b, u, t] = setup('C38');
  u.star = 2;
  b.cast(u, t);
  b.cast(u, t);
  const pets = b.units.filter((x) => x.summon);
  a.equal(pets.length, 2);
  for (const pet of pets) {
    near(pet.stats.HP, 800);
    near(pet.stats.AD, b.stats(u).AP * 0.7);
    near(pet.stats.AS, 0.85);
    a.equal(pet.stats.RNG, 2);
    a.equal(pet.attackType, 'magic');
    near(pet.expires, 10);
    a(!pet.bondRules);
  }
  b.time = 10;
  b.tick();
  a(pets.every((p) => p.dead));
});
test('C39 self/orthogonal shields220AP5s; only landed basic while shield active slows attacker20%3s', () => {
  const [b, u, x, t] = setup('C39', [{ id: 'C01', pos: 32 }]);
  b.cast(u, t);
  near(u.shields[0].amount, u.stats.AP * 2.2);
  a.equal(x.shields.length, 1);
  b.deal(t, u, 1, 'physical', { kind: 'basic' });
  near(b.stats(t).AS, t.stats.AS * 0.8);
  a.equal(t.statuses[0].expires, 3);
  t.statuses = [];
  b.time = 5;
  b.deal(t, u, 1, 'physical', { kind: 'basic' });
  a.equal(t.statuses.length, 0);
});
test('C40 four100AD skill hits, final only+30pp critical bonus', () => {
  const [b, u, t] = setup('C40');
  u.stats.CTC = 90;
  b.rng = () => 0.2;
  b.cast(u, t);
  const hits = b.logs.filter((e) => e.kind === 'damage');
  a.equal(hits.length, 4);
  a(hits.slice(0, 3).every((h) => !h.critical));
  a(hits[3].critical);
});
test('C41 front half-plane around primary max3 at240AD/stun1s', () => {
  const [b, u, t] = setup('C41', [], [24, 23, 25, 17, 3]);
  b.cast(u, t);
  a.equal(b.logs.filter((e) => e.attackKind === 'skill').length, 3);
  a(
    b
      .enemies(u)
      .slice(0, 3)
      .every((t) => t.statuses.some((s) => s.key === 'stun' && s.expires === 1)),
  );
});
test('C42 global230AP magic and25%AS slow3s', () => {
  const [b, u, t] = setup('C42');
  b.cast(u, t);
  a.equal(b.logs.filter((e) => e.kind === 'damage').length, 5);
  for (const e of b.enemies(u)) {
    near(e.stats.HP - e.hp, E.mitigatedDamage(u.stats.AP * 2.3, e.stats.GD));
    near(b.stats(e).AS, e.stats.AS * 0.75);
  }
});
test('C43 six90AD primary hits then150AP on orthogonal neighbors excluding primary', () => {
  const [b, u, t] = setup('C43', [], [24, 23, 25, 3]);
  b.cast(u, t);
  const hits = b.logs.filter((e) => e.kind === 'damage');
  a.equal(hits.filter((e) => e.damageType === 'physical').length, 6);
  a.equal(hits.filter((e) => e.damageType === 'magic').length, 2);
});
test('C44 farthest rear charge350AD/stun2s, blocked path no teleport', () => {
  const [b, u, t] = setup('C44', [], [24, 3]);
  b.cast(u, t);
  const rear = b.units[2];
  a(b.adjacent(u, rear));
  a(rear.statuses.some((s) => s.key === 'stun' && s.expires === 2));
  const c = setup(
    'C44',
    [
      { id: 'C01', pos: 24 },
      { id: 'C03', pos: 30 },
      { id: 'C05', pos: 32 },
      { id: 'C06', pos: 38 },
    ],
    [3],
  )[0];
  c.cast(c.units[0], c.units.at(-1));
  a.equal(c.units[0].pos, 31);
  a.equal(c.units.at(-1).hp, c.units.at(-1).stats.HP);
});
test('C45 grid ray closest max4,300AD,15%damage taken4s, repeated mark refresh not stack', () => {
  const [b, u, t] = setup('C45', [], [24, 17, 10, 3, 25]);
  b.cast(u, t);
  const hits = b.logs.filter((e) => e.kind === 'damage');
  a.equal(hits.length, 4);
  a(hits.every((e) => e.amount > 0));
  a(!b.units.at(-1).statuses.length);
  const before = t.hp;
  b.deal(u, t, 100);
  near(before - t.hp, E.mitigatedDamage(115, t.stats.GD));
  b.addStatus(t, { key: 'doomArrow', source: u.uid, damageAmp: 0.15, expires: 4, harmful: true });
  a.equal(t.statuses.length, 1);
  b.time = 4;
  const h = t.hp;
  b.deal(u, t, 100);
  near(h - t.hp, E.mitigatedDamage(100, t.stats.GD));
});
test('45 playable/unmodified draft stats, raw original odds every level, real cost4/5 samples and six tiers', () => {
  a.equal(D.playableIds.length, 45);
  for (let l = 1; l <= 10; l++) a.deepEqual(V.shopOdds({ level: l, units: [] }), V.baseOdds[l]);
  for (const [l, roll, cost] of [
    [5, 0.99, 4],
    [7, 0.999, 5],
    [10, 0.4, 4],
    [10, 0.9, 5],
  ]) {
    let n = 0;
    a.equal(D.byId(V.drawShop({ level: l, units: [] }, () => (n++ ? 0 : roll))).cost, cost);
  }
  for (const bond of D.synergies.filter((b) => b.thresholds.includes(6))) {
    const ids = D.roster
      .filter((u) => u.bonds.includes(bond.name))
      .slice(0, 6)
      .map((u) => u.id);
    a.equal(D.evaluateSynergies(ids).find((b) => b.name === bond.name).threshold, 6);
    const b = new E.Battle(
      ids.map((id, i) => ({ id, pos: 35 + i })),
      [{ id: 'E01', pos: 0 }],
      { rng: () => 0.99 },
    );
    a.equal(b.synergySnapshot.ally.find((e) => e.name === bond.name).threshold, 6);
  }
});
test('all12 new units run with normal gear/augments and finish finite battles', () => {
  for (const id of D.playableIds.slice(33)) {
    const b = new E.Battle(
      [{ id, pos: 35, itemIds: ['I27', 'I28', 'I35'] }],
      [
        { id: 'E01', pos: 0 },
        { id: 'E06', pos: 1 },
      ],
      { quickMana: true, rng: () => 0.8, allyModifiers: { augmentIds: ['P04', 'G08'] } },
    );
    for (let i = 0; i < 1500 && !b.result; i++) b.tick();
    a(b.result, id);
    a(b.skillUses[id] > 0, id);
    a(
      b.units.every((u) => Number.isFinite(u.hp)),
      id,
    );
  }
});
test('1000ms simulated worker startup stall: old starts at1s, prepare/begin stays0 then first0.1s at1/2/4x', () => {
  for (const speed of [1, 2, 4]) {
    let now = 1000,
      pump,
      messages = [];
    const ctx = vm.createContext({
      Math,
      Date: { now: () => now },
      setInterval: (f) => ((pump = f), 1),
      clearInterval() {},
      postMessage: (x) => messages.push(structuredClone(x)),
    });
    ctx.importScripts = (...files) =>
      files.forEach((f) => vm.runInContext(fs.readFileSync('src/legacy/' + f, 'utf8'), ctx));
    vm.runInContext(fs.readFileSync('src/legacy/combat-worker.js', 'utf8'), ctx);
    const b = setup('C03')[0],
      input = { battle: JSON.parse(JSON.stringify(b)), now: 0, speed, hidden: false };
    ctx.input = { ...structuredClone(input), type: 'start' };
    vm.runInContext('onmessage({data:input})', ctx);
    near(messages.at(-1).battle.time, speed);
    messages = [];
    ctx.input = { ...structuredClone(input), type: 'prepare' };
    vm.runInContext('onmessage({data:input})', ctx);
    a.equal(messages[0].type, 'ready');
    ctx.input = { type: 'begin', now, speed };
    vm.runInContext('onmessage({data:input})', ctx);
    near(messages.at(-1).battle.time, 0);
    now += 100;
    pump();
    near(messages.at(-1).battle.time, 0.1 * speed);
  }
});
console.log(count + ' v0.15.18 tests passed.');
