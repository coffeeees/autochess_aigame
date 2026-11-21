// 메타 영구 강화(요청서 AUTOCHESS_META_PERMANENT_UPGRADES_IMPLEMENTATION_TEST, v0.19.0). 수치는 data/meta-upgrades.js(임시값).
//
// 프로필 쪽(메타 레벨과 함께 autochess-meta-v1에 저장):
//   - 레벨이 오를 때마다 성장 포인트(P) +2, 뽑기 티켓 +2(새 레벨이 5의 배수면 +4). 원장 rewardedLevel까지 지급했다.
//     예전 프로필(원장 없음)은 rewardedLevel = 1로 보고 현재 레벨까지 한 번 소급한다(같은 함수라 중복 없음).
//   - 구매: 해금 레벨·비용(1P)·최대 단계 확인 → P 차감과 단계 증가를 한 번에. 불변식 사용 P + 보유 P = 획득 P.
// 원정 쪽:
//   - 새 원정을 만들 때 구매한 단계를 원정 저장(state.metaRun.levels)에 복사한다. 그 원정 동안은 고정이고,
//     원정 도중 산 강화는 다음 원정부터 적용된다. 예전 원정 저장(metaRun 없음)은 강화 없음과 같다.
//   - 횟수 제한 효과(E2~E8·G2~G5·S8)는 state.metaRun.used에 원정별로 센다(저장·이어하기에도 유지).
//   - 전투 효과는 combat/meta-effects.js가 전투 옵션(allyModifiers.meta)으로 받아 적용한다.
import data from './data/meta-upgrades.js';
import type { RunState } from './types.ts';

export type UpgradeId = string;
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  branch: 'A' | 'D' | 'E' | 'G' | 'S';
  index: number;
  unlock: number;
  max: number;
  unit: 'pct' | 'pp' | 'flat' | 'count';
  values: number[];
  text: (shown: number) => string;
  order: number;
}
export const upgrades = data.upgrades as unknown as UpgradeDef[];
export const branches = data.branches as {
  id: UpgradeDef['branch'];
  name: string;
  color: string;
}[];
const byIdMap = new Map(upgrades.map((u) => [u.id, u]));
export const byId = (id: string) => byIdMap.get(id) || null;
/** 40종 전체 비용(= 1~100 레벨 보상 P 합 198) */
export const totalCost = upgrades.reduce((n, u) => n + u.max, 0);

/** 단계 값(0단계는 0). 단위는 데이터의 unit 그대로(비율·%p·고정값·횟수) */
export function valueAt(id: string, level: number): number {
  const u = byId(id);
  if (!u || level <= 0) return 0;
  return u.values[Math.min(level, u.max) - 1];
}
/** 화면 표기용 숫자(비율은 %로) */
export function shownValue(id: string, level: number): number {
  const u = byId(id);
  const v = valueAt(id, level);
  return u?.unit === 'pct' ? +(v * 100).toFixed(2) : v;
}
/** 효과 설명(그 단계 값) */
export function effectText(id: string, level: number): string {
  const u = byId(id);
  return u ? u.text(shownValue(id, Math.max(1, level))) : '';
}

// ─── 레벨 보상(성장 포인트·뽑기 티켓) ───
/** 새로 도달한 레벨 하나의 보상 */
export function levelReward(level: number) {
  return {
    points: data.rewards.points,
    tickets: level % 5 === 0 ? data.rewards.ticketsOnFifth : data.rewards.tickets,
  };
}
/** Lv.1에서 레벨 L까지 오르며 받는 누적 보상(소급 지급·불변식 확인용) */
export function cumulativeReward(level: number) {
  let points = 0,
    tickets = 0;
  for (let l = 2; l <= level; l++) {
    const r = levelReward(l);
    points += r.points;
    tickets += r.tickets;
  }
  return { points, tickets };
}

/** 프로필에 들어가는 영구 강화 필드(meta.ts의 MetaProfile이 이 필드를 가진다) */
export interface UpgradeProfile {
  metaLevel: number;
  growthPoints: number; // 쓰지 않은 성장 포인트
  tickets: number; // 뽑기 티켓(이번에는 모으기·표시만)
  upgrades: Record<string, number>;
  /** 레벨 보상 원장: 이 레벨까지 보상을 줬다. 획득 누적도 함께 둔다(검사용) */
  rewards: { level: number; points: number; tickets: number };
  /** 이상한 값을 고친 기록(데이터는 지우지 않음) */
  repairs?: string[];
}

