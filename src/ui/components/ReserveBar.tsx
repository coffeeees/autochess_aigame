// 아래 바: 레벨·XP 구매, 대기석 10칸, 동료 영입, 주 버튼.
import D from '../../core/data/units.js';
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import { Pawn } from './Pawn.tsx';
import { LiquidXp, useLevelShake } from './VitalEffects.tsx';
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
  const main = primaryButton(ui, type);
  const shake = useLevelShake<HTMLButtonElement>();
  return (
    <footer class={styles.bar}>
      <button
        ref={shake.ref}
        class={styles.level}
        onClick={actions.buyXp}
        disabled={!editable || maxLevel || run.gold < LEVEL.xpPurchaseGold}
        title={`${LEVEL.xpPurchaseGold}G로 ${LEVEL.xpPurchaseAmount}XP 구매`}
      >
        <LiquidXp
          level={run.level}
          xp={run.xp}
          ratio={maxLevel ? 1 : Math.min(1, run.xp / needed)}
          onLevelUp={shake.trigger}
        />
        <b>Lv. {run.level}</b>
        {/* 현재 XP / 필요 XP, 구매 골드·얻는 XP(요청서 7: 받침을 깔아 물결 위에서도 읽히게) */}
        <span class={styles.xp}>{maxLevel ? '최고 레벨' : `${run.xp} / ${needed} XP`}</span>
        {!maxLevel && (
          <small class={styles.cost}>
            <em>{LEVEL.xpPurchaseGold}G</em> · +{LEVEL.xpPurchaseAmount} XP
          </small>
        )}
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
              data-item-drop={unit ? `unit:${unit.uid}` : undefined}
              data-over={
                ui.drag?.active &&
                (ui.drag.over === `bench:${slot}` ||
                  (!!unit && ui.drag.over === `unit:${unit.uid}`))
              }
            >
              {unit && (
                <Pawn
                  uid={unit.uid}
                  id={unit.id}
                  star={unit.star}
                  context="bench"
                  selected={ui.selected === unit.uid}
                  onClick={(e) => actions.select(unit.uid, e.clientX, e.clientY)}
                  onDragStart={(id, x, y) => actions.dragStart('unit', unit.uid, id, x, y)}
                />
              )}
            </li>
          );
        })}
      </ol>
      <BenchOverflow ui={ui} actions={actions} />
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
            data-popup-trigger="shop"
            onClick={() => actions.setShopOpen(!ui.shopOpen)}
          >
            <span>♟ 동료 영입</span>
            <small>{run.gold} G</small>
          </button>
        )}
        <button
          class={styles.main}
          data-variant="primary"
          disabled={main.disabled}
          title={main.title}
          onClick={() => actions.primary()}
        >
          {main.label}
        </button>
      </div>
    </footer>
  );
}

/** 주 버튼 문구와 활성 조건(v0.15.18 stage-ui.js renderProgression). */
function primaryButton(ui: GameProps['ui'], type: string) {
  const run = ui.run!;
  const phase = run.roundPhase;
  const deployed = run.units.filter((u) => u.location === 'board').length;
  if (ui.battle) return { label: '전투 중', disabled: true, title: '' };
  const emptyBattle = phase === 'prepare' && type !== 'SUPPLY' && !deployed;
  const label = emptyBattle
    ? '아군 배치 필요'
    : phase === 'complete'
      ? '완료 기록'
      : phase === 'supply'
        ? '보급 선택'
        : phase === 'result'
          ? '결과 확인'
          : phase === 'augment'
            ? '증강 선택'
            : type === 'SUPPLY'
              ? '보급품 받기 →'
              : '전투 시작 →';
  const disabled =
    (run.done && phase !== 'complete') ||
    (phase === 'prepare' && type !== 'SUPPLY' && (!deployed || deployed > P.capacity(run)));
  return {
    label,
    disabled,
    title: emptyBattle ? '아군을 1명 이상 배치해야 전투를 시작할 수 있습니다.' : '',
  };
}

/** 예전 저장의 10칸을 넘는 대기석 캐릭터(v0.15.18 benchOverflowMarkup). */
function BenchOverflow({ ui, actions }: GameProps) {
  const run = ui.run!;
  const extra = run.units.filter(
    (u) => u.location === 'bench' && (u.benchSlot ?? 0) >= C.board.benchSize,
  );
  if (!extra.length) return null;
  return (
    <details class={styles.overflow}>
      <summary>이전 보유 {extra.length}명 ↗</summary>
      <p>전장에 배치하거나 기존 칸과 교체할 수 있습니다.</p>
      <div class={styles.overflowGrid}>
        {extra.map((u) => (
          <div
            key={u.uid}
            class={styles.slot}
            data-drop={`bench:${u.benchSlot}`}
            data-item-drop={`unit:${u.uid}`}
          >
            <Pawn
              id={u.id}
              star={u.star}
              context="bench"
              selected={ui.selected === u.uid}
              onClick={() => actions.select(u.uid)}
              onDragStart={(id, x, y) => actions.dragStart('unit', u.uid, id, x, y)}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
