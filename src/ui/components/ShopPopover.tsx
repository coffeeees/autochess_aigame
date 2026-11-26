// 영입창: 잠금, 레벨별 확률, 새로고침, 후보 5장. 카드마다 코스트, 유대,
// 보유 여부, 추천, 구매 시 완성되는 합성을 보여 준다.
import { percentNumber } from '../../core/format.ts';
import { costColor, unitDef } from '../data.ts';
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import { buyCost } from '../../core/shop.ts';
import { CharacterImage } from './CharacterImage.tsx';
import type { GameProps } from './Game.tsx';
import styles from './ShopPopover.module.css';

export function ShopPopover({ ui, actions }: GameProps) {
  const run = ui.run!;
  const editable = V.editable(run);
  const odds: number[] = V.shopOdds(run);
  const reroll = P.rerollCost(run);
  return (
    <section class={styles.popover} role="dialog" aria-label="동료 영입" data-popup="shop">
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
            {i + 1}G {percentNumber(p)}%
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
            <div
              key={slot}
              class={styles.empty}
              style={{ '--i': slot }}
              aria-label="구매한 빈 슬롯"
            />
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
  const price = buyCost(run, id); // E5 영입 지원(메타)이 남아 있으면 1G 할인
  return (
    <button
      class={styles.card}
      style={{ '--cost-color': costColor(unit.cost), '--i': slot }}
      data-owned={owned}
      data-recommended={recommended.length > 0}
      disabled={!editable}
      onClick={() => actions.buy(slot)}
      aria-label={`${unit.name} 구매 ${price}G${recommended.length ? ' · 추천 ' + recommended.join(', ') : ''}`}
    >
      <span class={styles.art}>
        <CharacterImage id={id} context="shop" />
      </span>
      {/* 오른쪽 위 원형 표시(v0.26.7): 추천 = 별, 보유 중 = 책. 둘 다면 추천 아래에 보유 중 */}
      {(recommended.length > 0 || owned) && (
        <span class={styles.marks}>
          {recommended.length > 0 && (
            <span
              class={styles.mark}
              data-badge="recommend"
              role="img"
              aria-label={`추천 ${recommended.join(', ')}`}
              title={`추천 조합: ${recommended.join(', ')}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" />
              </svg>
            </span>
          )}
          {owned && (
            <span
              class={styles.mark}
              data-badge="owned"
              role="img"
              aria-label="보유 중"
              title="보유 중"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 6.2C9.8 4.6 6.8 4.1 3.5 4.6v13.6c3.3-.5 6.3 0 8.5 1.6 2.2-1.6 5.2-2.1 8.5-1.6V4.6c-3.3-.5-6.3 0-8.5 1.6z" />
                <path d="M12 6.2v13.6" />
              </svg>
            </span>
          )}
        </span>
      )}
      {preview > 0 && (
        <strong class={styles.preview} aria-label={`구매 시 ${preview}성 합성`}>
          {'★'.repeat(preview)}
        </strong>
      )}
      <span class={styles.info}>
        <b>{unit.name}</b>
        <span class={styles.tags}>{unit.bonds.join(' · ')}</span>
      </span>
      <span class={styles.cost} data-discount={price < unit.cost}>
        {price < unit.cost ? `${price}G 할인` : `${unit.cost}G`}
      </span>
    </button>
  );
}
