// 라운드 흐름 창: 보급 선택, 증강 선택, 결과(딜 그래프·6-5 선택), 배치 부족 확인,
// 원정 완료 요약. 문구와 항목은 v0.15.18 content-ui / stage-ui / run-flow-ui와 같다.
import { percentNumber } from '../../core/format.ts';
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import P from '../../core/progression.js';
import V from '../../core/preparation.js';
import I from '../../core/items.js';
import A from '../../core/augments.js';
import { itemIconSvg } from '../art/items.js';
import { itemDef } from './Items.tsx';
import { DamageChart } from './DamageChart.tsx';
import type { GameProps } from './Game.tsx';
import styles from './Modals.module.css';

export function Shell({
  children,
  onClose,
  label,
}: {
  children: ComponentChildren;
  onClose?: () => void;
  label: string;
}) {
  return (
    <div class={styles.backdrop}>
      <section class={styles.dialog} role="dialog" aria-modal="true" aria-label={label}>
        {onClose && (
          <button class={styles.close} aria-label="닫기" onClick={onClose}>
            ×
          </button>
        )}
        {children}
      </section>
    </div>
  );
}

export function Modals(props: GameProps) {
  const m = props.ui.modal;
  if (m === 'supply') return <Supply {...props} />;
  if (m === 'augment') return <Augment {...props} />;
  if (m === 'result') return <Result {...props} />;
  if (m === 'deploy') return <DeployWarning {...props} />;
  if (m === 'summary') return <Summary {...props} />;
  return null;
}

function Supply({ ui, actions }: GameProps) {
  const run = ui.run!;
  const offer = run.supplyOffer;
  if (!offer || run.roundPhase !== 'supply') return null;
  const odds: number[] = (I.tierOdds as Record<number, number[]>)[Math.min(6, run.stage)];
  return (
    <Shell label="보급 선택" onClose={actions.closeModal}>
      <span class={styles.eyebrow}>{P.label(run)} · 안전 보급</span>
      <h2>보급품 2개를 선택하세요</h2>
      <p>서로 다른 슬롯을 선택하면 아이템2개를 받습니다. 제시 목록과 선택은 자동 저장됩니다.</p>
      <p class={styles.hint}>확정 시50% 확률로 추가 골드 · 발동 시2G/3G 각각50%</p>
      <div class={styles.odds}>
        {odds.map((n, i) => (
          <span key={i}>
            {i + 1}티어 {percentNumber(n)}%
          </span>
        ))}
      </div>
      <div class={styles.cards}>
        {offer.options.map((id, index) => {
          const def = itemDef(id);
          const chosen = offer.selected.includes(index);
          return (
            <button
              key={index}
              class={styles.card}
              data-tier={def.tier}
              aria-pressed={chosen}
              onClick={() => actions.toggleSupply(index)}
            >
              <span class={styles.cardArt} dangerouslySetInnerHTML={{ __html: itemIconSvg(id) }} />
              <small>
                {def.tier}티어 · {id}
              </small>
              <b>{def.name}</b>
              <span>{def.statsText}</span>
              {def.effect && <p>{def.effect.replace(/\*\*([^*]+)\*\*/g, '$1')}</p>}
              <em>{chosen ? '✓ 선택됨' : '선택'}</em>
            </button>
          );
        })}
      </div>
      <div class={styles.footer}>
        <span>{offer.selected.length} / 2개 선택</span>
        <button
          data-variant="primary"
          disabled={offer.selected.length !== 2}
          onClick={actions.confirmSupply}
        >
          선택한 아이템 받기
        </button>
      </div>
    </Shell>
  );
}

function Augment({ ui, actions }: GameProps) {
  const run = ui.run!;
  const pending = (
    run.augmentState as { pendingPick?: { tier: string; pick: number; node: string } }
  ).pendingPick;
  if (!pending) return null;
  const tier = (A.tiers as Record<string, { name: string; color: string }>)[pending.tier];
  const candidates = P.availableAugments(run) as {
    id: string;
    icon: string;
    name: string;
    text: string;
  }[];
  return (
    <Shell label="증강 선택" onClose={actions.closeModal}>
      <div style={{ '--augment-color': tier.color }}>
        <span class={styles.eyebrow}>
          증강 선택 {pending.pick} / 3 · {pending.node} 진입 전
        </span>
        <h2 class={styles.augmentTitle}>{tier.name} 증강</h2>
        <p>같은 등급의 세 후보 중 하나를 선택하세요. 효과는 이번 원정 동안 유지됩니다.</p>
        <p class={styles.hint}>
          아래 선택 버튼으로 확정합니다. 닫거나 새로고침해도 등급·후보는 바뀌지 않습니다.
        </p>
        <div class={styles.augments}>
          {candidates.map((a) => (
            <article key={a.id} class={styles.augment}>
              <strong>{a.icon}</strong>
              <h3>{a.name}</h3>
              <p>{a.text}</p>
              <button onClick={() => actions.chooseAugment(a.id)}>선택 확정</button>
            </article>
          ))}
        </div>
      </div>
    </Shell>
  );
}

