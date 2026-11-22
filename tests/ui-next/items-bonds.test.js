// 새 화면 저장소: 아이템 드래그(장착·조합·버리기·되돌리기), 회수기(v0.20.0), 아이템 선택, 유대 추천.
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createStore } from '../../src/ui/store.ts';
import P from '../../src/core/progression.js';

function setup() {
  let now = 5_000_000;
  const data = new Map();
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 9,
    now: () => new Date(now),
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  store.actions.startRun();
  const s = () => store.getState();
  const dragItem = (uid, over) => {
    store.actions.dragStart('item', uid, 2, 10, 10);
    store.actions.dragMove(2, 40, 10, over);
    store.actions.dragEnd(2, over);
    now += 500;
  };
  return { store, s, dragItem };
}

test('아이템을 캐릭터에 놓으면 장착, 보관함에 놓아도 회수되지 않고(v0.20.0) 회수기로만 되찾는다', () => {
  const { store, s, dragItem } = setup();
  const item = P.addItem(s().run, 'IB01');
  const unit = s().run.units[0];
  dragItem(item.uid, `unit:${unit.uid}`);
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, unit.uid);
  // 장착한 장비는 끌기 자체가 시작되지 않는다
  store.actions.dragStart('item', item.uid, 2, 10, 10);
  a.equal(s().drag, null);
  dragItem(item.uid, 'inventory');
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, unit.uid);
  // 회수기(새 원정 2개)를 캐릭터에 놓으면 장비 전부 보관함으로, 1개 소모, 알림 T48
  store.actions.dragStart('recovery', 'recovery', 3, 10, 10);
  store.actions.dragMove(3, 60, 10, `unit:${unit.uid}`);
  store.actions.dragEnd(3, `unit:${unit.uid}`);
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, null);
  a.equal(s().run.recoveryTools, 1);
  a.equal(s().notice.id, 'T48');
  a.equal(s().inventoryOpen, true, '보관함을 펼쳐 도착 칸을 보여 줌');
  // 장비 없는 캐릭터에 놓으면 소모 없음
  store.actions.dragStart('recovery', 'recovery', 4, 10, 10);
  store.actions.dragMove(4, 60, 10, `unit:${unit.uid}`);
  store.actions.dragEnd(4, `unit:${unit.uid}`);
  a.equal(s().run.recoveryTools, 1);
  a.equal(s().drag, null);
});

test('기본 장비 위에 기본 장비를 놓으면 조합(보관함·캐릭터), 알림 T47', () => {
  const { s, dragItem } = setup();
  const x = P.addItem(s().run, 'IB04'),
    y = P.addItem(s().run, 'IB05');
  dragItem(x.uid, `item:${y.uid}`);
  a(
    s().run.inventory.some((i) => P.itemById(i.id).name === '불멸의 갑옷' && i.equippedTo === null),
  );
  a.equal(s().notice.id, 'T47');
  const unit = s().run.units[0];
  dragItem(P.addItem(s().run, 'IB01').uid, `unit:${unit.uid}`);
  dragItem(P.addItem(s().run, 'IB03').uid, `unit:${unit.uid}`);
  a.deepEqual(
    s()
      .run.inventory.filter((i) => i.equippedTo === unit.uid)
      .map((i) => P.itemById(i.id).name),
    ['폭풍의 검'],
  );
});

test('완성 장비 3개를 든 캐릭터에 장비를 놓으면 거절되고 알림 T23이 나온다', () => {
  const { s, dragItem } = setup();
  const unit = s().run.units[0];
  for (const id of ['IC01', 'IC09', 'IC22'])
    dragItem(P.addItem(s().run, id).uid, `unit:${unit.uid}`);
  const fourth = P.addItem(s().run, 'IB04');
  dragItem(fourth.uid, `unit:${unit.uid}`);
  a.equal(s().run.inventory.find((i) => i.uid === fourth.uid).equippedTo, null);
  a.equal(s().notice.id, 'T23');
});

test('휴지통에 놓으면 버리고 되돌리기로 복원된다', () => {
  const { store, s, dragItem } = setup();
  const item = P.addItem(s().run, 'IB05');
  dragItem(item.uid, 'trash');
  a(!s().run.inventory.some((i) => i.uid === item.uid));
  store.actions.undoDiscard();
  a(s().run.inventory.some((i) => i.id === 'IB05'));
});

test('아이템을 누르면 상세가 열리고 닫힌다(장착 장비도, 무료 회수 버튼 없음)', () => {
  const { store, s, dragItem } = setup();
  const item = P.addItem(s().run, 'IB01');
  const unit = s().run.units[0];
  dragItem(item.uid, `unit:${unit.uid}`);
  store.actions.selectItem(item.uid);
  a.equal(s().selectedItem, item.uid);
  a.equal(store.actions.unequipItem, undefined);
  store.actions.selectItem(item.uid);
  a.equal(s().selectedItem, null);
});

test('유대 추천은 3개까지, 네 번째는 알림 T34', () => {
  const { store, s } = setup();
  for (const id of ['혈광', '월하', '종언']) store.actions.toggleRecommendation(id);
  a.deepEqual(s().run.recommendedBonds, ['혈광', '월하', '종언']);
  store.actions.toggleRecommendation('흑월');
  a.equal(s().notice.id, 'T34');
  a.equal(s().run.recommendedBonds.length, 3);
  store.actions.toggleRecommendation('월하');
  a.deepEqual(s().run.recommendedBonds, ['혈광', '종언']);
});
