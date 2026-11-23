// v0.21.0 장비 밸런스 1차(AUTOCHESS_ITEM_BALANCE_FINAL_DRAFT1_2026-11-24) 필수 검증 1~12.
// 완성 장비 능력치는 장비마다 따로 정한 값(재료 합 아님), 같은 장비 여러 개: 기본 능력치는 합산·고유 효과는 1번,
// 고유 상시 능력치(거인의 심장·요새의 갑옷·급소의 장갑·유령의 망토)도 1번, 최종 회피 40% 상한, 치명타 100%까지.
import { test } from 'vitest';
import a from 'node:assert/strict';
import I from '../../src/core/items.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import E from '../../src/core/equipment.ts';
import Engine from '../../src/core/combat/battle.js';
import { newRun } from '../../src/core/run.ts';

const { Battle, effectiveDodge } = Engine;
const near = (x, y, msg = '') => a(Math.abs(x - y) < 1e-6, `${msg} ${x} != ${y}`);
const enemies = [
  { id: 'E06', pos: 30 },
  { id: 'E01', pos: 31 },
];
function fight(itemIds, rng = () => 0.99) {
  return new Battle(
    [{ id: 'C03', pos: 27, star: 1, uid: 1, itemIds, bonuses: I.bonuses(itemIds) }],
    enemies,
    { rng },
  );
}
const me = (b) => b.units.find((u) => u.persistentUid === 1);
const foe = (b) => b.units.find((u) => u.id === 'E06');
const times = (n, x) => Array(n).fill(x);

// 문서 3장의 최종 기본 능력치 표(재료 합이 아님)
const TABLE = {
  IC01: { ADPercent: 40 },
  IC02: { ADPercent: 20, APPercent: 20 },
  IC03: { ADPercent: 20, ASPercent: 20 },
  IC04: { ADPercent: 20, HPPercent: 25 },
  IC05: { ADPercent: 20, GD: 18 },
  IC06: { ADPercent: 20, MPGainPercent: 20 },
  IC07: { ADPercent: 20, CTC: 15 },
  IC08: { ADPercent: 20, DOD: 5 },
  IC09: { APPercent: 40 },
  IC10: { APPercent: 20, ASPercent: 20 },
  IC11: { APPercent: 20, HPPercent: 25 },
  IC12: { APPercent: 20, GD: 18 },
  IC13: { APPercent: 25, MPGainPercent: 25 },
  IC14: { APPercent: 20, CTC: 15 },
  IC15: { APPercent: 20, DOD: 5 },
  IC16: { ASPercent: 35 },
  IC17: { ASPercent: 20, HPPercent: 25 },
  IC18: { ASPercent: 20, GD: 18 },
  IC19: { ASPercent: 20, MPGainPercent: 20 },
  IC20: { ASPercent: 20, CTC: 15 },
  IC21: { ASPercent: 20, DOD: 5 },
  IC22: { HPPercent: 55 },
  IC23: { HPPercent: 30, GD: 22 },
  IC24: { HPPercent: 30, MPGainPercent: 20 },
  IC25: { HPPercent: 30, CTC: 15 },
  IC26: { HPPercent: 30, DOD: 5 },
  IC27: { GD: 40 },
  IC28: { GD: 22, MPGainPercent: 20 },
  IC29: { GD: 22, CTC: 15 },
  IC30: { GD: 22, DOD: 5 },
  IC31: { MPGainPercent: 40 },
  IC32: { MPGainPercent: 20, CTC: 15 },
  IC33: { MPGainPercent: 20, DOD: 5 },
  IC34: { CTC: 30 },
  IC35: { CTC: 15, DOD: 5 },
  IC36: { DOD: 12 },
};
const UNIQUE = { IC22: { HPPercent: 20 }, IC27: { GD: 15 }, IC34: { CTH: 40 }, IC36: { DOD: 6 } };
const BASE = {
  IB01: { ADPercent: 10 },
  IB02: { APPercent: 10 },
  IB03: { ASPercent: 10 },
  IB04: { HPPercent: 15 },
  IB05: { GD: 10 },
  IB06: { MPGainPercent: 15 },
  IB07: { CTC: 10 },
  IB08: { DOD: 8 },
};

