// 새 화면 저장소의 라운드 흐름: 보급 → 결과 → 다음 라운드 → 증강 → 배치 확인 → 전투 → 결과,
// 6-5 완료 선택, 전투 실행기(Worker 프로토콜과 메인 스레드 대체 경로).
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createStore } from '../../src/ui/store.ts';
import { createCombatRunner } from '../../src/ui/combat/runner.ts';
import { createCombatWorkerHost } from '../../src/worker/combat-worker-host.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import Engine from '../../src/core/combat/battle.js';

/** 전투를 그 자리에서 끝까지 계산하는 가짜 실행기 */
function instantRunner() {
  const calls = [];
  return {
    calls,
    warm() {},
    start(battle, h, speed) {
      calls.push(['start', speed]);
      let result = null;
      for (let i = 0; i < 20000 && !result; i++) result = battle.tick();
      h.onEnd(result);
    },
    stop() {},
    setSpeed: (s) => calls.push(['speed', s]),
    pause: () => calls.push(['pause']),
    resume: () => calls.push(['resume']),
    visibility() {},
  };
}

function setup(combat = instantRunner()) {
  const data = new Map();
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 21,
    combat,
    setTimer: () => 0,
    clearTimer: () => {},
  });
  store.load();
  store.actions.startRun();
  return { store, s: () => store.getState(), combat, data };
}

function takeSupply(store, s) {
  store.actions.primary();
  a.equal(s().modal, 'supply');
  store.actions.toggleSupply(0);
  store.actions.toggleSupply(1);
  store.actions.confirmSupply();
  a.equal(s().modal, 'result');
  a.equal(s().run.lastResult.type, 'SUPPLY');
  store.actions.continueRound();
}

test('1-1·1-2 보급 → 1-3 증강 → 배치 확인 → 전투 → 결과 → 1-4', () => {
  const { store, s, combat } = setup();
  takeSupply(store, s);
  a.equal(P.label(s().run), '1-2');
  takeSupply(store, s);
  // 1-3 진입 전 증강
  a.equal(s().modal, 'augment');
  const pick = P.availableAugments(s().run)[0].id;
  store.actions.chooseAugment(pick);
  a.equal(s().modal, null);
  a.deepEqual(s().run.augments, [pick]);
  a.equal(P.label(s().run), '1-3');
  a.equal(s().run.enemyEncounter.key, '1-3', '적 편성 준비');
  // 아군 0명이면 전투 시작 안 됨
  store.actions.primary();
  a.equal(s().battle, null);
  // 1명 배치(정원 3) → 배치 부족 확인 창
  const unit = s().run.units[0];
  V.moveUnit(s().run, unit.uid, { location: 'board', pos: 26 });
  store.actions.primary();
  a.equal(s().modal, 'deploy');
  store.actions.confirmDeployment(true);
  a.equal(s().run.skipDeploymentWarning, true);
  a.deepEqual(combat.calls[0], ['start', 1]);
  // 즉시 끝나는 가짜 실행기 → 결과 창
  a.equal(s().battle, null);
  a.equal(s().modal, 'result');
  const receipt = s().run.lastResult;
  a(['BATTLE'].includes(receipt.type));
  a(Array.isArray(receipt.damageRows) && receipt.damageRows.length === 1);
  a.equal(s().run.roundPhase, 'result');
  store.actions.continueRound();
  a.equal(P.label(s().run), '1-4');
  a.equal(s().modal, null);
});

test('결과 단계에서 이어하기·주 버튼은 결과 창을 다시 연다', () => {
  const { store, s } = setup();
  store.actions.primary();
  store.actions.toggleSupply(0);
  store.actions.toggleSupply(2);
  store.actions.confirmSupply();
  store.actions.closeModal();
  a.equal(s().modal, null);
  store.actions.primary();
  a.equal(s().modal, 'result');
  store.actions.showHome();
  store.actions.continueRun();
  a.equal(s().modal, 'result');
});

