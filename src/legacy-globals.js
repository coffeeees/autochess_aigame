// Exposes the core modules under the global names the pre-module UI scripts in
// src/legacy/ still use (AutoData, AutoEngine, ...). Used by the browser entry
// (main.js) and by the Vitest setup file. Remove once the UI is rewritten (stage 5).
import Board from './core/board.js';
import Bonds from './core/data/bonds.js';
import HigherDrafts from './core/data/higher-cost-drafts.js';
import Data from './core/data/units.js';
import Items from './core/items.js';
import Augments from './core/augments.js';
import Progression from './core/progression.js';
import World from './core/encounters.js';
import Preparation from './core/preparation.js';
import Engine from './core/combat/battle.js';
import ItemEffects from './core/combat/item-effects.js';
import AugmentEffects from './core/combat/augment-effects.js';
import BondEffects from './core/combat/bond-effects.js';
import VfxEvents from './core/combat/vfx-events.js';
import CombatClock from './core/combat/clock.js';
import Save from './core/save.ts';
import Shop from './core/shop.ts';
import Merge from './core/merge.ts';
import Run from './core/run.ts';

export function installLegacyGlobals(root, { vfx = true } = {}) {
  Object.assign(root, {
    AutoBoard: Board,
    AutoBonds: Bonds,
    AutoHigherDrafts: HigherDrafts,
    AutoData: Data,
    AutoItems: Items,
    AutoAugments: Augments,
    AutoProgression: Progression,
    AutoWorld: World,
    AutoPreparation: Preparation,
    AutoEngine: Engine,
    AutoItemEffects: ItemEffects,
    AutoAugmentEffects: AugmentEffects,
    AutoBondEffects: BondEffects,
    AutoVfxEvents: VfxEvents,
    AutoCombatClock: CombatClock,
    AutoSave: Save,
    AutoShop: Shop,
    AutoMerge: Merge,
    AutoRun: Run,
  });
  // In the page, battles record VFX events (main-thread fallback and presentation),
  // as vfx-events.js did when it was loaded as a script.
  if (vfx) VfxEvents.install(Engine.Battle);
}
