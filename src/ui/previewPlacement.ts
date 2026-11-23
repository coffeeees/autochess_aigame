// 조합 미리보기 팝업 위치(v0.20.1). 순수 함수라 화면 크기·확대 비율과 무관하게 CSS 픽셀 좌표로만 계산한다.
// - 보관함 조합: 보관함 패널 왼쪽에 붙이고 대상 칸 높이에 맞춘다(왼쪽이 모자라면 오른쪽, 그래도 모자라면 화면 안으로 밀어 넣음).
// - 캐릭터 조합: 대상 칸의 좌우 중 여유가 큰 쪽에 붙인다.
// - 어느 경우든 마지막에 화면 가장자리(여백 margin) 안으로 보정해 내용 전체가 보이게 한다.
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface Size {
  width: number;
  height: number;
}

export const previewGap = 10;
export const previewMargin = 8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * @param anchor  포인터 아래 놓을 곳(보관함 칸 또는 캐릭터 칸)의 화면 좌표
 * @param edge    좌우 기준 영역: 보관함 조합이면 보관함 패널, 캐릭터면 anchor와 같음
 * @param mode    'inventory'는 왼쪽 우선, 'unit'은 여유 공간이 큰 쪽 우선
 */
export function placePreview(
  anchor: Rect,
  edge: Rect,
  size: Size,
  viewport: Size,
  mode: 'inventory' | 'unit',
): { left: number; top: number; side: 'left' | 'right' } {
  const m = previewMargin,
    g = previewGap;
  const leftX = edge.left - g - size.width;
  const rightX = edge.right + g;
  const fitsLeft = leftX >= m;
  const fitsRight = rightX + size.width <= viewport.width - m;
  let side: 'left' | 'right';
  if (mode === 'inventory') side = fitsLeft || !fitsRight ? 'left' : 'right';
  else {
    const prefer = viewport.width - edge.right >= edge.left ? 'right' : 'left';
    const fits = prefer === 'right' ? fitsRight : fitsLeft;
    const other = prefer === 'right' ? fitsLeft : fitsRight;
    side = fits || !other ? prefer : prefer === 'right' ? 'left' : 'right';
  }
  const left = clamp(side === 'left' ? leftX : rightX, m, viewport.width - m - size.width);
  const center = (anchor.top + anchor.bottom) / 2;
  const top = clamp(center - size.height / 2, m, viewport.height - m - size.height);
  return { left: Math.round(left), top: Math.round(top), side };
}
