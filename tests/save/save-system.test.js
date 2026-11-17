// Save system (stage 4): src/core/save.ts. Fixtures in tests/fixtures/ are real
// saves captured from the original v0.15.18 build (start, 1-3 prepare, 1-3 battle).
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import D from '../../src/core/data/units.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import S, {
  SAVE_KEY,
  CHECKS,
  validateSave,
  loadSave,
  revertInterruptedBattle,
  backupKey,
} from '../../src/core/save.ts';
import { createRng } from '../../src/core/rng.ts';

const fixture = (name) =>
  fs.readFileSync(`tests/fixtures/v0.15.18-${name}.json`, 'utf8').replace(/\s+$/, '');
const clone = (x) => JSON.parse(JSON.stringify(x));
function memoryStorage(initial = {}, { failSet = false, failGet = false } = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => {
      if (failGet) throw new Error('blocked');
      return data.has(k) ? data.get(k) : null;
    },
    setItem: (k, v) => {
      if (failSet) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
  };
}
const NOW = new Date('2026-11-17T08:30:00.123Z');

// The single condition from the v0.15.18 load(), kept verbatim to prove that the
// split checks accept exactly the same saves.
function originalCheck(s) {
  const occupied = new Set();
  return (
    (s?.version === 1 || s?.version === 2) &&
    (s.boardColumns === undefined || [7, 8].includes(s.boardColumns)) &&
    Array.isArray(s.units) &&
    s.units.every((u) => {
      if (
        !D.playableIds.includes(u.id) ||
        !['board', 'bench'].includes(u.location) ||
        !Number.isInteger(u.uid) ||
        u.star < 1 ||
        u.star > 3
      )
        return false;
      if (u.location === 'board') {
        if (
          !Number.isInteger(u.pos) ||
          u.pos < (s.boardColumns || 8) * 4 ||
          u.pos >= (s.boardColumns || 8) * 8 ||
          occupied.has(u.pos)
        )
          return false;
        occupied.add(u.pos);
      }
      return true;
    }) &&
    s.units.filter((u) => u.location === 'board').length <=
      (s.augments?.includes('P12') ? 11 : 10) &&
    s.units.filter((u) => u.location === 'bench').length <= 22 &&
    new Set(s.units.map((u) => u.uid)).size === s.units.length &&
    Number.isFinite(s.gold) &&
    s.gold >= 0 &&
    s.wave >= 1 &&
    Array.isArray(s.shop) &&
    s.shop.every((id) => id === null || D.playableIds.includes(id))
  );
}

test('real v0.15.18 saves load unchanged and continue', () => {
  for (const name of ['start', 'prepare-with-augment']) {
    const raw = fixture(name);
    const storage = memoryStorage({ [SAVE_KEY]: raw });
    const result = loadSave(storage, NOW);
    a.equal(result.status, 'loaded', name);
    a.equal(result.reverted, null);
    const old = JSON.parse(raw);
    const s = result.state;
    for (const key of ['gold', 'health', 'stage', 'round', 'level', 'xp', 'difficulty'])
      a.deepEqual(s[key], old[key], `${name} ${key}`);
    a.deepEqual(
      s.units.map((u) => [u.uid, u.id, u.star, u.location, u.pos]),
      old.units.map((u) => [u.uid, u.id, u.star, u.location, u.pos]),
    );
    a.deepEqual(s.inventory, old.inventory);
    a.deepEqual(s.augments, old.augments);
    a.equal(result.nextUid, Math.max(...old.units.map((u) => u.uid)));
    a.equal(storage.data.get(SAVE_KEY), raw, 'loading never rewrites the save by itself');
    // keep playing: a reroll draws from the run generator seeded from the save
    s.gold = 20;
    a(V.manualReroll(s));
    a.equal(s.gold, old.augments.includes('S11') ? 19 : 18);
    a(Number.isInteger(s.rngState));
  }
});

test('validation is split into named checks equivalent to the original condition', () => {
  a.deepEqual(validateSave(JSON.parse(fixture('prepare-with-augment'))), []);
  a.deepEqual(
    CHECKS.map((c) => c.id),
    [
      'version',
      'boardColumns',
      'units',
      'unitFields',
      'boardCells',
      'boardCount',
      'benchCount',
      'uniqueUids',
      'gold',
      'wave',
      'shop',
    ],
  );
  const base = JSON.parse(fixture('prepare-with-augment'));
  const board = base.units.filter((u) => u.location === 'board');
  const cases = {
    version: (s) => (s.version = 3),
    boardColumns: (s) => (s.boardColumns = 9),
    units: (s) => (s.units = null),
    unitFields: (s) => (s.units[0].id = 'E01'),
    boardCells: (s) =>
      board.length > 1
        ? (s.units.find((u) => u.uid === board[1].uid).pos = board[0].pos)
        : (s.units[0].pos = 3),
    boardCount: (s) => {
      s.units = D.playableIds
        .slice(0, 11)
        .map((id, i) => ({ uid: i + 1, id, location: 'board', pos: 28 + i, star: 1 }));
    },
    benchCount: (s) => {
      s.units = Array.from({ length: 23 }, (_, i) => ({
        uid: i + 1,
        id: 'C01',
        location: 'bench',
        pos: -1,
        star: 1,
      }));
    },
    uniqueUids: (s) => (s.units[1].uid = s.units[0].uid),
    gold: (s) => (s.gold = -1),
    wave: (s) => (s.wave = 0),
    shop: (s) => (s.shop = ['C99']),
  };
  for (const [id, breakIt] of Object.entries(cases)) {
    const s = clone(base);
    breakIt(s);
    const problems = validateSave(s);
    a.equal(problems.length, 1, id);
    a.equal(problems[0].id, id);
    a.equal(originalCheck(s), false, id);
  }
  // random mutations: the split checks and the original condition always agree
  const rng = createRng(2026);
  const pick = (list) => list[Math.floor(rng() * list.length)];
  for (let n = 0; n < 3000; n++) {
    const s = clone(base);
    const u = pick(s.units);
    const field = pick([
      'id',
      'location',
      'uid',
      'star',
      'pos',
      'gold',
      'wave',
      'shop',
      'version',
      'boardColumns',
      'augments',
    ]);
    const value = pick([
      undefined,
      null,
      -1,
      0,
      1,
      2,
      3,
      4,
      7,
      8,
      27,
      28,
      55,
      56,
      64,
      1.5,
      'C01',
      'C45',
      'E01',
      'board',
      'bench',
      ['P12'],
      [],
      ['C99'],
    ]);
    if (['id', 'location', 'uid', 'star', 'pos'].includes(field)) u[field] = value;
    else s[field] = value;
    let original;
    try {
      original = !!originalCheck(s);
    } catch {
      original = false;
    }
    a.equal(validateSave(s).length === 0, original, JSON.stringify([field, value]));
  }
});

