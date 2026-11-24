// 컬렉션(v0.22.0 UI 뼈대 → v0.23.0 관리자 등록 그림·표시 이름 반영).
// - 목록: 보유한 캐릭터 카드만(core/collection.ts). 보유 기록이 없으면 빈 상태가 정상이다.
//   그림을 등록해도 보유로 치지 않는다(카드 확인은 관리자 → 캐릭터 설정의 미리보기).
// - 카드 그림·표시 이름은 카드 꾸미기 저장소(ui/cardAssetStore.ts, IndexedDB)에서 읽고, 렌더러는 CardView(관리자와 공용).
// - 상세: 고른 카드 하나만 2.5D. 목록은 정적(약한 호버만).
// - 개발용: 주소에 ?carddev 를 붙이면 45명 카드를 미리보기로 보여 준다(보유 아님, 아무것도 저장하지 않음).
import C, { type CollectionEntry } from '../../core/collection.ts';
import D from '../../core/data/units.js';
import type { CardSettings } from '../../core/card-settings.ts';
import { useCardAssets } from '../cardAssetStore.ts';
import { AnimatedCard, CardFace, useCardViewData } from './CardView.tsx';
import type { GameProps } from './Game.tsx';
import styles from './Collection.module.css';

type Props = Pick<GameProps, 'ui' | 'actions'>;

const devPreview = () =>
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('carddev');

/** 화면에 보일 카드 목록: 보유 카드(기록이 없으면 빈 목록). ?carddev면 45명 미리보기(보유 아님) */
function entries(ui: Props['ui']): { list: CollectionEntry[]; preview: boolean } {
  if (devPreview())
    return {
      list: (D.roster as unknown as { id: string }[]).map((u) => C.entry(u.id, false)!),
      preview: true,
    };
  return {
    list: C.ownedEntries(ui.meta as unknown as Parameters<typeof C.ownedEntries>[0]),
    preview: false,
  };
}

export function Collection({ ui, actions, card }: Props & { card: string | null }) {
  const { list, preview } = entries(ui);
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
  return (
    <section class={styles.collection}>
      <span class={styles.eyebrow}>AUTOCHESS · COLLECTION</span>
      <h2>컬렉션</h2>
      {preview ? (
        <p class={styles.preview} role="note">
          개발용 미리보기(?carddev) · 45명 카드를 보여 줄 뿐 보유한 것이 아니며 아무것도 저장하지
          않습니다.
        </p>
      ) : (
        <p class={styles.sub}>보유한 캐릭터 카드 {list.length}장</p>
      )}
      {list.length === 0 ? (
        <div class={styles.empty} role="status">
          <b>아직 획득한 카드가 없습니다.</b>
          <span>캐릭터 카드를 얻으면 이곳에 모입니다. 카드 획득 방법은 준비 중입니다.</span>
        </div>
      ) : (
        <ul class={styles.grid} aria-label="보유 카드 목록">
          {list.map((e) => (
            <li key={e.characterId}>
              <GridCard entry={e} settings={assets.byId[e.characterId]} onOpen={open} />
            </li>
          ))}
        </ul>
      )}
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
      aria-label={`${card.name} 카드 크게 보기`}
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
        </dl>
      </div>
    </section>
  );
}
