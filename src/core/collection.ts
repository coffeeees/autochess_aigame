// 컬렉션(v0.22.0 UI 뼈대, 요청서 AUTOCHESS_COLLECTION_SKELETON_2026-11-25): 보유 카드 조회 어댑터.
// - 뽑기·조각·해금·돌파는 아직 정해지지 않아 구현하지 않는다. 이 모듈은 "어떤 캐릭터 카드를 가졌는가"를
//   읽기만 하고, 아무것도 저장하거나 지급하지 않는다(임의 획득 금지).
// - 지금 게임에는 카드 획득 기록이 없으므로 ownedIds는 항상 빈 목록이다. 나중에 획득 시스템이 생기면
//   메타 프로필의 collection.owned(캐릭터 ID 목록)를 채우거나 readOwned만 바꾸면 화면은 그대로 동작한다.
// - 이름·코스트는 기존 캐릭터 데이터(data/units.js)를 그대로 읽는다(사본을 만들지 않음). 카드 그림 경로는 화면 쪽
//   등록표(ui/art/cards.ts)가 맡는다.
import D from './data/units.js';

export interface CollectionEntry {
  characterId: string; // 기존 캐릭터 ID(C01~C45)
  displayName: string; // 기존 데이터의 표시 이름
  cost: number;
  owned: boolean; // 획득 기록에서만 true(임의로 만들지 않음)
  // 이후: fragments, unlockStatus, breakthroughStage
}

/** 보유 기록을 담을 수 있는 원천(메타 프로필 등). 지금은 이 필드를 쓰는 곳이 없다 */
export interface OwnershipSource {
  collection?: { owned?: unknown };
}

type RosterUnit = { id: string; name: string; cost: number };
const roster = D.roster as unknown as RosterUnit[];

/** 보유한 캐릭터 ID(명단 순서, 없는 ID·중복 제외). 기록이 없으면 빈 목록 */
export function ownedIds(source?: OwnershipSource | null): string[] {
  const raw = source?.collection?.owned;
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter((x): x is string => typeof x === 'string'));
  return roster.filter((u) => set.has(u.id)).map((u) => u.id);
}

/** 캐릭터 하나의 카드 정보(기존 데이터에서 읽음). 없는 ID면 null */
export function entry(characterId: string, owned = false): CollectionEntry | null {
  const u = roster.find((x) => x.id === characterId);
  return u ? { characterId: u.id, displayName: u.name, cost: u.cost, owned } : null;
}

/** 컬렉션 화면에 보일 카드(보유한 것만). 미획득 카드 공개 여부는 미정이라 넣지 않는다 */
export function ownedEntries(source?: OwnershipSource | null): CollectionEntry[] {
  return ownedIds(source).map((id) => entry(id, true)!);
}

export default { ownedIds, entry, ownedEntries };
