// Bottom bar: level and XP purchase, the 10 bench slots, recruit and main action.
import D from '../../core/data/units.js';
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import { Pawn } from './Pawn.tsx';
import type { GameProps } from './Game.tsx';
import styles from './ReserveBar.module.css';

const C = D.prototypeConfig;
const LEVEL = P.config.level;

export function ReserveBar({ ui, actions }: GameProps) {
  const run = ui.run!;
  const editable = V.editable(run);
  const bench = new Map(
    run.units.filter((u) => u.location === 'bench').map((u) => [u.benchSlot ?? -1, u]),
  );
  const needed = LEVEL.requirements[run.level as keyof typeof LEVEL.requirements];
  const maxLevel = run.level >= LEVEL.max;
  const type = P.roundType(run.stage, run.round);
  const selected = run.units.find((u) => u.uid === ui.selected);
  return (
    <footer class={styles.bar}>
      <button
        class={styles.level}
        onClick={actions.buyXp}
        disabled={!editable || maxLevel || run.gold < LEVEL.xpPurchaseGold}
        title={`${LEVEL.xpPurchaseGold}G로 ${LEVEL.xpPurchaseAmount}XP 구매`}
      >
        <b>Lv. {run.level}</b>
        <span>{maxLevel ? '최고 레벨' : `${run.xp} / ${needed} XP`}</span>
        <small>
          {LEVEL.xpPurchaseGold}G · +{LEVEL.xpPurchaseAmount}XP
        </small>
      </button>
      <ol class={styles.bench} aria-label="대기석">
        {Array.from({ length: C.board.benchSize }, (_, slot) => {
          const unit = bench.get(slot);
          return (
            <li
              key={slot}
              class={styles.slot}
              data-slot={slot}
              data-drop={`bench:${slot}`}
              data-over={ui.drag?.active && ui.drag.over === `bench:${slot}`}
            >
              {unit && (
                <Pawn
                  id={unit.id}
                  star={unit.star}
                  context="bench"
                  selected={ui.selected === unit.uid}
                  onClick={() => actions.select(unit.uid)}
                  onDragStart={(id, x, y) => actions.dragStart(unit.uid, id, x, y)}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div class={styles.actions}>
        {selected ? (
          <button
            class={styles.recruit}
            onClick={() => actions.sell(selected.uid)}
            disabled={!editable}
          >
            판매
          </button>
        ) : (
          <button
            class={styles.recruit}
            aria-expanded={ui.shopOpen}
            onClick={() => actions.setShopOpen(!ui.shopOpen)}
          >
            <span>♟ 동료 영입</span>
            <small>{run.gold} G</small>
          </button>
        )}
        <button class={styles.main} data-variant="primary" disabled title="다음 단계에서 연결">
          {type === 'SUPPLY' ? '보급품 받기 →' : '전투 시작 →'}
        </button>
      </div>
    </footer>
  );
}
