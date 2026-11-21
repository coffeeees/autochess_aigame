// v0.18.3 상점·팝업 상호작용 요청: (1) 다음 라운드 준비 진입 때마다 영입창 자동 열기(v0.18.4 사용자 정정: 2-1 → 2-2도),
// (3) 끌기 시작하면 열린 일반 팝업 모두 닫기. (2) 3성 후보 유지는 tests/shop/core-shop.test.js.
// 화면 쪽 같은 누름 드래그 연결(usePopupDismiss)은 실제 브라우저에서 확인했다(패치노트 기록).
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import { createStore } from '../../src/ui/store.ts';
import P from '../../src/core/progression.js';

function setup({ presentation = false } = {}) {
  const data = new Map();
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 21,
    setTimer: () => 0,
    clearTimer: () => {},
    ...(presentation ? { presentation: { reduced: () => false } } : {}),
  });
  store.load();
  store.actions.startRun();
  const s = () => store.getState();
  /** stage-round 결과 단계로 만든 뒤 다음 라운드로 */
  const finish = (stage, round) => {
    Object.assign(s().run, { stage, round, roundPhase: 'result', augments: ['S07'] });
    s().run.augmentState.completedPicks = ['1-3', '3-3', '5-3'];
    s().run.completedRounds[P.label(s().run)] = { win: true };
    store.actions.continueRound();
  };
  return { store, s, data, finish };
}

test('영입창 자동 열기: 다음 라운드 준비에 들어갈 때마다(1-5 → 2-1, 2-1 → 2-2, 2-4 → 2-5) 한 번, 새 원정 1-1은 아님', () => {
  const { store, s, finish } = setup();
  a.equal(s().shopOpen, false, '새 원정 시작(1-1)에서는 열지 않음');
  finish(1, 5);
  a.equal(P.label(s().run), '2-1');
  a.equal(s().shopOpen, true, '2-1 준비 진입');
  store.actions.setShopOpen(false); // 수동 닫기 유지
  a.equal(s().shopOpen, false);
  store.actions.setShopOpen(true); // 수동 열기 유지
  store.actions.setShopOpen(false);
  finish(2, 1);
  a.equal(P.label(s().run), '2-2');
  a.equal(s().shopOpen, true, '같은 구간 안 이동도 연다(v0.18.4)');
  store.actions.setShopOpen(false);
  finish(2, 4);
  a.equal(s().shopOpen, true, '2-5');
});

test('영입창 자동 열기: ROUND·STAGE 안내 연출이 있으면 끝난 뒤 한 번만 연다', () => {
  const { store, s, finish } = setup({ presentation: true });
  finish(1, 5);
  const intro = s().cues.find((c) => c.kind === 'round');
  a(intro, 'ROUND 2 안내');
  a.equal(s().shopOpen, false, '안내 중에는 열지 않음');
  store.actions.doneCue(intro.key);
  a.equal(s().shopOpen, true, '안내가 끝나면 열림');
  store.actions.setShopOpen(false);
  store.actions.doneCue(intro.key); // 같은 신호를 다시 끝내도 다시 열리지 않음
  a.equal(s().shopOpen, false);
  finish(2, 1);
  const stage = s().cues.find((c) => c.kind === 'stage');
  a.equal(s().shopOpen, false, 'STAGE 안내 중에는 열지 않음');
  store.actions.doneCue(stage.key);
  a.equal(s().shopOpen, true, 'STAGE 안내가 끝나면 열림');
});

test('영입창 자동 열기: 증강 선택(필수 창)이 먼저면 선택 뒤에 열고, 6-5 종료 선택 뒤 7-1에서 연다', () => {
  const { store, s, finish } = setup();
  finish(2, 5);
  a.equal(s().shopOpen, true);
  store.actions.setShopOpen(false);
  // 3-2 → 3-3: 증강 선택 창이 먼저
  s().run.augmentState.completedPicks = ['1-3'];
  Object.assign(s().run, { stage: 3, round: 2, roundPhase: 'result' });
  s().run.completedRounds['3-2'] = { win: true };
  store.actions.continueRound();
  a.equal(s().modal, 'augment');
  a.equal(s().shopOpen, false, '필수 선택 창을 가리지 않음');
  store.actions.chooseAugment(P.availableAugments(s().run)[0].id);
  a.equal(s().shopOpen, true, '증강 선택 뒤 3-3 준비');
  store.actions.setShopOpen(false);
  // 6-5 정규 종료 선택 → 계속 진행 → 7-1
  Object.assign(s().run, { stage: 6, round: 5, roundPhase: 'result', completionChoice: 'pending' });
  s().run.completedRounds['6-5'] = { win: true };
  store.actions.continueRound();
  a.equal(s().modal, 'result', '종료 선택이 먼저');
  a.equal(s().shopOpen, false);
  store.actions.chooseCompletion('continue');
  a.equal(P.label(s().run), '7-1');
  a.equal(s().shopOpen, true, '선택 뒤 7-1 준비 진입');
});

test('영입창 자동 열기: 원정이 끝나면(6-5 뒤 종료) 열지 않음', () => {
  const { store, s } = setup();
  Object.assign(s().run, { stage: 6, round: 5, roundPhase: 'result', completionChoice: 'pending' });
  s().run.completedRounds['6-5'] = { win: true };
  store.actions.continueRound();
  store.actions.chooseCompletion('end');
  a.equal(s().shopOpen, false);
  a.equal(s().modal, 'summary');
});

test('영입창 자동 열기: 저장 불러오기·시작 화면 복귀로는 열리지 않음', () => {
  const { store, s, data, finish } = setup();
  finish(1, 5);
  store.actions.setShopOpen(false);
  store.actions.showHome();
  a.equal(s().shopOpen, false);
  // 같은 저장으로 새 저장소를 열어 불러오기
  const again = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 21,
    setTimer: () => 0,
    clearTimer: () => {},
  });
  again.load();
  a.equal(again.getState().shopOpen, false);
});

test('끌기 시작하면 열린 일반 팝업(영입창·설정·유대 미리보기·상세)을 모두 닫고, 움직이지 않으면 그대로', () => {
  const { store, s } = setup();
  const uid = s().run.units[0].uid;
  store.actions.setShopOpen(true);
  store.actions.setPopover('settings');
  store.actions.selectItem(null);
  store.actions.dragStart('unit', uid, 1, 100, 100);
  store.actions.dragMove(1, 102, 101, null); // 문턱 아래
  a.equal(s().shopOpen, true);
  a.equal(s().popover, 'settings');
  store.actions.dragMove(1, 140, 100, null);
  a.equal(s().drag.active, true);
  a.deepEqual(
    [s().shopOpen, s().popover, s().peek, s().selected, s().selectedItem, s().inspected],
    [false, null, null, null, null, null],
  );
  store.actions.dragEnd(1, `bench:${s().run.units[0].benchSlot}`);
  a.equal(s().drag, null);
});

test('화면 규칙: 드래그할 수 있는 캐릭터·아이템에 data-drag-source, 바깥 누름 훅은 그 누름을 막지 않음', () => {
  const pawn = fs.readFileSync('src/ui/components/Pawn.tsx', 'utf8');
  const items = fs.readFileSync('src/ui/components/Items.tsx', 'utf8');
  const hook = fs.readFileSync('src/ui/usePopupDismiss.ts', 'utf8');
  a(pawn.includes('data-drag-source'));
  a(items.includes('data-drag-source="item"'));
  const i = hook.indexOf("closest('[data-drag-source]')");
  a(i > 0 && i < hook.indexOf('e.stopPropagation()'), '막기 전에 드래그 대상이면 돌아감');
});
