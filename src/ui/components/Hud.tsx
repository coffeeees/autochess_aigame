// 위 바: 이름, 현재 스테이지의 라운드 노드, 골드와 배치 인원, 메뉴.
import P from '../../core/progression.js';
import W from '../../core/encounters.js';
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
          AUTOCHESS<small>v0.26.5</small>
        </span>
      </button>
      <div class={styles.stage}>
        <div class={styles.label}>
          <b>{P.label(run)}</b>
          <span>
            {ui.battle
              ? '자동 전투 중'
              : run.roundPhase === 'result'
                ? '라운드 완료'
                : NODE_NAME[type]}
          </span>
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
        <button
          aria-expanded={ui.popover === 'settings'}
          data-popup-trigger="settings"
          onClick={() => actions.setPopover('settings')}
        >
          <span class={styles.menuIcon}>
            <img src="assets/ui/settings-gear-64.png" alt="" />
          </span>
          설정
        </button>
        <button onClick={() => actions.openOverlay({ kind: 'codex', page: 'home' })}>
          <span class={styles.menuIcon}>
            <img src="assets/ui/codex-book-64.png" alt="" />
          </span>
          도감
        </button>
        <button
          aria-expanded={ui.popover === 'more'}
          data-popup-trigger="more"
          onClick={() => actions.setPopover('more')}
        >
          <span class={styles.menuIcon} aria-hidden="true">
            {/* v0.15.18의 ☷ 모양을 다른 아이콘과 같은 크기로 그림 */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="4" width="7.5" height="3" rx="1" />
              <rect x="13.5" y="4" width="7.5" height="3" rx="1" />
              <rect x="3" y="10.5" width="18" height="3" rx="1" />
              <rect x="3" y="17" width="7.5" height="3" rx="1" />
              <rect x="13.5" y="17" width="7.5" height="3" rx="1" />
            </svg>
          </span>
          더보기
        </button>
      </nav>
      {ui.popover === 'settings' && <SettingsPopover ui={ui} actions={actions} />}
      {ui.popover === 'more' && <MorePopover ui={ui} actions={actions} />}
    </header>
  );
}

/** 설정 창(v0.15.18 #settingsPopover). 전투 시작 진단 로그는 개발용이라 옮기지 않았다. */
function SettingsPopover({ ui, actions }: GameProps) {
  const run = ui.run!;
  const d = W.difficulty(run.difficulty) as { level: number; damagePercent: number };
  const streakCap = (P.config as { rewards: { streakCap: number } }).rewards.streakCap;
  return (
    <section class={styles.popover} role="dialog" aria-label="게임 설정" data-popup="settings">
      <div class={styles.popoverHead}>
        <b>게임 설정</b>
        <button aria-label="설정 닫기" onClick={() => actions.setPopover(null)}>
          ×
        </button>
      </div>
      <p class={styles.modifiers}>
        <span>
          난이도 {d.level} · 적 피해 {d.damagePercent >= 0 ? '+' : ''}
          {d.damagePercent}%
        </span>
        <span>
          {run.winStreak || 0}연승 · 다음 승리 보너스 +
          {Math.min(streakCap, (run.winStreak || 0) + 1)}G
        </span>
      </p>
      <div class={styles.section}>
        <b>테스트 설정 (임시)</b>
        <label>
          <input
            type="checkbox"
            checked={ui.quickMana}
            onChange={(e) => actions.setRule('quickMana', (e.target as HTMLInputElement).checked)}
          />{' '}
          시작 MP 100% · 스킬 바로 시험
        </label>
        <small>16종 유대 임시 밸런스 v1 · 항상 적용</small>
      </div>
      <div class={styles.section}>
        <b>테스트용 임시 규칙</b>
        <p>
          일반 3G / 1G · 보스 5G / 3G
          <br />
          10G당 이자 +1G · 최대 5G
          <br />
          승리마다 연승 +1G · 최대 5G
          <br />
          같은 성급 3명 → 자동 합성
          <br />
          레벨 = 기본 배치 한도 · P12 선택 시 +1
        </p>
      </div>
      <div class={styles.actions}>
        <button onClick={() => actions.openOverlay({ kind: 'rules' })}>전체 임시 규칙</button>
        <button onClick={() => actions.openOverlay({ kind: 'guide' })}>플레이 방법</button>
        <button onClick={() => actions.openOverlay({ kind: 'patch' })}>패치노트</button>
      </div>
    </section>
  );
}

/** 더보기 창(v0.15.18 #morePopover). 전투 기록·디버그 표는 개발용이라 옮기지 않았다. */
function MorePopover({ actions }: GameProps) {
  return (
    <section class={styles.popover} role="dialog" aria-label="더보기" data-popup="more">
      <div class={styles.popoverHead}>
        <b>원정 메뉴</b>
        <button aria-label="더보기 닫기" onClick={() => actions.setPopover(null)}>
          ×
        </button>
      </div>
      <div class={styles.actions}>
        <button onClick={actions.showHome}>시작 화면</button>
        <button onClick={() => actions.openOverlay({ kind: 'codex', page: 'bonds' })}>
          전체 조합
        </button>
        <button onClick={() => actions.openOverlay({ kind: 'patch' })}>패치노트</button>
        <button onClick={() => actions.openOverlay({ kind: 'reset' })}>새 원정</button>
        <button onClick={() => actions.openOverlay({ kind: 'codex', page: 'characters' })}>
          테스트 무료 영입
        </button>
        <button onClick={() => actions.openOverlay({ kind: 'collection', card: null })}>
          컬렉션
        </button>
      </div>
    </section>
  );
}
