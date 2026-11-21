// Migrated from the v0.15.18 suite test-v01515.cjs (tests for: combat).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $combatClock from '../../src/core/combat/clock.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';
import { installCombatWorker } from '../support/combat-worker.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { StepClock } = $combatClock,
  { Battle } = $engine,
  P = $progression,
  V = $preparation;
test('wall-clock catch-up at1/2/4x, pause excludes hidden time, repeated time has zero steps', () => {
  for (const speed of [1, 2, 4]) {
    const c = new StepClock(0, 100, speed);
    a.equal(c.advance(10000), 100 * speed);
    a.equal(c.advance(10000), 0);
    c.paused = true;
    a.equal(c.advance(40000), 0);
    c.paused = false;
    a.equal(c.advance(41000), 10 * speed);
  }
});
test('worker normal/boss,1/2/4x, hidden catch-up and manual pause match deterministic direct simulation', () => {
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
      installCombatWorker(context);
      const initial = new Battle(
        [{ id: 'C01', uid: 1, pos: 27, itemIds: ['I28', 'I28'], bonuses: { HP: 800 } }],
        [{ id: 'E01', pos: 31, star: boss ? 3 : 1, boss }],
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
});
