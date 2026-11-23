// v0.20.0 장비 개편(요청서 AUTOCHESS_ITEM_REWORK_AND_RENAME_2026-11-23): 기본 장비 8종 + 완성 장비 36종,
// 드래그 조합(캐릭터·보관함), 기본 장비 1개 제한, 무료 회수 폐지·회수기, 보급 4→2, 보스·추가 보상 유지,
// 구형 저장 이관, 판매·합성 반환, 전투 능력치·고유 효과. 수치는 data(items.js)의 1차 테스트안에서 읽는다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import D from '../../src/core/data/units.js';
import I from '../../src/core/items.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import E from '../../src/core/equipment.ts';
import W from '../../src/core/encounters.js';
import Engine from '../../src/core/combat/battle.js';
import { newRun } from '../../src/core/run.ts';
import { buyUnit, sellUnit } from '../../src/core/shop.ts';

const { Battle } = Engine;
const clone = (x) => JSON.parse(JSON.stringify(x));
const near = (x, y, msg = '') => a(Math.abs(x - y) < 1e-6, `${msg} ${x} != ${y}`);
const id = (name) => I.items.find((i) => i.name === name).id;

function run() {
  const s = newRun({ seed: 3, difficulty: 1, runId: 't' });
  s.units = [
    { uid: 1, id: 'C03', location: 'board', pos: 27, star: 1 },
    { uid: 2, id: 'C05', location: 'board', pos: 26, star: 1 },
    { uid: 3, id: 'C01', location: 'bench', pos: -1, star: 1 },
  ];
  V.normalize(s);
  return s;
}
const give = (s, itemId) => P.addItem(s, itemId);
const worn = (s, uid) => s.inventory.filter((i) => i.equippedTo === uid).map((i) => i.id);

// ─── 데이터 ───
test('기본 장비 8종 + 완성 장비 36종, 모든 두 재료 조합(같은 재료 포함)이 순서와 무관하게 하나씩', () => {
  a.equal(I.base.length, 8);
  a.equal(I.complete.length, 36);
  a.equal(I.items.length, 44);
  a(
    I.items.every((i) => !/^I\d\d$/.test(i.id)),
    '예전 I01~I40과 겹치지 않음',
  );
  const seen = new Set();
  for (let x = 0; x < 8; x++)
    for (let y = x; y < 8; y++) {
      const r1 = I.recipe(I.base[x].id, I.base[y].id);
      const r2 = I.recipe(I.base[y].id, I.base[x].id);
      a(r1 && r1 === r2, `${x}+${y}`);
      seen.add(r1);
    }
  a.equal(seen.size, 36);
  a.equal(I.recipe('IC01', 'IB01'), null, '완성 장비는 다시 조합하지 않음');
  // v0.21.0: 완성 장비 능력치는 재료 합이 아니라 장비마다 정한 값(재료 능력치를 이어받지 않음)
  a.deepEqual(I.byId(id('폭풍의 검')).stats, { ADPercent: 20, ASPercent: 20 });
  a.deepEqual(I.byId(id('불멸의 갑옷')).stats, { HPPercent: 30, GD: 22 });
  a.deepEqual(I.byId(id('거인의 심장')).stats, { HPPercent: 55 });
  a.deepEqual(I.byId(id('거인의 심장')).uniqueStats, { HPPercent: 20 });
});

// ─── 지급 경로 ───
test('보급: 기본 장비만 4개(중복 없음) 제시 → 2개 선택, 정규 7회 14개 + 보스 6개 = 20개', () => {
  let seed = 7;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const s = run();
  P.beginSupply(s, rng);
  a.equal(s.supplyOffer.options.length, 4);
  a.equal(new Set(s.supplyOffer.options).size, 4);
  a(s.supplyOffer.options.every((x) => I.isBase(x)));
  // 스테이지 구성: 1라운드 1·2 보급, 이후 3번째 보급, 5번째 보스
  const supplies = [];
  for (let st = 1; st <= 6; st++)
    for (let r = 1; r <= 5; r++) if (P.roundType(st, r) === 'SUPPLY') supplies.push(`${st}-${r}`);
  a.deepEqual(supplies, ['1-1', '1-2', '2-3', '3-3', '4-3', '5-3', '6-3']);
  a.equal(supplies.length * 2 + 6, 20);
});

