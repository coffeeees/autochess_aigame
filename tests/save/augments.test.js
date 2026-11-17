// Migrated from the v0.15.18 suite test-augments.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  A = require('../../src/legacy/augments'),
  P = require('../../src/legacy/progression'),
  D = require('../../src/legacy/data'),
  I = require('../../src/legacy/items'),
  V = require('../../src/legacy/preparation'),
  F = require('../../src/legacy/augment-effects'),
  { Battle } = require('../../src/legacy/engine');
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
test('old v1/v2 saves migrate without retroactive picks/rewards and keep legacy effects', () => {
  for (const node of ['1-3', '2-1', '3-3', '6-1']) {
    const s = state();
    [s.stage, s.round] = node.split('-').map(Number);
    s.augments = ['training', 'mana', 'funds'];
    delete s.augmentState;
    s.augmentSelections = { 2: 'training' };
    s.roundPhase = 'augment';
    const before = s.gold;
    P.migrate(s);
    a.equal(s.gold, before);
    a.equal(P.label(s), node);
    a.equal(s.roundPhase, 'prepare');
    a(!P.ensureAugment(s));
    a.deepEqual(s.augments, ['training', 'mana', 'funds']);
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
