// 관리자 내보내기(v0.24.0): 이 브라우저에 저장된 관리자 설정을 ZIP 하나로 만든다.
// 이 파일을 대화창에 첨부하면 개발 쪽에서 tools/import-admin-export.py로 게임 파일(반영본)에 넣고 배포한다.
// ZIP 구성: manifest.json(형식·버전·모듈별 내용), 그림 원본(cards/<ID>/background.<확장자>·character.<확장자>), README.txt.
// 형식은 모듈 단위(modules.characters …)라 이후 전투 수치·아이템 같은 관리 메뉴가 생기면 같은 파일에 더한다.
import S, { type CardSettings, type StoredImage } from '../core/card-settings.ts';
import C from '../core/collection.ts';
import { sha256 } from './bakedCards.ts';
import { makeZip, type ZipEntry } from './zip.ts';

export const EXPORT_FORMAT = 'autochess-admin-export';
export const EXPORT_VERSION = 1;

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
  imageTransform: CardSettings['imageTransform'] | null;
  updatedAt: string;
}
export interface ExportManifest {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  gameVersion: string;
  note: string;
  modules: { characters: { cards: ExportedCard[] } };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const exportFileName = (d = new Date()) =>
  `autochess-admin-export-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;

/** 저장된 카드 설정들 → ZIP 바이트와 요약 */
export async function buildExport(
  records: CardSettings[],
  gameVersion: string,
  now = new Date(),
): Promise<{ zip: Uint8Array; manifest: ExportManifest }> {
  const entries: ZipEntry[] = [];
  const cards: ExportedCard[] = [];
  const sorted = [...records]
    .filter((r) => S.isCharacterId(r.characterId))
    .sort((a, b) => a.characterId.localeCompare(b.characterId));
  for (const r of sorted) {
    const image = async (slot: 'background' | 'character', img: StoredImage | null) => {
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
      imageTransform: r.imageTransform ?? null,
      updatedAt: new Date(r.updatedAt || now.getTime()).toISOString(),
    });
  }
  const manifest: ExportManifest = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    gameVersion,
    note: '각 캐릭터 항목은 그 카드의 전체 상태다(그림이 null이면 그림 없음). 들어 있지 않은 캐릭터는 바꾸지 않는다.',
    modules: { characters: { cards } },
  };
  const enc = new TextEncoder();
  const readme = [
    'AUTOCHESS 관리자 내보내기',
    '',
    `내보낸 시각: ${now.toLocaleString('ko-KR')}  ·  게임 버전 ${gameVersion}`,
    `캐릭터 카드 ${cards.length}명: ${cards.map((c) => c.characterId).join(', ') || '없음'}`,
    '',
    '이 ZIP 파일을 그대로 대화창에 첨부하면 게임 파일(반영본)에 넣어 배포합니다.',
    '압축을 풀거나 파일 이름을 바꾸지 않아도 됩니다.',
    '',
  ].join('\n');
  entries.unshift(
    { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2) + '\n') },
    { name: 'README.txt', data: enc.encode(readme) },
  );
  return { zip: makeZip(entries, now), manifest };
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
