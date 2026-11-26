// 캐릭터 그림: 등록된 일러스트가 있으면 일러스트(D6), 없으면 SVG 아바타.
// context는 썸네일을 어느 위치 기준으로 자를지 정한다.
import { avatarSvg } from '../art/avatar.js';
import { portraitOf, type ArtContext, type Portrait } from '../art/characters.ts';
import { combatant, costColor } from '../data.ts';
import styles from './CharacterImage.module.css';

/**
 * 썸네일이 실제로 그려지는 너비(CSS px, v0.26.8 측정: 영입 카드 그림 약 138px, 대기석 말 최대 88px).
 * srcset에서 이 너비 × 화면 배율 이상인 가장 작은 사본을 고르므로, 큰 그림을 한 번에 크게 줄이며 생기는 자글거림이 없다.
 */
const thumbSizes: Record<Exclude<ArtContext, 'detail'>, string> = {
  shop: '140px',
  bench: '90px',
  field: '100px', // 전장 말 최대 96px
};

/** portrait를 주면 등록표 대신 그 그림을 쓴다(관리자 썸네일 미리보기, v0.25.0). null이면 SVG 아바타 */
export function CharacterImage({
  id,
  context,
  portrait: override,
}: {
  id: string;
  context: ArtContext;
  portrait?: Portrait | null;
}) {
  const portrait = override === undefined ? portraitOf(id) : (override ?? undefined);
  const frame = portrait?.framing?.[context];
  if (portrait) {
    const src = context === 'detail' ? portrait.detail : portrait.thumbnail;
    const srcset = context === 'detail' ? undefined : portrait.thumbnailSrcset;
    return (
      <span
        class={styles.frame}
        data-art={id}
        style={{ '--cost-color': costColor(combatant(id).cost) }}
      >
        <img
          class={styles.image}
          src={src}
          srcset={srcset}
          sizes={srcset && context !== 'detail' ? thumbSizes[context] : undefined}
          alt=""
          draggable={false}
          style={
            frame
              ? {
                  transform: `scale(${frame.scale})`,
                  transformOrigin: `${frame.x}% ${frame.y}%`,
                }
              : undefined
          }
        />
      </span>
    );
  }
  // avatarSvg는 고정된 캐릭터 데이터로만 마크업을 만든다
  return (
    <span class={styles.frame} data-art={id} dangerouslySetInnerHTML={{ __html: avatarSvg(id) }} />
  );
}
