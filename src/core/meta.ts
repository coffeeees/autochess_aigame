// 메타 레벨(원정 사이에 이어지는 영구 성장). 인게임 레벨·XP와 완전히 분리된다.
// 기준: AUTOCHESS 메타 레벨 1~100 구현 및 테스트 요청서(v0.17.2). 최대 레벨 100은 확정,
// 필요 XP 곡선과 원정 보상 수치는 테스트용 임시값(사용자 승인 없이 바꾸지 않는다).
// v0.19.0: 레벨업 보상(성장 포인트·뽑기 티켓)과 영구 강화 40종은 meta-upgrades.ts(프로필 필드를 여기서 함께 저장).
// 프로필은 원정 저장과 다른 키(META_KEY)에 저장한다. 저장소 읽기·쓰기는 UI가 한다.
import type { RunState } from './types.ts';
import data from './data/meta.js';
import U, { type UpgradeProfile } from './meta-upgrades.ts';

export const META_KEY = 'autochess-meta-v1';
/** 개발용 테스트 프로필(주소에 ?metadev). 정식 프로필과 섞이지 않는다 */
export const META_DEV_KEY = 'autochess-meta-dev-v1';

/** 수치는 data/meta.js(임시값). 원정 보상: 5 + 정규 구간 완료 스테이지 × 2 + 6-5 클리어 시 15(최대 80) */
export const config = {
  maxLevel: data.maxLevel,
  baseXp: data.reward.base,
  perStageXp: data.reward.perStage,
  clearBonusXp: data.reward.clearBonus,
  regularStages: data.reward.regularStages, // 1-1 ~ 6-5
  roundsPerStage: 5,
  keepPayments: 20, // 중복 지급 방지용으로 기억하는 최근 원정 수
};

/** 레벨 L에서 L+1로 오르는 데 필요한 XP. 최대 레벨이면 0 */
export function requiredXp(level: number): number {
  if (level >= config.maxLevel) return 0;
  const seg = data.curve.find((c) => level >= c.from && level <= c.to);
  if (!seg) throw Error('메타 레벨 범위 밖: ' + level);
  return seg.start + seg.step * (level - seg.from);
}

/** Lv.1·0 XP에서 그 레벨에 도달하는 데 필요한 누적 XP */
export function cumulativeXp(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, config.maxLevel); l++) total += requiredXp(l);
  return total;
}

export interface MetaPayment {
  runId: string;
  xp: number;
  stages: number; // 정규 구간 완료 스테이지 수(0~30)
  cleared: boolean; // 6-5 완료(승리)
  /** 지급 시점: end 원정 종료, continue 6-5 뒤 계속 진행(정규 구간 확정), abandon 끝내지 않은 원정 포기 */
  reason?: MetaReason;
  before: { level: number; xp: number };
  after: { level: number; xp: number };
  /** 이번 지급으로 오른 레벨의 보상(v0.19.0) */
  rewards?: { points: number; tickets: number };
}

export type MetaReason = 'end' | 'continue' | 'abandon';

export interface MetaProfile extends UpgradeProfile {
  /** 2: 성장 포인트·티켓·영구 강화(v0.19.0). 1(예전)도 읽어서 2로 올린다(소급 지급) */
  version: 2;
  metaLevel: number;
  metaXp: number; // 현재 레벨에서 쌓은 XP
  totalXp: number; // 지금까지 실제로 반영된 메타 XP 합(최대 레벨 뒤로는 늘지 않음)
  growthEnabled: true; // 레벨업 보상·영구 강화 사용(v0.19.0)
  payments: MetaPayment[]; // 최근 지급 기록(원정 ID로 중복 지급 방지)
}

export function newProfile(): MetaProfile {
  return {
    version: 2,
    metaLevel: 1,
    metaXp: 0,
    totalXp: 0,
    growthEnabled: true,
    payments: [],
    growthPoints: 0,
    tickets: 0,
    upgrades: {},
    rewards: { level: 1, points: 0, tickets: 0 },
  };
}

/** 저장에서 읽은 값을 정리한다. 이상한 값은 새 프로필 기준으로 되돌린다. */
export function normalizeProfile(raw: unknown): MetaProfile {
  const p = newProfile();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null;
  p.metaLevel = int(r.metaLevel, 1, config.maxLevel) ?? 1;
  p.metaXp =
    p.metaLevel >= config.maxLevel
      ? 0
      : Math.min(int(r.metaXp, 0, Infinity) ?? 0, requiredXp(p.metaLevel) - 1);
  p.totalXp = Math.max(
    int(r.totalXp, 0, Infinity) ?? 0,
    cumulativeXp(p.metaLevel) + p.metaXp, // 예전 프로필(누적 없음)도 레벨에 맞춘다
  );
  if (Array.isArray(r.payments))
    p.payments = (r.payments as MetaPayment[])
      .filter((x) => x && typeof x.runId === 'string' && Number.isInteger(x.xp))
      .slice(-config.keepPayments);
  // 성장 포인트·티켓·강화 단계(원장이 없는 예전 프로필은 지금 레벨까지 한 번 소급)
  U.normalizeUpgradeFields(p, r);
  return p;
}

