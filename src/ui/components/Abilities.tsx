// 능력치 화면(v0.19.0): 메타 영구 강화 40종. 5계열 탭 + 8노드 연결 트리(약 65%) + 오른쪽 상세(약 35%).
// 노드를 누르면 상세만 바뀌고, 실제 구매는 상세 패널의 "강화하기" 버튼에서만 한다(저장소 buyUpgrade).
// 연결선은 보기용이다(선행 구매 조건 없음, 메타 레벨 조건만).
import M from '../../core/meta.ts';
import U, { type UpgradeDef } from '../../core/meta-upgrades.ts';
import type { Store, UiState } from '../store.ts';
import styles from './Abilities.module.css';

type Props = { ui: UiState; actions: Store['actions'] };

/** 트리 배치(%): 기초 3 → 전문 2 → 고급 2 → 최종 1 */
const LAYOUT: [number, number][] = [
  [12, 18],
  [12, 50],
  [12, 82],
  [38, 32],
  [38, 68],
  [63, 32],
  [63, 68],
  [88, 50],
];
const LINKS: [number, number][] = [
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 4],
  [3, 5],
  [4, 6],
  [5, 7],
  [6, 7],
];

/** 자물쇠(글꼴에 없는 기호 대신 SVG) */
const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

type NodeState = 'locked' | 'max' | 'ready' | 'short';
function nodeState(ui: UiState, u: UpgradeDef): NodeState {
  const lv = ui.meta.upgrades[u.id] || 0;
  if (ui.meta.metaLevel < u.unlock) return 'locked';
  if (lv >= u.max) return 'max';
  return ui.meta.growthPoints >= 1 ? 'ready' : 'short';
}
const STATE_TEXT: Record<NodeState, string> = {
  locked: '잠김',
  max: 'MAX',
  ready: '강화 가능',
  short: '포인트 부족',
};

