// 새 UI의 상태 저장소(하나뿐). 컴포넌트는 스냅샷을 읽고 동작(actions)을 부른다.
// 동작은 src/core 함수만 호출하고(여기에 게임 규칙 없음), 원정을 저장한 뒤
// 새 스냅샷을 알린다.
import type { RunState } from '../core/types.ts';
import P from '../core/progression.js';
import V from '../core/preparation.js';
import Save, { type SaveStorage } from '../core/save.ts';
import { buyUnit, sellUnit } from '../core/shop.ts';
import { newRun, battleSetup } from '../core/run.ts';
import Engine from '../core/combat/battle.js';
import type { CombatRunner, LiveBattle } from './combat/runner.ts';
import W from '../core/encounters.js';
import M, { type MetaProfile, type MetaReason } from '../core/meta.ts';
import U from '../core/meta-upgrades.ts';
import { durations } from './render/plan.ts';
import { allows, dragId, NOTICE_MS, DRAG_THRESHOLD, DRAG_CLICK_GUARD_MS } from './notices.ts';

export type View = 'home' | 'difficulty' | 'game' | 'abilities';

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
  modal: Modal;
  /** 진행 중인 전투(없으면 null). 스냅샷마다 version이 바뀐다 */
  battle: LiveBattle | null;
  /** 직전 전투(결과 창의 딜 그래프용) */
  lastBattle: LiveBattle | null;
  /** 메타 레벨 프로필(원정 사이에 이어짐, 저장 키 autochess-meta-v1) */
  meta: MetaProfile;
  /** 개발용 메타 테스트 프로필 사용 중(주소에 ?metadev, 저장 키 autochess-meta-dev-v1). 정식 UI에는 표시 안 함 */
  metaDev: boolean;
  /** 능력치 화면: 고른 계열·노드, 방금 강화한 노드(짧은 발광) */
  abilities: {
    branch: 'A' | 'D' | 'E' | 'G' | 'S';
    node: string;
    flash: { id: string; key: number } | null;
  };
  speed: 1 | 2 | 4;
  overlay: Overlay | null;
  /** HUD 메뉴의 작은 창 */
  popover: 'settings' | 'more' | null;
  /** 유대·선택 증강 상세(마우스를 올리면 미리보기, 누르면 고정) */
  peek: { kind: 'bond' | 'augment'; id: string; pinned: boolean } | null;
  /** 전투 중 상세 창을 연 전투 유닛 uid(전투는 멈추지 않음) */
  inspected: number | null;
  /** 캐릭터 상세 창을 띄울 기준 위치(누른 곳의 화면 좌표) */
  anchor: { x: number; y: number } | null;
  /** 아이템 보관함 펼침 */
  inventoryOpen: boolean;
  /** 설정의 임시 규칙(v0.15.18 설정 창 체크박스) */
  quickMana: boolean;
  experimental: boolean;
  /** 재생할 화면 연출 */
  cues: Cue[];
  /** 전투가 끝난 뒤 마지막 장면을 보여 주는 동안의 전투(결과 창 전) */
  finishing: LiveBattle | null;
  /** 변경마다 증가. core 함수는 `run`을 그 자리에서 바꾼다 */
  version: number;
}

/** 도감·패치노트 같은 덮개 창(라운드 흐름 창보다 위에 열린다) */
export type Overlay =
  | { kind: 'codex'; page: 'home' | 'characters' | 'bonds' | 'augments' | 'items' }
  | { kind: 'character'; id: string; back: Overlay | null }
  | { kind: 'patch' }
  | { kind: 'guide' }
  | { kind: 'rules' }
  | { kind: 'reset' };

/**
 * 화면 연출 신호(6단계). 게임 상태와 무관하고, 연출 컴포넌트가 재생한 뒤 doneCue로 지운다.
 *   round:  라운드 1 시작 안내(ROUND n)    stage: 그 밖의 라운드 안내(STAGE s-r)
 *   health: 전투 뒤 하트 체력 변화           merge: 같은 캐릭터 3명이 합쳐짐
 */
