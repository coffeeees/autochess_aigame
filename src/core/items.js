const items = [
  {
    id: 'I01',
    name: '강철 장검',
    tier: 1,
    stats: {
      AD: 12,
    },
    statsText: 'AD +12',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I02',
    name: '견고한 흉갑',
    tier: 1,
    stats: {
      GD: 12,
    },
    statsText: 'GD +12',
    effect: '',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I03',
    name: '마력 수정구',
    tier: 1,
    stats: {
      AP: 15,
    },
    statsText: 'AP +15',
    effect: '',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I04',
    name: '생명의 목걸이',
    tier: 1,
    stats: {
      HP: 150,
    },
    statsText: 'HP +150',
    effect: '',
    iconKey: 'necklace',
    icon: '♥',
  },
  {
    id: 'I05',
    name: '신속의 장갑',
    tier: 1,
    stats: {
      ASPercent: 12,
    },
    statsText: 'AS +12%',
    effect: '',
    iconKey: 'glove',
    icon: '✦',
  },
  {
    id: 'I06',
    name: '정밀한 조준경',
    tier: 1,
    stats: {
      CTC: 10,
    },
    statsText: 'CTC +10%p',
    effect: '',
    iconKey: 'scope',
    icon: '◎',
  },
  {
    id: 'I07',
    name: '현자의 부적',
    tier: 1,
    stats: {
      MP: 20,
    },
    statsText: '최대 MP +20',
    effect: '',
    iconKey: 'amulet',
    icon: '◉',
  },
  {
    id: 'I08',
    name: '회피의 망토',
    tier: 1,
    stats: {
      DOD: 8,
    },
    statsText: 'DOD +8%p',
    effect: '',
    iconKey: 'cloak',
    icon: '◒',
  },
  {
    id: 'I09',
    name: '파괴자의 반지',
    tier: 1,
    stats: {
      CTH: 25,
    },
    statsText: 'CTH +25%p (예: 150%→175%)',
    effect: '',
    iconKey: 'ring',
    icon: '◇',
  },
  {
    id: 'I10',
    name: '장거리 사수의 깃털',
    tier: 1,
    stats: {
      RNG: 1,
    },
    statsText: 'RNG +1칸',
    effect: '',
    iconKey: 'feather',
    icon: '➶',
  },
  {
    id: 'I11',
    name: '광전사의 도끼',
    tier: 2,
    stats: {
      AD: 18,
      ASPercent: 15,
    },
    statsText: 'AD +18, AS +15%',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I12',
    name: '룬 각인 지팡이',
    tier: 2,
    stats: {
      AP: 25,
      MP: 20,
    },
    statsText: 'AP +25, 최대 MP +20',
    effect: '',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I13',
    name: '수호자의 판금갑옷',
    tier: 2,
    stats: {
      HP: 220,
      GD: 18,
    },
    statsText: 'HP +220, GD +18',
    effect: '',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I14',
    name: '그림자 단검',
    tier: 2,
    stats: {
      AD: 20,
      CTC: 12,
    },
    statsText: 'AD +20, CTC +12%p',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I15',
    name: '폭풍의 활',
    tier: 2,
    stats: {
      AD: 15,
      RNG: 1,
    },
    statsText: 'AD +15, RNG +1칸',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I16',
    name: '비전의 로브',
    tier: 2,
    stats: {
      AP: 20,
      GD: 15,
    },
    statsText: 'AP +20, GD +15',
    effect: '',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I17',
    name: '불굴의 방패',
    tier: 2,
    stats: {
      HP: 300,
      DOD: 5,
    },
    statsText: 'HP +300, DOD +5%p',
    effect: '',
    iconKey: 'necklace',
    icon: '♥',
  },
  {
    id: 'I18',
    name: '치유사의 성배',
    tier: 2,
    stats: {
      AP: 25,
      HP: 150,
    },
    statsText: 'AP +25, HP +150',
    effect: '',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I19',
    name: '질풍의 장화',
    tier: 2,
    stats: {
      ASPercent: 18,
      DOD: 8,
    },
    statsText: 'AS +18%, DOD +8%p',
    effect: '',
    iconKey: 'glove',
    icon: '✦',
  },
  {
    id: 'I20',
    name: '처형자의 가면',
    tier: 2,
    stats: {
      AD: 20,
      CTH: 30,
    },
    statsText: 'AD +20, CTH +30%p',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I21',
    name: '마나 증폭기',
    tier: 2,
    stats: {
      AP: 30,
      MP: 30,
    },
    statsText: 'AP +30, 최대 MP +30',
    effect: '',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I22',
    name: '용비늘 갑주',
    tier: 2,
    stats: {
      GD: 22,
      HP: 200,
    },
    statsText: 'GD +22, HP +200',
    effect: '',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I23',
    name: '독사의 송곳니',
    tier: 2,
    stats: {
      AD: 15,
      AP: 20,
    },
    statsText: 'AD +15, AP +20',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I24',
    name: '전장의 휘장',
    tier: 2,
    stats: {
      AD: 15,
      GD: 15,
    },
    statsText: 'AD +15, GD +15',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I25',
    name: '별빛의 관',
    tier: 2,
    stats: {
      AP: 20,
      CTC: 10,
    },
    statsText: 'AP +20, CTC +10%p',
    effect: '',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I26',
    name: '뇌신의 심장',
    tier: 3,
    stats: {
      AD: 25,
      ASPercent: 15,
    },
    statsText: 'AD +25, AS +15%',
    effect:
      '기본 공격 적중 시 25% 확률로 대상 주변의 다른 적 최대 2명에게 **장착자 AD의 60%** 마법 피해.',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I27',
    name: '대마법사의 왕관',
    tier: 3,
    stats: {
      AP: 40,
      MP: 20,
    },
    statsText: 'AP +40, 최대 MP +20',
    effect:
      '스킬 사용 시 25% 확률로 동일 스킬을 마나 소모 없이 1회 추가 발동. 추가 발동은 이 효과를 다시 발동시키지 않음.',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I28',
    name: '불멸자의 갑옷',
    tier: 3,
    stats: {
      HP: 350,
      GD: 25,
    },
    statsText: 'HP +350, GD +25',
    effect: '전투당 1회, 치명적 피해를 받을 때 HP 1로 생존하고 최대 HP 30%의 보호막을 4초 획득.',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I29',
    name: '피의 계약검',
    tier: 3,
    stats: {
      AD: 30,
      HP: 200,
    },
    statsText: 'AD +30, HP +200',
    effect: '기본 공격으로 실제 입힌 피해의 20%만큼 장착자 HP 회복.',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I30',
    name: '시간의 모래시계',
    tier: 3,
    stats: {
      AP: 30,
      MP: 30,
    },
    statsText: 'AP +30, 최대 MP +30',
    effect: '스킬 사용 3초 후 최대 MP의 30% 회복. 발동 재사용 대기시간 8초.',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I31',
    name: '망령 군주의 인장',
    tier: 3,
    stats: {
      AP: 35,
      HP: 150,
    },
    statsText: 'AP +35, HP +150',
    effect: '장착자가 소환한 유닛의 공격 피해량 +30%, 지속시간 +40%.',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I32',
    name: '지옥불의 검',
    tier: 3,
    stats: {
      AD: 30,
      AP: 25,
    },
    statsText: 'AD +30, AP +25',
    effect: '기본 공격 적중 시 대상에게 4초 동안 매초 장착자 AP의 25% 마법 피해를 주는 화상 부여.',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I33',
    name: '영원의 서리',
    tier: 3,
    stats: {
      AP: 35,
      GD: 20,
    },
    statsText: 'AP +35, GD +20',
    effect: '스킬로 피해를 입힌 적의 AS 3초간 -25%. 같은 대상에게 이 효과 3회 적용 시 1초 기절.',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I34',
    name: '사신의 조준경',
    tier: 3,
    stats: {
      AD: 35,
      CTC: 15,
    },
    statsText: 'AD +35, CTC +15%p',
    effect: '기본 공격 적중 대상의 HP가 25% 이하일 때 해당 공격 피해량 +50%.',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I35',
    name: '성자의 축복',
    tier: 3,
    stats: {
      AP: 35,
      HP: 250,
    },
    statsText: 'AP +35, HP +250',
    effect:
      '장착자의 치유 스킬 효과 +30%. 아군을 치유하면 대상에게 실제 치유량의 25%만큼 3초 보호막 부여.',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I36',
    name: '폭풍 군주의 망토',
    tier: 3,
    stats: {
      ASPercent: 25,
      DOD: 12,
    },
    statsText: 'AS +25%, DOD +12%p',
    effect: '공격 회피 성공 시 4초간 AS +20%. 재사용 대기시간 6초.',
    iconKey: 'glove',
    icon: '✦',
  },
  {
    id: 'I37',
    name: '대지 수호자의 방패',
    tier: 3,
    stats: {
      HP: 400,
      GD: 30,
    },
    statsText: 'HP +400, GD +30',
    effect: '전투 시작 시 자신과 인접한 아군에게 장착자 최대 HP 15%의 보호막을 6초 부여.',
    iconKey: 'armor',
    icon: '◈',
  },
  {
    id: 'I38',
    name: '광란의 쌍검',
    tier: 3,
    stats: {
      AD: 25,
      ASPercent: 20,
    },
    statsText: 'AD +25, AS +20%',
    effect: '동일 적을 연속 기본 공격할 때마다 AS +5%, 최대 8중첩. 공격 대상 변경 시 중첩 초기화.',
    iconKey: 'sword',
    icon: '⚔',
  },
  {
    id: 'I39',
    name: '공허의 구슬',
    tier: 3,
    stats: {
      AP: 45,
      MP: 20,
    },
    statsText: 'AP +45, 최대 MP +20',
    effect:
      '스킬로 피해를 입히면 피격 대상 주변 1칸 내 다른 적에게 해당 스킬 피해량의 35%를 추가 마법 피해로 적용.',
    iconKey: 'crystal',
    icon: '◆',
  },
  {
    id: 'I40',
    name: '전쟁 군주의 왕관',
    tier: 3,
    stats: {
      HP: 300,
      AD: 25,
      AP: 25,
    },
    statsText: 'HP +300, AD +25, AP +25',
    effect: '장착자가 적 처치 시 전투 종료까지 AD와 AP 각각 +5%, 최대 5중첩.',
    iconKey: 'sword',
    icon: '⚔',
  },
];
const legacy = [
  {
    id: 'sword',
    name: '강철 검',
    tier: 1,
    stats: { AD: 10 },
    statsText: 'AD +10',
    effect: '',
    iconKey: 'sword',
    icon: '⚔',
    legacy: true,
    stat: 'AD',
    amount: 10,
  },
  {
    id: 'armor',
    name: '수호 갑옷',
    tier: 1,
    stats: { GD: 10 },
    statsText: 'GD +10',
    effect: '',
    iconKey: 'armor',
    icon: '◈',
    legacy: true,
    stat: 'GD',
    amount: 10,
  },
  {
    id: 'crystal',
    name: '마력 수정',
    tier: 1,
    stats: { AP: 10 },
    statsText: 'AP +10',
    effect: '',
    iconKey: 'crystal',
    icon: '◆',
    legacy: true,
    stat: 'AP',
    amount: 10,
  },
];
const byId = (id) => items.find((i) => i.id === id) || legacy.find((i) => i.id === id);
const tierColors = { 1: '#9699a2', 2: '#578ce5', 3: '#e6c449' };
const tierOdds = {
  1: [100, 0, 0],
  2: [70, 30, 0],
  3: [50, 40, 10],
  4: [30, 50, 20],
  5: [0, 30, 70],
  6: [0, 0, 100],
};
function draw(stage, rng, excluded = []) {
  const odds = tierOdds[Math.min(6, Math.max(1, stage))],
    roll = rng() * 100;
  let sum = 0,
    tier = 3;
  for (let i = 0; i < 3; i++) {
    sum += odds[i];
    if (roll < sum) {
      tier = i + 1;
      break;
    }
  }
  const pool = items.filter((i) => i.tier === tier && !excluded.includes(i.id));
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id;
}
function drawTier(tier, rng) {
  const pool = items.filter((i) => i.tier === tier);
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id;
}
function bonuses(equipment) {
  const out = {};
  let as = 0;
  for (const entry of equipment) {
    const def = byId(typeof entry === 'string' ? entry : entry.id);
    if (!def) continue;
    for (const [key, n] of Object.entries(def.stats)) {
      if (key === 'ASPercent') as += n;
      else out[key] = (out[key] || 0) + n;
    }
  }
  if (as) out.ASMultiplier = 1 + as / 100;
  return out;
}
function applyStats(base, bonus = {}, mult = 1, adMultiplier = 1) {
  const s = { ...base };
  for (const key of ['HP', 'AD', 'AP']) s[key] *= mult;
  for (const key of Object.keys(base)) s[key] += bonus[key] || 0;
  s.AS *= bonus.ASMultiplier || 1;
  s.AD *= adMultiplier;
  return s;
}
function canStack(id, equipped) {
  const def = byId(id);
  return !!def;
}
const api = {
  items,
  legacy,
  byId,
  tierColors,
  tierOdds,
  draw,
  drawTier,
  bonuses,
  applyStats,
  canStack,
};

export default api;