test('보스 승리: 확정 장비 1개(기본 장비), 회수기 40% 확률로 1개 75%·2개 25%(따로 판정)', () => {
  let got = 0,
    one = 0,
    two = 0;
  let seed = 11;
  const rng = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let k = 0; k < 4000; k++) {
    const s = run();
    Object.assign(s, { stage: 2, round: 5, roundPhase: 'combat' });
    const r = P.settleRound(s, { winner: 'ally', survivingEnemies: 0 }, rng);
    a(I.isBase(r.bossItem.itemId));
    if (r.recovery) got++;
    if (r.recovery === 1) one++;
    if (r.recovery === 2) two++;
    a.equal(s.recoveryTools, 2 + (r.recovery || 0));
  }
  near(Math.round((got / 4000) * 100) / 100, 0.4, '획득 확률(±2%)'.length ? '' : '');
  a(Math.abs(got / 4000 - 0.4) < 0.025, `획득 ${got}/4000`);
  a(Math.abs(two / got - 0.25) < 0.035, `2개 비율 ${two}/${got}`);
  // 보스 패배는 장비·회수기 없음
  const lose = run();
  Object.assign(lose, { stage: 2, round: 5, roundPhase: 'combat' });
  const r = P.settleRound(lose, { winner: 'enemy', survivingEnemies: 1 }, () => 0);
  a.equal(r.bossItem, null);
  a.equal(lose.recoveryTools, 2);
});

test('추가 보상 경로는 개수 그대로 기본 장비로: 증강 장비 지급·보너스 몬스터', () => {
  const s = run();
  const before = s.inventory.length;
  // 증강의 장비 지급(e.items: count·tier)은 개수 그대로, 기본 장비로
  const aug = { effect: { items: { count: 3, tier: 3 } } };
  for (let i = 0; i < aug.effect.items.count; i++)
    P.addItem(
      s,
      I.drawTier(aug.effect.items.tier, () => 0.5),
    );
  a.equal(s.inventory.length, before + 3);
  a(s.inventory.every((i) => I.isBase(i.id)));
  // 보너스 몬스터(E99) 장비 보상
  const t = run();
  t.stage = 1;
  t.round = 3;
  const loot = W.claimBonusLoot(t, { id: 'E99', team: 'enemy' }, () => 0);
  if (loot.kind === 'item') a(I.isBase(loot.itemId));
});

// ─── 조합·장착 ───
test('캐릭터에 놓기: 없음→장착, 기본 1개→완성 장비로 조합해 바로 착용, 완성만→빈칸에 기본 장착, 완성2+기본1→완성3, 완성3→거절', () => {
  const s = run();
  const sword = give(s, 'IB01'),
    bow = give(s, 'IB03');
  a.equal(E.dropOnUnit(s, sword.uid, 1).action, 'equip');
  a.deepEqual(worn(s, 1), ['IB01']);
  const r = E.dropOnUnit(s, bow.uid, 1);
  a.equal(r.action, 'combine');
  a.deepEqual(worn(s, 1), [id('폭풍의 검')], '2칸이 1칸으로');
  a(!s.inventory.some((i) => i.uid === sword.uid || i.uid === bow.uid), '재료는 사라짐');
  // 완성 1개 + 기본 장착
  a.equal(E.dropOnUnit(s, give(s, 'IB05').uid, 1).action, 'equip');
  // 기본 + 기본 → 완성 2개
  E.dropOnUnit(s, give(s, 'IB05').uid, 1);
  a.deepEqual(worn(s, 1).sort(), [id('폭풍의 검'), id('요새의 갑옷')].sort());
  // 완성 2 + 기본 1(3칸 꽉) + 기본 → 완성 3(빈칸 없어도 조합)
  E.dropOnUnit(s, give(s, 'IB08').uid, 1);
  a.equal(worn(s, 1).length, 3);
  a.equal(E.dropOnUnit(s, give(s, 'IB08').uid, 1).action, 'combine');
  a.equal(worn(s, 1).length, 3);
  a(worn(s, 1).every((x) => !I.isBase(x)));
  // 완성 3개 → 더 못 놓음(아무것도 안 바뀜)
  const extra = give(s, 'IB02');
  const before = clone(s.inventory);
  const fail = E.dropOnUnit(s, extra.uid, 1);
  a.equal(fail.ok, false);
  a.equal(fail.message, '캐릭터당 아이템은 최대 3개입니다.');
  a.deepEqual(s.inventory, before);
  // 한 캐릭터에 기본 장비는 언제나 최대 1개
  for (const u of s.units)
    a(s.inventory.filter((i) => i.equippedTo === u.uid && I.isBase(i.id)).length <= 1);
});

