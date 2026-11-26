// Migrated from the v0.15.18 suite test-items.cjs (tests for: ui).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $patchNotes from '../../src/content/patch-notes.js';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $itemEffects from '../../src/core/combat/item-effects.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  I = $items,
  P = $progression,
  D = $data,
  V = $preparation,
  F = $itemEffects,
  { Battle, mitigatedDamage } = $engine;
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`),
  clone = (x) => JSON.parse(JSON.stringify(x));
function state(stage = 1, round = 1) {
  const s = P.initialize({
    health: 100,
    gold: 12,
    units: [
      { id: 'C03', uid: 1, star: 1, pos: 27, location: 'board' },
      { id: 'C05', uid: 2, star: 1, pos: 35, location: 'board' },
    ],
    shop: [],
  });
  s.stage = stage;
  s.round = round;
  return s;
}
function battle(ids = [], id = 'C03', options = {}) {
  return new Battle(
    [
      { id, uid: 1, pos: 27, itemIds: ids, bonuses: I.bonuses(ids) },
      { id: id === 'C05' ? 'C03' : 'C05', uid: 2, pos: 35 },
    ],
    [
      { id: 'E06', pos: 28 },
      { id: 'E03', pos: 20 },
      { id: 'E01', pos: 29 },
    ],
    { rng: () => 0.99, ...options },
  );
}
function choose(s, rng = () => 0.1) {
  P.beginSupply(s, rng);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
function freeze(b) {
  for (const u of b.units) u.castUntil = 999;
}
test('patch notes include v0.1..0.15.11 history and current equipment 8 + 36(v0.20.0)', () => {
  const N = $patchNotes;
  a.equal(N.history[0].version, '0.1');
  a(
    N.history.some((h) => h.version === '0.15.18'),
    '원본 마지막 버전 기록 보존',
  );
  a.equal(N.history.at(-1).version, '0.26.3');
  a.equal(N.current, '0.26.3');
  const text = N.toMarkdown();
  a(text.includes('미구현'));
  a(text.includes('시작7G'));
  a.equal((text.match(/^- IB\d{2} \/ 기본/gm) || []).length, 8);
  a.equal((text.match(/^- IC\d{2} \/ 완성/gm) || []).length, 36);
});
