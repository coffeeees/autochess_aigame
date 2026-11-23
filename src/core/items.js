// 장비(v0.20.0 아이템 개편, 요청서 AUTOCHESS_ITEM_REWORK_AND_RENAME_2026-11-23).
// 기본 장비 8종(IB01~IB08) + 기본 장비 2개를 합친 완성 장비 36종(IC01~IC36). 예전 1~3티어 40종(I01~I40)은 지웠다.
// v0.21.0(장비 밸런스 1차 최종본 AUTOCHESS_ITEM_BALANCE_FINAL_DRAFT1_2026-11-24): 완성 장비 능력치는 재료 합이 아니라
//   장비마다 따로 정한 값(stats)이다. 고유 효과는 effect(판정은 combat/item-effects.js), 고유 효과의 상시 능력치는
//   uniqueStats로 따로 두어 같은 장비를 여러 개 껴도 1번만 더한다. 플레이테스트 뒤 다시 조정할 수 있다.
// 능력치 키: ADPercent·APPercent·ASPercent·HPPercent(현재 값에 % 곱하기), GD(고정값), MPGainPercent(마나 획득량 %),
//   CTC·DOD·CTH(%p 더하기). 재료(기본 장비)의 능력치는 완성 장비로 이어지지 않는다.
// 조합은 재료 순서와 무관하고 같은 재료끼리도 된다. 완성 장비는 다시 조합하지 않는다.
const base = [
  {
    id: 'IB01',
    kind: 'base',
    name: '낡은 검',
    short: '검',
    iconKey: 'sword',
    stats: { ADPercent: 10 },
    statsText: 'AD +10%',
    effect: '',
  },
  {
    id: 'IB02',
    kind: 'base',
    name: '마력 지팡이',
    short: '지팡이',
    iconKey: 'staff',
    stats: { APPercent: 10 },
    statsText: 'AP +10%',
    effect: '',
  },
  {
    id: 'IB03',
    kind: 'base',
    name: '사냥꾼의 활',
    short: '활',
    iconKey: 'bow',
    stats: { ASPercent: 10 },
    statsText: 'AS +10%',
    effect: '',
  },
  {
    id: 'IB04',
    kind: 'base',
    name: '생명의 수정',
    short: '수정',
    iconKey: 'crystal',
    stats: { HPPercent: 15 },
    statsText: '최대 HP +15%',
    effect: '',
  },
  {
    id: 'IB05',
    kind: 'base',
    name: '철갑 조각',
    short: '갑옷',
    iconKey: 'armor',
    stats: { GD: 10 },
    statsText: 'GD +10',
    effect: '',
  },
  {
    id: 'IB06',
    kind: 'base',
    name: '마나 결정',
    short: '마나',
    iconKey: 'gem',
    stats: { MPGainPercent: 15 },
    statsText: 'MP 획득량 +15%',
    effect: '',
  },
  {
    id: 'IB07',
    kind: 'base',
    name: '정밀 장갑',
    short: '장갑',
    iconKey: 'glove',
    stats: { CTC: 10 },
    statsText: 'CTC +10%p',
    effect: '',
  },
  {
    id: 'IB08',
    kind: 'base',
    name: '바람의 깃털',
    short: '깃털',
    iconKey: 'feather',
    stats: { DOD: 8 },
    statsText: 'DOD +8%p',
    effect: '',
  },
];
const complete = [
  {
    id: 'IC01',
    kind: 'complete',
    name: '광전사의 대검',
    recipe: ['IB01', 'IB01'],
    iconKey: 'sword',
    subIconKey: 'sword',
    stats: { ADPercent: 40 },
    statsText: 'AD +40%',
    effectKey: 'berserker',
    effect: '기본 공격 피해 +20%',
  },
  {
    id: 'IC02',
    kind: 'complete',
    name: '룬검',
    recipe: ['IB01', 'IB02'],
    iconKey: 'sword',
    subIconKey: 'staff',
    stats: { ADPercent: 20, APPercent: 20 },
    statsText: 'AD +20%, AP +20%',
    effectKey: 'runeblade',
    effect: '기본 공격 시 AP의 20%만큼 추가 마법 피해',
  },
  {
    id: 'IC03',
    kind: 'complete',
    name: '폭풍의 검',
    recipe: ['IB01', 'IB03'],
    iconKey: 'sword',
    subIconKey: 'bow',
    stats: { ADPercent: 20, ASPercent: 20 },
    statsText: 'AD +20%, AS +20%',
    effectKey: 'stormblade',
    effect: '기본 공격 4회마다 추가 공격 1회(추가 공격은 다시 추가 공격을 만들지 않음)',
  },
  {
    id: 'IC04',
    kind: 'complete',
    name: '흡혈검',
    recipe: ['IB01', 'IB04'],
    iconKey: 'sword',
    subIconKey: 'crystal',
    stats: { ADPercent: 20, HPPercent: 25 },
    statsText: 'AD +20%, 최대 HP +25%',
    effectKey: 'vampblade',
    effect: '가한 실제 피해의 12%만큼 HP 회복',
  },
  {
    id: 'IC05',
    kind: 'complete',
    name: '수호자의 검',
    recipe: ['IB01', 'IB05'],
    iconKey: 'sword',
    subIconKey: 'armor',
    stats: { ADPercent: 20, GD: 18 },
    statsText: 'AD +20%, GD +18',
    effectKey: 'guardianblade',
    effect: '전투 시작 시 최대 HP의 15% 보호막 획득',
  },
  {
    id: 'IC06',
    kind: 'complete',
    name: '마력 절단검',
    recipe: ['IB01', 'IB06'],
    iconKey: 'sword',
    subIconKey: 'gem',
    stats: { ADPercent: 20, MPGainPercent: 20 },
    statsText: 'AD +20%, MP 획득량 +20%',
    effectKey: 'spellcutter',
    effect: '스킬 사용 후 다음 기본 공격 피해 +35%',
  },
  {
    id: 'IC07',
    kind: 'complete',
    name: '처형자의 검',
    recipe: ['IB01', 'IB07'],
    iconKey: 'sword',
    subIconKey: 'glove',
    stats: { ADPercent: 20, CTC: 15 },
    statsText: 'AD +20%, CTC +15%p',
    effectKey: 'executioner',
    effect: 'HP 30% 이하인 적에게 주는 피해 +20%',
  },
  {
    id: 'IC08',
    kind: 'complete',
    name: '질풍검',
    recipe: ['IB01', 'IB08'],
    iconKey: 'sword',
    subIconKey: 'feather',
    stats: { ADPercent: 20, DOD: 5 },
    statsText: 'AD +20%, DOD +5%p',
    effectKey: 'galeblade',
    effect: '회피 성공 후 3초간 AS +20%',
  },
  {
    id: 'IC09',
    kind: 'complete',
    name: '대마법사의 관',
    recipe: ['IB02', 'IB02'],
    iconKey: 'staff',
    subIconKey: 'staff',
    stats: { APPercent: 40 },
    statsText: 'AP +40%',
    effectKey: 'archcrown',
    effect: '스킬 피해 +20%',
  },
  {
    id: 'IC10',
    kind: 'complete',
    name: '주문궁',
    recipe: ['IB02', 'IB03'],
    iconKey: 'staff',
    subIconKey: 'bow',
    stats: { APPercent: 20, ASPercent: 20 },
    statsText: 'AP +20%, AS +20%',
    effectKey: 'spellbow',
    effect: '기본 공격 3회마다 AP의 35%만큼 추가 마법 피해',
  },
  {
    id: 'IC11',
    kind: 'complete',
    name: '생명의 지팡이',
    recipe: ['IB02', 'IB04'],
    iconKey: 'staff',
    subIconKey: 'crystal',
    stats: { APPercent: 20, HPPercent: 25 },
    statsText: 'AP +20%, 최대 HP +25%',
    effectKey: 'lifestaff',
    effect: '스킬 사용 시 자신과 HP 비율이 가장 낮은 아군 1명에게 각자 최대 HP의 5% 회복',
  },
  {
    id: 'IC12',
    kind: 'complete',
    name: '마도 방패',
    recipe: ['IB02', 'IB05'],
    iconKey: 'staff',
    subIconKey: 'armor',
    stats: { APPercent: 20, GD: 18 },
    statsText: 'AP +20%, GD +18',
    effectKey: 'arcaneshield',
    effect: '스킬 사용 후 4초간 받는 피해 -15%',
  },
  {
    id: 'IC13',
    kind: 'complete',
    name: '대마법사의 서',
    recipe: ['IB02', 'IB06'],
    iconKey: 'staff',
    subIconKey: 'gem',
    stats: { APPercent: 25, MPGainPercent: 25 },
    statsText: 'AP +25%, MP 획득량 +25%',
    effectKey: 'archtome',
    effect: '스킬 사용 후 최대 MP의 15% 회복',
  },
  {
    id: 'IC14',
    kind: 'complete',
    name: '비전의 눈',
    recipe: ['IB02', 'IB07'],
    iconKey: 'staff',
    subIconKey: 'glove',
    stats: { APPercent: 20, CTC: 15 },
    statsText: 'AP +20%, CTC +15%p',
    effectKey: 'arcaneeye',
    effect: '스킬이 치명타를 발생시킬 수 있음',
  },
  {
    id: 'IC15',
    kind: 'complete',
    name: '바람술사의 지팡이',
    recipe: ['IB02', 'IB08'],
    iconKey: 'staff',
    subIconKey: 'feather',
    stats: { APPercent: 20, DOD: 5 },
    statsText: 'AP +20%, DOD +5%p',
    effectKey: 'windstaff',
    effect: '스킬 사용 후 3초간 AS +25%',
  },
  {
    id: 'IC16',
    kind: 'complete',
    name: '속사의 활',
    recipe: ['IB03', 'IB03'],
    iconKey: 'bow',
    subIconKey: 'bow',
    stats: { ASPercent: 35 },
    statsText: 'AS +35%',
    effectKey: 'rapidbow',
    effect: '기본 공격 5회마다 3초간 AS +25%',
  },
  {
    id: 'IC17',
    kind: 'complete',
    name: '생명력의 활',
    recipe: ['IB03', 'IB04'],
    iconKey: 'bow',
    subIconKey: 'crystal',
    stats: { ASPercent: 20, HPPercent: 25 },
    statsText: 'AS +20%, 최대 HP +25%',
    effectKey: 'vitalbow',
    effect: '기본 공격 시 자신의 최대 HP 1%만큼 HP 회복',
  },
  {
    id: 'IC18',
    kind: 'complete',
    name: '철벽의 활',
    recipe: ['IB03', 'IB05'],
    iconKey: 'bow',
    subIconKey: 'armor',
    stats: { ASPercent: 20, GD: 18 },
    statsText: 'AS +20%, GD +18',
    effectKey: 'bulwarkbow',
    effect: '기본 공격 4회마다 최대 HP의 5% 보호막 획득',
  },
  {
    id: 'IC19',
    kind: 'complete',
    name: '마력의 활',
    recipe: ['IB03', 'IB06'],
    iconKey: 'bow',
    subIconKey: 'gem',
    stats: { ASPercent: 20, MPGainPercent: 20 },
    statsText: 'AS +20%, MP 획득량 +20%',
    effectKey: 'manabow',
    effect: '기본 공격 시 획득하는 MP +20%',
  },
  {
    id: 'IC20',
    kind: 'complete',
    name: '암살자의 장갑',
    recipe: ['IB03', 'IB07'],
    iconKey: 'bow',
    subIconKey: 'glove',
    stats: { ASPercent: 20, CTC: 15 },
    statsText: 'AS +20%, CTC +15%p',
    effectKey: 'assassinglove',
    effect: '기본 공격 치명타 피해 +30%p',
  },
  {
    id: 'IC21',
    kind: 'complete',
    name: '환영궁',
    recipe: ['IB03', 'IB08'],
    iconKey: 'bow',
    subIconKey: 'feather',
    stats: { ASPercent: 20, DOD: 5 },
    statsText: 'AS +20%, DOD +5%p',
    effectKey: 'phantombow',
    effect: '회피 성공 후 다음 기본 공격이 확정 치명타',
  },
  {
    id: 'IC22',
    kind: 'complete',
    name: '거인의 심장',
    recipe: ['IB04', 'IB04'],
    iconKey: 'crystal',
    subIconKey: 'crystal',
    stats: { HPPercent: 55 },
    statsText: '최대 HP +55%',
    uniqueStats: { HPPercent: 20 },
    effectKey: 'giantheart',
    effect: '추가 최대 HP +20%',
  },
  {
    id: 'IC23',
    kind: 'complete',
    name: '불멸의 갑옷',
    recipe: ['IB04', 'IB05'],
    iconKey: 'crystal',
    subIconKey: 'armor',
    stats: { HPPercent: 30, GD: 22 },
    statsText: '최대 HP +30%, GD +22',
    effectKey: 'immortalarmor',
    effect: '받는 피해 -12%',
  },
  {
    id: 'IC24',
    kind: 'complete',
    name: '생명의 샘',
    recipe: ['IB04', 'IB06'],
    iconKey: 'crystal',
    subIconKey: 'gem',
    stats: { HPPercent: 30, MPGainPercent: 20 },
    statsText: '최대 HP +30%, MP 획득량 +20%',
    effectKey: 'lifespring',
    effect: '스킬 사용 시 자신의 최대 HP 8% 회복',
  },
  {
    id: 'IC25',
    kind: 'complete',
    name: '생존자의 표식',
    recipe: ['IB04', 'IB07'],
    iconKey: 'crystal',
    subIconKey: 'glove',
    stats: { HPPercent: 30, CTC: 15 },
    statsText: '최대 HP +30%, CTC +15%p',
    effectKey: 'survivormark',
    effect: 'HP 30% 이하가 되면 전투당 1회, 최대 HP 20% 보호막 획득',
  },
  {
    id: 'IC26',
    kind: 'complete',
    name: '재생의 망토',
    recipe: ['IB04', 'IB08'],
    iconKey: 'crystal',
    subIconKey: 'feather',
    stats: { HPPercent: 30, DOD: 5 },
    statsText: '최대 HP +30%, DOD +5%p',
    effectKey: 'regencloak',
    effect: '5초마다 잃은 HP의 8% 회복',
  },
  {
    id: 'IC27',
    kind: 'complete',
    name: '요새의 갑옷',
    recipe: ['IB05', 'IB05'],
    iconKey: 'armor',
    subIconKey: 'armor',
    stats: { GD: 40 },
    statsText: 'GD +40',
    uniqueStats: { GD: 15 },
    effectKey: 'fortress',
    effect: '추가 GD +15',
  },
  {
    id: 'IC28',
    kind: 'complete',
    name: '마나 장벽',
    recipe: ['IB05', 'IB06'],
    iconKey: 'armor',
    subIconKey: 'gem',
    stats: { GD: 22, MPGainPercent: 20 },
    statsText: 'GD +22, MP 획득량 +20%',
    effectKey: 'manabarrier',
    effect: '스킬 사용 후 최대 HP의 10% 보호막 획득',
  },
  {
    id: 'IC29',
    kind: 'complete',
    name: '반격의 갑주',
    recipe: ['IB05', 'IB07'],
    iconKey: 'armor',
    subIconKey: 'glove',
    stats: { GD: 22, CTC: 15 },
    statsText: 'GD +22, CTC +15%p',
    effectKey: 'counterarmor',
    effect: '기본 공격을 받으면 공격자에게 자신의 GD 50%만큼 물리 피해 반사',
  },
  {
    id: 'IC30',
    kind: 'complete',
    name: '환영의 갑옷',
    recipe: ['IB05', 'IB08'],
    iconKey: 'armor',
    subIconKey: 'feather',
    stats: { GD: 22, DOD: 5 },
    statsText: 'GD +22, DOD +5%p',
    effectKey: 'phantomarmor',
    effect: '회피 성공 후 3초간 GD +15',
  },
  {
    id: 'IC31',
    kind: 'complete',
    name: '마력의 심장',
    recipe: ['IB06', 'IB06'],
    iconKey: 'gem',
    subIconKey: 'gem',
    stats: { MPGainPercent: 40 },
    statsText: 'MP 획득량 +40%',
    effectKey: 'manaheart',
    effect: '전투 시작 시 최대 MP의 30% 획득',
  },
  {
    id: 'IC32',
    kind: 'complete',
    name: '집중의 결정',
    recipe: ['IB06', 'IB07'],
    iconKey: 'gem',
    subIconKey: 'glove',
    stats: { MPGainPercent: 20, CTC: 15 },
    statsText: 'MP 획득량 +20%, CTC +15%p',
    effectKey: 'focuscrystal',
    effect: '스킬 치명타 발생 시 최대 MP 10% 회복(스킬 1회당 한 번)',
  },
  {
    id: 'IC33',
    kind: 'complete',
    name: '유동의 수정',
    recipe: ['IB06', 'IB08'],
    iconKey: 'gem',
    subIconKey: 'feather',
    stats: { MPGainPercent: 20, DOD: 5 },
    statsText: 'MP 획득량 +20%, DOD +5%p',
    effectKey: 'flowcrystal',
    effect: '회피 성공 시 최대 MP 10% 획득',
  },
  {
    id: 'IC34',
    kind: 'complete',
    name: '급소의 장갑',
    recipe: ['IB07', 'IB07'],
    iconKey: 'glove',
    subIconKey: 'glove',
    stats: { CTC: 30 },
    statsText: 'CTC +30%p',
    uniqueStats: { CTH: 40 },
    effectKey: 'vitalglove',
    effect: '모든 치명타 피해 +40%p',
  },
  {
    id: 'IC35',
    kind: 'complete',
    name: '그림자 장갑',
    recipe: ['IB07', 'IB08'],
    iconKey: 'glove',
    subIconKey: 'feather',
    stats: { CTC: 15, DOD: 5 },
    statsText: 'CTC +15%p, DOD +5%p',
    effectKey: 'shadowglove',
    effect: '회피 성공 후 4초간 치명타 확률 +20%p',
  },
  {
    id: 'IC36',
    kind: 'complete',
    name: '유령의 망토',
    recipe: ['IB08', 'IB08'],
    iconKey: 'feather',
    subIconKey: 'feather',
    stats: { DOD: 12 },
    statsText: 'DOD +12%p',
    uniqueStats: { DOD: 6 },
    effectKey: 'ghostcloak',
    effect: '추가 회피 확률 +6%p',
  },
];
const items = [...base, ...complete];
const map = new Map(items.map((i) => [i.id, i]));
const byId = (id) => map.get(id);
const isBase = (id) => byId(id)?.kind === 'base';
/** 두 기본 장비의 조합 결과(순서 무관). 기본 장비가 아니면 null */
function recipe(a, b) {
  if (!isBase(a) || !isBase(b)) return null;
  return (
    complete.find(
      (c) => (c.recipe[0] === a && c.recipe[1] === b) || (c.recipe[0] === b && c.recipe[1] === a),
    )?.id ?? null
  );
}
/** 보급 후보 하나: 기본 장비 8종 중(이미 뽑힌 후보는 빼서 한 보급에 중복 없음). stage는 예전 호출 모양 유지용 */
function draw(stage, rng, excluded = []) {
  const pool = base.filter((i) => !excluded.includes(i.id));
  const list = pool.length ? pool : base;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))].id;
}
/** 예전에 티어를 정해 장비를 주던 경로(보스·증강): 등급 없이 기본 장비 하나 */
function drawTier(tier, rng) {
  return draw(0, rng);
}
/**
 * 장착 장비 능력치 합(v0.21.0 장비 밸런스 1차). AS는 ASMultiplier로 바꿔 둔다.
 * - 기본 능력치(stats)는 장착한 개수만큼 모두 더하고, baseScale(메타 S3 장비 숙련)만큼 키운다.
 * - 고유 효과의 상시 능력치(uniqueStats: 거인의 심장·요새의 갑옷·급소의 장갑·유령의 망토)는
 *   같은 장비 ID를 여러 개 껴도 1번만 더하고 S3로 키우지 않는다.
 */
