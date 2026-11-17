// 새 UI의 상태 저장소(하나뿐). 컴포넌트는 스냅샷을 읽고 동작(actions)을 부른다.
// 동작은 src/core 함수만 호출하고(여기에 게임 규칙 없음), 원정을 저장한 뒤
// 새 스냅샷을 알린다.
import type { RunState } from '../core/types.ts';
import P from '../core/progression.js';
import V from '../core/preparation.js';
import Save, { type SaveStorage } from '../core/save.ts';
import { buyUnit, sellUnit } from '../core/shop.ts';
import { newRun } from '../core/run.ts';
import W from '../core/encounters.js';
import { allows, dragId, NOTICE_MS, DRAG_THRESHOLD, DRAG_CLICK_GUARD_MS } from './notices.ts';

export type View = 'home' | 'difficulty' | 'game';

export interface Notice {
  id: string;
  text: string;
  key: number; // 알림마다 바뀌어서, 같은 문구라도 타이머가 다시 시작된다
}

/** 끈 캐릭터를 놓을 수 있는 곳: 전장 칸, 대기석 칸, 판매 영역. */
export type DropTarget =
  | { kind: 'board'; pos: number }
  | { kind: 'bench'; slot: number }
  | { kind: 'sell'; side: 'left' | 'right' };

/** data-drop 값 → 놓을 곳("board:38", "bench:2", "sell:left"). */
export function parseDrop(value: string | null | undefined): DropTarget | null {
  const [kind, arg] = (value ?? '').split(':');
  if (kind === 'board' && /^\d+$/.test(arg)) return { kind, pos: Number(arg) };
  if (kind === 'bench' && /^\d+$/.test(arg)) return { kind, slot: Number(arg) };
  if (kind === 'sell' && (arg === 'left' || arg === 'right')) return { kind, side: arg };
  return null;
}

export interface DragState {
  /** 'unit': 캐릭터(uid 숫자), 'item': 아이템(uid 문자열 'I12') */
  kind: 'unit' | 'item';
  uid: number | string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** 포인터가 DRAG_THRESHOLD px 움직이기 전까지는 false */
  active: boolean;
  /** 포인터 아래의 놓을 곳(캐릭터: data-drop, 아이템: data-item-drop 값) */
  over: string | null;
}

export interface UiState {
  view: View;
  difficulty: number;
  run: RunState | null;
  /** 저장된 원정이 있음(시작 화면에 "이어하기" 표시) */
  hasSave: boolean;
  selected: number | null; // 선택한 캐릭터 uid
  shopOpen: boolean;
  notice: Notice | null;
  /** 시작 화면과 게임 진입 때 한 번 보이는 알림(손상 저장, 취소된 전투) */
  loadNotice: Omit<Notice, 'key'> | null;
  drag: DragState | null;
  /** 상세 창이 열린 아이템 uid */
  selectedItem: string | null;
  /** 변경마다 증가. core 함수는 `run`을 그 자리에서 바꾼다 */
  version: number;
}

