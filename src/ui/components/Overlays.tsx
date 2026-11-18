// 덮개 창: 도감(메뉴, 캐릭터, 유대, 증강, 아이템), 캐릭터 정보, 패치노트, 플레이 방법,
// 임시 규칙, 새 원정 확인. 내용과 문구는 v0.15.18 catalog-ui / prototype / content-ui와 같다.
import { useEffect, useState } from 'preact/hooks';
import D from '../../core/data/units.js';
import V from '../../core/preparation.js';
import I from '../../core/items.js';
import A from '../../core/augments.js';
import type { Augment, Bond, SkillDef, UnitDef } from '../../core/types.ts';
import { roster, costColor } from '../data.ts';
import { itemIconSvg } from '../art/items.js';
import { CharacterImage } from './CharacterImage.tsx';
import { Shell } from './Modals.tsx';
import type { Overlay } from '../store.ts';
import type { GameProps } from './Game.tsx';
import styles from './Overlays.module.css';

type Props = Pick<GameProps, 'ui' | 'actions'>;

export function Overlays(props: Props) {
  const o = props.ui.overlay;
  if (!o) return null;
  const close = props.actions.closeOverlay;
  const body =
    o.kind === 'codex' ? (
      <Codex page={o.page} {...props} />
    ) : o.kind === 'character' ? (
      <CharacterInfo id={o.id} back={o.back} {...props} />
    ) : o.kind === 'patch' ? (
      <PatchNotes />
    ) : o.kind === 'guide' ? (
      <Guide />
    ) : o.kind === 'rules' ? (
      <Rules />
    ) : (
      <ResetConfirm {...props} />
    );
  return (
    <div class={styles.layer}>
      <Shell label="정보 창" onClose={close} popup="overlay">
        {body}
      </Shell>
    </div>
  );
}

function Back({ to, actions }: { to: Overlay; actions: Props['actions'] }) {
  return (
    <button class={styles.back} onClick={() => actions.openOverlay(to)}>
      ← 도감 메뉴
    </button>
  );
}

function Codex({ page, ui, actions }: Props & { page: string }) {
  if (page === 'characters') return <CharacterCodex ui={ui} actions={actions} />;
  if (page === 'bonds') return <BondCodex ui={ui} actions={actions} />;
  if (page === 'augments') return <AugmentCodex ui={ui} actions={actions} />;
  if (page === 'items') return <ItemCodex ui={ui} actions={actions} />;
  const all = roster();
  const open = (p: 'characters' | 'bonds' | 'augments' | 'items') => () =>
    actions.openOverlay({ kind: 'codex', page: p });
  return (
    <section>
      <span class={styles.eyebrow}>AUTOCHESS · COLLECTION</span>
      <h2>도감</h2>
      <div class={styles.menu}>
        <button onClick={open('characters')}>
          <b>캐릭터 도감</b>
          <span>
            {all.length}명 · 해금 {all.filter((u) => u.playable).length}명
          </span>
        </button>
        <button onClick={open('bonds')}>
          <b>유대 도감</b>
          <span>{(D.synergies as Bond[]).length}종 · 소속 동료와 추천</span>
        </button>
        <button onClick={open('augments')}>
          <b>증강 도감</b>
          <span>{(A.augments as Augment[]).length}종 · 등급과 효과</span>
        </button>
        <button onClick={open('items')}>
          <b>아이템 도감</b>
          <span>{I.items.length}종 · 능력치와 고유 효과</span>
        </button>
      </div>
    </section>
  );
}

