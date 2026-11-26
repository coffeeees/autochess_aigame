// 캐릭터 그림 등록표(결정 D6).
//   portrait: 카드·도감·상세 창용 일러스트(45명 예정)
//   sprite:   전장용 도트 스프라이트 시트(예정)
// 그림이 없는 캐릭터는 SVG 아바타(avatar.js)로 대신하므로, 여기에 항목만
// 추가하면 캐릭터별로 하나씩 그림을 넣을 수 있다. 다른 곳은 고칠 필요 없다.
// 파일은 public/assets/characters/에 영문 소문자·하이픈 이름으로 둔다.

import { bakedCard, thumbnailSrcset } from './cards.ts';

export type ArtContext = 'field' | 'bench' | 'shop' | 'detail';

export interface Framing {
  scale: number; // 틀 안에서 썸네일 확대 배율
  x: number; // 초점 위치(그림 기준 %)
  y: number;
}

export interface Portrait {
  thumbnail: string; // 작은 정사각형에 가까운 잘라 쓰기용 그림
  /** 미리 줄인 썸네일 사본들(v0.26.8, img srcset 형식). 있으면 영입·대기석·전장 칸 크기에 맞는 것을 쓴다 */
  thumbnailSrcset?: string;
  detail: string; // 전체 일러스트
  framing?: Partial<Record<ArtContext, Framing>>;
}

export interface SpriteSheet {
  src: string; // PNG 한 장, 동작별로 줄마다 프레임
  frameWidth: number;
  frameHeight: number;
  /** 동작 이름 → { 줄, 프레임 수, 초당 프레임 }; 'idle'은 필수 */
  animations: Record<string, { row: number; frames: number; fps: number }>;
  /** 전장에 그릴 때 스프라이트 한 픽셀의 화면 픽셀 수(도트를 선명하게 유지) */
  scale?: number;
}

export interface CharacterArt {
  portrait?: Portrait;
  sprite?: SpriteSheet;
}

export const characterArt: Readonly<Record<string, CharacterArt>> = {
  C01: {
    portrait: {
      thumbnail: 'assets/characters/c01-nox-thumbnail.webp',
      detail: 'assets/characters/c01-nox.webp',
      framing: {
        field: { scale: 3.2, x: 50, y: 40 },
        bench: { scale: 1.9, x: 50, y: 40 },
        shop: { scale: 1.8, x: 50, y: 40 },
      },
    },
  },
};

/**
 * 캐릭터 그림. v0.25.0: 관리자에서 반영한 인게임 썸네일(card-art.generated.ts의 thumbnail)이 있으면
 * 영입·대기석·전장 썸네일을 그것으로 바꾼다(가운데 기준으로 채움, 원래 그림의 확대 설정은 쓰지 않음).
 * 상세 창용 일러스트(detail)는 원래 것이 있으면 그대로, 없으면 썸네일을 쓴다.
 */
/** 반영본 썸네일을 합치기 전 원래 그림(관리자 미리보기에서 썸네일을 지웠을 때) */
export const originalPortraitOf = (id: string): Portrait | undefined => characterArt[id]?.portrait;

export const portraitOf = (id: string): Portrait | undefined => {
  const base = characterArt[id]?.portrait;
  const baked = bakedCard(id)?.thumbnail;
  if (!baked) return base;
  const thumb = baked.src;
  return {
    thumbnail: thumb,
    thumbnailSrcset: thumbnailSrcset(baked),
    detail: base?.detail ?? thumb,
  };
};
export const spriteOf = (id: string): SpriteSheet | undefined => characterArt[id]?.sprite;
