// v0.19.0 메타 영구 강화 40종(요청서 8장 1~16). 수치는 data/meta-upgrades.js(테스트용 임시값)에서 읽는다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import M from '../../src/core/meta.ts';
import U from '../../src/core/meta-upgrades.ts';
import D from '../../src/core/data/units.js';
import P from '../../src/core/progression.js';
import W from '../../src/core/encounters.js';
import V from '../../src/core/preparation.js';
import Engine from '../../src/core/combat/battle.js';
import MF from '../../src/core/combat/meta-effects.js';
import { newRun, battleSetup } from '../../src/core/run.ts';
import { buyUnit, buyCost } from '../../src/core/shop.ts';
import { createStore } from '../../src/ui/store.ts';

const { Battle } = Engine;
const clone = (x) => JSON.parse(JSON.stringify(x));
const near = (x, y, msg = '') => a(Math.abs(x - y) < 1e-6, `${msg} ${x} != ${y}`);
const enemies = [
  { id: 'E06', pos: 30 },
  { id: 'E01', pos: 31 },
];
/** 무작위 0.99: 회피·치명타 없음. meta가 있으면 메타 강화 전투 */
function fight(meta, allies, opts = {}) {
  return new Battle(allies, opts.enemies ?? enemies, {
    rng: () => 0.99,
    allyModifiers: { augmentIds: [], cloneTarget: null, ...(meta ? { meta } : {}) },
  });
}
const allyOf = (b, id) => b.units.find((u) => u.team === 'ally' && u.id === id && !u.summon);
/** 아군 col 3(전열)에 C03, col 0(후열)에 C05 */
const crew = () => [
  { id: 'C03', pos: 27, star: 1 },
  { id: 'C05', pos: 24, star: 1 },
];
const meta = (levels, stage = 1) => ({ levels, stage });
/** 프로필 레벨을 L로 올린 상태(보상 원장 적용) */
function profileAt(level) {
  const p = M.newProfile();
  M.addXp(p, M.cumulativeXp(level));
  U.syncLevelRewards(p);
  return p;
}

// ─── 메타 재화 ───
test('1. 레벨 보상: 1→2 +2P/+2장, 4→5 +2P/+4장, 9→10 +2P/+4장', () => {
  a.deepEqual(U.levelReward(2), { points: 2, tickets: 2 });
  a.deepEqual(U.levelReward(5), { points: 2, tickets: 4 }, '5의 배수는 6장이 아니라 4장');
  a.deepEqual(U.levelReward(10), { points: 2, tickets: 4 });
  const p = profileAt(4);
  const before = { p: p.growthPoints, t: p.tickets };
  M.addXp(p, M.requiredXp(4));
  a.equal(p.metaLevel, 5);
  a.deepEqual(U.syncLevelRewards(p), { points: 2, tickets: 4 });
  a.deepEqual([p.growthPoints - before.p, p.tickets - before.t], [2, 4]);
});

test('2. 여러 레벨을 한 번에: 1→7 +12P/+14장, 1→100 198P/238장(= 40종 전체 비용)', () => {
  a.deepEqual(U.cumulativeReward(7), { points: 12, tickets: 14 });
  a.deepEqual(U.cumulativeReward(100), { points: 198, tickets: 238 });
  a.equal(U.totalCost, 198);
  // 원정 종료 정산 한 번에 Lv.1 → Lv.7
  const p = M.newProfile();
  const run = { runId: 'r1', done: true, completedRounds: {} };
  for (let s = 1; s <= 6; s++)
    for (let r = 1; r <= 5; r++)
      run.completedRounds[`${s}-${r}`] = { stage: s, round: r, win: true };
  const pay = M.settleRun(p, run);
  a.equal(pay.after.level, 7);
  a.deepEqual(pay.rewards, { points: 12, tickets: 14 });
  a.deepEqual([p.growthPoints, p.tickets], [12, 14]);
});

