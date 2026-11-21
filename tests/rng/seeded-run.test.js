// 시드 난수(3단계): src/core는 src/core/rng.ts에서만 난수를 뽑고, 원정 생성기는
// state.rngState에, 전투는 자기 rngState에 상태를 둔다.
import { test, afterEach } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import R, { createRng, storedRng, runRng, seedFrom } from '../../src/core/rng.ts';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import W from '../../src/core/encounters.js';
import Engine from '../../src/core/combat/battle.js';
import { createCombatWorkerHost } from '../../src/worker/combat-worker-host.js';

const realRandom = Math.random;
afterEach(() => {
  Math.random = realRandom;
});
const clone = (x) => JSON.parse(JSON.stringify(x));

function newRun(seed) {
  const holder = { rngState: seed };
  const state = P.initialize({
    health: 100,
    gold: 7,
    units: V.startingRoster(P.runRng(holder)).map((id, i) => ({
      uid: i + 1,
      id,
      location: 'bench',
      pos: -1,
      star: 1,
      benchSlot: i,
    })),
    shop: ['C02', 'C04', 'C09', 'C10', 'C11'],
  });
  state.rngState = holder.rngState;
  return V.normalize(state);
}

test('생성기는 결정적이고 값은 [0,1), 상태는 JSON을 거쳐도 이어진다', () => {
  const x = createRng(42),
    y = createRng(42);
  const xs = Array.from({ length: 1000 }, x);
  a.deepEqual(Array.from({ length: 1000 }, y), xs);
  a(xs.every((v) => v >= 0 && v < 1));
  a.notDeepEqual(Array.from({ length: 20 }, createRng(43)), xs.slice(0, 20));
  const holder = { rngState: 42 };
  const r = storedRng(holder, 'rngState', () => 0);
  r();
  r();
  const copy = clone(holder);
  // 복사 전에 두 번 뽑았으므로 복사본은 세 번째 값부터 이어진다
  a.equal(storedRng(copy, 'rngState', () => 0)(), xs[2]);
});

test('저장형 생성기는 실제로 뽑기 전에는 holder를 바꾸지 않는다', () => {
  const state = { gold: 3 };
  const before = clone(state);
  runRng(state);
  a.deepEqual(state, before);
  runRng(state)();
  a(Number.isInteger(state.rngState));
  // 시드가 없는 예전 저장은 내용에서 시드를 만든다
  const other = { gold: 3 };
  runRng(other)();
  a.equal(other.rngState, state.rngState);
  a.notEqual(seedFrom({ gold: 3 }), seedFrom({ gold: 4 }));
});

test('같은 시드면 시작 캐릭터·상점·보급 후보가 같다', () => {
  const play = (seed) => {
    const s = newRun(seed);
    const log = [s.units.map((u) => u.id)];
    P.beginSupply(s);
    log.push(clone(s.supplyOffer.options));
    for (let i = 0; i < 4; i++) {
      s.gold = 50;
      V.manualReroll(s);
      log.push([...s.shop]);
    }
    return log;
  };
  a.deepEqual(play(7), play(7));
  a.notDeepEqual(play(7), play(8));
});

test('원정 중간에 저장·불러오기를 해도 같은 난수열이 이어진다', () => {
  const uninterrupted = newRun(99);
  const reloaded = clone(uninterrupted);
  const shops = (s, n) =>
    Array.from({ length: n }, () => {
      s.gold = 50;
      V.manualReroll(s);
      return [...s.shop];
    });
  const expected = shops(uninterrupted, 6);
  const before = shops(reloaded, 3);
  // 3번째와 4번째 새로고침 사이에 저장(JSON)과 불러오기(migrate + normalize)
  const restored = V.normalize(P.migrate(clone(reloaded)));
  a.deepEqual([...before, ...shops(restored, 3)], expected);
});

test('core는 Math.random을 쓰지 않는다: 원정 시작·보급·상점·적 편성·전투', () => {
  Math.random = () => {
    throw new Error('Math.random used');
  };
  const s = newRun(5);
  P.beginSupply(s);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  a(P.confirmSupply(s));
  V.enterShop(s);
  const enemies = W.encounter({ ...clone(s), stage: 2, round: 1, roundPhase: 'prepare' });
  const b = new Engine.Battle(
    [{ id: 'C01', pos: 26 }],
    enemies.length ? enemies : [{ id: 'E01', pos: 31 }],
    {
      seed: P.battleSeed(s),
    },
  );
  for (let i = 0; i < 3000 && !b.result; i++) b.tick();
  a(b.result);
  const sources = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory()
          ? sources(path.join(dir, e.name))
          : /\.(js|ts)$/.test(e.name)
            ? [path.join(dir, e.name)]
            : [],
      );
  for (const file of sources('src/core'))
    if (!file.endsWith('rng.ts')) a(!/Math\.random/.test(fs.readFileSync(file, 'utf8')), file);
});

test('시드 전투는 똑같이 반복되고, Worker로 넘긴 뒤에도 똑같이 이어진다', () => {
  const make = () =>
    new Engine.Battle(
      ['C01', 'C04', 'C07', 'C25'].map((id, i) => ({ id, pos: 18 + 8 * i })),
      ['E03', 'E06', 'E01'].map((id, i) => ({ id, pos: 21 + 8 * i, star: 2 })),
      { seed: 123456 },
    );
  const direct = make();
  for (let i = 0; i < 5000 && !direct.result; i++) direct.tick();
  const again = make();
  for (let i = 0; i < 5000 && !again.result; i++) again.tick();
  a.deepEqual(again.result, direct.result);
  a.deepEqual(
    again.units.map((u) => [u.uid, u.hp]),
    direct.units.map((u) => [u.uid, u.hp]),
  );
  // 여기서 40틱 진행한 뒤 화면처럼 전투를 Worker 호스트로 넘긴다
  const handed = make();
  for (let i = 0; i < 40; i++) handed.tick();
  const messages = [];
  let interval = null,
    now = 0;
  const host = createCombatWorkerHost({
    postMessage: (m) => messages.push(clone(m)),
    now: () => now,
    setInterval: (fn) => ((interval = fn), 1),
    clearInterval: () => {},
    random: () => {
      throw new Error('seeded battle must not use the injected random');
    },
  });
  host.onmessage({
    data: { type: 'start', battle: clone(handed), speed: 4, now: 0, hidden: true },
  });
  for (let k = 0; k < 2000 && !messages.at(-1)?.battle?.result; k++) {
    now += 1000;
    interval();
  }
  const final = messages.at(-1).battle;
  a.deepEqual(final.result, direct.result);
  a.deepEqual(
    final.units.map((u) => [u.uid, u.hp]),
    direct.units.map((u) => [u.uid, u.hp]),
  );
});

test('기본 내보내기에 도우미 함수가 모두 있다', () => {
  a.deepEqual(Object.keys(R).sort(), [
    'createRng',
    'nextSeed',
    'runRng',
    'seedFrom',
    'step',
    'storedRng',
  ]);
});
