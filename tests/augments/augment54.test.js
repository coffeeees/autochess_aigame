// v0.16.0 증강 54종 1차 후보안의 기능 테스트(효과·중첩·초기화·저장 복원·중복 방지·경계 조건·상호작용).
// 수치는 데이터(src/core/augments.js)에서 읽어 확인한다. 기본안 정의는 docs/GAME_DESIGN.md 12절.
import { test } from 'vitest';
import a from 'node:assert/strict';
import A from '../../src/core/augments.js';
import D from '../../src/core/data/units.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import I from '../../src/core/items.js';
import Engine from '../../src/core/combat/battle.js';
import { createRng } from '../../src/core/rng.ts';

const { Battle } = Engine;
const clone = (x) => JSON.parse(JSON.stringify(x));
const near = (x, y, msg) => a(Math.abs(x - y) < 1e-6, `${msg ?? ''} ${x} != ${y}`);
const e = (id) => A.byId(id).effect;
const cost = (id) => D.byId(id).cost;
const enemies = [
  { id: 'E06', pos: 10 },
  { id: 'E01', pos: 3 },
];
/** 전투 생성(무작위 0.99: 회피·치명타 없음) */
function fight(ids, allies, opts = {}) {
  return new Battle(allies, opts.enemies ?? enemies, {
    rng: () => 0.99,
    allyModifiers: { augmentIds: ids, cloneTarget: opts.cloneTarget ?? null },
  });
}
const ally = (b, id) => b.units.find((u) => u.team === 'ally' && u.id === id && !u.summon);
/** 같은 편성의 증강 없는 전투와 비교 */
const pair = (ids, allies, opts) => [fight([], allies, opts), fight(ids, allies, opts)];
function run(extra = {}) {
  const s = P.initialize({
    health: 100,
    gold: 20,
    units: [
      { uid: 1, id: 'C03', location: 'board', pos: 38, star: 1 },
      { uid: 2, id: 'C05', location: 'board', pos: 45, star: 1 },
    ],
    shop: [null, null, null, null, null],
  });
  s.rngState = 7;
  return Object.assign(s, extra);
}
/** 증강을 고르는 선택 대기 상태를 만들어 고른다 */
function choose(s, id, node = '1-3', rng = () => 0.3) {
  const def = A.byId(id);
  s.augmentState.pendingPick = { node, pick: 1, tier: def.tier, optionIds: [id] };
  s.roundPhase = 'augment';
  return P.chooseAugment(s, id, rng);
}
/** 일반 전투 정산(1-3 등 BATTLE 라운드) */
function settle(s, winner, extra = {}) {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner, time: 10, allyLosses: 0, ...extra }, () => 0.9);
}

// ─── 시작 시 정적 효과 ───
test('S14 선봉대·S15 후방 지원: 아군이 선 가장 앞줄 HP, 가장 뒷줄 AS', () => {
  const allies = [
    { id: 'C03', pos: 31 }, // 4행(가장 앞)
    { id: 'C05', pos: 46 }, // 6행(가장 뒤)
  ];
  const [x, y] = pair(['S14', 'S15'], allies);
  near(ally(y, 'C03').stats.HP, ally(x, 'C03').stats.HP * 1.2, '앞줄 HP');
  near(ally(y, 'C03').hp, ally(y, 'C03').stats.HP);
  near(ally(y, 'C05').stats.HP, ally(x, 'C05').stats.HP, '뒷줄 HP 그대로');
  near(ally(y, 'C05').stats.AS, ally(x, 'C05').stats.AS * 1.15, '뒷줄 AS');
  near(ally(y, 'C03').stats.AS, ally(x, 'C03').stats.AS, '앞줄 AS 그대로');
});

test('S16 쌍둥이 수호자: 가장 앞줄에 정확히 2명일 때만 GD +25(고정값)', () => {
  const two = [
    { id: 'C03', pos: 36 },
    { id: 'C05', pos: 37 },
    { id: 'C01', pos: 50 },
  ];
  const [x, y] = pair(['S16'], two);
  a.equal(ally(y, 'C03').stats.GD, ally(x, 'C03').stats.GD + 25);
  a.equal(ally(y, 'C05').stats.GD, ally(x, 'C05').stats.GD + 25);
  a.equal(ally(y, 'C01').stats.GD, ally(x, 'C01').stats.GD);
  const three = [...two, { id: 'C02', pos: 35 }];
  const [p, q] = pair(['S16'], three);
  a.equal(ally(q, 'C03').stats.GD, ally(p, 'C03').stats.GD, '3명이면 없음');
});

test('S17 모범 동료: AD가 가장 높은 1명 AS +20%', () => {
  const allies = [
    { id: 'C03', pos: 38 },
    { id: 'C05', pos: 45 },
    { id: 'C09', pos: 46 },
  ];
  const [x, y] = pair(['S17'], allies);
  const best = [...x.units.filter((u) => u.team === 'ally')].sort(
    (p, q) => q.stats.AD - p.stats.AD,
  )[0];
  near(ally(y, best.id).stats.AS, best.stats.AS * 1.2);
  a.equal(y.units.filter((u) => u.augmentState.ace).length, 1);
});

