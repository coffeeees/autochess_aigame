// 캐릭터 카드 렌더러(v0.22.0 컬렉션에서 시작 → v0.23.0 컬렉션·관리자 미리보기 공용).
// 층(뒤 → 앞): 배경 → 공통 프레임 → 캐릭터 → 코스트 숫자·반사광 → 공통 이름표 + 이름(글자로 그림, 길면 줄임).
// 프레임·이름표는 공통 그림 하나를 모든 카드가 함께 쓴다(카드마다 합성해 저장하지 않음). 하단 설명 상자는 없다.
// 그림이 없거나 깨지면 플레이스홀더. AnimatedCard는 v5 시안의 2.5D 움직임(기울기·층별 패럴랙스·반사광).
import { useEffect, useRef, useState } from 'preact/hooks';
import S, { type ImageTransform } from '../../core/card-settings.ts';
import C from '../../core/collection.ts';
import { bakedCard, cardArt, cardFrame, cardNameplate } from '../art/cards.ts';
import { useBlobUrl } from '../cardAssetStore.ts';
import styles from './CardView.module.css';

export interface CardViewData {
  characterId: string;
  name: string;
  cost: number;
  background: string | null; // 그림 주소(정적 경로나 객체 URL)
  character: string | null;
  /** 이 카드만의 프레임·이름표(v0.26.0). null이면 공통 기본 그림 */
  frame?: string | null;
  nameplate?: string | null;
  transform?: Partial<Record<'background' | 'character', ImageTransform>>; // 예약
}

const tf = (prefix: string, t?: ImageTransform) =>
  t
    ? {
        [`--${prefix}-x`]: `${t.offsetX}%`,
        [`--${prefix}-y`]: `${t.offsetY}%`,
        [`--${prefix}-s`]: String(t.scale),
      }
    : {};

/** 카드 한 장(정적). AnimatedCard는 같은 층을 data-layer로 찾아 움직인다 */
export function CardFace({ card }: { card: CardViewData }) {
  const [bgBroken, setBgBroken] = useState<string | null>(null);
  const [charBroken, setCharBroken] = useState<string | null>(null);
  const bg = card.background && card.background !== bgBroken ? card.background : null;
  const ch = card.character && card.character !== charBroken ? card.character : null;
  return (
    <div
      class={styles.card}
      data-card={card.characterId}
      style={{
        '--name-scale': String(S.nameScale(card.name)),
        ...tf('bg', card.transform?.background),
        ...tf('ch', card.transform?.character),
      }}
    >
      <div class={styles.bg}>
        <div class={styles.bgInner} data-layer="bg">
          {bg ? (
            <img src={bg} alt="" draggable={false} onError={() => setBgBroken(bg)} />
          ) : (
            <div class={styles.bgPlaceholder} data-placeholder="background" />
          )}
        </div>
        <div class={styles.vignette} />
      </div>
      {/* 프레임과 코스트 숫자는 한 판(v0.26.4): 함께 움직이고, 숫자는 프레임 왼쪽 위 원 안에 */}
      <div class={styles.frameLayer} data-layer="frame">
        <img
          class={styles.frame}
          data-custom={!!card.frame}
          src={card.frame || cardFrame}
          alt=""
          draggable={false}
        />
        <span class={styles.cost} aria-label={`${card.cost}코스트`}>
          {card.cost}
        </span>
      </div>
      {ch ? (
        <img
          class={styles.character}
          data-layer="character"
          src={ch}
          alt={card.name}
          draggable={false}
          onError={() => setCharBroken(ch)}
        />
      ) : (
        <div
          class={styles.characterPlaceholder}
          data-layer="character"
          data-placeholder="character"
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 120">
            <circle cx="50" cy="38" r="20" />
            <path d="M14 118C14 86 30 66 50 66S86 86 86 118Z" />
          </svg>
          <small>그림 준비 중</small>
        </div>
      )}
      <div class={styles.glint} data-layer="glint" />
      <div class={styles.nameplate} data-layer="nameplate">
        <img
          src={card.nameplate || cardNameplate}
          data-custom={!!card.nameplate}
          alt=""
          draggable={false}
        />
        <div class={styles.name} data-card-name>
          {card.name}
        </div>
      </div>
    </div>
  );
}

