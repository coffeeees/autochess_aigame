// 전장 그림(v0.18.0 좌우 대치): 안개 배경(cover)과 8열×7행 투명 보드(contain).
// 좌표 변환은 이 파일 한 곳에서 한다: 그림 픽셀 ↔ 화면(CSS px) ↔ 칸 번호(pos = row × 8 + col).
// DOM 입력 칸(Board.tsx)과 PixiJS 장면(render/stage.ts)·전투 캔버스(render/battlefield.ts)가 모두 이 함수를 쓴다.
// 격자 범위는 보드 그림의 타일 이음선을 픽셀로 잰 값(docs/specs/BOARD_SIDE_8X7_CALIBRATION.json):
//   세로 이음선 310·463·616·768·921·1075·1226(간격 152.75), 가로 이음선 203·319·436·553·670·787(간격 116.7).
//   좌우 바깥 이음선 157·1379, 아래 903은 그림에서 확인. 위 경계 86.5는 균등 간격으로 맞춘 값이고,
//   맨 윗줄 위쪽 약 8px(86.5~94)은 프레임 테두리가 덮는다.
import D from '../../core/data/units.js';

export const COLUMNS = D.prototypeConfig.board.columns as number; // 8
export const ROWS = D.prototypeConfig.board.rows as number; // 7

export const boardArt = {
  background: 'assets/battlefield-bg-fog.webp',
  board: 'assets/board-side-8x7.webp',
  /** 배경 원본 크기(cover로 화면 전체에 깐다) */
  backgroundSource: { width: 1672, height: 941 },
  /** 보드 원본 크기(가로세로 비율 1.5, contain) */
  source: { width: 1536, height: 1024 },
  /** 보드 그림 안의 타일 영역(그림 픽셀) */
  grid: { left: 157, top: 86.5, right: 1379, bottom: 903.5 },
  /** 전장 사용 영역 안쪽 안전 여백(CSS px, 명세 8~16) */
  margin: 12,
} as const;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 칸 한 개의 그림 픽셀 크기 */
export const tileSize = () => ({
  w: (boardArt.grid.right - boardArt.grid.left) / COLUMNS,
  h: (boardArt.grid.bottom - boardArt.grid.top) / ROWS,
});

/** 칸 중심(그림 픽셀) */
export function tileCenterArt(pos: number) {
  const t = tileSize();
  const col = pos % COLUMNS;
  const row = Math.floor(pos / COLUMNS);
  return {
    x: boardArt.grid.left + (col + 0.5) * t.w,
    y: boardArt.grid.top + (row + 0.5) * t.h,
  };
}

/** 사용 가능 영역 A 안에 보드를 비율 그대로 넣는다(contain, 가운데 정렬). 결과는 화면상 보드 그림의 사각형 */
export function fitBoard(area: Rect): Rect & { scale: number } {
  const { width: artW, height: artH } = boardArt.source;
  const scale = Math.max(0, Math.min(area.width / artW, area.height / artH));
  const width = artW * scale;
  const height = artH * scale;
  return {
    left: area.left + (area.width - width) / 2,
    top: area.top + (area.height - height) / 2,
    width,
    height,
    scale,
  };
}

/** 배경을 화면 전체에 비율 그대로 덮는다(cover, 가운데 잘라 내기) */
export function coverBackground(viewW: number, viewH: number): Rect & { scale: number } {
  const { width, height } = boardArt.backgroundSource;
  const scale = Math.max(viewW / width, viewH / height);
  return {
    left: (viewW - width * scale) / 2,
    top: (viewH - height * scale) / 2,
    width: width * scale,
    height: height * scale,
    scale,
  };
}

/** 화면상 보드 사각형 기준 칸 중심과 칸 크기(CSS px) */
export function tileOnScreen(pos: number, board: Rect) {
  const s = board.width / boardArt.source.width;
  const c = tileCenterArt(pos);
  const t = tileSize();
  return { x: board.left + c.x * s, y: board.top + c.y * s, w: t.w * s, h: t.h * s };
}

/** 화면 좌표 → 칸 번호(보드 밖이면 null) */
export function pointerToPos(x: number, y: number, board: Rect): number | null {
  const s = board.width / boardArt.source.width;
  if (!s) return null;
  const px = (x - board.left) / s;
  const py = (y - board.top) / s;
  const t = tileSize();
  const col = Math.floor((px - boardArt.grid.left) / t.w);
  const row = Math.floor((py - boardArt.grid.top) / t.h);
  return col >= 0 && col < COLUMNS && row >= 0 && row < ROWS ? row * COLUMNS + col : null;
}

/** DOM 입력 칸 영역: 보드 그림 기준 %(Board.tsx의 절대 위치용) */
export function playArea() {
  const { source, grid } = boardArt;
  return {
    left: (grid.left / source.width) * 100,
    top: (grid.top / source.height) * 100,
    width: ((grid.right - grid.left) / source.width) * 100,
    height: ((grid.bottom - grid.top) / source.height) * 100,
  };
}

/** 개발용 격자 겹쳐 보기: 주소에 ?grid 또는 localStorage 'autochess-debug-grid' = '1' */
export function debugGridEnabled() {
  try {
    return (
      new URLSearchParams(location.search).has('grid') ||
      localStorage.getItem('autochess-debug-grid') === '1'
    );
  } catch {
    return false;
  }
}
