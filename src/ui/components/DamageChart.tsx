// 아군 딜량 막대 그래프(v0.15.18 interaction-ui.js damageChart).
import { CharacterImage } from './CharacterImage.tsx';
import { unitDef } from '../data.ts';
import styles from './DamageChart.module.css';

export interface DamageRow {
  id: string;
  name?: string;
  star?: number;
  damage: number;
}

const num = (n: number) => Math.round(n).toLocaleString('ko-KR');

export function DamageChart({ rows, compact = false }: { rows: DamageRow[]; compact?: boolean }) {
  if (!rows.length) return <p class={styles.empty}>전투가 시작되면 아군 딜량을 표시합니다.</p>;
  const max = Math.max(1, ...rows.map((r) => r.damage));
  const total = rows.reduce((sum, r) => sum + Math.round(r.damage), 0);
  return (
    <div class={styles.chart} data-compact={compact} aria-label="아군 누적 피해량">
      {rows.map((r, i) => {
        const name = unitDef(r.id)?.name || r.name || r.id;
        return (
          <div key={i} class={styles.row}>
            <div class={styles.name}>
              <span class={styles.face}>
                <CharacterImage id={r.id} context="bench" />
              </span>
              <span>
                {name} <small>{'★'.repeat(r.star || 1)}</small>
              </span>
              <b>{num(r.damage)}</b>
            </div>
            <div
              class={styles.track}
              role="meter"
              aria-label={`${name} 딜량`}
              aria-valuemin={0}
              aria-valuemax={Math.ceil(max)}
              aria-valuenow={Math.round(r.damage)}
            >
              <i style={{ width: `${(r.damage / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
      <p class={styles.total}>
        아군 총 피해 <b>{num(total)}</b>
      </p>
    </div>
  );
}
