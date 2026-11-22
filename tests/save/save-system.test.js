// 저장 시스템(4단계, v0.17.0 갱신): src/core/save.ts. tests/fixtures/의 자료는 원본 v0.15.18에서 받은
// 실제 저장이다(시작, 1-3 준비, 1-3 전투 중). v0.17.0부터 이런 이전 버전 저장은 불러오지 않고 지운다.
import { test } from 'vitest';
import A from '../../src/core/augments.js';
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
import { newRun } from '../../src/core/run.ts';

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

/** 현재 버전(4) 저장: 새 원정에서 동료 2명을 전장에 두고 증강 하나를 고른 상태 */
function currentSave() {
  const s = newRun({ seed: 7, difficulty: 1 });
  const bench = s.units.filter((u) => u.location === 'bench');
  a(V.moveUnit(s, bench[0].uid, { location: 'board', pos: 26 }).ok);
  a(V.moveUnit(s, bench[1].uid, { location: 'board', pos: 25 }).ok);
  s.augments = ['S09'];
  return s;
}

// v0.15.18 load()의 한 줄 조건에서 버전(4·5), 배치 한도(P13), 전장 칸(7열 아래 4행 / 8열 왼쪽 4열, v0.18.0)만 바꾼 조건.
// 나눈 검사가 정확히 같은 저장을 받아들이는지 증명하는 데 쓴다.
function originalCheck(s) {
  const occupied = new Set();
  return (
    [4, 5, 6].includes(s?.version) &&
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
        const seven = (s.boardColumns || 8) === 7;
        if (
          !Number.isInteger(u.pos) ||
          (seven ? u.pos < 28 || u.pos >= 56 : u.pos < 0 || u.pos >= 56 || u.pos % 8 >= 4) ||
          occupied.has(u.pos)
        )
          return false;
        occupied.add(u.pos);
      }
      return true;
    }) &&
    s.units.filter((u) => u.location === 'board').length <=
      Math.min(11, 10 + A.aggregate(s.augments).capacity) &&
    s.units.filter((u) => u.location === 'bench').length <= 22 &&
    new Set(s.units.map((u) => u.uid)).size === s.units.length &&
    Number.isFinite(s.gold) &&
    s.gold >= 0 &&
    s.wave >= 1 &&
    Array.isArray(s.shop) &&
    s.shop.every((id) => id === null || D.playableIds.includes(id))
  );
}

test('이전 버전 저장(v0.15.18 원본·v0.16.0, 버전 1~3)은 백업 없이 지우고 outdated로 알린다', () => {
  const raws = ['start', 'prepare-with-augment', 'mid-battle'].map(fixture);
  const v3 = currentSave();
  v3.version = 3;
  v3.augments = ['LS11'];
  raws.push(JSON.stringify(v3), JSON.stringify({ version: 1, wave: 6, units: [], shop: [] }));
  for (const raw of raws) {
    const storage = memoryStorage({ [SAVE_KEY]: raw });
    const result = loadSave(storage, NOW);
    a.deepEqual(result, { status: 'outdated', version: JSON.parse(raw).version });
    a(!storage.data.has(SAVE_KEY), '이전 저장은 지움');
    a.equal(storage.data.size, 0, '백업도 만들지 않음');
  }
});

test('현재 버전 저장은 그대로 불러와 이어 할 수 있다', () => {
  const save = currentSave();
  const raw = JSON.stringify(save);
  const storage = memoryStorage({ [SAVE_KEY]: raw });
  const result = loadSave(storage, NOW);
  a.equal(result.status, 'loaded');
  a.equal(result.reverted, null);
  const s = result.state;
  for (const key of ['gold', 'health', 'stage', 'round', 'level', 'xp', 'difficulty', 'version'])
    a.deepEqual(s[key], save[key], key);
  a.deepEqual(s.units, save.units);
  a.deepEqual(s.augments, ['S09']);
  a.equal(result.nextUid, Math.max(...save.units.map((u) => u.uid)));
  a.equal(storage.data.get(SAVE_KEY), raw, 'loading never rewrites the save by itself');
  s.gold = 20;
  a(V.manualReroll(s));
  a.equal(s.gold, 19, 'S09 절약 정신: 새로고침 1G');
  a(Number.isInteger(s.rngState));
});

