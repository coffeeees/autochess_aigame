// 카드 꾸미기 설정(v0.23.0, 요청서 AUTOCHESS_COLLECTION_ADMIN_UPDATE_2026-11-25)의 순수 규칙.
// 데이터 책임: ① 캐릭터 원본(data/units.js: ID·코스트·이름) ② 카드 꾸미기(이 모듈: 표시 이름 오버라이드·배경·인물 그림)
// ③ 보유(collection.ts, 추후 뽑기). 그림을 등록해도 보유·해금으로 치지 않는다. 표시 이름 오버라이드는 카드에만 쓰고
// 상점·전장·전투·도감의 이름은 바꾸지 않는다. 저장(IndexedDB)은 화면 쪽 ui/cardAssetStore.ts가 맡는다.
import D from './data/units.js';
import type { UnitStats } from './unit-stats.ts';

// v0.25.0: thumbnail = 인게임 썸네일(영입·대기석·전장), 카드 그림과 다른 자산
// v0.26.0: frame·nameplate = 이 캐릭터 카드만 쓰는 프레임·이름표(없으면 공통 기본 그림)
export type CardImageSlot = 'background' | 'character' | 'thumbnail' | 'frame' | 'nameplate';
export type CardImageFormat = 'png' | 'jpeg' | 'webp';

/** 그림 위치 보정(예약, 이번 버전 화면에는 조절 도구 없음). 기본 scale 1 · offset 0(카드 폭·높이 대비 %) */
export interface ImageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface StoredImage {
  blob: Blob;
  format: CardImageFormat;
  name: string; // 올린 파일 이름(표시용)
  size: number; // 바이트
  width: number;
  height: number;
}

export interface CardSettings {
  characterId: string; // 고유 키(이름이 바뀌어도 그대로)
  displayNameOverride: string | null;
  backgroundImage: StoredImage | null;
  characterImage: StoredImage | null;
  /** 인게임 썸네일(v0.25.0). null = 등록 안 함(게임의 기존 썸네일·아바타) */
  thumbnailImage?: StoredImage | null;
  /** 카드 프레임·이름표 개별 그림(v0.26.0). null·없음 = 공통 기본 그림 */
  frameImage?: StoredImage | null;
  nameplateImage?: StoredImage | null;
  /** 기본 능력치 10개(v0.25.0). null·없음 = 지금 게임 값 그대로 */
  stats?: UnitStats | null;
  imageTransform?: Partial<Record<'background' | 'character', ImageTransform>>; // 예약
  updatedAt: number;
}

export const limits = {
  maxBytes: 10 * 1024 * 1024, // 그림 한 장 10MB
  maxSide: 4096, // 이보다 크면 경고(저장은 됨)
  nameMax: 12, // 표시 이름 최대 글자 수
};
export const acceptedMime = 'image/png,image/jpeg,image/webp';
export const mimeOf: Record<CardImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const roster = D.roster as unknown as { id: string; name: string; cost: number }[];
export const isCharacterId = (id: string) => roster.some((u) => u.id === id);

/** 파일 앞부분(매직 바이트)으로 형식 판정. 확장자·MIME은 믿지 않는다(SVG·HTML·스크립트는 여기서 걸러짐) */
export function sniffImage(bytes: Uint8Array): CardImageFormat | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47)
    return 'png';
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpeg';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(b(0), b(1), b(2), b(3)) === 'RIFF' &&
    String.fromCharCode(b(8), b(9), b(10), b(11)) === 'WEBP'
  )
    return 'webp';
  return null;
}

/** 올린 파일 검사: 형식·크기. 통과하면 format, 아니면 안내 문구 */
export function checkUpload(
  bytes: Uint8Array,
  size: number,
): { ok: true; format: CardImageFormat } | { ok: false; error: string } {
  if (size <= 0) return { ok: false, error: '빈 파일입니다.' };
  if (size > limits.maxBytes)
    return {
      ok: false,
      error: `파일이 너무 큽니다(${(size / 1048576).toFixed(1)}MB). 10MB 이하로 올려 주세요.`,
    };
  const format = sniffImage(bytes);
  if (!format)
    return { ok: false, error: 'PNG·JPG·WebP 그림만 올릴 수 있습니다(SVG·HTML 등은 받지 않음).' };
  return { ok: true, format };
}

