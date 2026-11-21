// 6단계: 전투 연출(이벤트 → 연출 계획 → 시간축)과 화면 연출(하트 체력, 액체 XP, 라운드 안내, 합성).
// 연출은 전투 이벤트를 읽기만 하고, 전투 결과·무작위·원정 상태를 바꾸지 않는다.
// v0.15.18의 combat-visuals / pixel-vfx / health-effects / impact-health / liquid-xp /
// presentation-effects 테스트가 확인하던 수치를 새 모듈 기준으로 옮겼다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import Engine from '../../src/core/combat/battle.js';
import VfxEvents from '../../src/core/combat/vfx-events.js';
import I from '../../src/core/items.js';
import V from '../../src/core/preparation.js';
import P from '../../src/core/progression.js';
import {
  plan,
  numberText,
  pixelMapping,
  pixelLimits,
  pixelThemes,
  durations,
  flightMs,
  effectStyle,
  traitPalette,
} from '../../src/ui/render/plan.ts';
import { createTimeline } from '../../src/ui/render/timeline.ts';
import {
  createHealthCounter,
  countdownGap,
  cueDurations,
  healthAt,
  liquidLevel,
  observeLiquid,
  water,
} from '../../src/ui/render/screen.ts';
import { createStore } from '../../src/ui/store.ts';

const { Battle } = Engine;
const clone = (x) => JSON.parse(JSON.stringify(x));
class VfxBattle extends Battle {}
VfxEvents.install(VfxBattle);

const units = [
  { uid: 1, id: 'C03', pos: 27, team: 'ally', stats: { RNG: 1 } },
  { uid: 2, id: 'E01', pos: 28, team: 'enemy', stats: { RNG: 4 } },
  { uid: 3, id: 'C05', pos: 32, team: 'ally', stats: { RNG: 3 } },
];

/** 칸 pos → 화면 좌표(칸 100×80, v0.18.0 좌우 대치 8열) */
const cell = (pos) =>
  pos === undefined
    ? undefined
    : { x: (pos % 8) * 100 + 50, y: Math.floor(pos / 8) * 80 + 40, w: 100, h: 80 };
const context = (over = {}) => ({
  point: (uid, pos) => cell(pos) ?? { x: 0, y: 0, w: 100, h: 80 },
  cell,
  speed: 1,
  now: 1000,
  wallNow: 5000,
  ...over,
});

test('피해 숫자 표기: 천 단위 쉼표, 1 미만은 <1, 0은 0', () => {
  a.equal(numberText(1234.2), '1,234');
  a.equal(numberText(0.4), '<1');
  a.equal(numberText(0), '0');
  a.equal(numberText(-3), '0');
  a.equal(numberText(9.6), '10');
});

test('연출 계획: 물리·마법·받는 피해·치명타·지속 피해가 서로 다른 색조', () => {
  const out = plan(
    [
      {
        kind: 'damage',
        source: 1,
        target: 2,
        amount: 83,
        damageType: 'physical',
        attackKind: 'basic',
      },
      {
        kind: 'damage',
        source: 2,
        target: 1,
        amount: 24.6,
        damageType: 'magic',
        attackKind: 'skill',
      },
      { kind: 'damage', source: 3, target: 2, amount: 40, damageType: 'magic', critical: true },
      { kind: 'damage', source: 3, target: 2, amount: 5, attackKind: 'dot' },
      {
        kind: 'damage',
        source: 1,
        target: 2,
        amount: 9,
        damageType: 'magic',
        sourceTag: 'ITEM_PROC',
      },
    ],
    units,
  );
  a.deepEqual(
    out.map((c) => [c.text, c.tone]),
    [
      ['−83', 'physical'],
      ['−25', 'incoming'],
      ['치명타 −40', 'critical'],
      ['−5', 'dot'],
      ['−9', 'magic'],
    ],
  );
  a.equal(out[1].ranged, true, '사거리 4는 원거리');
  a.equal(out[0].ranged, false, '붙어 있는 근접');
  a.equal(out[4].itemProc, true);
});

