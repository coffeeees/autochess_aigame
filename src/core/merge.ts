// Automatic merging: three copies of the same character and star become one copy
// of the next star (moved from prototype.js merge / chooseMergeAnchor).
import type { RunState, RunUnit } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';

const C = D.prototypeConfig;

export interface MergeEvent {
  id: string;
  keep: RunUnit; // the copy that stays (its star is already raised)
  removed: RunUnit[]; // the consumed copies
  star: number; // new star of `keep`
}

/** The copy that stays: one on the board first, otherwise the leftmost bench slot. */
export function mergeAnchor(copies: RunUnit[]): RunUnit {
  return (
    copies.find((u) => u.location === 'board') ||
    copies.reduce((a, b) => ((a.benchSlot ?? Infinity) <= (b.benchSlot ?? Infinity) ? a : b))
  );
}

/**
 * Merge until nothing is left to merge. `before(keep, removed)` runs right before
 * each merge changes the state (the UI starts its merge animation there).
 * Equipment of consumed copies goes back to storage.
 */
export function mergeAll(
  state: RunState,
  before: (keep: RunUnit, removed: RunUnit[]) => void = () => {},
): MergeEvent[] {
  V.normalize(state);
  const events: MergeEvent[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of D.playableIds) {
      for (let star = 1; star < C.economy.maxStar; star++) {
        const copies = state.units.filter((u) => u.id === id && u.star === star);
        if (copies.length >= C.economy.mergeCopies) {
          const keep = mergeAnchor(copies),
            removed = copies.filter((u) => u !== keep).slice(0, 2);
          before(keep, removed);
          P.releaseEquipment(
            state,
            removed.map((u) => u.uid),
          );
          state.units = state.units.filter((u) => !removed.includes(u));
          keep.star = (keep.star + 1) as RunUnit['star'];
          events.push({ id, keep, removed, star: keep.star });
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return events;
}

export default { mergeAnchor, mergeAll };
