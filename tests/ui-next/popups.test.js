// 요청서(UI 복구): 팝업 바깥 클릭·Esc 닫기 순서, 전투 중 캐릭터 상세, 선택 증강 상세, 보관함 접기.
// 화면 쪽 처리(usePopupDismiss)는 저장소의 topPopup/dismissTop만 부르므로 여기서 규칙을 확인한다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createStore } from '../../src/ui/store.ts';
import V from '../../src/core/preparation.js';
import P from '../../src/core/progression.js';
import { placeNear } from '../../src/ui/components/UnitDetail.tsx';

function setup() {
  const data = new Map();
  let running = null;
  const combat = {
    warm() {},
    // 전투를 시작만 하고 끝내지 않는 실행기(전투 중 상태 확인용)
    start(battle, h) {
      running = { battle, h };
    },
    stop() {},
    setSpeed() {},
    pause() {},
    resume() {},
    visibility() {},
  };
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 21,
    combat,
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  store.actions.startRun();
  const s = () => store.getState();
  /** 1-3 준비 단계로 보내고 1명 배치 */
  const toBattleRound = () => {
    const r = s().run;
    r.roundPhase = 'prepare';
    r.round = 3;
    V.moveUnit(r, r.units[0].uid, { location: 'board', pos: 26 });
  };
  const finish = () => {
    let result = null;
    for (let i = 0; i < 20000 && !result; i++) result = running.battle.tick();
    running.h.onEnd(result);
  };
  return { store, s, a: store.actions, toBattleRound, finish };
}

test('바깥 클릭·Esc는 맨 위 팝업 하나만 닫는다: 덮개 창 > 설정·더보기 > 영입 > 상세 > 아이템 > 캐릭터', () => {
  const { s, a: act, toBattleRound } = setup();
  toBattleRound();
  const unit = s().run.units[0];
  act.select(unit.uid, 300, 400);
  a.deepEqual(s().anchor, { x: 300, y: 400 }, '누른 위치에 띄움');
  s().run.inventory.push({ uid: 'I9', id: 'I01', equippedTo: null });
  act.selectItem('I9');
  act.setPeek('bond', '무극', true);
  act.setShopOpen(true);
  act.setPopover('settings');
  act.openOverlay({ kind: 'guide' });
  const order = [];
  while (act.topPopup()) {
    order.push(act.topPopup());
    act.dismissTop();
  }
  // 덮개 창을 열면 설정·영입 창은 함께 닫힌다(기존 동작)
  a.deepEqual(order, ['overlay', 'peek', 'item', 'unit']);
  a.equal(s().selected, null);
  a.equal(act.dismissTop(), false, '닫을 것이 없으면 아무것도 안 함');
  act.setPopover('more');
  act.setShopOpen(true);
  a.equal(act.topPopup(), 'more');
  act.dismissTop();
  a.equal(s().shopOpen, true, '맨 위 하나만 닫힘');
  a.equal(act.topPopup(), 'shop');
});

test('보급·증강·결과·배치 확인 창은 바깥 클릭·Esc로 닫히지 않는다(덮개 창은 그 위에서 닫힘)', () => {
  const { store, s, a: act } = setup();
  act.primary();
  a.equal(s().modal, 'supply');
  act.setPopover('settings');
  a.equal(act.topPopup(), null, '확인 창이 열려 있으면 그 아래 팝업도 건드리지 않음');
  a.equal(act.dismissTop(), false);
  a.equal(s().modal, 'supply');
  act.openOverlay({ kind: 'codex', page: 'home' });
  a.equal(act.topPopup(), 'overlay');
  act.dismissTop();
  a.equal(s().overlay, null);
  a.equal(s().modal, 'supply', '보급 창은 그대로');
  store.actions.closeModal();
});

test('유대·증강 상세: 마우스 올림은 미리보기, 누르면 고정, 고정된 상세는 미리보기에 덮이지 않음', () => {
  const { s, a: act } = setup();
  act.setPeek('augment', 'S01', false);
  a.deepEqual(s().peek, { kind: 'augment', id: 'S01', pinned: false });
  act.endPreview();
  a.equal(s().peek, null, '마우스가 떠나면 미리보기 닫힘');
  act.setPeek('augment', 'S01', true);
  act.setPeek('augment', 'G02', false);
  a.equal(s().peek.id, 'S01', '고정된 상세 유지');
  act.endPreview();
  a.equal(s().peek.id, 'S01');
  act.setPeek('augment', 'S01', true);
  a.equal(s().peek, null, '같은 것을 다시 누르면 닫힘');
});

