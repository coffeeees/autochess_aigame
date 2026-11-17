// 캐릭터·아이템 드래그: 문서 단위 포인터 처리, 포인터 아래 고스트,
// 양쪽 판매 영역(v0.15.18 interaction-ui.js / drag-sales.js와 같은 규칙).
import { useEffect } from 'preact/hooks';
import { salePrice } from '../../core/shop.ts';
import { CharacterImage } from './CharacterImage.tsx';
import { itemIconSvg } from '../art/items.js';
import type { GameProps } from './Game.tsx';
import styles from './DragLayer.module.css';

/** 포인터 아래 놓을 곳: 캐릭터는 data-drop, 아이템은 data-item-drop(고스트는 포인터를 통과). */
function dropAt(kind: 'unit' | 'item' | undefined, x: number, y: number): string | null {
  const attr = kind === 'item' ? 'data-item-drop' : 'data-drop';
  return document.elementFromPoint(x, y)?.closest(`[${attr}]`)?.getAttribute(attr) ?? null;
}

export function DragLayer({ ui, actions, kind }: GameProps & { kind?: 'unit' | 'item' }) {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      actions.dragMove(e.pointerId, e.clientX, e.clientY, dropAt(kind, e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) =>
      actions.dragEnd(e.pointerId, dropAt(kind, e.clientX, e.clientY));
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
  }, [actions, kind]);

  const drag = ui.drag;
  if (!drag?.active) return null;
  if (drag.kind === 'item') {
    const item = ui.run?.inventory.find((i) => i.uid === drag.uid);
    return item ? (
      <div
        class={`${styles.ghost} ${styles.itemGhost}`}
        style={{ left: `${drag.x}px`, top: `${drag.y}px` }}
        dangerouslySetInnerHTML={{ __html: itemIconSvg(item.id) }}
      />
    ) : null;
  }
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
