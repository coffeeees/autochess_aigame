import B from '../board.js';
import higherDrafts from './higher-cost-drafts.js';
import Bonds from './bonds.js';

const synergies = Bonds.definitions;
const rosterRows = [
  [1, '언데드', '궁수', '화염'],
  [1, '마족', '소환사', '독'],
  [1, '인간', '전사', '암흑'],
  [1, '엘프', '암살자', '번개'],
  [1, '엘프', '주술사', '물'],
  [1, '마족', '암살자', '바람'],
  [1, '인간', '궁수', '번개'],
  [1, '언데드', '마법사', '물'],
  [1, '용족', '전사', '바람'],
  [1, '수인', '기사', '대지'],
  [1, '드워프', '소환사', '화염'],
  [1, '천족', '기사', '독'],
  [2, '드워프', '마법사', '빙결'],
  [2, '용족', '무도가', '화염'],
  [2, '드워프', '사제', '암흑'],
  [2, '수인', '소환사', '번개'],
  [2, '엘프', '전사', '혈마법'],
  [2, '정령', '사제', '신성'],
  [2, '천족', '주술사', '빙결'],
  [2, '인간', '무도가', '혈마법'],
  [2, '마족', '마법사', '신성'],
  [2, '정령', '전사', '대지'],
  [2, '엘프', '기사', '화염'],
  [3, '엘프', '사제', '빙결'],
  [3, '정령', '마법사', '번개'],
  [3, '언데드', '전사', '빙결'],
  [3, '엘프', '궁수', '독'],
  [3, '언데드', '암살자', '암흑'],
  [3, '마족', '궁수', '대지'],
  [3, '마족', '기사', '물'],
  [3, '수인', '암살자', '화염'],
  [3, '인간', '마법사', '바람'],
  [3, '인간', '주술사', '화염'],
  [4, '인간', '사제', '물'],
  [4, '수인', '마법사', '독'],
  [4, '드워프', '암살자', '대지'],
  [4, '천족', '궁수', '혈마법'],
  [4, '언데드', '소환사', '신성'],
  [4, '정령', '기사', '빙결'],
  [4, '엘프', '무도가', '암흑'],
  [4, '마족', '전사', '번개'],
  [5, '드워프', '주술사', '바람'],
  [5, '언데드', '무도가', '번개'],
  [5, '인간', '암살자', '빙결'],
  [5, '용족', '궁수', '암흑'],
];
const proposed = [
  ['잿불 사수 모르칸', 550, 80, 55, 25, 150, 10, 18, 0.8, 4, 5],
  ['역병술사 제르크', 520, 70, 35, 55, 150, 5, 16, 0.65, 3, 0],
  ['흑검병 카이른', 750, 100, 55, 20, 150, 5, 30, 0.7, 1, 0],
  ['뇌광의 세리아', 540, 80, 60, 20, 150, 15, 18, 0.85, 1, 10],
  ['물결술사 리엔', 550, 70, 35, 50, 150, 5, 18, 0.65, 3, 5],
  ['질풍의 라제크', 560, 80, 55, 25, 150, 15, 20, 0.85, 1, 10],
  ['섬광 사수 에단', 530, 80, 60, 20, 150, 10, 16, 0.9, 4, 5],
  ['침수술사 네크리스', 500, 60, 35, 60, 150, 5, 15, 0.6, 4, 0],
  ['비늘 전사 드라칸', 800, 100, 50, 30, 150, 5, 32, 0.7, 1, 0],
  ['바위방패 브로크', 800, 100, 40, 20, 150, 5, 40, 0.6, 1, 0],
  ['화로장인 토르딘', 600, 80, 40, 50, 150, 5, 25, 0.6, 3, 0],
  ['성역 기사 아엘', 760, 100, 45, 30, 150, 5, 38, 0.6, 1, 0],
];
const statKeys = ['HP', 'MP', 'AD', 'AP', 'CTH', 'CTC', 'GD', 'AS', 'RNG', 'DOD'];
const roster = rosterRows.map(([cost, race, job, trait], i) => {
  const id = 'C' + String(i + 1).padStart(2, '0');
  return {
    id,
    cost,
    race,
    job,
    trait,
    playable: true,
    ...(cost === 1
      ? {
          name: proposed[i][0],
          stats: Object.fromEntries(statKeys.map((k, j) => [k, proposed[i][j + 1]])),
          provisional: true,
        }
      : (() => {
          const draft = higherDrafts.find((x) => x.id === id);
          return {
            name: draft.name,
            stats: { ...draft.stats },
            provisional: true,
            draftSource: 'AUTOCHESS_02.md',
          };
        })()),
  };
});
// v0.20.0 캐릭터 개명(요청서 AUTOCHESS_ITEM_REWORK_AND_RENAME): C01 녹스 유지, C02~C45 새 이름. ID·코스트·종족·직업·특성·능력치·스킬은 그대로
const displayNames = [
  '녹스',
  '아젤리아',
  '하린',
  '시온',
  '수련',
  '카즈하',
  '서아',
  '벨로아',
  '류화',
  '발테른',
  '브린다',
  '에르시아',
  '브리엘',
  '연호',
  '베스페라',
  '코하루',
  '이그니아',
  '아리에',
  '유키',
  '현무',
  '오필리아',
  '초아',
  '로젤린',
  '설린',
  '제르온',
  '모르가나',
  '비엘라',
  '사야',
  '카르디아',
  '네리온',
  '홍아',
  '청하',
  '아그란',
  '아스테리아',
  '미호',
  '월영',
  '카르넬리아',
  '오르델리아',
  '글라디온',
  '카구야',
  '뇌화',
  '바하리아',
  '라이카',
  '백련',
  '아바르크',
];
/** 성별(v0.20.0 개명과 함께 추가, 화면에는 표시하지 않음): 여 36 / 남 9 */
const genders = [
  'male',
  'female',
  'female',
  'female',
  'female',
  'female',
  'female',
  'female',
  'female',
  'male',
  'female',
  'female',
  'female',
  'male',
  'female',
  'female',
  'female',
  'female',
  'female',
  'male',
  'female',
  'female',
  'female',
  'female',
  'male',
  'female',
  'female',
  'female',
  'female',
  'male',
  'female',
  'female',
  'male',
  'female',
  'female',
  'female',
  'female',
  'female',
  'male',
  'female',
  'female',
  'female',
  'female',
  'female',
  'male',
];
for (const [i, u] of roster.entries()) {
  u.name = displayNames[i];
  u.gender = genders[i];
}
const playableIds = roster.filter((x) => x.playable).map((x) => x.id);
const skills = {
  C01: {
    name: '불씨 화살',
    coefficient: 'AD',
    text: '대상에게 AD 160% 물리 피해. 4초 화상: 매초 AD 15% 마법 피해.',
  },
  C02: {
    name: '맹독의 하수인',
    coefficient: 'AP',
    text: '8초 역병충 소환, 최대 2마리. AP 40% 공격력, 공격 시 3초 중독. 소환수 수치·독 피해는 임시.',
  },
  C03: {
    name: '그림자 베기',
    coefficient: 'AD',
    text: '대상에게 AD 180% 물리 피해. 4초간 대상 AD 15% 감소.',
  },
  C04: {
    name: '섬광 찌르기',
    coefficient: 'AD',
    text: 'AD 200% 물리 피해, 이 공격의 치명타 확률 +20%p. 치명타 시 AD 50% 추가 마법 피해.',
  },
  C05: {
    name: '치유의 물결',
    coefficient: 'AP',
    text: 'HP 비율이 가장 낮은 아군 AP 180% 회복. 해로운 상태이상 1개 제거.',
  },
  C06: {
    name: '바람 가르기',
    coefficient: 'AD',
    text: '각각 AD 140% 물리 피해 2회. 4초간 자신의 공격속도 +20%.',
  },
  C07: {
    name: '연속 사격',
    coefficient: 'AD',
    text: 'AD 75% 물리 피해 3회. 마지막 화살은 주변 적 1명에게 튕겨 AD 50% 마법 피해. 튕김 범위 임시.',
  },
  C08: {
    name: '심연의 물구슬',
    coefficient: 'AP',
    text: '대상에게 AP 220% 마법 피해. 3초간 공격속도 15% 감소.',
  },
  C09: {
    name: '용의 돌진',
    coefficient: 'AD',
    text: '대상에게 돌진, AD 170% 물리 피해와 1초 기절. 인접 시 이동 없이 공격. 경로 규칙 임시.',
  },
  C10: {
    name: '대지의 수호',
    coefficient: 'GD',
    text: '5초간 자신의 GD +30%. 인접 아군 중 HP 비율이 가장 낮은 1명에게 GD 200% 보호막.',
  },
  C11: {
    name: '화염 정령 소환',
    coefficient: 'AP',
    text: '8초 화염 정령 소환, 최대 1마리. AP 60% 마법 공격. 소멸 시 주변에 AP 100% 마법 피해. 소환수·범위 수치 임시.',
  },
  C12: {
    name: '부식의 방패',
    coefficient: 'GD',
    text: '5초간 GD 250% 보호막. 이 보호막 유지 중 자신을 기본 공격한 적에게 3초간 GD 15% 감소.',
  },
};
for (const draft of higherDrafts) skills[draft.id] = { ...draft.skill };
for (const u of roster.filter((u) => u.cost >= 2 && u.cost <= 3))
  skills[u.id] = { ...skills[u.id], implemented: true, draft: false, todo: [] };
