// v0.17.2 메타 레벨 1~100(요청서 6장 필수 자동 테스트 1~11). 수치는 data/meta.js(임시값).
import { test } from 'vitest';
import a from 'node:assert/strict';
import M from '../../src/core/meta.ts';
import P from '../../src/core/progression.js';
import A from '../../src/core/augments.js';
import { newRun } from '../../src/core/run.ts';
import { createStore } from '../../src/ui/store.ts';

const clone = (x) => JSON.parse(JSON.stringify(x));
const level = (xp, from = M.newProfile()) => {
  const p = clone(from);
  M.addXp(p, xp);
  return [p.metaLevel, p.metaXp, M.requiredXp(p.metaLevel)];
};

/**
 * core 함수로 원정을 진행한다(전투 결과를 정해서 정산). lose: 지는 노드 목록, end: 그 노드에서 지며 HP 0
 * 6-5까지 이기면 completion을 정한다('end' 또는 'continue'). 증강은 첫 후보를 고른다.
 */
function play({ lose = [], end = null, completion = 'end', endless = 0, stop = null } = {}) {
  const s = newRun({ seed: 5, difficulty: 1, runId: 'run-test' });
  let guard = 0,
    endlessFights = 0;
  while (!s.done && guard++ < 200) {
    if (s.roundPhase === 'augment') {
      a(P.chooseAugment(s, P.availableAugments(s)[0].id, () => 0.5));
      continue;
    }
    const key = P.label(s);
    if (key === stop) break; // 그 노드를 시작하기 전(준비 단계)에 멈춤
    if (P.roundType(s.stage, s.round) === 'SUPPLY') {
      P.beginSupply(s, () => 0.1);
      P.toggleSupply(s, 0);
      P.toggleSupply(s, 1);
      P.confirmSupply(s, () => 0.1);
    } else {
      // 무한 라운드(7-1~)는 endless번 이긴 뒤 다음 전투에서 HP 0으로 끝낸다
      const endlessLoss = s.stage >= 7 && endlessFights++ >= endless;
      if (key === end || endlessLoss) s.health = 1;
      s.roundPhase = 'combat';
      const win = key !== end && !endlessLoss && !lose.includes(key);
      P.settleRound(s, { winner: win ? 'ally' : 'enemy', time: 10, allyLosses: 0 }, () => 0.9);
    }
    if (s.done) break;
    if (s.completionChoice === 'pending') {
      if (completion === null) break; // 종료/계속 선택 전에 멈춤
      a(P.chooseCompletion(s, completion));
      if (completion === 'end') break;
    }
    a(P.advanceRound(s), key);
  }
  return s;
}

test('1. 필요 XP: Lv.1~99 모두 양수, 구간 경계(10→11, 25→26, 50→51, 75→76)에서 증가, Lv.100은 0', () => {
  for (let l = 1; l <= 99; l++) a(M.requiredXp(l) > 0, `Lv.${l}`);
  for (let l = 1; l < 99; l++) a(M.requiredXp(l + 1) > M.requiredXp(l), `Lv.${l}→${l + 1}`);
  a.deepEqual(
    [10, 11, 25, 26, 50, 51, 75, 76, 99].map(M.requiredXp),
    [26, 28, 84, 92, 284, 300, 588, 620, 1080],
  );
  a.equal(M.requiredXp(100), 0);
});

test('2. 누적 필요 XP 표가 모두 맞다', () => {
  const table = {
    2: 8,
    5: 44,
    7: 78,
    10: 144,
    11: 170,
    25: 926,
    26: 1010,
    50: 5426,
    51: 5710,
    75: 16222,
    76: 16810,
    100: 37210,
  };
  for (const [l, xp] of Object.entries(table)) a.equal(M.cumulativeXp(Number(l)), xp, `Lv.${l}`);
});

test('3~5. Lv.1에서 9 XP → Lv.2 1/10, 13 XP → Lv.2 5/10, 80 XP → Lv.7 2/20', () => {
  a.deepEqual(level(9), [2, 1, 10]);
  a.deepEqual(level(13), [2, 5, 10]);
  a.deepEqual(level(80), [7, 2, 20]);
  a.equal(M.progressLabel(7, 2), '2 / 20 XP');
});

