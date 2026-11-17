// 전장(준비 화면). 7×8 칸은 보드 그림에서 잰 선 위치를 따른다. 위쪽은 적,
// 아래쪽은 아군. 아군은 끌어서 옮기고(DragLayer), 모든 칸이 놓을 곳이며
// 가능 여부는 core/preparation이 정한다.
import D from '../../core/data/units.js';
import P from '../../core/progression.js';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { boardArt, tracks, playArea } from '../art/board.ts';
import { Pawn } from './Pawn.tsx';
import type { Battlefield, FieldBattle } from '../render/battlefield.ts';
import type { GameProps } from './Game.tsx';
import styles from './Board.module.css';

const COLUMNS = D.prototypeConfig.board.columns as number;
const ROWS = D.prototypeConfig.board.rows as number;

/** 전투 중 화면에 쓰는 전투 유닛 필드(core Battle의 units). */
interface CombatUnit {
  uid: number;
  id: string;
  team: 'ally' | 'enemy';
  pos: number;
  hp: number;
  mp: number;
  star?: number;
  dead?: boolean;
  summon?: boolean;
  bonus?: boolean;
  name?: string;
  stats: { HP: number; MP: number };
  shields?: { amount: number }[];
}

export function Board(props: GameProps) {
  // 전투가 끝난 뒤에도 마지막 장면을 잠시 보여 준다(ui.finishing)
  return props.ui.battle || props.ui.finishing ? (
    <CombatBoard {...props} />
  ) : (
    <PrepareBoard {...props} />
  );
}

/** 움직임 줄이기 설정 */
const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 전투 중: 캐릭터와 연출은 PixiJS 캔버스가 그린다(render/battlefield.ts).
 * 캔버스를 만들 수 없는 환경이면 Worker 스냅샷의 유닛을 DOM 말로 그린다.
 */
function CombatBoard({ ui, actions }: GameProps) {
  const battle = (ui.battle ?? ui.finishing) as unknown as {
    units: CombatUnit[];
    time: number;
    events: unknown[];
  };
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<Battlefield | null>(null);
  const [mode, setMode] = useState<'loading' | 'canvas' | 'dom'>('loading');

  useEffect(() => {
    let alive = true;
    let made: Battlefield | null = null;
    import('../render/battlefield.ts')
      .then((m) => m.createBattlefield(host.current!, { reduced: reducedMotion }))
      .then((f) => {
        made = f;
        if (!alive) return f.destroy();
        field.current = f;
        setMode('canvas');
      })
      .catch(() => alive && setMode('dom'));
    return () => {
      alive = false;
      made?.destroy();
      field.current = null;
    };
  }, []);

  // 스냅샷이 바뀔 때마다 캔버스에 넘긴다(캔버스는 읽기만 한다)
  useEffect(() => {
    field.current?.update(battle as unknown as FieldBattle, ui.speed);
  });

  const units = new Map(battle.units.filter((u) => !u.dead && u.hp > 0).map((u) => [u.pos, u]));
  return (
    <Grid
      // 전투가 끝난 뒤 마지막 장면은 누르면 건너뛴다
      onClick={ui.finishing ? actions.skipFinish : undefined}
      layer={<div ref={host} class={styles.canvas} data-mode={mode} />}
      cell={(pos) => {
        if (mode !== 'dom') return null;
        const u = units.get(pos);
        return u ? (
          <Pawn
            id={u.id}
            star={u.star ?? 1}
            enemy={u.team === 'enemy'}
            context="field"
            label={u.bonus ? '보물 슬라임' : u.summon ? u.name : undefined}
            hp={Math.max(0, u.hp / u.stats.HP)}
            mp={u.stats.MP ? u.mp / u.stats.MP : 0}
            shielded={(u.shields || []).some((s) => s.amount > 0)}
          />
        ) : null;
      }}
      caption={`${battle.time.toFixed(1)}초 · ${ui.speed}배속`}
    />
  );
}

function PrepareBoard({ ui, actions }: GameProps) {
  const run = ui.run!;
  const allies = new Map(run.units.filter((u) => u.location === 'board').map((u) => [u.pos, u]));
  // 다가올 전투의 적 편성(저장소가 prepareFormation으로 원정에 캐시해 둠)
  const formation =
    run.roundPhase === 'prepare' && !run.done && run.enemyEncounter?.key === P.label(run)
      ? (run.enemyEncounter.units as { id: string; pos: number; star?: number }[])
      : [];
  const enemies = new Map(formation.map((u) => [u.pos, u]));
  return (
    <Grid
      cellProps={(pos) => {
        const ally = allies.get(pos);
        return {
          'data-drop': `board:${pos}`,
          'data-item-drop': ally ? `unit:${ally.uid}` : undefined,
          'data-over':
            ui.drag?.active &&
            (ui.drag.over === `board:${pos}` || (!!ally && ui.drag.over === `unit:${ally.uid}`)),
        };
      }}
      cell={(pos) => {
        const ally = allies.get(pos),
          enemy = enemies.get(pos);
        return (
          <>
            {ally && (
              <Pawn
                uid={ally.uid}
                id={ally.id}
                star={ally.star}
                selected={ui.selected === ally.uid}
                context="field"
                onClick={() => actions.select(ally.uid)}
                onDragStart={(id, x, y) => actions.dragStart('unit', ally.uid, id, x, y)}
              />
            )}
            {enemy && <Pawn id={enemy.id} star={enemy.star ?? 1} enemy context="field" />}
          </>
        );
      }}
    />
  );
}

/** 보드 그림과 7×8 칸. cell(pos)이 칸 내용, cellProps(pos)가 칸 속성을 정한다. */
function Grid({
  cell,
  cellProps,
  caption,
  layer,
  onClick,
}: {
  cell: (pos: number) => ComponentChildren;
  cellProps?: (pos: number) => Record<string, unknown>;
  caption?: string;
  /** 칸 위에 겹쳐 그리는 층(전투 캔버스) */
  layer?: ComponentChildren;
  onClick?: () => void;
}) {
  const area = playArea();
  return (
    <div
      class={styles.art}
      onClick={onClick}
      style={{ aspectRatio: `${boardArt.source.width} / ${boardArt.source.height}` }}
    >
      <img class={styles.boardImage} src={boardArt.board} alt="" draggable={false} />
      {caption && <span class={styles.caption}>{caption}</span>}
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
        {Array.from({ length: COLUMNS * ROWS }, (_, pos) => (
          <div
            key={pos}
            class={styles.cell}
            data-pos={pos}
            data-side={pos < COLUMNS * (ROWS / 2) ? 'enemy' : 'ally'}
            {...(cellProps?.(pos) ?? {})}
          >
            {cell(pos)}
          </div>
        ))}
      </div>
      {layer}
    </div>
  );
}
