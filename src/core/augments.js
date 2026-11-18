// All balance values live here; effects consume these fields rather than UI copy.
const config = {
  nodes: ['1-3', '3-3', '5-3'],
  tierOrder: ['silver', 'gold', 'prism'],
  options: 3,
  maxPicks: 3,
  maxCapacity: 11,
  minMana: 1,
};
const tiers = {
  silver: { name: '실버', color: '#b6bac4' },
  gold: { name: '골드', color: '#efc766' },
  prism: { name: '프리즘', color: '#c49aff' },
};
// v0.16.0 증강 54종 1차 후보안(AUTOCHESS_AUGMENT_54_TEST_DRAFT). 모든 수치는 검증 전 임시값.
// 효과는 effect 필드로만 표현하고, 전투 효과는 combat/augment-effects.js, 원정 효과는 augment-run.js가 읽는다.
// 기본안(사용자 승인 2026-11-18): 능력치 %는 현재 값에 곱하기, GD +n은 고정값, 동률은 코스트 → 성급 → 앞쪽 칸,
// 소환수·분신의 처치는 주인 몫, 아군 사망·생존 판정에서는 소환수·분신 제외. 자세한 정의는 docs/GAME_DESIGN.md 증강 절.
const rows = [
  [
    'S01',
    '천상의 축복',
    '모든 아군이 입힌 실제 피해의 8%만큼 HP 회복(기본 공격·스킬·지속 피해, 아이템 발동 제외)',
    { allLeech: 0.08 },
  ],
  [
    'S02',
    '전투의 열기',
    '전투 시작 후 5초마다 모든 아군 AS +4%, 최대 4중첩',
    { haste: { interval: 5, as: 0.04, max: 4 } },
  ],
  ['S03', '마나의 샘', '모든 아군이 전투 시작 시 최대 MP의 20%를 보유', { startMana: 0.2 }],
  [
    'S04',
    '최후의 저항',
    '아군 HP가 처음으로 30% 이하가 되면 최대 HP의 15% 보호막을 4초간 획득',
    { lowGuard: { threshold: 0.3, shield: 0.15, seconds: 4 } },
  ],
  [
    'S05',
    '집중 포화',
    '같은 적을 기본 공격할 때마다 그 적에게 주는 피해 +2%, 최대 10중첩 · 대상이 바뀌면 초기화',
    { focus: { per: 0.02, max: 10 } },
  ],
  [
    'S06',
    '승리의 여세',
    '적을 처치한 아군은 5초간 AD·AP +15% · 추가 처치 시 지속시간 갱신',
    { killRush: { power: 0.15, seconds: 5 } },
  ],
  ['S07', '작은 행운', '선택 즉시 8G 획득', { gold: 8 }],
  ['S08', '경험의 지혜', '선택 즉시 10XP 획득', { xp: 10 }],
  ['S09', '절약 정신', '상점 새로고침 비용 2G → 1G', { reroll: 1 }],
  [
    'S10',
    '무기 거래상',
    '무작위 1티어 아이템 1개와 3G 획득',
    { items: { tier: 1, count: 1 }, gold: 3 },
  ],
  [
    'S11',
    '완벽한 승리',
    '아군이 한 명도 쓰러지지 않고 전투에서 이기면 추가 2G(소환수·분신 제외)',
    { flawlessGold: 2 },
  ],
  [
    'S12',
    '미래 투자',
    '선택 즉시 5G 획득 · 이후 전투 4회를 마치면 추가 10G',
    { gold: 5, delayed: { battles: 4, gold: 10 } },
  ],
  [
    'S13',
    '단결된 의지',
    '활성화된 조합 하나당 모든 아군 AD·AP +3%',
    { bondPower: { power: 0.03 } },
  ],
  ['S14', '선봉대', '아군이 서 있는 가장 앞줄의 아군 최대 HP +20%', { frontRow: { hp: 0.2 } }],
  ['S15', '후방 지원', '아군이 서 있는 가장 뒷줄의 아군 AS +15%', { backRow: { as: 0.15 } }],
  [
    'S16',
    '쌍둥이 수호자',
    '가장 앞줄에 정확히 2명만 서 있으면 그 2명 GD +25',
    { twinGuard: { gd: 25 } },
  ],
  ['S17', '모범 동료', '전투 시작 시 AD가 가장 높은 아군 1명 AS +20%', { ace: { as: 0.2 } }],
  [
    'S18',
    '위험한 계약',
    '플레이어 HP 10 소모, 무작위 3코스트 동료 2명 획득 · HP 10 이하이면 선택 불가',
    { hpCost: { flat: 10 }, units: [{ cost: 3, count: 2 }] },
  ],
  [
    'G01',
    '초월의 시간',
    '전투 시작 12초 후 모든 아군 피해량 +35%',
    { lateDamage: { at: 12, damage: 0.35 } },
  ],
  [
    'G02',
    '불굴의 의지',
    '아군 HP가 처음으로 35% 이하가 되면 최대 HP 25% 회복, 5초간 GD +20',
    { lowRally: { threshold: 0.35, heal: 0.25, gd: 20, seconds: 5 } },
  ],
  [
    'G03',
    '전투의 가속',
    '전투 시작 후 3초마다 모든 아군 AS +8%, 최대 5중첩',
    { haste: { interval: 3, as: 0.08, max: 5 } },
  ],
  [
    'G04',
    '마력 폭주',
    '아군이 스킬을 쓸 때마다 그 아군 AP +8%, 최대 5중첩',
    { castPower: { ap: 0.08, max: 5 } },
  ],
  [
    'G05',
    '복수의 맹세',
    '아군이 쓰러질 때마다 생존 아군 AD·AP +8%, 최대 4중첩(소환수·분신 제외)',
    { avenge: { power: 0.08, max: 4 } },
  ],
  [
    'G06',
    '전장의 구원',
    '적을 처치할 때마다 HP 비율이 가장 낮은 아군을 최대 HP의 12% 회복',
    { killHeal: { ratio: 0.12 } },
  ],
  [
    'G07',
    '황금의 흐름',
    '선택 즉시 5G 획득 · 이후 새 스테이지에 들어갈 때마다 2G',
    { gold: 5, stageGold: 2 },
  ],
  ['G08', '상인의 특권', '스테이지마다 첫 상점 새로고침 무료', { freeRerollPerStage: 1 }],
  [
    'G09',
    '가치 투자',
    '무작위 2코스트 동료 1명을 2성으로 획득 · 이후 라운드 시작마다 같은 동료 1명(1성) 추가',
    { valueInvest: { cost: 2, star: 2 } },
  ],
  [
    'G10',
    '역전의 자금',
    '전투에서 지면 추가 3G와 무료 새로고침 1회(쌓임)',
    { lossGold: 3, lossFreeReroll: 1 },
  ],
  [
    'G11',
    '고위험 투자',
    '보유 골드의 절반(내림)을 맡기고, 전투 3회를 마치면 맡긴 골드의 2배를 돌려받음 · 원정이 끝나면 돌려받지 못함',
    { invest: { ratio: 0.5, battles: 3, multiplier: 2 } },
  ],
  [
    'G12',
    '성장의 보상',
    '레벨이 오를 때마다 무작위 2코스트 또는 3코스트 동료 1명 획득',
    { levelUnits: { costs: [2, 3] } },
  ],
  [
    'G13',
    '쌍둥이 전술',
    '전장에 같은 동료를 정확히 2명 배치하면 두 동료 AD·AP·GD +25% · 보류: "같은 캐릭터 전장 1명" 규칙과 충돌해 후보에서 제외',
    { twins: { power: 0.25 } },
    { hold: true },
  ],
  [
    'G14',
    '전장의 지휘관',
    '전방 2줄 아군 1명당 후방 2줄 아군 피해량 +5%, 최대 25%',
    { command: { per: 0.05, max: 0.25 } },
  ],
  [
    'G15',
    '조합의 대가',
    '활성화된 조합 하나당 모든 아군 최대 HP +80, AD·AP +3%',
    { bondPower: { power: 0.03, hp: 80 } },
  ],
  [
    'G16',
    '선택받은 영웅',
    '전투 시작 시 코스트가 가장 높은 아군 1명 최대 HP +30%, 피해량 +20%',
    { chosen: { hp: 0.3, damage: 0.2 } },
  ],
  [
    'G17',
    '마지막 수호자',
    '마지막으로 남은 아군이 최대 HP 40% 보호막과 AS +35% 획득 · 전투당 1회(소환수·분신 제외)',
    { lastStand: { shield: 0.4, as: 0.35 } },
  ],
  [
    'G18',
    '전술 복제',
    '전투 시작 시 지정한 동료의 분신 1명 소환(최대 HP 50%, AD·AP 60%, 기본 공격만, 조합 인원 제외) · 지정이 없으면 코스트가 가장 높은 아군',
    { clone: { pick: 'designated', hp: 0.5, power: 0.6 } },
  ],
  [
    'P01',
    '불멸의 군단',
    '모든 아군이 전투당 1회 치명적 피해를 받으면 HP 1로 생존하고 최대 HP의 30% 보호막을 4초간 획득',
    { immortal: { ratio: 0.3, seconds: 4 } },
  ],
  [
    'P02',
    '마나의 해방',
    '모든 아군이 전투 시작 시 최대 MP의 75%를 보유 · 스킬 사용 후 3초간 AP +25%',
    { startMana: 0.75, castBuff: { ap: 0.25, seconds: 3 } },
  ],
  [
    'P03',
    '광전사의 축제',
    '모든 아군 AS +40%, 최대 HP -20% · 적을 처치하면 잃은 HP의 10% 회복',
    { as: 0.4, hpMult: -0.2, killRecover: 0.1 },
  ],
  [
    'P04',
    '최후의 심판',
    '전투 시작 15초 후 모든 적에게 최대 HP의 20% 고정 피해(보스 5%) · 방어·회피·치명타 무시, 보호막에는 막힘',
    { judgment: { at: 15, ratio: 0.2, boss: 0.05 } },
  ],
  [
    'P05',
    '영혼의 계승',
    '아군이 쓰러지면 가장 가까운 생존 아군에게 쓰러진 아군의 AD·AP·GD 30%를 전투 끝까지 이전(소환수·분신 제외)',
    { inherit: { ratio: 0.3 } },
  ],
  [
    'P06',
    '시간의 지배자',
    '전투 시작 10초 후 8초간 모든 적 AS -30%, 모든 아군 AS +30%',
    { timeLord: { at: 10, seconds: 8, enemy: -0.3, ally: 0.3 } },
  ],
  [
    'P07',
    '황금의 제국',
    '선택 즉시 25G 획득 · 이후 전투 승리마다 추가 2G',
    { gold: 25, winGold: 2 },
  ],
  [
    'P08',
    '전설의 영입',
    '무작위 5코스트 동료 1명, 4코스트 동료 2명 획득',
    {
      units: [
        { cost: 5, count: 1 },
        { cost: 4, count: 2 },
      ],
    },
  ],
  [
    'P09',
    '무한한 성장',
    '선택 즉시 20XP 획득 · 이후 스테이지를 마칠 때마다 3XP',
    { xp: 20, stageXp: 3 },
  ],
  [
    'P10',
    '운명의 상점',
    '상점에 현재 레벨에서 등장 가능한 가장 높은 코스트의 동료가 최소 1명 나옴',
    { shopGuarantee: true },
  ],
  [
    'P11',
    '위험한 도박',
    '현재 플레이어 HP의 30%(내림) 소모, 무작위 3티어 아이템 3개 획득 · HP는 1 아래로 내려가지 않음',
    { hpCost: { ratio: 0.3 }, items: { tier: 3, count: 3 } },
  ],
  [
    'P12',
    '복리의 마법',
    '이자 상한 5G → 10G · 전투 승리 시 보유 골드의 10%(내림, 최대 5G) 추가',
    { interestCap: 10, winInterest: { ratio: 0.1, max: 5 } },
  ],
  ['P13', '초월의 군세', '배치 한도 +1 · 최대 11명', { capacity: 1 }],
  [
    'P14',
    '이중 조합',
    '전투 시작 시 활성 조합 중 무작위 1개의 단계를 한 단계 올림(최고 단계 제외, 인원 수는 그대로)',
    { bondBoost: 1 },
  ],
  [
    'P15',
    '전장의 분신',
    '전투 시작 시 코스트가 가장 높은 아군의 분신 1명 소환(최대 HP·AD·AP 70%, 기본 공격만, 조합 인원 제외)',
    { clone: { pick: 'highestCost', hp: 0.7, power: 0.7 } },
  ],
  [
    'P16',
    '왕의 친위대',
    '코스트가 가장 높은 아군 1명을 왕으로 지정: 피해량 +50%, 최대 HP +40% · 왕이 쓰러지면 다른 아군이 각자 최대 HP의 20% 피해(HP 1 아래로는 안 내려감)',
    { king: { damage: 0.5, hp: 0.4, deathDamage: 0.2 } },
  ],
  [
    'P17',
    '완벽한 조화',
    '활성화된 서로 다른 조합이 4개 이상이면 모든 아군 피해량 +30%, 최대 HP +30%',
    { harmony: { bonds: 4, damage: 0.3, hp: 0.3 } },
  ],
  [
    'P18',
    '희생의 의식',
    '전투 시작 시 코스트가 가장 낮은 아군 1명 희생(아군 2명 이상일 때) · 나머지 아군 AD·AP·최대 HP +희생자 코스트×10%',
    { sacrifice: { perCost: 0.1 } },
  ],
];
// v0.15.18까지의 확정 증강 36종. v0.16.0에서 54종 후보안으로 바꾸며 ID 앞에 L을 붙여 남겼다.
// 새 후보로는 나오지 않고, 예전 저장(저장 버전 2 이하)에서 고른 증강이 원래 효과대로 동작하게 한다.
const legacyRows = [
  ['LS01', '강인한 육체', '모든 아군 최대 HP +150', { flat: { HP: 150 } }],
  ['LS02', '날카로운 무기', '모든 아군 AD +12', { flat: { AD: 12 } }],
  ['LS03', '마력 증폭', '모든 아군 AP +15', { flat: { AP: 15 } }],
  ['LS04', '견고한 방어', '모든 아군 GD +12', { flat: { GD: 12 } }],
  ['LS05', '신속한 공격', '모든 아군 AS +10%', { as: 0.1 }],
  ['LS06', '정밀 타격', '모든 아군 CTC +8%p', { flat: { CTC: 8 } }],
  ['LS07', '마나 저장소', '모든 아군 최대 MP -10%', { mpReduction: 0.1 }],
  [
    'LS08',
    '전투 준비',
    '전투 시작 시 모든 아군에게 최대 HP의 8% 보호막을 5초간 부여',
    { startShield: { ratio: 0.08, seconds: 5 } },
  ],
  ['LS09', '작은 행운', '선택 즉시 6G 획득', { gold: 6 }],
  ['LS10', '경험의 지혜', '선택 즉시 8XP 획득', { xp: 8 }],
  ['LS11', '절약 정신', '상점 새로고침 비용 2G → 1G', { reroll: 1 }],
  ['LS12', '생존 본능', '모든 아군 DOD +6%p', { flat: { DOD: 6 } }],
  ['LG01', '거인의 축복', '모든 아군 최대 HP +300', { flat: { HP: 300 } }],
  ['LG02', '전투의 달인', '모든 아군 AD +20, AS +10%', { flat: { AD: 20 }, as: 0.1 }],
  [
    'LG03',
    '대마법사의 지혜',
    '모든 아군 AP +30, 최대 MP -10%',
    { flat: { AP: 30 }, mpReduction: 0.1 },
  ],
  ['LG04', '철벽 진형', '모든 아군 GD +20, DOD +8%p', { flat: { GD: 20, DOD: 8 } }],
  ['LG05', '치명적인 일격', '모든 아군 CTC +12%p, CTH +25%p', { flat: { CTC: 12, CTH: 25 } }],
  [
    'LG06',
    '흡혈의 본능',
    '아군 기본 공격의 실제 피해 12%만큼 공격자 HP 회복',
    { basicLeech: 0.12 },
  ],
  [
    'LG07',
    '전투의 열기',
    '전투 시작 후 5초마다 생존 아군 AD·AP +5%, 최대 4중첩',
    { heat: { interval: 5, ratio: 0.05, max: 4 } },
  ],
  [
    'LG08',
    '마나 순환',
    '스킬 사용 시 해당 캐릭터 최대 MP 15% 회복 · 캐릭터별 쿨다운 5초',
    { manaReturn: { ratio: 0.15, cooldown: 5 } },
  ],
  [
    'LG09',
    '수호자의 맹세',
    '전투 시작 시 모든 아군에게 최대 HP의 15% 보호막을 6초간 부여',
    { startShield: { ratio: 0.15, seconds: 6 } },
  ],
  ['LG10', '풍요의 축복', '선택 즉시 12G 획득', { gold: 12 }],
  ['LG11', '빠른 성장', '선택 즉시 16XP 획득', { xp: 16 }],
  ['LG12', '승리의 보상', '일반/보스 전투 승리 시 추가 2G 획득', { winGold: 2 }],
  [
    'LP01',
    '초월자의 축복',
    '모든 아군 최대 HP +400, AD +25, AP +30',
    { flat: { HP: 400, AD: 25, AP: 30 } },
  ],
  ['LP02', '광전사의 군단', '모든 아군 AS +30%, CTC +15%p', { as: 0.3, flat: { CTC: 15 } }],
  ['LP03', '마력의 폭풍', '모든 아군 AP +60, 최대 MP -20%', { flat: { AP: 60 }, mpReduction: 0.2 }],
  [
    'LP04',
    '불멸의 군대',
    '모든 아군이 전투당 1회 치명적 피해를 받으면 HP 1로 생존하고 최대 HP의 20% 보호막을 3초간 획득',
    { immortal: { ratio: 0.2, seconds: 3 } },
  ],
  [
    'LP05',
    '피의 축제',
    '아군 기본 공격 및 스킬의 실제 피해 15%만큼 공격자 HP 회복',
    { attackLeech: 0.15 },
  ],
  [
    'LP06',
    '전장의 지배자',
    '전투 시작 10초 후 생존 아군 AD·AP +40%, AS +20% · 1회',
    { dominion: { at: 10, power: 0.4, as: 0.2 } },
  ],
  ['LP07', '마나의 해방', '모든 아군이 전투 시작 시 최대 MP의 50%를 보유', { startMana: 0.5 }],
  [
    'LP08',
    '완벽한 방어',
    '모든 아군 GD +35, DOD +15%p, 최대 HP +250',
    { flat: { GD: 35, DOD: 15, HP: 250 } },
  ],
  [
    'LP09',
    '황금의 제국',
    '선택 즉시 25G 획득. 이후 일반/보스 전투 승리 시 추가 2G',
    { gold: 25, winGold: 2 },
  ],
  ['LP10', '초고속 성장', '선택 즉시 32XP 획득', { xp: 32 }],
  ['LP11', '장비의 축복', '선택 즉시 T3 아이템 2개 획득', { items: { tier: 3, count: 2 } }],
  ['LP12', '한계 돌파', '이번 원정의 레벨별 배치 한도 +1 · 최대 11명', { capacity: 1 }],
];
const tierOf = (letter) => (letter === 'S' ? 'silver' : letter === 'G' ? 'gold' : 'prism');
const iconOf = (letter) => (letter === 'S' ? '◇' : letter === 'G' ? '◆' : '✦');
/** 현재 후보 54종(hold: 보류 — 후보로 나오지 않음) */
const augments = rows.map(([id, name, text, effect, flags = {}]) => ({
  id,
  name,
  text,
  effect,
  tier: tierOf(id[0]),
  icon: iconOf(id[0]),
  hold: !!flags.hold,
}));
/** 이전 확정 증강 36종(L로 시작). 예전 저장 전용 */
const legacy = legacyRows.map(([id, name, text, effect]) => ({
  id,
  name,
  text,
  effect,
  tier: tierOf(id[1]),
  icon: iconOf(id[1]),
  legacy: true,
}));
const all = [...augments, ...legacy];
const byId = (id) => all.find((a) => a.id === id);
/** 저장 버전 2 이하의 증강 ID('S01') → 이전 증강 ID('LS01') */
const legacyId = (id) => (/^[SGP]\d\d$/.test(id) && byId('L' + id) ? 'L' + id : id);
const selected = (ids) => [...new Set(ids || [])].map(byId).filter(Boolean);
/** 고른 증강들의 효과 중 key가 있는 것들의 값 */
const effects = (ids, key) =>
  selected(ids)
    .map((a) => a.effect[key])
    .filter((v) => v !== undefined && v !== null && v !== false);
