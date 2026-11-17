// A character token on the board or the bench.
import { combatant, costColor } from '../data.ts';
import { CharacterImage } from './CharacterImage.tsx';
import type { ArtContext } from '../art/characters.ts';
import styles from './Pawn.module.css';

type Props = {
  id: string;
  star: number;
  context: ArtContext;
  enemy?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function Pawn({ id, star, context, enemy = false, selected = false, onClick }: Props) {
  const { name: fullName, cost } = combatant(id);
  const name = fullName.split(' ').at(-1);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      class={styles.pawn}
      data-enemy={enemy}
      data-selected={selected}
      style={{ '--cost-color': costColor(cost) }}
      onClick={onClick}
      title={fullName}
    >
      <span class={styles.stars} aria-label={`${star}성`}>
        {'★'.repeat(star)}
      </span>
      <span class={styles.image}>
        <CharacterImage id={id} context={context} />
      </span>
      <span class={styles.name}>{name}</span>
    </Tag>
  );
}