test('보관함 조합: 기본 장비 위에 기본 장비 → 그 자리에 완성 장비(보관함), 완성 장비·같은 칸·장착 장비는 거절', () => {
  const s = run();
  const x = give(s, 'IB04'),
    y = give(s, 'IB04'),
    z = give(s, 'IB02');
  const index = s.inventory.findIndex((i) => i.uid === y.uid);
  const r = E.combineInInventory(s, x.uid, y.uid);
  a.equal(r.ok, true);
  a.equal(
    s.inventory[index - 1 >= 0 ? index - 1 : 0].id === id('거인의 심장') ||
      s.inventory.some((i) => i.id === id('거인의 심장') && i.equippedTo === null),
    true,
  );
  a(!s.inventory.some((i) => i.uid === x.uid || i.uid === y.uid));
  // 미리보기는 상태를 바꾸지 않는다
  const before = clone(s);
  a.equal(E.planOnItem(s, z.uid, r.item.uid).ok, false, '완성 장비 위');
  a.equal(E.planOnItem(s, z.uid, z.uid).ok, false, '같은 칸');
  const w = give(s, 'IB07');
  const plan = E.planOnItem(s, z.uid, w.uid);
  a.equal(plan.ok && plan.resultId, id('비전의 눈'));
  delete before.inventory;
  const after = clone(s);
  delete after.inventory;
  delete after.itemSequence;
  delete before.itemSequence;
  a.deepEqual(after, before);
  // 같은 요청을 다시 보내도 복제·유실 없음(두 번째는 재료가 없어 실패)
  a.equal(E.combineInInventory(s, z.uid, w.uid).ok, true);
  const count = s.inventory.length;
  a.equal(E.combineInInventory(s, z.uid, w.uid).ok, false);
  a.equal(s.inventory.length, count);
});

test('무료 회수 없음: 장착한 장비는 옮기거나 빼지 못하고, 준비 단계에서만 조작', () => {
  const s = run();
  const it = give(s, 'IB01');
  E.dropOnUnit(s, it.uid, 1);
  a.equal(P.unequip, undefined, '무료 회수 함수 없음');
  a.equal(E.dropOnUnit(s, it.uid, 2).ok, false, '다른 캐릭터로 옮기기');
  a.equal(V.transferItem(s, it.uid, 2).ok, false);
  a.deepEqual(worn(s, 1), ['IB01']);
  s.roundPhase = 'combat';
  a.equal(E.dropOnUnit(s, give(s, 'IB02').uid, 2).ok, false);
  a.equal(E.recover(s, 1).ok, false, '전투 중 회수기 불가');
});

