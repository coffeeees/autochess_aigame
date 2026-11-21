// Migrated from the v0.15.18 suite test-vfx18.cjs (tests for: combat).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import { installCombatWorker } from '../support/combat-worker.js';

const a = require('assert/strict'),
  fs = require('fs'),
  vm = require('vm'),
  D = $data,
  { Battle } = $engine;
let count = 0;
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
  installCombatWorker(ctx);
  const b = new Battle(
    [{ id: 'C07', pos: 2 }],
    [
      { id: 'E01', pos: 3 },
      { id: 'E02', pos: 52 },
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
