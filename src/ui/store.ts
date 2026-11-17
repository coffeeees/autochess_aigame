// The single state store of the rebuilt UI. Components read the snapshot and call
// actions; actions call src/core functions only (no game rules here), save the run
// and publish a new snapshot.
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
  key: number; // changes for every notice, so the same text restarts its timer
}

/** Where a dragged unit can land: a board cell, a bench slot or a sell zone. */
export type DropTarget =
  | { kind: 'board'; pos: number }
  | { kind: 'bench'; slot: number }
  | { kind: 'sell'; side: 'left' | 'right' };

/** data-drop attribute value -> target ("board:38", "bench:2", "sell:left"). */
export function parseDrop(value: string | null | undefined): DropTarget | null {
  const [kind, arg] = (value ?? '').split(':');
  if (kind === 'board' && /^\d+$/.test(arg)) return { kind, pos: Number(arg) };
  if (kind === 'bench' && /^\d+$/.test(arg)) return { kind, slot: Number(arg) };
  if (kind === 'sell' && (arg === 'left' || arg === 'right')) return { kind, side: arg };
  return null;
}

export interface DragState {
  kind: 'unit';
  uid: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** false until the pointer has travelled DRAG_THRESHOLD px */
  active: boolean;
  /** data-drop value under the pointer */
  over: string | null;
}

export interface UiState {
  view: View;
  difficulty: number;
  run: RunState | null;
  /** a saved run exists (the start screen offers "continue") */
  hasSave: boolean;
  selected: number | null; // unit uid
  shopOpen: boolean;
  notice: Notice | null;
  /** shown on the start screen and once in game (damaged save, cancelled battle) */
  loadNotice: Omit<Notice, 'key'> | null;
  drag: DragState | null;
  /** bumps on every change; core functions mutate `run` in place */
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

  /** Read the save once at startup (same rules as the current UI, core/save.ts). */
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
  /** Cache the coming battle's formation on the run (as the current UI does on render). */
  function prepareFormation() {
    if (!state.run || state.run.done || state.run.roundPhase !== 'prepare') return;
    const before = state.run.enemyEncounter?.key;
    W.encounter(state.run);
    if (state.run.enemyEncounter?.key !== before) save();
  }
  const editable = () => !!state.run && !state.run.done && state.run.roundPhase === 'prepare';

  const actions = {
    showDifficulty: () => publish({ view: 'difficulty' }),
    showHome: () => publish({ view: 'home', shopOpen: false, selected: null }),
    chooseDifficulty: (difficulty: number) => publish({ difficulty }),
    /** New run with the chosen difficulty (replaces any saved run). */
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
    /** Press on a unit: becomes a drag after DRAG_THRESHOLD px of travel. */
    dragStart(uid: number, pointerId: number, x: number, y: number) {
      clickGuardUntil = 0;
      if (!editable()) return;
      publish({
        drag: {
          kind: 'unit',
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
      // the first real move starts the drag: the selection clears and the sale zones show
      const starting = !drag.active;
      publish({
        drag: { ...drag, active: true, x, y, over },
        ...(starting ? { selected: null } : {}),
      });
    },
    /** Release: sell on a sell zone, move on a cell/slot, otherwise keep the unit. */
    dragEnd(pointerId: number, over: string | null) {
      const drag = state.drag;
      if (!drag || drag.pointerId !== pointerId) return;
      if (!drag.active) return publish({ drag: null });
      clickGuardUntil = clock() + DRAG_CLICK_GUARD_MS;
      const target = parseDrop(over);
      if (target?.kind === 'sell') {
        publish({ drag: null });
        if (state.run && sellUnit(run(), drag.uid).ok) changed({ selected: null });
        return;
      }
      let result: { ok: boolean; message?: string } = {
        ok: false,
        message: '전장이나 대기석에 놓아주세요.',
      };
      if (target && state.run)
        result =
          target.kind === 'board'
            ? V.moveUnit(run(), drag.uid, { location: 'board', pos: target.pos })
            : V.moveUnit(run(), drag.uid, { location: 'bench', slot: target.slot });
      if (result.ok) changed({ drag: null });
      else publish({ drag: null });
      notify(dragId('unit', result), result.message || '캐릭터 이동 완료');
    },
    /** Escape, window blur, pointer cancel: nothing is moved or sold. */
    dragCancel() {
      if (!state.drag) return;
      if (state.drag.active) clickGuardUntil = clock() + DRAG_CLICK_GUARD_MS;
      publish({ drag: null });
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