test('연출 계획: 회복·보호막·회피·시전·소환·사망, 0 회복과 모르는 유닛은 무시', () => {
  const out = plan(
    [
      { kind: 'heal', source: 1, target: 1, amount: 12 },
      { kind: 'heal', source: 1, target: 1, amount: 0 },
      { kind: 'shield', source: 3, target: 1, amount: 30 },
      { kind: 'evade', source: 2, target: 1 },
      { kind: 'skill', source: 3 },
      { kind: 'summon', source: 3, target: 1 },
      { kind: 'death', target: 2 },
      { kind: 'damage', target: 999, amount: 1 },
      { kind: 'skill', source: 999 },
      { kind: 'move', source: 1 },
    ],
    units,
  );
  a.deepEqual(
    out.map((c) => c.kind),
    ['heal', 'shield', 'evade', 'cast', 'spawn', 'death'],
  );
  a.equal(out[0].text, '+12');
  a.equal(out[1].text, '보호막 +30');
  a.equal(out[2].text, '회피');
  a.equal(out[3].sourceId, 'C05');
});

test('특성 색: 아는 특성은 고유 색, 모르면 무속성', () => {
  a.deepEqual(effectStyle('번개'), { trait: '번개', color: '#ffe45c' });
  a.deepEqual(effectStyle(undefined), { trait: '무속성', color: '#d5cbe3' });
});

test('완전히 막힌 공격은 흡수로, 실제 깎인 체력만 숫자로 보인다', () => {
  const b = new Battle([{ id: 'C03', pos: 27 }], [{ id: 'E06', pos: 28 }], { rng: () => 0.99 });
  const [u, t] = b.units;
  b.shield(t, 1000, 10, t);
  b.events = [];
  b.deal(u, t, 10, 'physical', { kind: 'basic', canCrit: false });
  const row = plan(b.events, b.units)[0];
  a.equal(row.amount, 0);
  a.equal(row.text, '흡수');
});

test('픽셀 VFX 대응: 원거리 기본 공격은 회색 탄, C01 스킬은 노란 폭발, C07 스킬은 연쇄 번개만', () => {
  a.deepEqual(
    pixelMapping({ kind: 'damage', sourceId: 'C07', attackKind: 'basic', ranged: true }),
    {
      theme: 'gray',
      flight: true,
      hit: true,
    },
  );
  a.deepEqual(pixelMapping({ kind: 'evade', attackKind: 'basic', ranged: true }), {
    theme: 'gray',
    flight: true,
    hit: false,
  });
  a.equal(pixelMapping({ kind: 'damage', sourceId: 'C01', attackKind: 'skill' }).theme, 'yellow');
  a.equal(
    pixelMapping({ kind: 'damage', sourceId: 'C01', attackKind: 'skill', sourceSummon: true }),
    null,
  );
  a.equal(pixelMapping({ kind: 'damage', sourceId: 'C07', attackKind: 'skill' }), null);
  a.equal(pixelMapping({ kind: 'damage', attackKind: 'basic', ranged: false }), null);
  a.equal(pixelMapping({ kind: 'heal' }), null);
});

test('C07 스킬: 실제 전투 이벤트에서 연쇄 번개 명령이 나온다', () => {
  const b = new VfxBattle(
    [{ id: 'C07', pos: 2 }],
    [
      { id: 'E01', pos: 3 },
      { id: 'E02', pos: 52 },
      { id: 'E03', pos: 4 },
    ],
    { rng: () => 0.99 },
  );
  b.cast(b.units[0], b.units[1]);
  const commands = plan(b.events, b.units);
  const chain = commands.find((c) => c.kind === 'chainLightning');
  a(chain);
  a.equal(chain.sourceId, 'C07');
  a.equal(chain.chains.length, 2);
  a(chain.eventId);
});

