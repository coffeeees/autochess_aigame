// Stage 4 UI: save failure (T42), damaged save (T43) and battle cancelled by a
// reload (T44, D4 a) in prototype.js, run in a vm like the other UI tests.
import { test } from 'vitest';
import $shopCore from '../../src/core/shop.ts';
import $mergeCore from '../../src/core/merge.ts';
import $runCore from '../../src/core/run.ts';
import a from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import D from '../../src/core/data/units.js';
import W from '../../src/core/encounters.js';
import I from '../../src/core/items.js';
import V from '../../src/core/preparation.js';
import P from '../../src/core/progression.js';
import Save from '../../src/core/save.ts';

const Policy = require('../../src/legacy/notice-policy');
const KEY = 'starlight-onecost-v1';

function setup(initial = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    fail: false,
    writes: 0,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem(k, v) {
      if (this.fail) throw new Error('QuotaExceededError');
      this.writes++;
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
  };
  const nodes = new Map();
  const el = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        id,
        style: {},
        hidden: false,
        textContent: '',
        innerHTML: '',
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {},
        setAttribute() {},
      });
    return nodes.get(id);
  };
  const shown = [];
  const context = vm.createContext({
    combatView: null,
    selectedDifficulty: 1, // defined by shell-ui.js in the page
    AutoData: D,
    AutoEngine: {},
    AutoProgression: P,
    AutoWorld: W,
    AutoPreparation: V,
    AutoShop: $shopCore,
    AutoMerge: $mergeCore,
    AutoRun: $runCore,
    AutoNoticePolicy: Policy,
    AutoItems: I,
    AutoSave: Save,
    document: {
      getElementById: el,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      body: { classList: { remove() {} } },
    },
    console,
    localStorage: storage,
    setTimeout: () => 0,
    clearTimeout() {},
    clearInterval() {},
    matchMedia: () => ({ matches: false }),
  });
  const source = fs.readFileSync('src/legacy/prototype.js', 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nload();')), context);
  const run = (s) => vm.runInContext(s, context);
  // record every notice that passes the policy
  context.__shown = shown;
  run('const __tell = tell; tell = (s) => { __shown.push(s); return __tell(s); };');
  return { run, storage, store, shown };
}

test('T42: a failed save is reported once per failure streak', () => {
  const { run, storage, shown } = setup();
  run('fresh()');
  storage.fail = true;
  run('save(); save(); save();');
  a.equal(shown.filter((m) => m.includes('저장하지 못했습니다')).length, 1);
  storage.fail = false;
  run('save()');
  storage.fail = true;
  run('save()');
  a.equal(shown.filter((m) => m.includes('저장하지 못했습니다')).length, 2);
  a(Policy.allows('T42') && Policy.allows('T43') && Policy.allows('T44'));
});

test('T43: a damaged save is backed up, a new run starts and the notice waits for the game', () => {
  const { run, store, shown } = setup({ [KEY]: '{"version":2,"units":' });
  run('load()');
  const backups = [...store.keys()].filter((k) => k.startsWith(KEY + '-backup-'));
  a.equal(backups.length, 1);
  a.equal(store.get(backups[0]), '{"version":2,"units":');
  a(!store.has(KEY));
  a.equal(run('state.stage + "-" + state.round'), '1-1');
  a.equal(run('loadNotice.id'), 'T43');
  a(run('loadNotice.text').includes(backups[0]));
  run('showLoadNotice()');
  a(shown.at(-1).includes('손상되어 새 원정을 시작했습니다'));
  a.equal(run('loadNotice'), null);
});

test('T44: reopening during a battle returns to preparation, takes the bonus back and saves', () => {
  const save = JSON.parse(fs.readFileSync('tests/fixtures/v0.15.18-mid-battle.json', 'utf8'));
  const key = P.label(save);
  save.gold += 5;
  save.bonusLootLedger = { [key]: { kind: 'gold', amount: 5, key } };
  const { run, store, storage } = setup({ [KEY]: JSON.stringify(save) });
  run('load()');
  a.equal(run('state.roundPhase'), 'prepare');
  a.equal(run('state.gold'), save.gold - 5);
  a.equal(run('loadNotice.id'), 'T44');
  a(run('loadNotice.text').includes('보너스 골드 5G'));
  // the corrected state is written back so a second reload does not repeat it
  a.equal(storage.writes, 1);
  const stored = JSON.parse(store.get(KEY));
  a.equal(stored.roundPhase, 'prepare');
  a.equal(stored.gold, save.gold - 5);
  a.deepEqual(stored.bonusLootLedger, {});
});

test('a normal save loads without notices or writes', () => {
  const raw = fs.readFileSync('tests/fixtures/v0.15.18-prepare-with-augment.json', 'utf8');
  const { run, storage } = setup({ [KEY]: raw });
  run('load()');
  a.equal(run('loadNotice'), null);
  a.equal(storage.writes, 0);
  a.equal(run('state.augments.join()'), JSON.parse(raw).augments.join());
});
