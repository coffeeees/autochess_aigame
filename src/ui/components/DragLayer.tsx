// 캐릭터·아이템 드래그: 문서 단위 포인터 처리, 포인터 아래 고스트,
// 양쪽 판매 영역(v0.15.18 interaction-ui.js / drag-sales.js와 같은 규칙). Esc 취소는 usePopupDismiss가 맡는다.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { placePreview } from '../previewPlacement.ts';
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
          <CombinePreview
            over={drag.over!}
            mode={kind2 === 'item' ? 'inventory' : 'unit'}
            x={drag.x}
            y={drag.y}
            resultId={plan.resultId}
            result={result}
          />
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

/**
 * 조합 미리보기(v0.20.1): 보관함 조합은 보관함 왼쪽, 캐릭터 조합은 대상 칸의 여유 있는 쪽에 붙이고
 * 화면 안으로 보정한다(previewPlacement). 위치는 그리기 전에 실제 크기를 재서 정하므로 화면 크기·확대 비율과 무관하다.
 * 문서 맨 위층(fixed, z-index 60)에 그리고 pointer-events: none이라 드롭 판정(elementFromPoint)을 가리지 않는다.
 */
function CombinePreview({
  over,
  mode,
  x,
  y,
  resultId,
  result,
}: {
  over: string;
  mode: 'inventory' | 'unit';
  x: number;
  y: number;
  resultId: string;
  result: { name: string; stats: string; effect: string };
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hit = document.elementFromPoint(x, y)?.closest('[data-item-drop]');
    const target =
      hit?.getAttribute('data-item-drop') === over
        ? hit
        : document.querySelector(`[data-item-drop="${over}"]`);
    const anchor = target?.getBoundingClientRect() ?? {
      left: x,
      right: x,
      top: y,
      bottom: y,
    };
    const edge =
      mode === 'inventory'
        ? (target?.closest('[data-inventory-panel]')?.getBoundingClientRect() ?? anchor)
        : anchor;
    const pos = placePreview(
      anchor,
      edge,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: document.documentElement.clientWidth, height: window.innerHeight },
      mode,
    );
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
    el.dataset.side = pos.side;
    el.style.visibility = 'visible';
  });
  return (
    <aside
      ref={ref}
      class={styles.preview}
      role="status"
      aria-label={`조합 미리보기 · ${result.name}`}
      data-combine-preview={mode}
      style={{ visibility: 'hidden' }}
    >
      <span dangerouslySetInnerHTML={{ __html: itemIconSvg(resultId) }} />
      <div>
        <small>놓으면 조합</small>
        <b>{result.name}</b>
        <em>{result.stats}</em>
        <p>{result.effect}</p>
      </div>
    </aside>
  );
}
