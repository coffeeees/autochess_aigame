(function (root) {
  'use strict';
  // Audit data only. Nothing in this module intercepts, suppresses or calls tell().
  const behavior =
    '위치: 대기석 오른쪽 상단의 가로 바. 유지 대상 알림은 슬라이드로 등장하고 3초 뒤 퇴장을 시작하며180ms 전환 후 숨깁니다. 새 유지 알림이 오면 문구와3초 타이머를 갱신합니다. 삭제 대상은 기능은 실행하지만 알림 표시/타이머 갱신은 하지 않습니다. 모달·툴팁·인라인 안내는 별개입니다. T28의 원인별 문구 변경은 사용자가 승인했습니다.';
  const raw = [
    [
      '페이지 초기화: 별도 이관 안내가 없을 때',
      '1-1과 1-2는 안전 보급입니다. 동료를 준비하고 아이템을 받아보세요.',
      'prototype.js: 초기 load 이후',
      '페이지를 다시 로드할 때마다 호출. 현재 라운드와 무관한 고정 문구이며 홈이 떠 있으면 게임 영역 뒤에서 시간이 흐름.',
    ],
    [
      '구버전 저장을 레벨/스테이지 체계로 이관한 상태로 로드',
      '기존 동료·골드·체력을 보존했습니다. 배치 인원에 맞춰 레벨 {레벨}로 이관했습니다.',
      'progression.js: migrate → prototype.js: 초기화',
      'migrationNotice가 저장에 남아 있으면 다음 로드에도 다시 표시될 수 있음. 일반 시작 안내를 대체.',
    ],
    [
      '로드 직후 동일 ID 중복 배치를 감지하여 대기석으로 복구',
      '중복 배치된 동료를 대기석으로 옮겼습니다. 보유 캐릭터와 장비는 유지됩니다.',
      'prototype.js: V.repairDeployment 이후',
      '복구한 로드에서 이관/일반 시작 안내를 대체. 안내가 저장되면 후속 로드에도 남을 수 있음.',
    ],
    [
      '이미 3성을 보유한 등 현재 영입 풀에 없는 ID 영입 요청',
      '이미 3성을 보유한 캐릭터는 판매 후 다시 영입할 수 있습니다.',
      'prototype.js: recruit 첫 검사',
      '정상 상점/도감은 제외·비활성 처리. 이 검사가 전투/종료/ID 유효성 검사보다 먼저라 오래된 요청도 같은 문구로 거절될 수 있음.',
    ],
    [
      '대기석10명 이상이며 해당 구매로 1성3개 합성이 완성되지 않음',
      '대기석이 가득 찼습니다.',
      'prototype.js: recruit',
      '거절할 때마다1회. 합성이 완성되는 구매는 이 제한을 통과하며 영입/합성 안내가 발생.',
    ],
    [
      '유료 영입 요청 시 캐릭터 코스트보다 골드가 적음',
      '골드가 부족합니다.',
      'prototype.js: recruit',
      '거절 요청마다1회. XP/새로고침 부족에는 이 알림이 사용되지 않음.',
    ],
    [
      '유료 구매 또는 도감 무료 테스트 영입 성공',
      '{캐릭터 이름} 영입{무료이면: · 무료 테스트}',
      'prototype.js: recruit',
      '성공마다1회. 곧바로 merge()가 합성 안내로 덮을 수 있음. 무료 영입은 도감 모달 뒤에서 표시.',
    ],
    [
      '동일 ID·성급3개가 모여 자동 합성',
      '{캐릭터 이름} {새 성급}성 자동 합성',
      'prototype.js: merge',
      '합성 건마다1회. 한 번의 영입에서 영입 안내→합성 안내, 연쇄 합성이면 여러 번 교체되며 마지막 안내가 남음.',
    ],
    [
      '판매 버튼 또는 좌우 판매 영역으로 아군 판매 성공',
      '판매 완료 · 테스트용 환급 규칙 적용',
      'drag-sales.js: sellUnit (기존 sellBtn 처리 재사용)',
      '성공 거래당1회. 두 영역 모두 같은 함수를 사용하고 재전송된 UID는 무효라 중복 지급/알림 없음. 새 판매 조작만 추가했으며 기존 문구/시간 유지.',
    ],
    [
      '캐릭터 드래그 이동·교체 성공',
      '캐릭터 이동 완료',
      'interaction-ui.js: pointerup → V.moveUnit',
      '드롭마다1회. 자기 원래 칸에 놓아 상태가 바뀌지 않아도 V.moveUnit의 ok:true로 같은 안내가 뜸.',
    ],
    [
      '아이템 드래그 장착·이전·보관함 회수 성공',
      '아이템 이동 완료',
      'interaction-ui.js: pointerup → V.transferItem / P.unequip',
      '드롭마다1회. 이미 장착된 같은 아군/이미 보관함인 아이템을 보관함에 놓아도 성공으로 같은 안내가 뜰 수 있음.',
    ],
    [
      '캐릭터를 전장/대기석이 아닌 곳 또는 지원하지 않는 대상에 드롭',
      '전장이나 대기석에 놓아주세요.',
      'interaction-ui.js: pointerup 기본값 / preparation.js: moveUnit 대상 검사',
      '드롭마다1회. 기존 판매 이외의 유효하지 않은 드롭 경로. 취소(Escape/pointercancel)는 이 안내를 호출하지 않음.',
    ],
    [
      '이동 목표 대기석 인덱스가 현재 유효 범위 밖',
      '대기석 칸에 놓아주세요.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '유효 슬롯 DOM에서는 보통 도달하지 않는 방어 분기. 도달한 드롭마다1회.',
    ],
    [
      '캐릭터를 적 진영 또는 아군 범위 밖 좌표에 드롭',
      '아군 진영 아래 4줄에만 배치할 수 있습니다.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '잘못된 드롭마다1회. 이동은 반영되지 않음.',
    ],
    [
      '이동/교체 결과 전장에 동일 캐릭터 ID가 둘 이상이 됨',
      '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '시도마다1회. 기존 배치로 복귀.',
    ],
    [
      '이동/교체 결과 전장 인원이 현재 배치 한도를 초과',
      '현재 레벨에서는 {배치 한도}명까지 배치할 수 있습니다.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '시도마다1회. P12를 포함한 실제 한도 사용.',
    ],
    [
      '준비 단계가 아닌 상태에서 캐릭터 이동 함수가 요청됨',
      '준비 단계에서만 이동할 수 있습니다.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '일반 pointerdown에서 전투/종료 등을 차단하므로 보통 도달하지 않는 방어 분기.',
    ],
    [
      '캐릭터 이동 요청 UID를 현재 보유 목록에서 찾지 못함',
      '캐릭터를 찾을 수 없습니다.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '정상 보유 DOM에서는 보통 도달하지 않는 방어 분기. 오래된 드래그 요청에서 가능.',
    ],
    [
      '전장→대기석 이동/교체로 대기석 수가10명을 넘고 기존보다 증가',
      '대기석이 가득 찼습니다.',
      'preparation.js: moveUnit → interaction-ui.js: pointerup',
      '시도마다1회. 기존 저장의10명 초과 보존 자체로는 발생하지 않고 추가 증가만 거절.',
    ],
    [
      '아이템을 아군·보관함·휴지통이 아닌 곳/빈 대기석에 드롭',
      '아군 캐릭터 또는 보관함에 놓아주세요.',
      'interaction-ui.js: pointerup 기본값',
      '드롭마다1회. 이동/장착 상태 유지.',
    ],
    [
      '준비 단계가 아닌 상태에서 아이템 이전 함수가 요청됨',
      '아이템은 준비 단계에서 옮길 수 있습니다.',
      'preparation.js: transferItem → interaction-ui.js: pointerup',
      '일반 드래그 진입에서 잠겨 보통 도달하지 않는 방어 분기.',
    ],
    [
      '이전 요청의 아이템 또는 대상 아군 UID를 찾지 못함',
      '아이템을 아군 캐릭터 위에 놓아주세요.',
      'preparation.js: transferItem → interaction-ui.js: pointerup',
      '정상 DOM에서는 보통 도달하지 않는 방어 분기.',
    ],
    [
      '대상 아군에 장비3개가 이미 있으며 다른 장비를 드롭',
      '캐릭터당 아이템은 최대 3개입니다.',
      'preparation.js: transferItem → interaction-ui.js: pointerup',
      '거절마다1회. 같은 아군에 이미 장착된 동일 인스턴스는 먼저 ok:true가 되어 이동 완료 안내가 뜸.',
    ],
    [
      '대상 아군이 같은 ID의 3티어 장비를 이미 장착',
      '동일한 3티어 장비는 중복 장착할 수 없습니다.',
      'preparation.js: transferItem → interaction-ui.js: pointerup',
      '거절마다1회. 장비3칸 초과 검사가 먼저라 두 조건이 함께면 최대3개 안내가 우선.',
    ],
    [
      '아이템 드롭 처리가 실패하고 별도 result.message가 없음',
      '아이템을 옮길 수 없습니다.',
      'interaction-ui.js: pointerup 마지막 실패 대체값',
      '예: 보관함 드롭에서 아이템이 사라졌거나 회수 실패. 대부분의 검사는 구체 문구를 먼저 반환.',
    ],
    [
      '아이템을 휴지통으로 드래그하여 삭제를 요청',
      '아이템을 버렸습니다. 되돌리기로 복원할 수 있습니다.',
      'interaction-ui.js: pointerup → P.discardItem',
      '성공뿐 아니라 실패에도 같은 result.message가 전달됨. 예: 장착 아이템을 바로 휴지통에 드롭하면 삭제는 거절되지만 이 문구가 뜰 수 있어 검토 필요.',
      '검토 필요 · 현재 유지',
    ],
    [
      '아이템 정보의 버리기 또는 선택 아이템 휴지통 클릭으로 삭제 성공',
      '아이템을 버렸습니다. 마지막 삭제는 되돌릴 수 있습니다.',
      'content-ui.js: discardSelectedItem',
      '삭제마다1회. 드래그 삭제와 문구가 다름.',
    ],
    [
      '위 클릭 삭제 요청이 거절됨',
      '장착 중인 아이템은 먼저 보관함으로 회수하세요.',
      'content-ui.js: discardSelectedItem',
      '장착 여부뿐 아니라 잠긴 단계/없는 UID 등의 실패에도 이 문구가 사용될 수 있음.',
      '검토 필요 · 현재 유지',
    ],
    [
      '휴지통 클릭 시 선택 아이템이 없음',
      '보관 중인 아이템을 휴지통으로 드래그하거나 아이템 정보에서 버리기를 누르세요.',
      'content-ui.js: itemTrash.onclick',
      '활성 휴지통을 클릭할 때마다1회. 단순 도움말로 사용됨.',
    ],
    [
      '마지막으로 버린 아이템 복원 성공',
      '마지막으로 버린 아이템을 복원했습니다.',
      'content-ui.js: undoDiscardBtn.onclick',
      '성공마다1회. 복원할 항목이 없거나 잠긴 경우 버튼/함수에서 차단하고 알림 없음.',
    ],
    [
      '아이템 정보의 보관함으로 회수 버튼 성공',
      '아이템을 보관함으로 회수했습니다.',
      'interaction-ui.js: document click → P.unequip',
      '성공마다1회. 드래그 회수의 아이템 이동 완료와 문구가 다름. 실패는 이 경로에서 무알림.',
    ],
    [
      '4G로4XP 구매 성공, 레벨 변화 없음',
      '4G를 사용해 4XP를 획득했습니다.',
      'stage-ui.js: buyXpBtn.onclick',
      '구매마다1회. 부족/최고 레벨/전투 등은 비활성 또는 false로 차단하고 별도 알림 없음.',
    ],
    [
      '4G로4XP 구매 성공, 구매 전보다 레벨이 증가',
      '레벨 {레벨} 달성 · 배치 한도 증가',
      'stage-ui.js: buyXpBtn.onclick',
      '구매당 최종 레벨1회. 라운드 XP나 증강 XP 레벨업에는 이 알림을 직접 호출하지 않음.',
    ],
    [
      '조합 요약 별/상세/선택 태그에서 네 번째 추천 추가 시도',
      '추천은 최대 3개까지 선택할 수 있습니다. 먼저 하나를 해제해 주세요.',
      'battle-ui.js: changeRecommendedBond → V.toggleRecommendation',
      '거절마다1회. 전체보기 모달의 추천 거절은 recommendationStatus 인라인 글씨이며 공통 알림이 아님.',
    ],
    [
      '증강 후보의 선택 확정이 성공',
      '증강 선택 완료 · {증강 이름}',
      'prototype.js: modalContent click → P.chooseAugment',
      '확정마다1회. 후보 보기/닫기/재열기는 무알림.',
    ],
    [
      '다음 라운드 진행 성공 후 준비 화면으로 진입',
      '{스테이지-노드} 준비 · {SUPPLY/BATTLE/BOSS}',
      'stage-ui.js: continueRound',
      '진행마다1회. 증강 선택 단계로 분기하거나 원정 종료인 경우 이 안내 없이 모달만 표시.',
    ],
    [
      '아군이 배치된 실제 자동 전투를 시작',
      '자동 전투 중 · 기존 캐릭터 스킬과 유대 판정은 유지됩니다.',
      'prototype.js: startBattle',
      '전투 시작마다1회. 보급/증강 재열기/빈 전장 즉시 패배에는 이 문구 없음.',
    ],
    [
      '배치 부족 확인 또는 원정별 생략 설정 후 빈 전장으로 진행',
      '전장이 비어 있어 패배했습니다. 다음 전투 전에 동료를 배치하세요.',
      'prototype.js: startBattle 빈 전장 분기',
      '즉시 패배 결산과 결과 모달을 표시하고1회 호출. 일반 전투 종료 요약 경로로는 가지 않음.',
    ],
    [
      '아군 원인으로 보너스 몬스터를 처치하고 보상을 처음 지급',
      '보너스 몬스터 처치! {아이템 이름 또는 +금액G}',
      'prototype.js: Battle.onUnitKilled → W.claimBonusLoot',
      '전투 중 첫 보상 지급 때1회. 처치가 전투 종료와 겹치면 곧바로 종료 요약이 덮을 수 있음.',
    ],
    [
      '실제 전투 결산을 완료',
      '{승리 또는 후퇴} · 총 보상 +{획득 골드}G',
      'prototype.js: endBattle',
      '전투 결산마다1회. 보너스 처치 안내 뒤에 연속 가능. 결과 모달 뒤에서 시간이 흐르며 모달 재열기로 추가 호출되지 않음.',
    ],
    [
      '난이도 확정 등으로 새 원정을 실제 초기화',
      '새 원정 · 원하는 동료를 영입해 보세요.',
      'prototype.js: resetRun',
      '새 원정마다1회. 초기 페이지 로드에서 fresh()만 실행될 때는 이 문구 대신 초기 안내가 사용됨.',
    ],
  ];
  const policy =
    typeof module !== 'undefined' && module.exports
      ? require('./notice-policy.js')
      : root.AutoNoticePolicy;
  const rows = raw.map((r, i) => ({
    id: 'T' + String(i + 1).padStart(2, '0'),
    condition: r[0],
    message: r[1],
    source: r[2],
    repeat: r[3],
    status: policy.retained.includes('T' + String(i + 1).padStart(2, '0'))
      ? '유지'
      : i === 27
        ? '수정 적용 · 사용자 승인'
        : '삭제 · 표시만',
  }));
  const approvedT28 = rows.find((r) => r.id === 'T28');
  approvedT28.message =
    '원정 종료: 원정이 종료되어 아이템을 버릴 수 없습니다. / 준비 단계 아님: 준비 단계에서만 아이템을 버릴 수 있습니다. / 없는 아이템: 아이템을 찾을 수 없습니다. / 장착 중: 장착 중인 아이템은 먼저 보관함으로 회수하세요.';
  approvedT28.source = 'content-ui.js: discardSelectedItem → notice-policy.js: discardRefusal';
  approvedT28.repeat =
    '실패 원인별 문구 변경 승인 완료. P.discardItem의 기존 실패 검사/알림 발생 조건은 유지.';
  rows.find((r) => r.id === 'T38').repeat =
    '이번부터 아군0명은 시작을 차단하며 기존 즉시 패배 경로/알림은 실행하지 않음.';
  rows.find((r) => r.id === 'T24').condition = '동일 T3 중복 장착 허용으로 거절 조건 제거';
  rows.find((r) => r.id === 'T24').repeat =
    'v0.15.15부터 이 조건으로 거절하거나 알림을 표시하지 않음.';
  const exclusions = [
    '확인 모달: 배치 부족 확인/새 원정/증강·보급 선택은 공통 알림과 별개입니다.',
    '캐릭터/아이템/조합/증강 툴팁 및 전투 중 피해 숫자·스킬 효과는 공통 알림이 아닙니다.',
    '전투/보급 결과창은 별도 모달입니다. 보급 확정 자체에는 tell()이 없고 다음 라운드 진행에서만 준비 안내가 호출됩니다.',
    '상점 새로고침·배속 변경·정상 추천/해제·단순 캐릭터 선택·글꼴 적용·일반 전투 피해에는 공통 알림 호출이 없습니다.',
    'XP 부족/최고 레벨/잠긴 단계의 XP 구매는 비활성/false 처리이며 골드가 부족합니다 토스트가 추가로 뜨지 않습니다.',
    '패치노트 복사 성공/실패는 patchCopyStatus, 전체보기 모달의 추천 제한은 recommendationStatus에 표시되는 인라인 안내입니다.',
  ];
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  function toHTML() {
    return (
      '<section class="notice-audit"><h3>공통 알림 발생 조건 목록</h3><p>' +
      escape(behavior) +
      '</p><p>총 ' +
      rows.length +
      '개 처리 결과 · 유지12 / 표시 삭제28 / T28 승인 수정1. 삭제 행의 조건·문구·연속성 설명은 v0.15.7 조사 이력이며 현재는 표시하지 않습니다.</p><div class="audit-table-scroll"><table><thead><tr>' +
      ['조건 / 사용자 행동', '화면 문구', '관련 코드', '중복·연속 발생 가능성', '현재 상태']
        .map((x) => '<th scope="col">' + x + '</th>')
        .join('') +
      '</tr></thead><tbody>' +
      rows
        .map(
          (r) =>
            '<tr>' +
            [r.id + ' · ' + r.condition, r.message, r.source, r.repeat, r.status]
              .map((x) => '<td>' + escape(x) + '</td>')
              .join('') +
            '</tr>',
        )
        .join('') +
      '</tbody></table></div><details><summary>공통 알림과 구분한 항목</summary><ul>' +
      exclusions.map((x) => '<li>' + escape(x) + '</li>').join('') +
      '</ul></details></section>'
    );
  }
  function toMarkdown() {
    const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return (
      '## 공통 알림 발생 조건 목록\n\n' +
      behavior +
      '\n\n총 ' +
      rows.length +
      '개 처리 결과: 유지12 / 표시 삭제28 / T28 승인 수정1. 삭제 행은 v0.15.7 조사 이력이며 현재 출력하지 않습니다.\n\n| 조건 / 사용자 행동 | 화면 문구 | 관련 코드 | 중복·연속 발생 가능성 | 현재 상태 |\n|---|---|---|---|---|\n' +
      rows
        .map(
          (r) =>
            '| ' +
            [r.id + ' · ' + r.condition, r.message, r.source, r.repeat, r.status]
              .map(cell)
              .join(' | ') +
            ' |',
        )
        .join('\n') +
      '\n\n### 공통 알림과 구분한 항목\n\n' +
      exclusions.map((x) => '- ' + x).join('\n') +
      '\n'
    );
  }
  const api = { behavior, rows, exclusions, toHTML, toMarkdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoNoticeAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
