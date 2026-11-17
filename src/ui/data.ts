// Typed read access to the JS data modules for UI code. The data itself is
// validated against these types in tests/data/types.test.js.
import type { UnitDef } from '../core/types.ts';
import D from '../core/data/units.js';
import W from '../core/encounters.js';

const costColors = D.costColors as Record<number, string>;

export const unitDef = (id: string): UnitDef => D.byId(id) as unknown as UnitDef;
export const costColor = (cost: number): string => costColors[cost] ?? costColors[1];

/** Name and cost of any combatant id (characters and enemies). */
export function combatant(id: string): { name: string; cost: number } {
  const spec = W.combatSpec(id) as { name?: unknown; cost?: unknown } | undefined;
  return { name: String(spec?.name ?? id), cost: Number(spec?.cost) || 1 };
}