test('6-5 완료 뒤 계속 진행은 7-1, 종료는 요약 창', () => {
  for (const choice of ['continue', 'end']) {
    const { store, s } = setup();
    const run = s().run;
    Object.assign(run, { stage: 6, round: 5, roundPhase: 'combat' });
    P.settleRound(run, { winner: 'ally', time: 10, survivingEnemies: 0 }, () => 0.5);
    a.equal(run.completionChoice, 'pending');
    store.actions.chooseCompletion(choice);
    if (choice === 'continue') a.equal(P.label(s().run), '7-1');
    else a.equal(s().modal, 'summary');
  }
});

test('배속은 1→2→4→1 순서로 바뀌고 실행기에 전달된다', () => {
  const { store, s, combat } = setup();
  store.actions.cycleSpeed();
  store.actions.cycleSpeed();
  a.equal(s().speed, 4);
  store.actions.cycleSpeed();
  a.equal(s().speed, 1);
  a.deepEqual(
    combat.calls.filter((c) => c[0] === 'speed').map((c) => c[1]),
    [2, 4, 1],
  );
});

/** combat-worker-host를 같은 스레드에서 감싼 가짜 Worker */
function fakeWorkerEnv() {
  let now = 0;
  let tick = null;
  const env = {
    now: () => now,
    hidden: () => false,
    setInterval: () => 0,
    clearInterval: () => {},
    createWorker() {
      const worker = {
        onmessage: null,
        onerror: null,
        terminate() {},
        postMessage: (data) => host.onmessage({ data: JSON.parse(JSON.stringify(data)) }),
      };
      const host = createCombatWorkerHost({
        postMessage: (m) => worker.onmessage?.({ data: JSON.parse(JSON.stringify(m)) }),
        now: () => now,
        setInterval: (fn) => ((tick = fn), 1),
        clearInterval: () => {},
        random: Math.random,
      });
      return worker;
    },
  };
  return { env, advance: (ms) => ((now += ms), tick?.()) };
}

test('전투 실행기: Worker 프로토콜로 끝까지 진행하고, 결과가 메인 스레드 계산과 같다', () => {
  const make = () =>
    new Engine.Battle([{ id: 'C07', pos: 26 }], [{ id: 'E01', pos: 29 }], { seed: 77 });
  const direct = make();
  let r = null;
  for (let i = 0; i < 20000 && !r; i++) r = direct.tick();

  const { env, advance } = fakeWorkerEnv();
  const runner = createCombatRunner(env);
  const battle = make();
  let ended = null,
    updates = 0;
  runner.start(battle, { onUpdate: () => updates++, onEnd: (x) => (ended = x) }, 4);
  for (let i = 0; i < 5000 && !ended; i++) advance(200);
  a(ended, '끝까지 진행');
  a(updates > 0, '중간 스냅샷 반영');
  a.deepEqual(ended, direct.result);
  a.deepEqual(
    battle.units.map((u) => [u.uid, u.hp]),
    direct.units.map((u) => [u.uid, u.hp]),
  );
});

test('전투 실행기: Worker를 못 만들면 메인 스레드에서 계산', () => {
  let interval = null,
    now = 0;
  const runner = createCombatRunner({
    now: () => now,
    hidden: () => false,
    setInterval: (fn) => ((interval = fn), 1),
    clearInterval: () => {},
  });
  const battle = new Engine.Battle([{ id: 'C01', pos: 26 }], [{ id: 'E01', pos: 29 }], { seed: 3 });
  let ended = null;
  runner.start(battle, { onUpdate() {}, onEnd: (x) => (ended = x) }, 2);
  for (let i = 0; i < 5000 && !ended; i++) {
    now += 100;
    interval();
  }
  a(ended);
});

test('도감·패치노트 덮개 창, 무료 테스트 영입, 더보기의 새 원정', () => {
  const { store, s } = setup();
  store.actions.setPopover('more');
  a.equal(s().popover, 'more');
  store.actions.openOverlay({ kind: 'codex', page: 'characters' });
  a.deepEqual(s().overlay, { kind: 'codex', page: 'characters' });
  a.equal(s().popover, null, '덮개 창을 열면 작은 창은 닫힌다');
  const gold = s().run.gold;
  const count = s().run.units.length;
  store.actions.freeRecruit('C05');
  a.equal(s().run.gold, gold, '무료');
  a.equal(s().run.units.length, count + 1);
  store.actions.closeOverlay();
  a.equal(s().overlay, null);
  store.actions.openOverlay({ kind: 'reset' });
  store.actions.confirmNewRun();
  a.equal(s().view, 'difficulty');
  a.equal(s().overlay, null);
});

