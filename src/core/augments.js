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
const rows = [
  ['S01', '강인한 육체', '모든 아군 최대 HP +150', { flat: { HP: 150 } }],
  ['S02', '날카로운 무기', '모든 아군 AD +12', { flat: { AD: 12 } }],
  ['S03', '마력 증폭', '모든 아군 AP +15', { flat: { AP: 15 } }],
  ['S04', '견고한 방어', '모든 아군 GD +12', { flat: { GD: 12 } }],
  ['S05', '신속한 공격', '모든 아군 AS +10%', { as: 0.1 }],
  ['S06', '정밀 타격', '모든 아군 CTC +8%p', { flat: { CTC: 8 } }],
  ['S07', '마나 저장소', '모든 아군 최대 MP -10%', { mpReduction: 0.1 }],
  [
    'S08',
    '전투 준비',
    '전투 시작 시 모든 아군에게 최대 HP의 8% 보호막을 5초간 부여',
    { startShield: { ratio: 0.08, seconds: 5 } },
  ],
  ['S09', '작은 행운', '선택 즉시 6G 획득', { gold: 6 }],
  ['S10', '경험의 지혜', '선택 즉시 8XP 획득', { xp: 8 }],
  ['S11', '절약 정신', '상점 새로고침 비용 2G → 1G', { reroll: 1 }],
  ['S12', '생존 본능', '모든 아군 DOD +6%p', { flat: { DOD: 6 } }],
  ['G01', '거인의 축복', '모든 아군 최대 HP +300', { flat: { HP: 300 } }],
  ['G02', '전투의 달인', '모든 아군 AD +20, AS +10%', { flat: { AD: 20 }, as: 0.1 }],
  [
    'G03',
    '대마법사의 지혜',
    '모든 아군 AP +30, 최대 MP -10%',
    { flat: { AP: 30 }, mpReduction: 0.1 },
  ],
  ['G04', '철벽 진형', '모든 아군 GD +20, DOD +8%p', { flat: { GD: 20, DOD: 8 } }],
  ['G05', '치명적인 일격', '모든 아군 CTC +12%p, CTH +25%p', { flat: { CTC: 12, CTH: 25 } }],
  ['G06', '흡혈의 본능', '아군 기본 공격의 실제 피해 12%만큼 공격자 HP 회복', { basicLeech: 0.12 }],
  [
    'G07',
    '전투의 열기',
    '전투 시작 후 5초마다 생존 아군 AD·AP +5%, 최대 4중첩',
    { heat: { interval: 5, ratio: 0.05, max: 4 } },
  ],
  [
    'G08',
    '마나 순환',
    '스킬 사용 시 해당 캐릭터 최대 MP 15% 회복 · 캐릭터별 쿨다운 5초',
    { manaReturn: { ratio: 0.15, cooldown: 5 } },
  ],
  [
    'G09',
    '수호자의 맹세',
    '전투 시작 시 모든 아군에게 최대 HP의 15% 보호막을 6초간 부여',
    { startShield: { ratio: 0.15, seconds: 6 } },
  ],
  ['G10', '풍요의 축복', '선택 즉시 12G 획득', { gold: 12 }],
  ['G11', '빠른 성장', '선택 즉시 16XP 획득', { xp: 16 }],
  ['G12', '승리의 보상', '일반/보스 전투 승리 시 추가 2G 획득', { winGold: 2 }],
  [
    'P01',
    '초월자의 축복',
    '모든 아군 최대 HP +400, AD +25, AP +30',
    { flat: { HP: 400, AD: 25, AP: 30 } },
  ],
  ['P02', '광전사의 군단', '모든 아군 AS +30%, CTC +15%p', { as: 0.3, flat: { CTC: 15 } }],
  ['P03', '마력의 폭풍', '모든 아군 AP +60, 최대 MP -20%', { flat: { AP: 60 }, mpReduction: 0.2 }],
  [
    'P04',
    '불멸의 군대',
    '모든 아군이 전투당 1회 치명적 피해를 받으면 HP 1로 생존하고 최대 HP의 20% 보호막을 3초간 획득',
    { immortal: { ratio: 0.2, seconds: 3 } },
  ],
  [
    'P05',
    '피의 축제',
    '아군 기본 공격 및 스킬의 실제 피해 15%만큼 공격자 HP 회복',
    { attackLeech: 0.15 },
  ],
  [
    'P06',
    '전장의 지배자',
    '전투 시작 10초 후 생존 아군 AD·AP +40%, AS +20% · 1회',
    { dominion: { at: 10, power: 0.4, as: 0.2 } },
  ],
  ['P07', '마나의 해방', '모든 아군이 전투 시작 시 최대 MP의 50%를 보유', { startMana: 0.5 }],
  [
    'P08',
    '완벽한 방어',
    '모든 아군 GD +35, DOD +15%p, 최대 HP +250',
    { flat: { GD: 35, DOD: 15, HP: 250 } },
  ],
  [
    'P09',
    '황금의 제국',
    '선택 즉시 25G 획득. 이후 일반/보스 전투 승리 시 추가 2G',
    { gold: 25, winGold: 2 },
  ],
  ['P10', '초고속 성장', '선택 즉시 32XP 획득', { xp: 32 }],
  ['P11', '장비의 축복', '선택 즉시 T3 아이템 2개 획득', { items: { tier: 3, count: 2 } }],
  ['P12', '한계 돌파', '이번 원정의 레벨별 배치 한도 +1 · 최대 11명', { capacity: 1 }],
];
const augments = rows.map(([id, name, text, effect]) => ({
  id,
  name,
  text,
  effect,
  tier: id[0] === 'S' ? 'silver' : id[0] === 'G' ? 'gold' : 'prism',
  icon: id[0] === 'S' ? '◇' : id[0] === 'G' ? '◆' : '✦',
}));
const byId = (id) => augments.find((a) => a.id === id);
const selected = (ids) => [...new Set(ids || [])].map(byId).filter(Boolean);
function aggregate(ids) {
  const out = { flat: {}, as: 0, mpReduction: 0, capacity: 0, winGold: 0, startMana: 0 };
  for (const a of selected(ids)) {
    const e = a.effect;
    for (const [key, value] of Object.entries(e.flat || {}))
      out.flat[key] = (out.flat[key] || 0) + value;
    for (const key of ['as', 'mpReduction', 'capacity', 'winGold']) out[key] += e[key] || 0;
    out.startMana = Math.max(out.startMana, e.startMana || 0);
  }
  return out;
}
function applyStats(stats, ids) {
  const s = { ...stats },
    e = aggregate(ids);
  for (const [key, value] of Object.entries(e.flat)) s[key] += value;
  s.AS *= 1 + e.as;
  if (s.MP > 0) s.MP = Math.max(config.minMana, s.MP * (1 - e.mpReduction));
  return s;
}
const nodeOrdinal = (node) => {
  const [stage, round] = node.split('-').map(Number);
  return (stage - 1) * 5 + round;
};
function draw(ids, rng = Math.random) {
  const tier = config.tierOrder[Math.min(2, Math.floor(rng() * 3))],
    pool = augments.filter((a) => a.tier === tier && !(ids || []).includes(a.id)),
    optionIds = [];
  while (optionIds.length < config.options && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    optionIds.push(pool.splice(i, 1)[0].id);
  }
  return { tier, optionIds };
}
const api = { config, tiers, augments, byId, selected, aggregate, applyStats, nodeOrdinal, draw };

export default api;