test('3. Lv.100 뒤에는 보상 없음', () => {
  const p = profileAt(100);
  a.deepEqual([p.growthPoints, p.tickets], [198, 238]);
  M.addXp(p, 99999);
  a.deepEqual(U.syncLevelRewards(p), { points: 0, tickets: 0 });
  a.deepEqual([p.growthPoints, p.tickets], [198, 238]);
});

test('4. 예전 프로필 Lv.24 소급: 46P/54장 한 번, 다시 읽어도 중복 없음, 레벨·XP 보존', () => {
  const old = {
    version: 1,
    metaLevel: 24,
    metaXp: 7,
    totalXp: 999,
    growthEnabled: false,
    payments: [],
  };
  const p = M.normalizeProfile(clone(old));
  a.deepEqual([p.metaLevel, p.metaXp, p.growthPoints, p.tickets], [24, 7, 46, 54]);
  a.deepEqual(p.rewards, { level: 24, points: 46, tickets: 54 });
  const again = M.normalizeProfile(clone(p));
  a.deepEqual([again.growthPoints, again.tickets], [46, 54], '재접속 중복 없음');
  // 일부 사용 뒤에도 사용 + 보유 = 획득
  U.buy(again, 'A1');
  U.buy(again, 'A1');
  const third = M.normalizeProfile(clone(again));
  a.deepEqual([third.growthPoints, U.usedPoints(third), third.rewards.points], [44, 2, 46]);
  // 이상한 값(보유 P 부풀림)은 원장 기준으로 고치고 기록을 남긴다(강화 단계는 지우지 않음)
  const broken = M.normalizeProfile({ ...clone(third), growthPoints: 999 });
  a.equal(broken.growthPoints, 44);
  a.equal(broken.upgrades.A1, 2);
  a(broken.repairs.some((x) => x.includes('성장 포인트')));
});

test('5. 전부 MAX: 198P 모두 사용, 잔여 0, 더 살 수 없음', () => {
  const p = profileAt(100);
  for (const u of U.upgrades) for (let i = 0; i < u.max; i++) a(U.buy(p, u.id), u.id);
  a.equal(p.growthPoints, 0);
  a.equal(U.usedPoints(p), 198);
  for (const u of U.upgrades) a.equal(U.buyBlock(p, u.id), 'max');
  a.equal(
    U.upgrades
      .filter((u) => u.max === 4)
      .map((u) => u.id)
      .join(),
    'E8,S8',
  );
});

// ─── UI·입력(저장소) ───
test('6. 계열마다 8종, 해금 Lv.1·1·1·10·20·35·50·70, 잠금·자원 부족·MAX', () => {
  for (const b of U.branches) {
    const list = U.upgrades.filter((u) => u.branch === b.id);
    a.equal(list.length, 8, b.name);
    a.deepEqual(
      list.map((u) => u.unlock),
      [1, 1, 1, 10, 20, 35, 50, 70],
    );
  }
  const p = profileAt(9);
  a.equal(U.buyBlock(p, 'A4'), 'locked');
  a.equal(U.buyBlock(p, 'A1'), null);
  p.growthPoints = 0;
  a.equal(U.buyBlock(p, 'A1'), 'points');
  a.equal(U.buy(p, 'A1'), false);
});

function storeWith(profile, now = { t: 0 }) {
  const data = new Map([[M.META_KEY, JSON.stringify(profile)]]);
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 5,
    now: () => new Date(now.t),
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  return { store, s: () => store.getState(), data, now };
}

test('7. 노드 누르기만으로는 포인트를 쓰지 않고, 강화 버튼 연타는 한 번만 산다', () => {
  const { store, s, data, now } = storeWith(profileAt(10));
  store.actions.showAbilities();
  store.actions.pickBranch('D');
  store.actions.pickNode('D2');
  a.equal(s().meta.growthPoints, 18);
  a.equal(s().abilities.node, 'D2');
  a.equal(store.actions.buyUpgrade('D2'), true);
  a.equal(store.actions.buyUpgrade('D2'), false, '연타 무시');
  a.equal(s().meta.upgrades.D2, 1);
  a.equal(s().meta.growthPoints, 17);
  now.t += 400;
  a.equal(store.actions.buyUpgrade('D2'), true, '잠시 뒤에는 다시 살 수 있음');
  a.equal(JSON.parse(data.get(M.META_KEY)).upgrades.D2, 2, '바로 저장');
  // 새로 열어도 유지
  a.equal(storeWith(JSON.parse(data.get(M.META_KEY))).s().meta.upgrades.D2, 2);
});

