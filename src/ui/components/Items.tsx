// 아이템 칸, 오른쪽 보관함 패널(특수 칸의 회수기), 아이템 상세 창.
// 보관함 장비는 끌어서 캐릭터에 장착·조합하거나 보관함의 기본 장비 위에 놓아 조합하고, 휴지통에 버린다(v0.20.0).
// 장착한 장비는 회수기로만 되찾는다.
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import E from '../../core/equipment.ts';
import type { Item, RunItem } from '../../core/types.ts';
import { itemIconSvg, recoveryIconSvg } from '../art/items.js';
import { unitDef } from '../data.ts';
import type { GameProps } from './Game.tsx';
import styles from './Items.module.css';

export const itemDef = (id: string): Item => P.itemById(id) as unknown as Item;

/**
 * 장비 하나(누르면 상세). 보관함 장비는 끌어서 장착·조합·버리기, 보관함의 기본 장비는 다른 기본 장비를 놓을 자리(조합).
 * 장착한 장비는 끌 수 없다(무료 회수 없음, 회수기로만, v0.20.0).
 */
export function ItemSlot({ item, ui, actions }: GameProps & { item: RunItem }) {
  const def = itemDef(item.id);
  const loose = item.equippedTo === null;
  const kind = def.kind === 'base' ? '기본 장비' : '완성 장비';
  return (
    <button
      class={styles.slot}
      data-kind={def.kind}
      data-selected={ui.selectedItem === item.uid}
      data-item-uid={item.uid}
      data-popup-trigger="item"
      data-drag-source={loose ? 'item' : undefined}
      data-item-drop={loose && def.kind === 'base' ? `item:${item.uid}` : undefined}
      data-over={ui.drag?.active && ui.drag.over === `item:${item.uid}`}
      aria-label={`${def.name} · ${kind} · ${def.statsText}`}
      title={`${def.name} · ${def.statsText}`}
      onClick={() => actions.selectItem(item.uid)}
      onPointerDown={
        loose
          ? (e: PointerEvent) =>
              e.button === 0 &&
              actions.dragStart('item', item.uid, e.pointerId, e.clientX, e.clientY)
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: itemIconSvg(item.id) }}
    />
  );
}

/** 회수기(특수 칸): 장비를 든 캐릭터에 끌어 놓으면 그 캐릭터의 장비 전부를 보관함으로 되찾는다 */
function RecoveryTool({ ui, actions }: GameProps) {
  const run = ui.run!;
  const n = E.recoveryTools(run);
  const usable = n > 0 && V.editable(run);
  return (
    <button
      class={styles.specialSlot}
      data-filled={n > 0}
      data-drag-source={usable ? 'recovery' : undefined}
      disabled={!usable}
      aria-label={`회수기 ${n}개 · 장비를 든 캐릭터에 끌어 놓으면 그 캐릭터의 장비 전부를 보관함으로 되찾음`}
      title={`회수기 ×${n} · 캐릭터에 끌어 놓아 장비 전부 회수`}
      onPointerDown={(e: PointerEvent) =>
        usable &&
        e.button === 0 &&
        actions.dragStart('recovery', 'recovery', e.pointerId, e.clientX, e.clientY)
      }
    >
      <span dangerouslySetInnerHTML={{ __html: recoveryIconSvg() }} />
      <b class={styles.count}>×{n}</b>
    </button>
  );
}

/** 휴지통·되돌리기 아이콘(v0.15.18 #itemTrash / #undoDiscardBtn의 SVG) */
const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
  </svg>
);
const UndoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M8 5 3 10l5 5M3 10h11a6 6 0 0 1 0 12" transform="translate(0 -2)" />
  </svg>
);

/**
 * 아이템 보관함(요청서 4): 접기·펼치기(미끄러지듯), 특수 아이템 예약 2칸(기능 없음),
 * 일반 칸 2열 × 6행(12칸, 넘치면 스크롤), 휴지통·되돌리기.
 */
