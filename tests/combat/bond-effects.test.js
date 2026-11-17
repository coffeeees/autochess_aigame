// Migrated from the v0.15.18 suite test-v01517.cjs (tests for: combat).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  fs = require('fs'),
  D = require('../../src/legacy/data'),
  B = require('../../src/legacy/bonds'),
  F = require('../../src/legacy/bond-effects'),
  { Battle, mitigatedDamage } = require('../../src/legacy/engine'),
  P = require('../../src/legacy/progression'),
  V = require('../../src/legacy/preparation');
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
function setup(name, tier = 2) {
  const b = new Battle(
    [
      { id: 'C01', pos: 35 },
      { id: 'C03', pos: 36 },
    ],
    [
      { id: 'E01', pos: 28 },
      { id: 'E02', pos: 29 },
    ],
    { rng: () => 0.99 },
  );
  b.synergySnapshot.ally = [{ name, tier, threshold: tier * 2, members: ['C01'] }];
  b.synergySnapshot.enemy = [];
  F.init(b);
  return [b, ...b.units];
}
test('actual 33 playable mixed gear/augments battles terminate with finite stats and no duplicated cells', () => {
  for (let i = 0; i < 33; i += 6) {
    const ids = D.playableIds.slice(i, i + 6),
      b = new Battle(
        ids.map((id, k) => ({ id, pos: 35 + k, itemIds: ['I27', 'I28', 'I35'] })),
        [
          { id: 'E03', pos: 0, star: 3 },
          { id: 'E04', pos: 1, star: 3 },
        ],
        { rng: () => 0.7, quickMana: true, allyModifiers: { augmentIds: ['P04', 'G07', 'G08'] } },
      );
    for (let k = 0; k < 1500 && !b.result; k++) b.tick();
    a(b.result);
    for (const u of b.units) {
      a(Number.isFinite(u.hp));
      for (const n of Object.values(b.stats(u))) a(Number.isFinite(n));
    }
    a.equal(new Set(b.alive().map((u) => u.pos)).size, b.alive().length);
  }
});
test('all16 theme snapshots at each tier match real Worker execution and hidden-time catch-up', () => {
  const vm = require('vm');
  for (const name of Object.keys(B.rules))
    for (let tier = 1; tier <= B.rules[name].length; tier++) {
      const [battle] = setup(name, tier);
      let now = 0,
        pump,
        messages = [];
      const math = Object.create(Math);
      math.random = () => 0.99;
      const ctx = vm.createContext({
        Math: math,
        Date: { now: () => now },
        setInterval: (fn) => ((pump = fn), 1),
        clearInterval() {},
        postMessage: (m) => messages.push(structuredClone(m)),
      });
      ctx.importScripts = (...files) =>
        files.forEach((file) =>
          vm.runInContext(fs.readFileSync('src/legacy/' + file, 'utf8'), ctx),
        );
      vm.runInContext(fs.readFileSync('src/legacy/combat-worker.js', 'utf8'), ctx);
      ctx.input = {
        type: 'start',
        battle: JSON.parse(JSON.stringify(battle)),
        now: 0,
        speed: 4,
        hidden: true,
      };
      vm.runInContext('onmessage({data:input})', ctx);
      now = 200000;
      pump();
      while (!battle.result) battle.tick();
      const final = messages.at(-1).battle;
      a.deepEqual(final.result, JSON.parse(JSON.stringify(battle.result)), name + ' ' + tier);
      a.deepEqual(
        final.units.map((u) => [u.uid, u.hp, u.pos, u.mp]),
        battle.units.map((u) => [u.uid, u.hp, u.pos, u.mp]),
        name + ' ' + tier,
      );
    }
});
