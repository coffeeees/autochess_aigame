// 데이터가 src/core/types.ts(UnitDef, SkillDef, Bond, Item, Augment, RunState)와
// 맞는지 실행 시 확인한다. 필드를 추가하면 둘을 함께 고친다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import D from '../../src/core/data/units.js';
import I from '../../src/core/items.js';
import A from '../../src/core/augments.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import { createRng } from '../../src/core/rng.ts';

const STAT_KEYS = ['HP', 'MP', 'AD', 'AP', 'CTH', 'CTC', 'GD', 'AS', 'RNG', 'DOD'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function fields(record, required, optional = {}) {
  for (const [key, check] of Object.entries(required))
    a(check(record[key]), `${key} of ${record.id}`);
  for (const [key, check] of Object.entries(optional))
    if (key in record) a(check(record[key]), `${key} of ${record.id}`);
  const known = new Set([...Object.keys(required), ...Object.keys(optional)]);
  for (const key of Object.keys(record))
    a(known.has(key), `unexpected field ${key} on ${record.id}`);
}
const str = (v) => typeof v === 'string';
const bool = (v) => typeof v === 'boolean';
const strArr = (v) => Array.isArray(v) && v.every(str);

test('Stats는 능력치 키 10개만 가진다', () => {
  a.deepEqual([...D.statKeys].sort(), [...STAT_KEYS].sort());
});

test('명단 항목이 UnitDef와 맞다', () => {
  const bondIds = new Set(D.synergies.map((b) => b.id));
  for (const u of D.roster) {
    fields(
      u,
      {
        id: (v) => /^C\d\d$/.test(v),
        cost: (v) => [1, 2, 3, 4, 5].includes(v),
        race: str,
        job: str,
        trait: str,
        name: str,
        playable: bool,
        provisional: bool,
        stats: (s) => STAT_KEYS.every((k) => isNum(s[k])) && Object.keys(s).length === 10,
        bonds: (v) => strArr(v) && v.length === 2 && v.every((b) => bondIds.has(b)),
      },
      { draftSource: str },
    );
  }
});

test('스킬이 SkillDef와 맞다', () => {
  for (const [id, s] of Object.entries(D.skills))
    fields(
      { id, ...s },
      { id: str, name: str, coefficient: str, text: str },
      { draft: bool, implemented: bool, hpCostBasis: str, todo: strArr },
    );
});

test('유대가 Bond와 맞다', () => {
  for (const b of D.synergies)
    fields(b, {
      id: str,
      name: str,
      category: str,
      thresholds: (v) => Array.isArray(v) && v.every(isNum),
      concept: str,
      effects: (v) => strArr(v) && v.length === b.thresholds.length,
      confirmedEffect: bool,
      balanceVersion: isNum,
    });
});

test('아이템이 Item과 맞다(ItemStats는 AS 대신 ASPercent)', () => {
  const itemStatKeys = new Set([...STAT_KEYS.filter((k) => k !== 'AS'), 'ASPercent']);
  for (const item of I.items)
    fields(item, {
      id: (v) => /^I\d\d$/.test(v),
      name: str,
      tier: (v) => [1, 2, 3].includes(v),
      stats: (s) => Object.entries(s).every(([k, v]) => itemStatKeys.has(k) && isNum(v)),
      statsText: str,
      effect: str,
      iconKey: str,
      icon: str,
    });
});

test('증강이 Augment와 맞다', () => {
  for (const aug of A.augments)
    fields(aug, {
      id: (v) => /^[SGP]\d\d$/.test(v),
      name: str,
      text: str,
      tier: (v) => ['silver', 'gold', 'prism'].includes(v),
      icon: str,
      effect: (v) => v && typeof v === 'object' && !Array.isArray(v),
    });
});

test('새 원정 상태에 RunState 필드가 있다', () => {
  const holder = { rngState: 1 };
  const s = V.normalize(
    P.initialize({
      health: 100,
      gold: 7,
      units: V.startingRoster(createRng(1)).map((id, i) => ({
        uid: i + 1,
        id,
        location: 'bench',
        pos: -1,
        star: 1,
      })),
      shop: ['C02', 'C04', 'C09', 'C10', 'C11'],
    }),
  );
  s.rngState = holder.rngState;
  for (const key of [
    'version',
    'health',
    'gold',
    'level',
    'xp',
    'stage',
    'round',
    'wave',
    'roundPhase',
    'done',
    'boardColumns',
    'units',
    'inventory',
    'itemSequence',
    'shop',
    'shopLocked',
    'shopCarry',
    'augments',
    'augmentSelections',
    'augmentState',
    'completedRounds',
    'completionChoice',
    'lastResult',
    'winStreak',
    'skipDeploymentWarning',
    'recommendedBonds',
    'rngState',
  ])
    a(key in s, key);
  for (const u of s.units) {
    a(['bench', 'board'].includes(u.location));
    a([1, 2, 3].includes(u.star));
    a(Number.isInteger(u.uid));
  }
});