function bonuses(equipment, baseScale = 0) {
  const out = {};
  let as = 0;
  const add = (stats, scale) => {
    for (const [key, n] of Object.entries(stats)) {
      if (key === 'ASPercent') as += n * scale;
      else out[key] = (out[key] || 0) + n * scale;
    }
  };
  const seen = new Set();
  for (const entry of equipment) {
    const def = byId(typeof entry === 'string' ? entry : entry.id);
    if (!def) continue;
    add(def.stats, 1 + baseScale);
    if (def.uniqueStats && !seen.has(def.id)) {
      seen.add(def.id);
      add(def.uniqueStats, 1);
    }
  }
  if (as) out.ASMultiplier = 1 + as / 100;
  return out;
}
/**
 * 기본 능력치 × 성급 배율(mult)에 장비를 적용한다. HP·AD·AP는 장비 %를 같은 능력치끼리 더해 한 번 곱하고,
 * GD·CTC·CTH·DOD는 더한다. AS는 ASMultiplier를 곱한다. MP 획득량(MPGainPercent)은 전투 유닛의 manaGain에서 쓴다.
 */
function applyStats(baseStats, bonus = {}, mult = 1) {
  const s = { ...baseStats };
  s.HP *= mult * (1 + (bonus.HPPercent || 0) / 100);
  s.AD *= mult * (1 + (bonus.ADPercent || 0) / 100);
  s.AP *= mult * (1 + (bonus.APPercent || 0) / 100);
  for (const key of ['GD', 'CTC', 'CTH', 'DOD']) if (key in s) s[key] += bonus[key] || 0;
  s.AS *= bonus.ASMultiplier || 1;
  return s;
}
/** 같은 완성 장비 여러 개 착용 허용(기본 능력치는 합산, 고유 효과는 1번 — v0.21.0 장비 밸런스 1차) */
function canStack() {
  return true;
}
const api = {
  items,
  base,
  complete,
  byId,
  isBase,
  recipe,
  draw,
  drawTier,
  bonuses,
  applyStats,
  canStack,
};

export default api;
