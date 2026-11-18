// 게임 로직 공용 데이터 타입(3단계: TypeScript는 데이터부터 도입).
// src/core 모듈이 지금 만드는 값을 설명하며, JS 모듈은 data/check-types.ts에서 이
// 타입과 대조한다.

/** 전투 능력치 10종. RNG는 칸, AS는 초당 공격, CTH/CTC/DOD는 %. */
export interface Stats {
  HP: number;
  MP: number;
  AD: number;
  AP: number;
  CTH: number;
  CTC: number;
  GD: number;
  AS: number;
  RNG: number;
  DOD: number;
}
export type StatKey = keyof Stats;

/** 명단의 캐릭터(data/units.js `roster`). */
export interface UnitDef {
  id: string; // C01..C45
  cost: 1 | 2 | 3 | 4 | 5;
  race: string;
  job: string;
  trait: string;
  name: string;
  playable: boolean;
  provisional: boolean;
  stats: Stats;
  bonds: string[]; // 유대 ID 2개
  draftSource?: string;
}

/** 스킬 설명과 정보(data/units.js `skills`). 동작은 combat/skills/에 있다. */
export interface SkillDef {
  name: string;
  coefficient: string;
  text: string;
  draft?: boolean;
  implemented?: boolean;
  hpCostBasis?: string;
  todo?: string[];
}

/** A bond / synergy (data/units.js `synergies`). */
export interface Bond {
  id: string;
  name: string;
  category: string;
  thresholds: number[];
  concept: string;
  effects: string[]; // 단계마다 설명 하나
  confirmedEffect: boolean;
  balanceVersion: number;
}

export type ItemTier = 1 | 2 | 3;

/** 아이템 능력치: 고정값, 공격 속도만 비율(ASPercent). */
export type ItemStats = Partial<Omit<Stats, 'AS'>> & { ASPercent?: number };

/** Equipment (items.js `items`). */
export interface Item {
  id: string; // I01..I40
  name: string;
  tier: ItemTier;
  stats: ItemStats;
  statsText: string;
  effect: string; // 능력치만 주는 아이템은 ''
  iconKey: string;
  icon: string;
}

export type AugmentTier = 'silver' | 'gold' | 'prism';

/** 증강(augments.js `augments`). `effect`에 조정 가능한 수치가 있다. */
export interface Augment {
  id: string; // 후보 S01..S18, G01..G18, P01..P18 / 이전 증강 LS01..LP12
  name: string;
  text: string;
  tier: AugmentTier;
  icon: string;
  effect: Record<string, unknown>;
  hold?: boolean; // 보류: 후보로 나오지 않음(G13)
  legacy?: boolean; // v0.15.18까지의 확정 증강(예전 저장 전용)
}

/** 원정에서 보유한 캐릭터. */
export interface RunUnit {
  uid: number;
  id: string;
  location: 'bench' | 'board';
  pos: number; // 전장 칸, 대기석이면 -1
  star: 1 | 2 | 3;
  benchSlot?: number;
}

/** 원정에서 보유한 아이템. */
export interface RunItem {
  uid: string; // I1, I2, ...
  id: string; // 아이템 ID
  equippedTo: number | null; // RunUnit.uid
}

export type RoundType = 'SUPPLY' | 'BATTLE' | 'BOSS';

export interface SupplyOffer {
  key: string; // 스테이지-라운드 표기, 예: '1-2'
  options: string[]; // 아이템 ID 4개
  selected: number[]; // 고른 후보 번호(2개면 확정 가능)
}

/** 저장되는 원정(localStorage `starlight-onecost-v1`, 버전 2). */
export interface RunState {
  version: number;
  health: number;
  maxHealth?: number;
  gold: number;
  level: number;
  xp: number;
  stage: number;
  round: number;
  wave: number;
  roundPhase: string;
  done: boolean;
  difficulty?: number;
  boardColumns: number;
  units: RunUnit[];
  inventory: RunItem[];
  itemSequence: number;
  shop: (string | null)[];
  shopLocked: boolean;
  shopCarry: unknown;
  augments: string[];
  augmentSelections: Record<string, unknown>;
  augmentState: Record<string, unknown>;
  completedRounds: Record<string, unknown>;
  completionChoice: unknown;
  lastResult: Record<string, unknown> | null;
  winStreak: number;
  skipDeploymentWarning: boolean;
  recommendedBonds: string[];
  supplyOffer?: SupplyOffer | null;
  enemyEncounter?: { key: string; units: unknown[]; bonusAppeared?: boolean } | null;
  bonusLootLedger?: Record<string, unknown>;
  /** 원정 난수 상태(rng.ts). 재구축 이전 저장에는 없다. */
  rngState?: number;
  /** 증강의 원정 진행 상태(저장 버전 3, augment-run.js) */
  augmentRun?: AugmentRun | null;
}

/** 증강 원정 상태: 늦게 받는 보상, 맡긴 골드, 무료 새로고침, 가치 투자 동료, 분신 지정 */
export interface AugmentRun {
  delayed: { id: string; left: number; gold: number }[];
  invest: { amount: number; left: number; multiplier: number }[];
  freeRerolls: number;
  freeStageUsed: number;
  valueUnitId: string | null;
  valuePickNode: string | null;
  cloneTarget: number | null;
  lastRoundStart: string | null;
  log: string[];
}