export const usedPoints = (p: Pick<UpgradeProfile, 'upgrades'>) =>
  Object.entries(p.upgrades).reduce((n, [id, lv]) => n + (byId(id) ? lv : 0), 0);

/**
 * 아직 주지 않은 레벨 보상을 지급한다(레벨업 직후·예전 프로필 소급 모두 이 함수). 여러 레벨을 넘으면 차례로 더한다.
 * 돌려주는 값은 이번에 준 양.
 */
export function syncLevelRewards(p: UpgradeProfile) {
  let points = 0,
    tickets = 0;
  while (p.rewards.level < p.metaLevel) {
    const r = levelReward(++p.rewards.level);
    points += r.points;
    tickets += r.tickets;
  }
  p.growthPoints += points;
  p.tickets += tickets;
  p.rewards.points += points;
  p.rewards.tickets += tickets;
  return { points, tickets };
}

/** 저장에서 읽은 강화 필드 정리. 원장이 없으면 예전 프로필(소급 대상). 지우지 않고 범위만 맞춘다. */
export function normalizeUpgradeFields(p: UpgradeProfile, raw: Record<string, unknown>) {
  const int = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);
  const repairs: string[] = Array.isArray(raw.repairs) ? (raw.repairs as string[]).slice(-10) : [];
  p.upgrades = {};
  const rawUp = (raw.upgrades && typeof raw.upgrades === 'object' ? raw.upgrades : {}) as Record<
    string,
    unknown
  >;
  for (const u of upgrades) {
    const lv = int(rawUp[u.id]) ?? 0;
    if (lv > u.max) repairs.push(`${u.id} 단계 ${lv} → ${u.max}`);
    if (lv > 0) p.upgrades[u.id] = Math.min(lv, u.max);
  }
  const ledger = raw.rewards as UpgradeProfile['rewards'] | undefined;
  if (ledger && int(ledger.level) !== null && ledger.level >= 1) {
    p.rewards = {
      level: Math.min(ledger.level, p.metaLevel),
      points: cumulativeReward(Math.min(ledger.level, p.metaLevel)).points,
      tickets: int(ledger.tickets) ?? cumulativeReward(ledger.level).tickets,
    };
    p.growthPoints = int(raw.growthPoints) ?? 0;
    p.tickets = int(raw.tickets) ?? 0;
  } else {
    // 원장이 없는 예전 프로필: 지금 레벨까지 받았어야 할 보상을 아래 sync에서 한 번 준다.
    // 예전에는 성장 포인트·티켓이 없었으므로(growthEnabled: false) 차액 = 전액
    p.rewards = { level: 1, points: 0, tickets: 0 };
    p.growthPoints = 0;
    p.tickets = 0;
  }
  syncLevelRewards(p);
  // 불변식: 사용 P + 보유 P = 획득 P. 어긋나면 보유 P를 맞춘다(강화 단계는 지우지 않음)
  const expect = p.rewards.points - usedPoints(p);
  if (p.growthPoints !== expect) {
    repairs.push(`성장 포인트 ${p.growthPoints} → ${Math.max(0, expect)}`);
    p.growthPoints = Math.max(0, expect);
  }
  if (repairs.length) p.repairs = repairs.slice(-10);
  return p;
}

export type BuyBlock = 'unknown' | 'locked' | 'max' | 'points';
/** 살 수 없는 이유(살 수 있으면 null) */
export function buyBlock(p: UpgradeProfile, id: string): BuyBlock | null {
  const u = byId(id);
  if (!u) return 'unknown';
  if (p.metaLevel < u.unlock) return 'locked';
  if ((p.upgrades[id] || 0) >= u.max) return 'max';
  if (p.growthPoints < 1) return 'points';
  return null;
}
/** 1단계 강화: P 1 차감과 단계 +1을 한 번에(실패하면 아무것도 바꾸지 않음) */
export function buy(p: UpgradeProfile, id: string): boolean {
  if (buyBlock(p, id)) return false;
  p.growthPoints -= 1;
  p.upgrades = { ...p.upgrades, [id]: (p.upgrades[id] || 0) + 1 };
  return true;
}

