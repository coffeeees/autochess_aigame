// In-game screen layout: HUD on top, side panels, battlefield, reserve bar.
// Stage 5c: HUD, bench and shop work; the board shows the formation read-only
// (placement and dragging come in the next step).
import type { Store, UiState } from '../store.ts';
import { Hud } from './Hud.tsx';
import { Board } from './Board.tsx';
import { ReserveBar } from './ReserveBar.tsx';
import { ShopPopover } from './ShopPopover.tsx';
import { NoticeToast } from './NoticeToast.tsx';
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
          <b>
            <span aria-hidden="true">♥</span> {run.health}
          </b>
        </div>
      </aside>
      <main class={styles.stage}>
        <Board ui={ui} actions={actions} />
        {ui.shopOpen && <ShopPopover ui={ui} actions={actions} />}
        <NoticeToast notice={ui.notice} />
      </main>
      <aside class={styles.right} />
      <ReserveBar ui={ui} actions={actions} />
    </div>
  );
}
