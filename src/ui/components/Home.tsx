// 시작 화면(v0.15.18 #homeView).
import P from '../../core/progression.js';
import W from '../../core/encounters.js';
import type { Store, UiState } from '../store.ts';
import styles from './Home.module.css';

type Props = { ui: UiState; actions: Store['actions'] };

export function Home({ ui, actions }: Props) {
  return (
    <section class={styles.view}>
      <button class={styles.patch} onClick={() => actions.openOverlay({ kind: 'patch' })}>
        패치노트
      </button>
      <div class={styles.shell}>
        <span class={styles.eyebrow}>SINGLE PLAYER · FANTASY AUTO BATTLER</span>
        <h1 class={styles.title}>AUTOCHESS</h1>
        <p class={styles.subtitle}>동료를 모으고, 조합을 완성하고, 다음 전투로.</p>
        <div class={styles.metaPill}>
          <strong>메타 레벨 1</strong>
          <span>인게임 레벨과 별도 · 성장 규칙은 추후 적용</span>
        </div>
        {ui.view === 'difficulty' ? (
          <DifficultyPicker ui={ui} actions={actions} />
        ) : (
          <MainMenu ui={ui} actions={actions} />
        )}
        <p class={styles.footer}>테스트 프로토타입 · 진행은 이 브라우저에 저장됩니다.</p>
      </div>
    </section>
  );
}

function MainMenu({ ui, actions }: Props) {
  const run = ui.run;
  return (
    <section>
      <div class={styles.menu}>
        <button class={`${styles.card} ${styles.primary}`} onClick={actions.showDifficulty}>
          <span>⚔</span>
          <b>게임시작</b>
          <small>난이도를 선택하고 새로운 원정을 시작합니다.</small>
        </button>
        <button class={styles.card} disabled>
          <span>◇</span>
          <b>능력치</b>
          <small>준비 중 · 메타 레벨 기반 전체 성장</small>
        </button>
        <button class={styles.card} disabled>
          <span>✦</span>
          <b>뽑기</b>
          <small>준비 중 · 캐릭터 성장 콘텐츠</small>
        </button>
      </div>
      {ui.loadNotice && (
        <p class={styles.notice} role="status">
          {ui.loadNotice.text}
        </p>
      )}
      {ui.hasSave && run && (
        <button class={styles.continue} onClick={actions.continueRun}>
          <b>이어하기 →</b>
          <small>
            난이도 {run.difficulty} · {P.label(run)} · HP {run.health}
          </small>
        </button>
      )}
    </section>
  );
}

const sign = (n: number) => (n >= 0 ? '+' : '') + n;

/** 난이도 선택(v0.15.18 #difficultyScreen). */
function DifficultyPicker({ ui, actions }: Props) {
  const active = W.difficulty(ui.difficulty);
  return (
    <section aria-labelledby="difficulty-title">
      <div class={styles.difficultyTop}>
        <h2 id="difficulty-title">난이도 선택</h2>
        <button onClick={actions.showHome}>← 시작 화면</button>
      </div>
      <p class={styles.difficultyCopy}>
        적이 가하는 전투 피해와 시작 체력이 달라집니다. 인게임 레벨과 메타 레벨은 각각 별도로
        관리됩니다.
      </p>
      <div class={styles.choices}>
        {W.difficulties.map((d: any) => (
          <button
            key={d.level}
            aria-pressed={ui.difficulty === d.level}
            onClick={() => actions.chooseDifficulty(d.level)}
          >
            <b>{d.level}</b>
            <span>시작 HP {d.startingHealth}</span>
            <small>적 피해 {sign(d.damagePercent)}%</small>
          </button>
        ))}
      </div>
      <div class={styles.confirm}>
        <p>
          난이도 {active.level} · 시작 체력 {active.startingHealth} · 적이 가하는 피해{' '}
          {sign(active.damagePercent)}%
        </p>
        <button data-variant="primary" onClick={actions.startRun}>
          이 난이도로 시작 →
        </button>
      </div>
      <p class={styles.newRunNote}>
        현재 원정이 있다면 새 원정으로 교체됩니다. 시작 화면에서 ‘이어하기’를 누르면 기존 진행을
        유지합니다.
      </p>
    </section>
  );
}
