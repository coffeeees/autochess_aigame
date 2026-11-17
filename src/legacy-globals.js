// core 모듈을 기존 화면 스크립트(src/legacy/)가 쓰는 전역 이름(AutoData, AutoEngine 등)으로
// 노출한다. 기존 화면 진입점(main.js)과 Vitest 준비 파일이 쓴다. 기존 화면(legacy.html)을
// 없앨 때 함께 지운다.
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
import PatchNotes from './content/patch-notes.js';
import NoticeAudit from './content/notice-audit.js';

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
    AutoPatchNotes: PatchNotes,
    AutoNoticeAudit: NoticeAudit,
  });
  // 화면에서는 전투가 VFX 이벤트를 기록한다(메인 스레드 대체 계산과 연출용),
  // vfx-events.js를 스크립트로 불러오던 때와 같다.
  if (vfx) VfxEvents.install(Engine.Battle);
}
