// Migrated from the v0.15.18 suite test-v01518.cjs (tests for: skills).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $bondEffects from '../../src/core/combat/bond-effects.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  D = $data,
  P = $progression,
  V = $preparation,
  E = $engine,
  F = $bondEffects;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function setup(id, allies = [], positions = [28, 20, 31, 39, 47]) {
  const b = new E.Battle(
    [{ id, pos: 27 }, ...allies],
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
  for (const positions of [[28], [28, 7], [28, 7, 15, 23]]) {
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
  const [b, u, t, x, y] = setup('C07', [], [28, 20, 36]);
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
  const [b, u, x, t] = setup('C34', [{ id: 'C01', pos: 35 }]);
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
  const [b, u, x, t] = setup('C39', [{ id: 'C01', pos: 35 }]);
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
  const [b, u, t] = setup('C41', [], [28, 20, 36, 29, 31]);
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
  const [b, u, t] = setup('C43', [], [28, 20, 36, 31]);
  b.cast(u, t);
  const hits = b.logs.filter((e) => e.kind === 'damage');
  a.equal(hits.filter((e) => e.damageType === 'physical').length, 6);
  a.equal(hits.filter((e) => e.damageType === 'magic').length, 2);
});
test('C44 farthest rear charge350AD/stun2s, blocked path no teleport', () => {
  const [b, u, t] = setup('C44', [], [28, 31]);
  b.cast(u, t);
  const rear = b.units[2];
  a(b.adjacent(u, rear));
  a(rear.statuses.some((s) => s.key === 'stun' && s.expires === 2));
  const c = setup(
    'C44',
    [
      { id: 'C01', pos: 28 },
      { id: 'C03', pos: 19 },
      { id: 'C05', pos: 35 },
      { id: 'C06', pos: 26 },
    ],
    [3],
  )[0];
  c.cast(c.units[0], c.units.at(-1));
  a.equal(c.units[0].pos, 27);
  a.equal(c.units.at(-1).hp, c.units.at(-1).stats.HP);
});
test('C45 grid ray closest max4,300AD,15%damage taken4s, repeated mark refresh not stack', () => {
  const [b, u, t] = setup('C45', [], [28, 29, 30, 31, 36]);
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
