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
  /** 성별(v0.20.0, 데이터만·화면 표시 없음) */
  gender: 'female' | 'male';
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

/** 장비 종류(v0.20.0): 기본 장비 8종, 기본 장비 2개를 합친 완성 장비 36종 */
export type ItemKind = 'base' | 'complete';

/** 장비 능력치: HP·AD·AP·AS는 %(현재 값에 곱함), GD는 고정값, CTC·DOD·CTH는 %p, MP 획득량은 %. */
export interface ItemStats {
  ADPercent?: number;
  APPercent?: number;
  ASPercent?: number;
  HPPercent?: number;
  GD?: number;
  MPGainPercent?: number;
  CTC?: number;
  DOD?: number;
  CTH?: number;
}

/** Equipment (items.js `items`). */
export interface Item {
  id: string; // IB01..IB08 기본, IC01..IC36 완성
  kind: ItemKind;
  name: string;
  stats: ItemStats; // 기본 능력치(여러 개 끼면 개수만큼 합산)
  uniqueStats?: ItemStats; // 고유 효과의 상시 능력치(같은 장비 여러 개여도 1번, v0.21.0)
  statsText: string;
  effect: string; // 기본 장비는 ''
  iconKey: string;
  /** 기본 장비: 조합표에 쓰는 짧은 이름(검·지팡이…) */
  short?: string;
  /** 완성 장비: 재료 기본 장비 두 개, 두 번째 재료 그림, 고유 효과 판정 키(combat/item-effects.js) */
  recipe?: [string, string];
  subIconKey?: string;
  effectKey?: string;
}

export type AugmentTier = 'silver' | 'gold' | 'prism';

/** 증강(augments.js `augments`). `effect`에 조정 가능한 수치가 있다. */
export interface Augment {
  id: string; // S01..S18, G01..G18, P01..P18
  name: string;
  text: string;
  tier: AugmentTier;
  icon: string;
  effect: Record<string, unknown>;
  hold?: boolean; // 보류: 후보로 나오지 않음(지금은 없음)
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

/** 저장되는 원정(localStorage `starlight-onecost-v1`, 버전 4). */
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
  /** 원정 ID: 메타 XP를 원정마다 한 번만 주는 데 쓴다(v0.17.2, 그 전 저장에는 없음) */
  runId?: string;
  /** 증강의 원정 진행 상태(augment-run.js) */
  augmentRun?: AugmentRun | null;
  /** 회수기 수(v0.20.0, 장착 장비 전부 회수). 예전 저장은 이관 때 2 */
  recoveryTools?: number;
  /** 메타 영구 강화(v0.19.0): 원정 시작 때 복사한 단계와 횟수 제한 효과 사용량(meta-upgrades.ts). 예전 저장에는 없음 */
  metaRun?: { version: 1; levels: Record<string, number>; used: Record<string, number> } | null;
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
