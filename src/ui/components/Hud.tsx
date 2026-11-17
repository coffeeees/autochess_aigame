// 위 바: 이름, 현재 스테이지의 라운드 노드, 골드와 배치 인원, 메뉴.
import P from '../../core/progression.js';
import type { GameProps } from './Game.tsx';
import styles from './Hud.module.css';

const NODE_ICON: Record<string, string> = {
  SUPPLY: 'assets/ui/stage-supply-chest-64.png',
  BATTLE: 'assets/ui/stage-battle-swords-64.png',
  BOSS: 'assets/ui/stage-boss-mask-64.png',
};
const NODE_NAME: Record<string, string> = { SUPPLY: '안전 보급', BATTLE: '전투', BOSS: '보스' };

export function Hud({ ui, actions }: GameProps) {
  const run = ui.run!;
  const type = P.roundType(run.stage, run.round);
  const deployed = run.units.filter((u) => u.location === 'board').length;
  return (
    <header class={styles.hud}>
      <button class={styles.brand} onClick={actions.showHome} title="시작 화면">
        <i aria-hidden="true">✦</i>
        <span>
          AUTOCHESS<small>v0.15.18</small>
        </span>
      </button>
      <div class={styles.stage}>
        <div class={styles.label}>
          <b>{P.label(run)}</b>
          <span>{NODE_NAME[type]}</span>
        </div>
        <ol class={styles.track} aria-label={`스테이지 ${run.stage}`}>
          {[1, 2, 3, 4, 5].map((round) => {
            const nodeType = P.roundType(run.stage, round);
            const state = round < run.round ? 'done' : round === run.round ? 'current' : 'next';
            return (
              <li
                key={round}
                data-state={state}
                title={`${run.stage}-${round} · ${NODE_NAME[nodeType]}`}
              >
                <img src={NODE_ICON[nodeType]} alt={NODE_NAME[nodeType]} />
              </li>
            );
          })}
        </ol>
      </div>
      <div class={styles.wallet}>
        <b>{run.gold} G</b>
        <span>
          배치 {deployed} / {P.capacity(run)}
        </span>
      </div>
      <nav class={styles.menu} aria-label="메뉴">
        <button disabled title="다음 단계에서 연결">
          <img src="assets/ui/settings-gear-64.png" alt="" />
          설정
        </button>
        <button disabled title="다음 단계에서 연결">
          <img src="assets/ui/codex-book-64.png" alt="" />
          도감
        </button>
        <button disabled title="다음 단계에서 연결">
          <span aria-hidden="true">☷</span>
          더보기
        </button>
      </nav>
    </header>
  );
}