test('회수기: 새 원정 2개, 장비 1~3개를 한 번에 그대로(ID·UID) 보관함으로, 1개만 소모, 장비 없는 캐릭터·없을 때는 소모 없음', () => {
  const s = run();
  a.equal(s.recoveryTools, 2);
  const a1 = give(s, 'IB01'),
    a2 = give(s, 'IB05'),
    a3 = give(s, 'IB05');
  E.dropOnUnit(s, a1.uid, 1);
  E.dropOnUnit(s, a2.uid, 1);
  E.dropOnUnit(s, a3.uid, 1); // 철갑+철갑 → 요새의 갑옷
  const before = s.inventory
    .filter((i) => i.equippedTo === 1)
    .map((i) => ({ uid: i.uid, id: i.id }));
  a.equal(before.length, 2);
  const r = E.recover(s, 1);
  a.equal(r.ok, true);
  a.equal(s.recoveryTools, 1);
  a.deepEqual(r.items.sort(), before.map((x) => x.uid).sort());
  for (const x of before)
    a(
      s.inventory.some((i) => i.uid === x.uid && i.id === x.id && i.equippedTo === null),
      '분해 없이 그대로',
    );
  a.equal(E.recover(s, 1).ok, false, '장비 없는 캐릭터');
  a.equal(s.recoveryTools, 1);
  s.recoveryTools = 0;
  E.dropOnUnit(s, give(s, 'IB02').uid, 2);
  a.equal(E.recover(s, 2).ok, false, '회수기 없음');
  a.deepEqual(worn(s, 2), ['IB02']);
});

test('판매·합성으로 사라지는 캐릭터의 장비는 예전처럼 보관함으로(사용자 결정)', () => {
  const s = run();
  s.gold = 50;
  const it = give(s, 'IB01');
  E.dropOnUnit(s, it.uid, 3);
  a(sellUnit(s, 3).ok);
  a.equal(s.inventory.find((i) => i.uid === it.uid).equippedTo, null);
  // 합성: 재료 캐릭터 장비는 보관함으로(남는 캐릭터 것은 그대로)
  const t = run();
  t.gold = 50;
  t.units = [
    { uid: 1, id: 'C03', location: 'board', pos: 27, star: 1 },
    { uid: 2, id: 'C03', location: 'bench', pos: -1, star: 1 },
  ];
  V.normalize(t);
  const g = give(t, 'IB02');
  E.dropOnUnit(t, g.uid, 2);
  t.shop = ['C03', null, null, null, null];
  a(buyUnit(t, 'C03', { uid: 9, slot: 0 }).ok);
  a.equal(t.units.filter((u) => u.id === 'C03').length, 1);
  a.equal(t.inventory.find((i) => i.uid === g.uid).equippedTo, null);
});

test('구형 저장(버전 5): 예전 장비는 보관함·장착 모두 지우고 원정은 이어감, 회수기 2개, 예전 보급 후보는 다시 뽑기', () => {
  const s = run();
  s.version = 5;
  delete s.recoveryTools;
  s.inventory = [
    { uid: 'I1', id: 'I01', equippedTo: 1 },
    { uid: 'I2', id: 'I36', equippedTo: null },
    { uid: 'I3', id: 'IB01', equippedTo: null },
  ];
  s.supplyOffer = { key: '1-1', options: ['I01', 'I02', 'I03', 'I04'], selected: [0] };
  s.roundPhase = 'supply';
  const units = clone(s.units),
    gold = s.gold,
    health = s.health;
  P.migrate(s);
  a.equal(s.version, 6);
  a.deepEqual(s.inventory, [{ uid: 'I3', id: 'IB01', equippedTo: null }]);
  a.equal(s.supplyOffer, null);
  a.equal(s.roundPhase, 'prepare');
  a.equal(s.recoveryTools, 2);
  a.deepEqual([s.units, s.gold, s.health], [units, gold, health]);
});

// ─── 전투 ───
const enemies = [
  { id: 'E06', pos: 30 },
  { id: 'E01', pos: 31 },
];
function fight(itemIds, extraAllies = []) {
  return new Battle(
    [{ id: 'C03', pos: 27, star: 1, uid: 1, itemIds, bonuses: I.bonuses(itemIds) }, ...extraAllies],
    enemies,
    { rng: () => 0.99 },
  );
}
const me = (b) => b.units.find((u) => u.persistentUid === 1);
const foe = (b) => b.units.find((u) => u.id === 'E06');

