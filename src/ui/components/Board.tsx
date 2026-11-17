// Battlefield (preparation view). The 7x8 grid follows the measured lines of the
// board art. Enemy rows on top, ally rows below. Stage 5c: read-only formation;
// clicking an ally selects it. Placement and dragging come in the next step.
import D from '../../core/data/units.js';
import P from '../../core/progression.js';
import { boardArt, tracks, playArea } from '../art/board.ts';
import { Pawn } from './Pawn.tsx';
import type { GameProps } from './Game.tsx';
import styles from './Board.module.css';

const COLUMNS = D.prototypeConfig.board.columns as number;
const ROWS = D.prototypeConfig.board.rows as number;

export function Board({ ui, actions }: GameProps) {
  const run = ui.run!;
  const area = playArea();
  const allies = new Map(run.units.filter((u) => u.location === 'board').map((u) => [u.pos, u]));
  // the coming battle's formation, cached on the run by the store (prepareFormation)
  const formation =
    run.roundPhase === 'prepare' && !run.done && run.enemyEncounter?.key === P.label(run)
      ? (run.enemyEncounter.units as { id: string; pos: number; star?: number }[])
      : [];
  const enemies = new Map(formation.map((u) => [u.pos, u]));
  return (
    <div
      class={styles.art}
      style={{ aspectRatio: `${boardArt.source.width} / ${boardArt.source.height}` }}
    >
      <img class={styles.boardImage} src={boardArt.board} alt="" draggable={false} />
      <div
        class={styles.grid}
        style={{
          left: `${area.left}%`,
          top: `${area.top}%`,
          width: `${area.width}%`,
          height: `${area.height}%`,
          gridTemplateColumns: tracks(boardArt.columns),
          gridTemplateRows: tracks(boardArt.rows),
        }}
      >
        {Array.from({ length: COLUMNS * ROWS }, (_, pos) => {
          const ally = allies.get(pos),
            enemy = enemies.get(pos);
          return (
            <div
              key={pos}
              class={styles.cell}
              data-pos={pos}
              data-side={pos < COLUMNS * (ROWS / 2) ? 'enemy' : 'ally'}
            >
              {ally && (
                <Pawn
                  id={ally.id}
                  star={ally.star}
                  selected={ui.selected === ally.uid}
                  context="field"
                  onClick={() => actions.select(ally.uid)}
                />
              )}
              {enemy && <Pawn id={enemy.id} star={enemy.star ?? 1} enemy context="field" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