test('7b. 예전 프로필을 열면 소급 지급 뒤 바로 저장해 다시 열어도 같은 값', () => {
  const old = {
    version: 1,
    metaLevel: 24,
    metaXp: 0,
    totalXp: 0,
    growthEnabled: false,
    payments: [],
  };
  const first = storeWith(old);
  a.deepEqual([first.s().meta.growthPoints, first.s().meta.tickets], [46, 54]);
  const saved = JSON.parse(first.data.get(M.META_KEY));
  a.equal(saved.rewards.level, 24);
  const second = storeWith(saved);
  a.deepEqual([second.s().meta.growthPoints, second.s().meta.tickets], [46, 54]);
});

// ─── 전투 ───
test('10. A1·A2: AD·AP +15%, A7 주는 피해 +10%(물리·마법 각각 한 번), A8은 보스에게만', () => {
  const plain = fight(null, crew());
  const strong = fight(meta({ A1: 5, A2: 5, A7: 5, A8: 5 }), crew());
  const p = allyOf(plain, 'C03'),
    s = allyOf(strong, 'C03');
  near(s.stats.AD, p.stats.AD * 1.15, 'AD');
  near(s.stats.AP, p.stats.AP * 1.15, 'AP');
  near(s.stats.HP, p.stats.HP, 'HP는 그대로');
  for (const type of ['physical', 'magic']) {
    const t1 = plain.units.find((u) => u.id === 'E06'),
      t2 = strong.units.find((u) => u.id === 'E06');
    const d1 = plain.deal(p, t1, 100, type, { kind: 'dot', canCrit: false }).damage;
    const d2 = strong.deal(s, t2, 100, type, { kind: 'dot', canCrit: false }).damage;
    near(d2 / d1, 1.1, type);
  }
  // 보스 대상
  const bossEnemies = [{ id: 'E06', pos: 30, boss: true }];
  const bp = fight(null, crew(), { enemies: bossEnemies }),
    bs = fight(meta({ A7: 5, A8: 5 }), crew(), { enemies: bossEnemies });
  const db1 = bp.deal(
    allyOf(bp, 'C03'),
    bp.units.find((u) => u.boss),
    100,
    'physical',
    { kind: 'dot' },
  ).damage;
  const db2 = bs.deal(
    allyOf(bs, 'C03'),
    bs.units.find((u) => u.boss),
    100,
    'physical',
    { kind: 'dot' },
  ).damage;
  near(db2 / db1, 1.25, '보스: 주는 피해 10% + 보스 15%');
});

test('10b. A3·A4·A5·A6·D2·D3·S7: AS +15%, CTC +7.5%p, CTH +20%p, MP 획득 +15%(최대 MP 그대로), GD·DOD 고정값', () => {
  const p = fight(null, crew()),
    s = fight(meta({ A3: 5, A4: 5, A5: 5, A6: 5, D2: 5, D3: 5, S7: 5 }), crew());
  const x = allyOf(p, 'C03'),
    y = allyOf(s, 'C03');
  near(y.stats.AS, x.stats.AS * 1.15);
  near(y.stats.CTC, x.stats.CTC + 7.5);
  near(y.stats.CTH, x.stats.CTH + 20);
  near(y.stats.DOD, x.stats.DOD + 5);
  near(y.stats.GD, x.stats.GD + 15 + 10);
  near(y.manaGain, x.manaGain * 1.15);
  a.equal(y.stats.MP, x.stats.MP);
});

