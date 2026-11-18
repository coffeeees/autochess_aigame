// 게임 화면 배치: 위 HUD, 양쪽 패널, 가운데 전장, 아래 대기석 바.
// 캐릭터는 전장 칸과 대기석 칸 사이를 끌어서 배치한다.
import type { Store, UiState } from '../store.ts';
import { Hud } from './Hud.tsx';
import { Board } from './Board.tsx';
import { ReserveBar } from './ReserveBar.tsx';
import { ShopPopover } from './ShopPopover.tsx';
import { NoticeToast } from './NoticeToast.tsx';
import { DragLayer } from './DragLayer.tsx';
import { BondsPanel } from './BondsPanel.tsx';
import { InventoryPanel, ItemDetail } from './Items.tsx';
import { UnitDetail } from './UnitDetail.tsx';
import { Modals } from './Modals.tsx';
import { ScreenCues } from './ScreenCues.tsx';
import { AugmentRack } from './AugmentRack.tsx';
import { HealthCounter } from './VitalEffects.tsx';
import { SpeedButton, LiveDamage } from './CombatControls.tsx';
import W from '../../core/encounters.js';
import { boardArt } from '../art/board.ts';
import styles from './Game.module.css';

export type GameProps = { ui: UiState; actions: Store['actions'] };

export function Game({ ui, actions }: GameProps) {
  const run = ui.run!;
  return (
    <div class={styles.screen} style={{ backgroundImage: `url(${boardArt.background})` }}>
      <Hud ui={ui} actions={actions} />
      <aside class={styles.left}>
        <div class={styles.vitals}>
          <small>난이도 {W.difficulty(run.difficulty).level}</small>
          <HealthCounter value={run.health} />
        </div>
        <BondsPanel ui={ui} actions={actions} />
      </aside>
      <main class={styles.stage}>
        <Board ui={ui} actions={actions} />
        <AugmentRack ui={ui} actions={actions} />
        <LiveDamage ui={ui} actions={actions} />
        <SpeedButton ui={ui} actions={actions} />
        {ui.shopOpen && <ShopPopover ui={ui} actions={actions} />}
        <NoticeToast notice={ui.notice} />
      </main>
      <aside class={styles.right}>
        <InventoryPanel ui={ui} actions={actions} />
        <ItemDetail ui={ui} actions={actions} />
      </aside>
      <ReserveBar ui={ui} actions={actions} />
      <DragLayer ui={ui} actions={actions} kind={ui.drag?.kind} />
      <UnitDetail ui={ui} actions={actions} />
      <Modals ui={ui} actions={actions} />
      <ScreenCues ui={ui} actions={actions} />
    </div>
  );
}
