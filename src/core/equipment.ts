// 장비 조합·장착·회수(v0.20.0 아이템 개편). 준비 단계에서만, 원정 상태를 그 자리에서 바꾼다(실패하면 아무것도 바꾸지 않음).
// 확정 규칙(요청서):
//  - 캐릭터당 장비 3칸. 한 캐릭터에 기본 장비는 최대 1개: 기본 장비를 든 캐릭터에 기본 장비를 놓으면 그 자리에서 완성 장비로 합쳐진다
//    (빈 칸이 없어도 된다. 2칸이 1칸이 됨).
//  - 보관함의 기본 장비 위에 기본 장비를 놓으면 보관함에서 완성 장비가 된다. 완성 장비는 다시 조합하지 않는다.
//  - 장착한 장비를 떼는 무료 회수는 없다. 회수기 1개로 그 캐릭터의 장비 전부를 그대로(ID·UID 유지) 보관함에 돌려받는다.
//  - 캐릭터 판매·합성 재료로 사라질 때는 예전처럼 보관함으로 돌아간다(사용자 결정 2026-11-23, shop.ts·merge.ts의 releaseEquipment).
// 회수기 수: state.recoveryTools. 새 원정 2개, 보스 승리 때 확률로 추가(progression.settleRound, 수치는 config.recovery).
import I from './items.js';
import type { RunItem, RunState } from './types.ts';

export const config = {
  slotsPerUnit: 3,
  /** 회수기: 새 원정 시작 수, 보스 승리 획득 확률, 획득했을 때 2개일 확률(사용자 결정 2026-11-23, 테스트용 임시값) */
  recovery: { start: 2, bossChance: 0.4, doubleChance: 0.25 },
};

type Def = {
  id: string;
  kind: 'base' | 'complete';
  name: string;
  statsText: string;
  effect: string;
};
const def = (id: string) => I.byId(id) as Def | undefined;
const editable = (s: RunState) => !s.done && s.roundPhase === 'prepare';
const equippedOf = (s: RunState, unitUid: number) =>
  s.inventory.filter((i) => i.equippedTo === unitUid);
const newItem = (s: RunState, id: string, equippedTo: number | null): RunItem => ({
  uid: 'I' + ++s.itemSequence,
  id,
  equippedTo,
});

export type DropPlan =
  | { ok: true; action: 'equip'; itemId: string }
  | { ok: true; action: 'combine'; resultId: string; with: string }
  | { ok: false; message: string };

/**
 * 보관함의 장비 itemUid를 캐릭터 unitUid에 놓으면 어떻게 되는지(바꾸지 않음). 드래그 중 미리보기에도 쓴다.
 */
export function planOnUnit(s: RunState, itemUid: string, unitUid: number): DropPlan {
  if (!editable(s)) return { ok: false, message: '아이템은 준비 단계에서 옮길 수 있습니다.' };
  const item = s.inventory.find((i) => i.uid === itemUid);
  const unit = s.units.find((u) => u.uid === unitUid);
  if (!item || !unit || !def(item.id))
    return { ok: false, message: '아이템을 아군 캐릭터 위에 놓아주세요.' };
  if (item.equippedTo !== null)
    return { ok: false, message: '장착한 장비는 회수기로만 되찾을 수 있습니다.' };
  const equipped = equippedOf(s, unitUid);
  const held = equipped.find((i) => I.isBase(i.id));
  if (I.isBase(item.id) && held)
    return { ok: true, action: 'combine', resultId: I.recipe(held.id, item.id)!, with: held.uid };
  if (equipped.length >= config.slotsPerUnit)
    return { ok: false, message: '캐릭터당 아이템은 최대 3개입니다.' };
  return { ok: true, action: 'equip', itemId: item.id };
}

/** 캐릭터에 놓기: 장착, 또는 들고 있던 기본 장비와 합쳐 완성 장비를 그 캐릭터가 바로 착용 */
export function dropOnUnit(s: RunState, itemUid: string, unitUid: number) {
  const plan = planOnUnit(s, itemUid, unitUid);
  if (!plan.ok) return { ok: false as const, message: plan.message };
  const item = s.inventory.find((i) => i.uid === itemUid)!;
  if (plan.action === 'equip') {
    item.equippedTo = unitUid;
    return { ok: true as const, action: 'equip' as const, item };
  }
  // 조합: 들고 있던 기본 장비 자리에 완성 장비를 두고 재료 둘을 지운다(한 번에)
  const index = s.inventory.findIndex((i) => i.uid === plan.with);
  const made = newItem(s, plan.resultId, unitUid);
  s.inventory.splice(index, 1, made);
  s.inventory = s.inventory.filter((i) => i.uid !== itemUid);
  return { ok: true as const, action: 'combine' as const, item: made };
}

