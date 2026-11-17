// Starting a run and preparing a battle (moved from prototype.js fresh and
// startBattle, so every UI builds runs and battles the same way).
import type { RunState, RunUnit } from './types.ts';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';
import W from './encounters.js';

const C = D.prototypeConfig;
/** The first shop of every run is fixed. */
export const FIRST_SHOP = ['C02', 'C04', 'C09', 'C10', 'C11'];

export interface NewRunOptions {
  seed: number; // run seed (the UI draws it with crypto)
  difficulty: number; // 1..10
  firstUid?: number; // uid of the first starting unit (the UI keeps the counter)
}

/** A new run: 7G, level 3, two 1-cost and one 2-cost random units, fixed first shop. */
export function newRun({ seed, difficulty, firstUid = 1 }: NewRunOptions): RunState {
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
  W.configureNewRun(state, difficulty);
  V.normalize(state);
  return state;
}

export interface BattleSetup {
  allies: Record<string, unknown>[];
  enemies: Record<string, unknown>[];
  options: { allyModifiers: unknown; enemyDamageMultiplier: number; seed: number };
}

/**
 * Units and options for `new Battle(allies, enemies, options)`. Draws from the
 * run generator in the original order: enemy formation, then the battle seed.
 * UI-only options (quickMana, experimental, onUnitKilled) are added by the caller.
 */
export function battleSetup(state: RunState): BattleSetup {
  const allies = state.units
    .filter((u) => u.location === 'board')
    .map((u) => ({
      ...u,
      bonuses: P.unitBonuses(state, u.uid),
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
