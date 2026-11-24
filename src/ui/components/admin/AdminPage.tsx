// 관리자 화면(v0.23.0, 요청서 AUTOCHESS_COLLECTION_ADMIN_UPDATE_2026-11-25). 시작 화면의 「관리자」로 연다.
// - 왼쪽 메뉴는 modules.ts 등록표에서 만든다(이후 전투 수치·아이템·증강·확률/재화 같은 메뉴를 더할 자리).
// - 지금 동작하는 메뉴는 캐릭터 설정 하나. 설정은 이 브라우저의 IndexedDB에만 저장되고 다른 기기·서버에는 가지 않는다.
// - 원정·메타 저장과 게임 상태는 바꾸지 않는다. 뒤로·Esc는 시작 화면으로(저장하지 않은 변경이 있으면 먼저 묻는다).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameProps } from '../Game.tsx';
import { adminModules } from './modules.ts';
import { CharacterSettings } from './CharacterSettings.tsx';
import styles from './Admin.module.css';

type Props = Pick<GameProps, 'ui' | 'actions'>;

export function AdminPage({ ui, actions }: Props) {
  const [active, setActive] = useState('characters');
  // 저장하지 않은 변경이 있는 메뉴는 guard가 false를 돌려주고 스스로 확인을 띄운다
  const guard = useRef<(() => boolean) | null>(null);
  const leave = () => {
    if (guard.current && !guard.current()) return;
    actions.showHome();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || ui.overlay) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === 'INPUT') return; // 입력 중 Esc는 입력 칸에 맡김
      e.preventDefault();
      leave();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  return (
    <section class={styles.view} aria-label="관리자">
      <header class={styles.header}>
        <button class={styles.back} onClick={leave}>
          ← 시작 화면
        </button>
        <h1>관리자</h1>
        <p class={styles.scope} role="note">
          테스트용 로컬 관리 화면 · 설정은 <b>이 브라우저에만</b> 저장되며 다른 PC·브라우저·배포
          서버에는 반영되지 않습니다.
        </p>
      </header>
      <div class={styles.layout}>
        <nav class={styles.nav} aria-label="관리 메뉴">
          {adminModules.map((m) => (
            <button
              key={m.id}
              aria-current={active === m.id ? 'page' : undefined}
              disabled={!m.ready}
              onClick={() => setActive(m.id)}
            >
              <b>{m.label}</b>
              <small>{m.description}</small>
            </button>
          ))}
        </nav>
        <div class={styles.panel}>
          {active === 'characters' && (
            <CharacterSettings guard={guard} onLeave={() => actions.showHome()} />
          )}
        </div>
      </div>
    </section>
  );
}
