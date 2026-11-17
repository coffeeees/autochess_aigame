// A character picture: the illustration when one is registered (D6), otherwise
// the SVG avatar. `context` picks the framing of the thumbnail.
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
  // avatarSvg builds markup from static character data only
  return (
    <span class={styles.frame} data-art={id} dangerouslySetInnerHTML={{ __html: avatarSvg(id) }} />
  );
}
