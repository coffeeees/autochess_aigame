// Migrated from the v0.15.18 suite test-home-enemies.cjs (tests for: save).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $engine from '../../src/core/combat/battle.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  D = $data,
  P = $progression,
  W = $encounters,
  { Battle } = $engine;
let n = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function state(round = 3) {
  const s = P.initialize({
    health: 100,
    gold: 12,
    units: [{ uid: 1, id: 'C03', location: 'board', pos: 26, star: 1 }],
    shop: [],
  });
  s.round = round;
  return W.ensureRunDefaults(s);
}
function settle(s, win = true) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner: win ? 'ally' : 'enemy' }, () => 0.8);
}
test('migration preserves existing HP and units; meta profile is separate', () => {
  const s = state();
  s.health = 72;
  const units = clone(s.units);
  W.ensureRunDefaults(s);
  a.equal(s.health, 72);
  a.deepEqual(s.units, units);
  const profile = W.newProfile();
  settle(s);
  // v0.17.2: 메타 프로필은 meta.ts(누적 XP·지급 기록 추가). v0.19.0: 성장 포인트·티켓·영구 강화·보상 원장.
  // 원정 정산은 프로필을 건드리지 않는다
  a.deepEqual(profile, {
    version: 2,
    metaLevel: 1,
    metaXp: 0,
    totalXp: 0,
    growthEnabled: true,
    payments: [],
    growthPoints: 0,
    tickets: 0,
    upgrades: {},
    rewards: { level: 1, points: 0, tickets: 0 },
  });
});
