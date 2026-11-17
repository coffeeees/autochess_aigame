// Migrated from the v0.15.18 suite test-v01518.cjs (tests for: combat).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  D = require('../../src/legacy/data'),
  P = require('../../src/legacy/progression'),
  V = require('../../src/legacy/preparation'),
  E = require('../../src/legacy/engine'),
  F = require('../../src/legacy/bond-effects');
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
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
