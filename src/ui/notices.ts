// Notice policy for the rebuilt UI: the same lists as src/legacy/notice-policy.js
// (kept equal by tests/ui-next/store.test.js until the legacy UI is removed).
// Only these notices are shown; every other notice id stays silent.

/** v0.15.7 audit: notices that are shown (T01-T41). */
export const RETAINED = [
  'T02',
  'T03',
  'T04',
  'T05',
  'T06',
  'T15',
  'T16',
  'T19',
  'T23',
  'T25',
  'T34',
  'T39',
] as const;
/** T28: item discard refusals with cause-specific wording (approved). */
export const APPROVED = ['T28'] as const;
/** Added in the rebuild: save failed, damaged save backed up, battle cancelled by reload. */
export const ADDED = ['T42', 'T43', 'T44'] as const;

const shown = new Set<string>([...RETAINED, ...APPROVED, ...ADDED]);

export function allows(id: string): boolean {
  return shown.has(id);
}

/** How long a shown notice stays (v0.15.18: 3 seconds, restarted by a new notice). */
export const NOTICE_MS = 3000;

/** Drag results -> notice id (same table as notice-policy.js dragMessages / dragId). */
const DRAG_MESSAGES: Record<string, string> = {
  '준비 단계에서만 이동할 수 있습니다.': 'T17',
  '캐릭터를 찾을 수 없습니다.': 'T18',
  '전장이나 대기석에 놓아주세요.': 'T12',
  '아군 진영 아래 4줄에만 배치할 수 있습니다.': 'T14',
  '대기석 칸에 놓아주세요.': 'T13',
  '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.': 'T15',
  '대기석이 가득 찼습니다.': 'T19',
  '아이템은 준비 단계에서 옮길 수 있습니다.': 'T21',
  '아이템을 아군 캐릭터 위에 놓아주세요.': 'T22',
  '캐릭터당 아이템은 최대 3개입니다.': 'T23',
  '동일한 3티어 장비는 중복 장착할 수 없습니다.': 'T24',
  '아군 캐릭터 또는 보관함에 놓아주세요.': 'T20',
  '아이템을 버렸습니다. 되돌리기로 복원할 수 있습니다.': 'T26',
};

export function dragId(kind: 'unit' | 'item', result: { ok: boolean; message?: string }): string {
  if (result.message && DRAG_MESSAGES[result.message]) return DRAG_MESSAGES[result.message];
  if (result.ok) return kind === 'item' ? 'T11' : 'T10';
  if (kind === 'unit') return result.message?.startsWith('현재 레벨에서는 ') ? 'T16' : 'T12';
  return 'T25';
}

/** Pointer travel before a press becomes a drag (v0.15.18: 7px). */
export const DRAG_THRESHOLD = 7;
/** Clicks right after a drag are ignored (v0.15.18: 400ms). */
export const DRAG_CLICK_GUARD_MS = 400;
