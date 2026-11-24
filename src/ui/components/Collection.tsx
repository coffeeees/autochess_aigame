// 컬렉션(v0.22.0 UI 뼈대, 요청서 AUTOCHESS_COLLECTION_SKELETON_2026-11-25).
// - 목록: 보유한 캐릭터 카드만(core/collection.ts). 보유 기록이 없으면 빈 상태가 정상이다.
// - 카드: 뒤 → 앞으로 배경 → 프레임 → 캐릭터 → (코스트 숫자·반사광) → 이름표(+이름). 프레임·이름표는 제공 원본 그림,
//   글자는 그림에 굽지 않고 그린다. 하단 설명 상자는 없다. 그림이 없는 캐릭터는 플레이스홀더.
// - 상세: 고른 카드 하나만 2.5D(CSS 3D, 마우스 위치로 기울기·층마다 다른 이동·반사광). 목록은 정적(약한 호버만).
//   움직임은 requestAnimationFrame으로 목표에 다가가는 동안만 그리고, 모션 줄이기 설정이면 정면 정지 카드.
// - 개발용: 주소에 ?carddev 를 붙이면 45명 카드를 미리보기로 보여 준다(보유 아님, 아무것도 저장하지 않음).
import { useEffect, useRef, useState } from 'preact/hooks';
import C, { type CollectionEntry } from '../../core/collection.ts';
import D from '../../core/data/units.js';
import { cardArt, cardFrame, cardNameplate } from '../art/cards.ts';
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
  const open = (id: string | null) => actions.openOverlay({ kind: 'collection', card: id });
  const selected = card ? list.find((e) => e.characterId === card) : undefined;
  if (selected) return <CardDetail entry={selected} back={() => open(null)} />;
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
              <button
                class={styles.gridCard}
                aria-label={`${e.displayName} 카드 크게 보기`}
                onClick={() => open(e.characterId)}
              >
                <CardFace entry={e} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 카드 한 장의 층(정적). 상세 보기는 같은 층을 data-layer로 찾아 움직인다 */
export function CardFace({ entry }: { entry: CollectionEntry }) {
  const art = cardArt(entry.characterId);
  const [bgOk, setBgOk] = useState(true);
  const [charOk, setCharOk] = useState(true);
  return (
    <div class={styles.card} data-card={entry.characterId}>
      <div class={styles.bg}>
        <div class={styles.bgInner} data-layer="bg">
          {art.background && bgOk ? (
            <img src={art.background} alt="" draggable={false} onError={() => setBgOk(false)} />
          ) : (
            <div class={styles.bgPlaceholder} />
          )}
        </div>
        <div class={styles.vignette} />
      </div>
      <img class={styles.frame} data-layer="frame" src={cardFrame} alt="" draggable={false} />
      {art.character && charOk ? (
        <img
          class={styles.character}
          data-layer="character"
          src={art.character}
          alt={entry.displayName}
          draggable={false}
          onError={() => setCharOk(false)}
        />
      ) : (
        <div class={styles.characterPlaceholder} data-layer="character" aria-hidden="true">
          <svg viewBox="0 0 100 120">
            <circle cx="50" cy="38" r="20" />
            <path d="M14 118C14 86 30 66 50 66S86 86 86 118Z" />
          </svg>
          <small>그림 준비 중</small>
        </div>
      )}
      <span class={styles.cost} data-layer="cost" aria-label={`${entry.cost}코스트`}>
        {entry.cost}
      </span>
      <div class={styles.glint} data-layer="glint" />
      <div class={styles.nameplate} data-layer="nameplate">
        <img src={cardNameplate} alt="" draggable={false} />
        <div class={styles.name}>{entry.displayName}</div>
      </div>
    </div>
  );
}

/** 상세 보기: v5 시안의 2.5D 움직임(기울기 X 11°·Y 16°, 층별 이동량·깊이, 반사광) */
function CardDetail({ entry, back }: { entry: CollectionEntry; back: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current;
    const card = root?.querySelector<HTMLElement>('[data-card]');
    if (!root || !card) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // 정면 정지 카드
    const layer = (n: string) => card.querySelector<HTMLElement>(`[data-layer="${n}"]`);
    const bg = layer('bg'),
      frame = layer('frame'),
      character = layer('character'),
      cost = layer('cost'),
      glint = layer('glint'),
      plate = layer('nameplate');
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = 0,
      holding = false;
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    const draw = () => {
      card.style.transform = `rotateX(${(-cy * 11).toFixed(3)}deg) rotateY(${(cx * 16).toFixed(3)}deg)`;
      if (bg)
        bg.style.transform = `translate3d(${(-cx * 13).toFixed(2)}px,${(-cy * 13).toFixed(2)}px,0) scale(1.11)`;
      if (character)
        character.style.transform = `translate3d(${(cx * 12).toFixed(2)}px,${(cy * 13).toFixed(2)}px,55px) scale(.99)`;
      if (frame)
        frame.style.transform = `translate3d(${(-cx * 1.2).toFixed(2)}px,${(-cy * 1.2).toFixed(2)}px,9px)`;
      if (cost)
        cost.style.transform = `translate3d(${(cx * 3).toFixed(2)}px,${(cy * 4).toFixed(2)}px,76px)`;
      if (plate)
        plate.style.transform = `translate3d(${(cx * 21).toFixed(2)}px,${(cy * 15).toFixed(2)}px,90px) rotateZ(${(cx * 1.5).toFixed(2)}deg)`;
      if (glint)
        glint.style.background = `linear-gradient(${(112 + cx * 37).toFixed(1)}deg,transparent 16%,#ffffff09 ${(40 + cx * 12).toFixed(1)}%,#b7f7ff36 ${(52 + cx * 12).toFixed(1)}%,transparent ${(62 + cx * 12).toFixed(1)}%)`;
    };
    const tick = () => {
      raf = 0;
      cx += (tx - cx) * 0.15;
      cy += (ty - cy) * 0.15;
      const moving = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.003;
      if (!moving) {
        cx = tx; // 거의 닿으면 목표에 맞춰 멈춘다(정면 복귀가 정확히 0°)
        cy = ty;
      }
      draw();
      if (moving) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const point = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
      ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2);
      kick();
    };
    const reset = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || holding) point(e);
    };
    const down = (e: PointerEvent) => {
      holding = true;
      point(e);
    };
    const up = () => {
      holding = false;
      reset();
    };
    const leave = () => {
      if (!holding) reset();
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('pointerleave', leave);
    window.addEventListener('blur', reset);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', reset);
    };
  }, [entry.characterId]);
  return (
    <section class={styles.detail}>
      <button class={styles.back} onClick={back}>
        ← 컬렉션
      </button>
      <div class={styles.detailBody}>
        <div
          class={styles.stage}
          ref={stage}
          aria-label={`${entry.displayName} 카드(마우스로 기울이기)`}
        >
          <CardFace entry={entry} />
        </div>
        <dl class={styles.info}>
          <dt>이름</dt>
          <dd>{entry.displayName}</dd>
          <dt>코스트</dt>
          <dd>{entry.cost}</dd>
          <dt>캐릭터 ID</dt>
          <dd>{entry.characterId}</dd>
        </dl>
      </div>
    </section>
  );
}