test('G16 선택받은 영웅·P16 왕의 친위대: 코스트 최고 1명 HP 배율과 피해량', () => {
  const allies = [
    { id: 'C03', pos: 38 },
    { id: 'C24', pos: 45 }, // 3코스트
  ];
  const [x, g] = pair(['G16'], allies);
  near(ally(g, 'C24').stats.HP, ally(x, 'C24').stats.HP * 1.3);
  near(ally(g, 'C24').augmentState.damage, 0.2);
  const [, k] = pair(['P16'], allies);
  near(ally(k, 'C24').stats.HP, ally(x, 'C24').stats.HP * 1.4);
  near(ally(k, 'C24').augmentState.damage, 0.5);
  a.equal(ally(k, 'C24').augmentState.king, 0.2);
  a.equal(ally(k, 'C03').augmentState.king, undefined);
});

test('G14 전장의 지휘관: 전방 2줄(행 4·5) 1명당 후방 2줄(행 6·7) 피해량 +5%, 최대 25%', () => {
  const two = [
    { id: 'C03', pos: 30 }, // 행 4
    { id: 'C05', pos: 37 }, // 행 5
    { id: 'C01', pos: 45 }, // 행 6
    { id: 'C02', pos: 52 }, // 행 7
  ];
  const [, g] = pair(['G14'], two);
  near(ally(g, 'C01').augmentState.damage, 0.1);
  near(ally(g, 'C02').augmentState.damage, 0.1);
  a(!ally(g, 'C03').augmentState.damage, '전방은 받지 않음');
  const six = ['C03', 'C05', 'C06', 'C07', 'C08', 'C09'].map((id, i) => ({ id, pos: 28 + i }));
  const [, h] = pair(['G14'], [...six, { id: 'C01', pos: 45 }]);
  near(ally(h, 'C01').augmentState.damage, 0.25, '6명이어도 최대 25%');
});

test('경계 조건: 동률은 코스트 → 성급 → 작은 칸 번호, 아군 1명이면 P18 희생 없음', () => {
  const foe = [{ id: 'E01', pos: 3 }];
  const star = fight(
    ['G16'],
    [
      { id: 'C03', pos: 38 },
      { id: 'C05', pos: 45, star: 2 },
    ],
    { enemies: foe },
  );
  near(ally(star, 'C05').augmentState.damage, 0.2, '같은 코스트면 성급 높은 쪽');
  const cell = fight(
    ['G16'],
    [
      { id: 'C05', pos: 45 },
      { id: 'C03', pos: 38 },
    ],
    { enemies: foe },
  );
  near(ally(cell, 'C03').augmentState.damage, 0.2, '성급도 같으면 작은 칸 번호');
  const solo = fight(['P18'], [{ id: 'C03', pos: 38 }], { enemies: foe });
  a(ally(solo, 'C03'), '혼자면 희생하지 않음');
  a.equal(solo.augment.sacrifice, null);
});

test('S13·G15 활성 조합 수만큼, P17 활성 조합 4개 이상일 때만', () => {
  const allies = [
    { id: 'C01', pos: 38 },
    { id: 'C28', pos: 39 },
  ];
  const [x, y] = pair(['S13', 'G15'], allies);
  const n = y.synergySnapshot.ally.filter((s) => s.tier > 0).length;
  a.equal(n, 2, '종언·흑월');
  near(ally(y, 'C01').stats.AD, ally(x, 'C01').stats.AD * 1.06 * 1.06, 'S13·G15 각각 곱');
  near(ally(y, 'C01').stats.HP, ally(x, 'C01').stats.HP + 160);
  const [p, q] = pair(['P17'], allies);
  near(ally(q, 'C01').stats.HP, ally(p, 'C01').stats.HP, '2개면 없음');
  a.equal(q.augment.harmony, 0);
});

test('P03 광전사의 축제: AS +40%, 최대 HP -20%(준비 화면 미리보기와 같음)', () => {
  const [x, y] = pair(['P03'], [{ id: 'C03', pos: 38 }]);
  near(ally(y, 'C03').stats.AS, ally(x, 'C03').stats.AS * 1.4);
  near(ally(y, 'C03').stats.HP, ally(x, 'C03').stats.HP * 0.8);
  const s = run({ augments: ['P03'] });
  near(P.previewStats(s, s.units[0]).HP, ally(y, 'C03').stats.HP);
});

