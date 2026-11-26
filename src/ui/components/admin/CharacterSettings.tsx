// 관리자 › 캐릭터 설정(v0.23.0 → v0.25.0). 왼쪽 캐릭터 목록·검색 → 가운데 표시 이름·카드 그림·배경·인게임 썸네일·
// 기본 능력치 → 오른쪽 카드 미리보기 + 썸네일 미리보기(실제 전장·대기석·영입 표시 컴포넌트로 그림).
// - 인게임 썸네일·기본 능력치(v0.25.0)는 이 브라우저에 저장해도 게임(원정·전투·상점)에는 쓰이지 않는다. 내보내기 → 반영 뒤 적용.
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
import { bakedSettings, cardStatus, hasBakedStats, type CardStatus } from '../../bakedCards.ts';
import U, { type StatKey, type UnitStats } from '../../../core/unit-stats.ts';
import { originalPortraitOf } from '../../art/characters.ts';
import { unitDef } from '../../data.ts';
import { Pawn } from '../Pawn.tsx';
import { CharacterImage } from '../CharacterImage.tsx';
import shopStyles from '../ShopPopover.module.css';
import { bakedCard, cardFrame, cardNameplate } from '../../art/cards.ts';
import { AnimatedCard, CardFace, useCardViewData } from '../CardView.tsx';
import styles from './Admin.module.css';

type RosterUnit = { id: string; name: string; cost: number };
const roster = D.roster as unknown as RosterUnit[];

interface Draft {
  name: string;
  background: StoredImage | null;
  character: StoredImage | null;
  thumbnail: StoredImage | null;
  frame: StoredImage | null; // v0.26.0 이 캐릭터만의 카드 프레임(null = 공통 기본)
  nameplate: StoredImage | null; // v0.26.0 이 캐릭터만의 이름표(null = 공통 기본)
  stats: Record<StatKey, string>; // 입력 칸 글자 그대로
}
type Confirm = { kind: 'reset' } | { kind: 'switch'; to: string } | { kind: 'leave' } | null;

const statText = (st: UnitStats) =>
  Object.fromEntries(U.statKeys.map((k) => [k, String(st[k])])) as Record<StatKey, string>;
const fromSaved = (id: string, s?: CardSettings): Draft => ({
  name: s?.displayNameOverride ?? roster.find((u) => u.id === id)!.name,
  background: s?.backgroundImage ?? null,
  character: s?.characterImage ?? null,
  thumbnail: s?.thumbnailImage ?? null,
  frame: s?.frameImage ?? null,
  nameplate: s?.nameplateImage ?? null,
  stats: statText(s?.stats ?? U.gameStats(id)!),
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
  let opaqueCenter = false;
  if (slot === 'frame' && checked.format !== 'jpeg') {
    // 프레임 안쪽(가운데 60%)이 대부분 불투명하면 배경·캐릭터를 가린다
    const n = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0, n, n);
      const px = ctx.getImageData(0, 0, n, n).data;
      let all = 0,
        solid = 0;
      for (let y = 7; y < n - 7; y++)
        for (let x = 7; x < n - 7; x++) {
          all++;
          if (px[(y * n + x) * 4 + 3] > 240) solid++;
        }
      opaqueCenter = solid / all > 0.5;
    }
  }
  if ((slot === 'character' || slot === 'thumbnail') && checked.format !== 'jpeg') {
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
    warnings: S.imageWarnings(slot, {
      format: checked.format,
      width,
      height,
      opaqueEdges,
      opaqueCenter,
    }),
  };
}

/** 한 캐릭터 편집 내용 평가: 저장할 값·바뀐 곳·오류 */
function evaluate(id: string, d: Draft, base?: CardSettings) {
  const override = S.normalizeName(id, d.name);
  const game = U.gameStats(id)!;
  const baseStats = base?.stats ?? game;
  const parsed = Object.fromEntries(
    U.statKeys.map((k) => [k, U.parseStat(d.stats[k])]),
  ) as UnitStats;
  const statErrors = U.checkStats(parsed);
  const statChanged = (k: StatKey) => !Object.is(parsed[k], baseStats[k]);
  const statsDirty = U.statKeys.some(statChanged);
  const dirty =
    override !== (base?.displayNameOverride ?? null) ||
    d.background !== (base?.backgroundImage ?? null) ||
    d.character !== (base?.characterImage ?? null) ||
    d.thumbnail !== (base?.thumbnailImage ?? null) ||
    d.frame !== (base?.frameImage ?? null) ||
    d.nameplate !== (base?.nameplateImage ?? null) ||
    statsDirty;
  return {
    override,
    game,
    parsed,
    statErrors,
    statChanged,
    statsDirty,
    dirty,
    invalid: Object.keys(statErrors).length > 0,
  };
}

