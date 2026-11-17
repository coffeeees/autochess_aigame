// 아이템 칸, 오른쪽 보관함 패널, 아이템 상세 창.
// 아이템은 끌어서 캐릭터에 장착하고, 보관함으로 회수하거나 휴지통에 버린다.
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import type { Item, RunItem } from '../../core/types.ts';
import { itemIconSvg } from '../art/items.js';
import type { GameProps } from './Game.tsx';
import styles from './Items.module.css';

export const itemDef = (id: string): Item => P.itemById(id) as unknown as Item;

/** 아이템 하나(누르면 상세, 끌면 이동). */
export function ItemSlot({ item, ui, actions }: GameProps & { item: RunItem }) {
  const def = itemDef(item.id);
  return (
    <button
      class={styles.slot}
      data-tier={def.tier}
      data-selected={ui.selectedItem === item.uid}
      aria-label={`${def.name} · ${def.tier}티어 · ${def.statsText}`}
      title={`${def.name} · ${def.statsText}`}
      onClick={() => actions.selectItem(item.uid)}
      onPointerDown={(e: PointerEvent) =>
        e.button === 0 && actions.dragStart('item', item.uid, e.pointerId, e.clientX, e.clientY)
      }
      dangerouslySetInnerHTML={{ __html: itemIconSvg(item.id) }}
    />
  );
}

export function InventoryPanel(props: GameProps) {
  const { ui, actions } = props;
  const run = ui.run!;
  const loose = run.inventory.filter((i) => i.equippedTo === null);
  const slots = Math.max(12, Math.ceil(loose.length / 2) * 2);
  const editable = V.editable(run);
  const over = ui.drag?.active && ui.drag.kind === 'item' ? ui.drag.over : null;
  return (
    <section class={styles.panel}>
      <header class={styles.head}>
        <h2>아이템</h2>
        <small>
          {loose.length}개 보관 · 총 {run.inventory.length}개
        </small>
      </header>
      <div class={styles.grid} data-item-drop="inventory" data-over={over === 'inventory'}>
        {Array.from({ length: slots }, (_, i) =>
          loose[i] ? (
            <ItemSlot key={loose[i].uid} item={loose[i]} {...props} />
          ) : (
            <div key={'empty' + i} class={styles.empty} aria-label="빈 보관함 칸" />
          ),
        )}
      </div>
      <p class={styles.hint}>아이템 클릭 → 능력치 · 아군에게 드래그 → 장착</p>
      <div class={styles.tools}>
        <div
          class={styles.trash}
          data-item-drop="trash"
          data-over={over === 'trash'}
          aria-label="버리기: 아이템을 여기로 끌어 놓기"
          aria-disabled={!editable}
        >
          🗑
        </div>
        <button
          aria-label="버린 아이템 되돌리기"
          disabled={!(run as any).discardedItem || !editable}
          onClick={actions.undoDiscard}
        >
          ↶
        </button>
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
    <aside class={styles.detail} role="dialog" aria-label={`${def.name} 상세`}>
      <div class={styles.identity}>
        <span class={styles.bigIcon} dangerouslySetInnerHTML={{ __html: itemIconSvg(item.id) }} />
        <div>
          <h3>{def.name}</h3>
          <span class={styles.tier} data-tier={def.tier}>
            {def.tier}티어
          </span>
          <b>{def.statsText}</b>
        </div>
        <button aria-label="아이템 상세 닫기" onClick={() => actions.selectItem(null)}>
          ×
        </button>
      </div>
      {def.effect && <p class={styles.effect}>{def.effect.replace(/\*\*([^*]+)\*\*/g, '$1')}</p>}
      {owner && (
        <p class={styles.owner}>
          장착: {owner.id}
          <button onClick={() => actions.unequipItem(item.uid)} disabled={!V.editable(run)}>
            보관함으로 회수
          </button>
        </p>
      )}
    </aside>
  );
}
