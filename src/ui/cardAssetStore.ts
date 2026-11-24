// 카드 꾸미기 저장소(v0.23.0): 캐릭터별 표시 이름 오버라이드·배경·인물 그림(Blob)을 IndexedDB에 둔다.
// - 원정 저장(localStorage starlight-onecost-v1)·메타 프로필(autochess-meta-v1)과 다른 데이터베이스(autochess-card-assets)라
//   새 원정·저장 초기화·스테이지 이동과 무관하게 남는다. 이 브라우저·이 기기에만 있고 다른 PC·서버에는 반영되지 않는다.
// - 서버 저장·관리자 인증은 없다(전역 편집 경로를 만들지 않음).
// - 화면은 useCardAssets()로 목록을 읽고, 저장·삭제 뒤 구독자에게 알린다(컬렉션·관리자 미리보기가 같이 바뀜).
import { useEffect, useState } from 'preact/hooks';
import S, { type CardSettings } from '../core/card-settings.ts';

const DB_NAME = 'autochess-card-assets';
const DB_VERSION = 1;
const STORE = 'cards'; // keyPath characterId

export class CardAssetError extends Error {}

function friendly(e: unknown): CardAssetError {
  const name = (e as { name?: string })?.name;
  if (name === 'QuotaExceededError')
    return new CardAssetError(
      '브라우저 저장 공간이 부족해 저장하지 못했습니다. 그림 크기를 줄이거나 다른 카드 그림을 지워 주세요.',
    );
  if (name === 'SecurityError' || name === 'InvalidStateError')
    return new CardAssetError(
      '이 브라우저(비공개 모드·저장 차단)에서는 카드 그림을 저장할 수 없습니다.',
    );
  return new CardAssetError('카드 그림 저장소 오류: ' + ((e as Error)?.message || String(e)));
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export interface CardAssetRepository {
  getAll(): Promise<CardSettings[]>;
  put(settings: CardSettings): Promise<void>;
  remove(characterId: string): Promise<void>;
}

/** IndexedDB 저장소 열기(factory는 테스트용으로 바꿀 수 있음) */
export function openRepository(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): CardAssetRepository {
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ||= new Promise<IDBDatabase>((resolve, reject) => {
      if (!factory)
        return reject(new CardAssetError('이 브라우저는 IndexedDB를 지원하지 않습니다.'));
      let r: IDBOpenDBRequest;
      try {
        r = factory.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return reject(friendly(e));
      }
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE))
          r.result.createObjectStore(STORE, { keyPath: 'characterId' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(friendly(r.error));
      r.onblocked = () =>
        reject(
          new CardAssetError('다른 탭이 카드 그림 저장소를 쓰고 있습니다. 다른 탭을 닫아 주세요.'),
        );
    }).catch((e) => {
      db = null;
      throw e;
    }));
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    try {
      const t = (await open()).transaction(STORE, mode);
      const result = await request(fn(t.objectStore(STORE)));
      await new Promise<void>((resolve, reject) => {
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
      return result;
    } catch (e) {
      throw e instanceof CardAssetError ? e : friendly(e);
    }
  };
  return {
    async getAll() {
      const rows = (await tx('readonly', (s) => s.getAll())) as CardSettings[];
      return rows.filter((r) => r && S.isCharacterId(r.characterId));
    },
    async put(settings) {
      if (!S.isCharacterId(settings.characterId)) throw new CardAssetError('없는 캐릭터입니다.');
      if (S.isEmptySettings(settings)) await tx('readwrite', (s) => s.delete(settings.characterId));
      else await tx('readwrite', (s) => s.put({ ...settings, updatedAt: Date.now() }));
    },
    async remove(characterId) {
      await tx('readwrite', (s) => s.delete(characterId));
    },
  };
}

// ─── 화면 공용 캐시(한 번 읽고, 저장·삭제 때 갱신해 구독자에게 알림) ───
type Snapshot = { ready: boolean; error: string | null; byId: Record<string, CardSettings> };
let snapshot: Snapshot = { ready: false, error: null, byId: {} };
let repo: CardAssetRepository | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(s: Snapshot) => void>();
const emit = (next: Snapshot) => {
  snapshot = next;
  for (const l of listeners) l(snapshot);
};
const repository = () => (repo ||= openRepository());

function load() {
  return (loading ||= repository()
    .getAll()
    .then((rows) =>
      emit({
        ready: true,
        error: null,
        byId: Object.fromEntries(rows.map((r) => [r.characterId, r])),
      }),
    )
    .catch((e) => emit({ ready: true, error: (e as Error).message, byId: {} })));
}

export const cardAssets = {
  get: () => snapshot,
  async save(settings: CardSettings) {
    await repository().put(settings);
    const byId = { ...snapshot.byId };
    if (S.isEmptySettings(settings)) delete byId[settings.characterId];
    else byId[settings.characterId] = { ...settings, updatedAt: Date.now() };
    emit({ ...snapshot, error: null, byId });
  },
  async reset(characterId: string) {
    await repository().remove(characterId);
    const byId = { ...snapshot.byId };
    delete byId[characterId];
    emit({ ...snapshot, error: null, byId });
  },
};

/** 카드 꾸미기 설정 전체(처음 쓰일 때 IndexedDB에서 읽음) */
export function useCardAssets(): Snapshot {
  const [s, set] = useState(snapshot);
  useEffect(() => {
    listeners.add(set);
    load();
    set(snapshot);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

/** Blob → 객체 URL(바뀌거나 사라지면 해제해 메모리를 돌려줌) */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
