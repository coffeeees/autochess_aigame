// Dragging units: document-level pointer handling, the ghost under the pointer
// and the sell zones on both sides (v0.15.18 interaction-ui.js / drag-sales.js).
import { useEffect } from 'preact/hooks';
import { salePrice } from '../../core/shop.ts';
import { CharacterImage } from './CharacterImage.tsx';
import type { GameProps } from './Game.tsx';
import styles from './DragLayer.module.css';

/** data-drop value of the element under a point (the ghost ignores the pointer). */
const dropAt = (x: number, y: number): string | null =>
  document.elementFromPoint(x, y)?.closest('[data-drop]')?.getAttribute('data-drop') ?? null;

export function DragLayer({ ui, actions }: GameProps) {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      actions.dragMove(e.pointerId, e.clientX, e.clientY, dropAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => actions.dragEnd(e.pointerId, dropAt(e.clientX, e.clientY));
    const key = (e: KeyboardEvent) => e.key === 'Escape' && actions.dragCancel();
    const hidden = () => document.hidden && actions.dragCancel();
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', actions.dragCancel);
    document.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', actions.dragCancel);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', actions.dragCancel);
      document.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', actions.dragCancel);
    };
  }, [actions]);

  const drag = ui.drag;
  if (!drag?.active) return null;
  const unit = ui.run?.units.find((u) => u.uid === drag.uid);
  if (!unit) return null;
  const price = salePrice(unit);
  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <div
          key={side}
          class={styles.sellZone}
          data-side={side}
          data-drop={`sell:${side}`}
          data-over={drag.over === `sell:${side}`}
        >
          <b>판매</b>
          <strong>{price}G</strong>
        </div>
      ))}
      <div class={styles.ghost} style={{ left: `${drag.x}px`, top: `${drag.y}px` }}>
        <CharacterImage id={unit.id} context="bench" />
      </div>
    </>
  );
}