test('S03·P02 시작 MP: 큰 값 하나만, P02 스킬 뒤 3초 AP +25%', () => {
  const b = fight(['S03', 'P02'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03');
  near(u.mp, u.stats.MP * 0.75);
  const ap = b.stats(u).AP;
  b.cast(
    u,
    b.units.find((x) => x.team === 'enemy'),
  );
  near(b.stats(u).AP, ap * 1.25, '시전 직후');
  b.time += 3.01;
  near(b.stats(u).AP, ap, '3초 뒤 끝');
});

// ─── 시간 효과 ───
test('S02·G03 시간마다 AS 중첩(최대치), G01 12초 뒤 피해량 +35%', () => {
  const b = fight(['S02', 'G03'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03'),
    base = b.stats(u).AS;
  b.time = 6;
  b.emit('update');
  near(b.stats(u).AS, base * (1 + 0.04) * (1 + 0.08 * 2));
  b.time = 60;
  b.emit('update');
  near(b.stats(u).AS, base * (1 + 0.04 * 4) * (1 + 0.08 * 5), '최대 4·5중첩');
  const [x, y] = pair(['G01'], [{ id: 'C03', pos: 38 }]);
  const hit = (bt) => {
    const t = bt.units.find((v) => v.team === 'enemy');
    return bt.deal(ally(bt, 'C03'), t, 100, 'magic', { kind: 'skill', canCrit: false }).damage;
  };
  y.time = 11.9;
  near(hit(y), hit(x), '12초 전 그대로');
  y.time = 12;
  near(hit(y), hit(x) * 1.35, '12초부터 +35%');
});

test('P06 시간의 지배자: 10~18초 적 AS -30%, 아군 AS +30%', () => {
  const b = fight(['P06'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03'),
    foe = b.units.find((v) => v.team === 'enemy');
  const [ua, fa] = [b.stats(u).AS, b.stats(foe).AS];
  b.time = 10.5;
  near(b.stats(u).AS, ua * 1.3);
  near(b.stats(foe).AS, fa * 0.7);
  b.time = 18.5;
  near(b.stats(u).AS, ua);
  near(b.stats(foe).AS, fa);
});

test('P04 최후의 심판: 15초에 적 최대 HP 20%(보스 5%) 고정 피해, 방어 무시·보호막에 막힘', () => {
  const b = fight(['P04'], [{ id: 'C03', pos: 38 }], {
    enemies: [
      { id: 'E06', pos: 10 },
      { id: 'E01', pos: 3, boss: true },
    ],
  });
  const [norm, boss] = b.units.filter((v) => v.team === 'enemy');
  b.shield(norm, 50, 99, norm);
  const [h1, h2] = [norm.hp, boss.hp];
  b.time = 14.9;
  b.emit('update');
  a.equal(norm.hp, h1, '15초 전');
  b.time = 15;
  b.emit('update');
  near(norm.hp, h1 - (norm.stats.HP * 0.2 - 50), '보호막 50 먼저');
  near(boss.hp, h2 - boss.stats.HP * 0.05, '보스 5%');
  b.time = 30;
  b.emit('update');
  near(boss.hp, h2 - boss.stats.HP * 0.05, '1회만');
});

// ─── 피해·처치·사망 반응 ───
test('S01 천상의 축복: 기본 공격·스킬·지속 피해의 8% 회복, 아이템 발동 제외', () => {
  const b = fight(['S01'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03'),
    foe = b.units.find((v) => v.team === 'enemy');
  for (const kind of ['basic', 'skill', 'dot']) {
    u.hp = 100;
    const d = b.deal(u, foe, 50, 'magic', { kind, canCrit: false }).damage;
    near(u.hp, 100 + d * 0.08, kind);
  }
  u.hp = 100;
  b.deal(u, foe, 50, 'magic', { kind: 'skill', itemProc: true, canCrit: false });
  a.equal(u.hp, 100, '아이템 발동 제외');
});

test('S05 집중 포화: 같은 적 기본 공격마다 +2%(최대 10), 대상이 바뀌면 처음부터', () => {
  const b = fight(['S05'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03'),
    [f1, f2] = b.units.filter((v) => v.team === 'enemy');
  const hit = (t) => {
    t.hp = t.stats.HP;
    return b.deal(u, t, 100, 'physical', { kind: 'basic', canCrit: false }).damage;
  };
  const first = hit(f1);
  near(hit(f1), first * 1.02);
  near(hit(f1), first * 1.04);
  for (let i = 0; i < 20; i++) hit(f1);
  near(hit(f1), first * 1.2, '최대 10중첩');
  const other = hit(f2);
  near(hit(f2), other * 1.02, '대상 바뀌면 다시 1중첩부터');
});

test('S04·G02: 처음 HP 30%·35% 이하 때 한 번만 보호막 / 회복+GD', () => {
  const b = fight(['S04', 'G02'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03'),
    foe = b.units.find((v) => v.team === 'enemy');
  u.hp = u.stats.HP * 0.36;
  b.deal(foe, u, u.stats.HP * 0.02, 'magic', { kind: 'skill', canCrit: false });
  a(u.augmentState.lowRally, '35% 이하 → 불굴의 의지');
  a(u.hp > u.stats.HP * 0.5, '25% 회복');
  near(b.stats(u).GD - u.stats.GD, 20);
  a(!u.augmentState.lowGuard, '30% 위');
  u.hp = u.stats.HP * 0.31;
  b.deal(foe, u, u.stats.HP * 0.02, 'magic', { kind: 'skill', canCrit: false });
  a(u.augmentState.lowGuard);
  const shields = u.shields.length;
  u.hp = u.stats.HP * 0.1;
  b.deal(foe, u, 1, 'magic', { kind: 'skill', canCrit: false });
  a.equal(u.shields.length, shields, '한 번만');
});

test('S06·G06·P03: 적 처치 시 처치자 AD·AP +15% 5초, HP 비율 최저 아군 12% 회복, 처치자 잃은 HP 10% 회복', () => {
  const b = fight(
    ['S06', 'G06', 'P03'],
    [
      { id: 'C03', pos: 38 },
      { id: 'C05', pos: 45 },
    ],
  );
  const u = ally(b, 'C03'),
    low = ally(b, 'C05'),
    foe = b.units.find((v) => v.team === 'enemy');
  const ad = b.stats(u).AD;
  u.hp = u.stats.HP * 0.5;
  low.hp = low.stats.HP * 0.2;
  const [uh, lh] = [u.hp, low.hp];
  b.kill(foe, u);
  near(b.stats(u).AD, ad * 1.15, '승리의 여세');
  near(u.hp, uh + (u.stats.HP - uh) * 0.1, '잃은 HP 10%');
  near(low.hp, lh + low.stats.HP * 0.12, '가장 낮은 아군 12%');
  b.time += 5.01;
  near(b.stats(u).AD, ad, '5초 뒤 끝');
});

test('G05·P05·G17: 아군 사망 시 중첩·능력치 이전·마지막 생존자(소환수·분신 제외)', () => {
  const b = fight(
    ['G05', 'P05', 'G17'],
    [
      { id: 'C03', pos: 38 },
      { id: 'C05', pos: 39 },
      { id: 'C09', pos: 52 },
    ],
  );
  const [x, near1, far] = [ally(b, 'C03'), ally(b, 'C05'), ally(b, 'C09')];
  const s = b.stats(x),
    before = b.stats(near1);
  b.kill(x, null);
  a.equal(b.augment.avenge, 1);
  // 가장 가까운 C05가 C03의 30%를 받음
  near(b.stats(near1).AD, before.AD * 1.08 + s.AD * 0.3);
  near(b.stats(near1).GD, before.GD + s.GD * 0.3);
  a(!b.augment.lastStandUsed);
  b.kill(near1, null);
  a.equal(b.augment.avenge, 2);
  a(b.augment.lastStandUsed, '마지막 1명');
  a(far.shields.some((sh) => Math.abs(sh.amount - far.stats.HP * 0.4) < 1e-6));
});

test('P16 왕 사망: 다른 아군이 최대 HP 20% 피해, HP 1 아래로는 안 내려감', () => {
  const b = fight(
    ['P16'],
    [
      { id: 'C24', pos: 38 },
      { id: 'C03', pos: 39 },
    ],
  );
  const king = ally(b, 'C24'),
    other = ally(b, 'C03');
  other.hp = other.stats.HP * 0.1;
  b.kill(king, null);
  a.equal(other.hp, 1);
  a(!other.dead);
});

test('G04 마력 폭주: 스킬마다 AP +8%, 최대 5중첩', () => {
  const b = fight(['G04'], [{ id: 'C03', pos: 38 }]);
  const u = ally(b, 'C03'),
    foe = b.units.find((v) => v.team === 'enemy');
  const ap = b.stats(u).AP;
  for (let i = 0; i < 7; i++) b.cast(u, foe);
  near(b.stats(u).AP, ap * 1.4);
});

// ─── 시작 단계: 희생·조합 단계·분신 ───
test('P18 희생의 의식: 코스트 최저 1명 희생, 나머지 AD·AP·HP +코스트×10%, 조합 다시 계산', () => {
  const allies = [
    { id: 'C01', pos: 38 },
    { id: 'C24', pos: 39 },
  ];
  const [x, y] = pair(['P18'], allies);
  a(!ally(y, 'C01'), '1코스트 희생');
  near(ally(y, 'C24').stats.AD, ally(x, 'C24').stats.AD * (1 + cost('C01') * 0.1));
  near(ally(y, 'C24').stats.HP, ally(x, 'C24').stats.HP * 1.1);
  a.equal(y.augment.sacrifice.id, 'C01');
  a(!y.synergySnapshot.ally.some((s) => s.members.includes('C01')));
  const solo = fight(['P18'], [{ id: 'C24', pos: 38 }]);
  a(ally(solo, 'C24') && !solo.augment.sacrifice, '혼자면 희생 없음');
});

test('P14 이중 조합: 활성 조합 하나의 단계 +1(인원 수는 그대로), 없으면 효과 없음', () => {
  const b = fight(
    ['P14'],
    [
      { id: 'C01', pos: 38 },
      { id: 'C28', pos: 39 },
    ],
  );
  const boosted = b.synergySnapshot.ally.find((s) => s.name === b.augment.boosted);
  a(boosted);
  a.equal(boosted.tier, 2);
  a.equal(boosted.count, 2, '인원 수 그대로');
  a.equal(boosted.threshold, boosted.thresholds[1]);
  const none = fight(['P14'], [{ id: 'C03', pos: 38 }]);
  a.equal(none.augment.boosted, null);
});

test('G18·P15 분신: 지정(없으면 최고 코스트) 원본의 HP·AD·AP 비율, 기본 공격만, 조합 제외', () => {
  const allies = [
    { id: 'C03', pos: 38, uid: 11 },
    { id: 'C24', pos: 39, uid: 12 },
  ];
  const b = fight(['G18'], allies, { cloneTarget: 11 });
  const c = b.units.find((u) => u.summonKind === 'clone');
  const orig = ally(b, 'C03');
  a.equal(c.id, 'C03', '지정한 동료');
  near(c.stats.HP, orig.stats.HP * 0.5);
  near(c.stats.AD, orig.stats.AD * 0.6);
  a.equal(c.owner, orig.uid);
  a(c.summon && c.mp === 0 && c.stats.MP === 0);
  a(c.expires > 1e8);
  a.equal(JSON.parse(JSON.stringify(b)).units.find((u) => u.summonKind === 'clone').expires, 1e9);
  a(
    !b.synergySnapshot.ally.some(
      (s) => s.count > 1 && s.members.filter((m) => m === 'C03').length > 1,
    ),
  );
  const auto = fight(['P15'], allies);
  const c2 = auto.units.find((u) => u.summonKind === 'clone');
  a.equal(c2.id, 'C24', '최고 코스트');
  near(c2.stats.HP, ally(auto, 'C24').stats.HP * 0.7);
});

// ─── 원정 효과 ───
test('S07·S08·S10·P07: 선택 즉시 골드·XP·1티어 아이템', () => {
  let s = run();
  a(choose(s, 'S07'));
  a.equal(s.gold, 28);
  s = run();
  choose(s, 'S08');
  const ref = run();
  P.addXp(ref, 10);
  a.deepEqual([s.level, s.xp], [ref.level, ref.xp]);
  s = run();
  choose(s, 'S10');
  a.equal(s.gold, 23);
  a.equal(s.inventory.length, 1);
  a.equal(I.byId(s.inventory[0].id).tier, 1);
  s = run();
  choose(s, 'P07');
  a.equal(s.gold, 45);
});

test('S18 위험한 계약: HP 10 소모·3코스트 2명, HP 10 이하면 선택 불가(원정 그대로)', () => {
  const s = run();
  a(choose(s, 'S18'));
  a.equal(s.health, 90);
  // 3코스트 동료 2명분(같은 캐릭터 2명이어도 합성은 3명부터)
  a.equal(
    s.units.filter((u) => cost(u.id) === 3).reduce((n, u) => n + 3 ** (u.star - 1), 0),
    2,
  );
  const low = run({ health: 10 });
  a(P.augmentBlock(low, 'S18'));
  const before = clone(low);
  low.augmentState.pendingPick = { node: '1-3', pick: 1, tier: 'silver', optionIds: ['S18'] };
  low.roundPhase = 'augment';
  a(!P.chooseAugment(low, 'S18'));
  a.equal(low.health, before.health);
});

test('P11 위험한 도박: 현재 HP 30%(내림) 소모·3티어 3개, HP 1 아래로 안 내려감', () => {
  let s = run({ health: 77 });
  a(choose(s, 'P11'));
  a.equal(s.health, 77 - 23);
  a.equal(s.inventory.length, 3);
  a(s.inventory.every((i) => I.byId(i.id).tier === 3));
  s = run({ health: 1 });
  a(choose(s, 'P11'));
  a.equal(s.health, 1);
  s = run({ health: 2 });
  choose(s, 'P11');
  a.equal(s.health, 2, '30% 내림 0');
});

test('P08 전설의 영입·G12 성장의 보상: 코스트별 동료, 레벨 상승마다 2·3코스트', () => {
  const s = run();
  choose(s, 'P08');
  const costs = s.units
    .slice(2)
    .map((u) => cost(u.id))
    .sort();
  a.deepEqual(costs, [4, 4, 5]);
  const g = run();
  choose(g, 'G12');
  const n = g.units.length;
  P.addXp(g, 50); // 여러 레벨 상승
  a(g.level > 4);
  a.equal(g.units.length - n, g.level - 3, '오른 레벨만큼');
  a(g.units.slice(n).every((u) => [2, 3].includes(cost(u.id))));
});

test('대기석이 가득 차면 지급 동료 대신 판매가만큼 골드', () => {
  const s = run();
  s.units.push(
    ...Array.from({ length: 10 }, (_, i) => ({
      uid: 100 + i,
      id: D.playableIds.filter((id) => cost(id) === 1)[i % 5],
      location: 'bench',
      pos: -1,
      star: 1,
      benchSlot: i,
    })),
  );
  // 같은 1코스트가 2명씩 있어 합성되지 않도록 서로 다른 5명 × 2 = 10명 → 3코스트 지급은 합성 불가
  const gold = s.gold;
  choose(s, 'S18');
  a.equal(s.units.length, 12, '대기석 10명 그대로');
  a.equal(s.gold, gold + 3 * 2, '3코스트 2명 → 6G');
  a(s.augmentRun.log.some((l) => l.includes('대기석이 가득 차')));
});

test('G09 가치 투자: 2코스트 2성 1명, 이후 라운드 시작마다 같은 동료(선택한 라운드 제외)', () => {
  const s = run({ stage: 1, round: 3 });
  a(choose(s, 'G09'));
  a(s.augmentRun.log[0].startsWith('1-3 '), '기록은 선택 시점 표기');
  const id = s.augmentRun.valueUnitId;
  a.equal(cost(id), 2);
  a(s.units.some((u) => u.id === id && u.star === 2));
  const count = () => s.units.filter((u) => u.id === id).reduce((n, u) => n + 3 ** (u.star - 1), 0);
  a.equal(count(), 3);
  settle(s, 'ally');
  P.advanceRound(s);
  a.equal(P.label(s), '1-4');
  a.equal(count(), 4, '다음 라운드 +1');
  P.migrate(s); // 같은 라운드 재처리 없음
  a.equal(count(), 4);
});

test('G07 황금의 흐름·P09 무한한 성장: 새 스테이지 진입 2G, 스테이지 5라운드 정산 3XP', () => {
  const s = run({ stage: 1, round: 5 });
  choose(s, 'G07', '1-3');
  choose(
    Object.assign(s, { augmentState: { ...s.augmentState, completedPicks: [] } }),
    'P09',
    '1-3',
  );
  Object.assign(s, { stage: 1, round: 5, wave: 5, roundPhase: 'combat' });
  const xpBefore = s.xp + s.level * 1000;
  const r = P.settleRound(s, { winner: 'ally', time: 10, allyLosses: 0 }, () => 0.9);
  a.equal(r.xpGained, 2 + 3);
  a(s.xp + s.level * 1000 > xpBefore);
  const gold = s.gold;
  P.advanceRound(s);
  a.equal(P.label(s), '2-1');
  a.equal(s.gold, gold + 2);
});

test('S11·G10·P12·S12·G11: 정산 때 증강 골드(완벽한 승리, 패배 보상, 복리, 지연 보상, 투자 반환)', () => {
  let s = run({ stage: 1, round: 3, wave: 3, augments: ['S11'] });
  let r = settle(s, 'ally', { allyLosses: 0 });
  a.equal(r.augmentParts.flawless, 2);
  s = run({ stage: 1, round: 3, wave: 3, augments: ['S11'] });
  r = settle(s, 'ally', { allyLosses: 1 });
  a.equal(r.augmentParts.flawless, undefined, '사망 1명');
  s = run({ stage: 1, round: 3, wave: 3, augments: ['G10'] });
  r = settle(s, 'enemy');
  a.equal(r.augmentParts.loss, 3);
  a.equal(s.augmentRun.freeRerolls, 1);
  s = run({ stage: 1, round: 3, wave: 3, gold: 90, augments: ['P12'] });
  r = settle(s, 'ally');
  a.equal(r.interest, 9, '이자 상한 10G');
  a.equal(r.augmentParts.compound, 5, '보유 골드 10% 최대 5G');
  // S12: 즉시 5G, 전투 4회 뒤 10G(보급 제외)
  s = run({ stage: 1, round: 3 });
  choose(s, 'S12', '1-3');
  a.equal(s.gold, 25);
  const got = [];
  for (let i = 0; i < 5; i++) {
    Object.assign(s, { stage: 2, round: 1 + (i % 2), wave: 6 + i });
    got.push(settle(s, 'ally').augmentParts.delayed || 0);
    s.completedRounds = {};
  }
  a.deepEqual(got, [0, 0, 0, 10, 0]);
  // G11: 보유 골드 절반 맡김, 전투 3회 뒤 2배
  s = run({ stage: 1, round: 3, gold: 31 });
  choose(s, 'G11', '1-3');
  a.equal(s.gold, 16);
  const back = [];
  for (let i = 0; i < 4; i++) {
    Object.assign(s, { stage: 2, round: 1, wave: 6 });
    back.push(settle(s, 'enemy').augmentParts.invest || 0);
    s.completedRounds = {};
  }
  a.deepEqual(back, [0, 0, 30, 0]);
  const zero = run({ gold: 0 });
  choose(zero, 'G11');
  a.equal(zero.augmentRun.invest[0].amount, 0, '0골드면 0G 맡김');
});

test('S09·G08·G10 새로고침 비용: 1G, 스테이지 첫 1회 무료, 쌓인 무료 우선', () => {
  const s = run({ stage: 2, round: 1, augments: ['S09', 'G08'] });
  a.equal(P.rerollCost(s), 0);
  const g = s.gold;
  a(V.manualReroll(s));
  a.equal(s.gold, g, '무료');
  a.equal(P.rerollCost(s), 1);
  a(V.manualReroll(s));
  a.equal(s.gold, g - 1);
  s.stage = 3;
  a.equal(P.rerollCost(s), 0, '다음 스테이지 다시 무료');
  const t = run({ augments: ['G10'] });
  t.augmentRun.freeRerolls = 2;
  V.manualReroll(t);
  V.manualReroll(t);
  a.equal(t.gold, 20);
  a.equal(P.rerollCost(t), 2);
});

test('P10 운명의 상점: 현재 레벨 최고 코스트가 상점에 항상 1명 이상', () => {
  for (const level of [3, 4, 6, 8, 10]) {
    const s = run({ level, augments: ['P10'] });
    const odds = V.shopOdds(s);
    const top = odds.reduce((t, p, i) => (p > 0 ? i + 1 : t), 0);
    for (let n = 0; n < 30; n++) {
      V.manualReroll(Object.assign(s, { gold: 99 }));
      a(
        s.shop.some((id) => id && cost(id) === top),
        `Lv${level}`,
      );
    }
  }
});

test('P13 초월의 군세: 배치 한도 +1(최대 11)', () => {
  const s = run({ level: 10, augments: ['P13'] });
  a.equal(P.capacity(s), 11);
  a.equal(P.capacity(run({ level: 5, augments: ['P13'] })), 6);
});

// ─── 저장·선택 규칙 ───
test('저장 복원: augmentRun(지연 보상·투자·무료 새로고침·가치 투자·분신 지정)이 그대로', () => {
  const s = run({ stage: 1, round: 3, gold: 40 });
  choose(s, 'G11', '1-3');
  s.augmentRun.freeRerolls = 2;
  s.augmentRun.cloneTarget = 1;
  const restored = P.migrate(JSON.parse(JSON.stringify(s)));
  a.deepEqual(restored.augmentRun, s.augmentRun);
  a.equal(restored.version, 4);
});

test('G13 쌍둥이 전술: 같은 캐릭터 정확히 2명이면 두 명 AD·AP·GD +25%, 1명·다른 캐릭터는 그대로', () => {
  const allies = [
    { id: 'C03', pos: 37 },
    { id: 'C03', pos: 38 },
    { id: 'C05', pos: 45 },
  ];
  const b = fight(['G13'], allies);
  const [base] = pair([], [allies[0], allies[2]]);
  const twins = b.units.filter((u) => u.team === 'ally' && u.id === 'C03');
  a.equal(twins.length, 2);
  for (const u of twins) {
    near(u.stats.AD, ally(base, 'C03').stats.AD * 1.25);
    near(u.stats.AP, ally(base, 'C03').stats.AP * 1.25);
    near(u.stats.GD, ally(base, 'C03').stats.GD * 1.25, 'GD도 배율(기본안: % = 곱하기)');
  }
  near(ally(b, 'C05').stats.AD, ally(base, 'C05').stats.AD);
  const solo = fight(['G13'], [allies[0], allies[2]]);
  near(ally(solo, 'C03').stats.AD, ally(base, 'C03').stats.AD, '1명이면 효과 없음');
  // 전투도 끝까지 돈다
  let r = null;
  for (let n = 0; n < 6000 && !r; n++) r = b.tick();
  a(r);
});

test('G13 예외: 증강이 있을 때만 같은 캐릭터를 전장에 2명까지, 3명은 안 됨(배치·전투 모두)', () => {
  const s = run();
  s.units.push({ uid: 3, id: 'C03', location: 'bench', pos: -1, star: 1, benchSlot: 0 });
  s.units.push({ uid: 4, id: 'C03', location: 'bench', pos: -1, star: 2, benchSlot: 1 });
  s.level = 6;
  s.roundPhase = 'prepare';
  const move = (uid, pos) => V.moveUnit(s, uid, { location: 'board', pos });
  a.deepEqual(move(3, 39), {
    ok: false,
    message: '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.',
  });
  a.throws(
    () =>
      fight(
        [],
        [
          { id: 'C03', pos: 37 },
          { id: 'C03', pos: 38 },
        ],
      ),
    /1명만/,
    'G13 없으면 전투도 거절',
  );
  s.augments = ['G13'];
  a(move(3, 39).ok, 'G13이 있으면 2명째 허용');
  a.deepEqual(move(4, 40), {
    ok: false,
    message: '쌍둥이 전술: 동일한 캐릭터는 전장에 2명까지 배치할 수 있습니다.',
  });
  a.throws(
    () =>
      fight(
        ['G13'],
        [
          { id: 'C03', pos: 37 },
          { id: 'C03', pos: 38 },
          { id: 'C03', pos: 39 },
        ],
      ),
    /2명까지/,
  );
  // 조합은 서로 다른 캐릭터만 센다(같은 캐릭터 2명이어도 1명분)
  const b = fight(
    ['G13'],
    [
      { id: 'C03', pos: 37 },
      { id: 'C03', pos: 38 },
    ],
  );
  for (const bond of b.synergySnapshot.ally.filter((x) => x.count)) a.equal(bond.count, 1);
});

test('1-3·3-3·5-3마다 등급 동일 확률, 같은 등급 후보 3개, 고른 ID 제외', () => {
  const rng = createRng(5);
  const tiers = { silver: 0, gold: 0, prism: 0 };
  for (let n = 0; n < 3000; n++) {
    const picked = [];
    for (let k = 0; k < 3; k++) {
      const d = A.draw(picked, rng);
      tiers[d.tier]++;
      a.equal(new Set(d.optionIds).size, 3);
      for (const id of d.optionIds) {
        const def = A.byId(id);
        a(def.tier === d.tier && !def.hold && !picked.includes(id));
      }
      picked.push(d.optionIds[0]);
    }
  }
  for (const n of Object.values(tiers)) a(Math.abs(n - 3000) < 200);
});

// ─── 상호작용·전체 실행 ───
test('상호작용: P01 불멸+P05 계승(실제 사망 때만 이전), G18 분신 사망은 S11 완벽한 승리를 깨지 않음, P14+P17', () => {
  const b = fight(
    ['P01', 'P05'],
    [
      { id: 'C03', pos: 38 },
      { id: 'C05', pos: 39 },
    ],
  );
  const [x, y] = [ally(b, 'C03'), ally(b, 'C05')];
  const foe = b.units.find((v) => v.team === 'enemy');
  x.hp = 5;
  b.deal(foe, x, 9999, 'magic', { kind: 'skill', canCrit: false });
  a(!x.dead && x.hp === 1, '불멸로 생존');
  a(!y.augmentState.flat, '아직 계승 없음');
  x.hp = 5;
  b.deal(foe, x, 9999, 'magic', { kind: 'skill', canCrit: false });
  a(x.dead);
  a(y.augmentState.flat?.AD > 0, '실제 사망 뒤 계승');
  const c = fight(['G18', 'S11'], [{ id: 'C03', pos: 38, uid: 1 }]);
  const cl = c.units.find((u) => u.summonKind === 'clone');
  c.kill(cl, foe);
  a.equal(c.units.filter((u) => u.team === 'ally' && !u.summon && u.dead).length, 0);
  const h = fight(
    ['P14', 'P17'],
    [
      { id: 'C01', pos: 38 },
      { id: 'C28', pos: 39 },
    ],
  );
  a.equal(
    h.synergySnapshot.ally.filter((s) => s.tier > 0).length,
    2,
    '단계만 오르고 활성 수는 그대로',
  );
  a.equal(h.augment.harmony, 0);
});

test('54종 각각·무작위 3개 조합으로 실제 전투가 끝까지 오류 없이 끝난다', () => {
  const rng = createRng(31);
  const all = A.augments.map((x) => x.id);
  for (let i = 0; i < all.length + 40; i++) {
    const ids =
      i < all.length
        ? [all[i]]
        : [...new Set(Array.from({ length: 3 }, () => all[Math.floor(rng() * all.length)]))];
    const b = new Battle(
      [
        { id: 'C01', pos: 38, uid: 1 },
        { id: 'C28', pos: 39, uid: 2 },
        { id: 'C24', pos: 45, uid: 3 },
        { id: 'C05', pos: 52, uid: 4 },
      ],
      [
        { id: 'E06', pos: 10, star: 2 },
        { id: 'E01', pos: 3, boss: true },
        { id: 'E03', pos: 17 },
      ],
      { seed: 100 + i, allyModifiers: { augmentIds: ids, cloneTarget: 1 } },
    );
    let n = 0;
    while (!b.result && n++ < 3000) b.tick();
    a(b.result, ids.join());
    for (const u of b.units) a(Number.isFinite(u.hp), ids.join());
  }
});

test('G09 가치 투자: 같은 동료가 이미 3성이면 1성 판매가만큼 골드', () => {
  const s = run({ stage: 1, round: 3 });
  choose(s, 'G09');
  const id = s.augmentRun.valueUnitId;
  s.units = s.units.filter((u) => u.id !== id);
  s.units.push({ uid: 50, id, location: 'bench', pos: -1, star: 3, benchSlot: 5 });
  settle(s, 'ally');
  const gold = s.gold;
  P.advanceRound(s);
  a.equal(s.gold, gold + cost(id), '1성 판매가 = 코스트');
  a(s.augmentRun.log.some((l) => l.includes('이미 3성')));
  a.equal(s.units.filter((u) => u.id === id).length, 1);
});