/** 관리자 상단에서 쓰는 한꺼번에 저장·취소(v0.26.3) */
export interface CharacterControls {
  saveAll: () => Promise<void>;
  cancelAll: () => void;
}

export function CharacterSettings({
  guard,
  dirty: dirtyRef,
  controls,
  onDirty,
  onLeave,
}: {
  guard: RefObject<(() => boolean) | null>;
  dirty?: RefObject<boolean>;
  controls?: RefObject<CharacterControls | null>;
  /** 저장하지 않은 캐릭터 목록이 바뀔 때(관리자 상단 「저장(N명)」) */
  onDirty?: (ids: string[], busy: boolean) => void;
  onLeave: () => void;
}) {
  const assets = useCardAssets();
  const [selected, setSelected] = useState('C01');
  const [query, setQuery] = useState('');
  // 반영본(게임 파일)을 편집 출발점으로 받아 온 것(캐릭터별, 반영본이 없으면 null)
  const [bakedBases, setBakedBases] = useState<Record<string, CardSettings | null>>({});
  // 저장하지 않은 편집(캐릭터별, v0.26.3). 다른 캐릭터로 옮겨도 남고 오른쪽 위 「저장」으로 한꺼번에 저장한다
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [warningsById, setWarningsById] = useState<
    Record<string, Partial<Record<CardImageSlot, string[]>>>
  >({});
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const baseOf = (id: string): CardSettings | undefined =>
    assets.byId[id] ?? bakedBases[id] ?? undefined;
  const needsBaked = (id: string) => !!bakedCard(id) || hasBakedStats(id);
  const loadingBaked = needsBaked(selected) && !(selected in bakedBases);
  const saved = assets.byId[selected];
  const bakedBase = bakedBases[selected] ?? null;
  const base = baseOf(selected);
  const draft = drafts[selected] ?? fromSaved(selected, base);
  /** 그 캐릭터의 편집 내용 바꾸기(업로드처럼 늦게 끝나도 시작한 캐릭터에 들어가게 id를 받음) */
  const updateDraft = (id: string, fn: (d: Draft) => Draft) =>
    setDrafts((all) => ({ ...all, [id]: fn(all[id] ?? fromSaved(id, baseOf(id))) }));
  const setDraft = (d: Draft) => updateDraft(selected, () => d);
  const warnings = warningsById[selected] ?? {};
  const setWarningsFor = (id: string, w: Partial<Record<CardImageSlot, string[]>>) =>
    setWarningsById((all) => ({ ...all, [id]: { ...(all[id] ?? {}), ...w } }));
  const setWarnings = (w: Partial<Record<CardImageSlot, string[]>>) => setWarningsFor(selected, w);

  // 반영본이 있는 캐릭터는 처음 고를 때 반영본 그림을 받아 와 편집 출발점으로 쓴다
  // (오류 문구는 사용자가 캐릭터를 고를 때 pick에서 지운다 — 저장 막힘으로 이동할 때는 남겨 둠)
  useEffect(() => {
    if (!needsBaked(selected) || selected in bakedBases) return;
    let live = true;
    const id = selected;
    bakedSettings(id)
      .then((b) => live && setBakedBases((m) => ({ ...m, [id]: b })))
      .catch((e) => {
        if (!live) return;
        setBakedBases((m) => ({ ...m, [id]: null }));
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

  const ev = evaluate(selected, draft, base);
  const { override, game, parsed, statErrors, statChanged, statsDirty, invalid } = ev;
  const dirty = !loadingBaked && ev.dirty;
  const source = U.sourceStats(selected)!;
  const dirtyIds = roster
    .map((u) => u.id)
    .filter((id) => drafts[id] && evaluate(id, drafts[id], baseOf(id)).dirty);

  useEffect(() => {
    onDirty?.(dirtyIds, busy);
  }, [dirtyIds.join(','), busy]);

  if (dirtyRef) dirtyRef.current = dirtyIds.length > 0;
  guard.current = () => {
    if (!dirtyIds.length) return true;
    setConfirm({ kind: 'leave' });
    return false;
  };

  // 캐릭터를 바꿔도 편집 내용은 남는다(확인 없이 이동)
  const pick = (id: string) => {
    if (id === selected) return;
    setSelected(id);
    setStatus('');
    setError('');
  };

  const upload = async (slot: CardImageSlot, file: File | undefined) => {
    if (!file) return;
    const id = selected;
    setError('');
    setStatus('');
    const r = await readImage(file, slot);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    updateDraft(id, (d) => ({ ...d, [slot]: r.image }));
    setWarningsFor(id, { [slot]: r.warnings });
  };

  /** 오른쪽 위 「저장」: 바뀐 캐릭터 모두를 한꺼번에 저장. 능력치 오류가 있으면 아무것도 저장하지 않는다 */
  const saveAll = async () => {
    const ids = dirtyIds;
    if (!ids.length) return;
    const bad = ids.filter((id) => evaluate(id, drafts[id], baseOf(id)).invalid);
    if (bad.length) {
      setError(`능력치 입력 오류가 있어 저장하지 않았습니다: ${bad.join(', ')}`);
      setSelected(bad[0]);
      return;
    }
    setBusy(true);
    setError('');
    const done: string[] = [];
    try {
      for (const id of ids) {
        const d = drafts[id];
        const b = baseOf(id);
        const e = evaluate(id, d, b);
        await cardAssets.save({
          ...(b ?? S.emptySettings(id)),
          characterId: id,
          displayNameOverride: e.override,
          backgroundImage: d.background,
          characterImage: d.character,
          thumbnailImage: d.thumbnail,
          frameImage: d.frame,
          nameplateImage: d.nameplate,
          // 지금 게임 값과 같으면 저장하지 않음(null = 게임 값 그대로)
          stats: U.sameStats(e.parsed, e.game) ? null : { ...e.parsed },
          updatedAt: Date.now(),
        });
        done.push(id);
      }
      setStatus(
        `${done.length}명 저장했습니다(${done.join(', ')}). 새로고침해도 이 브라우저에 남습니다.`,
      );
    } catch (e) {
      setError(
        `저장 중 오류: ${(e as Error).message}` +
          (done.length ? ` (${done.join(', ')}는 저장됨)` : ''),
      );
    } finally {
      setDrafts((all) => {
        const next = { ...all };
        for (const id of done) delete next[id];
        return next;
      });
      setWarningsById((all) => {
        const next = { ...all };
        for (const id of done) delete next[id];
        return next;
      });
      setBusy(false);
    }
  };

  const cancelAll = () => {
    setDrafts({});
    setWarningsById({});
    setError('');
    setStatus('저장하지 않은 변경을 모두 되돌렸습니다.');
  };
  if (controls) controls.current = { saveAll, cancelAll };

  /** 지금 캐릭터의 저장하지 않은 변경만 되돌림 */
  const cancel = () => {
    setDrafts((all) => {
      const next = { ...all };
      delete next[selected];
      return next;
    });
    setWarningsById((all) => ({ ...all, [selected]: {} }));
    setError('');
    setStatus(`${selected}의 변경을 저장된 상태로 되돌렸습니다.`);
  };

  const reset = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      await cardAssets.reset(selected);
      setDrafts((all) => {
        const next = { ...all };
        delete next[selected];
        return next;
      });
      setWarningsById((all) => ({ ...all, [selected]: {} }));
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
    frameImage: draft.frame,
    nameplateImage: draft.nameplate,
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
                  <b>
                    {(drafts[u.id] && S.normalizeName(u.id, drafts[u.id].name)) ??
                      assets.byId[u.id]?.displayNameOverride ??
                      u.name}
                  </b>
                  <small>
                    {u.id} · {u.cost}코스트
                  </small>
                </span>
                {dirtyIds.includes(u.id) ? (
                  <em class={styles.badge} data-status="draft" title="저장하지 않은 변경 있음">
                    ● 편집 중
                  </em>
                ) : (
                  <StatusBadge status={statuses[u.id]} />
                )}
              </button>
            </li>
          ))}
          {!list.length && <li class={styles.none}>검색 결과가 없습니다.</li>}
        </ul>
        {same.length > 0 && !dirtyIds.length && (
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
        <ImageField
          slot="frame"
          label="카드 프레임"
          hint="이 캐릭터 카드에만 쓰는 외곽 프레임(투명 PNG 권장, 기본 1060×1484 · 비율 714:1000). 비율을 유지해 카드에 맞추며, 체크무늬가 보이는 곳이 투명한 부분입니다."
          image={draft.frame}
          fallback={cardFrame}
          removeLabel="삭제(기본값으로 복구)"
          warnings={warnings.frame}
          onFile={(f) => upload('frame', f)}
          onRemove={() => {
            setDraft({ ...draft, frame: null });
            setWarnings({ ...warnings, frame: [] });
          }}
        />
        <ImageField
          slot="nameplate"
          label="카드 이름표"
          hint="이 캐릭터 카드에만 쓰는 이름표(글자 없는 투명 PNG 권장, 기본 750×279). 기본 이름표와 같은 자리·크기로 놓이고 이름은 그 위에 글자로 그립니다."
          image={draft.nameplate}
          fallback={cardNameplate}
          removeLabel="삭제(기본값으로 복구)"
          warnings={warnings.nameplate}
          onFile={(f) => upload('nameplate', f)}
          onRemove={() => {
            setDraft({ ...draft, nameplate: null });
            setWarnings({ ...warnings, nameplate: [] });
          }}
        />
        <ImageField
          slot="thumbnail"
          label="인게임 썸네일"
          hint="영입·대기석·전장에 쓰는 그림(카드 그림과 별개). 투명 PNG·정사각형(1:1) 권장, WebP 가능. 오른쪽에서 실제 표시 모양을 확인하세요."
          image={draft.thumbnail}
          warnings={warnings.thumbnail}
          onFile={(f) => upload('thumbnail', f)}
          onRemove={() => {
            setDraft({ ...draft, thumbnail: null });
            setWarnings({ ...warnings, thumbnail: [] });
          }}
        />
        <details class={styles.stats} open>
          <summary>기본 능력치 {statsDirty && <em class={styles.changed}>● 변경 있음</em>}</summary>
          <p class={styles.statsNote}>
            성급·장비·유대·증강·영구 강화가 붙기 전 기본값입니다. 여기서 저장한 값은 이 화면에만
            보이고, 실제 전투에는 내보내기 → 게임 반영 뒤 적용됩니다. 치명타 확률은 전투에서
            100%까지, 회피는 최종 40% 상한이 그대로 적용됩니다.
          </p>
          <table>
            <thead>
              <tr>
                <th>능력치</th>
                <th>게임 값</th>
                <th>편집값</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {U.statFields.map((f) => (
                <tr key={f.key} data-stat={f.key} data-changed={statChanged(f.key)}>
                  <th>
                    {f.label} ({f.key}){f.note && <small>{f.note}</small>}
                  </th>
                  <td>
                    {game[f.key]}
                    {f.unit && <small> {f.unit}</small>}
                    {game[f.key] !== source[f.key] && <small> · 원본 {source[f.key]}</small>}
                  </td>
                  <td>
                    <input
                      inputMode="decimal"
                      aria-label={`${f.label} 편집값`}
                      aria-invalid={!!statErrors[f.key]}
                      value={draft.stats[f.key]}
                      disabled={loadingBaked}
                      onInput={(e) =>
                        setDraft({
                          ...draft,
                          stats: { ...draft.stats, [f.key]: (e.target as HTMLInputElement).value },
                        })
                      }
                    />
                  </td>
                  <td>
                    {statErrors[f.key] ? (
                      <small class={styles.statError}>{statErrors[f.key]}</small>
                    ) : statChanged(f.key) ? (
                      <small class={styles.changed}>● 바뀜</small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class={styles.statButtons}>
            <button
              disabled={U.sameStats(parsed, game)}
              onClick={() => setDraft({ ...draft, stats: statText(game) })}
            >
              능력치만 게임 값으로
            </button>
            {!U.sameStats(game, source) && (
              <button
                disabled={U.sameStats(parsed, source)}
                onClick={() => setDraft({ ...draft, stats: statText(source) })}
              >
                능력치만 원본 값으로
              </button>
            )}
          </div>
        </details>
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
                    : `${unit.id}의 이 브라우저 설정(카드 이름·카드 그림·배경·개별 프레임·개별 이름표·인게임 썸네일·기본 능력치)을 모두 지울까요? 다른 캐릭터는 그대로입니다.`}
                </span>
                <button data-variant="danger" onClick={reset}>
                  {bakedBase ? '되돌리기' : '초기화'}
                </button>
              </>
            ) : (
              <>
                <span>
                  저장하지 않은 변경이 {dirtyIds.length}명({dirtyIds.join(', ')}) 있습니다. 버리고
                  나갈까요?
                </span>
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
          <button disabled={!dirty || busy} onClick={cancel}>
            이 캐릭터 변경 취소
          </button>
          <button disabled={busy || !saved} onClick={() => setConfirm({ kind: 'reset' })}>
            {bakedBase ? '반영본으로 되돌리기' : '초기화'}
          </button>
          <span role="status">
            {invalid
              ? '능력치 입력 오류(고치기 전에는 저장되지 않음)'
              : dirtyIds.length
                ? `저장하지 않은 변경 ${dirtyIds.length}명 — 오른쪽 위 「저장」으로 한꺼번에 저장`
                : status}
          </span>
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
        <ThumbPreview id={selected} image={draft.thumbnail} />
      </section>
    </div>
  );
}

function ImageField({
  slot,
  label,
  hint,
  image,
  fallback,
  removeLabel = '삭제',
  warnings,
  onFile,
  onRemove,
}: {
  slot: CardImageSlot;
  label: string;
  hint: string;
  image: StoredImage | null;
  /** 개별 그림이 없을 때 실제로 쓰이는 공통 기본 그림(프레임·이름표) */
  fallback?: string;
  removeLabel?: string;
  warnings?: string[];
  onFile: (f: File | undefined) => void;
  onRemove: () => void;
}) {
  const url = useBlobUrl(image?.blob);
  return (
    <div class={styles.field} data-image-slot={slot}>
      <span>{label}</span>
      <div class={styles.imageRow}>
        <div
          class={styles.thumb}
          data-checker={slot !== 'background'}
          data-wide={slot === 'nameplate'}
        >
          {url ? (
            <img src={url} alt={`${label} 미리보기`} />
          ) : fallback ? (
            <img src={fallback} alt={`${label} 공통 기본 그림`} data-fallback />
          ) : (
            <small>없음</small>
          )}
        </div>
        <div class={styles.imageInfo}>
          {image ? (
            <small>
              {image.name} · {image.width}×{image.height} · {(image.size / 1024).toFixed(0)}KB
            </small>
          ) : (
            <small>{fallback ? '공통 기본 그림 사용 중' : '등록된 그림 없음(플레이스홀더)'}</small>
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
              {removeLabel}
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

/**
 * 인게임 썸네일 미리보기: 실제 전장·대기석 말(Pawn)과 영입 카드(ShopPopover 스타일)로 그린다.
 * 그림이 없으면 원래 그림(일러스트 썸네일 또는 SVG 아바타).
 */
function ThumbPreview({ id, image }: { id: string; image: StoredImage | null }) {
  const url = useBlobUrl(image?.blob);
  const portrait = url ? { thumbnail: url, detail: url } : (originalPortraitOf(id) ?? null);
  const unit = unitDef(id);
  return (
    <section class={styles.thumbPreview} aria-label="인게임 썸네일 미리보기">
      <h3>
        인게임 썸네일 <small>{image ? '등록한 그림' : '기본 그림'}</small>
      </h3>
      <div class={styles.thumbRow}>
        <figure>
          <div class={styles.fieldBox}>
            <Pawn id={id} star={1} context="field" portrait={portrait} />
          </div>
          <figcaption>전장</figcaption>
        </figure>
        <figure>
          <div class={styles.benchBox}>
            <Pawn id={id} star={1} context="bench" portrait={portrait} />
          </div>
          <figcaption>대기석</figcaption>
        </figure>
        <figure>
          <div class={styles.shopBox}>
            <span
              class={shopStyles.card}
              style={{ '--cost-color': costColor(unit.cost), '--i': 0 }}
            >
              <span class={shopStyles.art}>
                <CharacterImage id={id} context="shop" portrait={portrait} />
              </span>
              <span class={shopStyles.info}>
                <b>{unit.name}</b>
                <span class={shopStyles.tags}>{unit.bonds.join(' · ')}</span>
              </span>
              <span class={shopStyles.cost}>{unit.cost}G</span>
            </span>
          </div>
          <figcaption>영입</figcaption>
        </figure>
      </div>
    </section>
  );
}
