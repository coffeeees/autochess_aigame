// 관리자 내보내기(v0.24.0): 이 브라우저에 저장된 관리자 설정을 ZIP 하나로 만든다.
// 이 파일을 대화창에 첨부하면 개발 쪽에서 tools/import-admin-export.py로 게임 파일(반영본)에 넣고 배포한다.
// ZIP 구성: manifest.json(형식·버전·모듈별 내용), 그림 원본(cards/<ID>/background·character·thumbnail.<확장자>), README_APPLY.md.
// 형식은 모듈 단위(modules.characters …)라 이후 전투 수치·아이템 같은 관리 메뉴가 생기면 같은 파일에 더한다.
// 버전 2(v0.25.0): 캐릭터 항목에 thumbnailImage(인게임 썸네일)·stats(기본 능력치 10개, null = 바꾸지 않음) 추가.
//   버전 1 파일도 가져오기 도구가 그대로 읽는다(없는 항목 = 바꾸지 않음). 모르는 항목은 무시하고 알린다.
// 버전 3(v0.26.0): frameImage·nameplateImage(이 캐릭터만의 카드 프레임·이름표, null = 공통 기본 그림으로 복구),
//   그림은 cards/<ID>/frame.<확장자>·nameplate.<확장자>.
import S, { type CardSettings, type StoredImage } from '../core/card-settings.ts';
import C from '../core/collection.ts';
import U, { type UnitStats } from '../core/unit-stats.ts';
import { sha256 } from './bakedCards.ts';
import { makeZip, type ZipEntry } from './zip.ts';

export const EXPORT_FORMAT = 'autochess-admin-export';
export const EXPORT_VERSION = 3;

const ext = { png: 'png', jpeg: 'jpg', webp: 'webp' } as const;

