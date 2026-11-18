// 원정 저장: 형식, 검증, 이전 버전 삭제, 백업, 중단된 전투 복구.
// 저장 형식은 SAVE_KEY 아래의 RunState JSON 그대로다. v0.17.0부터 이전 버전 저장
// (버전 1~3: v0.15.18 원본·v0.16.0)은 이관하지 않고 지운 뒤 새 원정을 시작한다(사용자 결정).
// 저장소는 UI가 넘겨주며 이 모듈은 localStorage를 직접 건드리지 않는다.
import type { RunState } from './types.ts';
import D from './data/units.js';
import A from './augments.js';
import P from './progression.js';
import W from './encounters.js';

export const SAVE_KEY = 'starlight-onecost-v1';
/** progression.initialize / migrate가 쓰는 현재 RunState.version. */
export const SAVE_VERSION = 4;
export const BACKUP_PREFIX = SAVE_KEY + '-backup-';

/** UI가 넘겨주는 저장소: window.localStorage 또는 테스트용 대체물. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * 저장 형식 이관 목록(오래된 것부터). v0.17.0에서 이전 버전 저장을 지우기로 해서 비어 있다.
 * 앞으로 SAVE_VERSION을 올리면서 저장을 살려야 하면 여기에 단계를 추가하고 progression.migrate를 고친다.
 */
export const MIGRATIONS: readonly { from: number; to: number; note: string }[] = [];
const ACCEPTED_VERSIONS = [SAVE_VERSION];

type Raw = Record<string, any>;
type Check = { id: string; message: string; ok: (s: Raw) => boolean };

const boardUnits = (s: Raw) => s.units.filter((u: Raw) => u.location === 'board');
const benchUnits = (s: Raw) => s.units.filter((u: Raw) => u.location === 'bench');
const columns = (s: Raw) => s.boardColumns || 8;

/** v0.15.18 load() 검사 조건 하나당 한 항목, 같은 순서. */
export const CHECKS: readonly Check[] = [
  {
    id: 'version',
    message: `저장 버전이 ${SAVE_VERSION}이 아닙니다`,
    ok: (s) => ACCEPTED_VERSIONS.includes(s?.version),
  },
  {
    id: 'boardColumns',
    message: '전장 열 수가 7 또는 8이 아닙니다',
    ok: (s) => s.boardColumns === undefined || [7, 8].includes(s.boardColumns),
  },
  { id: 'units', message: '동료 목록이 없습니다', ok: (s) => Array.isArray(s.units) },
  {
    id: 'unitFields',
    message: '알 수 없는 동료, 위치, uid 또는 성급이 있습니다',
    ok: (s) =>
      s.units.every(
        (u: Raw) =>
          D.playableIds.includes(u.id) &&
          ['board', 'bench'].includes(u.location) &&
          Number.isInteger(u.uid) &&
          !(u.star < 1) &&
          !(u.star > 3),
      ),
  },
  {
    id: 'boardCells',
    message: '전장 위치가 아군 칸이 아니거나 겹칩니다',
    ok: (s) => {
      const occupied = new Set<number>();
      return boardUnits(s).every((u: Raw) => {
        if (
          !Number.isInteger(u.pos) ||
          u.pos < columns(s) * 4 ||
          u.pos >= columns(s) * 8 ||
          occupied.has(u.pos)
        )
          return false;
        occupied.add(u.pos);
        return true;
      });
    },
  },
  {
    id: 'boardCount',
    message: '전장 배치 인원이 한도를 넘습니다',
    // 배치 한도 증강(P13)의 capacity 포함, 최대 11명
    ok: (s) => boardUnits(s).length <= Math.min(11, 10 + A.aggregate(s.augments).capacity),
  },
  {
    id: 'benchCount',
    message: '대기석 인원이 22명을 넘습니다',
    ok: (s) => benchUnits(s).length <= 22,
  },
  {
    id: 'uniqueUids',
    message: '동료 uid가 중복됩니다',
    ok: (s) => new Set(s.units.map((u: Raw) => u.uid)).size === s.units.length,
  },
  {
    id: 'gold',
    message: '골드 값이 올바르지 않습니다',
    ok: (s) => Number.isFinite(s.gold) && s.gold >= 0,
  },
  { id: 'wave', message: '진행 웨이브 값이 올바르지 않습니다', ok: (s) => s.wave >= 1 },
  {
    id: 'shop',
    message: '상점 목록이 올바르지 않습니다',
    ok: (s) =>
      Array.isArray(s.shop) &&
      s.shop.every((id: unknown) => id === null || D.playableIds.includes(id as string)),
  },
];