test('6. 정확히 채움·1 부족·초과 레벨업, 여러 레벨 한 번에, 누적 XP 기록', () => {
  a.deepEqual(level(8), [2, 0, 10], '정확히 8');
  a.deepEqual(level(7), [1, 7, 8], '1 부족');
  a.deepEqual(level(19), [3, 1, 12], '초과는 이월(8 + 10 + 1)');
  const p = M.newProfile();
  const r = M.addXp(p, 144);
  a.deepEqual(r, { before: { level: 1, xp: 0 }, after: { level: 10, xp: 0 } });
  a.equal(p.totalXp, 144);
  a.deepEqual(level(0), [1, 0, 8], '0 XP는 그대로');
});

test('7. Lv.99 → Lv.100, Lv.100 이후 XP를 더 쌓지 않고 MAX로 표시', () => {
  const p = M.newProfile();
  M.addXp(p, M.cumulativeXp(99) + 1079);
  a.deepEqual([p.metaLevel, p.metaXp], [99, 1079]);
  M.addXp(p, 1);
  a.deepEqual([p.metaLevel, p.metaXp], [100, 0]);
  a.equal(p.totalXp, 37210);
  const r = M.addXp(p, 5000);
  a.deepEqual(r.after, { level: 100, xp: 0 });
  a.equal(p.totalXp, 37210, '누적도 멈춤');
  a.equal(M.progressLabel(100, 0), 'MAX');
  // 한 번에 크게 넘쳐도 100에서 멈춘다(무한 반복 없음)
  const q = M.newProfile();
  M.addXp(q, 10 ** 9);
  a.deepEqual([q.metaLevel, q.metaXp, q.totalXp], [100, 0, 37210]);
  // 저장에서 잘못된 값을 읽어도 범위 안으로
  const n = M.normalizeProfile({ metaLevel: 100, metaXp: 50 });
  a.deepEqual([n.metaLevel, n.metaXp], [100, 0]);
  a.deepEqual(M.normalizeProfile({ metaLevel: 0, metaXp: -3 }).metaLevel, 1);
});

test('9. 원정 보상: 보급 포함·패배 제외, 요청서 표의 종료 사례', () => {
  const cases = [
    ['1-3', 2, 9],
    ['1-5', 4, 13],
    ['2-5', 9, 23],
    ['3-5', 14, 33],
    ['4-5', 19, 43],
    ['5-5', 24, 53],
  ];
  for (const [end, stages, xp] of cases) {
    const s = play({ end });
    a(s.done && s.health === 0, end);
    a.equal(P.label(s), end);
    const r = M.runReward(s);
    a.deepEqual([r.stages, r.xp, r.cleared], [stages, xp, false], end);
  }
  // 살아남은 패배(2-2)도 완료로 세지 않는다
  const mid = play({ lose: ['2-2'], end: '2-5' });
  a.deepEqual([M.runReward(mid).stages, M.runReward(mid).xp], [8, 21]);
  // 6-5에서 패배해 탈락: 29스테이지, 클리어 보너스 없음
  const last = play({ end: '6-5' });
  a.deepEqual([M.runReward(last).stages, M.runReward(last).xp], [29, 63]);
});

test('8. 6-5 클리어 80 XP: 종료·무한 라운드 진입 후 종료 모두 80, 같은 원정은 한 번만', () => {
  const ended = play({ completion: 'end' });
  a(ended.done && ended.roundPhase === 'complete');
  a.deepEqual(M.runReward(ended), {
    stages: 30,
    cleared: true,
    base: 5,
    stageXp: 60,
    clearXp: 15,
    xp: 80,
  });
  const endless = play({ completion: 'continue', endless: 6 });
  a(endless.done && endless.stage >= 7, '무한 라운드에서 종료');
  a(Object.keys(endless.completedRounds).some((k) => Number(k.split('-')[0]) >= 7));
  a.equal(M.runReward(endless).xp, 80, '무한 라운드 추가 XP 0');
  const p = M.newProfile();
  const pay = M.settleRun(p, endless);
  a.deepEqual([pay.xp, pay.after.level, pay.after.xp], [80, 7, 2]);
  a.equal(M.settleRun(p, endless), null, '같은 원정 다시 정산해도 없음');
  const reloaded = M.normalizeProfile(clone(p));
  a.equal(M.settleRun(reloaded, clone(endless)), null, '저장 후 불러와도 중복 없음');
  a.deepEqual([reloaded.metaLevel, reloaded.metaXp], [7, 2]);
  // 끝나지 않은 원정, 원정 ID 없는 원정(메타 레벨 도입 전)은 지급하지 않는다
  const going = newRun({ seed: 1, difficulty: 1 });
  a.equal(M.settleRun(M.newProfile(), going), null);
  const legacy = clone(ended);
  delete legacy.runId;
  a.equal(M.settleRun(M.newProfile(), legacy), null);
});