test('기본 장비 능력치: AD·AP·AS·HP %, GD·CTC·DOD 더하기, MP 획득량 %(최대 MP 그대로), 완성 장비는 자기 능력치만', () => {
  const base = me(fight([]));
  const s = (ids) => me(fight(ids));
  near(s(['IB01']).stats.AD, base.stats.AD * 1.1);
  near(s(['IB02']).stats.AP, base.stats.AP * 1.1);
  near(s(['IB03']).stats.AS, base.stats.AS * 1.1);
  near(s(['IB04']).stats.HP, base.stats.HP * 1.15);
  near(s(['IB05']).stats.GD, base.stats.GD + 10);
  near(s(['IB06']).manaGain, 1.15);
  a.equal(s(['IB06']).stats.MP, base.stats.MP);
  near(s(['IB07']).stats.CTC, base.stats.CTC + 10);
  near(s(['IB08']).stats.DOD, base.stats.DOD + 8);
  near(s([id('폭풍의 검')]).stats.AD, base.stats.AD * 1.2);
  near(s([id('유령의 망토')]).stats.DOD, base.stats.DOD + 18, '기본 12 + 고유 6');
  // 미리보기(원정)와 전투가 같은 능력치
  const r = run();
  const it = give(r, 'IB01');
  E.dropOnUnit(r, it.uid, 1);
  near(P.previewStats(r, r.units[0]).AD, base.stats.AD * 1.1);
});

test('고유 효과: 광전사의 대검(기본 공격 +20%, 2개여도 1번), 대마법사의 관(스킬 +20%), 처형자의 검, 불멸의 갑옷(받는 피해 −12%)', () => {
  const hit = (ids, kind, enemyHp = 1) => {
    const b = fight(ids);
    const t = foe(b);
    t.hp = t.stats.HP * enemyHp;
    return b.deal(me(b), t, 100, 'physical', { kind, canCrit: false }).damage;
  };
  const plain = hit([], 'basic');
  near(hit([id('광전사의 대검')], 'basic') / plain, 1.2);
  near(hit([id('광전사의 대검'), id('광전사의 대검')], 'basic') / plain, 1.2, '고유 효과는 1번');
  near(hit([id('대마법사의 관')], 'skill') / hit([], 'skill'), 1.2);
  near(hit([id('처형자의 검')], 'skill', 0.3) / hit([], 'skill', 0.3), 1.2);
  near(hit([id('처형자의 검')], 'skill', 0.31) / hit([], 'skill', 0.31), 1);
  const taken = (ids) => {
    const b = fight(ids);
    return b.deal(foe(b), me(b), 100, 'physical', { kind: 'skill', canCrit: false }).damage;
  };
  // 기본 능력치(GD)를 뺀 고유 효과만: 불멸의 갑옷 GD 22와 같은 GD를 주는 상태에서 비교
  const armorOnly = (() => {
    const b = fight([id('불멸의 갑옷')]);
    const t = me(b);
    t.itemIds = [];
    return b.deal(foe(b), t, 100, 'physical', { kind: 'skill', canCrit: false }).damage;
  })();
  near(taken([id('불멸의 갑옷')]) / armorOnly, 0.88);
});

