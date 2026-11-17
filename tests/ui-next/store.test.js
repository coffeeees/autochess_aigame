// 5c단계: 새 UI의 상태 저장소(src/ui/store.ts)와 알림 정책.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import { createStore } from '../../src/ui/store.ts';
import { allows, RETAINED, APPROVED, ADDED } from '../../src/ui/notices.ts';
import D from '../../src/core/data/units.js';
import P from '../../src/core/progression.js';

const Policy = require('../../src/legacy/notice-policy');
const KEY = 'starlight-onecost-v1';

function setup(initial = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    fail: false,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem(k, v) {
      if (this.fail) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
  };
  const timers = [];
  const store = createStore({
    storage,
    newSeed: () => 77,
    now: () => new Date('2026-11-17T00:00:00Z'),
    setTimer: (fn) => timers.push(fn),
    clearTimer: () => {},
  });
  store.load();
  return { store, storage, data, timers, s: () => store.getState() };
}

test('알림 정책이 기존 UI 정책과 같다', () => {
  for (let i = 1; i <= 50; i++) {
    const id = 'T' + String(i).padStart(2, '0');
    a.equal(allows(id), Policy.allows(id), id);
  }
  a.deepEqual([...RETAINED], Policy.retained);
  a.deepEqual([...ADDED], Policy.added);
  a.deepEqual([...APPROVED], ['T28']);
});

test('시작 화면, 난이도, 새 원정이 저장된다', () => {
  const { store, data, s } = setup();
  a.equal(s().view, 'home');
  a.equal(s().hasSave, false);
  store.actions.showDifficulty();
  store.actions.chooseDifficulty(4);
  store.actions.startRun();
  a.equal(s().view, 'game');
  a.equal(s().run.difficulty, 4);
  a.equal(s().run.gold, 7);
  a.deepEqual(
    s().run.units.map((u) => u.uid),
    [1, 2, 3],
  );
  a(s().hasSave);
  a.deepEqual(JSON.parse(data.get(KEY)), JSON.parse(JSON.stringify(s().run)));
});

test('구매·선택·판매·새로고침·XP·잠금이 core를 거쳐 저장된다', () => {
  const { store, data, s } = setup();
  store.actions.startRun();
  const run = s().run;
  run.gold = 30;
  const version = s().version;
  store.actions.buy(0); // 고정된 첫 상점의 C02
  a.equal(s().run.gold, 30 - D.byId('C02').cost);
  a.equal(s().run.shop[0], null);
  a(s().version > version, 'publishes a new snapshot');
  const bought = s().run.units.find((u) => u.id === 'C02' && u.uid === 4);
  a(bought);
  store.actions.select(bought.uid);
  a.equal(s().selected, bought.uid);
  store.actions.sell(bought.uid);
  a.equal(s().selected, null);
  a(!s().run.units.some((u) => u.uid === bought.uid));
  const before = s().run.gold;
  store.actions.reroll();
  a.equal(s().run.gold, before - P.rerollCost(s().run));
  store.actions.buyXp();
  a.equal(s().run.xp, 4);
  store.actions.toggleShopLock();
  a.equal(s().run.shopLocked, true);
  a.deepEqual(JSON.parse(data.get(KEY)).shopLocked, true);
});

test('거절 시 허용된 알림만 보이고, 숨김 알림은 보이지 않는다', () => {
  const { store, s, timers } = setup();
  store.actions.startRun();
  s().run.gold = 0;
  store.actions.buy(1);
  a.equal(s().notice.id, 'T06');
  a.equal(s().notice.text, '골드가 부족합니다.');
  timers.at(-1)();
  a.equal(s().notice, null, 'notice disappears after its timer');
  a.equal(store.notify('T07', 'recruited'), false);
  a.equal(s().notice, null);
});

test('불러오기: v0.15.18 저장은 이어지고, 손상 저장은 시작 화면에 T43', () => {
  const raw = fs.readFileSync('tests/fixtures/v0.15.18-prepare-with-augment.json', 'utf8');
  const ok = setup({ [KEY]: raw });
  a(ok.s().hasSave);
  a.equal(ok.s().run.gold, JSON.parse(raw).gold);
  ok.store.actions.continueRun();
  a.equal(ok.s().view, 'game');
  a.equal(ok.s().run.enemyEncounter.key, P.label(ok.s().run), 'formation prepared on entry');

  const bad = setup({ [KEY]: '{oops' });
  a.equal(bad.s().hasSave, false);
  a.equal(bad.s().loadNotice.id, 'T43');
  a([...bad.data.keys()].some((k) => k.startsWith(KEY + '-backup-')));
});

test('저장소가 실패하면 T42를 한 번만 알린다', () => {
  const { store, storage, s } = setup();
  store.actions.startRun();
  storage.fail = true;
  store.actions.buyXp();
  a.equal(s().notice.id, 'T42');
  const key = s().notice.key;
  store.actions.toggleShopLock();
  a.equal(s().notice.key, key, 'not repeated while failing');
});
