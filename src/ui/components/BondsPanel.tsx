// 왼쪽 유대(조합) 패널: 전장 배치 기준 유대 목록(발동 중인 것 먼저), 추천 표시,
// 누르면 상세(단계별 효과, 소속 동료, 추천 켜기/끄기).
import { useState } from 'preact/hooks';
import D from '../../core/data/units.js';
import { roster } from '../data.ts';
import type { GameProps } from './Game.tsx';
import styles from './BondsPanel.module.css';

interface BondView {
  id: string;
  name: string;
  concept: string;
  thresholds: number[];
  effects: string[];
  count: number;
  tier: number;
  members: string[];
}

export function BondsPanel({ ui, actions }: GameProps) {
  const run = ui.run!;
  const [open, setOpen] = useState(true);
  const [peek, setPeek] = useState<string | null>(null);
  const deployed = run.units.filter((u) => u.location === 'board');
  const all = D.evaluateSynergies(deployed) as BondView[];
  const shown = all
    .filter((b) => b.count > 0)
    .sort((a, b) => Number(b.tier > 0) - Number(a.tier > 0) || b.count - a.count);
  const recommended: string[] = run.recommendedBonds || [];
  const detail = all.find((b) => b.id === peek);
  return (
    <section class={styles.panel}>
      <header class={styles.head}>
        <h2>
          조합 <small>({shown.length})</small>
        </h2>
        <button
          aria-expanded={open}
          aria-label={`조합 패널 ${open ? '접기' : '펼치기'}`}
          onClick={() => setOpen(!open)}
        >
          {open ? '⌃' : '⌄'}
        </button>
      </header>
      {recommended.length > 0 && (
        <div class={styles.tray} aria-label="추천 유대">
          {recommended.map((id) => (
            <button
              key={id}
              title={`${id} 추천 해제`}
              onClick={() => actions.toggleRecommendation(id)}
            >
              ★ {id} ×
            </button>
          ))}
        </div>
      )}
      {open && (
        <ul class={styles.list}>
          {shown.length === 0 && (
            <li class={styles.empty}>동료를 배치하면 해당 조합이 표시됩니다.</li>
          )}
          {shown.map((b) => (
            <li key={b.id}>
              <button
                class={styles.bond}
                data-active={b.tier > 0}
                aria-expanded={peek === b.id}
                onClick={() => setPeek(peek === b.id ? null : b.id)}
              >
                <span class={styles.icon}>✦</span>
                <b>{b.name}</b>
                <span class={styles.count}>
                  {b.count} / {b.thresholds.find((t) => t > b.count) ?? b.thresholds.at(-1)}
                </span>
                <span class={styles.tiers} aria-hidden="true">
                  {b.thresholds.map((t) => (b.count >= t ? '★' : '☆')).join('')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {detail && (
        <aside class={styles.peek} role="dialog" aria-label={`유대 ${detail.name} 상세`}>
          <div class={styles.peekHead}>
            <h3>유대 {detail.name}</h3>
            <button aria-label="조합 상세 닫기" onClick={() => setPeek(null)}>
              ×
            </button>
          </div>
          <p>{detail.concept}</p>
          <button
            aria-pressed={recommended.includes(detail.id)}
            onClick={() => actions.toggleRecommendation(detail.id)}
          >
            {recommended.includes(detail.id) ? '★ 추천 해제' : '☆ 이 조합 추천'} ·{' '}
            {recommended.length} / 3
          </button>
          <ol class={styles.effects}>
            {detail.thresholds.map((t, i) => (
              <li key={t} data-achieved={detail.count >= t}>
                <b>{t}명</b> {detail.effects[i]}
              </li>
            ))}
          </ol>
          <p class={styles.members}>
            {roster()
              .filter((u) => u.bonds.includes(detail.name))
              .map((u) => (
                <span key={u.id} data-owned={run.units.some((x) => x.id === u.id)}>
                  {u.name}
                </span>
              ))}
          </p>
        </aside>
      )}
    </section>
  );
}
