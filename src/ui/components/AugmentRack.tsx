// 선택한 증강 표시(요청서 3, v0.15.18 #augmentRack / showAugmentPeek).
// 전장 왼쪽 아래에 이번 원정에서 고른 증강(최대 3개)을 등급(실버·골드·프리즘) 테두리로 보여 준다.
// 마우스를 올리면 효과 미리보기, 누르면 상세를 고정한다(바깥 클릭·Esc로 닫힘). 전투 중에도 보인다.
// 표시만 하며 증강 규칙은 건드리지 않는다(원정의 augments를 읽기만 함).
import { useLayoutEffect, useRef } from 'preact/hooks';
import P from '../../core/progression.js';
import A from '../../core/augments.js';
import type { GameProps } from './Game.tsx';
import styles from './AugmentRack.module.css';

interface AugmentDef {
  id: string;
  name: string;
  text: string;
  icon: string;
  tier?: 'silver' | 'gold' | 'prism';
}
const tiers = A.tiers as Record<string, { name: string; color: string }>;

let closeTimer: ReturnType<typeof setTimeout> | undefined;

export function AugmentRack({ ui, actions }: GameProps) {
  const ids: string[] = ui.run?.augments ?? [];
  if (!ids.length) return null;
  const defs = ids
    .map((id) => P.augmentById(id) as AugmentDef | undefined)
    .filter((d): d is AugmentDef => !!d);
  const peekId = ui.peek?.kind === 'augment' ? ui.peek.id : null;
  // 미리보기는 칸에서 벗어나도 잠깐 유지해, 상세 창으로 마우스를 옮길 수 있게 한다
  const leave = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(actions.endPreview, 160);
  };
  const stay = () => clearTimeout(closeTimer);
  return (
    <>
      <ul class={styles.rack} aria-label="선택 증강">
        {defs.map((a) => (
          <li key={a.id}>
            <button
              class={styles.tag}
              data-tier={a.tier ?? 'legacy'}
              data-augment-peek={a.id}
              data-popup-trigger="peek"
              aria-label={`${a.name} · ${a.text}`}
              aria-expanded={peekId === a.id}
              onPointerEnter={(e: PointerEvent) => {
                if (e.pointerType === 'touch' || ui.drag?.active) return;
                stay();
                actions.setPeek('augment', a.id, false);
              }}
              onPointerLeave={leave}
              onFocus={() => actions.setPeek('augment', a.id, false)}
              onBlur={leave}
              onClick={() => actions.setPeek('augment', a.id, true)}
            >
              <i aria-hidden="true">{a.icon}</i>
              <b>{a.name}</b>
            </button>
          </li>
        ))}
      </ul>
      {peekId && (
        <AugmentPeek
          def={defs.find((d) => d.id === peekId)}
          pinned={!!ui.peek?.pinned}
          onClose={actions.clearPeek}
          onEnter={stay}
          onLeave={leave}
        />
      )}
    </>
  );
}

function AugmentPeek({
  def,
  pinned,
  onClose,
  onEnter,
  onLeave,
}: {
  def?: AugmentDef;
  pinned: boolean;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  // 누른(올린) 증강 칸 바로 위에 띄우고 화면 안으로 보정
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = def && document.querySelector(`[data-augment-peek="${CSS.escape(def.id)}"]`);
    if (!el || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, a.left)) + 'px';
    el.style.top = Math.max(8, a.top - box.height - 10) + 'px';
  });
  if (!def) return null;
  const tier = def.tier ? tiers[def.tier].name : '이전 증강';
  return (
    <aside
      ref={ref}
      class={styles.peek}
      data-tier={def.tier ?? 'legacy'}
      data-pinned={pinned}
      role="dialog"
      aria-label={`증강 ${def.name} 상세`}
      data-popup="peek"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div class={styles.head}>
        <h3>
          {def.icon} {def.name}
        </h3>
        <button aria-label="증강 상세 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      <span class={styles.tierLabel}>{tier}</span>
      <p>{def.text}</p>
      <small>이번 원정에 적용 중</small>
    </aside>
  );
}