test('연쇄 번개: 같은 이벤트는 한 번만, 대상 0~2명 모두 줄기·폭발, 650ms 뒤 정리, 개수 상한', () => {
  for (let targets = 0; targets <= 2; targets++) {
    const tl = createTimeline({ random: () => 0.5 });
    const chainTargets = [
      { uid: 8, pos: 46, landed: true },
      { uid: 9, pos: 44, landed: true },
    ].slice(0, targets);
    const command = {
      kind: 'chainLightning',
      eventId: 'c' + targets,
      sourceId: 'C07',
      sourceSummon: false,
      sourcePos: 35,
      critical: false,
      primary: { uid: 7, pos: 3, landed: true },
      chains: chainTargets,
    };
    tl.consume([command, command], context());
    // 160ms 비행 후 주 대상, 50ms 간격으로 다음 대상
    const flying = tl.frame(1000 + 80);
    a.equal(flying.chainBolts.length, 1, '비행 중 한 개');
    const mid = tl.frame(1000 + 160 + 60);
    a.equal(mid.lightning.length, targets, '대상마다 줄기');
    for (const l of mid.lightning)
      for (let i = 1; i < l.points.length; i++) {
        const [p, q] = [l.points[i - 1], l.points[i]];
        a(p.x === q.x || p.y === q.y, '계단 모양(가로·세로만)');
      }
    const after = tl.frame(1000 + 400);
    a(after.pixels.length > 0, '폭발 픽셀');
    tl.frame(1000 + 2000);
    a.equal(tl.busy, false, '수명이 끝나면 모두 정리');
  }
  // 4배속으로 80번 연속: 연쇄 24개, 픽셀 720개를 넘지 않는다
  const tl = createTimeline({ random: () => 0.5 });
  for (let i = 0; i < 80; i++)
    tl.consume(
      [
        {
          kind: 'chainLightning',
          eventId: 'n' + i,
          sourceId: 'C07',
          sourceSummon: false,
          sourcePos: 35,
          critical: false,
          primary: { uid: 7, pos: 3, landed: true },
          chains: [
            { uid: 8, pos: 46 },
            { uid: 9, pos: 44 },
          ],
        },
      ],
      context({ speed: 4 }),
    );
  for (let t = 1000; t < 1600; t += 16) {
    const f = tl.frame(t);
    a(f.pixels.length <= pixelLimits.particles);
  }
  tl.clear();
  a.equal(tl.busy, false, '일시정지·크기 변경 때 모두 지움');
});

test('500ms보다 오래된 이벤트는 그리지 않는다(숨은 탭에서 돌아왔을 때)', () => {
  const tl = createTimeline({ random: () => 0.5 });
  const [c] = plan([{ kind: 'heal', source: 1, target: 1, amount: 5 }], units);
  tl.consume([{ ...c, eventId: 'old', eventAt: 4000 }], context());
  a.equal(tl.frame(1100).numbers.length, 0);
  tl.consume([{ ...c, eventId: 'new', eventAt: 4800 }], context());
  a.equal(tl.frame(1100).numbers.length, 1);
});

test('원거리 공격은 비행이 끝난 뒤 숫자가 뜨고, 근접은 바로 뜬다', () => {
  const tl = createTimeline({ random: () => 0.5 });
  const commands = plan(
    [
      {
        kind: 'damage',
        source: 3,
        target: 2,
        amount: 50,
        damageType: 'magic',
        attackKind: 'skill',
      },
      { kind: 'damage', source: 1, target: 2, amount: 10, attackKind: 'skill' },
    ],
    units.map((u) => (u.uid === 1 ? { ...u, pos: 27 } : u)),
  );
  // C03(27)과 E01(28)은 붙어 있어 근접, C05(32)는 원거리
  tl.consume(commands, context());
  const first = tl.frame(1000);
  a.equal(first.numbers.length, 1, '근접 숫자만');
  a.equal(first.bolts.length, 1, '원거리 투사체');
  const flight = flightMs(cell(28).x - cell(32).x, cell(28).y - cell(32).y, 1);
  const later = tl.frame(1000 + flight + 1);
  a.equal(later.numbers.length, 2, '도착 후 원거리 숫자');
  a(later.units.get(2).bright > 1, '맞은 캐릭터가 번쩍임');
});

