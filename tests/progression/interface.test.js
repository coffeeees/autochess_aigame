// Migrated from the v0.15.18 suite test-interface.cjs (tests for: progression).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = require('../../src/legacy/data'),
  P = require('../../src/legacy/progression'),
  W = require('../../src/legacy/encounters'),
  V = require('../../src/legacy/preparation'),
  A = require('../../src/legacy/combat-visuals');
let count = 0;
const elements = new Map();
function element(id) {
  if (!elements.has(id))
    elements.set(id, {
      id,
      innerHTML: '',
      disabled: false,
      open: false,
      classList: { toggle() {}, add() {}, remove() {} },
      handlers: {},
      addEventListener(type, fn) {
        (this.handlers[type] ??= []).push(fn);
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
      getBoundingClientRect() {
        return { left: 100, top: 100, right: 800, bottom: 600 };
      },
    });
  return elements.get(id);
}
const document = {
  getElementById: element,
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  body: { classList: { remove() {} } },
  handlers: {},
  addEventListener(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  },
};
const context = vm.createContext({
  AutoItems: require('../../src/legacy/items'),
  AutoData: D,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: W,
  AutoPreparation: V,
  document,
  console,
  setTimeout,
  clearTimeout,
  clearInterval,
  localStorage: { setItem() {} },
});
const code = fs.readFileSync('src/legacy/prototype.js', 'utf8'),
  cut = code.lastIndexOf('\nload();');
a(cut > 0);
vm.runInContext(code.slice(0, cut), context);
vm.runInContext(fs.readFileSync('src/legacy/interaction-ui.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('src/legacy/content-ui.js', 'utf8'), context);
vm.runInContext(
  "state={units:[{uid:1,id:'C01',location:'board',star:1,pos:38}],inventory:[],recommendedBonds:[],stage:1,round:1,roundPhase:'supply',supplyOffer:{options:['I01','I02','I03','I04'],selected:[1]}};function setRecruitOpen(){} function hideItemDetail(){} function suppressDragClick(){return false;} setupContentUI();",
  context,
);
test('new run starts random two1G/one2G in separate bench slots with7G, leaves existing saves alone', () => {
  vm.runInContext('var selectedDifficulty=1;fresh();', context);
  const s = JSON.parse(vm.runInContext('JSON.stringify(state)', context));
  a.equal(s.gold, 7);
  a.equal(s.units.length, 3);
  a(s.units.every((u) => u.location === 'bench' && u.pos === -1));
  a.equal(new Set(s.units.map((u) => u.benchSlot)).size, 3);
  a.deepEqual(s.units.map((u) => D.byId(u.id).cost).sort(), [1, 1, 2]);
  a.equal(s.skipDeploymentWarning, false);
  const old = P.initialize({
    gold: 10,
    health: 100,
    units: [{ id: 'C01', uid: 1, location: 'board', pos: 38, star: 1 }],
  });
  P.migrate(old);
  a.equal(old.units[0].location, 'board');
});
