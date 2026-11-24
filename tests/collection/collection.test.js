// v0.22.0 컬렉션 UI 뼈대(요청서 AUTOCHESS_COLLECTION_SKELETON_2026-11-25): 보유 카드 어댑터·덮개 창 열고 닫기·그림 등록표.
// 뽑기·해금·돌파는 없고, 어떤 경로로도 카드를 지급하거나 저장하지 않는다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import C from '../../src/core/collection.ts';
import D from '../../src/core/data/units.js';
import M from '../../src/core/meta.ts';
import { createStore } from '../../src/ui/store.ts';
import { cardArt, cardFrame, cardNameplate } from '../../src/ui/art/cards.ts';

test('보유 기록이 없으면 빈 컬렉션(새 프로필·빈 값·잘못된 값)', () => {
  a.deepEqual(C.ownedIds(M.newProfile()), []);
  a.deepEqual(C.ownedEntries(M.newProfile()), []);
  a.deepEqual(C.ownedIds(null), []);
  a.deepEqual(C.ownedIds({ collection: { owned: 'C01' } }), []);
});

test('보유 기록(collection.owned)이 있으면 명단 순서로, 없는 ID·중복은 빼고 기존 이름·코스트를 그대로 읽는다', () => {
  const src = { collection: { owned: ['C12', 'C01', 'C01', 'X99', 7] } };
  const before = JSON.stringify(src);
  a.deepEqual(C.ownedIds(src), ['C01', 'C12']);
  const list = C.ownedEntries(src);
  const c01 = D.byId('C01');
  a.deepEqual(list[0], { characterId: 'C01', displayName: c01.name, cost: c01.cost, owned: true });
  a.equal(list[1].cost, D.byId('C12').cost);
  a.equal(JSON.stringify(src), before, '읽기만 하고 바꾸지 않음');
  a.equal(C.entry('X99'), null);
  a.equal(C.entry('C45').owned, false, '기본은 미보유');
});

test('컬렉션 열기·카드 상세·Esc(상세 → 목록 → 닫기)는 원정·메타 저장을 바꾸지 않는다', () => {
  const data = new Map();
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 5,
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  store.actions.startRun();
  const saved = JSON.stringify([...data]);
  const { actions } = store;
  actions.openOverlay({ kind: 'collection', card: null });
  a.equal(store.getState().overlay.kind, 'collection');
  actions.openOverlay({ kind: 'collection', card: 'C01' });
  a.equal(actions.topPopup(), 'overlay');
  a.equal(actions.dismissTop(), true);
  a.deepEqual(store.getState().overlay, { kind: 'collection', card: null }, '상세 → 목록');
  actions.dismissTop();
  a.equal(store.getState().overlay, null, '목록 → 닫기');
  a.equal(JSON.stringify([...data]), saved, '저장 그대로');
  a.equal(store.getState().meta.collection, undefined, '보유 기록을 만들지 않음');
});

test('카드 그림: 공통 프레임·이름표는 제공 원본과 픽셀이 같은 무손실 WebP, 캐릭터별 그림은 아직 없어 플레이스홀더', () => {
  const spec = JSON.parse(fs.readFileSync('docs/specs/images.json', 'utf8'));
  for (const [path, size] of [
    [cardFrame, [714, 1000]],
    [cardNameplate, [750, 279]],
  ]) {
    const key = path.replace('assets/', '');
    a.equal(spec[key].mode, 'lossless', key);
    a.deepEqual(spec[key].size, size, key);
    a(fs.existsSync('public/' + path), path);
  }
  for (const u of D.roster) a.deepEqual(cardArt(u.id), { background: null, character: null });
});

test('화면: 더보기 메뉴 맨 끝에 컬렉션 버튼, 기존 버튼 순서는 그대로, 뽑기·해금·돌파 동작 없음', () => {
  const hud = fs.readFileSync('src/ui/components/Hud.tsx', 'utf8');
  const order = ['시작 화면', '전체 조합', '패치노트', '새 원정', '테스트 무료 영입', '컬렉션'].map(
    (t) => hud.indexOf(t, hud.indexOf('function MorePopover')),
  );
  a(
    order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])),
    String(order),
  );
  const ui = fs.readFileSync('src/ui/components/Collection.tsx', 'utf8');
  for (const word of ['뽑기', '돌파', '해금', 'setItem', 'localStorage'])
    a(!ui.includes(word), word);
});
