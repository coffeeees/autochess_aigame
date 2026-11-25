// 캐릭터 기본 능력치 편집 규칙(v0.25.0 관리자, 요청서 AUTOCHESS_ADMIN_CHARACTER_STATS_THUMBNAILS_2026-11-25). 순수 함수.
// 대상은 data/units.js의 기본 능력치 10개(성급·장비·유대·증강·메타가 붙기 전 값). 단위는 내부 값 그대로다.
// 범위는 전투 엔진이 실제로 쓰는 조건만 검사한다(근거 없는 상한·소수 자리 제한은 두지 않음):
//   HP·MP·AS는 0보다 커야 하고(나누기·마나 가득 판정·공격 간격), RNG는 1 이상 정수(칸 거리), 나머지는 0 이상.
//   회피는 기본값을 얼마로 넣어도 전투 판정에서 최종 40% 상한(combat.dodgeCap), 치명타 확률은 100%까지 그대로.
import D from './data/units.js';

export type StatKey = 'HP' | 'MP' | 'AD' | 'AP' | 'CTH' | 'CTC' | 'GD' | 'AS' | 'RNG' | 'DOD';
export type UnitStats = Record<StatKey, number>;

export interface StatField {
  key: StatKey;
  label: string;
  unit: string;
  min: number; // 이 값 이상(exclusive면 초과)
  exclusive: boolean;
  integer: boolean;
  note?: string;
}

export const statFields: readonly StatField[] = [
  { key: 'HP', label: '체력', unit: '', min: 0, exclusive: true, integer: false },
  {
    key: 'MP',
    label: '마나',
    unit: '',
    min: 0,
    exclusive: true,
    integer: false,
    note: '가득 차면 스킬 사용',
  },
  { key: 'AD', label: '공격력', unit: '', min: 0, exclusive: false, integer: false },
  { key: 'AP', label: '마법력', unit: '', min: 0, exclusive: false, integer: false },
  {
    key: 'CTH',
    label: '치명타 피해',
    unit: '%',
    min: 0,
    exclusive: false,
    integer: false,
    note: '150 = 1.5배',
  },
  {
    key: 'CTC',
    label: '치명타 확률',
    unit: '%',
    min: 0,
    exclusive: false,
    integer: false,
    note: '전투에서 100%까지',
  },
  { key: 'GD', label: '방어력', unit: '', min: 0, exclusive: false, integer: false },
  { key: 'AS', label: '공격속도', unit: '회/초', min: 0, exclusive: true, integer: false },
  { key: 'RNG', label: '공격 사거리', unit: '칸', min: 1, exclusive: false, integer: true },
  {
    key: 'DOD',
    label: '회피 확률',
    unit: '%',
    min: 0,
    exclusive: false,
    integer: false,
    note: '최종 판정은 최대 40%',
  },
];
export const statKeys = statFields.map((f) => f.key);

type Unit = { id: string; stats: UnitStats; sourceStats: UnitStats };
const unit = (id: string) => D.byId(id) as unknown as Unit | undefined;

/** 지금 게임이 쓰는 기본 능력치(원본 + 반영본) */
export const gameStats = (id: string): UnitStats | undefined => {
  const u = unit(id);
  return u ? { ...u.stats } : undefined;
};
/** 반영본을 합치기 전 원본 능력치 */
export const sourceStats = (id: string): UnitStats | undefined => {
  const u = unit(id);
  return u ? { ...u.sourceStats } : undefined;
};

/** 숫자 하나 검사. 문제가 없으면 null, 있으면 안내 문구 */
export function checkStat(key: StatKey, value: unknown): string | null {
  const f = statFields.find((x) => x.key === key);
  if (!f) return '알 수 없는 능력치';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '숫자를 입력하세요';
  if (f.exclusive ? value <= f.min : value < f.min)
    return f.exclusive ? `${f.min}보다 커야 합니다` : `${f.min} 이상이어야 합니다`;
  if (f.integer && !Number.isInteger(value)) return '정수로 입력하세요';
  return null;
}

/** 입력 칸 글자 → 숫자(빈 값·숫자가 아닌 글자는 NaN). 소수는 그대로 보존 */
export function parseStat(text: string): number {
  const t = text.trim();
  if (!t || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}

/** 10개 전체 검사 → 키별 오류(없으면 빈 객체) */
export function checkStats(
  stats: Partial<Record<string, unknown>>,
): Partial<Record<StatKey, string>> {
  const out: Partial<Record<StatKey, string>> = {};
  for (const k of statKeys) {
    const e = checkStat(k, stats[k]);
    if (e) out[k] = e;
  }
  for (const k of Object.keys(stats))
    if (!statKeys.includes(k as StatKey)) out[k as StatKey] = '알 수 없는 능력치';
  return out;
}

export const sameStats = (a?: UnitStats | null, b?: UnitStats | null) =>
  !!a && !!b && statKeys.every((k) => a[k] === b[k]);

/** 원본과 다른 키만(반영본 파일에 쓰는 형태) */
export function diffFromSource(id: string, stats: UnitStats): Partial<UnitStats> {
  const src = sourceStats(id);
  if (!src) return {};
  return Object.fromEntries(statKeys.filter((k) => stats[k] !== src[k]).map((k) => [k, stats[k]]));
}

export default {
  statFields,
  statKeys,
  gameStats,
  sourceStats,
  checkStat,
  parseStat,
  checkStats,
  sameStats,
  diffFromSource,
};
