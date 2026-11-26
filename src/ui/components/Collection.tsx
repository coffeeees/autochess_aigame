// 컬렉션(v0.22.0 UI 뼈대 → v0.23.0 관리자 등록 그림·표시 이름 → v0.26.4 45명 평면 목록·미보유 흑백).
// - 목록: 45명 카드를 모두 평면으로, 보유하지 않은 카드는 흑백(보유 여부는 core/collection.ts, 지금은 모두 미보유).
// - 카드 그림·표시 이름은 이 브라우저 관리자 설정 → 게임 반영본 → 플레이스홀더 순(CardView, 관리자와 공용).
// - 상세: 누른 카드 하나만 컬러 2.5D(테스트 버전이라 미보유 카드도 볼 수 있음, 보유로 치지 않음).
import C, { type CollectionEntry } from '../../core/collection.ts';
import D from '../../core/data/units.js';
import type { CardSettings } from '../../core/card-settings.ts';
import { useCardAssets } from '../cardAssetStore.ts';
import { AnimatedCard, CardFace, useCardViewData } from './CardView.tsx';
import type { GameProps } from './Game.tsx';
import styles from './Collection.module.css';

type Props = Pick<GameProps, 'ui' | 'actions'>;

/**
 * v0.26.4: 컬렉션은 45명 카드를 모두 평면으로 보여 주고, 보유하지 않은 카드는 흑백이다.
 * 뽑기가 아직 없어 지금은 모두 미보유(흑백). 테스트 버전이라 누르면 컬러 2.5D로 크게 볼 수 있다.
 * 보유 여부는 core/collection.ts(메타 프로필 collection.owned)를 읽기만 한다.
 */
function entries(ui: Props['ui']): CollectionEntry[] {
  const owned = new Set(C.ownedIds(ui.meta as unknown as Parameters<typeof C.ownedIds>[0]));
  return (D.roster as unknown as { id: string }[]).map((u) => C.entry(u.id, owned.has(u.id))!);
}

export function Collection({ ui, actions, card }: Props & { card: string | null }) {
  const list = entries(ui);
  const assets = useCardAssets();
  const open = (id: string | null) => actions.openOverlay({ kind: 'collection', card: id });
  const selected = card ? list.find((e) => e.characterId === card) : undefined;
  if (selected)
    return (
      <CardDetail
        entry={selected}
        settings={assets.byId[selected.characterId]}
        back={() => open(null)}
      />
    );
  const ownedCount = list.filter((e) => e.owned).length;
  return (
    <section class={styles.collection}>
      <span class={styles.eyebrow}>AUTOCHESS · COLLECTION</span>
      <h2>컬렉션</h2>
      <p class={styles.sub}>
        보유 {ownedCount} / {list.length}장 · 얻지 못한 카드는 흑백으로 보입니다.
      </p>
      <p class={styles.preview} role="note">
        테스트 버전: 카드 획득이 아직 없어 모든 카드가 미보유(흑백)입니다. 카드를 누르면 컬러 2.5D로
        미리 볼 수 있습니다(보유로 치지 않으며 아무것도 저장하지 않음).
      </p>
      <ul class={styles.grid} aria-label="카드 목록">
        {list.map((e) => (
          <li key={e.characterId}>
            <GridCard entry={e} settings={assets.byId[e.characterId]} onOpen={open} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GridCard({
  entry,
  settings,
  onOpen,
}: {
  entry: CollectionEntry;
  settings?: CardSettings;
  onOpen: (id: string) => void;
}) {
  const card = useCardViewData(entry.characterId, settings);
  return (
    <button
      class={styles.gridCard}
      data-owned={entry.owned}
      aria-label={`${card.name} 카드 크게 보기${entry.owned ? '' : '(미보유)'}`}
      onClick={() => onOpen(entry.characterId)}
    >
      <CardFace card={card} />
    </button>
  );
}

function CardDetail({
  entry,
  settings,
  back,
}: {
  entry: CollectionEntry;
  settings?: CardSettings;
  back: () => void;
}) {
  const card = useCardViewData(entry.characterId, settings);
  return (
    <section class={styles.detail}>
      <button class={styles.back} onClick={back}>
        ← 컬렉션
      </button>
      <div class={styles.detailBody}>
        <AnimatedCard card={card} />
        <dl class={styles.info}>
          <dt>이름</dt>
          <dd>{card.name}</dd>
          {card.name !== entry.displayName && (
            <>
              <dt>원래 이름</dt>
              <dd>{entry.displayName}</dd>
            </>
          )}
          <dt>코스트</dt>
          <dd>{entry.cost}</dd>
          <dt>캐릭터 ID</dt>
          <dd>{entry.characterId}</dd>
          <dt>보유</dt>
          <dd>{entry.owned ? '보유' : '미보유(테스트 보기)'}</dd>
        </dl>
      </div>
    </section>
  );
}
