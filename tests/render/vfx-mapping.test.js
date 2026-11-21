// Migrated from the v0.15.18 suite test-v01516.cjs (tests for: render).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';
import $vfxEvents from '../../src/core/combat/vfx-events.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
const D = $data,
  P = $progression,
  V = $preparation,
  W = $encounters;
const E = $engine,
  Events = $vfxEvents;
let count = 0;
function rng() {
  let seed = 412;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function simulate(id) {
  const battle = new E.Battle(
    [{ id, pos: 27, itemIds: ['I27', 'I39'], bonuses: { HP: 200 } }],
    [
      { id: 'E06', pos: 31, star: 2 },
      { id: 'E01', pos: 39 },
    ],
    { rng: rng(), quickMana: true },
  );
  while (!battle.result) battle.tick();
  return {
    result: battle.result,
    units: battle.units,
    logs: battle.logs.map(({ visual, ...row }) => row),
  };
}
const before = D.playableIds.map(simulate);
Events.install(E.Battle);
test('visual metadata preserves all33 deterministic battles including damage, RNG, final units and log ordering', () => {
  D.playableIds.forEach((id, index) => a.deepEqual(simulate(id), before[index], id));
});