test('숫자는 칸마다 4줄로 엇갈리고, 위로 떠오르며 사라진다(900ms, 4배속 500ms)', () => {
  const tl = createTimeline({ random: () => 0.5, bounds: () => ({ width: 700, height: 640 }) });
  const hits = Array.from({ length: 5 }, (_, i) => ({
    kind: 'damage',
    source: 1,
    target: 2,
    amount: 10 + i,
    attackKind: 'dot',
  }));
  tl.consume(plan(hits, units), context());
  const f = tl.frame(1000 + 135);
  const ys = f.numbers.map((n) => n.y);
  a.equal(new Set(ys.slice(0, 4)).size, 4, '네 줄');
  a(f.numbers.every((n) => n.alpha > 0.8));
  a.equal(tl.frame(1000 + 901).numbers.length, 0);
  a.equal(durations.number(4, false), 500);
  a.equal(durations.number(1, true), 450);
});

test('움직임 줄이기: 돌진·흔들림·불꽃 없이 숫자와 고리만', () => {
  const tl = createTimeline({ random: () => 0.5, reduced: () => true });
  tl.consume(
    plan(
      [
        { kind: 'damage', source: 1, target: 2, amount: 10, attackKind: 'basic' },
        { kind: 'skill', source: 3 },
      ],
      units,
    ),
    context(),
  );
  const f = tl.frame(1000);
  a.equal(f.numbers.length, 1);
  a.equal(f.sparks.length, 0);
  a.equal(f.units.size, 0);
});

test('사망: 피격 연출이 끝난 뒤 쓰러지고, 연출이 끝나면 지워진다', () => {
  const tl = createTimeline({ random: () => 0.5 });
  tl.consume(plan([{ kind: 'death', target: 2 }], units), context());
  a.equal(tl.frame(1000).units.get(2).dying, 0);
  a.equal(tl.gone(2, 1000 + durations.death(1, false)), true);
  tl.reset();
  a.equal(tl.gone(2, 99999), false, '새 전투에서는 기록을 비움');
});

test('연출을 읽어도 시드 전투의 결과·무작위·아이템 발동·피해 합계는 그대로', () => {
  function run(withVisuals, Kind) {
    let seed = 941;
    const rng = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const ids = ['I26', 'I27', 'I39'];
    const b = new Kind(
      [
        { id: 'C13', pos: 26, itemIds: ids, bonuses: I.bonuses(ids) },
        { id: 'C05', pos: 32 },
        { id: 'C07', pos: 8 },
      ],
      [
        { id: 'E06', pos: 29 },
        { id: 'E03', pos: 37 },
        { id: 'E01', pos: 31 },
      ],
      { rng, quickMana: true },
    );
    const tl = createTimeline({ random: () => 0.5 });
    let frames = 0;
    let now = 0;
    while (!b.result && frames++ < 2000) {
      b.tick();
      if (withVisuals) {
        const before = clone({ units: b.units, events: b.events });
        tl.consume(plan(b.events, b.units), context({ speed: 4, now, wallNow: 0 }));
        tl.frame((now += 25));
        a.deepEqual(clone({ units: b.units, events: b.events }), before, '읽기만 한다');
      }
    }
    a(b.result);
    return {
      result: b.result,
      seed,
      units: clone(b.units).map(({ uid, hp, mp, pos, dead }) => ({ uid, hp, mp, pos, dead })),
      stats: b.statsTotal,
      skills: b.skillUses,
    };
  }
  const plain = run(false, Battle);
  a.deepEqual(run(true, Battle), plain);
  a.deepEqual(run(true, VfxBattle), plain, 'VFX 기록 확장을 켜도 같음');
});

