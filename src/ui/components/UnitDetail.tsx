// 캐릭터 상세 창(v0.15.18 renderDetail / positionUnitPopover).
// - 준비 단계: 고른 원정 캐릭터의 능력치 10종(장비·증강 반영), 장비 3칸(아이템 놓을 곳), 스킬, 유대.
// - 전투 중(요청서 1): 누른 전투 유닛(아군·적군)의 현재 HP/MP, 현재 능력치, 상태이상과 남은 시간,
//   장비, 스킬, 유대 활성 인원·달성 단계. 전투 스냅샷마다 다시 그려 실시간으로 갱신되고, 전투는 멈추지 않는다.
// 창은 누른 캐릭터 옆에 띄우고 화면 밖으로 나가지 않게 위치를 보정한다.
import { useLayoutEffect, useRef } from 'preact/hooks';
import D from '../../core/data/units.js';
import P from '../../core/progression.js';
import A from '../../core/augments.js';
import W from '../../core/encounters.js';
import type { Stats, SkillDef } from '../../core/types.ts';
import { unitDef, type BondView } from '../data.ts';
import { itemIconSvg } from '../art/items.js';
import { CharacterImage } from './CharacterImage.tsx';
import { ItemSlot, itemDef } from './Items.tsx';
import type { GameProps } from './Game.tsx';
import styles from './UnitDetail.module.css';

const num = (n: number) => Math.round(n).toLocaleString('ko-KR');
const dodgeCap: number = D.prototypeConfig.combat.dodgeCap;
/** 회피는 실제 판정 값(상한 40%)을 보여 준다(v0.21.0). 넘친 합계는 StatGrid가 아래 줄에 적는다 */
const fmt = (key: string, v: number) =>
  key === 'DOD' && v > dodgeCap
    ? `${num(dodgeCap)}%`
    : ['CTH', 'CTC', 'DOD'].includes(key)
      ? num(Math.max(0, v)) + '%'
      : key === 'AS'
        ? v.toFixed(2)
        : num(v);
const skills = D.skills as Record<string, SkillDef>;

/** 기준점(누른 곳) 오른쪽에, 자리가 없으면 왼쪽에 띄우고 화면 안으로 보정(v0.15.18 positionInfo). */
export function placeNear(
  box: { width: number; height: number },
  anchor: { x: number; y: number },
  view: { width: number; height: number },
) {
  const margin = 8;
  const right = anchor.x + 37;
  const left = anchor.x - 37 - box.width;
  const x = right + box.width <= view.width - margin ? right : left;
  return {
    left: Math.max(margin, Math.min(view.width - box.width - margin, x)),
    top: Math.max(margin, Math.min(view.height - box.height - margin, anchor.y - 20)),
  };
}

/** 창 크기를 잰 뒤 기준점 옆으로 옮긴다(기준점이 없으면 전장 왼쪽 위). */
function useAnchored(anchor: GameProps['ui']['anchor']) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const r = el.getBoundingClientRect();
    const p = placeNear(r, anchor, { width: innerWidth, height: innerHeight });
    el.style.left = p.left + 'px';
    el.style.top = p.top + 'px';
  });
  return ref;
}

export function UnitDetail(props: GameProps) {
  if (props.ui.inspected !== null && (props.ui.battle || props.ui.finishing))
    return <BattleUnitDetail {...props} />;
  return <PrepareUnitDetail {...props} />;
}