test('1. 기본 장비 8종 그대로, 36종 조합 결과와 최종 기본 능력치가 표와 같고 재료 능력치는 더해지지 않음', () => {
  for (const [id, stats] of Object.entries(BASE)) a.deepEqual(I.byId(id).stats, stats, id);
  for (const [id, stats] of Object.entries(TABLE)) {
    const c = I.byId(id);
    a.deepEqual(c.stats, stats, id);
    a.deepEqual(c.uniqueStats, UNIQUE[id], `${id} 고유 상시 능력치`);
    a.equal(I.recipe(c.recipe[1], c.recipe[0]), id, `${id} 순서 무관`);
    a.deepEqual(I.bonuses([id]), {
      ...Object.fromEntries(
        Object.entries({ ...stats }).filter(([k]) => k !== 'ASPercent' && !UNIQUE[id]?.[k]),
      ),
      ...(stats.ASPercent ? { ASMultiplier: 1 + stats.ASPercent / 100 } : {}),
      ...Object.fromEntries(
        Object.entries(UNIQUE[id] || {}).map(([k, v]) => [k, (stats[k] || 0) + v]),
      ),
    });
  }
  // 회피 완성 장비 7종 +5%p, 유령의 망토 12 + 고유 6
  for (const id of ['IC08', 'IC15', 'IC21', 'IC26', 'IC30', 'IC33', 'IC35'])
    a.equal(I.byId(id).stats.DOD, 5, id);
  // 드래그 조합 결과(보관함)도 같은 장비
  const s = newRun({ seed: 1, difficulty: 1, runId: 't' });
  const x = P.addItem(s, 'IB01'),
    y = P.addItem(s, 'IB03');
  a.equal(E.combineInInventory(s, x.uid, y.uid).ok, true);
  a.deepEqual(
    s.inventory.map((i) => i.id),
    ['IC03'],
  );
});

test('2. 광전사의 대검 ×1/×2/×3: AD +40/80/120%, 기본 공격 피해 +20%는 항상 1번', () => {
  const plain = fight([]);
  const hit = (ids) => {
    const b = fight(ids);
    return b.deal(me(b), foe(b), 100, 'physical', { kind: 'basic', canCrit: false }).damage;
  };
  const base = hit([]);
  for (const n of [1, 2, 3]) {
    near(me(fight(times(n, 'IC01'))).stats.AD, me(plain).stats.AD * (1 + 0.4 * n), `${n}개 AD`);
    near(hit(times(n, 'IC01')) / base, 1.2, `${n}개 피해 증폭`);
  }
});

test('3. 폭풍의 검 ×2: AD·AS +40%, 기본 공격 4회마다 추가 공격 1번(연쇄 없음)', () => {
  const plain = me(fight([]));
  const b = fight(['IC03', 'IC03']);
  const u = me(b),
    t = foe(b);
  near(u.stats.AD, plain.stats.AD * 1.4);
  near(u.stats.AS, plain.stats.AS * 1.4);
  t.hp = t.stats.HP = 1e9;
  let basics = 0;
  const orig = b.log.bind(b);
  b.log = (k, m, x = {}) => {
    if (k === 'damage' && x.attackKind === 'basic' && x.source === u.uid) basics++;
    return orig(k, m, x);
  };
  for (let i = 0; i < 8; i++) b.deal(u, t, 10, 'physical', { kind: 'basic', canCrit: false });
  a.equal(basics, 10, '8회 + 추가 2회(2개 껴도 4회마다 1번)');
});

test('4. 대마법사의 서 ×2: AP·MP 획득량 +50%, 스킬 뒤 최대 MP 15%만 회복', () => {
  const plain = me(fight([]));
  const after = (ids) => {
    const b = fight(ids);
    const u = me(b);
    b.cast(u, foe(b));
    return u.mp / u.stats.MP;
  };
  const b = fight(['IC13', 'IC13']);
  near(me(b).stats.AP, plain.stats.AP * 1.5);
  near(me(b).manaGain, 1.5);
  near(after(['IC13', 'IC13']) - after([]), 0.15);
  near(after(['IC13']) - after([]), 0.15);
});

test('5~7. 거인의 심장 ×2 HP +110%·고유 +20% 1번, 요새의 갑옷 ×2 GD +95, 급소의 장갑 ×2 CTC +60%p·CTH +40%p', () => {
  const plain = me(fight([]));
  near(me(fight(['IC22', 'IC22'])).stats.HP, plain.stats.HP * (1 + 1.3));
  near(me(fight(['IC22'])).stats.HP, plain.stats.HP * (1 + 0.75));
  near(me(fight(['IC27', 'IC27'])).stats.GD, plain.stats.GD + 95);
  near(me(fight(['IC27'])).stats.GD, plain.stats.GD + 55);
  const g = me(fight(['IC34', 'IC34'])).stats;
  near(g.CTC, plain.stats.CTC + 60);
  near(g.CTH, plain.stats.CTH + 40);
  near(me(fight(['IC34', 'IC34', 'IC34'])).stats.CTH, plain.stats.CTH + 40);
});