const hasEffect = (ids, key) => effects(ids, key).length > 0;
function aggregate(ids) {
  const out = {
    flat: {},
    as: 0,
    mpReduction: 0,
    capacity: 0,
    winGold: 0,
    startMana: 0,
    hpMult: 0,
    interestCap: 0,
  };
  for (const a of selected(ids)) {
    const e = a.effect;
    for (const [key, value] of Object.entries(e.flat || {}))
      out.flat[key] = (out.flat[key] || 0) + value;
    for (const key of ['as', 'mpReduction', 'capacity', 'winGold', 'hpMult'])
      out[key] += e[key] || 0;
    out.startMana = Math.max(out.startMana, e.startMana || 0);
    out.interestCap = Math.max(out.interestCap, e.interestCap || 0);
  }
  return out;
}
function applyStats(stats, ids) {
  const s = { ...stats },
    e = aggregate(ids);
  for (const [key, value] of Object.entries(e.flat)) s[key] += value;
  s.AS *= 1 + e.as;
  if (e.hpMult) s.HP *= Math.max(0.05, 1 + e.hpMult);
  if (s.MP > 0) s.MP = Math.max(config.minMana, s.MP * (1 - e.mpReduction));
  return s;
}
const nodeOrdinal = (node) => {
  const [stage, round] = node.split('-').map(Number);
  return (stage - 1) * 5 + round;
};
function draw(ids, rng) {
  const tier = config.tierOrder[Math.min(2, Math.floor(rng() * 3))],
    pool = augments.filter((a) => a.tier === tier && !a.hold && !(ids || []).includes(a.id)),
    optionIds = [];
  while (optionIds.length < config.options && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    optionIds.push(pool.splice(i, 1)[0].id);
  }
  return { tier, optionIds };
}
const api = {
  config,
  tiers,
  augments,
  legacy,
  byId,
  legacyId,
  selected,
  effects,
  hasEffect,
  aggregate,
  applyStats,
  nodeOrdinal,
  draw,
};

export default api;
