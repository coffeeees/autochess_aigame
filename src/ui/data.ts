// UI 코드에서 JS 데이터 모듈을 타입과 함께 읽는 함수들. 데이터 자체가 타입과
// 맞는지는 tests/data/types.test.js에서 확인한다.
import type { UnitDef } from '../core/types.ts';
import D from '../core/data/units.js';
import W from '../core/encounters.js';

const costColors = D.costColors as Record<number, string>;

export const unitDef = (id: string): UnitDef => D.byId(id) as unknown as UnitDef;
export const roster = (): UnitDef[] => D.roster as unknown as UnitDef[];
export const costColor = (cost: number): string => costColors[cost] ?? costColors[1];

/** 전투 참가자(캐릭터·적) ID의 이름과 코스트. */
export function combatant(id: string): { name: string; cost: number } {
  const spec = W.combatSpec(id) as { name?: unknown; cost?: unknown } | undefined;
  return { name: String(spec?.name ?? id), cost: Number(spec?.cost) || 1 };
}
