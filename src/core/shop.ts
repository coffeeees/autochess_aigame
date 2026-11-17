// Buying and selling characters (moved from prototype.js recruit and
// drag-sales.js). The UI shows the notices named in the results.
import type { RunState, RunUnit, UnitDef } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';
import { mergeAll, type MergeEvent } from './merge.ts';

const C = D.prototypeConfig;
// data/units.js is JS; its records are checked against UnitDef in tests/data/types.test.js
const unitCost = (id: string): number => (D.byId(id) as unknown as UnitDef).cost;

export interface BuyOptions {
  uid: number; // uid for the new unit (the UI keeps the counter)
  free?: boolean; // test recruit without paying
  slot?: number; // shop slot that is emptied, -1 for none
  busy?: boolean; // a battle is running
  beforeMerge?: (keep: RunUnit, removed: RunUnit[]) => void;
}
export type BuyResult =
  | { ok: true; unit: RunUnit; merges: MergeEvent[] }
  | { ok: false; notice: 'T04' | 'T05' | 'T06' | null };

/** Buy a character from the shop, then merge copies and refresh the shop. */
export function buyUnit(state: RunState, id: string, options: BuyOptions): BuyResult {
  const { uid, free = false, slot = -1, busy = false, beforeMerge } = options;
  if (!V.shopPool(state).includes(id)) return { ok: false, notice: 'T04' }; // owned at 3 stars
  if (busy || state.done || state.roundPhase !== 'prepare' || !D.playableIds.includes(id))
    return { ok: false, notice: null };
  const canMerge = state.units.filter((u) => u.id === id && u.star === 1).length >= 2;
  if (state.units.filter((u) => u.location === 'bench').length >= C.board.benchSize && !canMerge)
    return { ok: false, notice: 'T05' }; // bench full
  const cost = unitCost(id);
  if (!free && state.gold < cost) return { ok: false, notice: 'T06' }; // not enough gold
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

/** Sale price: cost x 3^(star-1). */
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

/** Sell a character: refund its price and return its equipment to storage. */
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