test('하트 체력 숫자: 한 칸씩 80ms, 큰 손실도 1.6초 안에, 취소·회복·움직임 줄이기는 바로', () => {
  function clock(reduced = false) {
    let now = 0;
    let seq = 0;
    const jobs = new Map();
    const values = [];
    let bursts = 0;
    let cleaned = 0;
    const h = createHealthCounter({
      paint: (n) => values.push(n),
      burst: () => {
        bursts++;
        return () => cleaned++;
      },
      reduced: () => reduced,
      later: (fn, ms) => {
        jobs.set(++seq, { fn, due: now + ms });
        return seq;
      },
      clear: (id) => jobs.delete(id),
    });
    return {
      h,
      values,
      now: () => now,
      pending: () => jobs.size,
      counts: () => [bursts, cleaned],
      run() {
        while (jobs.size) {
          const [id, j] = [...jobs].sort((x, y) => x[1].due - y[1].due)[0];
          jobs.delete(id);
          now = j.due;
          j.fn();
        }
      },
    };
  }
  let c = clock();
  c.h.render(100);
  c.h.render(90);
  a.equal(c.h.target, 90);
  a.equal(c.h.displayed, 100);
  c.run();
  a.deepEqual(
    c.values,
    Array.from({ length: 11 }, (_, i) => 100 - i),
  );
  a.equal(c.now(), 800);
  a.deepEqual(c.counts(), [1, 1]);

  c = clock();
  c.h.render(100);
  c.h.render(0);
  c.run();
  a.equal(c.values.length, 101, '건너뛰는 숫자 없음');
  a(c.now() <= 1600.001);
  a.equal(countdownGap(100, 0), 16);

  c = clock();
  c.h.render(100);
  c.h.render(70);
  c.h.cancel();
  a.equal(c.h.displayed, 70);
  a.equal(c.pending(), 0);
  c.h.render(100);
  a.equal(c.h.displayed, 100, '늘어날 때는 바로');

  c = clock(true);
  c.h.render(100);
  c.h.render(80);
  a.equal(c.h.displayed, 80);
  a.equal(c.pending(), 0);
  a.deepEqual(c.counts(), [0, 0]);
});

test('전투 뒤 하트: 900ms까지 그대로, 1700ms에 도착, 움직임 줄이기는 바로', () => {
  a.equal(healthAt(73, 75, 0, false), 73);
  a.equal(healthAt(73, 75, 900, false), 73);
  a.equal(healthAt(73, 75, 1300, false), 74);
  a.equal(healthAt(73, 75, 1700, false), 75);
  a.equal(healthAt(96, 6, 3000, false), 6);
  a.equal(healthAt(96, 6, 0, true), 6);
  a.equal(cueDurations.health(false), 3000);
  a.equal(cueDurations.health(true), 500);
  a.match(water(0, 0), /^M0 89/, '체력 0이면 물이 바닥');
  a.match(water(100, 0), /^M0 0/);
});

test('액체 XP: 600ms 동안 차오르고, 레벨업은 가득 찼다가 남은 비율로, 줄어들면 바로', () => {
  const liquid = {
    level: 3,
    xp: 0,
    view: 0,
    target: 0,
    from: 0,
    start: null,
    impact: 0,
    flash: 0,
    dots: [],
  };
  observeLiquid(liquid, 3, 2, 0.5, 1000);
  a.equal(liquidLevel(liquid, 1000), 0);
  a(liquidLevel(liquid, 1300) > 0.4);
  a.equal(liquidLevel(liquid, 1600), 0.5);
  a.equal(liquid.dots.length, 12);
  observeLiquid(liquid, 4, 1, 0.1, 2000);
  a.equal(liquidLevel(liquid, 2100), 1, '레벨업 직후 가득');
  a.equal(liquid.flash, 2650);
  a.equal(liquidLevel(liquid, 2000 + 350 + 600), 0.1);
  observeLiquid(liquid, 1, 0, 0, 3000);
  a.equal(liquid.view, 0, '새 원정은 바로');
  a.equal(liquid.dots.length, 0);
});

