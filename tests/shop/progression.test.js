// Migrated from the v0.15.18 suite test-progression.cjs (tests for: shop).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const assert = require('node:assert/strict'),
  D = require('../../src/legacy/data.js'),
  P = require('../../src/legacy/progression.js'),
  { Battle } = require('../../src/legacy/engine.js');
const clone = (x) => JSON.parse(JSON.stringify(x)),
  near = (a, b) => assert(Math.abs(a - b) < 1e-6);
let count = 0;
function state() {
  return P.initialize({
    health: 100,
    gold: 12,
    units: [
      { uid: 1, id: 'C03', location: 'board', pos: 38, star: 1 },
      { uid: 2, id: 'C05', location: 'board', pos: 53, star: 1 },
    ],
    shop: D.playableIds.slice(0, 5),
  });
}
function at(stage, round, gold = 12) {
  const s = state();
  s.stage = stage;
  s.round = round;
  s.wave = P.ordinal(s);
  s.gold = gold;
  return s;
}
function supply(s, rng = () => 0.1) {
  P.beginSupply(s, rng);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
function combat(s, winner = 'ally', rng = () => 0.8) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner, time: 10, survivingEnemies: winner === 'ally' ? 0 : 2 }, rng);
}
test('recommendation uses playable pool only and includes off-board members', () => {
  assert.deepEqual(P.recommendedMembers('철혈'), ['C03', 'C10', 'C22', 'C23', 'C36']);
  assert.deepEqual(P.recommendedMembers('금단'), ['C02', 'C08', 'C17', 'C20', 'C35', 'C38', 'C43']);
  assert.deepEqual(P.recommendedMembers('생명'), ['C05', 'C18', 'C19', 'C30', 'C34', 'C39']);
  assert.deepEqual(P.recommendedMembers('invalid'), []);
});
