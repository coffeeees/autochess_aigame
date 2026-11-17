// Shared data types for the game logic (stage 3: TypeScript starts with the data).
// They describe what the modules in src/core produce today; JS modules are checked
// against them in data/check-types.ts.

/** The ten combat stats. RNG is in cells, AS in attacks per second, CTH/CTC/DOD in percent. */
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

/** A character in the roster (data/units.js `roster`). */
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
  bonds: string[]; // two bond (synergy) ids
  draftSource?: string;
}

/** Skill text and metadata (data/units.js `skills`). The behaviour is in combat/skills/. */
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
  effects: string[]; // one text per threshold
  confirmedEffect: boolean;
  balanceVersion: number;
}

export type ItemTier = 1 | 2 | 3;

/** Item stat bonuses: flat values, except attack speed which is a percentage (ASPercent). */
export type ItemStats = Partial<Omit<Stats, 'AS'>> & { ASPercent?: number };

/** Equipment (items.js `items`). */
export interface Item {
  id: string; // I01..I40
  name: string;
  tier: ItemTier;
  stats: ItemStats;
  statsText: string;
  effect: string; // '' when the item only gives stats
  iconKey: string;
  icon: string;
}

export type AugmentTier = 'silver' | 'gold' | 'prism';

/** An augment (augments.js `augments`). `effect` holds the editable numbers. */
export interface Augment {
  id: string; // S01.., G01.., P01..
  name: string;
  text: string;
  tier: AugmentTier;
  icon: string;
  effect: Record<string, unknown>;
}

/** A character owned in a run. */
export interface RunUnit {
  uid: number;
  id: string;
  location: 'bench' | 'board';
  pos: number; // board cell, -1 on the bench
  star: 1 | 2 | 3;
  benchSlot?: number;
}

/** An item owned in a run. */
export interface RunItem {
  uid: string; // I1, I2, ...
  id: string; // item id
  equippedTo: number | null; // RunUnit.uid
}

export type RoundType = 'SUPPLY' | 'BATTLE' | 'BOSS';

export interface SupplyOffer {
  key: string; // stage-round label, e.g. '1-2'
  options: string[]; // four item ids
  selected: number[]; // chosen option indexes (two to confirm)
}

/** The saved run (localStorage `starlight-onecost-v1`, version 2). */
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
  /** Run random-number state (rng.ts). Missing in saves from before the rebuild. */
  rngState?: number;
}
