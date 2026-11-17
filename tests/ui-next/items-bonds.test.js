// 새 화면 저장소: 아이템 드래그(장착·회수·버리기·되돌리기), 아이템 선택, 유대 추천.
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

test('아이템을 캐릭터에 놓으면 장착, 보관함에 놓으면 회수', () => {
  const { s, dragItem } = setup();
  const item = P.addItem(s().run, 'I01');
  const unit = s().run.units[0];
  dragItem(item.uid, `unit:${unit.uid}`);
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, unit.uid);
  dragItem(item.uid, 'inventory');
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, null);
  // 아무 곳도 아니면 변화 없음
  dragItem(item.uid, null);
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, null);
  a.equal(s().drag, null);
});

test('네 번째 아이템은 거절되고 알림 T23이 나온다', () => {
  const { s, dragItem } = setup();
  const unit = s().run.units[0];
  for (const id of ['I01', 'I02', 'I03']) dragItem(P.addItem(s().run, id).uid, `unit:${unit.uid}`);
  const fourth = P.addItem(s().run, 'I04');
  dragItem(fourth.uid, `unit:${unit.uid}`);
  a.equal(s().run.inventory.find((i) => i.uid === fourth.uid).equippedTo, null);
  a.equal(s().notice.id, 'T23');
});

test('휴지통에 놓으면 버리고 되돌리기로 복원된다', () => {
  const { store, s, dragItem } = setup();
  const item = P.addItem(s().run, 'I05');
  dragItem(item.uid, 'trash');
  a(!s().run.inventory.some((i) => i.uid === item.uid));
  store.actions.undoDiscard();
  a(s().run.inventory.some((i) => i.id === 'I05'));
});

test('아이템을 누르면 상세가 열리고 닫히며, 상세에서 회수할 수 있다', () => {
  const { store, s, dragItem } = setup();
  const item = P.addItem(s().run, 'I01');
  const unit = s().run.units[0];
  dragItem(item.uid, `unit:${unit.uid}`);
  store.actions.selectItem(item.uid);
  a.equal(s().selectedItem, item.uid);
  store.actions.unequipItem(item.uid);
  a.equal(s().selectedItem, null);
  a.equal(s().run.inventory.find((i) => i.uid === item.uid).equippedTo, null);
  store.actions.selectItem(item.uid);
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