interface Receipt {
  key: string;
  type: string;
  win: boolean;
  done: boolean;
  reason?: string;
  time: number;
  total: number;
  totalEarned?: number;
  base: number;
  winStreak?: number;
  streakBonus?: number;
  augmentGold?: number;
  before: number;
  interest: number;
  bonusGold?: number;
  healing?: number;
  extra?: { kind: string; itemIds?: string[]; itemId?: string };
  bossItem?: { itemId: string } | null;
  monsterLoot?: { kind: string; itemId?: string; amount?: number } | null;
  gold: number;
  health: number;
  loss?: number;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  damageRows?: { id: string; name?: string; star?: number; damage: number }[];
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div class={styles.row} data-tone={tone}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Result({ ui, actions }: GameProps) {
  const run = ui.run!;
  const r = run.lastResult as unknown as Receipt | null;
  if (!r) return null;
  const supply = r.type === 'SUPPLY';
  const title = r.done
    ? '원정 종료'
    : supply
      ? '안전 보급 완료'
      : r.type === 'BOSS'
        ? r.win
          ? '보스 전투 승리'
          : '보스 전투 패배'
        : r.win
          ? '전투 승리'
          : '전투 패배';
  const pending = run.completionChoice === 'pending';
  const name = (id: string) => itemDef(id)?.name ?? id;
  return (
    <Shell label="라운드 결과">
      <div class={supply ? styles.result : `${styles.result} ${styles.withDamage}`}>
        <div class={styles.overview}>
          <span class={styles.eyebrow}>
            라운드 {r.key} · {r.type}
          </span>
          <strong class={styles.mark}>{supply ? '▣' : r.win ? '✦' : '◇'}</strong>
          <h2>{title}</h2>
          <p>
            {supply
              ? `전투 없이 아이템 ${r.extra?.itemIds?.length || 1}개를 획득했습니다. HP 피해 없음.`
              : r.reason === 'timeout'
                ? '시간초과 · 기존 패배 규칙 적용'
                : r.reason === 'draw'
                  ? '동시 전멸 · 기존 패배 규칙 적용'
                  : r.time + '초 전투 종료'}
          </p>
          <div class={styles.total}>
            <span>이번 라운드 획득 골드</span>
            <b>+{r.totalEarned ?? r.total} G</b>
          </div>
          <Row label={`${r.type === 'BOSS' ? '보스 ' : ''}기본 보상`} value={`+${r.base} G`} />
          <Row
            label={`${r.winStreak || 0}연승 보너스 · 최대5G`}
            value={`+${r.streakBonus || 0} G`}
            tone="gold"
          />
          {!!r.augmentGold && <Row label="증강 승리 보너스" value={`+${r.augmentGold} G`} />}
          <Row label={`이자 · 보상 전 ${r.before}G / 최대 5G`} value={`+${r.interest} G`} />
          {supply && (
            <Row label="보급 추가 골드" value={r.bonusGold ? `+${r.bonusGold} G` : '미획득'} />
          )}
          {!!r.healing && <Row label="전투 승리 체력 회복" value={`+${r.healing} HP`} />}
          {r.extra && (
            <div class={styles.loot}>
              {r.type === 'BOSS' ? '보스 추가 보상' : '보급 아이템'} ·{' '}
              {r.extra.kind === 'items'
                ? r.extra.itemIds!.map(name).join(' · ')
                : r.extra.kind === 'item'
                  ? name(r.extra.itemId!)
                  : '추가 골드 +' + r.bonusGold + 'G'}
            </div>
          )}
          {r.bossItem && (
            <div class={styles.loot}>보스 확정 아이템 · {name(r.bossItem.itemId)}</div>
          )}
          {r.monsterLoot && (
            <div class={styles.loot}>
              전투 중 보너스 몬스터 ·{' '}
              {r.monsterLoot.kind === 'item'
                ? name(r.monsterLoot.itemId!)
                : '+' + r.monsterLoot.amount + 'G'}{' '}
              (처치 시 지급 완료)
            </div>
          )}
          <Row label="현재 골드" value={`${r.gold} G`} />
          <Row label="남은 체력" value={`♥ ${r.health}${r.loss ? ' (−' + r.loss + ')' : ''}`} />
          <Row
            label="라운드 XP 임시"
            value={`+${r.xpGained} XP${r.levelAfter > r.levelBefore ? ' · 레벨 ' + r.levelAfter + ' 달성' : ''}`}
          />
        </div>
        {!supply && (
          <section class={styles.damage}>
            <h3>아군 딜량</h3>
            <DamageChart rows={r.damageRows || []} />
            {pending && <CompletionChoice actions={actions} />}
          </section>
        )}
        {!pending && (
          <button class={styles.next} data-variant="primary" onClick={actions.continueRound}>
            {r.done ? '결과 확인' : '다음 라운드 →'}
          </button>
        )}
      </div>
    </Shell>
  );
}

function CompletionChoice({ actions }: Pick<GameProps, 'actions'>) {
  return (
    <section class={styles.completion}>
      <span class={styles.eyebrow}>6 ROUND COMPLETE</span>
      <h3>기본 진행 구간을 완료했습니다</h3>
      <p>
        6-5 전투와 보상 정산이 끝났습니다. 여기서 종료하거나 현재 상태로 7-1부터 계속할 수 있습니다.
      </p>
      <p class={styles.hint}>
        7라운드부터는 메타레벨(전체레벨) 경험치를 받지 않으며, 기록용으로만 플레이합니다.
      </p>
      <div class={styles.buttons}>
        <button onClick={() => actions.chooseCompletion('end')}>게임 종료</button>
        <button data-variant="primary" onClick={() => actions.chooseCompletion('continue')}>
          계속 진행
        </button>
      </div>
    </section>
  );
}

function DeployWarning({ ui, actions }: GameProps) {
  const [skip, setSkip] = useState(false);
  const status = V.deploymentStatus(ui.run!) as {
    count: number;
    capacity: number;
    missing: number;
  };
  return (
    <Shell label="전투 시작 전 확인" onClose={actions.closeModal}>
      <span class={styles.eyebrow}>전투 시작 전 확인</span>
      <h2>전장에 빈 배치 자리가 있습니다</h2>
      <p>
        현재{' '}
        <b>
          {status.count} / {status.capacity}명
        </b>{' '}
        배치되어 있습니다. {status.missing}명을 더 배치할 수 있습니다.
      </p>
      <p>
        {status.count === 0
          ? '아군을 1명 이상 배치해야 전투를 시작할 수 있습니다.'
          : '현재 배치로 전투를 시작할까요, 아니면 다시 배치할까요?'}
      </p>
      <label class={styles.remember}>
        <input
          type="checkbox"
          checked={skip}
          onChange={(e) => setSkip((e.target as HTMLInputElement).checked)}
        />{' '}
        이번 원정에서 다시 묻지 않기
      </label>
      <div class={styles.buttons}>
        <button onClick={actions.closeModal}>다시 세팅하기</button>
        <button
          data-variant="primary"
          disabled={status.count === 0}
          onClick={() => actions.confirmDeployment(skip)}
        >
          이대로 진행
        </button>
      </div>
    </Shell>
  );
}

function Summary({ ui, actions }: GameProps) {
  const run = ui.run!;
  return (
    <Shell label="원정 완료">
      <span class={styles.eyebrow}>EXPEDITION COMPLETE</span>
      <h2>기본 진행 구간 완료</h2>
      <p>6-5까지의 결과와 보상은 이미 저장되었습니다.</p>
      <Row label="남은 체력" value={`♥ ${run.health}`} />
      <Row label="보유 골드" value={`${run.gold} G`} />
      <Row label="완료 노드" value={String(Object.keys(run.completedRounds).length)} />
      <p>동료·장비·증강과 정산 기록은 이 원정에 보존됩니다.</p>
      <button data-variant="primary" onClick={actions.showHome}>
        시작 화면
      </button>
    </Shell>
  );
}