const costColors = { 1: '#9699a2', 2: '#59b977', 3: '#578ce5', 4: '#af73de', 5: '#e6c449' };
// All numbers below are explicitly PROTOTYPE assumptions, never final balance.
const prototypeConfig = {
  label: '테스트용 임시 규칙',
  board: B.config,
  combat: {
    tickSeconds: 0.1,
    maxSeconds: 90,
    defenseDenominator: 100,
    startMana: 0,
    manaOnAttack: 12,
    manaOnHit: 6,
    magicManaMultiplier: 1.5,
    castTime: 0.25,
    skillsCrit: false,
    basicDodge: true,
    skillsDodge: false,
    dodgeCap: 40, // 최종 회피 확률 상한 %(v0.21.0 장비 밸런스 1차). 치명타 확률은 100%까지
    statusPolicy: '같은 시전자·같은 효과는 갱신, 다른 시전자 DOT는 중첩',
    duplicateSynergy: '서로 다른 ID만 집계',
    summonPlacementRadius: 3,
    chargeStepSeconds: 0.12,
  },
  summons: {
    plague: { HP: 180, AS: 0.8, RNG: 1, poisonApRatio: 0.12 },
    fire: { HP: 220, AS: 0.7, RNG: 3, explosionRadius: 2 },
  },
  skillAssumptions: {
    ricochetRadius: 2,
    chargePath: 'BFS 최단 경로, 막힌 칸 통과 불가; 이동 가능한 마지막 칸에서 시전',
  },
  economy: {
    startingGold: 7,
    rerollCost: 2,
    shopSlots: 5,
    winReward: 3,
    loseReward: 1,
    interestEvery: 10,
    maxInterest: 5,
    saleRatio: 1,
    mergeCopies: 3,
    maxStar: 3,
    starMultiplier: 2,
  },
  run: {
    startingHealth: 100,
    lossBase: 10,
    lossPerWave: 2,
    enemyScaleBase: 0.72,
    enemyScalePerWave: 0.055,
  },
  experimentalSynergyEffects: {
    enabled: false,
    notice: '구 유대 효과 폐기 · 새 16종 임시 밸런스 v1 항상 적용',
    rules: {},
  },
  todos: [
    'GD 공식·마나 획득·시작 마나·시전 시간 미확정',
    '치명타·회피 적용 범위 및 상태이상 중첩 미확정',
    '소환수 HP/AS/RNG·중독 피해·폭발 범위 미확정',
    '전장 크기·BFS 이동·목표 선정·동시 행동 처리 임시',
    '합성·성급·적 편성·패배 피해 공식 임시. 라운드와 기본 골드는 통합 기획안 기준',
    '새 16종 유대 임시 밸런스 v1 적용 · 추후 조정 가능',
    'C01~C45 전체 해금 · 4·5코스트 승인한 임시 스킬 판정 적용',
  ],
};
roster.forEach((u, i) => {
  u.bonds = [...Bonds.pairs[i]];
  if (u.cost > 3) {
    skills[u.id].implemented = true;
    skills[u.id].draft = false;
    skills[u.id].todo = [];
  }
});
skills.C07.text =
  'AD 75% 물리 피해 3회. 마지막 공격은 주 대상 외 전장 생존 적 중 주 대상과 가까운 최대 2명에게 각각 AD 70% 마법 피해. 거리 동률은 UID순.';
const byId = (id) => roster.find((x) => x.id === id);
function evaluateSynergies(units) {
  const unique = [
    ...new Set(units.filter((u) => !u.summon).map((u) => (typeof u === 'string' ? u : u.id))),
  ]
    .map(byId)
    .filter(Boolean);
  return synergies.map((s) => {
    const members = unique.filter((u) => Bonds.has(u, s.name)).map((u) => u.id);
    const count = members.length,
      achieved = s.thresholds.filter((n) => n <= count);
    const possible = roster.filter((u) => u.playable && Bonds.has(u, s.name)).length;
    return {
      ...s,
      count,
      members,
      threshold: achieved.length ? achieved.at(-1) : 0,
      tier: achieved.length,
      possible,
      stages: s.thresholds.map((n) => ({
        threshold: n,
        achieved: count >= n,
        reachable: possible >= n,
      })),
    };
  });
}
const api = {
  roster,
  synergies,
  playableIds,
  skills,
  prototypeConfig,
  statKeys,
  costColors,
  byId,
  evaluateSynergies,
  hasBond: Bonds.has,
};

export default api;
