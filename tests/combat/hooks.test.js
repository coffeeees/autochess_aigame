// 전투 확장 훅(3단계): 효과는 prototype을 덮어쓰지 않고 등록한다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Engine from '../../src/core/combat/battle.js';
import { AROUND } from '../../src/core/combat/hooks.ts';
import F from '../../src/core/combat/item-effects.js';
import AF from '../../src/core/combat/augment-effects.js';
import Bonds from '../../src/core/combat/bond-effects.js';
import Vfx from '../../src/core/combat/vfx-events.js';

const { Battle } = Engine;
const fight = (Class = Battle) =>
  new Class([{ id: 'C01', pos: 38 }], [{ id: 'E01', pos: 17 }], { rng: () => 0.5 });

test('기본 확장과 문서에 적은 순서', () => {
  a.deepEqual(
    Battle.extensions.map((e) => e.name),
    ['item-effects', 'augment-effects', 'bond-effects'],
  );
  a.equal(F.extension.order, 10);
  a.equal(AF.extension.order, 20);
  a.equal(Vfx.extension.order, 90);
  a.deepEqual(
    [Bonds.extension, F.extension, AF.extension].map((e) => e.on.start.order),
    [10, 20, 30],
  );
  a.deepEqual(
    [F.extension, AF.extension, Bonds.extension].map((e) => e.on.update.order),
    [10, 20, 30],
  );
});

test('around 층은 등록 순서가 아니라 order 순서로 실행된다', () => {
  class Probe extends Battle {}
  const calls = [];
  const layer = (name, order) => ({
    name,
    order,
    around: {
      log(inner, kind, message, extra) {
        calls.push('in:' + name);
        const r = inner(kind, message, extra);
        calls.push('out:' + name);
        return r;
      },
    },
  });
  Probe.use(layer('outer', 95));
  Probe.use(layer('inner', 5));
  Probe.use(layer('middle', 15));
  const b = fight(Probe);
  calls.length = 0;
  b.log('system', 'probe');
  a.deepEqual(calls, ['in:outer', 'in:middle', 'in:inner', 'out:inner', 'out:middle', 'out:outer']);
});

test('이벤트는 각자의 순서로 실행되고 전투 객체를 받는다', () => {
  class Probe extends Battle {}
  const seen = [];
  Probe.use({
    name: 'late',
    on: { update: { order: 99, run: (b) => seen.push(['late', b.time]) } },
  });
  Probe.use({
    name: 'early',
    on: { update: { order: 1, run: (b) => seen.push(['early', b.time]) } },
  });
  const b = fight(Probe);
  b.tick();
  a.deepEqual(
    seen.map((x) => x[0]),
    ['early', 'late'],
  );
  a(seen.every((x) => x[1] === b.time));
});

test('하위 클래스 확장은 기본 클래스에 새지 않고, use()는 한 번만 등록한다', () => {
  class WithVfx extends Battle {}
  Vfx.install(WithVfx);
  Vfx.install(WithVfx);
  a.deepEqual(
    WithVfx.extensions.map((e) => e.name),
    ['vfx-events'],
  );
  a(!Battle.extensions.some((e) => e.name === 'vfx-events'));
  F.install(Battle); // 이미 등록됨: 중복 없음
  a.equal(Battle.extensions.filter((e) => e.name === 'item-effects').length, 1);
  // 같은 시드 전투: VFX 기록이 있든 없든 결과가 같다
  const run = (Class) => {
    const b = new Class(
      [
        { id: 'C07', pos: 38 },
        { id: 'C25', pos: 39 },
      ],
      [
        { id: 'E03', pos: 17 },
        { id: 'E01', pos: 3 },
      ],
      { seed: 9 },
    );
    for (let i = 0; i < 4000 && !b.result; i++) b.tick();
    return [b.result, b.units.map((u) => [u.uid, u.hp])];
  };
  a.deepEqual(run(WithVfx), run(Battle));
});

test('core 코드는 hooks.ts 밖에서 Battle.prototype 메서드를 바꾸지 않는다', () => {
  for (const name of AROUND) a.equal(typeof Battle.prototype[name], 'function');
  a.deepEqual(Object.keys(Battle.coreMethods).sort(), [...AROUND].sort());
  const files = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : /\.(js|ts)$/.test(e.name)
            ? [path.join(dir, e.name)]
            : [],
      );
  for (const file of [...files('src/core'), ...files('src/worker')]) {
    if (file.endsWith('hooks.ts')) continue;
    a(!/\.prototype\.\w+\s*=/.test(fs.readFileSync(file, 'utf8')), file);
  }
});