/** XP를 더한다: 남는 XP는 다음 레벨로 이월, 여러 레벨 한 번에 가능, Lv.100에서는 더 쌓지 않는다. */
export function addXp(profile: MetaProfile, amount: number) {
  const before = { level: profile.metaLevel, xp: profile.metaXp };
  let left = Math.max(0, Math.floor(amount));
  while (left > 0 && profile.metaLevel < config.maxLevel) {
    const need = requiredXp(profile.metaLevel) - profile.metaXp;
    const used = Math.min(need, left);
    profile.metaXp += used;
    profile.totalXp += used;
    left -= used;
    if (profile.metaXp >= requiredXp(profile.metaLevel)) {
      profile.metaLevel++;
      profile.metaXp = 0;
    }
  }
  if (profile.metaLevel >= config.maxLevel) profile.metaXp = 0;
  return { before, after: { level: profile.metaLevel, xp: profile.metaXp } };
}

const ordinalOf = (r: { stage?: number; round?: number }) =>
  ((r.stage ?? 0) - 1) * config.roundsPerStage + (r.round ?? 0);

/**
 * 정규 구간(1-1 ~ 6-5)에서 완료한 스테이지 수. 보급은 완료했으면 포함, 패배한 전투는 제외.
 * 7-1 이후(무한 라운드)는 세지 않는다.
 */
export function completedStages(run: Pick<RunState, 'completedRounds'>): number {
  return Object.values(run.completedRounds || {}).filter((raw) => {
    const r = raw as { stage?: number; round?: number; type?: string; win?: boolean };
    const n = ordinalOf(r);
    return n >= 1 && n <= config.regularStages && (r.type === 'SUPPLY' || r.win === true);
  }).length;
}

/** 6-5를 이겨서 정규 구간을 클리어했는지 */
export function regularCleared(run: Pick<RunState, 'completedRounds'>): boolean {
  const r = (run.completedRounds || {})['6-5'] as { win?: boolean } | undefined;
  return r?.win === true;
}

/** 원정 하나의 메타 XP(정규 구간만, 최대 80) */
export function runReward(run: Pick<RunState, 'completedRounds'>, reason: MetaReason = 'end') {
  const stages = completedStages(run);
  const cleared = regularCleared(run);
  const stageXp = stages * config.perStageXp;
  const clearXp = cleared ? config.clearBonusXp : 0;
  // 원정 포기는 기본 XP 없이 완료 스테이지만(사용자 결정 2026-11-19 (나): 새 원정 반복으로 쌓지 못하게)
  const base = reason === 'abandon' ? 0 : config.baseXp;
  return {
    stages,
    cleared,
    base,
    stageXp,
    clearXp,
    xp: base + stageXp + clearXp,
  };
}

/** 화면 표기: "2 / 20 XP", Lv.100은 "MAX"(분모 0을 쓰지 않는다) */
export function progressLabel(level: number, xp: number): string {
  return level >= config.maxLevel ? 'MAX' : `${xp} / ${requiredXp(level)} XP`;
}

export function paymentFor(profile: MetaProfile, runId: string | undefined): MetaPayment | null {
  return (runId && profile.payments.find((p) => p.runId === runId)) || null;
}

/**
 * 원정 하나의 메타 XP를 한 번 지급한다(같은 runId는 다시 주지 않음, runId가 없으면 null). 지급 시점(사용자 결정 2026-11-19):
 * - end: 원정이 끝남(HP 0 게임 오버, 6-5 뒤 "게임 종료", 무한 라운드 게임 오버). run.done이어야 한다
 * - continue: 6-5 뒤 "계속 진행"을 고른 순간 정규 구간 보상(최대 80)을 확정. 무한 라운드에서 끝나도 더 주지 않는다
 * - abandon: 끝내지 않은 원정을 새 원정으로 바꿀 때 그때까지의 XP
 */
export function settleRun(
  profile: MetaProfile,
  run: RunState,
  reason: MetaReason = 'end',
): MetaPayment | null {
  if (!run.runId || paymentFor(profile, run.runId)) return null;
  if (reason === 'end' && !run.done) return null;
  if (reason === 'continue' && run.completionChoice !== 'continue') return null;
  const reward = runReward(run, reason);
  const { before, after } = addXp(profile, reward.xp);
  const rewards = U.syncLevelRewards(profile); // 오른 레벨마다 성장 포인트·티켓
  const payment: MetaPayment = {
    runId: run.runId,
    xp: reward.xp,
    stages: reward.stages,
    cleared: reward.cleared,
    reason,
    before,
    after,
    rewards,
  };
  profile.payments = [...profile.payments, payment].slice(-config.keepPayments);
  return payment;
}

export default {
  META_KEY,
  META_DEV_KEY,
  config,
  requiredXp,
  cumulativeXp,
  newProfile,
  normalizeProfile,
  addXp,
  completedStages,
  regularCleared,
  runReward,
  progressLabel,
  paymentFor,
  settleRun,
};