export type Cue =
  | { key: number; kind: 'round' | 'stage'; stage: number; round: number }
  | { key: number; kind: 'health'; before: number; after: number; win: boolean }
  | {
      key: number;
      kind: 'merge';
      keep: number;
      star: number;
      parts: { id: string; star: number; drop: string }[];
    };
type CueInput = Cue extends infer C ? (C extends Cue ? Omit<C, 'key'> : never) : never;

/** 바깥 클릭·Esc로 닫을 수 있는 팝업(DOM의 data-popup 값과 같다) */
export type PopupName =
  | 'overlay'
  | 'settings'
  | 'more'
  | 'shop'
  | 'peek'
  | 'item'
  | 'inspect'
  | 'unit';

/** 화면 가운데 창 */
export type Modal = 'supply' | 'augment' | 'result' | 'deploy' | 'summary' | null;

export interface StoreEnv {
  storage: SaveStorage;
  newSeed: () => number;
  /** 전투 실행기(Worker). 없으면 전투를 시작하지 않는다(일부 테스트). */
  combat?: CombatRunner;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  /**
   * 화면 연출을 켠다(브라우저). 없으면(테스트) 전투가 끝나자마자 결과 창을 열고 연출 신호를 만들지 않는다.
   * reduced: 움직임 줄이기 설정
   */
  presentation?: { reduced: () => boolean };
  /** 개발용 메타 테스트 프로필(별도 저장 키, 전투 로그에 메타 강화 전후 수치). 정식 화면에서는 끔 */
  metaDev?: boolean;
}

