// Migrated from the v0.15.18 suite test-interface.cjs (tests for: board).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = $data,
  P = $progression,
  W = $encounters,
  V = $preparation;
let count = 0;
const elements = new Map();
function element(id) {
  if (!elements.has(id))
    elements.set(id, {
      id,
      innerHTML: '',
      disabled: false,
      open: false,
      classList: { toggle() {}, add() {}, remove() {} },
      handlers: {},
      addEventListener(type, fn) {
        (this.handlers[type] ??= []).push(fn);
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      getBoundingClientRect() {
        return { left: 100, top: 100, right: 800, bottom: 600 };
      },
    });
  return elements.get(id);
}
const document = {
  getElementById: element,
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  body: { classList: { remove() {} } },
  handlers: {},
  addEventListener(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  },
};
test('deployment warning counts empty/partial/full with P12 and suppression persists only for the run', () => {
  const s = P.initialize({ units: [], gold: 7, health: 100 });
  a(V.deploymentStatus(s).shouldWarn);
  s.units = [{ location: 'board' }, { location: 'board' }, { location: 'board' }];
  a(!V.deploymentStatus(s).shouldWarn);
  s.augments = ['P13']; // v0.16.0: 배치 한도 +1은 P13(이전 P12는 LP12)
  a.equal(V.deploymentStatus(s).missing, 1);
  a(V.deploymentStatus(s).shouldWarn);
  s.skipDeploymentWarning = true;
  a(!V.deploymentStatus(P.migrate(JSON.parse(JSON.stringify(s)))).shouldWarn);
  P.initialize(s);
  a.equal(s.skipDeploymentWarning, false);
});
