// 전장이나 대기석에 놓인 캐릭터 말.
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
  /** 누르면 이 캐릭터의 드래그를 시작(왼쪽 버튼만) */
  onDragStart?: (pointerId: number, x: number, y: number) => void;
};

export function Pawn({
  id,
  star,
  context,
  enemy = false,
  selected = false,
  onClick,
  onDragStart,
}: Props) {
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
      onPointerDown={
        onDragStart &&
        ((e: PointerEvent) => e.button === 0 && onDragStart(e.pointerId, e.clientX, e.clientY))
      }
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
