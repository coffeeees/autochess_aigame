// 캐릭터 그림: 등록된 일러스트가 있으면 일러스트(D6), 없으면 SVG 아바타.
// context는 썸네일을 어느 위치 기준으로 자를지 정한다.
import { avatarSvg } from '../art/avatar.js';
import { portraitOf, type ArtContext } from '../art/characters.ts';
import styles from './CharacterImage.module.css';

export function CharacterImage({ id, context }: { id: string; context: ArtContext }) {
  const portrait = portraitOf(id);
  const frame = portrait?.framing?.[context];
  if (portrait) {
    const src = context === 'detail' ? portrait.detail : portrait.thumbnail;
    return (
      <span class={styles.frame} data-art={id}>
        <img
          class={styles.image}
          src={src}
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