test('패치노트·알림 조사표 모듈은 따로 불러올 수 있고 기존 내용과 같다', async () => {
  const notes = (await import('../../src/content/patch-notes.js')).default;
  const audit = (await import('../../src/content/notice-audit.js')).default;
  a.equal(notes.current, '0.25.0');
  a(notes.toMarkdown().includes('## 버전별 변경 이력'));
  a.equal(audit.rows.filter((r) => r.status === '유지').length, 12);
  a.deepEqual(
    audit.rows.filter((r) => r.status.startsWith('추가')).map((r) => r.id),
    ['T42', 'T43', 'T44', 'T45', 'T46', 'T47', 'T48'],
  );
});

test('재구축 변경 사항: 모든 항목이 종류·영역·원본·지금을 갖고, MD로 내보낼 수 있다', async () => {
  const R = (await import('../../src/content/rebuild-changes.js')).default;
  a.equal(R.base, 'v0.15.18');
  a(R.changes.length >= 20);
  const titles = new Set();
  for (const c of R.changes) {
    a(R.kinds.includes(c.kind), c.title);
    for (const k of ['area', 'title', 'before', 'after'])
      a(c[k] && c[k].length > 1, c.title + ' ' + k);
    a(!titles.has(c.title), '제목 중복 ' + c.title);
    titles.add(c.title);
  }
  // 사용자가 짚은 두 차이가 들어 있다
  a(titles.has('캐릭터 상세 창 위치'));
  a(titles.has('팝업 바깥을 누르면 닫기'));
  const md = R.toMarkdown();
  a(md.startsWith('# AUTOCHESS 재구축 변경 사항'));
  for (const c of R.changes) a(md.includes(c.title));
});

test('밸런스 테스트 기록: 증강 후보 54종 판정이 모두 있고, 실행하지 않은 테스트를 통과로 적지 않는다', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.augment54;
  const ids = t.candidates.map((c) => c.id);
  const expected = ['S', 'G', 'P'].flatMap((k) =>
    Array.from({ length: 18 }, (_, i) => k + String(i + 1).padStart(2, '0')),
  );
  a.deepEqual(ids, expected, '실버·골드·프리즘 각 18종');
  for (const c of t.candidates) {
    a(t.verdicts.includes(c.verdict), c.id);
    a.notEqual(c.test, '통과', '아직 실행하지 않은 테스트');
    a(c.note.length > 3 && c.effect.length > 3, c.id);
  }
  a.equal(
    t.candidates.find((c) => c.id === 'G13').verdict,
    '설계 충돌',
    '같은 캐릭터 전장 1명 규칙',
  );
  const md = B.toMarkdown();
  a(md.includes('## 54종 판정'));
  a(md.includes('미실행'));
});

test('밸런스 테스트 2차 기록: 구현 상태·기능 테스트·시뮬레이션을 증강마다 적고, 실행 방법을 구분한다', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const A = (await import('../../src/core/augments.js')).default;
  const t = B.stage2;
  a.deepEqual(
    t.candidates.map((c) => c.id),
    A.augments.map((x) => x.id),
    '증강 데이터와 같은 54종',
  );
  for (const c of t.candidates) {
    a(t.statuses.includes(c.status), c.id);
    a.equal(c.status === '보류', !!A.byId(c.id).hold, `${c.id} 보류 여부는 데이터와 같음`);
    if (c.status === '보류') a(c.test.startsWith('미실행'), '보류는 테스트하지 않음');
    else a(c.test.startsWith('통과') && c.sim.includes('1-3') && c.sim.includes('5-3'), c.id);
  }
  const kinds = new Set(t.runs.map((r) => r.kind));
  for (const k of ['기능 테스트', '자동 시뮬레이션', '브라우저 자동 조작']) a(kinds.has(k), k);
  a(
    t.notRun.some((x) => x.includes('사람이 직접')),
    '사람 플레이를 하지 않았음을 적음',
  );
  for (const x of t.issues) a(x.repro.length > 5 && x.status, x.title);
  const md = B.toMarkdown();
  a(md.includes('## 증강별 결과') && md.includes('## 54종 판정'), '1차·2차 기록 모두 내보냄');
});