test('라운드 안내·합성 시간: ROUND 2200 / STAGE 1600, 합성 900 → 680(움직임 줄이기 120 → 180)', () => {
  a.equal(cueDurations.round(false), 2200);
  a.equal(cueDurations.round(true), 600);
  a.equal(cueDurations.stage(false), 1600);
  a.equal(cueDurations.stage(true), 350);
  a.equal(cueDurations.mergeFlight(false), 900);
  a.equal(cueDurations.mergeFlare(false), 680);
  a.equal(cueDurations.mergeFlight(true), 120);
  a.equal(cueDurations.mergeFlare(true), 180);
  a.equal(durations.finish(1, false), 1100);
  a.equal(durations.finish(4, false), 700);
  a.equal(durations.finish(1, true), 500);
});

function presentationStore() {
  const data = new Map();
  const timers = [];
  const combat = {
    warm() {},
    start(battle, h) {
      let result = null;
      for (let i = 0; i < 20000 && !result; i++) result = battle.tick();
      h.onEnd(result);
    },
    stop() {},
    setSpeed() {},
    pause() {},
    resume() {},
    visibility() {},
  };
  const store = createStore({
    storage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    newSeed: () => 21,
    combat,
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    clearTimer: () => {},
    presentation: { reduced: () => false },
  });
  store.load();
  store.actions.startRun();
  return { store, s: () => store.getState(), timers, data };
}

test('전투 끝: 정산·저장은 바로, 화면은 마지막 장면 → 하트 체력 → 결과 창', () => {
  const { store, s, timers, data } = presentationStore();
  for (let n = 0; n < 2; n++) {
    store.actions.primary();
    store.actions.toggleSupply(0);
    store.actions.toggleSupply(1);
    store.actions.confirmSupply();
    a.equal(s().modal, 'result', '보급은 연출 없이 결과 창');
    store.actions.continueRound();
    if (n === 0) {
      const banner = s().cues.at(-1);
      a.deepEqual([banner.kind, banner.stage, banner.round], ['stage', 1, 2], '1-2 안내');
    }
  }
  store.actions.chooseAugment(P.availableAugments(s().run)[0].id);
  a.equal(s().cues.at(-1).kind, 'stage');
  for (const c of s().cues) store.actions.doneCue(c.key);
  a.equal(s().cues.length, 0);
  V.moveUnit(s().run, s().run.units[0].uid, { location: 'board', pos: 26 });
  store.actions.primary();
  store.actions.confirmDeployment(true);
  // 전투가 끝남: 원정은 이미 결과 단계로 저장됨
  a.equal(s().battle, null);
  a(s().finishing, '마지막 장면');
  a.equal(s().modal, null);
  a.equal(s().run.roundPhase, 'result');
  a.equal(JSON.parse(data.get('starlight-onecost-v1')).roundPhase, 'result');
  const finish = timers.at(-1);
  a.equal(finish.ms, 1100);
  finish.fn();
  a.equal(s().finishing, null);
  const health = s().cues.find((c) => c.kind === 'health');
  a(health, '하트 체력 연출');
  a.equal(health.after, s().run.health);
  a.equal(health.before, s().run.lastResult.healthBefore);
  a.equal(s().modal, null, '하트가 끝나기 전에는 결과 창 없음');
  store.actions.doneCue(health.key);
  a.equal(s().modal, 'result');
  store.actions.continueRound();
  const next = s().cues.at(-1);
  a.deepEqual([next.kind, next.round], ['stage', 4]);
});