export function Abilities({ ui, actions }: Props) {
  const meta = ui.meta;
  const branch = U.branches.find((b) => b.id === ui.abilities.branch)!;
  const nodes = U.upgrades.filter((u) => u.branch === branch.id);
  const selected = U.byId(ui.abilities.node) ?? nodes[0];
  const runActive = !!ui.run && !ui.run.done;
  return (
    <section class={styles.view} style={{ '--branch': branch.color }} aria-label="능력치">
      <header class={styles.header}>
        <button class={styles.back} onClick={() => actions.showHome()}>
          ← 시작 화면
        </button>
        <h1>능력치</h1>
        <dl class={styles.wallet}>
          <div>
            <dt>메타 레벨</dt>
            <dd>
              Lv.{meta.metaLevel} <small>{M.progressLabel(meta.metaLevel, meta.metaXp)}</small>
            </dd>
          </div>
          <div data-kind="points">
            <dt>성장 포인트</dt>
            <dd>
              {meta.growthPoints}P <small>영구 강화에 사용</small>
            </dd>
          </div>
          <div data-kind="tickets">
            <dt>뽑기 티켓</dt>
            <dd>
              {meta.tickets}장 <small>뽑기(준비 중)에 사용 · 지금은 모으기만</small>
            </dd>
          </div>
        </dl>
      </header>
      <p class={styles.rule}>
        구매한 강화는 <b>다음에 시작하는 원정부터</b> 모두 자동 적용됩니다
        {runActive ? '(진행 중인 원정에는 적용되지 않음)' : ''}. 레벨이 오를 때마다 성장 포인트 +2P,
        뽑기 티켓 +2장(5의 배수 레벨은 +4장). 수치는 밸런스 테스트용 임시값입니다.
      </p>
      <div class={styles.tabs} role="tablist" aria-label="강화 계열">
        {U.branches.map((b) => {
          const list = U.upgrades.filter((u) => u.branch === b.id);
          const spent = list.reduce((n, u) => n + (meta.upgrades[u.id] || 0), 0);
          const max = list.reduce((n, u) => n + u.max, 0);
          return (
            <button
              key={b.id}
              role="tab"
              aria-selected={b.id === branch.id}
              style={{ '--tab': b.color }}
              onClick={() => actions.pickBranch(b.id)}
            >
              {b.name}
              <small>
                {spent}/{max}
              </small>
            </button>
          );
        })}
      </div>
      <div class={styles.body}>
        <div class={styles.tree} aria-label={`${branch.name} 강화 트리`}>
          <svg
            class={styles.links}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {LINKS.map(([a, b]) => {
              const lit =
                (meta.upgrades[nodes[a].id] || 0) > 0 && meta.metaLevel >= nodes[b].unlock;
              return (
                <line
                  key={`${a}-${b}`}
                  x1={LAYOUT[a][0]}
                  y1={LAYOUT[a][1]}
                  x2={LAYOUT[b][0]}
                  y2={LAYOUT[b][1]}
                  data-lit={lit}
                  vector-effect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          {nodes.map((u, i) => {
            const st = nodeState(ui, u);
            const lv = meta.upgrades[u.id] || 0;
            const flash = ui.abilities.flash?.id === u.id ? ui.abilities.flash.key : undefined;
            return (
              <button
                key={u.id + (flash ?? '')}
                class={styles.node}
                style={{ left: `${LAYOUT[i][0]}%`, top: `${LAYOUT[i][1]}%` }}
                data-state={st}
                data-selected={u.id === selected.id}
                data-flash={flash !== undefined}
                data-upgrade={u.id}
                aria-pressed={u.id === selected.id}
                aria-label={`${u.id} ${u.name} ${lv}/${u.max} · ${st === 'locked' ? `메타 Lv.${u.unlock} 해금` : STATE_TEXT[st]}`}
                onClick={() => actions.pickNode(u.id)}
              >
                <span class={styles.icon} aria-hidden="true">
                  {st === 'locked' ? <LockIcon /> : u.icon}
                </span>
                <b>{u.name}</b>
                <small>
                  {st === 'locked'
                    ? `메타 Lv.${u.unlock} 해금`
                    : st === 'max'
                      ? 'MAX'
                      : `${lv}/${u.max}`}
                </small>
              </button>
            );
          })}
        </div>
        <Detail ui={ui} actions={actions} u={selected} />
      </div>
      {ui.metaDev && <DevPanel ui={ui} actions={actions} />}
    </section>
  );
}

function Detail({ ui, actions, u }: Props & { u: UpgradeDef }) {
  const lv = ui.meta.upgrades[u.id] || 0;
  const st = nodeState(ui, u);
  const reason =
    st === 'locked'
      ? `메타 Lv.${u.unlock}에 해금됩니다.`
      : st === 'max'
        ? '최대 단계입니다.'
        : st === 'short'
          ? '성장 포인트가 부족합니다.'
          : '1P를 써서 1단계 강화합니다.';
  return (
    <aside class={styles.detail} aria-label={`${u.name} 상세`} data-state={st}>
      <div class={styles.detailHead}>
        <span class={styles.icon} aria-hidden="true">
          {u.icon}
        </span>
        <div>
          <small>
            {u.id} · {U.branches.find((b) => b.id === u.branch)!.name} · 메타 Lv.{u.unlock} 해금
          </small>
          <h2>{u.name}</h2>
        </div>
        <strong class={styles.level}>{lv >= u.max ? 'MAX' : `${lv}/${u.max}`}</strong>
      </div>
      <dl class={styles.effects}>
        <dt>현재</dt>
        <dd>{lv ? U.effectText(u.id, lv) : '효과 없음(0단계)'}</dd>
        <dt>다음 단계</dt>
        <dd>{lv < u.max ? U.effectText(u.id, lv + 1) : '—'}</dd>
        <dt>비용</dt>
        <dd>1P (보유 {ui.meta.growthPoints}P)</dd>
      </dl>
      <ol class={styles.steps} aria-label="단계별 수치">
        {u.values.map((_, i) => (
          <li key={i} data-done={i < lv}>
            {i + 1}단계 · {U.effectText(u.id, i + 1)}
          </li>
        ))}
      </ol>
      {['S4', 'S5'].includes(u.id) && (
        <p class={styles.temp}>플레이 테스트 후 조정할 임시값입니다.</p>
      )}
      <p class={styles.reason} role="status">
        {reason}
      </p>
      <button class={styles.buy} disabled={st !== 'ready'} onClick={() => actions.buyUpgrade(u.id)}>
        {st === 'max' ? 'MAX' : st === 'locked' ? '잠김' : '강화하기 · 1P'}
      </button>
    </aside>
  );
}

/** 개발용(?metadev 테스트 프로필에서만 보임). 정식 프로필에는 쓰지 않는다 */
function DevPanel({ ui, actions }: Props) {
  const all = Object.fromEntries(U.upgrades.map((u) => [u.id, u.max]));
  return (
    <section class={styles.dev} aria-label="개발용 메타 설정">
      <b>개발 모드 · 테스트 프로필</b>
      {[1, 10, 20, 35, 50, 70, 100].map((l) => (
        <button key={l} onClick={() => actions.devSetMeta({ level: l })}>
          Lv.{l}
        </button>
      ))}
      <button onClick={() => actions.devSetMeta({ points: ui.meta.growthPoints + 10 })}>
        +10P
      </button>
      <button onClick={() => actions.devSetMeta({ tickets: ui.meta.tickets + 10 })}>+10티켓</button>
      <button onClick={() => actions.devSetMeta({ upgrades: {} })}>강화 초기화</button>
      <button onClick={() => actions.devSetMeta({ level: 100, upgrades: all })}>전부 MAX</button>
    </section>
  );
}
