// Battlefield art and the measured grid lines of board-7x8.png
// (from src/legacy/battle-art.js; the PNG itself is unchanged).
export const boardArt = {
  background: 'assets/battlefield-bg.png',
  board: 'assets/board-7x8.png',
  source: { width: 1659, height: 948 },
  /** x of the 8 vertical lines (7 columns) */
  columns: [283.5, 443.5, 600, 754.5, 909.5, 1063, 1215, 1375.5],
  /** y of the 9 horizontal lines (8 rows) */
  rows: [94, 186.5, 277, 366, 453, 542, 628, 719.5, 813],
} as const;

/** CSS grid track lists that follow the measured lines, e.g. "160fr 156.5fr ...". */
export const tracks = (lines: readonly number[]) =>
  lines
    .slice(1)
    .map((v, i) => `${v - lines[i]}fr`)
    .join(' ');

/** The playable rectangle in % of the image, for absolute positioning. */
export function playArea() {
  const { source, columns, rows } = boardArt;
  return {
    left: (columns[0] / source.width) * 100,
    top: (rows[0] / source.height) * 100,
    width: ((columns.at(-1)! - columns[0]) / source.width) * 100,
    height: ((rows.at(-1)! - rows[0]) / source.height) * 100,
  };
}
