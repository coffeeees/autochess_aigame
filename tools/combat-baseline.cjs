'use strict';
// Stage-0 combat baseline.
// Runs a fixed set of seeded battles against the logic modules and writes
// winner / time / damage totals / surviving HP / event & log counts / hashes.
// Usage:
//   node tools/combat-baseline.cjs            -> print JSON to stdout
//   node tools/combat-baseline.cjs --write    -> write docs/archive/combat-baseline.json
//   node tools/combat-baseline.cjs --check    -> compare with the stored file, exit 1 on diff
// The engine path can be overridden with AUTOCHESS_LOGIC_DIR (default: ./src/legacy).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const LOGIC = path.resolve(ROOT, process.env.AUTOCHESS_LOGIC_DIR || 'src/legacy');
const OUT = path.join(ROOT, 'docs/archive/combat-baseline.json');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Any module-level Math.random call (encounters, worker helpers) is also made
// deterministic so the baseline never depends on hidden randomness.
let globalRng = mulberry32(1);
Math.random = () => globalRng();

const D = require(path.join(LOGIC, 'data.js'));
const I = require(path.join(LOGIC, 'items.js'));
const W = require(path.join(LOGIC, 'encounters.js'));
const { Battle } = require(path.join(LOGIC, 'engine.js'));

const hash = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const round = (n) => Math.round(n * 1000) / 1000;

function run(name, seed, allies, enemies, options = {}) {
  globalRng = mulberry32(seed ^ 0x9e3779b9);
  const battle = new Battle(allies, enemies, { ...options, rng: mulberry32(seed) });
  let ticks = 0;
  while (!battle.result && ticks < 5000) {
    battle.tick();
    ticks++;
  }
  const units = battle.units.map((u) => ({
    id: u.id,
    team: u.team,
    star: u.star,
    hp: round(Math.max(0, u.hp)),
    alive: u.hp > 0,
  }));
  return {
    name,
    seed,
    ticks,
    winner: battle.result && battle.result.winner,
    time: battle.result && battle.result.time,
    stats:
      battle.result &&
      Object.fromEntries(Object.entries(battle.result.stats).map(([k, v]) => [k, round(v)])),
    allyHpLeft: round(units.filter((u) => u.team === 'ally').reduce((a, u) => a + u.hp, 0)),
    enemyHpLeft: round(units.filter((u) => u.team === 'enemy').reduce((a, u) => a + u.hp, 0)),
    skillUses: battle.skillUses,
    eventCount: battle.events.length,
    logCount: battle.logs.length,
    unitsHash: hash(units),
    eventsHash: hash(battle.events),
    logsHash: hash(battle.logs),
  };
}

function scenarios() {
  const out = [];
  const ids = D.playableIds;
  const allyCells = [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];

  // 1) Every playable unit, 5 at a time, 2-star, vs a fixed enemy line.
  for (let g = 0; g < ids.length; g += 5) {
    const group = ids.slice(g, g + 5);
    out.push(
      run(
        `roster-${group.join('-')}`,
        1000 + g,
        group.map((id, i) => ({ id, pos: allyCells[i], star: 2 })),
        ['E03', 'E06', 'E08', 'E01', 'E04'].map((id, i) => ({
          id,
          pos: [17, 18, 16, 3, 4][i],
          star: 2,
        })),
      ),
    );
  }

  // 2) Mirror-ish fights between playable units (exercises every skill vs players).
  for (let g = 0; g < ids.length; g += 9) {
    const a = ids.slice(g, g + 4);
    const b = ids.slice(g + 4, g + 8);
    if (b.length === 0) continue;
    out.push(
      run(
        `mirror-${g}`,
        2000 + g,
        a.map((id, i) => ({ id, pos: allyCells[i] })),
        b.map((id, i) => ({ id, pos: [17, 18, 16, 19][i] })),
        { quickMana: true },
      ),
    );
  }

  // 3) Items: every item worn at least once.
  const itemIds = I.items.map((it) => it.id);
  for (let k = 0; k < itemIds.length; k += 6) {
    const gear = itemIds.slice(k, k + 6);
    const wearers = [ids[k % ids.length], ids[(k + 7) % ids.length]];
    const allies = wearers
      .map((id, i) => {
        const itemIdsFor = gear.slice(i * 3, i * 3 + 3).filter(Boolean);
        return { id, pos: allyCells[i + 2], itemIds: itemIdsFor, bonuses: I.bonuses(itemIdsFor) };
      })
      .filter((u) => u.itemIds.length);
    out.push(
      run(`items-${gear.join('-')}`, 3000 + k, allies, [
        { id: 'E06', pos: 17, star: 2 },
        { id: 'E01', pos: 3 },
        { id: 'E03', pos: 18 },
      ]),
    );
  }

  // 4) Augments: each augment applied alone on a fixed squad.
  const A = require(path.join(LOGIC, 'augments.js'));
  A.augments.forEach((aug, k) => {
    out.push(
      run(
        `augment-${aug.id}`,
        4000 + k,
        ['C01', 'C03', 'C05', 'C09'].map((id, i) => ({ id, pos: allyCells[i + 3] })),
        [
          { id: 'E06', pos: 17, star: 2 },
          { id: 'E01', pos: 3 },
          { id: 'E03', pos: 18 },
        ],
        { allyModifiers: { augmentIds: [aug.id] } },
      ),
    );
  });

  // 5) Real encounters from the generator across stages and difficulties.
  const stages = [
    [1, 3],
    [2, 2],
    [2, 5],
    [3, 4],
    [4, 5],
    [5, 5],
    [6, 5],
    [7, 2],
  ];
  stages.forEach(([stage, roundNo], k) => {
    for (const difficulty of [1, 5, 10]) {
      const state = { stage, round: roundNo, difficulty };
      let enemies;
      try {
        enemies = W.encounter(state, mulberry32(5000 + k * 10 + difficulty));
      } catch (e) {
        enemies = null;
      }
      if (!enemies || !enemies.length) continue;
      const squad = ids.slice(k * 4, k * 4 + Math.min(10, 3 + stage)).map((id, i) => ({
        id,
        pos: allyCells[i],
        star: stage >= 4 ? 2 : 1,
      }));
      out.push(
        run(
          `encounter-${stage}-${roundNo}-d${difficulty}`,
          5000 + k * 10 + difficulty,
          squad,
          enemies.map((u) => ({ ...u })),
          { enemyDamageMultiplier: W.difficulty(difficulty).enemyDamageMultiplier },
        ),
      );
    }
  });

  return out;
}

const result = {
  version: '0.15.18',
  generatedBy: 'tools/combat-baseline.cjs',
  battles: scenarios(),
};
const json = JSON.stringify(result, null, 2) + '\n';

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${result.battles.length} battles to ${path.relative(ROOT, OUT)}`);
} else if (process.argv.includes('--check')) {
  const stored = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  let diffs = 0;
  stored.battles.forEach((b, i) => {
    const now = result.battles[i];
    if (JSON.stringify(b) !== JSON.stringify(now)) {
      diffs++;
      console.error(`DIFF ${b.name}`);
    }
  });
  if (stored.battles.length !== result.battles.length) diffs++;
  console.log(diffs ? `${diffs} battle(s) differ` : `all ${stored.battles.length} battles match`);
  process.exit(diffs ? 1 : 0);
} else {
  process.stdout.write(json);
}
