// Migrated from the v0.15.18 suite test-augments.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $augmentEffects from '../../src/core/combat/augment-effects.js';
import $augments from '../../src/core/augments.js';
import $data from '../../src/core/data/units.js';
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
      { id, pos: 38, itemIds: gear, bonuses: I.bonuses(gear) },
      { id: id === 'C05' ? 'C03' : 'C05', pos: 53 },
    ],
    [
      { id: 'E06', pos: 31 },
      { id: 'E01', pos: 3 },
    ],
    { rng: () => 0.99, allyModifiers: { augmentIds: ids } },
  );
}
// v0.17.0: 이전 버전 저장은 이관하지 않고 지운다(tests/save/save-system.test.js). 여기서는 현재 버전 저장의
// 증강 상태가 비었을 때 지난 선택 시점을 소급해 열지 않는지 확인한다.
test('증강 상태가 빠진 저장은 지난 선택 시점을 소급하지 않고, 지운 이전 증강 ID는 버린다', () => {
  for (const node of ['1-3', '2-1', '3-3', '6-1']) {
    const s = state();
    [s.stage, s.round] = node.split('-').map(Number);
    s.augments = ['S07', 'LS01', 'training'];
    delete s.augmentState;
    s.roundPhase = 'augment';
    const before = s.gold;
    P.migrate(s);
    a.equal(s.gold, before);
    a.equal(P.label(s), node);
    a.equal(s.roundPhase, 'prepare');
    a(!P.ensureAugment(s));
    a.deepEqual(s.augments, ['S07'], '이전 증강 ID(LS01·training)는 남지 않음');
    a(s.augmentState.skippedPicks.every((n) => A.nodeOrdinal(n) <= A.nodeOrdinal(node)));
  }
  const s = state();
  s.round = 2;
  delete s.augmentState;
  P.migrate(s);
  s.completedRounds['1-2'] = {};
  s.roundPhase = 'result';
  a(P.advanceRound(s, () => 0));
  a.equal(s.augmentState.pendingPick.node, '1-3');
});
