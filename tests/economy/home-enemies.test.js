// Migrated from the v0.15.18 suite test-home-enemies.cjs (tests for: economy).
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
test('bonus 40% item and 60% gold are exclusive, gold covers3 through5', () => {
  for (const roll of [0, 0.39999, 0.4, 0.99999])
    for (const secondary of [0, 0.4, 0.99999]) {
      const s = state(),
        seq = [roll, secondary],
        loot = W.claimBonusLoot(s, { id: 'E99', team: 'enemy' }, () => seq.shift());
      if (roll < 0.4) {
        a.equal(loot.kind, 'item');
        a.equal(s.inventory.length, 1);
        a.equal(s.gold, 12);
      } else {
        a.equal(loot.kind, 'gold');
        a.equal(s.inventory.length, 0);
        a.equal(loot.amount, 3 + Math.floor(secondary * 3));
        a.equal(s.gold, 12 + loot.amount);
      }
    }
});
test('bonus duplicate callbacks/reload and summons cannot pay twice', () => {
  const s = state();
  a.equal(W.claimBonusLoot(s, { id: 'E99', team: 'ally' }), null);
  a.equal(W.claimBonusLoot(s, { id: 'E99', team: 'enemy', summon: true }), null);
  a.equal(W.claimBonusLoot(s, { id: 'E01', team: 'enemy' }), null);
  W.claimBonusLoot(s, { id: 'E99', team: 'enemy' }, () => 0.9);
  const before = clone(s);
  a.equal(W.claimBonusLoot(s, { id: 'E99', team: 'enemy' }), null);
  const restored = clone(s);
  a.equal(W.claimBonusLoot(restored, { id: 'E99', team: 'enemy' }), null);
  a.deepEqual(s, before);
  a.deepEqual(restored, before);
});
test('bonus earned on kill even with loss; settlement includes it once', () => {
  const s = state();
  s.gold = 9;
  W.claimBonusLoot(s, { id: 'E99', team: 'enemy' }, () => 0.9);
  a.equal(s.gold, 14);
  const r = settle(s, false);
  a.equal(r.base, 1);
  a.equal(r.interest, 1);
  a.equal(r.total, 2);
  a.equal(r.totalEarned, 7);
  a.equal(s.gold, 16);
  P.settleRound(s, { winner: 'enemy' });
  a.equal(s.gold, 16);
});
test('streak firstwin1, secondwin2, caps5, loss resets, idempotent', () => {
  const s = state();
  for (let i = 1; i <= 7; i++) {
    s.stage = i + 2;
    s.round = 1;
    const r = settle(s);
    a.equal(r.streakBonus, Math.min(i, 5));
    const before = s.winStreak;
    P.settleRound(s, { winner: 'ally' });
    a.equal(s.winStreak, before);
  }
  s.stage = 11;
  s.health = 1000;
  const r = settle(s, false);
  a.equal(r.streakBonus, 0);
  a.equal(s.winStreak, 0);
  s.stage = 12;
  a.equal(settle(s).streakBonus, 1);
});
test('boss streak applies, supply maintains streak without paying bonus', () => {
  const s = state(5);
  a.equal(settle(s).base, 5);
  a.equal(s.winStreak, 1);
  s.stage = 2;
  s.round = 3;
  s.roundPhase = 'prepare';
  P.beginSupply(s);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  a.equal(P.confirmSupply(s).streakBonus, 0);
  a.equal(s.winStreak, 1);
  s.round = 4;
  a.equal(settle(s).streakBonus, 2);
  s.stage = 3;
  s.round = 5;
  a.equal(settle(s, false).base, 3);
  a.equal(s.winStreak, 0);
});
test('kill callback pays bonus once through actual engine death and repeated kill', () => {
  const s = state(),
    b = new Battle([{ id: 'C03', pos: 2 }], [{ id: 'E99', pos: 31 }], {
      rng: () => 0.99,
      onUnitKilled: (u, source) => {
        if (source?.team === 'ally') W.claimBonusLoot(s, u, () => 0.9);
      },
    });
  b.deal(b.units[0], b.units[1], 100000, 'physical', 'skill', { canCrit: false });
  a.equal(s.gold, 17);
  b.kill(b.units[1], b.units[0]);
  a.equal(s.gold, 17);
});