test('전투 끝 장면은 건너뛸 수 있고, 연출이 꺼져 있으면 신호를 만들지 않는다', () => {
  const { store, s } = presentationStore();
  s().run.roundPhase = 'prepare';
  s().run.round = 3;
  V.moveUnit(s().run, s().run.units[0].uid, { location: 'board', pos: 26 });
  store.actions.primary();
  store.actions.confirmDeployment(true);
  a(s().finishing);
  store.actions.skipFinish();
  a.equal(s().finishing, null);
  a.equal(s().modal, 'result');
});

test('합성: 상점에서 세 번째를 사면 남는 캐릭터와 재료 위치로 합성 연출 신호', () => {
  const { store, s } = presentationStore();
  const run = s().run;
  const id = run.units[0].id;
  // 같은 캐릭터 1성 2명을 대기석에 두고 세 번째를 산다
  run.units = [
    { uid: 101, id, star: 1, location: 'board', pos: 26 },
    { uid: 102, id, star: 1, location: 'bench', benchSlot: 4 },
  ];
  run.roundPhase = 'prepare';
  run.round = 3;
  run.gold = 99;
  run.shop = [id, null, null, null, null];
  store.actions.buy(0);
  const merge = s().cues.find((c) => c.kind === 'merge');
  a(merge);
  a.equal(merge.keep, 101, '전장에 있는 쪽이 남는다');
  a.equal(merge.star, 2);
  a.deepEqual(merge.parts.map((p) => p.drop).sort(), ['bench:0', 'bench:4']);
});

test('특성 10개는 모두 다른 색, 소환수 공격은 원래 속성을 유지한다', () => {
  a.equal(Object.keys(traitPalette).length, 10);
  a.equal(new Set(Object.values(traitPalette)).size, 10);
  a.equal(effectStyle('물').color, '#55baff');
  a.equal(effectStyle('몬스터').color, '#d5cbe3');
  const out = plan(
    [{ kind: 'damage', source: 1, target: 2, amount: 5 }],
    [
      { uid: 1, id: 'C11', pos: 14, summonKind: 'fire', stats: { RNG: 2 } },
      { uid: 2, pos: 22, team: 'enemy', stats: { RNG: 1 } },
    ],
  );
  a.equal(out[0].sourceTrait, '화염');
});

test('이벤트 당시 위치와 원거리 회피는 나중에 유닛이 움직여도 유지되고, 적중을 지어내지 않는다', () => {
  const battle = new VfxBattle([{ id: 'C01', pos: 27 }], [{ id: 'E01', pos: 31 }], {
    rng: () => 0,
  });
  const [source, target] = battle.units;
  target.stats.DOD = 100;
  battle.deal(source, target, 100, 'physical', { kind: 'basic' });
  const event = battle.events.find((row) => row.kind === 'evade');
  a.equal(event.visual.source, source.uid);
  source.pos = 35;
  target.pos = 39;
  const command = plan([event], battle.units)[0];
  a.equal(command.sourcePos, 27);
  a.equal(command.targetPos, 31);
  a.deepEqual(pixelMapping(command), { theme: 'gray', flight: true, hit: false });
  // 회피 탄은 날아가지만 도착해도 숫자 외의 적중 연출(번쩍임)은 없다
  const tl = createTimeline({ random: () => 0.5 });
  tl.consume([command], context());
  a.equal(tl.frame(1000).numbers[0].text, '회피');
  a.equal(tl.frame(1300).units.get(target.uid), undefined);
});