export interface StoreEnv {
  storage: SaveStorage;
  newSeed: () => number;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export function createStore(env: StoreEnv) {
  const setTimer = env.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = env.clearTimer ?? ((id) => clearTimeout(id as number));
  let state: UiState = {
    view: 'home',
    difficulty: 1,
    run: null,
    hasSave: false,
    selected: null,
    shopOpen: false,
    notice: null,
    loadNotice: null,
    drag: null,
    selectedItem: null,
    version: 0,
  };
  let clickGuardUntil = 0;
  const clock = () => (env.now?.() ?? new Date()).getTime();
  let nextUid = 0;
  let noticeKey = 0;
  let noticeTimer: unknown = null;
  let saveFailed = false;
  const listeners = new Set<() => void>();

  const publish = (patch: Partial<UiState> = {}) => {
    state = { ...state, ...patch, version: state.version + 1 };
    listeners.forEach((l) => l());
  };

  function notify(id: string, text: string): boolean {
    if (!allows(id)) return false;
    clearTimer(noticeTimer);
    const key = ++noticeKey;
    noticeTimer = setTimer(() => {
      if (state.notice?.key === key) publish({ notice: null });
    }, NOTICE_MS);
    publish({ notice: { id, text, key } });
    return true;
  }

  function save() {
    if (!state.run) return;
    try {
      env.storage.setItem(Save.SAVE_KEY, JSON.stringify(state.run));
      saveFailed = false;
      if (!state.hasSave) state = { ...state, hasSave: true };
    } catch {
      if (!saveFailed)
        notify('T42', '진행 상황을 저장하지 못했습니다. 저장 공간이나 브라우저 설정을 확인하세요.');
      saveFailed = true;
    }
  }
  const changed = (patch: Partial<UiState> = {}) => {
    save();
    publish(patch);
  };

  /** 시작할 때 저장을 한 번 읽는다(기존 UI와 같은 규칙, core/save.ts). */
  function load() {
    const result = Save.loadSave(env.storage, env.now?.() ?? new Date());
    if (result.status === 'loaded') {
      nextUid = result.nextUid;
      let loadNotice: UiState['loadNotice'] = null;
      if (result.reverted) {
        const loot = result.reverted.loot;
        loadNotice = {
          id: 'T44',
          text:
            `전투 도중 종료되어 ${result.reverted.key} 전투를 취소했습니다.` +
            (loot?.kind === 'gold'
              ? ` 이 전투에서 얻은 보너스 골드 ${loot.amount}G를 되돌렸습니다.`
              : '') +
            (loot?.kind === 'item' ? ' 이 전투에서 얻은 보너스 아이템을 되돌렸습니다.' : '') +
            ' 준비 단계에서 다시 시작하세요.',
        };
      }
      state = { ...state, run: result.state, hasSave: true, loadNotice };
      if (result.reverted) save();
    } else if (result.status === 'invalid') {
      state = {
        ...state,
        loadNotice: {
          id: 'T43',
          text: result.backupKey
            ? `저장 데이터가 손상되어 새 원정을 시작했습니다. 기존 저장은 ${result.backupKey}에 백업했습니다.`
            : '저장 데이터를 읽지 못해 새 원정을 시작했습니다. 기존 저장을 백업하지 못했습니다.',
        },
      };
    }
    publish();
  }

  const run = () => state.run as RunState;
  /** 다가올 전투의 적 편성을 원정에 캐시한다(기존 UI가 그릴 때 하던 일). */
  function prepareFormation() {
    if (!state.run || state.run.done || state.run.roundPhase !== 'prepare') return;
    const before = state.run.enemyEncounter?.key;
    W.encounter(state.run);
    if (state.run.enemyEncounter?.key !== before) save();
  }
  const editable = () => !!state.run && !state.run.done && state.run.roundPhase === 'prepare';

  /** 아이템 놓기: 캐릭터에 장착, 보관함으로 회수, 휴지통에 버리기 */
  function dropItem(itemUid: string, over: string | null) {
    const [kind, arg] = (over ?? '').split(':');
    let result: { ok: boolean; message?: string } = {
      ok: false,
      message: '아군 캐릭터 또는 보관함에 놓아주세요.',
    };
    if (state.run && kind === 'unit' && /^\d+$/.test(arg))
      result = V.transferItem(run(), itemUid, Number(arg));
    else if (state.run && kind === 'trash')
      result = {
        ok: P.discardItem(run(), itemUid),
        message: '아이템을 버렸습니다. 되돌리기로 복원할 수 있습니다.',
      };
    else if (state.run && kind === 'inventory') {
      const item = run().inventory.find((i) => i.uid === itemUid);
      result = { ok: item?.equippedTo === null || !!P.unequip(run(), itemUid) };
    }
    if (result.ok) changed({ drag: null });
    else publish({ drag: null });
    notify(
      dragId('item', result),
      result.message || (result.ok ? '아이템 이동 완료' : '아이템을 옮길 수 없습니다.'),
    );
  }

  const actions = {
    showDifficulty: () => publish({ view: 'difficulty' }),
    showHome: () => publish({ view: 'home', shopOpen: false, selected: null }),
    chooseDifficulty: (difficulty: number) => publish({ difficulty }),
    /** 고른 난이도로 새 원정 시작(저장된 원정은 교체). */
    startRun() {
      const created = newRun({
        seed: env.newSeed(),
        difficulty: state.difficulty,
        firstUid: nextUid + 1,
      });
      nextUid += created.units.length;
      state = { ...state, run: created };
      prepareFormation();
      changed({ view: 'game', selected: null, shopOpen: false });
    },
    continueRun() {
      if (!state.run) return;
      const pending = state.loadNotice;
      prepareFormation();
      publish({ view: 'game', loadNotice: null });
      if (pending) notify(pending.id, pending.text);
    },
    select(uid: number | null) {
      if (!editable() || clock() < clickGuardUntil) return;
      publish({ selected: state.selected === uid ? null : uid });
    },
    setShopOpen: (open: boolean) => publish({ shopOpen: open }),
    /** 누르기: DRAG_THRESHOLD px 움직이면 드래그가 된다. */
    dragStart(
      kind: DragState['kind'],
      uid: number | string,
      pointerId: number,
      x: number,
      y: number,
    ) {
      clickGuardUntil = 0;
      if (!editable()) return;
      publish({
        drag: {
          kind,
          uid,
          pointerId,
          startX: x,
          startY: y,
          x,
          y,
          active: false,
          over: null,
        },
      });
    },
    dragMove(pointerId: number, x: number, y: number, over: string | null) {
      const drag = state.drag;
      if (!drag || drag.pointerId !== pointerId) return;
      if (!drag.active && Math.hypot(x - drag.startX, y - drag.startY) < DRAG_THRESHOLD) return;
      // 처음 실제로 움직일 때 드래그 시작: 선택이 풀리고 판매 영역이 나타난다
      const starting = !drag.active;
      publish({
        drag: { ...drag, active: true, x, y, over },
        ...(starting ? { selected: null, selectedItem: null } : {}),
      });
    },
    /** 놓기: 판매 영역이면 판매, 칸이면 이동, 그 밖이면 그대로. */
    dragEnd(pointerId: number, over: string | null) {
      const drag = state.drag;
      if (!drag || drag.pointerId !== pointerId) return;
      if (!drag.active) return publish({ drag: null });
      clickGuardUntil = clock() + DRAG_CLICK_GUARD_MS;
      if (drag.kind === 'item') return dropItem(drag.uid as string, over);
      const uid = drag.uid as number;
      const target = parseDrop(over);
      if (target?.kind === 'sell') {
        publish({ drag: null });
        if (state.run && sellUnit(run(), uid).ok) changed({ selected: null });
        return;
      }
      let result: { ok: boolean; message?: string } = {
        ok: false,
        message: '전장이나 대기석에 놓아주세요.',
      };
      if (target && state.run)
        result =
          target.kind === 'board'
            ? V.moveUnit(run(), uid, { location: 'board', pos: target.pos })
            : V.moveUnit(run(), uid, { location: 'bench', slot: target.slot });
      if (result.ok) changed({ drag: null });
      else publish({ drag: null });
      notify(dragId('unit', result), result.message || '캐릭터 이동 완료');
    },
    /** Esc, 창 포커스 잃음, 포인터 취소: 아무것도 옮기거나 팔지 않는다. */
    dragCancel() {
      if (!state.drag) return;
      if (state.drag.active) clickGuardUntil = clock() + DRAG_CLICK_GUARD_MS;
      publish({ drag: null });
    },
    /** 아이템 클릭: 상세 창을 열고 닫는다(드래그 직후 클릭은 무시). */
    selectItem(uid: string | null) {
      if (clock() < clickGuardUntil) return;
      publish({ selectedItem: state.selectedItem === uid ? null : uid });
    },
    /** 장착 중인 아이템을 보관함으로 회수 */
    unequipItem(uid: string) {
      if (!state.run || !P.unequip(run(), uid)) return;
      changed({ selectedItem: null });
      notify('T31', '아이템을 보관함으로 회수했습니다.');
    },
    undoDiscard() {
      if (!state.run || !P.undoDiscard(run())) return;
      changed();
      notify('T30', '마지막으로 버린 아이템을 복원했습니다.');
    },
    /** 유대 추천 켜기/끄기(최대 3개, 상점 추천 표시에 쓰임) */
    toggleRecommendation(bondId: string) {
      if (!state.run) return;
      const result = V.toggleRecommendation(run(), bondId);
      if (result.ok) changed();
      else
        notify(
          'T34',
          result.message ?? '추천은 최대 3개까지 선택할 수 있습니다. 먼저 하나를 해제해 주세요.',
        );
    },
    buy(slot: number) {
      if (!state.run) return;
      const id = run().shop[slot];
      if (!id) return;
      const result = buyUnit(run(), id, { uid: nextUid + 1, slot });
      if (!result.ok) {
        if (result.notice === 'T04')
          notify('T04', '이미 3성을 보유한 캐릭터는 판매 후 다시 영입할 수 있습니다.');
        if (result.notice === 'T05') notify('T05', '대기석이 가득 찼습니다.');
        if (result.notice === 'T06') notify('T06', '골드가 부족합니다.');
        return;
      }
      nextUid++;
      changed(result.merges.length ? { selected: null } : {});
    },
    sell(uid: number) {
      if (!state.run || !sellUnit(run(), uid).ok) return;
      changed({ selected: null });
    },
    reroll() {
      if (!state.run || !V.manualReroll(run())) return;
      changed();
    },
    buyXp() {
      if (!state.run || !P.buyXp(run())) return;
      changed();
    },
    toggleShopLock() {
      if (!state.run || !V.editable(run())) return;
      run().shopLocked = !run().shopLocked;
      changed();
    },
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    notify,
    actions,
  };
}

export type Store = ReturnType<typeof createStore>;
