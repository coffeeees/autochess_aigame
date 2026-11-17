// Migrated from the v0.15.18 suite test-home-enemies.cjs (tests for: encounters).
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