/** 2.5D 카드(v5 시안: 기울기 X 11°·Y 16°, 층별 이동량·깊이, 반사광). 움직일 때만 그리고 모션 줄이기면 정지 */
export function AnimatedCard({ card, label }: { card: CardViewData; label?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = stage.current;
    const el = root?.querySelector<HTMLElement>('[data-card]');
    if (!root || !el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // 정면 정지 카드
    const layer = (n: string) => el.querySelector<HTMLElement>(`[data-layer="${n}"]`);
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0,
      raf = 0,
      holding = false;
    const clamp = (n: number) => Math.max(-1, Math.min(1, n));
    const draw = () => {
      // 층은 그림이 바뀌면 새로 생기므로 그릴 때마다 찾는다
      const bg = layer('bg'),
        frame = layer('frame'),
        character = layer('character'),
        glint = layer('glint'),
        plate = layer('nameplate');
      el.style.transform = `rotateX(${(-cy * 11).toFixed(3)}deg) rotateY(${(cx * 16).toFixed(3)}deg)`;
      if (bg)
        bg.style.transform = `translate3d(${(-cx * 13).toFixed(2)}px,${(-cy * 13).toFixed(2)}px,0) scale(1.11)`;
      if (character)
        character.style.transform = `translate3d(${(cx * 12).toFixed(2)}px,${(cy * 13).toFixed(2)}px,55px) scale(.99)`;
      if (frame)
        frame.style.transform = `translate3d(${(-cx * 1.2).toFixed(2)}px,${(-cy * 1.2).toFixed(2)}px,9px)`;
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
      const r = el.getBoundingClientRect();
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
    // 그림이 바뀌어 층이 새로 생기면 현재 각도로 다시 그린다
    const watch = new MutationObserver(draw);
    watch.observe(el, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', reset);
    };
  }, [card.characterId]);
  return (
    <div
      class={styles.stage}
      ref={stage}
      aria-label={label ?? `${card.name} 카드(마우스로 기울이기)`}
    >
      <CardFace card={card} />
    </div>
  );
}

/**
 * 카드 데이터 만들기. 이 브라우저의 관리자 설정이 있으면 그 상태 전부(그림이 없으면 플레이스홀더),
 * 없으면 게임 반영본(card-art.generated.ts), 그것도 없으면 원래 이름·플레이스홀더.
 */
export function useCardViewData(
  characterId: string,
  settings:
    | {
        displayNameOverride: string | null;
        backgroundImage: { blob: Blob } | null;
        characterImage: { blob: Blob } | null;
        frameImage?: { blob: Blob } | null;
        nameplateImage?: { blob: Blob } | null;
        imageTransform?: CardViewData['transform'];
      }
    | null
    | undefined,
): CardViewData {
  const bgUrl = useBlobUrl(settings?.backgroundImage?.blob);
  const chUrl = useBlobUrl(settings?.characterImage?.blob);
  const frameUrl = useBlobUrl(settings?.frameImage?.blob);
  const plateUrl = useBlobUrl(settings?.nameplateImage?.blob);
  const base = C.entry(characterId);
  if (settings)
    return {
      characterId,
      name: S.cardName(characterId, settings),
      cost: base?.cost ?? 1,
      background: bgUrl,
      character: chUrl,
      frame: frameUrl,
      nameplate: plateUrl,
      transform: settings.imageTransform,
    };
  const baked = bakedCard(characterId);
  const art = cardArt(characterId);
  return {
    characterId,
    name: baked?.displayName || base?.displayName || characterId,
    cost: base?.cost ?? 1,
    background: art.background,
    character: art.character,
    frame: baked?.frame?.src ?? null,
    nameplate: baked?.nameplate?.src ?? null,
    transform: baked?.imageTransform,
  };
}
