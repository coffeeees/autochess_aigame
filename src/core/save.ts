// Run save: schema, validation, migration, backup and interrupted-battle recovery.
// The stored format is the RunState JSON itself under SAVE_KEY (unchanged since
// v0.15.18), so existing saves load as they are. Storage is passed in by the UI;
// this module never touches localStorage directly.
import type { RunState } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import W from './encounters.js';

export const SAVE_KEY = 'starlight-onecost-v1';
/** Current RunState.version written by progression.initialize / migrate. */
export const SAVE_VERSION = 2;
export const BACKUP_PREFIX = SAVE_KEY + '-backup-';

/** What the UI hands over: window.localStorage or a test double. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Schema migrations, oldest first. progression.migrate brings any accepted
 * version to SAVE_VERSION (v1 -> v2: level from deployed capacity, items,
 * augments, board columns 8 -> 7) and normalises current saves; it is idempotent.
 * Add a step here when SAVE_VERSION changes.
 */
export const MIGRATIONS: readonly { from: number; to: number; note: string }[] = [
  { from: 1, to: 2, note: 'progression.migrate: level, inventory, augments, 7-column board' },
];
const ACCEPTED_VERSIONS = [1, SAVE_VERSION];

type Raw = Record<string, any>;
type Check = { id: string; message: string; ok: (s: Raw) => boolean };

const boardUnits = (s: Raw) => s.units.filter((u: Raw) => u.location === 'board');
const benchUnits = (s: Raw) => s.units.filter((u: Raw) => u.location === 'bench');
const columns = (s: Raw) => s.boardColumns || 8;

/** One entry per condition of the v0.15.18 load() check, in the same order. */
export const CHECKS: readonly Check[] = [
  {
    id: 'version',
    message: '저장 버전이 1 또는 2가 아닙니다',
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
    ok: (s) => boardUnits(s).length <= (s.augments?.includes('P12') ? 11 : 10),
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
 * Failed checks of a parsed save; [] means it can be loaded. Like the original
 * single condition, checking stops at the first failure (later checks assume the
 * earlier ones, e.g. that units is an array).
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
  key: string; // round label, e.g. '2-3'
  loot: { kind: 'gold'; amount: number } | { kind: 'item'; itemId: string; itemUid: string } | null;
}

/**
 * D4 (a): a save made during a battle goes back to the preparation phase of that
 * round, and the bonus-monster reward paid during the cancelled battle is taken
 * back (gold, or the item), so the battle can be fought again for it.
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
 * Read, validate and migrate the run save. Invalid data is copied to a backup key
 * and then removed from SAVE_KEY (so it is not backed up again on every visit);
 * if the backup cannot be written the original stays where it is.
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
  if (!problems.length) {
    // migrate a copy so a failure part-way leaves nothing half-converted
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
    // the backup exists; leaving the damaged save only means it is backed up again
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