export interface ExportedImage {
  file: string;
  format: StoredImage['format'];
  width: number;
  height: number;
  size: number;
  sha256: string;
  originalName: string;
}
export interface ExportedCard {
  characterId: string;
  originalName: string; // 원래 캐릭터 이름(확인용)
  displayNameOverride: string | null; // null = 원래 이름
  backgroundImage: ExportedImage | null; // null = 그림 없음(플레이스홀더)
  characterImage: ExportedImage | null;
  thumbnailImage: ExportedImage | null; // null = 등록 안 함(게임 기본 썸네일)
  frameImage: ExportedImage | null; // null = 공통 기본 프레임(개별 프레임 없음·삭제)
  nameplateImage: ExportedImage | null; // null = 공통 기본 이름표
  stats: UnitStats | null; // null = 기본 능력치 바꾸지 않음, 숫자 10개 = 그 값으로(원본과 같은 키는 덮어쓰지 않음)
  imageTransform: CardSettings['imageTransform'] | null;
  updatedAt: string;
}
export interface ExportManifest {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  schemaVersion: typeof EXPORT_VERSION;
  exportedAt: string;
  gameVersion: string;
  note: string;
  modules: { characters: { cards: ExportedCard[] } };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const exportFileName = (d = new Date()) =>
  `autochess-admin-export-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;

export interface ExportProblem {
  characterId: string;
  field: string;
  message: string;
}

/** 내보내기 전 검사: 캐릭터 ID, 기본 능력치 10개, 그림 크기 정보. 문제가 있으면 ZIP을 만들지 않는다 */
export function checkRecords(records: CardSettings[]): ExportProblem[] {
  const out: ExportProblem[] = [];
  for (const r of records) {
    if (!S.isCharacterId(r.characterId)) {
      out.push({ characterId: r.characterId, field: 'ID', message: '없는 캐릭터' });
      continue;
    }
    if (r.stats)
      for (const [k, m] of Object.entries(U.checkStats(r.stats)))
        out.push({ characterId: r.characterId, field: k, message: m });
    for (const [field, img] of [
      ['카드 그림', r.characterImage],
      ['배경 그림', r.backgroundImage],
      ['인게임 썸네일', r.thumbnailImage ?? null],
      ['카드 프레임', r.frameImage ?? null],
      ['카드 이름표', r.nameplateImage ?? null],
    ] as const)
      if (
        img &&
        (!img.blob || !(img.width > 0) || !(img.height > 0) || img.size > S.limits.maxBytes)
      )
        out.push({
          characterId: r.characterId,
          field,
          message: '그림 정보가 잘못됨(다시 등록해 주세요)',
        });
  }
  return out;
}

/** 저장된 카드 설정들 → ZIP 바이트와 요약. 검사에 걸리면 예외(ExportError) */
export async function buildExport(
  records: CardSettings[],
  gameVersion: string,
  now = new Date(),
): Promise<{ zip: Uint8Array; manifest: ExportManifest }> {
  const problems = checkRecords(records);
  if (problems.length) throw new ExportError(problems);
  const entries: ZipEntry[] = [];
  const cards: ExportedCard[] = [];
  const sorted = [...records]
    .filter((r) => S.isCharacterId(r.characterId))
    .sort((a, b) => a.characterId.localeCompare(b.characterId));
  for (const r of sorted) {
    const image = async (
      slot: 'background' | 'character' | 'thumbnail' | 'frame' | 'nameplate',
      img: StoredImage | null,
    ) => {
      if (!img) return null;
      const file = `cards/${r.characterId}/${slot}.${ext[img.format]}`;
      const data = new Uint8Array(await img.blob.arrayBuffer());
      entries.push({ name: file, data });
      return {
        file,
        format: img.format,
        width: img.width,
        height: img.height,
        size: data.length,
        sha256: await sha256(img.blob),
        originalName: img.name,
      };
    };
    cards.push({
      characterId: r.characterId,
      originalName: C.entry(r.characterId)?.displayName ?? r.characterId,
      displayNameOverride: r.displayNameOverride,
      backgroundImage: await image('background', r.backgroundImage),
      characterImage: await image('character', r.characterImage),
      thumbnailImage: await image('thumbnail', r.thumbnailImage ?? null),
      frameImage: await image('frame', r.frameImage ?? null),
      nameplateImage: await image('nameplate', r.nameplateImage ?? null),
      stats: r.stats ? { ...r.stats } : null,
      imageTransform: r.imageTransform ?? null,
      updatedAt: new Date(r.updatedAt || now.getTime()).toISOString(),
    });
  }
  const manifest: ExportManifest = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    schemaVersion: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    gameVersion,
    note: '각 캐릭터 항목은 그 캐릭터의 전체 상태다(그림 null = 그림 없음/기본 그림, stats null = 능력치 그대로). 들어 있지 않은 캐릭터는 바꾸지 않는다.',
    modules: { characters: { cards } },
  };
  const enc = new TextEncoder();
  const readme = applyGuide(cards, gameVersion, now);
  entries.unshift(
    { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2) + '\n') },
    { name: 'README_APPLY.md', data: enc.encode(readme) },
  );
  return { zip: makeZip(entries, now), manifest };
}

export class ExportError extends Error {
  constructor(public problems: ExportProblem[]) {
    super(problems.map((p) => `${p.characterId} ${p.field}: ${p.message}`).join(' / '));
  }
}

/** ZIP 안 적용 안내(실제 저장소 경로) */
function applyGuide(cards: ExportedCard[], gameVersion: string, now: Date) {
  const row = (c: ExportedCard) => {
    const parts = [
      c.displayNameOverride ? `카드 이름 「${c.displayNameOverride}」` : '',
      c.characterImage ? '카드 그림' : '',
      c.backgroundImage ? '배경' : '',
      c.thumbnailImage ? '인게임 썸네일' : '',
      c.frameImage ? '개별 프레임' : '',
      c.nameplateImage ? '개별 이름표' : '',
      c.stats ? '기본 능력치' : '',
    ].filter(Boolean);
    return `- ${c.characterId} ${c.originalName}: ${parts.join(', ') || '설정 지움(기본으로)'}`;
  };
  return [
    '# AUTOCHESS 관리자 내보내기 — 적용 안내',
    '',
    `- 내보낸 시각: ${now.toLocaleString('ko-KR')} · 게임 버전 ${gameVersion} · 형식 autochess-admin-export v${EXPORT_VERSION}`,
    `- 캐릭터 ${cards.length}명`,
    ...cards.map(row),
    '',
    '## 적용 방법',
    '',
    '이 ZIP은 브라우저에서 만든 파일일 뿐이며, 내보내기만으로는 GitHub·배포 사이트에 반영되지 않습니다.',
    '',
    '1. 권장: 이 ZIP을 그대로 대화창에 첨부하면 개발 쪽에서 아래 2번을 실행하고 테스트한 뒤 배포합니다.',
    '2. 직접 적용(저장소를 내려받은 PC, Node 22.18+·Python 3·Pillow 필요):',
    '   - `python3 tools/import-admin-export.py <이 ZIP> --dry-run` 으로 무엇이 바뀌는지 확인',
    '   - `python3 tools/import-admin-export.py <이 ZIP>` 실행 → `npm test` → 커밋 → main에 올리면 GitHub Actions가 배포',
    '',
    '## 도구가 바꾸는 저장소 경로',
    '',
    '- 카드 이름·카드 그림·배경·인게임 썸네일 반영본: `src/ui/art/card-art.generated.ts`',
    '- 그림 배포본(WebP): `public/assets/cards/<id>/background.webp`·`character.webp`·`thumbnail.webp`·`frame.webp`·`nameplate.webp` (id는 소문자, 예: c01, 프레임·이름표는 무손실)',
    '- 개별 프레임·이름표가 null인 캐릭터는 반영본에서 지워져 공통 기본 그림(`public/assets/cards/card-frame.webp`·`card-nameplate.webp`)으로 돌아갑니다(공통 그림은 바뀌지 않음).',
    '- 그림 원본: `assets-src/images/cards/<id>/`',
    '- 기본 능력치 반영본(원본과 다른 키만): `src/core/data/unit-stat-overrides.generated.js`',
    '',
    '## 적용 뒤',
    '',
    '- 인게임 썸네일은 영입·대기석·전장(전투 화면 포함)에, 기본 능력치는 전투·상세 능력치에 쓰입니다.',
    '- 능력치는 전투할 때마다 데이터를 읽으므로 진행 중인 원정도 다음 전투부터 새 값을 씁니다(저장 파일은 바꾸지 않음).',
    '- 적군(E01~E08)은 캐릭터 능력치를 바꿔도 원래 값을 씁니다.',
    '',
  ].join('\n');
}

/** 브라우저에서 ZIP 내려받기 */
export function download(zip: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
