// Migrated from the v0.15.18 suite test-v0159.cjs (tests for: bonds).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import { shownBonds } from '../../src/ui/data.ts';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
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
  { Battle, mitigatedDamage } = $engine;
$bondEffects.init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
const battle = (
  id,
  allies = [],
  enemies = [
    { id: 'E06', pos: 28 },
    { id: 'E03', pos: 20 },
    { id: 'E01', pos: 31 },
  ],
) => new Battle([{ id, pos: 27 }, ...allies], enemies, { rng: () => 0.99 });
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
test('active themes precede inactive themes without changing evaluation', () => {
  const units = [
    { id: 'C01', uid: 1, location: 'board', pos: 27 },
    { id: 'C28', uid: 2, location: 'board', pos: 35 },
    { id: 'C07', uid: 3, location: 'board', pos: 43 },
  ];
  const all = D.evaluateSynergies(units);
  const before = JSON.stringify(all);
  const names = shownBonds(all).map((b) => b.name);
  a(names.indexOf('종언') < names.indexOf('운명'));
  a(names.indexOf('종언') >= 0);
  a.equal(JSON.stringify(all), before, '판정 결과는 그대로');
});
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
const seed = () =>
  vm.runInContext(
    'queueMergeEffect({uid:1},[{uid:2},{uid:3}],{left:0,top:0,width:40,height:40});flushMergeEffects();',
    fx,
  );
