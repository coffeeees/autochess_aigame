// Seeded randomness (stage 3): src/core draws only from src/core/rng.js, the run
// generator lives in state.rngState and battles carry their own rngState.
import { test, afterEach } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import R, { createRng, storedRng, runRng, seedFrom } from '../../src/core/rng.js';
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

test('generator is deterministic, in [0,1) and its state survives JSON', () => {
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
  // two values were drawn before the copy, so the copy continues with the third
  a.equal(storedRng(copy, 'rngState', () => 0)(), xs[2]);
});

test('creating a stored generator does not touch the holder until it draws', () => {
  const state = { gold: 3 };
  const before = clone(state);
  runRng(state);
  a.deepEqual(state, before);
  runRng(state)();
  a(Number.isInteger(state.rngState));
  // legacy saves without a seed get one derived from their content
  const other = { gold: 3 };
  runRng(other)();
  a.equal(other.rngState, state.rngState);
  a.notEqual(seedFrom({ gold: 3 }), seedFrom({ gold: 4 }));
});

test('same seed gives the same starting roster, shops and supply offers', () => {
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

test('saving and reloading mid-run continues the identical random sequence', () => {
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
  // save (JSON) and load (migrate + normalize) between the 3rd and 4th reroll
  const restored = V.normalize(P.migrate(clone(reloaded)));
  a.deepEqual([...before, ...shops(restored, 3)], expected);
});

test('core never calls Math.random: a run start, supply, shop, encounter and battle', () => {
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
    [{ id: 'C01', pos: 38 }],
    enemies.length ? enemies : [{ id: 'E01', pos: 3 }],
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
          : e.name.endsWith('.js')
            ? [path.join(dir, e.name)]
            : [],
      );
  for (const file of sources('src/core'))
    if (!file.endsWith('rng.js')) a(!/Math\.random/.test(fs.readFileSync(file, 'utf8')), file);
});

test('seeded battles repeat exactly and continue identically after transfer to the worker', () => {
  const make = () =>
    new Engine.Battle(
      ['C01', 'C04', 'C07', 'C25'].map((id, i) => ({ id, pos: 37 + i })),
      ['E03', 'E06', 'E01'].map((id, i) => ({ id, pos: 16 + i, star: 2 })),
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
  // run 40 ticks here, then hand the battle to the worker host like the page does
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

test('default export lists the helpers', () => {
  a.deepEqual(Object.keys(R).sort(), [
    'createRng',
    'nextSeed',
    'runRng',
    'seedFrom',
    'step',
    'storedRng',
  ]);
});
