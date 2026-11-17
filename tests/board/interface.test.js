// Migrated from the v0.15.18 suite test-interface.cjs (tests for: board).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $data from '../../src/core/data/units.js';
import $encounters from '../../src/core/encounters.js';
import $items from '../../src/core/items.js';
import $preparation from '../../src/core/preparation.js';
import $progression from '../../src/core/progression.js';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = $data,
  P = $progression,
  W = $encounters,
  V = $preparation,
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
  AutoItems: $items,
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
test('deployment warning counts empty/partial/full with P12 and suppression persists only for the run', () => {
  const s = P.initialize({ units: [], gold: 7, health: 100 });
  a(V.deploymentStatus(s).shouldWarn);
  s.units = [{ location: 'board' }, { location: 'board' }, { location: 'board' }];
  a(!V.deploymentStatus(s).shouldWarn);
  s.augments = ['P12'];
  a.equal(V.deploymentStatus(s).missing, 1);
  a(V.deploymentStatus(s).shouldWarn);
  s.skipDeploymentWarning = true;
  a(!V.deploymentStatus(P.migrate(JSON.parse(JSON.stringify(s)))).shouldWarn);
  P.initialize(s);
  a.equal(s.skipDeploymentWarning, false);
});
test('deployment dialog cancel keeps preparation; confirmation alone saves checkbox and continues once', () => {
  vm.runInContext(
    "state.roundPhase='prepare';state.skipDeploymentWarning=false;showDeploymentWarning();var originalStartForTest=startBattle,confirmedStarts=[];startBattle=function(confirmed){confirmedStarts.push(confirmed);};",
    context,
  );
  a(element('modalContent').innerHTML.includes('이번 원정에서 다시 묻지 않기'));
  element('skipDeploymentWarning').checked = true;
  const dispatch = (selector) => {
    for (const fn of element('modalContent').handlers.click)
      fn({ target: { closest: (s) => (s === selector ? {} : null) } });
  };
  dispatch('[data-cancel-deployment]');
  a.equal(vm.runInContext('state.skipDeploymentWarning', context), false);
  a.equal(context.confirmedStarts.length, 0);
  vm.runInContext('showDeploymentWarning()', context);
  dispatch('[data-confirm-deployment]');
  a.equal(vm.runInContext('state.skipDeploymentWarning', context), true);
  a.deepEqual(Array.from(context.confirmedStarts), [true]);
  a(!element('modal').open);
  vm.runInContext('startBattle=originalStartForTest;', context);
});
test('empty battlefield is blocked even with confirmation while safe supply still works', () => {
  vm.runInContext(
    "function render(){} function enemyFormation(){return [{id:'E01'},{id:'E06'}];} state=P.initialize({units:[],gold:7,health:100,shop:[]});state.round=3;state.skipDeploymentWarning=true;startBattle();",
    context,
  );
  a.equal(vm.runInContext('state.roundPhase', context), 'prepare');
  a.equal(vm.runInContext('state.health', context), 100);
  a.equal(vm.runInContext('state.gold', context), 7);
  vm.runInContext('startBattle(true)', context);
  a.equal(vm.runInContext('state.gold', context), 7);
  vm.runInContext(
    'state=P.initialize({units:[],gold:7,health:100,shop:[]});startBattle();',
    context,
  );
  a.equal(vm.runInContext('state.roundPhase', context), 'supply');
  a(element('modalContent').innerHTML.includes('보급품 2개를 선택하세요'));
});
test('purchase at10 reserve units is blocked without payment while a completing merge still succeeds', () => {
  vm.runInContext(
    "state=P.initialize({health:100,gold:7,shop:['C12'],units:D.playableIds.slice(0,10).map((id,i)=>({uid:i+1,id,star:1,location:'bench',pos:-1,benchSlot:i}))});nextUid=10;recruit('C12',false,0);",
    context,
  );
  a.equal(vm.runInContext('state.gold', context), 7);
  a.equal(vm.runInContext('state.units.length', context), 10);
  vm.runInContext(
    "state.units[0].id='C03';state.units[1].id='C03';state.units[2].id='C15';state.shop=['C03'];recruit('C03',false,0);",
    context,
  );
  a.equal(vm.runInContext('state.gold', context), 6);
  a.equal(vm.runInContext('state.units.length', context), 9);
  a(vm.runInContext("state.units.some(u=>u.id==='C03'&&u.star===2)", context));
});
