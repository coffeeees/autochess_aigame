// 원정 시작과 전투 준비(prototype.js fresh와 startBattle에서 옮김). 어떤 UI든
// 원정과 전투를 같은 방식으로 만든다.
import type { RunState, RunUnit } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';
import W from './encounters.js';
import U from './meta-upgrades.ts';

const C = D.prototypeConfig;
/** 모든 원정의 첫 상점은 고정. */
export const FIRST_SHOP = ['C02', 'C04', 'C09', 'C10', 'C11'];

export interface NewRunOptions {
  seed: number; // 원정 시드(UI가 crypto로 뽑음)
  difficulty: number; // 1..10
  firstUid?: number; // 첫 시작 캐릭터의 uid(번호는 UI가 관리)
  runId?: string; // 원정 ID(메타 XP 중복 지급 방지). 없으면 시드로 만든다
  /** 메타 영구 강화 단계(프로필의 upgrades). 주면 원정에 복사하고 시작 보너스(E1·G1·S1)를 준다 */
  metaLevels?: Record<string, number>;
}

/** 새 원정: 7G, 레벨 3, 무작위 1코스트 2명·2코스트 1명, 고정된 첫 상점. */
export function newRun({
  seed,
  difficulty,
  firstUid = 1,
  runId,
  metaLevels,
}: NewRunOptions): RunState {
  const seedHolder: Pick<RunState, 'rngState'> = { rngState: seed };
  let uid = firstUid;
  const units: RunUnit[] = V.startingRoster(P.runRng(seedHolder)).map((id: string) => ({
    uid: uid++,
    id,
    location: 'bench',
    pos: -1,
    star: 1,
  }));
  const state = P.initialize({
    health: C.run.startingHealth,
    gold: C.economy.startingGold,
    units,
    shop: [...FIRST_SHOP],
  }) as RunState;
  state.rngState = seedHolder.rngState;
  state.runId = runId ?? `run-${seed >>> 0}`;
  W.configureNewRun(state, difficulty);
  V.normalize(state);
  if (metaLevels) {
    U.attachToRun(state, metaLevels);
    // 시작 보너스(v0.19.0 메타 강화): 기본값 위에 더한다
    state.gold += U.value(state, 'E1'); // 출발 자금
    const hp = U.value(state, 'S1'); // 원정의 가호: 시작 HP와 HP 상한
    state.health += hp;
    state.maxHealth = U.healthCap(state);
    const xp = U.value(state, 'G1'); // 출발 경험(기존 레벨업 규칙으로)
    if (xp) P.addXp(state, xp);
  }
  return state;
}

export interface BattleSetup {
  allies: Record<string, unknown>[];
  enemies: Record<string, unknown>[];
  options: { allyModifiers: unknown; enemyDamageMultiplier: number; seed: number };
}

/**
 * `new Battle(allies, enemies, options)`에 넣을 유닛과 옵션. 원정 생성기에서 원래
 * 순서대로 뽑는다: 적 편성, 그다음 전투 시드. UI 전용 옵션(quickMana, experimental,
 * onUnitKilled)은 호출하는 쪽이 더한다.
 */
export function battleSetup(state: RunState): BattleSetup {
  const allies = state.units
    .filter((u) => u.location === 'board')
    .map((u) => ({
      ...u,
      bonuses: P.unitBonuses(state, u.uid), // S3 장비 숙련 반영
      itemIds: P.unitItemIds(state, u.uid),
    }));
  const enemies = W.encounter(state);
  return {
    allies,
    enemies,
    options: {
      allyModifiers: P.allyModifiers(state),
      enemyDamageMultiplier: W.difficulty(state.difficulty).enemyDamageMultiplier,
      seed: P.battleSeed(state),
    },
  };
}

export default { FIRST_SHOP, newRun, battleSetup };