/** 보관함의 기본 장비 itemUid를 보관함의 기본 장비 targetUid 위에 놓으면(바꾸지 않음) */
export function planOnItem(s: RunState, itemUid: string, targetUid: string): DropPlan {
  if (!editable(s)) return { ok: false, message: '아이템은 준비 단계에서 옮길 수 있습니다.' };
  const item = s.inventory.find((i) => i.uid === itemUid);
  const target = s.inventory.find((i) => i.uid === targetUid);
  if (!item || !target || item === target) return { ok: false, message: '조합할 수 없습니다.' };
  if (item.equippedTo !== null || target.equippedTo !== null)
    return { ok: false, message: '보관함의 기본 장비끼리만 조합할 수 있습니다.' };
  const resultId = I.recipe(item.id, target.id);
  if (!resultId) return { ok: false, message: '완성 장비는 다시 조합할 수 없습니다.' };
  return { ok: true, action: 'combine', resultId, with: targetUid };
}

/** 보관함 조합: 결과는 놓은 자리(대상 칸)에 보관함 장비로 생긴다 */
export function combineInInventory(s: RunState, itemUid: string, targetUid: string) {
  const plan = planOnItem(s, itemUid, targetUid);
  if (!plan.ok || plan.action !== 'combine')
    return { ok: false as const, message: plan.ok ? '' : plan.message };
  const index = s.inventory.findIndex((i) => i.uid === targetUid);
  const made = newItem(s, plan.resultId, null);
  s.inventory.splice(index, 1, made);
  s.inventory = s.inventory.filter((i) => i.uid !== itemUid);
  return { ok: true as const, item: made };
}

export const recoveryTools = (s: Pick<RunState, 'recoveryTools'>) =>
  Number.isInteger(s.recoveryTools) && (s.recoveryTools as number) > 0
    ? (s.recoveryTools as number)
    : 0;

/**
 * 회수기 사용: 장비를 하나 이상 든 캐릭터의 장비 전부를 보관함으로(그대로, 분해하지 않음). 회수기 1개 소모.
 * 돌려준 장비 uid 목록은 화면 연출(캐릭터 → 보관함 이동)에 쓴다.
 */
export function recover(s: RunState, unitUid: number) {
  if (!editable(s))
    return { ok: false as const, message: '회수기는 준비 단계에서 쓸 수 있습니다.' };
  if (recoveryTools(s) < 1) return { ok: false as const, message: '회수기가 없습니다.' };
  if (!s.units.some((u) => u.uid === unitUid))
    return { ok: false as const, message: '장비를 든 아군 캐릭터에 놓아주세요.' };
  const items = equippedOf(s, unitUid);
  if (!items.length) return { ok: false as const, message: '장착한 장비가 없는 캐릭터입니다.' };
  for (const item of items) item.equippedTo = null;
  s.recoveryTools = recoveryTools(s) - 1;
  return { ok: true as const, items: items.map((i) => i.uid), unitUid };
}

/** 보스 승리 때 회수기 추가(확률 판정은 장비·골드 보상과 따로). 얻은 수(0·1·2) */
export function rollBossRecovery(s: RunState, rng: () => number) {
  if (rng() >= config.recovery.bossChance) return 0;
  const n = rng() < config.recovery.doubleChance ? 2 : 1;
  s.recoveryTools = recoveryTools(s) + n;
  return n;
}

/** 아이템 상세·미리보기 문구 */
export function describe(id: string) {
  const d = def(id);
  return d ? { name: d.name, kind: d.kind, stats: d.statsText, effect: d.effect } : null;
}

export default {
  config,
  planOnUnit,
  dropOnUnit,
  planOnItem,
  combineInInventory,
  recoveryTools,
  recover,
  rollBossRecovery,
  describe,
};
