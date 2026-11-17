// 캐릭터 그림 등록표(결정 D6).
//   portrait: 카드·도감·상세 창용 일러스트(45명 예정)
//   sprite:   전장용 도트 스프라이트 시트(예정)
// 그림이 없는 캐릭터는 SVG 아바타(avatar.js)로 대신하므로, 여기에 항목만
// 추가하면 캐릭터별로 하나씩 그림을 넣을 수 있다. 다른 곳은 고칠 필요 없다.
// 파일은 public/assets/characters/에 영문 소문자·하이픈 이름으로 둔다.

export type ArtContext = 'field' | 'bench' | 'shop' | 'detail';

export interface Framing {
  scale: number; // 틀 안에서 썸네일 확대 배율
  x: number; // 초점 위치(그림 기준 %)
  y: number;
}

export interface Portrait {
  thumbnail: string; // 작은 정사각형에 가까운 잘라 쓰기용 그림
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

export const portraitOf = (id: string): Portrait | undefined => characterArt[id]?.portrait;
export const spriteOf = (id: string): SpriteSheet | undefined => characterArt[id]?.sprite;
