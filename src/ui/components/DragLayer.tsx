// 캐릭터·아이템 드래그: 문서 단위 포인터 처리, 포인터 아래 고스트,
// 양쪽 판매 영역(v0.15.18 interaction-ui.js / drag-sales.js와 같은 규칙). Esc 취소는 usePopupDismiss가 맡는다.
import { useEffect } from 'preact/hooks';
import { salePrice } from '../../core/shop.ts';
import { CharacterImage } from './CharacterImage.tsx';
import E from '../../core/equipment.ts';
import { itemIconSvg, recoveryIconSvg } from '../art/items.js';
import type { GameProps } from './Game.tsx';
import styles from './DragLayer.module.css';

/** 포인터 아래 놓을 곳: 캐릭터는 data-drop, 아이템·회수기는 data-item-drop(고스트는 포인터를 통과). */
function dropAt(
  kind: 'unit' | 'item' | 'recovery' | undefined,
  x: number,
  y: number,
): string | null {
  const attr = kind === 'item' || kind === 'recovery' ? 'data-item-drop' : 'data-drop';
  return document.elementFromPoint(x, y)?.closest(`[${attr}]`)?.getAttribute(attr) ?? null;
}

export function DragLayer({
  ui,
  actions,
  kind,
}: GameProps & { kind?: 'unit' | 'item' | 'recovery' }) {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      actions.dragMove(e.pointerId, e.clientX, e.clientY, dropAt(kind, e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) =>
      actions.dragEnd(e.pointerId, dropAt(kind, e.clientX, e.clientY));
    const hidden = () => document.hidden && actions.dragCancel();
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', actions.dragCancel);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', actions.dragCancel);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', actions.dragCancel);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', actions.dragCancel);
    };
  }, [actions, kind]);

  const drag = ui.drag;
  if (!drag?.active) return null;
  if (drag.kind === 'recovery')
    return (
      <div
        class={`${styles.ghost} ${styles.itemGhost}`}
        style={{ left: `${drag.x}px`, top: `${drag.y}px` }}
        dangerouslySetInnerHTML={{ __html: recoveryIconSvg() }}
      />
    );
  if (drag.kind === 'item') {
    const item = ui.run?.inventory.find((i) => i.uid === drag.uid);
    if (!item) return null;
    // 조합 미리보기: 조합할 수 있는 자리(기본 장비를 든 캐릭터, 보관함의 기본 장비) 위에서만. 실제 조합은 놓을 때
    const [kind2, arg] = (drag.over ?? '').split(':');
    const plan =
      kind2 === 'unit' && /^\d+$/.test(arg)
        ? E.planOnUnit(ui.run!, item.uid, Number(arg))
        : kind2 === 'item' && arg && arg !== item.uid
          ? E.planOnItem(ui.run!, item.uid, arg)
          : null;
    const result = plan?.ok && plan.action === 'combine' ? E.describe(plan.resultId) : null;
    return (
      <>
        <div
          class={`${styles.ghost} ${styles.itemGhost}`}
          style={{ left: `${drag.x}px`, top: `${drag.y}px` }}
          dangerouslySetInnerHTML={{ __html: itemIconSvg(item.id) }}
        />
        {result && plan?.ok && plan.action === 'combine' && (
          <aside
            class={styles.preview}
            role="status"
            aria-label={`조합 미리보기 · ${result.name}`}
            style={{ left: `${drag.x + 26}px`, top: `${drag.y + 18}px` }}
          >
            <span dangerouslySetInnerHTML={{ __html: itemIconSvg(plan.resultId) }} />
            <div>
              <small>놓으면 조합</small>
              <b>{result.name}</b>
              <em>{result.stats}</em>
              <p>{result.effect}</p>
            </div>
          </aside>
        )}
      </>
    );
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
