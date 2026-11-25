// 반영본(게임 파일에 들어간 카드 꾸미기)을 관리자 편집용 설정으로 읽기·비교(v0.24.0).
// - 관리자 화면은 "이 브라우저 설정 = 그 캐릭터 카드의 전체 상태"로 다룬다. 브라우저 설정이 없는 캐릭터를 고치기 시작하면
//   반영본 그림을 Blob으로 받아 와 그 위에서 고친다(이름만 바꿔도 반영본 그림이 같이 남게).
// - 같은지 비교는 그림 sha256(반영본은 보낸 원본·배포본 해시 둘 다 기록)과 이름으로 한다.
import S, { type CardSettings, type StoredImage } from '../core/card-settings.ts';
import { bakedCard, type BakedImage } from './art/cards.ts';
import U from '../core/unit-stats.ts';
import D from '../core/data/units.js';

const statOverrides = D.statOverrides as Record<string, Record<string, number>>;
/** 반영된 능력치가 있는 캐릭터 */
export const hasBakedStats = (id: string) => Object.keys(statOverrides[id] || {}).length > 0;

const cache = new Map<string, Promise<CardSettings | null>>();

async function fetchImage(img: BakedImage | undefined): Promise<StoredImage | null> {
  if (!img) return null;
  const res = await fetch(img.src);
  if (!res.ok) throw new Error(`반영본 그림을 불러오지 못했습니다(${img.src}).`);
  const blob = await res.blob();
  return {
    blob,
    format: img.format,
    name: '게임 반영본',
    size: blob.size,
    width: img.width,
    height: img.height,
  };
}

/** 반영본을 편집용 설정으로(반영본이 없으면 null). 같은 캐릭터는 같은 객체를 돌려준다 */
export function bakedSettings(characterId: string): Promise<CardSettings | null> {
  const baked = bakedCard(characterId);
  if (!baked && !hasBakedStats(characterId)) return Promise.resolve(null);
  let p = cache.get(characterId);
  if (!p) {
    p = Promise.all([
      fetchImage(baked?.background),
      fetchImage(baked?.character),
      fetchImage(baked?.thumbnail),
    ]).then(([backgroundImage, characterImage, thumbnailImage]) => ({
      ...S.emptySettings(characterId),
      displayNameOverride: S.normalizeName(characterId, baked?.displayName ?? ''),
      backgroundImage,
      characterImage,
      thumbnailImage,
      stats: hasBakedStats(characterId) ? U.gameStats(characterId)! : null,
      imageTransform: baked?.imageTransform,
    }));
    p.catch(() => cache.delete(characterId));
    cache.set(characterId, p);
  }
  return p;
}

const hashes = new WeakMap<Blob, Promise<string>>();
export function sha256(blob: Blob): Promise<string> {
  let p = hashes.get(blob);
  if (!p) {
    p = blob
      .arrayBuffer()
      .then((b) => crypto.subtle.digest('SHA-256', b))
      .then((d) => [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''));
    hashes.set(blob, p);
  }
  return p;
}

export type CardStatus = 'none' | 'baked' | 'local' | 'same';

/** 캐릭터 카드 상태: 설정 없음 / 게임 반영본만 / 이 브라우저 수정(반영 안 됨) / 브라우저 설정이 반영본과 같음 */
export async function cardStatus(characterId: string, local?: CardSettings): Promise<CardStatus> {
  const baked = bakedCard(characterId);
  const anyBaked = !!baked || hasBakedStats(characterId);
  if (!local) return anyBaked ? 'baked' : 'none';
  if (!anyBaked) return 'local';
  if (
    (local.displayNameOverride ?? null) !== S.normalizeName(characterId, baked?.displayName ?? '')
  )
    return 'local';
  if (local.stats && !U.sameStats(local.stats, U.gameStats(characterId))) return 'local';
  for (const slot of ['background', 'character', 'thumbnail'] as const) {
    const mine =
      slot === 'background'
        ? local.backgroundImage
        : slot === 'character'
          ? local.characterImage
          : (local.thumbnailImage ?? null);
    const theirs = baked?.[slot];
    if (!mine !== !theirs) return 'local';
    if (mine && theirs && !theirs.sha256.includes(await sha256(mine.blob))) return 'local';
  }
  return 'same';
}
