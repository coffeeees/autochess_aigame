// 관리자 화면(v0.23.0, 요청서 AUTOCHESS_COLLECTION_ADMIN_UPDATE_2026-11-25). 시작 화면의 「관리자」로 연다.
// - 왼쪽 메뉴는 modules.ts 등록표에서 만든다(이후 전투 수치·아이템·증강·확률/재화 같은 메뉴를 더할 자리).
// - 지금 동작하는 메뉴는 캐릭터 설정 하나. 설정은 이 브라우저의 IndexedDB에만 저장되고 다른 기기·서버에는 가지 않는다.
// - 원정·메타 저장과 게임 상태는 바꾸지 않는다. 뒤로·Esc는 시작 화면으로(저장하지 않은 변경이 있으면 먼저 묻는다).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameProps } from '../Game.tsx';
import { adminModules } from './modules.ts';
import { CharacterSettings, type CharacterControls } from './CharacterSettings.tsx';
import { useCardAssets } from '../../cardAssetStore.ts';
import { buildExportParts, download, exportFileName, ExportError } from '../../adminExport.ts';
import { compressForExport } from '../../imageEncode.ts';

/** 내보내기 파일 하나의 최대 크기(대화창 첨부 한도 안쪽, v0.26.1) */
const PART_BYTES = 25 * 1024 * 1024;
const mb = (n: number) => (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0) + 'MB';
import styles from './Admin.module.css';

type Props = Pick<GameProps, 'ui' | 'actions'>;

export function AdminPage({ ui, actions }: Props) {
  const [active, setActive] = useState('characters');
  // 저장하지 않은 변경이 있는 메뉴는 guard가 false를 돌려주고 스스로 확인을 띄운다
  const guard = useRef<(() => boolean) | null>(null);
  const dirty = useRef(false);
  // 캐릭터 설정의 한꺼번에 저장·취소(v0.26.3: 캐릭터마다 저장하지 않고 오른쪽 위에서 한 번에)
  const controls = useRef<CharacterControls | null>(null);
  const [pending, setPending] = useState<{ ids: string[]; busy: boolean }>({
    ids: [],
    busy: false,
  });
  const assets = useCardAssets();
  const count = Object.keys(assets.byId).length;
  const [exportMsg, setExportMsg] = useState('');
  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    setExportMsg('');
    try {
      const notes = (await import('../../../content/patch-notes.js')).default as {
        current: string;
      };
      setExportMsg('그림을 게임에 맞는 크기로 줄여 담는 중…');
      const now = new Date();
      const { parts, manifest, sourceBytes } = await buildExportParts(
        Object.values(assets.byId),
        notes.current,
        { now, maxPartBytes: PART_BYTES, encode: compressForExport },
      );
      const names = parts.map((p) => exportFileName(now, p.manifest.part));
      // 여러 파일이면 브라우저가 "여러 파일 다운로드 허용"을 물을 수 있다
      for (const [i, p] of parts.entries()) {
        download(p.zip, names[i]);
        if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 400));
      }
      const n = manifest.modules.characters.cards.length;
      const total = parts.reduce((t, p) => t + p.zip.length, 0);
      setExportMsg(
        `캐릭터 카드 ${n}명 · 그림 원본 ${mb(sourceBytes)} → 내보내기 ${mb(total)}` +
          (parts.length > 1
            ? ` · 25MB 이하 ${parts.length}개 파일로 나눔(${names.join(', ')}) — 모두 첨부해 주세요`
            : ` · ${names[0]}`) +
          (dirty.current ? ' · 저장하지 않은 지금 편집 중인 변경은 빠졌습니다' : ''),
      );
    } catch (e) {
      setExportMsg(
        e instanceof ExportError
          ? '내보내지 않았습니다(파일을 만들지 않음) — 고칠 곳: ' +
              e.problems.map((p) => `${p.characterId} ${p.field} ${p.message}`).join(' · ')
          : '내보내지 못했습니다: ' + (e as Error).message,
      );
    } finally {
      setExporting(false);
    }
  };
  const leave = () => {
    if (guard.current && !guard.current()) return;
    actions.showHome();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // Ctrl+S(맥은 ⌘+S): 한꺼번에 저장
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        controls.current?.saveAll();
        return;
      }
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
        <div class={styles.export}>
          <button data-variant="primary" disabled={!count || exporting} onClick={runExport}>
            내보내기{count ? `(${count}명)` : ''}
          </button>
          <small>
            {count
              ? '이 브라우저에 저장한 설정을 ZIP으로 받습니다(그림은 게임 크기로 줄이고, 크면 25MB 이하 여러 파일로 나눔). 대화창에 첨부하면 게임에 반영해 드립니다.'
              : '내보낼 설정이 없습니다(저장한 카드 설정이 있으면 켜집니다).'}
          </small>
          {exportMsg && <small role="status">{exportMsg}</small>}
        </div>
        <p class={styles.scope} role="note">
          테스트용 로컬 관리 화면 · 설정은 <b>이 브라우저에만</b> 저장되며 다른 PC·브라우저·배포
          서버에는 반영되지 않습니다.
        </p>
        <div class={styles.saveBar} aria-label="저장">
          <button
            data-variant="primary"
            disabled={!pending.ids.length || pending.busy}
            onClick={() => controls.current?.saveAll()}
            title="고친 캐릭터를 모두 저장(Ctrl+S)"
          >
            {pending.busy
              ? '저장 중…'
              : `저장${pending.ids.length ? `(${pending.ids.length}명)` : ''}`}
          </button>
          <button
            disabled={!pending.ids.length || pending.busy}
            onClick={() => controls.current?.cancelAll()}
          >
            모두 취소
          </button>
        </div>
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
            <CharacterSettings
              guard={guard}
              dirty={dirty}
              controls={controls}
              onDirty={(ids, busy) => setPending({ ids, busy })}
              onLeave={() => actions.showHome()}
            />
          )}
        </div>
      </div>
    </section>
  );
}