export function createStore(env: StoreEnv) {
  const setTimer = env.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = env.clearTimer ?? ((id) => clearTimeout(id as number));
  let state: UiState = {
    view: 'home',
    difficulty: 1,
    run: null,
    metaDev: !!env.metaDev,
    abilities: { branch: 'A', node: 'A1', flash: null },
    hasSave: false,
    selected: null,
    shopOpen: false,
    notice: null,
    loadNotice: null,
    drag: null,
    selectedItem: null,
    modal: null,
    battle: null,
    lastBattle: null,
    speed: 1,
    overlay: null,
    popover: null,
    peek: null,
    inspected: null,
    anchor: null,
    inventoryOpen: true,
    quickMana: false,
    experimental: true,
    cues: [],
    finishing: null,
    meta: M.newProfile(),
    version: 0,
  };
  let clickGuardUntil = 0;
  let buyGuardUntil = 0;
  let flashKey = 0;
  /**
   * 다음 라운드 준비에 들어갈 때마다 동료 영입창을 한 번 자동으로 연다(v0.18.3 요청, v0.18.4에서 사용자가
   * "다음 라운드로 넘어갈 때마다"로 정정: 같은 구간 안 이동 2-1 → 2-2도, 증강 선택 뒤도 연다).
   * ROUND·STAGE 안내 연출이 있으면 그것이 끝난 뒤(doneCue) 연다. 저장에 넣지 않아 불러오기·화면 복귀로는 열리지 않는다.
   */
  let autoShopCue: number | null = null;
  /** 준비 단계에 막 들어왔을 때: 안내 신호(intro)가 있으면 끝난 뒤, 없으면 바로 영입창을 연다 */
  function openShopAfter(intro: Partial<UiState>): Partial<UiState> {
    const r = state.run;
    const ready = !!r && !r.done && r.roundPhase === 'prepare';
    const key = intro.cues?.at(-1)?.key ?? null;
    autoShopCue = ready && key !== null ? key : null;
    return ready && key === null ? { shopOpen: true } : {};
  }
  const clock = () => (env.now?.() ?? new Date()).getTime();
  let nextUid = 0;
  let noticeKey = 0;
  let noticeTimer: unknown = null;
  let saveFailed = false;
  let cueKey = 0;
  let finishTimer: unknown = null;
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
    settleMeta();
  }

  /** 메타 XP 알림 문구: "이전 원정을 포기해 메타 XP +13 · Lv.2 (5 / 10 XP) · 성장 포인트 +2 · 뽑기 티켓 +2" */
  function metaText(
    prefix: string,
    p: {
      xp: number;
      after: { level: number; xp: number };
      rewards?: { points: number; tickets: number };
    },
  ) {
    const gain = p.rewards?.points
      ? ` · 성장 포인트 +${p.rewards.points} · 뽑기 티켓 +${p.rewards.tickets}`
      : '';
    return `${prefix} 메타 XP +${p.xp} · Lv.${p.after.level} (${M.progressLabel(p.after.level, p.after.xp)})${gain}`;
  }

  /** 정식 프로필 키, 개발 모드(?metadev)면 따로 쓰는 테스트 프로필 키 */
  const metaKey = env.metaDev ? M.META_DEV_KEY : M.META_KEY;
  /**
   * 메타 프로필을 읽는다. 읽을 수 없거나 잘못된 값이면 새 프로필(저장은 지우지 않음).
   * 예전 프로필(성장 포인트 원장 없음)은 normalizeProfile이 지금 레벨까지의 보상을 한 번 소급하고, 바로 저장해
   * 다시 열어도 원장 기준으로 중복 지급하지 않는다. 읽기에 실패하면 원본을 백업 키에 남긴다.
   */
  function loadMeta(): MetaProfile {
    let raw: string | null = null;
    try {
      raw = env.storage.getItem(metaKey);
      const profile = M.normalizeProfile(raw === null ? null : JSON.parse(raw));
      if (raw !== null && JSON.stringify(profile) !== raw) {
        state = { ...state, meta: profile };
        saveMeta();
      }
      return profile;
    } catch (error) {
      console.error('메타 프로필을 읽지 못했습니다(원본은 백업 키에 보관):', error);
      try {
        if (raw !== null) env.storage.setItem(`${metaKey}-backup-${clock()}`, raw);
      } catch {
        /* 백업도 못 하면 원본 키를 덮어쓰지 않도록 아래에서 새 프로필만 메모리에 둔다 */
      }
      return M.newProfile();
    }
  }
  function saveMeta() {
    try {
      env.storage.setItem(metaKey, JSON.stringify(state.meta));
    } catch {
      if (!saveFailed)
        notify('T42', '진행 상황을 저장하지 못했습니다. 저장 공간이나 브라우저 설정을 확인하세요.');
      saveFailed = true;
    }
  }
  /**
   * 원정이 끝났으면(게임 오버·6-5 뒤 게임 종료·무한 라운드 게임 오버) 메타 XP를 한 번 준다.
   * 같은 원정 ID는 다시 주지 않으므로 새로고침·이어하기·결과 창을 다시 열어도 중복되지 않는다.
   */
  function settleMeta(reason: MetaReason = 'end') {
    const r = state.run;
    if (!r?.runId || M.paymentFor(state.meta, r.runId)) return null;
    // 무한 라운드(6-5 뒤 계속 진행)는 정규 구간 보상을 이미 확정했으므로 진행 중에도 다시 확인할 필요 없다
    const why: MetaReason =
      reason === 'end' && !r.done && r.completionChoice === 'continue' ? 'continue' : reason;
    if (why === 'end' && !r.done) return null;
    const meta = M.normalizeProfile(JSON.parse(JSON.stringify(state.meta)));
    const payment = M.settleRun(meta, r, why);
    if (!payment) return null;
    state = { ...state, meta };
    saveMeta();
    return payment;
  }
  const changed = (patch: Partial<UiState> = {}) => {
    // 증강이 동료를 지급하면 core가 uid를 붙이므로, 다음 번호가 겹치지 않게 맞춘다
    if (state.run) nextUid = Math.max(nextUid, ...state.run.units.map((u) => u.uid));
    save();
    publish(patch);
  };

  /** 시작할 때 저장을 한 번 읽는다(기존 UI와 같은 규칙, core/save.ts). */
  function load() {
    state = { ...state, meta: loadMeta() };
    const result = Save.loadSave(env.storage, env.now?.() ?? new Date());
    if (result.status === 'loaded') {
      nextUid = result.nextUid;
      // 0.17.2 이전에 시작한 원정에는 ID가 없다. 진행 중이면 ID를 붙여 끝날 때 메타 XP를 받게 하고,
      // 이미 끝난 원정은 소급해서 주지 않는다(ID 없이 둔다).
      if (!result.state.runId && !result.state.done)
        result.state.runId = `run-${clock()}-${env.newSeed() >>> 0}`;
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
      // 끝난 원정인데 메타 XP를 아직 못 받았으면(정산 직후 창이 닫힌 경우 등) 지금 한 번 준다
      settleMeta();
    } else if (result.status === 'outdated') {
      state = {
        ...state,
        loadNotice: {
          id: 'T45',
          text: '이전 버전(0.17.0 이전) 저장은 이어할 수 없어 지웠습니다. 새 원정을 시작하세요.',
        },
      };
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

  /** 화면 연출 신호를 추가한다(연출이 꺼져 있으면 아무것도 하지 않음). */
  function cue(input: CueInput): Partial<UiState> {
    if (!env.presentation) return {};
    return { cues: [...state.cues, { ...input, key: ++cueKey } as Cue] };
  }
  /** 다음 라운드 준비 화면에 들어갈 때의 안내(v0.15.18 showRoundTransition) */
  function roundCue(): Partial<UiState> {
    const r = state.run;
    if (!r || r.done || r.roundPhase !== 'prepare') return {};
    return cue({ kind: r.round === 1 ? 'round' : 'stage', stage: r.stage, round: r.round });
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

  /** 원정 단계에 맞는 창(이어하기·주 버튼에서 사용). */
  function phaseModal(): Modal {
    const phase = state.run?.roundPhase;
    if (!state.run || state.battle) return null;
    if (phase === 'complete' || (state.run.done && state.run.completionChoice === 'end'))
      return 'summary';
    // 게임 오버(HP 0)도 결과 창("원정 종료", 메타 XP 표시)을 연다. 전에는 하트 연출 뒤·이어하기에서
    // 이 단계를 몰라 결과 창이 뜨지 않았다(v0.17.2 수정)
    if (phase === 'result' || phase === 'gameover') return 'result';
    if (phase === 'augment') return 'augment';
    if (phase === 'supply') return 'supply';
    return null;
  }

  /** 전투 시작(v0.15.18 startBattle의 전투 부분). */
  function beginBattle() {
    const r = run();
    prepareFormation();
    const setup = battleSetup(r);
    // 개발 모드: 메타 강화 전후 수치를 전투 로그('meta')로 남겨 콘솔에서 비교
    const metaInfo = (setup.options.allyModifiers as { meta?: { debug?: boolean } }).meta;
    if (env.metaDev && metaInfo) metaInfo.debug = true;
    const battle = new Engine.Battle(setup.allies, setup.enemies, {
      quickMana: state.quickMana,
      experimental: state.experimental,
      ...setup.options,
      onUnitKilled: (unit: { team?: string }, source: { team?: string } | null) => {
        if (source?.team !== 'ally') return;
        const loot = W.claimBonusLoot(r, unit);
        if (!loot) return;
        save();
        notify(
          'T39',
          '보너스 몬스터 처치! ' +
            (loot.kind === 'item'
              ? (P.itemById(loot.itemId)?.name ?? loot.itemId)
              : '+' + loot.amount + 'G'),
        );
      },
    }) as unknown as LiveBattle;
    r.roundPhase = 'combat';
    changed({
      battle,
      lastBattle: null,
      selected: null,
      selectedItem: null,
      inspected: null,
      shopOpen: false,
      modal: null,
    });
    notify('T37', '자동 전투 중 · 기존 캐릭터 스킬과 유대 판정은 유지됩니다.');
    env.combat?.start(
      battle,
      { onUpdate: () => publish(), onEnd: (result) => endBattle(battle, result) },
      state.speed,
    );
  }

  /**
   * 전투 종료 정산(v0.15.18 endBattle). 정산·저장은 바로 하고, 화면은
   * 마지막 장면 잠시 유지 → (전투·보스) 하트 체력 연출 → 결과 창 순서로 보여 준다.
   */
  function endBattle(battle: LiveBattle, result: NonNullable<LiveBattle['result']>) {
    if (state.battle !== battle) return;
    const r = run();
    const b = battle as unknown as {
      alive(team: string): { summon?: boolean }[];
      skillUses: object;
    };
    const receipt = P.settleRound(r, {
      ...result,
      survivingEnemies: b.alive('enemy').filter((u) => !u.summon).length,
      skillUses: { ...b.skillUses },
      damageRows: V.damageRows(battle),
      // 완벽한 승리(S11): 쓰러진 아군 수(소환수·분신 제외)
      allyLosses: (
        battle as unknown as { units: { team: string; summon?: boolean; dead?: boolean }[] }
      ).units.filter((u) => u.team === 'ally' && !u.summon && u.dead).length,
    });
    (r as RunState & { lastDamageRows?: unknown }).lastDamageRows = receipt.damageRows;
    env.combat?.warm();
    if (!env.presentation)
      changed({ battle: null, lastBattle: battle, modal: 'result', inspected: null });
    else {
      changed({
        battle: null,
        lastBattle: battle,
        finishing: battle,
        modal: null,
        inspected: null,
      });
      const reduced = env.presentation.reduced();
      clearTimer(finishTimer);
      finishTimer = setTimer(
        () => {
          if (state.finishing !== battle) return;
          const fight = receipt.type === 'BATTLE' || receipt.type === 'BOSS';
          publish({
            finishing: null,
            ...(fight
              ? cue({
                  kind: 'health',
                  before: receipt.healthBefore ?? receipt.health,
                  after: receipt.health,
                  win: !!receipt.win,
                })
              : { modal: 'result' }),
          });
        },
        durations.finish(state.speed, reduced),
      );
    }
    notify(
      'T40',
      (receipt.win ? '승리' : '후퇴') +
        ' · 총 보상 +' +
        (receipt.totalEarned ?? receipt.total) +
        'G',
    );
  }

  /** 다음 라운드로(v0.15.18 continueRound). */
  function continueRound() {
    if (state.battle || !state.run) return;
    const r = run();
    if (r.done) {
      publish({ modal: r.completionChoice === 'end' ? 'summary' : null });
      return;
    }
    if (r.completionChoice === 'pending') return publish({ modal: 'result' });
    if (!P.advanceRound(r)) return;
    if (r.roundPhase === 'augment') return changed({ modal: 'augment', lastBattle: null });
    V.enterShop(r);
    prepareFormation();
    const intro = roundCue();
    changed({ modal: null, selected: null, lastBattle: null, ...intro, ...openShopAfter(intro) });
    notify('T36', P.label(r) + ' 준비 · ' + P.roundType(r.stage, r.round));
  }

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
    /** 시작 화면 → 능력치(메타 영구 강화 트리) */
    showAbilities: () => publish({ view: 'abilities' }),
    pickBranch(branch: UiState['abilities']['branch']) {
      publish({ abilities: { ...state.abilities, branch, node: `${branch}1` } });
    },
    /** 노드 누르기: 상세만 바꾼다(구매하지 않음) */
    pickNode(id: string) {
      if (U.byId(id)) publish({ abilities: { ...state.abilities, node: id } });
    },
    /**
     * 강화하기(상세 패널의 버튼에서만): 해금·비용·최대 단계 확인 → P 차감과 단계 +1을 한 번에 → 저장.
     * 버튼 연타·중복 이벤트로 두 번 사지 않게 350ms 안의 다음 요청은 무시한다.
     */
    buyUpgrade(id: string) {
      if (clock() < buyGuardUntil) return false;
      const next = M.normalizeProfile(JSON.parse(JSON.stringify(state.meta)));
      if (!U.buy(next, id)) return false;
      buyGuardUntil = clock() + 350;
      state = { ...state, meta: next };
      saveMeta();
      publish({ abilities: { ...state.abilities, flash: { id, key: ++flashKey } } });
      return true;
    },
    /**
     * 개발용(?metadev 테스트 프로필에서만): 메타 레벨·P·티켓·강화 단계 설정. 레벨을 바꾸면 보상 원장을 그 레벨로 다시 맞춘다.
     */
    devSetMeta(patch: {
      level?: number;
      points?: number;
      tickets?: number;
      upgrades?: Record<string, number>;
    }) {
      if (!env.metaDev) return;
      const p = M.normalizeProfile(JSON.parse(JSON.stringify(state.meta)));
      if (patch.level) {
        p.metaLevel = Math.max(1, Math.min(M.config.maxLevel, patch.level));
        p.metaXp = 0;
        p.totalXp = M.cumulativeXp(p.metaLevel);
        const earned = U.cumulativeReward(p.metaLevel);
        p.rewards = { level: p.metaLevel, ...earned };
        p.tickets = earned.tickets;
        p.growthPoints = Math.max(0, earned.points - U.usedPoints(p));
      }
      if (patch.upgrades) {
        p.upgrades = { ...patch.upgrades };
        p.growthPoints = Math.max(0, p.rewards.points - U.usedPoints(p));
      }
      if (patch.points !== undefined) p.growthPoints = Math.max(0, patch.points);
      if (patch.tickets !== undefined) p.tickets = Math.max(0, patch.tickets);
      state = { ...state, meta: p };
      saveMeta();
      publish();
    },
    showHome() {
      // 전투 중이면 멈춰 두고, 이어하기로 돌아오면 다시 진행한다
      if (state.battle) env.combat?.pause();
      publish({
        view: 'home',
        shopOpen: false,
        selected: null,
        modal: null,
        inspected: null,
        peek: null,
        popover: null,
      });
    },
    chooseDifficulty: (difficulty: number) => publish({ difficulty }),
    /** 고른 난이도로 새 원정 시작(저장된 원정은 교체). */
    startRun() {
      // 끝내지 않은 원정을 새 원정으로 바꾸면 그때까지의 메타 XP를 준다(사용자 결정 2026-11-19)
      const abandoned = state.run && !state.run.done ? settleMeta('abandon') : null;
      const seed = env.newSeed();
      const created = newRun({
        seed,
        difficulty: state.difficulty,
        firstUid: nextUid + 1,
        runId: `run-${clock()}-${seed >>> 0}`,
        // 메타 영구 강화: 지금 구매한 단계를 이 원정에 고정(원정 도중 구매는 다음 원정부터)
        metaLevels: state.meta.upgrades,
      });
      nextUid += created.units.length;
      autoShopCue = null;
      state = { ...state, run: created };
      prepareFormation();
      changed({
        view: 'game',
        selected: null,
        shopOpen: false,
        peek: null,
        inspected: null,
        selectedItem: null,
      });
      if (abandoned?.xp) notify('T46', metaText('이전 원정을 포기해', abandoned));
    },
    continueRun() {
      if (!state.run) return;
      const pending = state.loadNotice;
      prepareFormation();
      publish({ view: 'game', loadNotice: null, modal: phaseModal() });
      if (state.battle) env.combat?.resume();
      if (pending) notify(pending.id, pending.text);
    },
    /** 준비 단계 캐릭터 선택. x, y는 누른 곳(상세 창을 그 옆에 띄움) */
    select(uid: number | null, x?: number, y?: number) {
      if (!editable() || clock() < clickGuardUntil) return;
      const next = state.selected === uid ? null : uid;
      publish({ selected: next, anchor: next !== null && x !== undefined ? { x, y: y! } : null });
    },
    /** 전투 중 유닛 상세(아군·적군). 같은 유닛을 다시 누르면 닫는다. 전투는 계속 진행된다 */
    inspect(uid: number | null, x?: number, y?: number) {
      if (!state.battle) return publish({ inspected: null });
      const next = state.inspected === uid ? null : uid;
      publish({ inspected: next, anchor: next !== null && x !== undefined ? { x, y: y! } : null });
    },
    /** 유대·증강 상세: 마우스를 올리면 미리보기(pinned=false), 누르면 고정. 고정된 것이 있으면 미리보기는 무시 */
    setPeek(kind: 'bond' | 'augment', id: string, pinned: boolean) {
      const cur = state.peek;
      if (!pinned && cur?.pinned) return;
      if (pinned && cur?.pinned && cur.kind === kind && cur.id === id)
        return publish({ peek: null });
      publish({ peek: { kind, id, pinned } });
    },
    /** 미리보기만 닫는다(고정된 상세는 그대로) */
    endPreview() {
      if (state.peek && !state.peek.pinned) publish({ peek: null });
    },
    clearPeek: () => publish({ peek: null }),
    toggleInventory: () => publish({ inventoryOpen: !state.inventoryOpen }),
    /** 전술 복제(G18) 분신 대상 지정·해제(원정 캐릭터 uid) */
    setCloneTarget(uid: number | null) {
      if (!state.run) return;
      const r = (state.run.augmentRun ||= {} as NonNullable<RunState['augmentRun']>);
      r.cloneTarget = r.cloneTarget === uid ? null : uid;
      changed();
    },
    /** 맨 위에 열린 닫을 수 있는 팝업 이름(보급·증강·결과 같은 확인 창은 바깥 클릭·Esc로 닫지 않음) */
    topPopup(): PopupName | null {
      if (state.overlay) return 'overlay';
      if (state.modal) return null;
      if (state.popover) return state.popover;
      if (state.shopOpen) return 'shop';
      if (state.peek) return 'peek';
      if (state.selectedItem) return 'item';
      if (state.inspected !== null) return 'inspect';
      if (state.selected !== null) return 'unit';
      return null;
    },
    /** 맨 위 팝업 하나만 닫는다(바깥 클릭·Esc). 닫았으면 true */
    dismissTop(): boolean {
      const top = actions.topPopup();
      if (!top) return false;
      if (top === 'overlay') publish({ overlay: null });
      else if (top === 'settings' || top === 'more') publish({ popover: null });
      else if (top === 'shop') publish({ shopOpen: false });
      else if (top === 'peek') publish({ peek: null });
      else if (top === 'item') publish({ selectedItem: null });
      else if (top === 'inspect') publish({ inspected: null });
      else publish({ selected: null });
      return true;
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
      // 처음 실제로 움직일 때 드래그 시작: 선택이 풀리고 판매 영역이 나타난다.
      // 열려 있던 일반 팝업(영입창·설정·더보기·유대 미리보기·상세)도 모두 닫는다(v0.18.3, 겹친 팝업이 남지 않게).
      // 확인 창(modal)과 전체 화면 창(overlay)은 드래그 자체가 시작되지 않는다(배경을 가림).
      const starting = !drag.active;
      publish({
        drag: { ...drag, active: true, x, y, over },
        ...(starting
          ? {
              selected: null,
              selectedItem: null,
              inspected: null,
              peek: null,
              popover: null,
              shopOpen: false,
            }
          : {}),
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
    /** 주 버튼(보급품 받기 / 전투 시작 / 결과 확인 등, v0.15.18 startBattle). */
    primary(confirmed = false) {
      if (!state.run || state.battle) return;
      const r = run();
      const open = phaseModal();
      if (open) return publish({ modal: open });
      if (r.done || r.roundPhase !== 'prepare') return;
      if (P.roundType(r.stage, r.round) === 'SUPPLY') {
        P.beginSupply(r);
        return changed({ modal: 'supply', shopOpen: false });
      }
      const deployed = r.units.filter((u) => u.location === 'board').length;
      if (!deployed || deployed > P.capacity(r)) return;
      if (confirmed !== true && V.deploymentStatus(r).shouldWarn)
        return publish({ modal: 'deploy', shopOpen: false });
      beginBattle();
    },
    /** 배치 부족 확인 창: 그대로 시작(‘다시 묻지 않기’ 저장) */
    confirmDeployment(skipNextTime: boolean) {
      if (!state.run) return;
      run().skipDeploymentWarning = skipNextTime;
      save();
      publish({ modal: null });
      actions.primary(true);
    },
    closeModal: () => publish({ modal: null }),
    openOverlay: (overlay: Overlay) => publish({ overlay, popover: null, shopOpen: false }),
    closeOverlay: () => publish({ overlay: null }),
    setPopover: (popover: UiState['popover']) =>
      publish({ popover: state.popover === popover ? null : popover }),
    /** 캐릭터 도감의 '무료 테스트 영입'(v0.15.18 recruit(id, true)) */
    freeRecruit(id: string) {
      if (!state.run || state.battle) return;
      const result = buyUnit(run(), id, { uid: nextUid + 1, free: true });
      if (!result.ok) {
        if (result.notice === 'T04')
          notify('T04', '이미 3성을 보유한 캐릭터는 판매 후 다시 영입할 수 있습니다.');
        if (result.notice === 'T05') notify('T05', '대기석이 가득 찼습니다.');
        return;
      }
      nextUid++;
      changed();
    },
    /** 더보기 → 새 원정: 확인 뒤 난이도 선택 화면으로 */
    confirmNewRun() {
      if (state.battle) env.combat?.stop();
      publish({ overlay: null, popover: null, battle: null, modal: null, view: 'difficulty' });
    },
    toggleSupply(index: number) {
      if (state.run && P.toggleSupply(run(), index)) changed();
    },
    confirmSupply() {
      if (!state.run || !P.confirmSupply(run())) return;
      changed({ modal: 'result', lastBattle: null });
    },
    chooseAugment(id: string) {
      if (!state.run || !P.chooseAugment(run(), id)) return;
      V.enterShop(run());
      prepareFormation();
      const intro = roundCue();
      changed({ modal: null, ...intro, ...openShopAfter(intro) }); // 증강 선택(필수 창)이 끝난 뒤 영입창
      notify('T35', '증강 선택 완료 · ' + (P.augmentById(id)?.name ?? id));
    },
    continueRound,
    /** 6-5 이후: 'end'(종료) 또는 'continue'(7-1부터 계속) */
    chooseCompletion(choice: 'end' | 'continue') {
      if (!state.run || !P.chooseCompletion(run(), choice)) return;
      save(); // 계속 진행이면 여기서 정규 구간 메타 XP(최대 80)를 확정해 지급한다
      if (choice === 'continue') {
        const paid = M.paymentFor(state.meta, run().runId);
        continueRound();
        if (paid?.reason === 'continue') notify('T46', metaText('정규 구간을 마쳐', paid));
      } else publish({ modal: 'summary' });
    },
    cycleSpeed() {
      const speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
      env.combat?.setSpeed(speed);
      publish({ speed });
    },
    setRule(rule: 'quickMana' | 'experimental', on: boolean) {
      publish({ [rule]: on } as Partial<UiState>);
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
      let cues: Partial<UiState> = {};
      for (const m of result.merges) {
        const drop = (u: RunState['units'][number]) =>
          u.location === 'board' ? `board:${u.pos}` : `bench:${u.benchSlot}`;
        cues = {
          ...cues,
          ...cue({
            kind: 'merge',
            keep: m.keep.uid,
            star: m.star,
            parts: m.removed.map((u) => ({ id: u.id, star: m.star - 1, drop: drop(u) })),
          }),
        };
        state = { ...state, ...cues };
      }
      changed(result.merges.length ? { selected: null, ...cues } : {});
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
    /** 연출 하나가 끝났다(또는 건너뛰었다). 하트 연출이 끝나면 결과 창을 연다. */
    doneCue(key: number) {
      const done = state.cues.find((c) => c.key === key);
      if (!done) return;
      const cues = state.cues.filter((c) => c.key !== key);
      // 라운드 안내가 끝나면 영입창을 연다(한 번만, 준비 단계이고 확인 창이 없을 때)
      const openShop = key === autoShopCue && editable() && !state.modal && !state.overlay;
      if (key === autoShopCue) autoShopCue = null;
      publish({
        cues,
        ...(done.kind === 'health' && phaseModal() === 'result' ? { modal: 'result' } : {}),
        ...(openShop ? { shopOpen: true } : {}),
      });
    },
    /** 전투 끝 장면을 건너뛰고 바로 다음으로 */
    skipFinish() {
      if (!state.finishing) return;
      clearTimer(finishTimer);
      publish({ finishing: null, modal: phaseModal() });
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