test('damaged or invalid saves are backed up, removed and reported', () => {
  for (const raw of ['{not json', JSON.stringify({ version: 9 }), JSON.stringify(null)]) {
    const storage = memoryStorage({ [SAVE_KEY]: raw });
    const result = loadSave(storage, NOW);
    a.equal(result.status, 'invalid');
    a.equal(result.backupKey, backupKey(NOW));
    a.equal(result.backupKey, 'starlight-onecost-v1-backup-2026-11-17T08-30-00-123Z');
    a.equal(storage.data.get(result.backupKey), raw, 'backup holds the exact original text');
    a(!storage.data.has(SAVE_KEY), 'damaged save removed so it is not backed up again');
    a(result.problems.length > 0);
  }
  // backup impossible: the original stays where it was
  const stuck = memoryStorage({ [SAVE_KEY]: '{bad' }, { failSet: true });
  const result = loadSave(stuck, NOW);
  a.equal(result.status, 'invalid');
  a.equal(result.backupKey, null);
  a.match(result.backupError, /Quota/);
  a.equal(stuck.data.get(SAVE_KEY), '{bad');
  // unreadable storage and no save
  a.equal(loadSave(memoryStorage({}, { failGet: true })).status, 'invalid');
  a.deepEqual(loadSave(memoryStorage()), { status: 'empty' });
});

test('D4 (a): a save made during battle returns to preparation and takes back bonus rewards', () => {
  const raw = fixture('mid-battle');
  const old = JSON.parse(raw);
  a.equal(old.roundPhase, 'combat');
  // as captured: no bonus monster in that battle
  let result = loadSave(memoryStorage({ [SAVE_KEY]: raw }), NOW);
  a.equal(result.status, 'loaded');
  a.equal(result.state.roundPhase, 'prepare');
  a.deepEqual(result.reverted, { key: P.label(old), loot: null });
  a.equal(result.state.gold, old.gold);
  // the same save with bonus gold paid during the battle
  const withGold = clone(old);
  withGold.gold += 4;
  withGold.bonusLootLedger = { [P.label(old)]: { kind: 'gold', amount: 4, key: P.label(old) } };
  result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(withGold) }), NOW);
  a.equal(result.state.gold, old.gold);
  a.deepEqual(result.state.bonusLootLedger, {});
  a.deepEqual(result.reverted.loot, { kind: 'gold', amount: 4 });
  // ... or a bonus item
  const withItem = clone(old);
  withItem.inventory.push({ uid: 'I99', id: 'I12', equippedTo: null });
  withItem.bonusLootLedger = {
    [P.label(old)]: { kind: 'item', itemId: 'I12', itemUid: 'I99', key: P.label(old) },
  };
  result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(withItem) }), NOW);
  a.deepEqual(result.state.inventory, old.inventory);
  a.deepEqual(result.reverted.loot, { kind: 'item', itemId: 'I12', itemUid: 'I99' });
  // rewards of earlier rounds are untouched
  const earlier = clone(withGold);
  earlier.bonusLootLedger['1-1'] = { kind: 'gold', amount: 3, key: '1-1' };
  result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(earlier) }), NOW);
  a.deepEqual(Object.keys(result.state.bonusLootLedger), ['1-1']);
  // not in battle: nothing to revert
  const prepared = JSON.parse(fixture('prepare-with-augment'));
  a.equal(revertInterruptedBattle(prepared), null);
});

test('migration table and version 1 saves', () => {
  a.equal(S.SAVE_VERSION, 2);
  a.deepEqual(
    S.MIGRATIONS.map((m) => [m.from, m.to]),
    [[1, 2]],
  );
  const v1 = {
    version: 1,
    wave: 6,
    gold: 43,
    health: 72,
    units: D.playableIds
      .slice(0, 5)
      .map((id, i) => ({ id, uid: i + 1, location: 'board', pos: 32 + i, star: 1 })),
    shop: [],
    done: false,
  };
  const result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(v1) }), NOW);
  a.equal(result.status, 'loaded');
  a.equal(result.state.version, 2);
  a.equal(result.state.gold, 43);
  a.equal(P.label(result.state), '2-1');
});
