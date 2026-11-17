// JS 데이터 모듈을 ../types.ts의 타입으로 보는 컴파일 시점 확인(npm run typecheck).
// TypeScript는 JS 값을 느슨하게 추론해서(예: cost를 number로, 배열을 합집합으로)
// 여기서는 단언으로 맞추고, 실제 데이터는 tests/data/types.test.js가 필드별로 검사한다.
// 데이터 파일을 TypeScript로 바꾸면 이 단언은 일반 타입 표기가 된다.
import type { Augment, Bond, Item, SkillDef, StatKey, UnitDef } from '../types.ts';
import Data from './units.js';
import Items from '../items.js';
import Augments from '../augments.js';

// bonds는 명단 객체를 만든 뒤에 붙여서 추론이 따라가지 못한다
export const roster = Data.roster as unknown as readonly UnitDef[];
export const skills: Readonly<Record<string, SkillDef>> = Data.skills;
export const bonds: readonly Bond[] = Data.synergies;
export const statKeys = Data.statKeys as readonly StatKey[];
export const items = Items.items as readonly Item[];
export const augments = Augments.augments as readonly Augment[];