// ─── 원정 쪽 ───
export interface MetaRun {
  version: 1;
  levels: Record<string, number>;
  used: Record<string, number>;
}
/** state.metaRun 기본값(예전 저장에는 없음 = 강화 없음) */
export function runOf(state: Pick<RunState, 'metaRun'>): MetaRun {
  const r = (state.metaRun ||= { version: 1, levels: {}, used: {} }) as MetaRun;
  r.version = 1;
  if (!r.levels || typeof r.levels !== 'object') r.levels = {};
  if (!r.used || typeof r.used !== 'object') r.used = {};
  for (const [id, lv] of Object.entries(r.levels))
    if (!byId(id) || !Number.isInteger(lv) || lv <= 0) delete r.levels[id];
    else r.levels[id] = Math.min(lv, byId(id)!.max);
  return r;
}
export const level = (state: Pick<RunState, 'metaRun'>, id: string) =>
  state.metaRun?.levels?.[id] || 0;
export const value = (state: Pick<RunState, 'metaRun'>, id: string) =>
  valueAt(id, level(state, id));
/** 횟수 제한 효과를 한 번 쓴다(남았으면 true). 실제로 효과가 일어날 때만 부른다 */
export function take(state: Pick<RunState, 'metaRun'>, id: string): boolean {
  const limit = value(state, id);
  if (limit <= 0) return false;
  const r = runOf(state);
  if ((r.used[id] || 0) >= limit) return false;
  r.used[id] = (r.used[id] || 0) + 1;
  return true;
}
/** 남은 횟수 */
export function left(state: Pick<RunState, 'metaRun'>, id: string): number {
  return Math.max(0, value(state, id) - (state.metaRun?.used?.[id] || 0));
}

/** 플레이어 HP 상한: 기본 100 + S1 원정의 가호(원정에 복사한 단계 기준, 강화가 없으면 100) */
export const BASE_HEALTH_CAP = 100;
export function healthCap(state: Pick<RunState, 'metaRun'>): number {
  return BASE_HEALTH_CAP + value(state, 'S1');
}

/** 새 원정에 구매 단계를 복사한다(원정 생성 직후, 시작 보너스 적용 전) */
export function attachToRun(state: RunState, levels: Record<string, number>) {
  state.metaRun = { version: 1, levels: { ...levels }, used: {} };
  runOf(state);
}

/** 전투 옵션으로 넘길 강화 정보(Worker로 JSON 전달). 강화가 없으면 null(전투가 예전과 같음) */
export function combatInfo(state: RunState) {
  const levels = state.metaRun?.levels || {};
  if (!Object.keys(levels).length) return null;
  return { levels: { ...levels }, stage: state.stage };
}

/**
 * S5 행운의 영입: 상점 확률표에 4~5코스트 합 +x%p. 그 레벨에서 확률이 0보다 큰 4~5코스트만 늘리고(원래 비율대로 나눔),
 * 나머지 코스트에서 원래 비율대로 뺀다. 합 100, 음수 없음. 4~5코스트가 안 나오는 레벨은 그대로.
 */
export function shopOdds(odds: number[], state: Pick<RunState, 'metaRun'>): number[] {
  const add = value(state, 'S5');
  if (add <= 0) return odds;
  const high = [3, 4].filter((i) => odds[i] > 0);
  const low = [0, 1, 2].filter((i) => odds[i] > 0);
  const highSum = high.reduce((n, i) => n + odds[i], 0);
  const lowSum = low.reduce((n, i) => n + odds[i], 0);
  if (!high.length || lowSum <= 0) return odds;
  const delta = Math.min(add, lowSum);
  return odds.map((p, i) =>
    high.includes(i) ? p + (delta * p) / highSum : low.includes(i) ? p - (delta * p) / lowSum : p,
  );
}

export default {
  upgrades,
  branches,
  byId,
  totalCost,
  valueAt,
  shownValue,
  effectText,
  levelReward,
  cumulativeReward,
  usedPoints,
  syncLevelRewards,
  normalizeUpgradeFields,
  buyBlock,
  buy,
  runOf,
  level,
  value,
  take,
  left,
  attachToRun,
  combatInfo,
  shopOdds,
  healthCap,
};