test('검증을 이름 붙은 검사로 나누었고 원래 조건과 같다', () => {
  const base = clone(currentSave());
  a.deepEqual(validateSave(base), []);
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
  const board = base.units.filter((u) => u.location === 'board');
  const cases = {
    version: (s) => (s.version = 9),
    boardColumns: (s) => (s.boardColumns = 9),
    units: (s) => (s.units = null),
    unitFields: (s) => (s.units[0].id = 'E01'),
    boardCells: (s) => (s.units.find((u) => u.uid === board[1].uid).pos = board[0].pos),
    boardCount: (s) => {
      s.units = D.playableIds.slice(0, 11).map((id, i) => ({
        uid: i + 1,
        id,
        location: 'board',
        pos: (i % 7) * 8 + 3 - Math.floor(i / 7),
        star: 1,
      }));
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
  // 무작위 변형: 나눈 검사와 원래 조건의 판정이 항상 같다
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
      ['P13'],
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

test('손상·검증 실패 저장은 백업 후 지우고 결과로 알린다', () => {
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
  // 백업 불가: 원본은 그대로 둔다
  const stuck = memoryStorage({ [SAVE_KEY]: '{bad' }, { failSet: true });
  const result = loadSave(stuck, NOW);
  a.equal(result.status, 'invalid');
  a.equal(result.backupKey, null);
  a.match(result.backupError, /Quota/);
  a.equal(stuck.data.get(SAVE_KEY), '{bad');
  // 읽을 수 없는 저장소, 저장 없음
  a.equal(loadSave(memoryStorage({}, { failGet: true })).status, 'invalid');
  a.deepEqual(loadSave(memoryStorage()), { status: 'empty' });
});

test('D4 (a): 전투 중 저장은 준비 단계로 돌아가고 보너스 보상을 회수한다', () => {
  const old = currentSave();
  Object.assign(old, { round: 4, wave: 4, roundPhase: 'combat' }); // 1-4 전투 중
  const raw = JSON.stringify(old);
  // 받은 그대로: 그 전투에는 보너스 몬스터가 없었다
  let result = loadSave(memoryStorage({ [SAVE_KEY]: raw }), NOW);
  a.equal(result.status, 'loaded');
  a.equal(result.state.roundPhase, 'prepare');
  a.deepEqual(result.reverted, { key: P.label(old), loot: null });
  a.equal(result.state.gold, old.gold);
  // 같은 저장에 전투 중 보너스 골드를 받은 경우
  const withGold = clone(old);
  withGold.gold += 4;
  withGold.bonusLootLedger = { [P.label(old)]: { kind: 'gold', amount: 4, key: P.label(old) } };
  result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(withGold) }), NOW);
  a.equal(result.state.gold, old.gold);
  a.deepEqual(result.state.bonusLootLedger, {});
  a.deepEqual(result.reverted.loot, { kind: 'gold', amount: 4 });
  // … 또는 보너스 아이템
  const withItem = clone(old);
  withItem.inventory.push({ uid: 'I99', id: 'IB04', equippedTo: null });
  withItem.bonusLootLedger = {
    [P.label(old)]: { kind: 'item', itemId: 'IB04', itemUid: 'I99', key: P.label(old) },
  };
  result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(withItem) }), NOW);
  a.deepEqual(result.state.inventory, old.inventory);
  a.deepEqual(result.reverted.loot, { kind: 'item', itemId: 'IB04', itemUid: 'I99' });
  // 이전 라운드 보상은 그대로
  const earlier = clone(withGold);
  earlier.bonusLootLedger['1-1'] = { kind: 'gold', amount: 3, key: '1-1' };
  result = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(earlier) }), NOW);
  a.deepEqual(Object.keys(result.state.bonusLootLedger), ['1-1']);
  // 전투 중이 아니면 되돌릴 것 없음
  a.equal(revertInterruptedBattle(currentSave()), null);
});

test('저장 버전 6, 이관 4 → 5(좌우 대치 전장 회전) → 6(장비 개편), 1~3은 지움', () => {
  a.equal(S.SAVE_VERSION, 6);
  a.deepEqual(
    S.MIGRATIONS.map((m) => [m.from, m.to]),
    [
      [4, 5],
      [5, 6],
    ],
  );
  a.equal(currentSave().version, 6);
});

test('v0.17.x 저장(버전 4, 7열 상하 대치)은 지우지 않고 전장 칸을 회전해 버전 6으로 불러온다', () => {
  const save = currentSave();
  // 버전 4 모양으로 되돌린다: 7열, 아군·적 편성 칸은 예전 좌표
  Object.assign(save, { version: 4, boardColumns: 7 });
  const board = save.units.filter((u) => u.location === 'board');
  const oldPos = [38, 45];
  board.forEach((u, i) => (u.pos = oldPos[i]));
  save.enemyEncounter = { key: '1-1', units: [{ id: 'E01', pos: 17 }] };
  a.deepEqual(validateSave(save), []);
  const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(save) });
  const result = loadSave(storage, NOW);
  a.equal(result.status, 'loaded');
  a.equal(result.state.version, 6);
  a.equal(result.state.boardColumns, 8);
  a.deepEqual(
    result.state.units.filter((u) => u.location === 'board').map((u) => u.pos),
    [26, 25],
    '38 → 26, 45 → 25',
  );
  a.deepEqual(
    result.state.enemyEncounter.units.map((u) => u.pos),
    [29],
  );
  a(storage.data.has(SAVE_KEY), '지우지 않음');
});
