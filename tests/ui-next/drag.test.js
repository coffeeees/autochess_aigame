// 5d단계: 새 UI 저장소의 캐릭터 드래그(v0.15.18 interaction-ui.js / drag-sales.js와
// 같은 규칙, 옛 UI 쪽은 tests/ui/drag-sales.test.js가 검사).
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createStore, parseDrop } from '../../src/ui/store.ts';
import { dragId } from '../../src/ui/notices.ts';
import { salePrice } from '../../src/core/shop.ts';

function setup() {
  let now = 1_000_000;
  const data = new Map();
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 5,
    now: () => new Date(now),
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  store.actions.startRun();
  const s = () => store.getState();
  const unit = () => s().run.units[0];
  const drag = (uid, to, path = [[20, 0]]) => {
    store.actions.dragStart('unit', uid, 1, 100, 100);
    for (const [dx, dy] of path) store.actions.dragMove(1, 100 + dx, 100 + dy, to);
    store.actions.dragEnd(1, to);
  };
  return { store, s, unit, drag, tick: (ms) => (now += ms) };
}

test('놓을 곳 해석, 드래그 알림 ID가 기존 정책과 같다', () => {
  a.deepEqual(parseDrop('board:38'), { kind: 'board', pos: 38 });
  a.deepEqual(parseDrop('bench:2'), { kind: 'bench', slot: 2 });
  a.deepEqual(parseDrop('sell:left'), { kind: 'sell', side: 'left' });
  a.equal(parseDrop('sell:up'), null);
  a.equal(parseDrop(null), null);
  const results = [
    { ok: true },
    { ok: false },
    { ok: false, message: '현재 레벨에서는 3명까지 배치할 수 있습니다.' },
    { ok: false, message: '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.' },
    { ok: false, message: '아군 진영 아래 4줄에만 배치할 수 있습니다.' },
    { ok: false, message: '캐릭터당 아이템은 최대 3개입니다.' },
  ];
  // v0.15.18 notice-policy.js dragId의 결과(기존 화면을 지우며 값으로 고정)
  const expected = {
    unit: ['T10', 'T12', 'T16', 'T15', 'T14', 'T23'],
    item: ['T11', 'T25', 'T25', 'T15', 'T14', 'T23'],
  };
  for (const kind of ['unit', 'item'])
    results.forEach((r, i) =>
      a.equal(dragId(kind, r), expected[kind][i], JSON.stringify([kind, r])),
    );
});

test('7px 미만은 클릭: 드래그·판매 영역 없음, 선택은 됨', () => {
  const { store, s, unit, tick } = setup();
  const uid = unit().uid;
  store.actions.dragStart('unit', uid, 1, 100, 100);
  store.actions.dragMove(1, 104, 104, 'sell:left'); // 5.7px 이동
  a.equal(s().drag.active, false);
  store.actions.dragEnd(1, 'sell:left');
  a.equal(s().drag, null);
  a(
    s().run.units.some((u) => u.uid === uid),
    'not sold',
  );
  tick(1);
  store.actions.select(uid);
  a.equal(s().selected, uid);
});

test('전장 칸에 놓으면 배치·저장, 적 진영 칸은 거절', () => {
  const { s, unit, drag } = setup();
  const uid = unit().uid;
  drag(uid, 'board:38');
  a.equal(s().run.units.find((u) => u.uid === uid).location, 'board');
  a.equal(s().run.units.find((u) => u.uid === uid).pos, 38);
  drag(uid, 'board:3');
  a.equal(s().run.units.find((u) => u.uid === uid).pos, 38, 'stays');
  a.equal(s().notice, null, 'T14 is silent in the policy');
  // 다시 대기석으로
  drag(uid, 'bench:5');
  const back = s().run.units.find((u) => u.uid === uid);
  a.equal(back.location, 'bench');
});

test('드래그가 시작되면 선택이 풀리고 직후 클릭은 무시된다', () => {
  const { store, s, unit, tick } = setup();
  const [first, second] = s().run.units;
  store.actions.select(first.uid);
  store.actions.dragStart('unit', second.uid, 1, 100, 100);
  store.actions.dragMove(1, 140, 100, null);
  a.equal(s().selected, null);
  a.equal(s().drag.active, true);
  store.actions.dragEnd(1, null);
  store.actions.select(second.uid);
  a.equal(s().selected, null, 'click within 400ms is ignored');
  tick(401);
  store.actions.select(second.uid);
  a.equal(s().selected, second.uid);
  void unit;
});

test('양쪽 판매 영역 모두 판매가로 한 번 판매, 바깥은 그대로', () => {
  const { s, unit, drag } = setup();
  for (const side of ['left', 'right']) {
    const target = unit();
    const gold = s().run.gold;
    drag(target.uid, 'sell:' + side);
    a.equal(s().run.gold, gold + salePrice(target));
    a(!s().run.units.some((u) => u.uid === target.uid));
  }
  const kept = unit();
  const gold = s().run.gold;
  drag(kept.uid, null);
  a.equal(s().run.gold, gold);
  a(s().run.units.some((u) => u.uid === kept.uid));
});

test('Esc·포커스 잃음·포인터 취소는 판매·이동하지 않는다', () => {
  const { store, s, unit } = setup();
  const target = unit();
  const before = JSON.stringify(s().run);
  store.actions.dragStart('unit', target.uid, 1, 100, 100);
  store.actions.dragMove(1, 160, 100, 'sell:left');
  store.actions.dragCancel();
  a.equal(s().drag, null);
  store.actions.dragEnd(1, 'sell:left'); // 취소 뒤 늦게 온 pointerup은 무시
  a.equal(JSON.stringify(s().run), before);
  // 다른 포인터는 남의 드래그를 끝낼 수 없다
  store.actions.dragStart('unit', target.uid, 7, 100, 100);
  store.actions.dragMove(8, 160, 100, 'sell:left');
  store.actions.dragEnd(8, 'sell:left');
  a.equal(JSON.stringify(s().run), before);
});
