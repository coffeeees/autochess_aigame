// 메타 영구 강화 40종(요청서 AUTOCHESS_META_PERMANENT_UPGRADES_IMPLEMENTATION_TEST, 1차 플레이테스트 후보).
// 모든 수치는 테스트용 임시값이다. 사용자 승인 없이 바꾸지 않는다. 계산은 src/core/meta-upgrades.ts.
//
// values: 단계별 누적 값(1단계부터). 단위는 unit 필드:
//   pct  = 비율(0.04 = 4%), pp = 퍼센트 포인트(1.5 = +1.5%p), flat = 고정값(GD, HP, G, XP), count = 원정당 횟수
const steps = (per, n = 5) => Array.from({ length: n }, (_, i) => +(per * (i + 1)).toFixed(4));

/** 레벨 보상: 레벨이 오를 때마다 성장 포인트 +2, 뽑기 티켓 +2(새로 도달한 레벨이 5의 배수면 +4) */
export const rewards = { points: 2, tickets: 2, ticketsOnFifth: 4 };

/** 계열 4번째~8번째 노드의 메타 레벨 해금 조건(첫 3종은 Lv.1) */
export const unlockLevels = [1, 1, 1, 10, 20, 35, 50, 70];

export const branches = [
  { id: 'A', name: '공격', color: '#ff9a4d' },
  { id: 'D', name: '방어', color: '#5fa8ff' },
  { id: 'E', name: '경제', color: '#ffd54a' },
  { id: 'G', name: '성장', color: '#6fdc8c' },
  { id: 'S', name: '특수', color: '#c08bff' },
];

