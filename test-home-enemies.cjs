'use strict';
const a = require('node:assert/strict'),
  D = require('./dist/data.js'),
  P = require('./dist/progression.js'),
  W = require('./dist/encounters.js'),
  { Battle } = require('./dist/engine.js');
let n = 0;
function test(name, fn) {
  fn();
  n++;
  console.log('PASS ' + name);
}
const clone = (x) => JSON.parse(JSON.stringify(x));
function state(round = 3) {
  const s = P.initialize({
    health: 100,
    gold: 12,
    units: [{ uid: 1, id: 'C03', location: 'board', pos: 38, star: 1 }],
    shop: [],
  });
  s.round = round;
  return W.ensureRunDefaults(s);
}
function settle(s, win = true) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner: win ? 'ally' : 'enemy' }, () => 0.8);
}
test('all ten difficulties have exact HP and damage values', () => {
  a.deepEqual(
    W.difficulties.map((d) => d.startingHealth),
    [100, 90, 90, 80, 80, 70, 70, 60, 60, 50],
  );
  a.deepEqual(
    W.difficulties.map((d) => d.damagePercent),
    [-40, -30, -20, -10, 0, 10, 20, 30, 40, 50],
  );
  for (const d of W.difficulties) {
    const s = W.configureNewRun(state(), d.level);
    a.equal(s.health, d.startingHealth);
    a.equal(s.maxHealth, 100);
    a.equal(d.enemyDamageMultiplier, 1 + d.damagePercent / 100);
    a.equal(s.level, 3);
  }
});
test('migration preserves existing HP and units; meta profile is separate', () => {
  const s = state();
  s.health = 72;
  const units = clone(s.units);
  W.ensureRunDefaults(s);
  a.equal(s.health, 72);
  a.deepEqual(s.units, units);
  const profile = W.newProfile();
  settle(s);
  a.deepEqual(profile, { version: 1, metaLevel: 1, metaXp: 0, growthEnabled: false });
});
test('enemy roster independent, comparable stats, forbidden in player team', () => {
  for (const e of W.enemies) {
    a(!D.playableIds.includes(e.id));
    a.equal(D.byId(e.id), undefined);
    for (const k of D.statKeys) a(Number.isFinite(e.stats[k]));
    a.throws(() => new Battle([{ id: e.id, pos: 35 }], [{ id: 'E01', pos: 3 }]));
    new Battle([{ id: 'C03', pos: 35 }], [{ id: e.id, pos: 3 }]);
  }
});
test('encounters contain only enemy IDs and unique valid positions through stage10', () => {
  for (let stage = 1; stage <= 10; stage++)
    for (let round = 1; round <= 5; round++) {
      const s = state(round);
      s.stage = stage;
      const units = W.encounter(s, () => 0.5);
      a(units.length <= 10);
      a.equal(new Set(units.map((u) => u.pos)).size, units.length);
      for (const u of units) {
        a(W.byId(u.id));
        a(u.pos >= 0 && u.pos < 24);
      }
      if (P.roundType(stage, round) === 'SUPPLY') a.equal(units.length, 0);
    }
});
test('10% boundary replaces exactly one enemy; stable across rendering and reload', () => {
  for (const roll of [0, 0.09999, 0.1, 0.99999]) {
    const s = state(),
      seq = [roll, 0.99999];
    let calls = 0;
    const units = W.encounter(s, () => {
      calls++;
      return seq.shift();
    });
    a.equal(units.filter((u) => u.id === 'E99').length, roll < 0.1 ? 1 : 0);
    const before = calls;
    a.deepEqual(
      W.encounter(s, () => {
        throw Error('rerolled');
      }),
      units,
    );
    a.deepEqual(
      W.encounter(clone(s), () => {
        throw Error('reload rerolled');
      }),
      units,
    );
    a.equal(calls, before);
  }
});
test('supply never rolls encounter; advancing combat rerolls', () => {
  const s = state(1);
  a.deepEqual(
    W.encounter(s, () => {
      throw Error('supply RNG');
    }),
    [],
  );
  s.round = 3;
  W.encounter(s, () => 0.5);
  s.round = 4;
  a.equal(W.encounter(s, () => 0).filter((u) => u.bonus).length, 1);
});
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
test('enemy difficulty scales basic, skill, DOT and summon damage only', () => {
  for (const factor of [0.6, 1, 1.5])
    for (const kind of ['basic', 'skill', 'dot']) {
      const b = new Battle([{ id: 'C03', pos: 35 }], [{ id: 'E02', pos: 3 }], {
          rng: () => 0.99,
          enemyDamageMultiplier: factor,
        }),
        ally = b.units[0],
        enemy = b.units[1];
      ally.stats.GD = 0;
      enemy.stats.GD = 0;
      ally.stats.DOD = 0;
      enemy.stats.DOD = 0;
      a.equal(b.deal(enemy, ally, 100, 'magic', kind, { canCrit: false }).damage, 100 * factor);
      a.equal(b.deal(ally, enemy, 100, 'physical', kind, { canCrit: false }).damage, 100);
      const pet = b.summon(enemy, 'plague');
      a.equal(b.deal(pet, ally, 100, 'physical', kind, { canCrit: false }).damage, 100 * factor);
    }
});
test('kill callback pays bonus once through actual engine death and repeated kill', () => {
  const s = state(),
    b = new Battle([{ id: 'C03', pos: 35 }], [{ id: 'E99', pos: 3 }], {
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
test('new enemy skills and summons complete battle with experimental bonds on/off', () => {
  for (const experimental of [false, true])
    for (const id of W.enemyIds) {
      const b = new Battle(
        [
          { id: 'C03', pos: 38 },
          { id: 'C05', pos: 52 },
          { id: 'C01', pos: 53 },
        ],
        [{ id, pos: 17 }],
        { quickMana: true, experimental, rng: () => 0.99 },
      );
      for (let i = 0; i < 2000 && !b.result; i++) b.tick();
      a(b.result, id);
    }
});
console.log('\n' + n + ' home/enemy/reward tests passed.');
