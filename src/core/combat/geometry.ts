// Grid distance shared by the battle loop and the skill files (moved from battle.js).
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
