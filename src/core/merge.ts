// 자동 합성: 같은 캐릭터·같은 성급 3명이 다음 성급 1명이 된다
// (prototype.js merge / chooseMergeAnchor에서 옮김).
import type { RunState, RunUnit } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';

const C = D.prototypeConfig;

export interface MergeEvent {
  id: string;
  keep: RunUnit; // 남는 캐릭터(성급은 이미 올라간 상태)
  removed: RunUnit[]; // 재료로 사라진 캐릭터
  star: number; // `keep`의 새 성급
}

/** 남을 캐릭터: 전장에 있는 것이 먼저, 없으면 대기석 가장 왼쪽 칸. */
export function mergeAnchor(copies: RunUnit[]): RunUnit {
  return (
    copies.find((u) => u.location === 'board') ||
    copies.reduce((a, b) => ((a.benchSlot ?? Infinity) <= (b.benchSlot ?? Infinity) ? a : b))
  );
}

/**
 * 더 합칠 것이 없을 때까지 합성한다. `before(keep, removed)`는 합성이 상태를 바꾸기
 * 직전에 실행된다(UI가 합성 연출을 시작하는 시점). 재료 캐릭터의 장비는 보관함으로 돌아간다.
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
