// 전투 배속 버튼(1→2→4배)과 전투 중 실시간 아군 딜량 패널.
import V from '../../core/preparation.js';
import { DamageChart, type DamageRow } from './DamageChart.tsx';
import type { GameProps } from './Game.tsx';
import styles from './CombatControls.module.css';

export function SpeedButton({ ui, actions }: GameProps) {
  const lit = ui.speed === 1 ? 1 : ui.speed === 2 ? 2 : 3;
  return (
    <button
      class={styles.speed}
      onClick={actions.cycleSpeed}
      title={`전투 배속 · ${ui.speed}배`}
      aria-label={`전투 배속 ${ui.speed}배`}
    >
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden="true" data-lit={i <= lit}>
          ❯
        </span>
      ))}
    </button>
  );
}

export function LiveDamage({ ui }: GameProps) {
  if (!ui.battle) return null;
  const rows = V.damageRows(ui.battle) as DamageRow[];
  return (
    <section class={styles.panel}>
      <h2>아군 딜량</h2>
      <small>실시간 · 누적 피해</small>
      <DamageChart rows={rows} compact />
    </section>
  );
}
