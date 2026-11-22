// Migrated from the v0.15.18 suite test-progression.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $engine from '../../src/core/combat/battle.js';
import $progression from '../../src/core/progression.js';

const assert = require('node:assert/strict'),
  D = $data,
  P = $progression,
  { Battle } = $engine;
const clone = (x) => JSON.parse(JSON.stringify(x)),
  near = (a, b) => assert(Math.abs(a - b) < 1e-6);
let count = 0;
function state() {
  return P.initialize({
    health: 100,
    gold: 12,
    units: [
      { uid: 1, id: 'C03', location: 'board', pos: 26, star: 1 },
      { uid: 2, id: 'C05', location: 'board', pos: 32, star: 1 },
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
test('이전 버전 저장(버전 1~3)은 이관하지 않는다(v0.17.0, save.ts가 지움)', () => {
  for (const version of [1, 2, 3])
    assert.throws(() => P.migrate({ version, wave: 6, units: [], shop: [] }), /이전 버전 저장/);
  const now = P.initialize({ units: [], shop: [], gold: 7, health: 100 });
  assert.equal(now.version, 6);
  assert.equal(P.migrate(clone(now)).version, 6);
  // 버전 4(v0.17.x, 7열)는 전장 칸을 회전해 5로(v0.18.0), 다시 장비 개편 6으로(v0.20.0) 올린다
  const v4 = Object.assign(clone(now), { version: 4, boardColumns: 7 });
  v4.units = [{ uid: 1, id: 'C03', location: 'board', pos: 28, star: 1 }];
  const up = P.migrate(v4);
  assert.deepEqual([up.version, up.boardColumns, up.units[0].pos], [6, 8, 3]);
});
