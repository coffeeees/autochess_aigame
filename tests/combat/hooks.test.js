// Battle extension hooks (stage 3): effects are registered, not patched onto the prototype.
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

test('built-in extensions and their documented order', () => {
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

test('around layers run by order, not by registration order', () => {
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

test('events run in their own order and see the battle', () => {
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

test('subclass extensions do not leak into the base class; use() is idempotent', () => {
  class WithVfx extends Battle {}
  Vfx.install(WithVfx);
  Vfx.install(WithVfx);
  a.deepEqual(
    WithVfx.extensions.map((e) => e.name),
    ['vfx-events'],
  );
  a(!Battle.extensions.some((e) => e.name === 'vfx-events'));
  F.install(Battle); // already registered: no duplicate
  a.equal(Battle.extensions.filter((e) => e.name === 'item-effects').length, 1);
  // same seeded fight: identical outcome with or without VFX recording
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

test('core code never assigns Battle.prototype methods outside hooks.ts', () => {
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
