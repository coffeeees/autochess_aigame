(function (root) {
  'use strict';
  const retained = [
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
  ];
  const deleted = Array.from({ length: 41 }, (_, i) => 'T' + String(i + 1).padStart(2, '0')).filter(
    (id) => !retained.includes(id) && id !== 'T28',
  );
  // Added in the rebuild (stage 4, save system); not part of the v0.15.7 T01-T41 audit.
  // T42 save failed, T43 damaged save backed up, T44 battle cancelled by reload (D4 a).
  const added = ['T42', 'T43', 'T44'];
  function allows(id) {
    return retained.includes(id) || id === 'T28' || added.includes(id);
  }
  function discardRefusal(state, uid) {
    if (state.done) return '원정이 종료되어 아이템을 버릴 수 없습니다.';
    if (state.roundPhase !== 'prepare') return '준비 단계에서만 아이템을 버릴 수 있습니다.';
    if (!state.inventory.some((i) => i.uid === uid)) return '아이템을 찾을 수 없습니다.';
    return '장착 중인 아이템은 먼저 보관함으로 회수하세요.';
  }
  const dragMessages = {
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
  function dragId(kind, result) {
    if (result.message && dragMessages[result.message]) return dragMessages[result.message];
    if (result.ok) return kind === 'item' ? 'T11' : 'T10';
    if (kind === 'unit') return result.message?.startsWith('현재 레벨에서는 ') ? 'T16' : 'T12';
    return 'T25';
  }
  const api = { retained, deleted, added, allows, discardRefusal, dragId, t28Approved: true };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoNoticePolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