function PrepareUnitDetail(props: GameProps) {
  const { ui, actions } = props;
  const run = ui.run!;
  const ref = useAnchored(ui.anchor);
  const unit = run.units.find((u) => u.uid === ui.selected);
  if (!unit) return null;
  const def = unitDef(unit.id);
  const stats = P.previewStats(run, unit) as Stats;
  const skill = skills[unit.id];
  const items = run.inventory.filter((i) => i.equippedTo === unit.uid);
  const dropping = ui.drag?.active && ui.drag.kind === 'item';
  const bonds = D.evaluateSynergies(run.units.filter((u) => u.location === 'board')) as BondView[];
  return (
    <aside
      ref={ref}
      class={styles.popover}
      data-anchored={!!ui.anchor}
      role="dialog"
      aria-label={`${def.name} 상세`}
      data-popup="unit"
    >
      <div class={styles.identity}>
        <span class={styles.portrait}>
          <CharacterImage id={unit.id} context="detail" />
        </span>
        <div>
          <span class={styles.temporary}>테스트용 제안</span>
          <h3>
            {def.name} <small>{'★'.repeat(unit.star)}</small>
          </h3>
          <span class={styles.tags}>
            {unit.id} · {def.race} / {def.job} / {def.trait}
          </span>
        </div>
        <button aria-label="상세 닫기" onClick={() => actions.select(null)}>
          ×
        </button>
      </div>
      <StatGrid stats={stats} />
      <section class={styles.equipment}>
        <div>
          <b>장비 {items.length} / 3</b>
          <small>드래그로 장착·이동·회수</small>
        </div>
        <div
          class={styles.equipGrid}
          data-item-drop={`unit:${unit.uid}`}
          data-over={dropping && ui.drag!.over === `unit:${unit.uid}`}
        >
          {Array.from({ length: 3 }, (_, i) =>
            items[i] ? (
              <ItemSlot key={items[i].uid} item={items[i]} {...props} />
            ) : (
              <span key={i} class={styles.emptySlot} aria-label="빈 장비 칸" />
            ),
          )}
        </div>
      </section>
      <SkillText skill={skill} />
      <BondLine names={def.bonds} bonds={bonds} />
      {(A.effects(run.augments, 'clone') as { pick: string }[]).some(
        (e) => e.pick === 'designated',
      ) && (
        <button
          class={styles.cloneButton}
          aria-pressed={run.augmentRun?.cloneTarget === unit.uid}
          onClick={() => actions.setCloneTarget(unit.uid)}
        >
          {run.augmentRun?.cloneTarget === unit.uid
            ? '✓ 전술 복제 분신 대상(누르면 해제)'
            : '전술 복제 분신 대상으로 지정'}
        </button>
      )}
    </aside>
  );
}

/** 전투 유닛 필드(core Battle의 units) 중 상세 창이 읽는 것 */
interface BattleUnit {
  uid: number;
  id: string;
  team: 'ally' | 'enemy';
  hp: number;
  mp: number;
  star?: number;
  dead?: boolean;
  summon?: boolean;
  summonKind?: string;
  name?: string;
  skillId?: string;
  itemIds?: string[];
  stats: Stats;
  shields?: { amount: number }[];
  statuses: { key: string; label?: string; expires: number }[];
}
interface BattleView {
  time: number;
  units: BattleUnit[];
  stats(u: BattleUnit): Stats;
  synergySnapshot?: Record<'ally' | 'enemy', BondView[]>;
}