test('11. D1·D6(전열 col 2~3)·D7(후열 col 0~1)·D5·D4·D8, 판정은 전투 시작 배치로 고정', () => {
  const p = fight(null, crew()),
    s = fight(meta({ D1: 5, D6: 5, D5: 5, D7: 5, D4: 5, D8: 5 }), crew());
  const front = allyOf(s, 'C03'),
    back = allyOf(s, 'C05');
  a.deepEqual(
    [MF.lineOf(27), MF.lineOf(26), MF.lineOf(25), MF.lineOf(24)],
    ['front', 'front', 'back', 'back'],
  );
  a.deepEqual([front.metaLine, back.metaLine], ['front', 'back']);
  near(front.stats.HP, allyOf(p, 'C03').stats.HP * (1 + 0.2 + 0.15), '전열: D1 + D6 합산');
  near(back.stats.HP, allyOf(p, 'C05').stats.HP * 1.2, '후열: D1만');
  // D8 보호막 = 최대 HP의 10%
  near(front.shields[0].amount, front.stats.HP * 0.1);
  // 받는 피해: 전열 −10%, 후열 −(10 + 7.5)%. 이동해도 분류는 그대로
  const foe = s.units.find((u) => u.id === 'E06');
  front.shields = [];
  back.shields = [];
  back.pos = 27; // 이동
  const pf = allyOf(p, 'C03'),
    pb = allyOf(p, 'C05'),
    pfoe = p.units.find((u) => u.id === 'E06');
  const r1 =
    s.deal(foe, front, 100, 'physical', { kind: 'dot' }).damage /
    p.deal(pfoe, pf, 100, 'physical', { kind: 'dot' }).damage;
  const r2 =
    s.deal(foe, back, 100, 'magic', { kind: 'dot' }).damage /
    p.deal(pfoe, pb, 100, 'magic', { kind: 'dot' }).damage;
  near(r1, 0.9);
  near(r2, 0.825);
  // D4 받는 회복 +20%(아군 캐릭터만)
  front.hp -= 500;
  pf.hp -= 500;
  near(s.heal(front, 100, front) / p.heal(pf, 100, pf), 1.2);
});

test('11b. G6 활성 조합 종류 수 × 0.5%/단계, G7 전열·후열 모두 있을 때만 GD, G8은 4라운드부터 AD·AP', () => {
  const lv = { G6: 5, G7: 5, G8: 5 };
  const s = fight(meta(lv, 3), crew()),
    p = fight(null, crew());
  const bonds = s.synergySnapshot.ally.filter((x) => x.tier > 0).length;
  near(
    allyOf(s, 'C03').stats.HP,
    allyOf(p, 'C03').stats.HP * (1 + 0.025 * bonds),
    `조합 ${bonds}종`,
  );
  near(allyOf(s, 'C03').stats.GD, allyOf(p, 'C03').stats.GD + 5, '전열·후열 모두');
  near(allyOf(s, 'C03').stats.AD, allyOf(p, 'C03').stats.AD, '3라운드: G8 없음');
  const oneLine = [{ id: 'C03', pos: 27, star: 1 }];
  near(
    allyOf(fight(meta(lv), oneLine), 'C03').stats.GD,
    allyOf(fight(null, oneLine), 'C03').stats.GD,
    '한쪽 줄만: G7 없음',
  );
  const late = fight(meta(lv, 4), crew());
  near(allyOf(late, 'C03').stats.AD, allyOf(p, 'C03').stats.AD * 1.15, '4라운드부터');
  near(
    allyOf(fight(meta(lv, 9), crew()), 'C03').stats.AP,
    allyOf(p, 'C03').stats.AP * 1.15,
    '무한 라운드',
  );
});

test('15. 소환수는 전체 아군 능력치를 한 번만, 적에게는 적용하지 않음, 전투마다 새로 계산(누적 없음)', () => {
  const lv = { A1: 5, D1: 5, D2: 5 };
  const s = fight(meta(lv), crew()),
    p = fight(null, crew());
  const owner = allyOf(s, 'C03');
  const pet = s.summon(owner, 'specter');
  const plainPet = p.summon(allyOf(p, 'C03'), 'specter');
  a(pet && plainPet, '소환수 생성');
  near(pet.stats.HP, plainPet.stats.HP * 1.2, '소환수 HP');
  near(pet.stats.GD, plainPet.stats.GD + 15, '소환수 GD');
  near(pet.stats.AD, plainPet.stats.AD * 1.15, '소환수 AD');
  near(
    s.units.find((u) => u.id === 'E06').stats.AD,
    p.units.find((u) => u.id === 'E06').stats.AD,
    '적은 그대로',
  );
  // 같은 편성으로 두 번 싸워도 같은 값(전투마다 원본에서 다시 계산)
  near(allyOf(fight(meta(lv), crew()), 'C03').stats.AD, owner.stats.AD);
});

