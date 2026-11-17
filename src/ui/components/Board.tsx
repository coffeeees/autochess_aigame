// 전장(준비 화면). 7×8 칸은 보드 그림에서 잰 선 위치를 따른다. 위쪽은 적,
// 아래쪽은 아군. 아군은 끌어서 옮기고(DragLayer), 모든 칸이 놓을 곳이며
// 가능 여부는 core/preparation이 정한다.
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
  // 다가올 전투의 적 편성(저장소가 prepareFormation으로 원정에 캐시해 둠)
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
              data-drop={`board:${pos}`}
              data-item-drop={ally ? `unit:${ally.uid}` : undefined}
              data-over={
                ui.drag?.active &&
                (ui.drag.over === `board:${pos}` || (!!ally && ui.drag.over === `unit:${ally.uid}`))
              }
              data-side={pos < COLUMNS * (ROWS / 2) ? 'enemy' : 'ally'}
            >
              {ally && (
                <Pawn
                  id={ally.id}
                  star={ally.star}
                  selected={ui.selected === ally.uid}
                  context="field"
                  onClick={() => actions.select(ally.uid)}
                  onDragStart={(id, x, y) => actions.dragStart('unit', ally.uid, id, x, y)}
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
