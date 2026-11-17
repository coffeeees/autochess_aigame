// Compile-time view of the JS data modules as the types in ../types.ts
// (npm run typecheck). TypeScript infers the JS literals loosely (e.g. cost as
// number, tuples as unions), so the values are asserted here; the data itself is
// validated field by field at runtime in tests/data/types.test.js. Once the data
// files are TypeScript these assertions become plain annotations.
import type { Augment, Bond, Item, SkillDef, StatKey, UnitDef } from '../types.ts';
import Data from './units.js';
import Items from '../items.js';
import Augments from '../augments.js';

// bonds are attached after the roster objects are built, which inference cannot follow
export const roster = Data.roster as unknown as readonly UnitDef[];
export const skills: Readonly<Record<string, SkillDef>> = Data.skills;
export const bonds: readonly Bond[] = Data.synergies;
export const statKeys = Data.statKeys as readonly StatKey[];
export const items = Items.items as readonly Item[];
export const augments = Augments.augments as readonly Augment[];