test('8. 유령의 망토 ×1/×2/×3: 기본 DOD 12/24/36 + 고유 6 한 번, 실제 판정은 최대 40%', () => {
  const plain = me(fight([])).stats.DOD;
  for (const n of [1, 2, 3])
    near(me(fight(times(n, 'IC36'))).stats.DOD, plain + 12 * n + 6, `${n}개`);
  // 3개 = 42%p(+ 기본) → 판정 40%: 난수 0.399면 회피, 0.401이면 맞음
  const evaded = (r) => {
    const b = fight(times(3, 'IC36'), () => r);
    return !!b.deal(foe(b), me(b), 100, 'physical', { kind: 'basic', canCrit: false }).evaded;
  };
  a.equal(evaded(0.399), true);
  a.equal(evaded(0.401), false);
});

test('9·12. 서로 다른 장비 효과는 함께, 같은 장비를 낀 두 캐릭터는 각자 1번씩', () => {
  const b = new Battle(
    [
      {
        id: 'C03',
        pos: 27,
        star: 1,
        uid: 1,
        itemIds: ['IC01', 'IC03'],
        bonuses: I.bonuses(['IC01', 'IC03']),
      },
      { id: 'C05', pos: 26, star: 1, uid: 2, itemIds: ['IC01'], bonuses: I.bonuses(['IC01']) },
    ],
    enemies,
    { rng: () => 0.99 },
  );
  const plain = fight([]);
  const base = plain.deal(me(plain), foe(plain), 100, 'physical', {
    kind: 'basic',
    canCrit: false,
  }).damage;
  const one = b.units.find((u) => u.persistentUid === 1),
    two = b.units.find((u) => u.persistentUid === 2);
  near(b.deal(one, foe(b), 100, 'physical', { kind: 'basic', canCrit: false }).damage / base, 1.2);
  near(b.deal(two, foe(b), 100, 'physical', { kind: 'basic', canCrit: false }).damage / base, 1.2);
  near(one.stats.AD, me(plain).stats.AD * 1.6, '대검 40 + 폭풍 20');
});

test('10. 최종 회피 39/40/50/100%: 판정은 최대 40%, 스킬은 예전처럼 회피 대상 아님', () => {
  a.equal(effectiveDodge(39), 39);
  a.equal(effectiveDodge(40), 40);
  a.equal(effectiveDodge(50), 40);
  a.equal(effectiveDodge(100), 40);
  a.equal(effectiveDodge(-5), 0);
  const roll = (dod, r, kind = 'basic') => {
    const b = fight([], () => r);
    me(b).stats.DOD = dod; // 장비·유대·증강·메타·버프를 모두 더한 최종값 자리
    return !!b.deal(foe(b), me(b), 100, 'physical', { kind, canCrit: false }).evaded;
  };
  a.equal(roll(39, 0.389), true);
  a.equal(roll(39, 0.391), false);
  a.equal(roll(40, 0.399), true);
  a.equal(roll(50, 0.401), false, '50%여도 40%로 판정');
  a.equal(roll(100, 0.401), false, '100%여도 40%로 판정');
  a.equal(roll(100, 0, 'skill'), false, '스킬은 회피하지 않음');
});

test('11. 치명타 확률은 100%까지(회피 상한과 무관)', () => {
  const b = fight([], () => 0.999);
  me(b).stats.CTC = 100;
  a.equal(b.deal(me(b), foe(b), 100, 'physical', { kind: 'basic' }).critical, true);
  const c = fight([], () => 0.44);
  me(c).stats.CTC = 45;
  a.equal(c.deal(me(c), foe(c), 100, 'physical', { kind: 'basic' }).critical, true, '45%도 그대로');
});

test('메타 S3 장비 숙련은 기본 능력치만 키우고 고유 상시 능력치는 그대로', () => {
  near(I.bonuses(['IC27', 'IC27'], 0.1).GD, 80 * 1.1 + 15);
  near(I.bonuses(['IC03'], 0.1).ASMultiplier, 1 + 0.22);
  const s = newRun({ seed: 1, difficulty: 1, runId: 't' });
  s.units = [{ uid: 1, id: 'C03', location: 'board', pos: 27, star: 1 }];
  V.normalize(s);
  s.metaRun = { levels: { S3: 5 }, used: {} };
  for (const id of ['IC36', 'IC36']) {
    const it = P.addItem(s, id);
    it.equippedTo = 1;
  }
  const v = P.unitBonuses(s, 1).DOD;
  a(v > 24 + 6 && v < 24 * 1.5 + 6, `S3 반영 ${v}`);
});

test('하나를 회수·교체해도 남은 같은 장비가 있으면 고유 효과 유지, 모두 없어지면 해제', () => {
  a.deepEqual(I.bonuses(['IC34', 'IC34', 'IC34']).CTH, 40);
  a.deepEqual(I.bonuses(['IC34']).CTH, 40);
  a.equal(I.bonuses(['IC07']).CTH, undefined);
});