// ─── 원정(경제·성장·특수) ───
function battleRun(levels, extra = {}) {
  const s = newRun({ seed: 7, difficulty: 1, runId: 'm', metaLevels: levels });
  Object.assign(s, { stage: 1, round: 3, roundPhase: 'combat', gold: 0 }, extra);
  return s;
}
const settle = (s, win, rng) =>
  P.settleRound(s, { winner: win ? 'ally' : 'enemy', survivingEnemies: 1 }, rng);

test('12. G1 시작 XP(기존 레벨업 규칙), G2·G3 일반 전투 XP(첫 n번), 메타 XP 계산과 분리', () => {
  const base = newRun({ seed: 7, difficulty: 1, runId: 'b' });
  const g1 = newRun({ seed: 7, difficulty: 1, runId: 'b', metaLevels: { G1: 5 } });
  const expect = clone(base);
  P.addXp(expect, 10);
  a.deepEqual([g1.level, g1.xp], [expect.level, expect.xp], '시작 XP +10');
  const s = battleRun({ G2: 2, G3: 1 });
  const r1 = settle(s, true);
  a.equal(r1.metaXp, 1);
  a.equal(r1.xpGained, P.config.level.roundXp + 1);
  Object.assign(s, { round: 4, roundPhase: 'combat' });
  a.equal(settle(s, false).metaXp, 1, 'G3');
  Object.assign(s, { stage: 2, round: 1, roundPhase: 'combat' });
  a.equal(settle(s, true).metaXp, 1, 'G2 두 번째');
  Object.assign(s, { stage: 2, round: 2, roundPhase: 'combat' });
  a.equal(settle(s, true).metaXp, undefined, 'G2 횟수 소진');
  // 메타 XP는 완료 스테이지만 본다(인게임 XP·강화와 무관)
  const plain = battleRun({});
  for (const [st, rd, w] of [
    [1, 3, true],
    [1, 4, false],
    [2, 1, true],
    [2, 2, true],
  ]) {
    Object.assign(plain, { stage: st, round: rd, roundPhase: 'combat' });
    settle(plain, w);
  }
  a.equal(M.runReward(s).xp, M.runReward(plain).xp);
});

test('12b. G4 XP 구매 +1 추가(첫 n번), G5 새 라운드(2-1부터) 시작 XP +1(첫 n번, 같은 라운드 두 번 없음)', () => {
  const s = battleRun({ G4: 1 }, { roundPhase: 'prepare', gold: 20, level: 3, xp: 0 });
  P.buyXp(s);
  a.deepEqual([s.level, s.xp], [3, 5], '4 + 1');
  P.buyXp(s);
  a.deepEqual([s.level, s.xp], [4, 3], '두 번째는 4만(6 필요 → 레벨업 뒤 3)');
  const toRound2 = (levels) => {
    const t = battleRun(levels, { stage: 1, round: 5, roundPhase: 'result', level: 3, xp: 0 });
    t.completedRounds['1-5'] = { win: true };
    t.augmentState.completedPicks = ['1-3'];
    P.advanceRound(t);
    return t;
  };
  const with5 = toRound2({ G5: 2 }),
    without = toRound2({});
  a.equal(P.label(with5), '2-1');
  a.equal(with5.xp - without.xp, 1);
  a.equal(with5.metaRun.used.G5, 1);
  // 같은 라운드에 다시 라운드 시작 처리를 해도 더 주지 않음
});