test('밸런스 테스트 메타 레벨 기록: 실행 방법을 구분하고 사례마다 예상·실제·판정을 적는다', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.meta;
  const kinds = new Set(t.runs.map((r) => r.kind));
  for (const k of ['단위 테스트', '자동 시뮬레이션', '브라우저 조작']) a(kinds.has(k), k);
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(t.notRun.some((x) => x.includes('사람이 직접')));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 메타 레벨'));
});

test('좌우 대치 전장 기록: 브라우저 확인·기준선·창 크기별 크기와 실행하지 않은 항목을 적는다', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.battlefield;
  const kinds = new Set(t.runs.map((r) => r.kind));
  for (const k of ['단위 테스트', '전투 기준선', '브라우저 조작']) a(kinds.has(k), k);
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  for (const size of ['1761×832', '1920×1080', '1366×768'])
    a(
      t.cases.some((c) => c[0] === size),
      size,
    );
  a(t.notRun.length > 0 && t.issues.every((x) => x.status && x.repro));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 좌우 대치 전장'));
});

test('시각 개선 기록(v0.18.1): 적용 수치·창 크기별 확대율·실행하지 않은 항목을 적는다', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.visual;
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  for (const size of ['1600×900', '1920×1080', '1366×768'])
    a(
      t.cases.some((c) => c[0] === size),
      size,
    );
  for (const word of ['테두리', '그림자', '1.09'])
    a(
      t.growth.some((x) => x.includes(word)),
      word,
    );
  a(t.notRun.length > 0 && t.issues.every((x) => x.status && x.repro));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 패널 테두리'));
});

test('상호작용 기록(v0.18.3): 요청서 확인 항목마다 예상·실제·판정, 팝업 종류, 실행하지 않은 항목', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.interaction;
  a.equal(t.cases.length, 14);
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(t.growth.some((x) => x.includes('확인 창')) && t.growth.some((x) => x.includes('일반 팝업')));
  a(t.notRun.length > 0 && t.issues.every((x) => x.status && x.repro));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 영입창 자동 열기'));
});

test('영구 강화 기록(v0.19.0): 실행 방법 구분, 플레이 결과, 임시값 결정, 실행하지 않은 항목', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.metaUpgrades;
  const kinds = new Set(t.runs.map((r) => r.kind));
  for (const k of ['단위 테스트', '브라우저 조작', '플레이 봇']) a(kinds.has(k), k);
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(t.decisions.some((x) => x.includes('전열·후열')) && t.decisions.some((x) => x.includes('S4')));
  a(t.notRun.some((x) => x.includes('사람이 직접')));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 메타 영구 강화'));
});

test('장비 개편 기록(v0.20.0): 요청서 최종 체크·사용자 결정·임시값·실행하지 않은 항목', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.itemRework;
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(
    t.decisions.some((x) => x.includes('회수기')) &&
      t.growth.some((x) => x.includes('1차 테스트안')),
  );
  a(t.notRun.some((x) => x.includes('사람이 직접')));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 장비 개편'));
});

test('장비 밸런스 1차 기록(v0.21.0): 3장비 시너지 표·필수 검증·미해결 이슈', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.itemBalance;
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(t.cases.some((c) => c[0].includes('유령의 망토')));
  a(t.issues.some((x) => x.title.includes('치명타')));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 장비 밸런스 1차'));
});

test('컬렉션 기록(v0.22.0): 검수 체크리스트·미정 항목·실행하지 않은 항목', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.collection;
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(t.growth.some((x) => x.includes('돌파')));
  a(B.toMarkdown().includes('# 밸런스 테스트 — 컬렉션 UI'));
});

test('관리자·카드 기록(v0.23.0): 검수 체크리스트·미정 항목·확인 필요', async () => {
  const B = (await import('../../src/content/balance-tests.js')).default;
  const t = B.cardAdmin;
  for (const c of t.cases) a.equal(c.length, 4, c[0]);
  a(t.issues.some((x) => x.title.includes('관리자 버튼')));
  a(B.toMarkdown().startsWith('# 밸런스 테스트 — 시작 화면 컬렉션·관리자'));
});