export function InventoryPanel(props: GameProps) {
  const { ui, actions } = props;
  const run = ui.run!;
  const loose = run.inventory.filter((i) => i.equippedTo === null);
  const slots = Math.max(12, Math.ceil(loose.length / 2) * 2);
  const editable = V.editable(run);
  const over = ui.drag?.active && ui.drag.kind === 'item' ? ui.drag.over : null;
  const open = ui.inventoryOpen;
  return (
    <section class={styles.panel} data-open={open}>
      <header class={styles.head}>
        <div>
          <h2>아이템</h2>
          <small>
            {loose.length}개 보관 · 총 {run.inventory.length}개
          </small>
        </div>
        <button
          class={styles.toggle}
          aria-expanded={open}
          aria-label={`아이템 패널 ${open ? '접기' : '펼치기'}`}
          onClick={actions.toggleInventory}
        >
          {open ? '⌃' : '⌄'}
        </button>
      </header>
      <div class={styles.body} aria-hidden={!open} inert={!open}>
        <div class={styles.bodyInner}>
          <div class={styles.special} aria-label="특수 아이템 칸">
            <RecoveryTool {...props} />
            <div class={styles.specialSlot} aria-disabled="true" title="특수 아이템 칸(준비 중)" />
          </div>
          <div class={styles.grid} data-item-drop="inventory" data-over={over === 'inventory'}>
            {Array.from({ length: slots }, (_, i) =>
              loose[i] ? (
                <ItemSlot key={loose[i].uid} item={loose[i]} {...props} />
              ) : (
                <div key={'empty' + i} class={styles.empty} aria-label="빈 보관함 칸" />
              ),
            )}
          </div>
          <p class={styles.hint}>
            클릭 → 능력치 · 아군에게 드래그 → 장착 · 기본 장비끼리 겹치면 조합
          </p>
          <div class={styles.tools}>
            <div
              class={styles.trash}
              data-item-drop="trash"
              data-over={over === 'trash'}
              aria-label="버리기: 아이템을 여기로 끌어 놓기"
              title="아이템 버리기 · 여기로 끌어 놓기"
              aria-disabled={!editable}
            >
              <TrashIcon />
            </div>
            <button
              class={styles.undo}
              aria-label="버린 아이템 되돌리기"
              title="마지막으로 버린 아이템 되돌리기"
              disabled={!(run as any).discardedItem || !editable}
              onClick={actions.undoDiscard}
            >
              <UndoIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ItemDetail({ ui, actions }: GameProps) {
  const run = ui.run!;
  const item = run.inventory.find((i) => i.uid === ui.selectedItem);
  if (!item) return null;
  const def = itemDef(item.id);
  const owner = run.units.find((u) => u.uid === item.equippedTo);
  return (
    <aside class={styles.detail} role="dialog" aria-label={`${def.name} 상세`} data-popup="item">
      <div class={styles.identity}>
        <span class={styles.bigIcon} dangerouslySetInnerHTML={{ __html: itemIconSvg(item.id) }} />
        <div>
          <h3>{def.name}</h3>
          <span class={styles.tier} data-kind={def.kind}>
            {def.kind === 'base'
              ? '기본 장비'
              : `완성 장비 · ${def.recipe!.map((id) => itemDef(id).name).join(' + ')}`}
          </span>
          <b>{def.statsText}</b>
        </div>
        <button aria-label="아이템 상세 닫기" onClick={() => actions.selectItem(null)}>
          ×
        </button>
      </div>
      {def.effect && <p class={styles.effect}>{def.effect}</p>}
      {def.kind === 'base' && (
        <p class={styles.effect}>다른 기본 장비와 겹치면 완성 장비로 조합됩니다.</p>
      )}
      {owner && (
        <p class={styles.owner}>
          장착: {unitDef(owner.id).name} · 회수기로만 보관함에 되찾을 수 있습니다.
        </p>
      )}
    </aside>
  );
}