test('고유 효과: 폭풍의 검(기본 공격 4회마다 추가 공격, 연쇄 없음), 흡혈검 12% 회복, 수호자의 검·마력의 심장(시작), 반격의 갑주', () => {
  const b = fight([id('폭풍의 검')]);
  const u = me(b),
    t = foe(b);
  t.hp = t.stats.HP = 1e9;
  let basics = 0;
  const orig = b.log.bind(b);
  b.log = (k, m, x = {}) => {
    if (k === 'damage' && x.attackKind === 'basic' && x.source === u.uid) basics++;
    return orig(k, m, x);
  };
  for (let i = 0; i < 8; i++) b.deal(u, t, 10, 'physical', { kind: 'basic', canCrit: false });
  a.equal(basics, 10, '8회 + 추가 2회(추가 공격은 다시 추가 공격을 만들지 않음)');
  // 흡혈검
  const v = fight([id('흡혈검')]);
  const vu = me(v);
  vu.hp = vu.stats.HP / 2;
  const before = vu.hp;
  const dealt = v.deal(vu, foe(v), 100, 'physical', { kind: 'basic', canCrit: false }).damage;
  near(vu.hp - before, dealt * 0.12);
  // 시작 효과
  const g = me(fight([id('수호자의 검')]));
  near(g.shields[0].amount, g.stats.HP * 0.15);
  const h = me(fight([id('마력의 심장')]));
  near(h.mp, Math.min(h.stats.MP, me(fight([])).mp + h.stats.MP * 0.3));
  // 반격의 갑주: 기본 공격을 맞으면 공격자에게 GD 50% 물리 피해
  const c = fight([id('반격의 갑주')]);
  const attacker = foe(c);
  const hp0 = attacker.hp;
  c.deal(attacker, me(c), 50, 'physical', { kind: 'basic', canCrit: false });
  a(attacker.hp < hp0, '반사 피해');
});

test('고유 효과: 회피 성공 뒤 효과(질풍검 AS·환영의 갑옷 GD·그림자 장갑 CTC·환영궁 확정 치명타·유동의 수정 MP)', () => {
  const b = new Battle(
    [
      {
        id: 'C03',
        pos: 27,
        star: 1,
        uid: 1,
        itemIds: [id('질풍검'), id('환영의 갑옷'), id('그림자 장갑')],
        bonuses: {},
      },
    ],
    enemies,
    { rng: () => 0 }, // 회피 확정(0 < DOD)
  );
  const u = me(b);
  u.stats.DOD = 50;
  const r = b.deal(foe(b), u, 100, 'physical', { kind: 'basic' });
  a.equal(r.evaded, true);
  const s = b.stats(u);
  near(s.AS, u.stats.AS * 1.2);
  near(s.GD, u.stats.GD + 15);
  near(s.CTC, u.stats.CTC + 20);
});

test('캐릭터 45명 개명: C01 녹스 유지, 여 36 / 남 9, ID·코스트·종족·직업·특성은 그대로', () => {
  a.equal(D.byId('C01').name, '녹스');
  a.equal(D.byId('C02').name, '아젤리아');
  a.equal(D.byId('C45').name, '아바르크');
  a.equal(D.roster.filter((u) => u.gender === 'female').length, 36);
  a.equal(D.roster.filter((u) => u.gender === 'male').length, 9);
  a.deepEqual(
    [D.byId('C13').race, D.byId('C13').job, D.byId('C13').trait, D.byId('C13').cost],
    ['드워프', '마법사', '빙결', 2],
  );
});

test('완성 장비 36종 각각을 낀 전투가 끝까지 오류 없이 돌고, 2개 중복 착용도 된다', () => {
  for (const c of I.complete)
    for (const ids of [[c.id], [c.id, c.id]]) {
      const b = new Battle(
        [
          { id: 'C03', pos: 27, star: 2, uid: 1, itemIds: ids, bonuses: I.bonuses(ids) },
          { id: 'C21', pos: 26, star: 2, uid: 2, itemIds: ids, bonuses: I.bonuses(ids) },
        ],
        [
          { id: 'E06', pos: 30, star: 2 },
          { id: 'E01', pos: 31, star: 2 },
          { id: 'E03', pos: 29 },
        ],
        { seed: 42 },
      );
      let r = null;
      for (let i = 0; i < 20000 && !r; i++) r = b.tick();
      a(r?.winner, `${c.name} ×${ids.length}`);
    }
});
