// 캐릭터 구매·판매(prototype.js recruit와 drag-sales.js에서 옮김).
// 결과에 담긴 알림 ID는 UI가 표시한다.
import type { RunState, RunUnit, UnitDef } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';
import { mergeAll, type MergeEvent } from './merge.ts';

const C = D.prototypeConfig;
// data/units.js는 JS라서, 레코드가 UnitDef와 맞는지는 tests/data/types.test.js가 확인한다
const unitCost = (id: string): number => (D.byId(id) as unknown as UnitDef).cost;

export interface BuyOptions {
  uid: number; // 새 캐릭터의 uid(번호는 UI가 관리)
  free?: boolean; // 골드 없이 테스트 영입
  slot?: number; // 비울 상점 칸, 없으면 -1
  busy?: boolean; // 전투 진행 중
  beforeMerge?: (keep: RunUnit, removed: RunUnit[]) => void;
}
export type BuyResult =
  | { ok: true; unit: RunUnit; merges: MergeEvent[] }
  | { ok: false; notice: 'T04' | 'T05' | 'T06' | null };

/** 상점에서 캐릭터를 사고, 합성한 뒤 상점을 갱신한다. */
export function buyUnit(state: RunState, id: string, options: BuyOptions): BuyResult {
  const { uid, free = false, slot = -1, busy = false, beforeMerge } = options;
  if (!V.shopPool(state).includes(id)) return { ok: false, notice: 'T04' }; // 3성 보유
  if (busy || state.done || state.roundPhase !== 'prepare' || !D.playableIds.includes(id))
    return { ok: false, notice: null };
  const canMerge = state.units.filter((u) => u.id === id && u.star === 1).length >= 2;
  if (state.units.filter((u) => u.location === 'bench').length >= C.board.benchSize && !canMerge)
    return { ok: false, notice: 'T05' }; // 대기석 가득 참
  const cost = unitCost(id);
  if (!free && state.gold < cost) return { ok: false, notice: 'T06' }; // 골드 부족
  if (!free) state.gold -= cost;
  const unit: RunUnit = { uid, id, location: 'bench', pos: -1, star: 1 };
  state.units.push(unit);
  V.normalize(state);
  if (slot >= 0) state.shop[slot] = null;
  const merges = mergeAll(state, beforeMerge);
  V.normalize(state);
  V.refreshShop(state);
  return { ok: true, unit, merges };
}

/** 판매가: 코스트 × 3^(성급-1). */
export function salePrice(unit: Pick<RunUnit, 'id' | 'star'>): number {
  return unitCost(unit.id) * 3 ** (unit.star - 1);
}

export function canSell(state: RunState, uid: number, busy = false): boolean {
  return (
    !busy &&
    !state.done &&
    state.roundPhase === 'prepare' &&
    state.units.some(
      (u) =>
        u.uid === uid && ['board', 'bench'].includes(u.location) && D.playableIds.includes(u.id),
    )
  );
}

/** 캐릭터 판매: 판매가를 돌려주고 장비는 보관함으로 돌린다. */
export function sellUnit(
  state: RunState,
  uid: number,
  busy = false,
): { ok: true; price: number } | { ok: false } {
  if (!canSell(state, uid, busy)) return { ok: false };
  const unit = state.units.find((u) => u.uid === uid)!;
  const price = salePrice(unit);
  state.gold += price;
  P.releaseEquipment(state, [unit.uid]);
  state.units = state.units.filter((u) => u !== unit);
  return { ok: true, price };
}

export default { buyUnit, salePrice, canSell, sellUnit };