function BattleUnitDetail({ ui, actions }: GameProps) {
  const battle = (ui.battle ?? ui.finishing) as unknown as BattleView;
  const ref = useAnchored(ui.anchor);
  const u = battle.units.find((x) => x.uid === ui.inspected);
  if (!u) return null;
  const spec = W.combatSpec(u.id) as { name: string; race: string; job: string; trait: string };
  const name = u.summon ? (u.name ?? spec.name) : spec.name;
  // 현재 적용 능력치(버프·디버프·유대·장비 반영). 계산에 실패하면 기본 능력치로
  let stats: Stats = u.stats;
  try {
    stats = battle.stats(u);
  } catch {
    stats = u.stats;
  }
  const fallen = u.dead || u.hp <= 0;
  const shield = (u.shields || []).reduce((n, s) => n + Math.max(0, s.amount), 0);
  const statuses = (u.statuses || []).filter((e) => e.expires > battle.time);
  const bonds = battle.synergySnapshot?.[u.team] ?? [];
  const ownBonds = unitDef(u.id)?.bonds ?? [];
  const skill = skills[u.skillId || u.id];
  return (
    <aside
      ref={ref}
      class={styles.popover}
      data-anchored={!!ui.anchor}
      role="dialog"
      aria-label={`${name} 전투 상세`}
      data-popup="inspect"
    >
      <div class={styles.identity}>
        <span class={styles.portrait}>
          <CharacterImage id={u.id} context="detail" />
        </span>
        <div>
          <span class={styles.temporary} data-team={u.team}>
            {u.team === 'ally' ? '아군' : '적군'} · 전투 중{fallen ? ' · 쓰러짐' : ''}
          </span>
          <h3>
            {name} <small>{'★'.repeat(u.star ?? 1)}</small>
          </h3>
          <span class={styles.tags}>
            {u.id} · {spec.race} / {spec.job} / {spec.trait}
          </span>
        </div>
        <button aria-label="상세 닫기" onClick={() => actions.inspect(null)}>
          ×
        </button>
      </div>
      <div class={styles.vitals}>
        <span>
          HP <b>{num(Math.max(0, u.hp))}</b> / {num(u.stats.HP)}
          {shield > 0 && <em> · 보호막 {num(shield)}</em>}
        </span>
        <i
          class={styles.hpBar}
          style={{ width: `${Math.max(0, Math.min(1, u.hp / u.stats.HP)) * 100}%` }}
        />
        <span>
          MP <b>{num(u.mp)}</b> / {num(u.stats.MP)}
        </span>
        <i
          class={styles.mpBar}
          style={{
            width: `${u.stats.MP ? Math.max(0, Math.min(1, u.mp / u.stats.MP)) * 100 : 0}%`,
          }}
        />
      </div>
      <StatGrid stats={stats} />
      <p class={styles.statuses}>
        {statuses.length
          ? statuses.map((e, i) => (
              <span key={e.key + i} class={styles.status}>
                {e.label ?? e.key} {Math.max(0, e.expires - battle.time).toFixed(1)}s
              </span>
            ))
          : '상태이상 없음'}
      </p>
      <section class={styles.equipment}>
        <div>
          <b>장비 {(u.itemIds || []).length} / 3</b>
        </div>
        <div class={styles.equipGrid}>
          {Array.from({ length: 3 }, (_, i) => {
            const id = u.itemIds?.[i];
            return id ? (
              <span
                key={i}
                class={styles.battleItem}
                title={itemDef(id).name}
                dangerouslySetInnerHTML={{ __html: itemIconSvg(id) }}
              />
            ) : (
              <span key={i} class={styles.emptySlot} aria-label="빈 장비 칸" />
            );
          })}
        </div>
      </section>
      {skill && <SkillText skill={skill} />}
      {ownBonds.length > 0 && <BondLine names={ownBonds} bonds={bonds} />}
    </aside>
  );
}

function StatGrid({ stats }: { stats: Stats }) {
  return (
    <div class={styles.stats}>
      {(D.statKeys as string[]).map((k) => (
        <span
          key={k}
          title={
            k === 'DOD' && stats.DOD > dodgeCap
              ? `회피 합계 ${num(stats.DOD)}% · 실제 판정은 최대 ${dodgeCap}%`
              : undefined
          }
        >
          {k}
          <b>{fmt(k, stats[k as keyof Stats])}</b>
          {k === 'DOD' && stats.DOD > dodgeCap && (
            <small class={styles.capped}>합 {num(stats.DOD)}% · 상한</small>
          )}
        </span>
      ))}
    </div>
  );
}

function SkillText({ skill }: { skill: SkillDef }) {
  return (
    <p class={styles.skill}>
      <strong>
        {skill.name} · {skill.coefficient}
      </strong>
      <br />
      {skill.text}
    </p>
  );
}

/** 유대: 이름 · 활성 인원 / 다음 단계 · 달성 단계 또는 미달성(전장 기준) */
function BondLine({ names, bonds }: { names: string[]; bonds: BondView[] }) {
  return (
    <p class={styles.bonds}>
      유대 ·{' '}
      {names.map((n, i) => {
        const b = bonds.find((x) => x.name === n);
        const count = b?.count ?? 0;
        const reached = b?.thresholds.filter((t) => count >= t).at(-1);
        return (
          <span key={n} data-active={!!reached}>
            {i > 0 && ' · '}
            {n} {count}명 {reached ? `· ${reached}명 단계` : '· 미달성'}
          </span>
        );
      })}
    </p>
  );
}