// ─── 저장소(화면 쪽) 연결 ───
function store(data = new Map()) {
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  let seed = 100;
  const st = createStore({
    storage,
    newSeed: () => seed++,
    now: () => new Date('2026-11-18T00:00:00Z'),
    setTimer: () => 0,
    clearTimer: () => {},
  });
  st.load();
  return { st, data, s: () => st.getState() };
}

test('10. 원정이 끝나면 저장소가 한 번 지급하고, 불러오기·새 원정에서도 메타 레벨과 남은 XP를 유지한다', () => {
  const data = new Map();
  // 1-3에서 끝난 원정이 저장된 상태로 처음 열기(정산 직후 창을 닫은 경우) → 불러올 때 지급
  const lost = play({ end: '1-3' });
  lost.runId = 'run-a';
  data.set('starlight-onecost-v1', JSON.stringify(lost));
  const first = store(data);
  a.deepEqual([first.s().meta.metaLevel, first.s().meta.metaXp], [2, 1]);
  a.deepEqual(JSON.parse(data.get(M.META_KEY)).payments.at(-1).xp, 9);
  // 새로고침(다시 열기)해도 같은 원정은 다시 주지 않는다
  const again = store(data);
  a.deepEqual([again.s().meta.metaLevel, again.s().meta.metaXp], [2, 1]);
  // 새 원정을 시작해도 메타 프로필은 그대로, 원정에는 새 ID
  again.st.actions.startRun();
  a.deepEqual([again.s().meta.metaLevel, again.s().meta.metaXp], [2, 1]);
  a(again.s().run.runId && again.s().run.runId !== 'run-a');
  // 두 번째 원정도 1-3에서 끝남 → +9, 1+9 = 10 → Lv.3 0/12(이월)
  const second = play({ end: '1-3' });
  second.runId = 'run-b';
  data.set('starlight-onecost-v1', JSON.stringify(second));
  const third = store(data);
  a.deepEqual(
    [third.s().meta.metaLevel, third.s().meta.metaXp, third.s().meta.totalXp],
    [3, 0, 18],
  );
  a.deepEqual(
    JSON.parse(data.get(M.META_KEY)).payments.map((p) => p.runId),
    ['run-a', 'run-b'],
  );
});

test('10-2. 0.17.2 이전에 시작한 진행 중 원정은 ID를 받아 끝나면 지급, 이미 끝난 원정은 소급하지 않음', () => {
  const going = newRun({ seed: 9, difficulty: 1 });
  delete going.runId;
  const a1 = store(new Map([['starlight-onecost-v1', JSON.stringify(going)]]));
  a(a1.s().run.runId, '진행 중 원정에 ID 부여');
  const done = play({ end: '1-3' });
  delete done.runId;
  const a2 = store(new Map([['starlight-onecost-v1', JSON.stringify(done)]]));
  a.deepEqual([a2.s().meta.metaLevel, a2.s().meta.metaXp, a2.s().meta.payments.length], [1, 0, 0]);
});

test('11. 메타 정산은 인게임 레벨·XP·골드·증강을 바꾸지 않는다', () => {
  const s = play({ completion: 'end' });
  const before = clone(s);
  const p = M.newProfile();
  M.settleRun(p, s);
  a.deepEqual(s, before, '원정 상태 그대로');
  // 메타 레벨이 높아도 새 원정은 같다(성장 보상 없음)
  const fresh = newRun({ seed: 3, difficulty: 1, runId: 'x' });
  const p2 = M.newProfile();
  M.addXp(p2, 5000);
  a.deepEqual(newRun({ seed: 3, difficulty: 1, runId: 'x' }), fresh);
  a.deepEqual([fresh.level, fresh.xp, fresh.gold], [3, 0, 7]);
  a.equal(A.augments.length, 54);
  a.equal(p2.growthEnabled, false, '레벨업 보상·영구 강화 없음');
});

