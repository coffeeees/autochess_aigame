// Migrated from the v0.15.18 suite test-augments.cjs (tests for: augments).
// v0.17.0: 이전 증강 36종의 효과 테스트는 증강과 함께 지웠다. 선택 규칙 테스트만 남는다(새 증강 효과는 augment54.test.js).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $augmentEffects from '../../src/core/combat/augment-effects.js';
import $augments from '../../src/core/augments.js';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  A = $augments,
  P = $progression,
  D = $data,
  I = $items,
  V = $preparation,
  F = $augmentEffects,
  { Battle } = $engine;
const clone = (x) => JSON.parse(JSON.stringify(x)),
  near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
let count = 0;
const state = () =>
  P.initialize({ gold: 7, health: 100, units: [], shop: [], recommendedBond: null });
function pending(id, node = '1-3') {
  const s = state(),
    def = A.byId(id);
  s.augmentState.pendingPick = {
    node,
    pick: A.config.nodes.indexOf(node) + 1,
    tier: def.tier,
    optionIds: [
      id,
      ...A.augments
        .filter((t) => t.tier === def.tier && t.id !== id)
        .slice(0, 2)
        .map((t) => t.id),
    ],
  };
  s.roundPhase = 'augment';
  return s;
}
function battle(ids = [], id = 'C03', gear = []) {
  return new Battle(
    [
      { id, pos: 26, itemIds: gear, bonuses: I.bonuses(gear) },
      { id: id === 'C05' ? 'C03' : 'C05', pos: 32 },
    ],
    [
      { id: 'E06', pos: 27 },
      { id: 'E01', pos: 31 },
    ],
    { rng: () => 0.99, allyModifiers: { augmentIds: ids } },
  );
}
test('v0.17.0: 증강 54종(등급별 18종)이 모두 고유 ID를 갖고, 이전 증강은 없다', () => {
  a.equal(A.augments.length, 54);
  a.equal(new Set(A.augments.map((t) => t.id)).size, 54);
  a.equal(A.legacy, undefined, '이전 증강 36종은 v0.17.0에서 지움');
  for (const [prefix, tier] of [
    ['S', 'silver'],
    ['G', 'gold'],
    ['P', 'prism'],
  ]) {
    for (let i = 1; i <= 18; i++) {
      const def = A.byId(prefix + String(i).padStart(2, '0'));
      a(def?.name && def.text && Object.keys(def.effect).length);
      a.equal(def.tier, tier);
    }
    a.equal(A.byId('L' + prefix + '01'), undefined);
  }
  a.deepEqual(
    A.augments.filter((x) => x.hold).map((x) => x.id),
    [],
    'G13도 후보로 나옴(쌍둥이 전술 예외 허용)',
  );
  a.deepEqual(A.config.nodes, ['1-3', '3-3', '5-3']);
});
test('uniform independent tier boundaries and unbiased three-without-replacement candidate sampling', () => {
  for (const [roll, tier] of [
    [0, 'silver'],
    [1 / 3 - 1e-9, 'silver'],
    [1 / 3, 'gold'],
    [2 / 3 - 1e-9, 'gold'],
    [2 / 3, 'prism'],
    [0.999999, 'prism'],
  ]) {
    let first = true;
    const x = A.draw([], () => (first ? ((first = false), roll) : 0));
    a.equal(x.tier, tier);
    a.equal(new Set(x.optionIds).size, 3);
    a(x.optionIds.every((id) => A.byId(id).tier === tier));
  }
  let seed = 124;
  const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
    counts = { silver: 0, gold: 0, prism: 0 },
    ids = {};
  for (let i = 0; i < 24000; i++) {
    const draw = A.draw([], rng);
    counts[draw.tier]++;
    for (const id of draw.optionIds) ids[id] = (ids[id] || 0) + 1;
  }
  for (const n of Object.values(counts)) a(Math.abs(n - 8000) < 350);
  // 등급 안에서 고르게: 등급마다 18종
  for (const [id, n] of Object.entries(ids)) a(Math.abs(n - (8000 * 3) / 18) < 220, id);
  a.equal(Object.keys(ids).length, 54);
});
test('selected IDs excluded; offered but unchosen may return; repeated grades allowed', () => {
  let selected = [];
  for (let pick = 0; pick < 3; pick++) {
    const d = A.draw(selected, () => 0);
    a.equal(d.tier, 'silver');
    a.equal(d.optionIds.length, 3);
    a(d.optionIds.every((id) => !selected.includes(id)));
    if (pick === 1) a(d.optionIds.includes('S02'));
    selected.push(d.optionIds[0]);
  }
  a.deepEqual(selected, ['S01', 'S02', 'S03']);
});
test('gates happen before node entry, supply3-3/5-3 preserved and completed picks never reopen', () => {
  for (const node of A.config.nodes) {
    const [stage, round] = node.split('-').map(Number),
      s = state();
    s.stage = stage;
    s.round = round - 1;
    s.wave = P.ordinal(s);
    s.roundPhase = 'result';
    s.completedRounds[P.label(s)] = { key: P.label(s) };
    const before = P.label(s);
    a(P.advanceRound(s, () => 0));
    a.equal(P.label(s), before);
    a.equal(s.roundPhase, 'augment');
    a.equal(s.augmentState.pendingPick.node, node);
    a(!P.advanceRound(s));
    a.equal(P.beginSupply(s), null);
    a(!P.buyXp(s));
    const choice = P.availableAugments(s)[0].id;
    a(P.chooseAugment(s, choice));
    a.equal(P.label(s), node);
    a.equal(s.roundPhase, 'prepare');
    a.equal(P.roundType(s.stage, s.round), stage === 1 ? 'BATTLE' : 'SUPPLY');
    a(!P.ensureAugment(s));
  }
  for (const stage of [2, 4, 6]) {
    const s = state();
    s.stage = stage;
    a(!P.ensureAugment(s));
  }
});
test('pending tier/options survive migrate, refresh and confirmation; stale double click is inert', () => {
  const s = pending('G10');
  const restored = P.migrate(clone(s));
  a(
    P.ensureAugment(restored, () => {
      throw Error('reroll');
    }),
  );
  a.deepEqual(restored.augmentState.pendingPick, s.augmentState.pendingPick);
  a(P.chooseAugment(restored, 'G10'));
  const before = clone(restored);
  a(!P.chooseAugment(restored, 'G10'));
  a(!P.chooseAugment(restored, 'G01'));
  a.deepEqual(restored, before);
  P.migrate(restored);
  a.deepEqual(restored, before);
});
