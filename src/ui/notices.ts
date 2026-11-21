// 알림 정책(v0.15.18 notice-policy.js를 옮김). 새 알림은 ADDED(T42~)에 넣고
// src/content/notice-audit.js에 행을 추가한다. 이 목록의 알림만 보이고, 나머지 알림 ID는 표시하지 않는다.

/** v0.15.7 조사: 표시하는 알림(T01~T41 중). */
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
/** T28: 아이템 버리기 거절, 원인별 문구(승인됨). */
export const APPROVED = ['T28'] as const;
/** 재구축에서 추가: 저장 실패, 손상 저장 백업, 새로고침으로 전투 취소, 이전 버전 저장 삭제(v0.17.0), 메타 XP 지급(v0.17.3). */
export const ADDED = ['T42', 'T43', 'T44', 'T45', 'T46'] as const;

const shown = new Set<string>([...RETAINED, ...APPROVED, ...ADDED]);

export function allows(id: string): boolean {
  return shown.has(id);
}

/** 알림 표시 시간(v0.15.18: 3초, 새 알림이 오면 다시 시작). */
export const NOTICE_MS = 3000;

/** 드래그 결과 → 알림 ID(v0.15.18 notice-policy.js의 dragMessages / dragId). */
const DRAG_MESSAGES: Record<string, string> = {
  '준비 단계에서만 이동할 수 있습니다.': 'T17',
  '캐릭터를 찾을 수 없습니다.': 'T18',
  '전장이나 대기석에 놓아주세요.': 'T12',
  '아군 진영 아래 4줄에만 배치할 수 있습니다.': 'T14',
  '아군 진영 왼쪽 4열에만 배치할 수 있습니다.': 'T14', // v0.18.0 좌우 대치 전장
  '대기석 칸에 놓아주세요.': 'T13',
  '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.': 'T15',
  '쌍둥이 전술: 동일한 캐릭터는 전장에 2명까지 배치할 수 있습니다.': 'T15', // G13(v0.17.0)
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

/** 누른 뒤 드래그로 바뀌는 이동 거리(v0.15.18: 7px). */
export const DRAG_THRESHOLD = 7;
/** 드래그 직후 클릭을 무시하는 시간(v0.15.18: 400ms). */
export const DRAG_CLICK_GUARD_MS = 400;