function CharacterCodex({ ui, actions }: Props) {
  const run = ui.run;
  const pool: string[] = run ? V.shopPool(run) : [];
  const canRecruit = !!run && !ui.battle && !run.done && run.roundPhase === 'prepare';
  return (
    <section>
      <Back to={{ kind: 'codex', page: 'home' }} actions={actions} />
      <h2>캐릭터 도감 · {roster().length}명</h2>
      {[1, 2, 3, 4, 5].map((cost) => (
        <section key={cost} class={styles.costGroup}>
          <h3 class={styles.costDivider} style={{ '--cost-color': costColor(cost) }}>
            <span>{cost}코스트</span>
          </h3>
          <div class={styles.grid}>
            {roster()
              .filter((u) => u.cost === cost)
              .map((u) => (
                <div
                  key={u.id}
                  class={styles.rosterCard}
                  style={{ '--cost-color': costColor(cost) }}
                >
                  <span class={styles.portrait}>
                    <CharacterImage id={u.id} context="shop" />
                  </span>
                  <div>
                    <b>
                      {u.id} · {u.name}
                    </b>
                    <small>
                      {u.race} / {u.job} / {u.trait}
                    </small>
                    <small>유대 {u.bonds.join(' / ')}</small>
                    <small>
                      HP {u.stats.HP} · MP {u.stats.MP}
                    </small>
                    <div class={styles.cardButtons}>
                      <button
                        onClick={() =>
                          actions.openOverlay({
                            kind: 'character',
                            id: u.id,
                            back: { kind: 'codex', page: 'characters' },
                          })
                        }
                      >
                        상세
                      </button>
                      {run && (
                        <button
                          disabled={!canRecruit || !pool.includes(u.id)}
                          onClick={() => actions.freeRecruit(u.id)}
                        >
                          무료 테스트 영입
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function CharacterInfo({ id, back, actions }: Props & { id: string; back: Overlay | null }) {
  const u = D.byId(id) as unknown as UnitDef;
  const skill = (D.skills as Record<string, SkillDef>)[id];
  return (
    <section>
      {back && (
        <button class={styles.back} onClick={() => actions.openOverlay(back)}>
          ← 목록
        </button>
      )}
      <h2>
        {u.id} · {u.name}
      </h2>
      <span class={styles.temporary}>이름·능력치·스킬은 테스트용 제안</span>
      <div class={styles.bigPortrait}>
        <CharacterImage id={id} context="detail" />
      </div>
      <p>
        {u.race} / {u.job} / {u.trait} · {u.cost}G
        <br />
        유대 {u.bonds.join(' / ')}
      </p>
      <div class={styles.stats}>
        {(D.statKeys as string[]).map((k) => (
          <span key={k}>
            {k}
            <b>
              {u.stats[k as keyof UnitDef['stats']]}
              {['CTH', 'CTC', 'DOD'].includes(k) ? '%' : ''}
            </b>
          </span>
        ))}
      </div>
      <h3>
        {skill.name} · {skill.coefficient}
      </h3>
      <p>{skill.text}</p>
    </section>
  );
}

interface BondEval extends Bond {
  count: number;
  tier: number;
}

function BondCodex({ ui, actions }: Props) {
  const run = ui.run;
  const deployed = run ? run.units.filter((u) => u.location === 'board') : [];
  const bonds = D.evaluateSynergies(deployed) as BondEval[];
  const recommended: string[] = run?.recommendedBonds || [];
  return (
    <section>
      <Back to={{ kind: 'codex', page: 'home' }} actions={actions} />
      <h2>유대 도감 · 전체 조합 · {bonds.length}종</h2>
      {run && (
        <p role="status">추천 {recommended.length} / 3 · 선택한 버튼을 다시 누르면 해제됩니다.</p>
      )}
      <div class={styles.grid}>
        {bonds.map((b) => (
          <article key={b.id} class={styles.card} data-active={b.tier > 0}>
            <h3>{b.name}</h3>
            <small>
              전장 {b.count}명 · 단계 {b.thresholds.join(' / ')}
            </small>
            <p>{b.concept}</p>
            <ol>
              {b.thresholds.map((t, i) => (
                <li key={t} data-achieved={b.count >= t}>
                  {t}명 · {b.effects[i]}
                </li>
              ))}
            </ol>
            <small>
              {roster()
                .filter((u) => u.bonds.includes(b.name))
                .map((u) => u.name)
                .join(' · ')}
            </small>
            {run && (
              <button
                aria-pressed={recommended.includes(b.id)}
                onClick={() => actions.toggleRecommendation(b.id)}
              >
                {recommended.includes(b.id) ? '★ 추천 해제' : '☆ 추천'}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AugmentCodex({ ui, actions }: Props) {
  const tiers = A.tiers as Record<string, { name: string; color: string }>;
  const order: string[] = A.config.tierOrder;
  const chosen: string[] = ui.run?.augments || [];
  return (
    <section>
      <Back to={{ kind: 'codex', page: 'home' }} actions={actions} />
      <h2>증강 도감 · {(A.augments as Augment[]).length}종</h2>
      <p>
        정보를 확인하는 도감입니다. 실제 선택은 정해진 증강 단계에서 진행합니다. v0.16.0 1차
        후보안이라 수치는 검증 전 임시값입니다. 보류 표시는 후보로 나오지 않습니다.
      </p>
      {order.map((tier) => (
        <section key={tier}>
          <h3 style={{ color: tiers[tier].color }}>{tiers[tier].name}</h3>
          <div class={styles.grid}>
            {(A.augments as Augment[])
              .filter((a) => a.tier === tier)
              .map((a) => (
                <article
                  key={a.id}
                  class={styles.card}
                  style={{ '--card-line': tiers[tier].color }}
                >
                  <small>
                    {a.id}
                    {a.hold ? ' · 보류' : ''}
                    {chosen.includes(a.id) ? ' · 이번 원정 선택' : ''}
                  </small>
                  <h3>
                    {a.icon} {a.name}
                  </h3>
                  <p>{a.text}</p>
                </article>
              ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function ItemCodex({ ui, actions }: Props) {
  const inv = ui.run?.inventory || [];
  return (
    <section>
      <Back to={{ kind: 'codex', page: 'home' }} actions={actions} />
      <h2>아이템 도감 · {I.items.length}종</h2>
      <p>
        티어별 능력치와 고유 효과를 확인합니다. 장착·해제는 실제 보관함과 캐릭터 정보창에서
        진행합니다.
      </p>
      {[1, 2, 3].map((tier) => (
        <section key={tier}>
          <h3>{tier}티어</h3>
          <div class={styles.grid}>
            {(
              I.items as {
                id: string;
                name: string;
                tier: number;
                statsText: string;
                effect: string;
              }[]
            )
              .filter((i) => i.tier === tier)
              .map((i) => (
                <article key={i.id} class={styles.card} data-tier={tier}>
                  <div class={styles.itemHead}>
                    <span dangerouslySetInnerHTML={{ __html: itemIconSvg(i.id) }} />
                    <div>
                      <small>
                        {i.id} · {tier}티어
                      </small>
                      <h3>{i.name}</h3>
                    </div>
                  </div>
                  <b>{i.statsText}</b>
                  {i.effect && <p>{i.effect.replace(/\*\*([^*]+)\*\*/g, '$1')}</p>}
                  <small>보유 {inv.filter((x) => x.id === i.id).length}개</small>
                </article>
              ))}
          </div>
        </section>
      ))}
    </section>
  );
}

interface PatchEntry {
  version: string;
  title: string;
  changes: string[];
  note?: string;
  approvedDecisions?: string[];
  additionalChanges?: string[];
  notificationChanges?: string[];
}
interface PatchApi {
  current: string;
  history: PatchEntry[];
  currentRules: string;
  toMarkdown(): string;
}

/** 패치노트: 데이터(90KB)는 창을 열 때만 불러온다. */
/** 재구축 변경 사항(src/content/rebuild-changes.js) */
interface RebuildChange {
  area: string;
  kind: string;
  title: string;
  before: string;
  after: string;
}
interface RebuildApi {
  base: string;
  kinds: string[];
  changes: RebuildChange[];
  toMarkdown(): string;
}

/** 밸런스 테스트 기록(src/content/balance-tests.js) */
interface BalanceCandidate {
  id: string;
  name: string;
  effect: string;
  verdict: string;
  related: string;
  note: string;
  status: string;
  test: string;
}
interface BalanceApi {
  augment54: {
    title: string;
    date: string;
    stage: string;
    method: string;
    environment: string;
    scope: string;
    notRun: string[];
    currentRules: string[];
    verdicts: string[];
    candidates: BalanceCandidate[];
    idConflict: string;
    currentBehavior: string[];
    decisions: string[];
    plan: [string, string][];
  };
  counts(list: BalanceCandidate[], key: keyof BalanceCandidate): Record<string, number>;
  toMarkdown(): string;
}

/** 클립보드 복사·MD 파일 저장(패치노트 탭들이 함께 씀) */
function exportActions(markdown: () => string, filename: string, setStatus: (s: string) => void) {
  return {
    copy: async () => {
      try {
        await navigator.clipboard.writeText(markdown());
        setStatus('복사 완료');
      } catch {
        setStatus('복사하지 못했습니다. MD 파일 저장을 이용하세요.');
      }
    },
    download: () => {
      const url = URL.createObjectURL(
        new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}

function PatchNotes() {
  const [data, setData] = useState<{
    notes: PatchApi;
    auditHtml: string;
    rebuild: RebuildApi;
    balance: BalanceApi;
  } | null>(null);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'history' | 'rebuild' | 'balance'>('history');
  useEffect(() => {
    let alive = true;
    Promise.all([
      import('../../content/patch-notes.js'),
      import('../../content/notice-audit.js'),
      import('../../content/rebuild-changes.js'),
      import('../../content/balance-tests.js'),
    ]).then(
      ([n, a, r, t]) =>
        alive &&
        setData({
          notes: n.default as PatchApi,
          auditHtml: a.default.toHTML(),
          rebuild: r.default as RebuildApi,
          balance: t.default as BalanceApi,
        }),
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!data) return <p>패치노트를 불러오는 중…</p>;
  const { notes } = data;
  const latest = notes.history.at(-1)!;
  const { copy, download } = exportActions(
    () => notes.toMarkdown(),
    'AUTOCHESS_PATCH_NOTES_v' + notes.current + '.md',
    setStatus,
  );
  const pick = (next: typeof tab) => {
    setTab(next);
    setStatus('');
  };
  return (
    <div class={styles.patch}>
      <span class={styles.eyebrow}>AUTOCHESS · PROTOTYPE {notes.current}</span>
      <h2>패치노트</h2>
      <div class={styles.tabs} role="tablist" aria-label="패치노트 보기">
        <button role="tab" aria-selected={tab === 'history'} onClick={() => pick('history')}>
          버전 기록
        </button>
        <button role="tab" aria-selected={tab === 'rebuild'} onClick={() => pick('rebuild')}>
          재구축 변경 사항 <small>{data.rebuild.changes.length}</small>
        </button>
        <button role="tab" aria-selected={tab === 'balance'} onClick={() => pick('balance')}>
          밸런스 테스트
        </button>
      </div>
      {tab === 'balance' ? (
        <BalanceTests balance={data.balance} />
      ) : tab === 'rebuild' ? (
        <RebuildChanges rebuild={data.rebuild} />
      ) : (
        <PatchHistory
          notes={notes}
          latest={latest}
          auditHtml={data.auditHtml}
          copy={copy}
          download={download}
          status={status}
        />
      )}
    </div>
  );
}

function PatchHistory({
  notes,
  latest,
  auditHtml,
  copy,
  download,
  status,
}: {
  notes: PatchApi;
  latest: PatchEntry;
  auditHtml: string;
  copy: () => void;
  download: () => void;
  status: string;
}) {
  return (
    <>
      <p>
        버전별 추가·수정 내역과 현재 규칙을 정리했습니다. 아래 내용을 복사해 ChatGPT 기획 대화에
        전달하세요.
      </p>
      <div class={styles.patchActions}>
        <button data-variant="primary" onClick={copy}>
          ChatGPT 전달용 전체 복사
        </button>
        <button onClick={download}>MD 파일 저장</button>
        <span role="status">{status}</span>
      </div>
      <section>
        <h3>이번 수정사항 · v{notes.current}</h3>
        <ul>
          {latest.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>
      <Decisions entry={latest} />
      {/* 알림 조사표는 고정 데이터로 만든 HTML(값은 escape됨) */}
      <div dangerouslySetInnerHTML={{ __html: auditHtml }} />
      <details>
        <summary>현재 적용 규칙 · 미구현 사항</summary>
        <pre class={styles.pre}>{notes.currentRules}</pre>
      </details>
      <div>
        {notes.history
          .slice()
          .reverse()
          .map((entry) => (
            <details key={entry.version} open={entry.version === notes.current}>
              <summary>
                <b>v{entry.version}</b> {entry.title}
              </summary>
              <ul>
                {entry.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              {entry.note && <p>{entry.note}</p>}
              {entry.additionalChanges && <Decisions entry={entry} />}
            </details>
          ))}
      </div>
    </>
  );
}

/** 재구축 변경 사항 탭: 원본 v0.15.18과 기능·표시가 달라진 점(영역별, 종류 걸러 보기). */
function RebuildChanges({ rebuild }: { rebuild: RebuildApi }) {
  const [kind, setKind] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const { copy, download } = exportActions(
    () => rebuild.toMarkdown(),
    'AUTOCHESS_REBUILD_CHANGES.md',
    setStatus,
  );
  const shown = rebuild.changes.filter((c) => !kind || c.kind === kind);
  const areas = [...new Set(shown.map((c) => c.area))];
  return (
    <>
      <p>
        코드를 옮기면서(재구축) 원본 {rebuild.base}과 기능·표시가 달라진 점입니다. 소스 구조만 바뀐
        것은 빼고, 플레이할 때 달라지는 것만 적었습니다.
      </p>
      <div class={styles.patchActions}>
        <button data-variant="primary" onClick={copy}>
          기획용 전체 복사
        </button>
        <button onClick={download}>MD 파일 저장</button>
        <span role="status">{status}</span>
      </div>
      <div class={styles.kindFilter} aria-label="종류로 걸러 보기">
        <button aria-pressed={kind === null} onClick={() => setKind(null)}>
          전체 {rebuild.changes.length}
        </button>
        {rebuild.kinds.map((k) => (
          <button key={k} aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>
            {k} {rebuild.changes.filter((c) => c.kind === k).length}
          </button>
        ))}
      </div>
      {areas.map((area) => (
        <section key={area} class={styles.rebuildArea}>
          <h3>{area}</h3>
          <ul class={styles.rebuildList}>
            {shown
              .filter((c) => c.area === area)
              .map((c) => (
                <li key={c.title}>
                  <b>
                    <span class={styles.kindTag} data-kind={c.kind}>
                      {c.kind}
                    </span>{' '}
                    {c.title}
                  </b>
                  <dl>
                    <dt>원본</dt>
                    <dd>{c.before}</dd>
                    <dt>지금</dt>
                    <dd>{c.after}</dd>
                  </dl>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Decisions({ entry }: { entry: PatchEntry }) {
  const groups: [string, keyof PatchEntry][] = [
    ['사용자 승인한 세부 결정', 'approvedDecisions'],
    ['Codex 판단으로 추가·조정한 사항', 'additionalChanges'],
    ['알림·팝업·표시 조건 변경', 'notificationChanges'],
  ];
  return (
    <section>
      <h3>요청 외 판단·알림 변경 기록</h3>
      {groups.map(([title, key]) => {
        const list = (entry[key] as string[] | undefined) || [];
        return (
          <div key={key}>
            <h4>{title}</h4>
            <ul>
              {list.length ? list.map((n, i) => <li key={i}>{n}</li>) : <li>별도 기록 없음</li>}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Guide() {
  return (
    <section>
      <h3>스테이지 진행</h3>
      <p>
        1-1·1-2는 안전 보급입니다. 5번째 라운드는 항상 보스이며, 1-3·3-3·5-3 진입 직전에 증강을
        선택합니다. 레벨3에서 시작해 배치 한도는 레벨과 같습니다. 4G로4XP를 구매하고 최대 레벨10까지
        올릴 수 있습니다. 보관함의 아이템은 준비 단계에 장착·해제합니다. 전체 조합에서 최대3개의
        추천을 선택하면 영입창에서 해당 조합만 강조합니다. 보유한3성 캐릭터는 상점에서 제외되며
        판매하면 다시 등장할 수 있습니다.
      </p>
      <h2>AUTOCHESS 플레이 방법</h2>
      <ol>
        <li>
          상점에서 코스트에 맞는 골드로 동료를 구매하거나, 캐릭터 도감에서 무료 테스트 영입하세요.
        </li>
        <li>
          캐릭터를 클릭하면 능력치와 장비가 표시됩니다. 드래그하여 전장/대기석으로 이동하세요.
        </li>
        <li>아군 위에 놓으면 서로 교체합니다. 동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.</li>
        <li>
          배속 옆 동료영입 버튼으로 상점을 열 수 있습니다. 보관함 아이템은 아군에게 드래그하여
          최대3개 장착합니다.
        </li>
        <li>
          같은 ID·같은 성급 3명은 자동 합성됩니다. HP/AD/AP가 성급마다 2배로 증가하는 임시
          규칙입니다.
        </li>
        <li>
          시작 MP 100%를 켜면 스킬을 빠르게 시험할 수 있습니다. 실제 전투 기본값은 MP 0입니다.
        </li>
        <li>
          유대는 시작 진형 기준으로 고정됩니다. 16종 유대 임시 밸런스 v1의 가장 높은 달성 단계
          효과가 적용됩니다.
        </li>
        <li>전투 중 캐릭터를 클릭해 현재 상태를 확인하세요.</li>
      </ol>
      <p>
        일반 공격은 마법 계열도 AD 물리 피해입니다. 설정과 소환수의 세부 임시 수치는 ‘임시 규칙’에서
        볼 수 있습니다.
      </p>
    </section>
  );
}

function Rules() {
  const C = D.prototypeConfig as {
    todos: string[];
    experimentalSynergyEffects: { notice: string };
  };
  return (
    <section>
      <h2>테스트용 임시 규칙</h2>
      <p>
        아래 수치는 확정 밸런스가 아닙니다. 16종 유대의 임시 밸런스 v1 효과는 항상 적용됩니다.
        종족·직업·특성은 캐릭터 메타데이터이며 이전 28종 수치 효과는 적용하지 않습니다.
      </p>
      <ul>
        {C.todos.map((t, i) => (
          <li key={i}>TODO · {t}</li>
        ))}
      </ul>
      <h3>기본 전투</h3>
      <p>
        피해 = 원시 피해 × 100 / (100 + GD). 물리·마법 공통 적용.
        <br />
        공격 시 MP +12, 피격 시 +6. 마법 계열은 1.5배. 기본 시작 MP 0, 시전 시 MP 0으로 초기화.
        <br />
        기본 공격만 일반 치명타·회피 적용. 스킬 중 C04는 별도 치명타 규칙 사용.
        <br />
        7×8 전장, 4방향 BFS 이동, 동일 시전자·동일 상태는 지속시간 갱신.
        <br />
        공격·스킬은 uid 순서로 처리. 패배·시간초과 모두 원정대 체력 감소.
      </p>
      <h3>실험용 유대 효과 설정</h3>
      <p>
        {C.experimentalSynergyEffects.notice} 상위 단계 하나만 적용합니다. 상세 효과는 유대 도감에서
        확인하세요.
      </p>
      <pre class={styles.pre}>{JSON.stringify(D.prototypeConfig, null, 2)}</pre>
    </section>
  );
}

function ResetConfirm({ actions }: Props) {
  return (
    <section>
      <h2>새 원정을 시작할까요?</h2>
      <p>현재 진행·장비·증강·레벨을 새 원정으로 교체합니다. 다음 화면에서 난이도를 고릅니다.</p>
      <div class={styles.cardButtons}>
        <button onClick={actions.closeOverlay}>취소</button>
        <button data-variant="primary" onClick={actions.confirmNewRun}>
          새 원정 시작
        </button>
      </div>
    </section>
  );
}

/** 밸런스 테스트 탭: 테스트 방법·범위·미실행 항목·증강별 판정·결정 사항(실행하지 않은 테스트는 미실행으로 표시). */
function BalanceTests({ balance }: { balance: BalanceApi }) {
  const t = balance.augment54;
  const [verdict, setVerdict] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const { copy, download } = exportActions(
    () => balance.toMarkdown(),
    'AUTOCHESS_BALANCE_TEST_AUGMENT54.md',
    setStatus,
  );
  const counts = balance.counts(t.candidates, 'verdict');
  const shown = t.candidates.filter((c) => !verdict || c.verdict === verdict);
  return (
    <>
      <h3>{t.title}</h3>
      <dl class={styles.balanceMeta}>
        <dt>단계</dt>
        <dd>
          {t.stage} · {t.date}
        </dd>
        <dt>테스트 방법</dt>
        <dd>{t.method}</dd>
        <dt>실행 환경</dt>
        <dd>{t.environment}</dd>
        <dt>완료 범위</dt>
        <dd>{t.scope}</dd>
      </dl>
      <div class={styles.patchActions}>
        <button data-variant="primary" onClick={copy}>
          기획용 전체 복사
        </button>
        <button onClick={download}>MD 파일 저장</button>
        <span role="status">{status}</span>
      </div>
      <details open>
        <summary>실행하지 않은 테스트 {t.notRun.length}</summary>
        <ul>
          {t.notRun.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
      <details open>
        <summary>결정이 필요한 사항 {t.decisions.length}</summary>
        <ol>
          {t.decisions.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </details>
      <details>
        <summary>ID 충돌 · 현재 선택 규칙 대조 · 현재 코드 동작</summary>
        <p>{t.idConflict}</p>
        <ul>
          {[...t.currentRules, ...t.currentBehavior].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
      <div class={styles.kindFilter} aria-label="판정으로 걸러 보기">
        <button aria-pressed={verdict === null} onClick={() => setVerdict(null)}>
          전체 {t.candidates.length}
        </button>
        {t.verdicts
          .filter((v) => counts[v])
          .map((v) => (
            <button
              key={v}
              aria-pressed={verdict === v}
              onClick={() => setVerdict(verdict === v ? null : v)}
            >
              {v} {counts[v]}
            </button>
          ))}
      </div>
      <div class={styles.balanceTable}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>이름 · 후보 효과</th>
              <th>판정</th>
              <th>구현 · 테스트</th>
              <th>관련 현재 증강 · 메모</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>
                  <b>{c.name}</b>
                  <br />
                  {c.effect}
                </td>
                <td>
                  <span class={styles.kindTag} data-verdict={c.verdict}>
                    {c.verdict}
                  </span>
                </td>
                <td>
                  {c.status}
                  <br />
                  <small>{c.test}</small>
                </td>
                <td>
                  <small>{c.related}</small>
                  <br />
                  {c.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>구현 묶음과 예상 작업량(합의 후 진행)</summary>
        <ul>
          {t.plan.map(([what, size]) => (
            <li key={what}>
              <b>[{size}]</b> {what}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
