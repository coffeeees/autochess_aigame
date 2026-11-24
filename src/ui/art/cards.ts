// 컬렉션 카드 그림 등록표(v0.22.0).
//   공통: 프레임(714×1000)·이름표(750×279) — 사용자 제공 원본을 무손실 WebP로(tools/convert-images.py)
//   캐릭터별: background(카드 안쪽 배경), character(프레임 앞에 서는 투명 인물). 아직 받은 그림이 없어 비어 있다.
// 그림이 생기면 public/assets/cards/<id>/에 넣고 아래 cardImages에 경로만 추가한다. 다른 곳은 고칠 필요 없다.
// 없는 그림은 카드가 플레이스홀더(어두운 배경·인물 자리)로 그린다.

export const cardFrame = 'assets/cards/card-frame.webp';
export const cardNameplate = 'assets/cards/card-nameplate.webp';
/** 원본 비율(프레임 714:1000, 이름표 750:279) */
export const cardRatio = 714 / 1000;
export const nameplateRatio = 750 / 279;

export interface CardImages {
  background: string | null;
  character: string | null;
}

/** 캐릭터 ID → 카드 그림 경로. 예: C01: { background: 'assets/cards/c01/background.webp', character: 'assets/cards/c01/character.webp' } */
const cardImages: Readonly<Record<string, Partial<CardImages>>> = {};

export function cardArt(characterId: string): CardImages {
  const e = cardImages[characterId];
  return { background: e?.background ?? null, character: e?.character ?? null };
}
