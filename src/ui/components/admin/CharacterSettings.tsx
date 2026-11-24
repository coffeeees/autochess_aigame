// 관리자 › 캐릭터 설정(v0.23.0). 왼쪽 캐릭터 목록·검색 → 가운데 표시 이름·배경·인물 그림 → 오른쪽 카드 미리보기.
// - 캐릭터 목록은 기존 명단(C01~C45)에서 만든다. 표시 이름은 카드 전용 오버라이드라 상점·전장·전투·도감 이름은 그대로.
// - 그림은 PNG·JPG·WebP만(파일 앞부분으로 판정, 10MB 이하), 깨진 그림은 거절. 캐릭터 그림은 투명 배경을 확인해 안내한다.
// - 고친 내용은 「저장」 전까지 미리보기에만 보이고(저장 전/저장된 상태를 따로 보여 줌), 「취소」로 되돌린다.
//   「초기화」는 이 캐릭터의 설정만 지운다(확인 뒤). 저장은 IndexedDB(ui/cardAssetStore.ts).
// - 그림을 등록해도 컬렉션 보유로 치지 않는다.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import S, {
  type CardImageSlot,
  type CardSettings,
  type StoredImage,
} from '../../../core/card-settings.ts';
import D from '../../../core/data/units.js';
import { costColor } from '../../data.ts';
import { cardAssets, useBlobUrl, useCardAssets } from '../../cardAssetStore.ts';
import { bakedSettings, cardStatus, type CardStatus } from '../../bakedCards.ts';
import { bakedCard } from '../../art/cards.ts';
import { AnimatedCard, CardFace, useCardViewData } from '../CardView.tsx';
import styles from './Admin.module.css';

type RosterUnit = { id: string; name: string; cost: number };
const roster = D.roster as unknown as RosterUnit[];

interface Draft {
  name: string;
  background: StoredImage | null;
  character: StoredImage | null;
}
type Confirm = { kind: 'reset' } | { kind: 'switch'; to: string } | { kind: 'leave' } | null;

const fromSaved = (id: string, s?: CardSettings): Draft => ({
  name: s?.displayNameOverride ?? roster.find((u) => u.id === id)!.name,
  background: s?.backgroundImage ?? null,
  character: s?.characterImage ?? null,
});

/** 올린 파일 읽기: 형식·크기 검사 → 디코드(깨진 그림 거절) → 크기·투명 가장자리 확인 */
async function readImage(
  file: File,
  slot: CardImageSlot,
): Promise<{ image: StoredImage; warnings: string[] } | { error: string }> {
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { error: '파일을 읽지 못했습니다.' };
  }
  const checked = S.checkUpload(new Uint8Array(buf.slice(0, 16)), file.size);
  if (!checked.ok) return { error: checked.error };
  const blob = new Blob([buf], { type: S.mimeOf[checked.format] });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return { error: '그림을 열 수 없습니다(깨졌거나 지원하지 않는 그림).' };
  }
  const { width, height } = bitmap;
  let opaqueEdges = false;
  if (slot === 'character' && checked.format !== 'jpeg') {
    // 가장자리 픽셀의 90% 넘게 불투명하면 배경이 남아 있다고 본다
    const n = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, n, n);
      const px = ctx.getImageData(0, 0, n, n).data;
      let edge = 0,
        solid = 0;
      for (let i = 0; i < n; i++)
        for (const [x, y] of [
          [i, 0],
          [i, n - 1],
          [0, i],
          [n - 1, i],
        ]) {
          edge++;
          if (px[(y * n + x) * 4 + 3] > 240) solid++;
        }
      opaqueEdges = solid / edge > 0.9;
    }
  }
  bitmap.close();
  return {
    image: { blob, format: checked.format, name: file.name, size: file.size, width, height },
    warnings: S.imageWarnings(slot, { format: checked.format, width, height, opaqueEdges }),
  };
}

