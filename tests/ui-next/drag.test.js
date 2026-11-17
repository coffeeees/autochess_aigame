// Stage 5d: dragging units in the rebuilt UI store (same rules as v0.15.18
// interaction-ui.js / drag-sales.js, covered there by tests/ui/drag-sales.test.js).
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createStore, parseDrop } from '../../src/ui/store.ts';
import { dragId } from '../../src/ui/notices.ts';
import { salePrice } from '../../src/core/shop.ts';

const Policy = require('../../src/legacy/notice-policy');

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
    store.actions.dragStart(uid, 1, 100, 100);
    for (const [dx, dy] of path) store.actions.dragMove(1, 100 + dx, 100 + dy, to);
    store.actions.dragEnd(1, to);
  };
  return { store, s, unit, drag, tick: (ms) => (now += ms) };
}

test('drop targets parse; drag notice ids match the current policy', () => {
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
  for (const kind of ['unit', 'item'])
    for (const r of results)
      a.equal(dragId(kind, r), Policy.dragId(kind, r), JSON.stringify([kind, r]));
});

test('below 7px a press is a click: no drag, no sale zones, selection works', () => {
  const { store, s, unit, tick } = setup();
  const uid = unit().uid;
  store.actions.dragStart(uid, 1, 100, 100);
  store.actions.dragMove(1, 104, 104, 'sell:left'); // 5.7px
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

test('dragging to a board cell places the unit and saves; enemy rows are refused', () => {
  const { s, unit, drag } = setup();
  const uid = unit().uid;
  drag(uid, 'board:38');
  a.equal(s().run.units.find((u) => u.uid === uid).location, 'board');
  a.equal(s().run.units.find((u) => u.uid === uid).pos, 38);
  drag(uid, 'board:3');
  a.equal(s().run.units.find((u) => u.uid === uid).pos, 38, 'stays');
  a.equal(s().notice, null, 'T14 is silent in the policy');
  // back to the bench
  drag(uid, 'bench:5');
  const back = s().run.units.find((u) => u.uid === uid);
  a.equal(back.location, 'bench');
});

test('the drag starts by clearing the selection and blocks the click right after', () => {
  const { store, s, unit, tick } = setup();
  const [first, second] = s().run.units;
  store.actions.select(first.uid);
  store.actions.dragStart(second.uid, 1, 100, 100);
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

test('either sell zone sells once at the sale price; outside keeps the unit', () => {
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

test('Escape / blur / pointer cancel never sell or move', () => {
  const { store, s, unit } = setup();
  const target = unit();
  const before = JSON.stringify(s().run);
  store.actions.dragStart(target.uid, 1, 100, 100);
  store.actions.dragMove(1, 160, 100, 'sell:left');
  store.actions.dragCancel();
  a.equal(s().drag, null);
  store.actions.dragEnd(1, 'sell:left'); // a late pointerup after cancel is inert
  a.equal(JSON.stringify(s().run), before);
  // another pointer cannot finish someone else's drag
  store.actions.dragStart(target.uid, 7, 100, 100);
  store.actions.dragMove(8, 160, 100, 'sell:left');
  store.actions.dragEnd(8, 'sell:left');
  a.equal(JSON.stringify(s().run), before);
});