test('13. E1 시작 골드, E2·E3·E6·E7·E8 추가 골드(첫 n번), 정산을 다시 불러도 중복 없음, 저장 복원 유지', () => {
  a.equal(
    newRun({ seed: 7, difficulty: 1, runId: 'x', metaLevels: { E1: 5 } }).gold,
    newRun({ seed: 7, difficulty: 1, runId: 'x' }).gold + 5,
  );
  const s = battleRun({ E2: 1, E3: 1, E7: 1, E8: 1 }, { gold: 30 });
  const r = settle(s, true);
  a.deepEqual(r.metaParts, { E2: 1, E8: 1 });
  a.equal(settle(s, true), r, '같은 라운드 다시 정산해도 같은 영수증(중복 없음)');
  const restored = clone(s); // 저장·이어하기
  Object.assign(restored, { round: 4, roundPhase: 'combat', gold: 30 });
  const r2 = settle(restored, true);
  a.equal(r2.metaParts, undefined, 'E2·E8 1회 소진(복원 뒤에도)');
  Object.assign(restored, { round: 5, roundPhase: 'combat', gold: 0 });
  a.deepEqual(settle(restored, true).metaParts, { E7: 1 }, '보스 승리');
  const lose = battleRun({ E3: 1 });
  a.deepEqual(settle(lose, false).metaParts, { E3: 1 });
  // E6 보급
  const sup = newRun({ seed: 7, difficulty: 1, runId: 'y', metaLevels: { E6: 1 } });
  P.beginSupply(sup);
  P.toggleSupply(sup, 0);
  P.toggleSupply(sup, 1);
  const rs = P.confirmSupply(sup);
  a.equal(rs.metaParts.E6, 1);
});

test('13b. E4 무료 새로고침(원정당 n회 뒤 골드), E5 구매 할인(실제 구매 때만 횟수 사용)', () => {
  const s = battleRun({ E4: 2, E5: 1 }, { roundPhase: 'prepare', gold: 10 });
  a.equal(P.rerollCost(s), 0);
  V.manualReroll(s);
  V.manualReroll(s);
  a.equal(s.gold, 10, '무료 2회');
  a.equal(P.rerollCost(s), 2);
  V.manualReroll(s);
  a.equal(s.gold, 8);
  // 할인: 골드 부족으로 실패하면 횟수 그대로
  s.gold = 0;
  s.shop = ['C03', 'C01', null, null, null];
  a.equal(buyCost(s, 'C03'), D.byId('C03').cost - 1);
  a.equal(buyUnit(s, 'C03', { uid: 90, slot: 0 }).ok, D.byId('C03').cost - 1 <= 0);
  s.gold = 5;
  const before = s.metaRun.used.E5 || 0;
  const ok = buyUnit(s, 'C01', { uid: 91, slot: 1 });
  a.equal(ok.ok, true);
  a.equal(s.metaRun.used.E5, Math.min(1, before + 1));
  a.equal(buyCost(s, 'C01'), D.byId('C01').cost, '할인 소진');
});

test('14. S1 시작 HP·상한, S2 일반 승리 회복(상한 적용, 보스 제외), S8 패배 손실 −1(첫 n번)', () => {
  const s = newRun({ seed: 7, difficulty: 1, runId: 'h', metaLevels: { S1: 5, S2: 5, S8: 1 } });
  a.deepEqual([s.health, s.maxHealth], [110, 110]);
  W.ensureRunDefaults(s); // 전투 편성·저장 불러오기 때마다 불리지만 상한은 그대로(브라우저에서 찾은 버그의 회귀 테스트)
  a.equal(s.maxHealth, 110);
  Object.assign(s, { stage: 1, round: 3, roundPhase: 'combat', health: 100 });
  const win = settle(s, true);
  a.equal(win.healing, P.config.rewards.winHealth + 5);
  Object.assign(s, { round: 4, roundPhase: 'combat', health: 108 });
  a.equal(settle(s, true).health, 110, '상한 110');
  Object.assign(s, { round: 5, roundPhase: 'combat', health: 100 });
  a.equal(settle(s, true).healing, P.config.rewards.winHealth, '보스 승리는 S2 없음');
  Object.assign(s, { stage: 2, round: 1, roundPhase: 'combat', health: 100 });
  const l1 = settle(s, false);
  a.equal(l1.insured, 1);
  a.equal(100 - l1.health, l1.loss);
  Object.assign(s, { stage: 2, round: 2, roundPhase: 'combat', health: 100 });
  a.equal(settle(s, false).insured, undefined, '첫 1번만');
  // 강화 없는 원정은 상한 100 그대로
  const plain = newRun({ seed: 7, difficulty: 1, runId: 'p' });
  a.deepEqual([plain.health, plain.maxHealth], [100, 100]);
});