// ─── v0.17.3 지급 시점 추가(사용자 결정 2026-11-19) ───
test('계속 진행: 6-5 뒤 계속 진행을 고른 순간 80 XP 확정, 무한 라운드에서 끝나도 더 주지 않음', () => {
  const s = play({ completion: null });
  a.equal(s.completionChoice, 'pending');
  const p = M.newProfile();
  a.equal(M.settleRun(p, s, 'continue'), null, '선택 전에는 확정하지 않음');
  a(P.chooseCompletion(s, 'continue'));
  const pay = M.settleRun(p, s, 'continue');
  a.deepEqual([pay.xp, pay.reason, pay.after.level, pay.after.xp], [80, 'continue', 7, 2]);
  const endless = play({ completion: 'continue', endless: 3 });
  a(endless.done);
  a.equal(M.settleRun(p, endless), null, '무한 라운드 게임 오버에서 다시 주지 않음');
  a.equal(M.settleRun(p, endless, 'abandon'), null);
});

test('원정 포기: 끝내지 않은 원정은 그때까지 완료한 스테이지 × 2(기본 5 없음)', () => {
  const s = play({ stop: '2-4' }); // 1-1 ~ 2-3 완료(8스테이지)
  a(!s.done);
  a.equal(M.runReward(s).xp, 5 + 8 * 2, '끝났을 때 기준');
  a.equal(M.runReward(s, 'abandon').xp, 8 * 2, '포기는 기본 5 없이(사용자 결정 (나))');
  const p = M.newProfile();
  a.equal(M.settleRun(p, s), null, '원정 종료(end)로는 주지 않음');
  const pay = M.settleRun(p, s, 'abandon');
  a.deepEqual([pay.xp, pay.reason, pay.after.level, pay.after.xp], [16, 'abandon', 2, 8]);
  a.equal(M.settleRun(p, s, 'abandon'), null, '한 번만');
  const fresh = newRun({ seed: 2, difficulty: 1, runId: 'run-fresh' });
  a.equal(M.settleRun(M.newProfile(), fresh, 'abandon').xp, 0, '아무것도 안 하고 포기하면 0');
});

test('저장소: 새 원정으로 바꾸면 포기 지급(T46), 계속 진행은 그 순간 지급(T46), 결과 창 없이도 한 번만', () => {
  const going = play({ stop: '2-4' });
  going.runId = 'run-abandon';
  const a1 = store(new Map([['starlight-onecost-v1', JSON.stringify(going)]]));
  a1.st.actions.startRun();
  a.deepEqual([a1.s().meta.metaLevel, a1.s().meta.metaXp], [2, 8], '+16');
  a.equal(a1.s().notice?.id, 'T46');
  a(a1.s().notice.text.startsWith('이전 원정을 포기해 메타 XP +16'));
  // 새로 시작한 원정을 곧바로 다시 바꾸면 0 XP(반복으로 쌓을 수 없음), 알림도 없음
  const key = a1.s().notice.key;
  a1.st.actions.startRun();
  a.equal(a1.s().meta.totalXp, 16);
  a.equal(a1.s().notice.key, key, '0 XP면 새 알림 없음');
  // 6-5 결과 창에서 계속 진행
  const at65 = play({ completion: null });
  at65.runId = 'run-continue';
  const a2 = store(new Map([['starlight-onecost-v1', JSON.stringify(at65)]]));
  a.equal(a2.s().meta.payments.length, 0, '선택 전에는 지급 없음');
  a2.st.actions.chooseCompletion('continue');
  a.deepEqual([a2.s().meta.metaLevel, a2.s().meta.metaXp], [7, 2]);
  a.equal(M.paymentFor(a2.s().meta, 'run-continue').reason, 'continue');
  a.equal(a2.s().notice?.id, 'T46');
  // 무한 라운드 중 다시 열거나 포기해도 추가 지급 없음
  const a3 = store(a2.data);
  a3.st.actions.startRun();
  a.equal(a3.s().meta.payments.length, 1);
  a.equal(a3.s().meta.totalXp, 80);
});