export function CharacterSettings({
  guard,
  dirty: dirtyRef,
  onLeave,
}: {
  guard: RefObject<(() => boolean) | null>;
  dirty?: RefObject<boolean>;
  onLeave: () => void;
}) {
  const assets = useCardAssets();
  const [selected, setSelected] = useState('C01');
  const [query, setQuery] = useState('');
  const saved = assets.byId[selected];
  // 반영본(게임 파일)을 편집 출발점으로 받아 온 것. 브라우저 설정이 없으면 이것이 기준 상태다
  const [baked, setBaked] = useState<{ id: string; settings: CardSettings | null } | null>(null);
  const bakedBase = baked?.id === selected ? baked.settings : null;
  const loadingBaked = !!bakedCard(selected) && baked?.id !== selected;
  const base = saved ?? bakedBase ?? undefined;
  const [draft, setDraft] = useState<Draft>(() => fromSaved(selected, saved));
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<Partial<Record<CardImageSlot, string[]>>>({});
  const [busy, setBusy] = useState(false);

  // 저장소를 처음 읽어 오면(또는 다른 캐릭터로 바꾸면) 그 캐릭터의 저장 상태로 편집을 시작
  useEffect(() => {
    setDraft(fromSaved(selected, assets.byId[selected]));
    setWarnings({});
    setError('');
    let live = true;
    bakedSettings(selected)
      .then((b) => {
        if (!live) return;
        setBaked({ id: selected, settings: b });
        if (!assets.byId[selected] && b) setDraft(fromSaved(selected, b));
      })
      .catch((e) => {
        if (!live) return;
        setBaked({ id: selected, settings: null });
        setError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [selected, assets.ready]);

  // 목록 표시: 반영됨 / 이 브라우저에서만 수정 / 반영본과 같음
  useEffect(() => {
    let live = true;
    Promise.all(roster.map(async (u) => [u.id, await cardStatus(u.id, assets.byId[u.id])] as const))
      .then((rows) => live && setStatuses(Object.fromEntries(rows)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [assets]);

  const override = S.normalizeName(selected, draft.name);
  const dirty =
    !loadingBaked &&
    (override !== (base?.displayNameOverride ?? null) ||
      draft.background !== (base?.backgroundImage ?? null) ||
      draft.character !== (base?.characterImage ?? null));

  if (dirtyRef) dirtyRef.current = dirty;
  guard.current = () => {
    if (!dirty) return true;
    setConfirm({ kind: 'leave' });
    return false;
  };

  const pick = (id: string) => {
    if (id === selected) return;
    if (dirty) setConfirm({ kind: 'switch', to: id });
    else setSelected(id);
    setStatus('');
  };

  const upload = async (slot: CardImageSlot, file: File | undefined) => {
    if (!file) return;
    setError('');
    setStatus('');
    const r = await readImage(file, slot);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    setDraft((d) => ({ ...d, [slot]: r.image }));
    setWarnings((w) => ({ ...w, [slot]: r.warnings }));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await cardAssets.save({
        ...(base ?? S.emptySettings(selected)),
        characterId: selected,
        displayNameOverride: override,
        backgroundImage: draft.background,
        characterImage: draft.character,
        updatedAt: Date.now(),
      });
      setStatus('저장했습니다. 새로고침해도 이 브라우저에 남습니다.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDraft(fromSaved(selected, base));
    setWarnings({});
    setError('');
    setStatus('저장된 상태로 되돌렸습니다.');
  };

  const reset = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      await cardAssets.reset(selected);
      setDraft(fromSaved(selected, bakedBase ?? undefined));
      setWarnings({});
      setStatus(
        bakedBase
          ? '이 브라우저 설정을 지우고 게임 반영본으로 되돌렸습니다.'
          : '이 캐릭터의 카드 설정을 초기화했습니다.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const same = roster.filter((u) => statuses[u.id] === 'same').map((u) => u.id);
  const cleanSame = async () => {
    setBusy(true);
    try {
      for (const id of same) await cardAssets.reset(id);
      setStatus(`반영본과 같은 브라우저 설정 ${same.length}개를 정리했습니다.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((u) => {
      if (!q) return true;
      const o = assets.byId[u.id]?.displayNameOverride ?? '';
      return [u.id, u.name, o].some((x) => x.toLowerCase().includes(q));
    });
  }, [query, assets]);

  const unit = roster.find((u) => u.id === selected)!;
  const draftCard = useCardViewData(selected, {
    displayNameOverride: override,
    backgroundImage: draft.background,
    characterImage: draft.character,
  });
  const savedCard = useCardViewData(selected, saved);

  return (
    <div class={styles.characters}>
      <aside class={styles.list}>
        <input
          type="search"
          placeholder="ID·이름 검색"
          aria-label="캐릭터 검색"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <ul aria-label="캐릭터 목록">
          {list.map((u) => (
            <li key={u.id}>
              <button
                aria-current={u.id === selected ? 'true' : undefined}
                onClick={() => pick(u.id)}
                style={{ '--cost': costColor(u.cost) }}
              >
                <i aria-hidden="true" />
                <span>
                  <b>{assets.byId[u.id]?.displayNameOverride ?? u.name}</b>
                  <small>
                    {u.id} · {u.cost}코스트
                  </small>
                </span>
                <StatusBadge status={statuses[u.id]} />
              </button>
            </li>
          ))}
          {!list.length && <li class={styles.none}>검색 결과가 없습니다.</li>}
        </ul>
        {same.length > 0 && !dirty && (
          <button class={styles.clean} disabled={busy} onClick={cleanSame}>
            반영본과 같은 브라우저 설정 정리({same.length})
          </button>
        )}
      </aside>

      <section class={styles.editor} aria-label={`${unit.id} 카드 설정`}>
        <h2>
          {unit.id} · {unit.name}
          <small> {unit.cost}코스트</small>
          <StatusBadge status={statuses[selected]} long />
        </h2>
        {loadingBaked && <p role="status">게임 반영본을 불러오는 중…</p>}
        {!assets.ready && <p role="status">카드 그림 저장소를 여는 중…</p>}
        {assets.error && (
          <p class={styles.error} role="alert">
            {assets.error}
          </p>
        )}
        <label class={styles.field}>
          <span>카드 표시 이름</span>
          <input
            value={draft.name}
            maxLength={S.limits.nameMax}
            disabled={loadingBaked}
            aria-label="카드 표시 이름"
            onInput={(e) => setDraft({ ...draft, name: (e.target as HTMLInputElement).value })}
          />
          <small>
            카드에만 쓰입니다(상점·전장·전투·도감 이름은 「{unit.name}」 그대로). 비우면 원래 이름.
            최대 {S.limits.nameMax}자.
          </small>
        </label>
        <ImageField
          slot="character"
          label="캐릭터 그림"
          hint="투명 배경 PNG 권장(알파 WebP 가능). 체크무늬가 보이는 곳이 투명한 부분입니다."
          image={draft.character}
          warnings={warnings.character}
          onFile={(f) => upload('character', f)}
          onRemove={() => {
            setDraft({ ...draft, character: null });
            setWarnings({ ...warnings, character: [] });
          }}
        />
        <ImageField
          slot="background"
          label="배경 그림"
          hint="PNG·JPG·WebP. 카드 안쪽 창을 꽉 채우도록 비율을 유지한 채 맞춥니다."
          image={draft.background}
          warnings={warnings.background}
          onFile={(f) => upload('background', f)}
          onRemove={() => {
            setDraft({ ...draft, background: null });
            setWarnings({ ...warnings, background: [] });
          }}
        />
        {error && (
          <p class={styles.error} role="alert">
            {error}
          </p>
        )}
        {confirm && (
          <div class={styles.confirm} role="alertdialog" aria-label="확인">
            {confirm.kind === 'reset' ? (
              <>
                <span>
                  {bakedBase
                    ? `${unit.id}의 이 브라우저 설정을 지우고 게임 반영본으로 되돌릴까요? 다른 캐릭터는 그대로입니다.`
                    : `${unit.id}의 카드 설정(이름·그림)을 모두 지울까요? 다른 캐릭터는 그대로입니다.`}
                </span>
                <button data-variant="danger" onClick={reset}>
                  {bakedBase ? '되돌리기' : '초기화'}
                </button>
              </>
            ) : (
              <>
                <span>저장하지 않은 변경이 있습니다. 버리고 이동할까요?</span>
                <button
                  data-variant="danger"
                  onClick={() => {
                    setConfirm(null);
                    if (confirm.kind === 'switch') setSelected(confirm.to);
                    else onLeave();
                  }}
                >
                  버리고 이동
                </button>
              </>
            )}
            <button onClick={() => setConfirm(null)}>계속 편집</button>
          </div>
        )}
        <div class={styles.actions}>
          <button data-variant="primary" disabled={!dirty || busy || !!assets.error} onClick={save}>
            저장
          </button>
          <button disabled={!dirty || busy} onClick={cancel}>
            취소
          </button>
          <button disabled={busy || !saved} onClick={() => setConfirm({ kind: 'reset' })}>
            {bakedBase ? '반영본으로 되돌리기' : '초기화'}
          </button>
          <span role="status">{dirty ? '저장하지 않은 변경 있음' : status}</span>
        </div>
      </section>

      <section class={styles.preview} aria-label="카드 미리보기">
        <h3>
          미리보기 <small>{dirty ? '저장 전 변경' : '저장된 상태와 같음'}</small>
        </h3>
        <AnimatedCard card={draftCard} label="카드 미리보기(마우스로 기울이기)" />
        <div class={styles.savedCard}>
          <div>
            <CardFace card={savedCard} />
          </div>
          <small>
            저장된 상태
            <br />
            {saved
              ? '이 브라우저 설정'
              : bakedCard(selected)
                ? '게임 반영본'
                : '설정 없음(기본 카드)'}
          </small>
        </div>
      </section>
    </div>
  );
}

function ImageField({
  slot,
  label,
  hint,
  image,
  warnings,
  onFile,
  onRemove,
}: {
  slot: CardImageSlot;
  label: string;
  hint: string;
  image: StoredImage | null;
  warnings?: string[];
  onFile: (f: File | undefined) => void;
  onRemove: () => void;
}) {
  const url = useBlobUrl(image?.blob);
  return (
    <div class={styles.field} data-image-slot={slot}>
      <span>{label}</span>
      <div class={styles.imageRow}>
        <div class={styles.thumb} data-checker={slot === 'character'}>
          {url ? <img src={url} alt={`${label} 미리보기`} /> : <small>없음</small>}
        </div>
        <div class={styles.imageInfo}>
          {image ? (
            <small>
              {image.name} · {image.width}×{image.height} · {(image.size / 1024).toFixed(0)}KB
            </small>
          ) : (
            <small>등록된 그림 없음(플레이스홀더)</small>
          )}
          <div class={styles.imageButtons}>
            <label class={styles.fileButton}>
              {image ? '교체' : '등록'}
              <input
                type="file"
                accept={S.acceptedMime}
                aria-label={`${label} 파일 고르기`}
                onChange={(e) => {
                  const input = e.target as HTMLInputElement;
                  onFile(input.files?.[0]);
                  input.value = ''; // 같은 파일을 다시 골라도 반응하게
                }}
              />
            </label>
            <button disabled={!image} onClick={onRemove}>
              삭제
            </button>
          </div>
        </div>
      </div>
      <small>{hint} 10MB 이하.</small>
      {warnings?.map((w) => (
        <small key={w} class={styles.warn}>
          ⚠ {w}
        </small>
      ))}
    </div>
  );
}

const statusText: Record<CardStatus, [string, string] | null> = {
  none: null,
  baked: ['반영됨', '게임 반영본 사용 중'],
  local: ['수정됨', '이 브라우저에서만 수정됨(내보내기 전에는 반영 안 됨)'],
  same: ['반영본과 같음', '이 브라우저 설정이 게임 반영본과 같음'],
};

function StatusBadge({ status, long }: { status?: CardStatus; long?: boolean }) {
  const t = status && statusText[status];
  if (!t) return null;
  return (
    <em class={styles.badge} data-status={status} title={t[1]}>
      {long ? t[1] : t[0]}
    </em>
  );
}