test('보드 그림(v0.18.0 좌우 대치)은 원본 PNG를 무손실 WebP로 바꾼 것이고, 잰 격자의 56칸 좌표 변환이 서로 맞다', async () => {
  const fs = await import('node:fs');
  const crypto = await import('node:crypto');
  const B = await import('../../src/ui/art/board.ts');
  const { boardArt } = B;
  const near = (x, y) => a(Math.abs(x - y) < 1e-6, `${x} != ${y}`);
  // 원본 PNG: 격자를 잰 그림(docs/specs/BOARD_SIDE_8X7_CALIBRATION.json)과 해시가 같다
  const record = JSON.parse(fs.readFileSync('docs/specs/images.json', 'utf8'))[
    'board-side-8x7.webp'
  ];
  a.equal(record.mode, 'lossless', '무손실 변환(tools/convert-images.py가 픽셀 동일을 확인)');
  const png = fs.readFileSync(record.source);
  a.equal(png.readUInt32BE(16), boardArt.source.width);
  a.equal(png.readUInt32BE(20), boardArt.source.height);
  const sha = crypto.createHash('sha256').update(png).digest('hex');
  const calibration = JSON.parse(
    fs.readFileSync('docs/specs/BOARD_SIDE_8X7_CALIBRATION.json', 'utf8'),
  );
  a.equal(sha, calibration.sha256);
  a.equal(sha, record.sourceSha256);
  a.deepEqual(
    [boardArt.grid.left, boardArt.grid.top, boardArt.grid.right, boardArt.grid.bottom],
    [calibration.grid.left, calibration.grid.top, calibration.grid.right, calibration.grid.bottom],
  );
  // 잰 이음선이 균등 격자선과 1.5px 안에서 맞는다
  const t = B.tileSize();
  calibration.measured.verticalSeams.forEach((x, i) =>
    a(Math.abs(boardArt.grid.left + (i + 1) * t.w - x) <= 1.5, `세로선 ${x}`),
  );
  calibration.measured.horizontalSeams.forEach((y, i) =>
    a(Math.abs(boardArt.grid.top + (i + 1) * t.h - y) <= 1.5, `가로선 ${y}`),
  );
  // 배포하는 WebP의 크기도 같다
  const webp = fs.readFileSync('public/' + boardArt.board);
  a.equal(webp.subarray(8, 12).toString('latin1'), 'WEBP');
  const chunk = webp.subarray(12, 16).toString('latin1');
  const size =
    chunk === 'VP8L'
      ? [(webp.readUInt32LE(21) & 0x3fff) + 1, ((webp.readUInt32LE(21) >> 14) & 0x3fff) + 1]
      : [webp.readUIntLE(24, 3) + 1, webp.readUIntLE(27, 3) + 1];
  a.deepEqual(size, [boardArt.source.width, boardArt.source.height]);
  // contain: 비율 그대로, 가운데 정렬
  const board = B.fitBoard({ left: 218, top: 94, width: 1164, height: 650 });
  near(board.width / board.height, 1.5);
  a(board.width <= 1164 && board.height <= 650);
  near(board.left + board.width / 2, 218 + 1164 / 2);
  // cover: 화면을 다 덮는다
  const bg = B.coverBackground(1761, 832);
  a(bg.width >= 1761 && bg.height >= 832);
  near(bg.width / bg.height, 1672 / 941);
  // 56칸 중심 → 칸 번호, 칸 경계 안쪽 끝도 같은 칸
  for (let pos = 0; pos < 56; pos++) {
    const c = B.tileOnScreen(pos, board);
    a.equal(B.pointerToPos(c.x, c.y, board), pos, `${pos} 중심`);
    a.equal(B.pointerToPos(c.x - c.w / 2 + 0.5, c.y - c.h / 2 + 0.5, board), pos, `${pos} 왼쪽 위`);
    a.equal(
      B.pointerToPos(c.x + c.w / 2 - 0.5, c.y + c.h / 2 - 0.5, board),
      pos,
      `${pos} 오른쪽 아래`,
    );
  }
  a.equal(B.pointerToPos(board.left + 2, board.top + 2, board), null, '프레임은 칸이 아님');
});
