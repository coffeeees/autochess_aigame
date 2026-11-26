// 컬렉션 카드 그림 등록표(v0.22.0 → v0.24.0 반영본).
//   공통: 프레임(714×1000)·이름표(750×279) — 사용자 제공 원본을 무손실 WebP로(tools/convert-images.py)
//   캐릭터별 반영본: card-art.generated.ts(관리자 내보내기 ZIP을 tools/import-admin-export.py로 넣은 것).
//     public/assets/cards/<id>/background.webp·character.webp, 원본은 assets-src/images/cards/<id>/.
// 화면의 우선순위: 이 브라우저의 관리자 설정(있으면 그 상태 전부) → 반영본 → 플레이스홀더(ui/components/CardView.tsx).
import { bakedCardArt } from './card-art.generated.ts';

export const cardFrame = 'assets/cards/card-frame.webp';
export const cardNameplate = 'assets/cards/card-nameplate.webp';
/** 원본 비율(프레임 714:1000, 이름표 750:279) */
export const cardRatio = 714 / 1000;
export const nameplateRatio = 750 / 279;

export interface BakedImage {
  src: string; // 배포 경로(public/ 기준)
  format: 'png' | 'jpeg' | 'webp'; // 배포본 형식
  width: number;
  height: number;
  /** 같은 그림인지 비교용: [보낸 원본 sha256, 배포본 sha256] */
  sha256: string[];
  /** 인게임 썸네일만(v0.26.8): 미리 줄인 사본 너비(px). 같은 폴더의 thumbnail-<너비>.webp */
  variants?: number[];
}

/** 썸네일 줄인 사본 너비(tools/import-admin-export.py THUMB_WIDTHS와 같다) */
export const thumbnailWidths = [128, 192, 288, 432] as const;

/** 썸네일 srcset: 줄인 사본 + 원본(브라우저가 칸 크기·화면 배율에 맞는 것을 고른다) */
export function thumbnailSrcset(img: BakedImage): string | undefined {
  if (!img.variants?.length) return undefined;
  const dir = img.src.slice(0, img.src.lastIndexOf('/') + 1);
  return [
    ...img.variants.map((w) => `${dir}thumbnail-${w}.webp ${w}w`),
    `${img.src} ${img.width}w`,
  ].join(', ');
}
export interface BakedCardArt {
  displayName?: string; // 카드 표시 이름(없으면 원래 이름)
  background?: BakedImage;
  character?: BakedImage;
  /** 인게임 썸네일(v0.25.0) — 영입·대기석·전장에 쓰는 그림(ui/art/characters.ts portraitOf가 합침) */
  thumbnail?: BakedImage;
  /** 이 캐릭터만의 카드 프레임·이름표(v0.26.0). 없으면 공통 cardFrame·cardNameplate */
  frame?: BakedImage;
  nameplate?: BakedImage;
  imageTransform?: Partial<
    Record<'background' | 'character', { scale: number; offsetX: number; offsetY: number }>
  >;
}

export interface CardImages {
  background: string | null;
  character: string | null;
}

/** 게임에 반영된 카드 꾸미기(없으면 undefined) */
export const bakedCard = (characterId: string): BakedCardArt | undefined =>
  bakedCardArt[characterId];

/** 반영본 그림 경로(없으면 null) */
export function cardArt(characterId: string): CardImages {
  const e = bakedCardArt[characterId];
  return { background: e?.background?.src ?? null, character: e?.character?.src ?? null };
}
