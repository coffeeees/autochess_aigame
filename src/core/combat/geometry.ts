// 전투 루프와 스킬 파일이 함께 쓰는 칸 거리(battle.js에서 옮김).
import D from '../data/units.js';

export function distance(
  a: number,
  b: number,
  columns: number = D.prototypeConfig.board.columns,
): number {
  return (
    Math.abs((a % columns) - (b % columns)) +
    Math.abs(Math.floor(a / columns) - Math.floor(b / columns))
  );
}