test('전투 중 캐릭터 상세: 전투 중에만 열리고, 전투는 멈추지 않으며, 전투가 끝나면 닫힌다', () => {
  const { s, a: act, toBattleRound, finish } = setup();
  act.inspect(1, 10, 10);
  a.equal(s().inspected, null, '준비 단계에서는 열리지 않음');
  toBattleRound();
  act.primary();
  act.confirmDeployment(true);
  a(s().battle, '전투 중');
  const enemy = s().battle.units.find((u) => u.team === 'enemy');
  act.inspect(enemy.uid, 500, 300);
  a.equal(s().inspected, enemy.uid, '적군도 볼 수 있음');
  a.equal(act.topPopup(), 'inspect');
  // 상세를 열어도 전투 계산은 그대로 진행된다
  const before = s().battle.time;
  s().battle.tick();
  a(s().battle.time > before);
  a.equal(s().inspected, enemy.uid);
  // 화면이 읽는 실시간 능력치 계산이 동작한다
  const stats = s().battle.stats(enemy);
  a(Number.isFinite(stats.AD) && stats.HP > 0);
  act.inspect(enemy.uid);
  a.equal(s().inspected, null, '같은 유닛을 다시 누르면 닫힘');
  act.inspect(enemy.uid, 1, 1);
  finish();
  a.equal(s().battle, null);
  a.equal(s().inspected, null, '전투가 끝나면 닫힘');
});

test('보관함 접기·펼치기는 아이템·장착·선택 상태를 바꾸지 않는다', () => {
  const { s, a: act } = setup();
  s().run.inventory.push({ uid: 'I7', id: 'I02', equippedTo: null });
  act.selectItem('I7');
  const before = JSON.stringify(s().run.inventory);
  a.equal(s().inventoryOpen, true);
  act.toggleInventory();
  a.equal(s().inventoryOpen, false);
  act.toggleInventory();
  a.equal(s().inventoryOpen, true);
  a.equal(JSON.stringify(s().run.inventory), before);
  a.equal(s().selectedItem, 'I7');
});

test('선택 증강 표시는 원정의 augments를 그대로 읽는다(저장·불러오기 뒤에도 같음, 새 원정은 비움)', () => {
  const { store, s } = setup();
  a.deepEqual(s().run.augments, [], '새 원정은 비어 있음');
  // 1-1·1-2 보급을 지나 1-3 증강 선택
  for (let n = 0; n < 2; n++) {
    store.actions.primary();
    store.actions.toggleSupply(0);
    store.actions.toggleSupply(1);
    store.actions.confirmSupply();
    store.actions.continueRound();
  }
  const pick = P.availableAugments(s().run)[0].id;
  store.actions.chooseAugment(pick);
  a.deepEqual(s().run.augments, [pick]);
  const reloaded = setup.reload ? null : JSON.parse(JSON.stringify(s().run));
  a.deepEqual(reloaded.augments, [pick], '저장 형식 그대로(augments 배열)');
  store.actions.setPeek('augment', pick, true);
  // 새 원정: 선택 증강과 열린 상세가 비워진다
  store.actions.confirmNewRun();
  store.actions.startRun();
  a.deepEqual(s().run.augments, []);
  a.equal(s().peek, null);
});

test('상세 창 위치: 누른 곳 오른쪽, 자리가 없으면 왼쪽, 항상 화면 안', () => {
  const view = { width: 1280, height: 720 };
  const box = { width: 320, height: 400 };
  a.deepEqual(placeNear(box, { x: 300, y: 200 }, view), { left: 337, top: 180 });
  a.deepEqual(placeNear(box, { x: 1100, y: 200 }, view), { left: 743, top: 180 });
  const low = placeNear(box, { x: 300, y: 700 }, view);
  a.equal(low.top, 720 - 400 - 8, '아래로 넘치지 않음');
  const edge = placeNear({ width: 1270, height: 100 }, { x: 5, y: 5 }, view);
  a(edge.left >= 8);
});
