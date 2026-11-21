// 전장이나 대기석에 놓인 캐릭터 말.
import { combatant, costColor } from '../data.ts';
import { CharacterImage } from './CharacterImage.tsx';
import type { ArtContext } from '../art/characters.ts';
import styles from './Pawn.module.css';

type Props = {
  /** 원정 캐릭터 uid(합성 연출이 위치를 찾을 때 씀) */
  uid?: number;
  id: string;
  star: number;
  context: ArtContext;
  enemy?: boolean;
  selected?: boolean;
  onClick?: (e: MouseEvent) => void;
  /** 전투 중 HP·MP 비율(0~1)과 보호막 여부 */
  hp?: number;
  mp?: number;
  shielded?: boolean;
  /** 이름 표시를 바꿀 때(소환수 등) */
  label?: string;
  /** 누르면 이 캐릭터의 드래그를 시작(왼쪽 버튼만) */
  onDragStart?: (pointerId: number, x: number, y: number) => void;
};

export function Pawn({
  uid,
  id,
  star,
  context,
  enemy = false,
  selected = false,
  onClick,
  onDragStart,
  hp,
  mp,
  shielded = false,
  label,
}: Props) {
  const { name: fullName, cost } = combatant(id);
  const name = fullName.split(' ').at(-1);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      class={styles.pawn}
      data-unit-uid={uid}
      data-context={context}
      data-enemy={enemy}
      data-selected={selected}
      data-drag-source={onDragStart ? 'unit' : undefined}
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
      <span class={styles.name}>{label ?? name}</span>
      {hp !== undefined && (
        <span class={styles.bars} aria-label={`HP ${Math.round(hp * 100)}%`}>
          <i class={styles.hp} data-shielded={shielded} style={{ width: `${hp * 100}%` }} />
          <i class={styles.mp} style={{ width: `${(mp ?? 0) * 100}%` }} />
        </span>
      )}
    </Tag>
  );
}
