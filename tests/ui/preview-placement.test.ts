// 조합 미리보기 팝업 위치(v0.20.1): 보관함은 왼쪽, 캐릭터는 여유 쪽, 항상 화면 안.
import { expect, test } from 'vitest';
import { placePreview, previewMargin as m } from '../../src/ui/previewPlacement.ts';

const r = (left: number, top: number, w: number, h: number) => ({
  left,
  top,
  right: left + w,
  bottom: top + h,
});
const size = { width: 260, height: 120 };
const vp = { width: 1280, height: 720 };
const inside = (p: { left: number; top: number }, s = size, v = vp) => {
  expect(p.left).toBeGreaterThanOrEqual(m);
  expect(p.top).toBeGreaterThanOrEqual(m);
  expect(p.left + s.width).toBeLessThanOrEqual(v.width - m);
  expect(p.top + s.height).toBeLessThanOrEqual(v.height - m);
};

test('보관함 조합은 보관함 패널 왼쪽에 붙는다', () => {
  const panel = r(1040, 80, 232, 500);
  const slot = r(1060, 200, 48, 48);
  const p = placePreview(slot, panel, size, vp, 'inventory');
  expect(p.side).toBe('left');
  expect(p.left + size.width).toBeLessThanOrEqual(panel.left);
  inside(p);
});

test('보관함 맨 아래·맨 위 칸에서도 세로로 잘리지 않는다', () => {
  const panel = r(1040, 0, 232, 720);
  inside(placePreview(r(1060, 690, 48, 30), panel, size, vp, 'inventory'));
  inside(placePreview(r(1060, 0, 48, 30), panel, size, vp, 'inventory'));
});

test('캐릭터 조합은 여유 공간이 큰 쪽으로 뜬다', () => {
  expect(placePreview(r(100, 300, 60, 60), r(100, 300, 60, 60), size, vp, 'unit').side).toBe(
    'right',
  );
  const right = r(1100, 300, 60, 60);
  const p = placePreview(right, right, size, vp, 'unit');
  expect(p.side).toBe('left');
  inside(p);
});

test('좁은 화면(양쪽 다 모자람)에서도 화면 안으로 보정된다', () => {
  const small = { width: 360, height: 640 };
  const panel = r(120, 100, 232, 400);
  inside(placePreview(r(140, 620, 48, 20), panel, size, small, 'inventory'), size, small);
  inside(placePreview(r(150, 300, 60, 60), r(150, 300, 60, 60), size, small, 'unit'), size, small);
});
