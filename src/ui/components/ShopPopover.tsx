// Recruit window: lock, level odds, reroll and the five offers. Each card shows
// cost, bonds, ownership, recommendation and the merge it would complete.
import { costColor, unitDef } from '../data.ts';
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import { CharacterImage } from './CharacterImage.tsx';
import type { GameProps } from './Game.tsx';
import styles from './ShopPopover.module.css';

export function ShopPopover({ ui, actions }: GameProps) {
  const run = ui.run!;
  const editable = V.editable(run);
  const odds: number[] = V.shopOdds(run);
  const reroll = P.rerollCost(run);
  return (
    <section class={styles.popover} role="dialog" aria-label="동료 영입">
      <div class={styles.heading}>
        <h2>동료 영입</h2>
        <button aria-pressed={run.shopLocked} onClick={actions.toggleShopLock} disabled={!editable}>
          {run.shopLocked ? '잠금 켜짐' : '잠금 꺼짐'}
        </button>
        <button aria-label="동료 영입 닫기" onClick={() => actions.setShopOpen(false)}>
          ×
        </button>
      </div>
      <div class={styles.odds} aria-label="코스트별 등장 확률">
        <b>Lv.{run.level}</b>
        {odds.map((p, i) => (
          <span key={i} style={{ '--cost-color': costColor(i + 1) }}>
            {i + 1}G {p}%
          </span>
        ))}
        <button onClick={actions.reroll} disabled={!editable || run.gold < reroll}>
          ↻ 새로고침 {reroll}G
        </button>
      </div>
      <div class={styles.offers}>
        {run.shop.map((id, slot) =>
          id ? (
            <Offer key={slot} id={id} slot={slot} {...{ ui, actions, editable }} />
          ) : (
            <div key={slot} class={styles.empty} aria-label="구매한 빈 슬롯" />
          ),
        )}
      </div>
    </section>
  );
}

function Offer({
  id,
  slot,
  ui,
  actions,
  editable,
}: GameProps & { id: string; slot: number; editable: boolean }) {
  const run = ui.run!;
  const unit = unitDef(id);
  const owned = run.units.some((u) => u.id === id);
  const recommended: string[] = V.recommendedFor(run, id);
  const preview: number = V.mergePreview(run, id);
  return (
    <button
      class={styles.card}
      style={{ '--cost-color': costColor(unit.cost) }}
      data-owned={owned}
      data-recommended={recommended.length > 0}
      disabled={!editable}
      onClick={() => actions.buy(slot)}
      aria-label={`${unit.name} 구매 ${unit.cost}G${recommended.length ? ' · 추천 ' + recommended.join(', ') : ''}`}
    >
      <span class={styles.art}>
        <CharacterImage id={id} context="shop" />
      </span>
      {preview > 0 && (
        <strong class={styles.preview} aria-label={`구매 시 ${preview}성 합성`}>
          {'★'.repeat(preview)}
        </strong>
      )}
      <span class={styles.info}>
        <b>{unit.name}</b>
        <span class={styles.tags}>{unit.bonds.join(' · ')}</span>
        {owned && <span class={styles.owned}>✓ 보유 중</span>}
      </span>
      <span class={styles.cost}>{unit.cost}G</span>
    </button>
  );
}
