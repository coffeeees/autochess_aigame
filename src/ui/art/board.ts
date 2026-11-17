// 전장 그림과 board-7x8.png에서 잰 격자선 위치
// (src/legacy/battle-art.js에서 가져옴, PNG 자체는 바꾸지 않음).
export const boardArt = {
  background: 'assets/battlefield-bg.png',
  board: 'assets/board-7x8.png',
  source: { width: 1659, height: 948 },
  /** 세로선 8개의 x 좌표(7열) */
  columns: [283.5, 443.5, 600, 754.5, 909.5, 1063, 1215, 1375.5],
  /** 가로선 9개의 y 좌표(8행) */
  rows: [94, 186.5, 277, 366, 453, 542, 628, 719.5, 813],
} as const;

/** 잰 선 위치를 따르는 CSS 그리드 트랙 목록, 예: "160fr 156.5fr ...". */
export const tracks = (lines: readonly number[]) =>
  lines
    .slice(1)
    .map((v, i) => `${v - lines[i]}fr`)
    .join(' ');

/** 그림 기준 %로 나타낸 실제 칸 영역(절대 위치 지정용). */
export function playArea() {
  const { source, columns, rows } = boardArt;
  return {
    left: (columns[0] / source.width) * 100,
    top: (rows[0] / source.height) * 100,
    width: ((columns.at(-1)! - columns[0]) / source.width) * 100,
    height: ((rows.at(-1)! - rows[0]) / source.height) * 100,
  };
}