/** 그림을 읽은 뒤 안내(저장은 막지 않음): 너무 큰 해상도, 캐릭터 그림의 투명 배경 */
export function imageWarnings(
  slot: CardImageSlot,
  info: {
    format: CardImageFormat;
    width: number;
    height: number;
    opaqueEdges?: boolean;
    opaqueCenter?: boolean;
  },
): string[] {
  const out: string[] = [];
  if (Math.max(info.width, info.height) > limits.maxSide)
    out.push(`해상도가 큽니다(${info.width}×${info.height}). 4096px 이하를 권장합니다.`);
  if (slot === 'frame') {
    if (Math.abs(info.width / info.height - 714 / 1000) > 0.01)
      out.push(
        `기본 프레임(714×1000)과 비율이 다릅니다(${info.width}×${info.height}). 늘리지 않고 비율을 유지해 맞추므로 여백이 생깁니다.`,
      );
    if (info.format === 'jpeg')
      out.push('JPG는 투명 영역이 없어 카드 그림을 가립니다. 투명 PNG를 권장합니다.');
    else if (info.opaqueCenter)
      out.push(
        '가운데가 투명하지 않습니다. 배경·캐릭터 그림을 가리는지 미리보기에서 확인해 주세요(자동으로 투명하게 바꾸지 않음).',
      );
  }
  if (slot === 'nameplate') {
    if (Math.abs(info.width / info.height - 750 / 279) > 0.03)
      out.push(
        `기본 이름표(750×279)와 비율이 다릅니다(${info.width}×${info.height}). 같은 자리에 비율을 유지해 맞춥니다.`,
      );
    if (info.format === 'jpeg') out.push('JPG는 투명 영역이 없습니다. 투명 PNG를 권장합니다.');
  }
  if (slot === 'thumbnail') {
    if (info.width !== info.height)
      out.push(
        `정사각형(1:1)을 권장합니다(지금 ${info.width}×${info.height}). 화면마다 가운데를 기준으로 잘려 보입니다.`,
      );
    if (info.format === 'jpeg')
      out.push('JPG는 투명 배경이 없습니다. 투명 PNG(또는 알파 WebP)를 권장합니다.');
  }
  if (slot === 'character') {
    if (info.format === 'jpeg')
      out.push(
        'JPG는 투명 배경이 없어 카드 배경을 가립니다. 투명 PNG(또는 알파 WebP)를 권장합니다.',
      );
    else if (info.opaqueEdges)
      out.push('그림 가장자리가 투명하지 않습니다. 배경이 지워졌는지 미리보기에서 확인해 주세요.');
  }
  return out;
}

/** 표시 이름 입력 정리: 앞뒤 공백 제거, 최대 12자. 비거나 원래 이름과 같으면 오버라이드 없음(null) */
export function normalizeName(characterId: string, input: string): string | null {
  const name = [...input.trim().replace(/\s+/g, ' ')].slice(0, limits.nameMax).join('');
  const original = roster.find((u) => u.id === characterId)?.name;
  return !name || name === original ? null : name;
}

/** 카드에 보일 이름(오버라이드가 있으면 그것, 없으면 원래 이름) */
export function cardName(
  characterId: string,
  settings?: Pick<CardSettings, 'displayNameOverride'> | null,
) {
  return (
    settings?.displayNameOverride || roster.find((u) => u.id === characterId)?.name || characterId
  );
}

/** 이름표 글자 크기 배율: 5자까지 1, 길면 줄여 배너 안에 들어가게(최소 0.5) */
export function nameScale(name: string): number {
  const n = [...name].length;
  return n <= 5 ? 1 : Math.max(0.5, 5.4 / n);
}

export const emptySettings = (characterId: string): CardSettings => ({
  characterId,
  displayNameOverride: null,
  backgroundImage: null,
  characterImage: null,
  thumbnailImage: null,
  frameImage: null,
  nameplateImage: null,
  stats: null,
  updatedAt: 0,
});

/** 설정이 비었는지(이름·그림 모두 없으면 저장할 필요 없음 → 지움) */
export const isEmptySettings = (s: CardSettings) =>
  !s.displayNameOverride &&
  !s.backgroundImage &&
  !s.characterImage &&
  !s.thumbnailImage &&
  !s.frameImage &&
  !s.nameplateImage &&
  !s.stats;

export default {
  limits,
  acceptedMime,
  mimeOf,
  isCharacterId,
  sniffImage,
  checkUpload,
  imageWarnings,
  normalizeName,
  cardName,
  nameScale,
  emptySettings,
  isEmptySettings,
};
