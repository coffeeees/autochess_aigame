// 선택한 캐릭터 상세: 능력치 10종(장비·증강 반영), 장비 3칸(아이템 놓을 곳), 스킬, 유대.
import D from '../../core/data/units.js';
import P from '../../core/progression.js';
import type { Stats, SkillDef } from '../../core/types.ts';
import { unitDef } from '../data.ts';
import { CharacterImage } from './CharacterImage.tsx';
import { ItemSlot } from './Items.tsx';
import type { GameProps } from './Game.tsx';
import styles from './UnitDetail.module.css';

const num = (n: number) => Math.round(n).toLocaleString('ko-KR');
const fmt = (key: string, v: number) =>
  ['CTH', 'CTC', 'DOD'].includes(key) ? num(v) + '%' : key === 'AS' ? v.toFixed(2) : num(v);

export function UnitDetail(props: GameProps) {
  const { ui, actions } = props;
  const run = ui.run!;
  const unit = run.units.find((u) => u.uid === ui.selected);
  if (!unit) return null;
  const def = unitDef(unit.id);
  const stats = P.previewStats(run, unit) as Stats;
  const skill = (D.skills as Record<string, SkillDef>)[unit.id];
  const items = run.inventory.filter((i) => i.equippedTo === unit.uid);
  const dropping = ui.drag?.active && ui.drag.kind === 'item';
  return (
    <aside class={styles.popover} role="dialog" aria-label={`${def.name} 상세`}>
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
      <div class={styles.stats}>
        {(D.statKeys as string[]).map((k) => (
          <span key={k}>
            {k}
            <b>{fmt(k, stats[k as keyof Stats])}</b>
          </span>
        ))}
      </div>
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
      <p class={styles.skill}>
        <strong>
          {skill.name} · {skill.coefficient}
        </strong>
        <br />
        {skill.text}
      </p>
      <p class={styles.bonds}>유대: {def.bonds.join(' · ')}</p>
    </aside>
  );
}