/**
 * 읽은 저장에서 실패한 검사 목록. []이면 불러올 수 있다. 원래의 한 줄 조건처럼
 * 첫 실패에서 멈춘다(뒤 검사는 앞 검사가 통과했다고 가정, 예: units가 배열).
 */
export function validateSave(s: unknown): Check[] {
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = !!check.ok(s as Raw);
    } catch {
      ok = false;
    }
    if (!ok) return [check];
  }
  return [];
}

export interface RevertedBattle {
  key: string; // 라운드 표기, 예: '2-3'
  loot: { kind: 'gold'; amount: number } | { kind: 'item'; itemId: string; itemUid: string } | null;
}

/**
 * D4 (a): 전투 중에 저장된 원정은 그 라운드의 준비 단계로 되돌리고, 취소된
 * 전투에서 받은 보너스 몬스터 보상(골드 또는 아이템)을 회수해 다시 싸우면 다시
 * 얻을 수 있게 한다.
 */
export function revertInterruptedBattle(state: RunState): RevertedBattle | null {
  if (state.roundPhase !== 'combat') return null;
  const key = P.label(state);
  const ledger = (state.bonusLootLedger || {}) as Record<string, any>;
  const paid = ledger[key];
  let loot: RevertedBattle['loot'] = null;
  if (paid?.kind === 'gold') {
    state.gold = Math.max(0, state.gold - paid.amount);
    loot = { kind: 'gold', amount: paid.amount };
  } else if (paid?.kind === 'item') {
    state.inventory = state.inventory.filter((item) => item.uid !== paid.itemUid);
    loot = { kind: 'item', itemId: paid.itemId, itemUid: paid.itemUid };
  }
  if (paid) delete ledger[key];
  state.roundPhase = 'prepare';
  return { key, loot };
}

export type LoadResult =
  | { status: 'empty' }
  /** 이전 버전 저장(v0.17.0 이전)을 지웠다 */
  | { status: 'outdated'; version: number }
  | { status: 'loaded'; state: RunState; nextUid: number; reverted: RevertedBattle | null }
  | {
      status: 'invalid';
      problems: string[];
      backupKey: string | null;
      backupError: string | null;
    };

export function backupKey(now: Date): string {
  return BACKUP_PREFIX + now.toISOString().replace(/[:.]/g, '-');
}

/**
 * 원정 저장을 읽고 검증·정리한다. 이전 버전 저장은 지운다. 잘못된 데이터는 백업 키에 복사한 뒤 SAVE_KEY에서
 * 지운다(페이지를 열 때마다 다시 백업되지 않게). 백업을 쓸 수 없으면 원본은 그대로 둔다.
 */
export function loadSave(storage: SaveStorage, now: Date = new Date(0)): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (error) {
    return {
      status: 'invalid',
      problems: ['저장소를 읽을 수 없습니다'],
      backupKey: null,
      backupError: String(error),
    };
  }
  if (raw === null) return { status: 'empty' };
  let parsed: unknown = null,
    problems: string[];
  try {
    parsed = JSON.parse(raw);
    problems = validateSave(parsed).map((c) => c.message);
  } catch {
    problems = ['저장 데이터를 해석할 수 없습니다'];
  }
  // 이전 버전 저장은 백업하지 않고 지운다(v0.17.0 사용자 결정)
  const version = (parsed as Raw | null)?.version;
  if (typeof version === 'number' && version < SAVE_VERSION) {
    try {
      storage.removeItem(SAVE_KEY);
    } catch {
      // 지우지 못해도 다음에 열 때 다시 지운다
    }
    return { status: 'outdated', version };
  }
  if (!problems.length) {
    // 복사본을 이관해서, 도중에 실패해도 반쯤 바뀐 데이터가 남지 않게 한다
    const s = JSON.parse(raw) as Raw;
    try {
      const state = W.ensureRunDefaults(P.migrate(s)) as RunState;
      const reverted = revertInterruptedBattle(state);
      P.ensureAugment(state);
      return {
        status: 'loaded',
        state,
        nextUid: Math.max(0, ...s.units.map((u: Raw) => u.uid)),
        reverted,
      };
    } catch (error) {
      problems = ['저장 데이터를 이관하지 못했습니다: ' + String(error)];
    }
  }
  const key = backupKey(now);
  try {
    storage.setItem(key, raw);
  } catch (error) {
    return { status: 'invalid', problems, backupKey: null, backupError: String(error) };
  }
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // 백업은 있으므로, 손상 저장이 남아도 다음에 다시 백업될 뿐이다
  }
  return { status: 'invalid', problems, backupKey: key, backupError: null };
}

export default {
  SAVE_KEY,
  SAVE_VERSION,
  BACKUP_PREFIX,
  MIGRATIONS,
  CHECKS,
  validateSave,
  revertInterruptedBattle,
  backupKey,
  loadSave,
};