/** 단계마다 1P. E8·S8만 최대 4단계 → 38 × 5 + 2 × 4 = 198P */
export const upgrades = [
  // ── A. 공격
  {
    id: 'A1',
    name: '전투 훈련',
    icon: '⚔',
    unit: 'pct',
    values: [0.04, 0.07, 0.1, 0.12, 0.15],
    text: (v) => `모든 아군 AD +${v}%`,
  },
  {
    id: 'A2',
    name: '마력 단련',
    icon: '✧',
    unit: 'pct',
    values: [0.04, 0.07, 0.1, 0.12, 0.15],
    text: (v) => `모든 아군 AP +${v}%`,
  },
  {
    id: 'A3',
    name: '신속한 손놀림',
    icon: '➶',
    unit: 'pct',
    values: [0.04, 0.07, 0.1, 0.12, 0.15],
    text: (v) => `모든 아군 AS +${v}%`,
  },
  {
    id: 'A4',
    name: '치명적 직감',
    icon: '◎',
    unit: 'pp',
    values: steps(1.5),
    text: (v) => `모든 아군 CTC +${v}%p`,
  },
  {
    id: 'A5',
    name: '치명타 숙련',
    icon: '✸',
    unit: 'pp',
    values: steps(4),
    text: (v) => `모든 아군 CTH +${v}%p`,
  },
  {
    id: 'A6',
    name: '마나 순환',
    icon: '⟳',
    unit: 'pct',
    values: steps(0.03),
    text: (v) => `아군 MP 획득량 +${v}% (최대 MP는 그대로)`,
  },
  {
    id: 'A7',
    name: '전투 본능',
    icon: '☄',
    unit: 'pct',
    values: steps(0.02),
    text: (v) => `아군이 주는 피해 +${v}% (물리·마법 각각 한 번)`,
  },
  {
    id: 'A8',
    name: '전장의 지배자',
    icon: '♛',
    unit: 'pct',
    values: steps(0.03),
    text: (v) => `보스에게 주는 피해 +${v}%`,
  },
  // ── D. 방어
  {
    id: 'D1',
    name: '강인한 육체',
    icon: '♥',
    unit: 'pct',
    values: [0.05, 0.09, 0.13, 0.17, 0.2],
    text: (v) => `아군 최대 HP +${v}%`,
  },
  {
    id: 'D2',
    name: '견고한 갑옷',
    icon: '⛨',
    unit: 'flat',
    values: steps(3),
    text: (v) => `아군 GD +${v}`,
  },
  {
    id: 'D3',
    name: '회피 훈련',
    icon: '≋',
    unit: 'pp',
    values: steps(1),
    text: (v) => `아군 DOD +${v}%p`,
  },
  {
    id: 'D4',
    name: '회복의 의지',
    icon: '✚',
    unit: 'pct',
    values: steps(0.04),
    text: (v) => `아군 캐릭터가 받는 회복량 +${v}% (플레이어 HP 제외)`,
  },
  {
    id: 'D5',
    name: '생존 본능',
    icon: '◈',
    unit: 'pct',
    values: steps(0.02),
    text: (v) => `아군이 받는 피해 −${v}% (GD와 별도)`,
  },
  {
    id: 'D6',
    name: '선봉의 방벽',
    icon: '▣',
    unit: 'pct',
    values: steps(0.03),
    text: (v) => `전열(왼쪽에서 3·4번째 열) 아군 최대 HP +${v}%`,
  },
  {
    id: 'D7',
    name: '후방 보호',
    icon: '◫',
    unit: 'pct',
    values: steps(0.015),
    text: (v) => `후열(왼쪽 1·2번째 열) 아군이 받는 피해 −${v}%`,
  },
  {
    id: 'D8',
    name: '불굴의 수호',
    icon: '◍',
    unit: 'pct',
    values: steps(0.02),
    text: (v) => `전투 시작 때 아군 최대 HP의 ${v}% 보호막`,
  },
  // ── E. 경제(기본 보상은 그대로, 추가분만)
  {
    id: 'E1',
    name: '출발 자금',
    icon: '◉',
    unit: 'flat',
    values: steps(1),
    text: (v) => `새 원정 시작 골드 +${v}G`,
  },
  {
    id: 'E2',
    name: '승전 보너스',
    icon: '✪',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 일반 전투 승리에 +1G`,
  },
  {
    id: 'E3',
    name: '패배 보조금',
    icon: '✣',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 일반 전투 패배에 +1G`,
  },
  {
    id: 'E4',
    name: '새로고침 지원',
    icon: '↻',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 무료 상점 새로고침 ${v}회`,
  },
  {
    id: 'E5',
    name: '영입 지원',
    icon: '⚑',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 동료 구매 1G 할인`,
  },
  {
    id: 'E6',
    name: '보급 자금',
    icon: '⛁',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 보급 완료에 +1G`,
  },
  {
    id: 'E7',
    name: '보스 현상금',
    icon: '♜',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 보스 승리에 +1G`,
  },
  {
    id: 'E8',
    name: '저축의 달인',
    icon: '❖',
    unit: 'count',
    values: steps(1, 4),
    text: (v) => `원정마다 이자를 받은 첫 ${v}번에 +1G (이자 상한과 별도)`,
  },
  // ── G. 성장(인게임 XP·레벨, 메타 XP와 무관)
  {
    id: 'G1',
    name: '출발 경험',
    icon: '✿',
    unit: 'flat',
    values: steps(2),
    text: (v) => `새 원정 시작 때 인게임 XP +${v}`,
  },
  {
    id: 'G2',
    name: '전투 학습',
    icon: '✎',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 일반 전투 승리에 인게임 XP +1`,
  },
  {
    id: 'G3',
    name: '실패의 교훈',
    icon: '✐',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 일반 전투 패배에 인게임 XP +1`,
  },
  {
    id: 'G4',
    name: '경험 축적',
    icon: '⬆',
    unit: 'count',
    values: steps(1),
    text: (v) => `원정마다 첫 ${v}번의 XP 구매에 인게임 XP +1 추가`,
  },
  {
    id: 'G5',
    name: '성장 가속',
    icon: '➚',
    unit: 'count',
    values: steps(1),
    text: (v) => `새 라운드(2-1부터) 시작 때 첫 ${v}번 인게임 XP +1`,
  },
  {
    id: 'G6',
    name: '조합 연구',
    icon: '❂',
    unit: 'pct',
    values: steps(0.005),
    text: (v) => `전투 시작 때 활성 조합 종류 1개당 아군 최대 HP +${v}%`,
  },
  {
    id: 'G7',
    name: '숙련된 배치',
    icon: '⚖',
    unit: 'flat',
    values: steps(1),
    text: (v) => `전열·후열에 아군이 모두 있으면 모든 아군 GD +${v}`,
  },
  {
    id: 'G8',
    name: '후반 적응',
    icon: '☀',
    unit: 'pct',
    values: steps(0.03),
    text: (v) => `4라운드(4-1)부터 모든 아군 AD·AP +${v}%`,
  },
  // ── S. 특수
  {
    id: 'S1',
    name: '원정의 가호',
    icon: '♡',
    unit: 'flat',
    values: steps(2),
    text: (v) => `원정 시작 플레이어 HP·HP 상한 +${v}`,
  },
  {
    id: 'S2',
    name: '회복의 축복',
    icon: '❀',
    unit: 'flat',
    values: steps(1),
    text: (v) => `일반 전투 승리 때 플레이어 HP 회복 +${v} (보스 제외, 상한 적용)`,
  },
  {
    id: 'S3',
    name: '장비 숙련',
    icon: '⚒',
    unit: 'pct',
    values: steps(0.02),
    text: (v) => `장착 아이템의 능력치 보너스 +${v}% (고유 효과 제외)`,
  },
  {
    id: 'S4',
    name: '보급 전문가',
    icon: '✉',
    unit: 'pp',
    values: steps(2),
    text: (v) => `보급 완료 때 ${v}% 확률로 +1G (테스트용 임시값)`,
  },
  {
    id: 'S5',
    name: '행운의 영입',
    icon: '✦',
    unit: 'pp',
    values: steps(0.5),
    text: (v) =>
      `상점 4~5코스트 등장 확률 합 +${v}%p (그 레벨에서 나오는 코스트만, 테스트용 임시값)`,
  },
  {
    id: 'S6',
    name: '보스 사냥꾼',
    icon: '⚜',
    unit: 'pct',
    values: steps(0.03),
    text: (v) => `보스 전투 동안 아군 최대 HP +${v}%`,
  },
  {
    id: 'S7',
    name: '전투의 축복',
    icon: '✙',
    unit: 'flat',
    values: steps(2),
    text: (v) => `매 전투 동안 모든 아군 GD +${v}`,
  },
  {
    id: 'S8',
    name: '원정 보험',
    icon: '☂',
    unit: 'count',
    values: steps(1, 4),
    text: (v) => `원정마다 HP를 잃는 첫 ${v}번의 패배에서 손실 HP −1 (캐릭터 부활 아님)`,
  },
].map((u, i) => {
  const branch = u.id[0];
  const index = Number(u.id.slice(1)) - 1;
  return { ...u, branch, index, unlock: unlockLevels[index], max: u.values.length, order: i };
});

export default { rewards, unlockLevels, branches, upgrades };
