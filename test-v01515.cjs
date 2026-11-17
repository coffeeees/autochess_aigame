'use strict';
const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { StepClock } = require('./dist/combat-clock'),
  { Battle } = require('./dist/engine'),
  P = require('./dist/progression'),
  V = require('./dist/preparation');
for (const speed of [1, 2, 4]) {
  const c = new StepClock(0, 100, speed);
  a.equal(c.advance(10000), 100 * speed);
  a.equal(c.advance(10000), 0);
  c.paused = true;
  a.equal(c.advance(40000), 0);
  c.paused = false;
  a.equal(c.advance(41000), 10 * speed);
}
console.log(
  'PASS wall-clock catch-up at1/2/4x, pause excludes hidden time, repeated time has zero steps',
);
for (const speed of [1, 2, 4])
  for (const boss of [false, true]) {
    let now = 0,
      callback = null,
      messages = [];
    const math = Object.create(Math);
    math.random = () => 0.99;
    const context = vm.createContext({
      Math: math,
      Date: { now: () => now },
      setInterval: (fn) => ((callback = fn), 1),
      clearInterval: () => {},
      postMessage: (data) => messages.push(structuredClone(data)),
    });
    context.importScripts = (...files) =>
      files.forEach((file) => vm.runInContext(fs.readFileSync('dist/' + file, 'utf8'), context));
    vm.runInContext(fs.readFileSync('dist/combat-worker.js', 'utf8'), context);
    const initial = new Battle(
      [{ id: 'C01', uid: 1, pos: 31, itemIds: ['I28', 'I28'], bonuses: { HP: 800 } }],
      [{ id: 'E01', pos: 3, star: boss ? 3 : 1, boss }],
      { rng: () => 0.99 },
    );
    context.input = {
      type: 'start',
      battle: JSON.parse(JSON.stringify(initial)),
      speed,
      now: 0,
      hidden: true,
    };
    vm.runInContext('onmessage({data:input})', context);
    now = 3000;
    callback();
    const time = messages.at(-1).battle.time;
    context.input = { type: 'pause' };
    vm.runInContext('onmessage({data:input})', context);
    now += 30000;
    callback();
    a.equal(messages.at(-1).battle.time, time);
    context.input = { type: 'resume' };
    vm.runInContext('onmessage({data:input})', context);
    now += 200000;
    callback();
    const final = messages.at(-1).battle;
    while (!initial.result) initial.tick();
    a.deepEqual(final.result, JSON.parse(JSON.stringify(initial.result)));
    a.deepEqual(
      final.units.map((u) => [u.uid, u.hp, u.pos]),
      initial.units.map((u) => [u.uid, u.hp, u.pos]),
    );
  }
console.log(
  'PASS worker normal/boss,1/2/4x, hidden catch-up and manual pause match deterministic direct simulation',
);
const s = P.initialize({
  units: [{ uid: 1, id: 'C01', star: 1, location: 'board', pos: 31 }],
  health: 100,
  gold: 7,
  shop: [],
});
for (let i = 0; i < 3; i++) a(V.transferItem(s, P.addItem(s, 'I28').uid, 1).ok);
a(!V.transferItem(s, P.addItem(s, 'I28').uid, 1).ok);
const copy = V.normalize(P.migrate(JSON.parse(JSON.stringify(s))));
a.equal(copy.inventory.filter((i) => i.equippedTo === 1).length, 3);
a.deepEqual(P.unitBonuses(copy, 1), P.unitBonuses(s, 1));
a.equal(require('./dist/notice-policy').allows('T24'), false);
console.log(
  'PASS duplicateT3 three-slot limit, migration and bonuses survive round-trip; T24 disabled',
);
console.log('\n3 v0.15.15 regression tests passed.');