test('14b. S3 장비 수치 보너스 +10%(고유 효과 제외), S4 보급 추가 골드 확률(통계), S5 상점 확률 합 100', () => {
  const s = battleRun({ S3: 5 }, { roundPhase: 'prepare' });
  for (const id of ['IB01', 'IB05']) P.equip(s, P.addItem(s, id).uid, s.units[0].uid);
  const plain = clone(s);
  plain.metaRun.levels = {};
  const b1 = P.unitBonuses(plain, s.units[0].uid),
    b2 = P.unitBonuses(s, s.units[0].uid);
  for (const k of Object.keys(b1))
    near(b2[k], k === 'ASMultiplier' ? 1 + (b1[k] - 1) * 1.1 : b1[k] * 1.1, k);
  // S4: 10% 확률, 2000번 보급 시뮬레이션(독립 난수)
  let hits = 0;
  let seed = 1;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) {
    const t = newRun({ seed: 7, difficulty: 1, runId: 'q', metaLevels: { S4: 5 } });
    P.beginSupply(t, rng);
    P.toggleSupply(t, 0);
    P.toggleSupply(t, 1);
    if (P.confirmSupply(t, rng).metaParts?.S4) hits++;
  }
  a(hits > 150 && hits < 250, `S4 약 10%: ${hits}/2000`);
  // S5: 4~5코스트가 나오는 레벨에서만 +2.5%p, 합 100, 음수 없음
  for (let level = 1; level <= 10; level++) {
    const t = battleRun({ S5: 5 }, { level });
    const base = clone(t);
    base.metaRun.levels = {};
    const o1 = V.shopOdds(base),
      o2 = V.shopOdds(t);
    near(
      o2.reduce((n, v) => n + v, 0),
      100,
      `Lv.${level} 합`,
    );
    a(o2.every((v) => v >= 0));
    const high = (o) => o[3] + o[4];
    if (high(o1) > 0) near(high(o2) - high(o1), 2.5, `Lv.${level} +2.5%p`);
    else a.deepEqual(o2, o1, `Lv.${level}: 4~5코스트 없음 → 그대로`);
  }
});

test('16. 강화가 없으면 원정·전투 입력이 예전과 같다(회귀)', () => {
  const a1 = newRun({ seed: 9, difficulty: 2, runId: 'z' });
  const a2 = newRun({ seed: 9, difficulty: 2, runId: 'z', metaLevels: {} });
  delete a2.metaRun;
  a.deepEqual(a2, a1);
  const s = newRun({ seed: 9, difficulty: 2, runId: 'z', metaLevels: {} });
  s.units[0].location = 'board';
  s.units[0].pos = 26;
  Object.assign(s, { stage: 1, round: 3 });
  a.equal('meta' in battleSetup(s).options.allyModifiers, false);
  a.equal(V.shopOdds(s).join(), V.shopOdds({ ...s, metaRun: null }).join());
});

test('원정 도중 산 강화는 진행 중 원정에 적용되지 않고 다음 원정부터', () => {
  const { store, s, now } = storeWith(profileAt(5));
  store.actions.startRun();
  const goldBefore = s().run.gold;
  now.t += 1000;
  store.actions.buyUpgrade('E1');
  a.equal(s().run.metaRun.levels.E1 ?? 0, 0, '진행 중 원정은 그대로');
  a.equal(s().run.gold, goldBefore);
  store.actions.startRun();
  a.equal(s().run.metaRun.levels.E1, 1);
  a.equal(s().run.gold, goldBefore + 1);
});
