'use strict';
const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = require('./src/legacy/data'),
  P = require('./src/legacy/progression'),
  W = require('./src/legacy/encounters'),
  V = require('./src/legacy/preparation'),
  A = require('./src/legacy/combat-visuals');
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log('PASS ' + name);
}
// A small DOM adapter exercises real rendering/handlers without a browser runtime.
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
  AutoItems: require('./src/legacy/items'),
  AutoData: D,
  AutoNoticePolicy: require('./src/legacy/notice-policy'),
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
test('every bond lists all matching characters with correct lock/ownership status', () => {
  for (const bond of D.synergies) {
    context.bondId = bond.id;
    vm.runInContext('showBondMembers(bondId)', context);
    const html = element('modalContent').innerHTML,
      members = D.roster.filter((t) => D.hasBond(t, bond.name));
    a.equal((html.match(/data-inspect=/g) || []).length, members.length);
    for (const t of members) {
      a(html.includes('data-inspect="' + t.id + '"'));
      a(html.includes(t.name));
    }
    a.equal((html.match(/🔒 미해금/g) || []).length, members.filter((t) => !t.playable).length);
  }
  vm.runInContext("showBondMembers('흑월')", context);
  a(element('modalContent').innerHTML.includes('전장 배치 중'));
});
test('member detail returns to the same bond and does not expose free recruit for drafts', () => {
  vm.runInContext("inspect('C01','흑월')", context);
  a(element('modalContent').innerHTML.includes('data-bond-members="흑월"'));
  a(!element('modalContent').innerHTML.includes('data-back-roster'));
  vm.runInContext("showBondMembers('철혈')", context);
  a(!element('modalContent').innerHTML.includes('data-free'));
});
test('backdrop closes only an outside press+release and preserves supply offer/selection', () => {
  const modal = element('modal'),
    before = vm.runInContext('JSON.stringify(state)', context),
    send = (type, target, x, y) => {
      for (const handler of modal.handlers[type] || [])
        handler({ target, button: 0, clientX: x, clientY: y });
    };
  modal.showModal();
  send('pointerdown', modal, 200, 200);
  send('click', modal, 20, 20);
  a(modal.open);
  send('pointerdown', modal, 20, 20);
  send('click', modal, 20, 20);
  a(!modal.open);
  a.equal(vm.runInContext('JSON.stringify(state)', context), before);
  vm.runInContext('showSupply()', context);
  a(modal.open);
  a(!element('closeModal').disabled);
  a(element('modalContent').innerHTML.includes('1 / 2개 선택'));
});
test('all ten traits have distinct colors and summoned attacks retain their element', () => {
  a.equal(Object.keys(A.traitPalette).length, 10);
  a.equal(new Set(Object.values(A.traitPalette)).size, 10);
  a.equal(A.effectStyle('물').color, '#55baff');
  a.equal(A.effectStyle('대지').color, '#b48755');
  a.equal(A.effectStyle('신성').color, '#fff4c6');
  a.equal(A.effectStyle('번개').color, '#ffe45c');
  a.equal(A.effectStyle('몬스터').color, '#d5cbe3');
  const units = [
      { uid: 1, id: 'C11', pos: 8, summonKind: 'fire', stats: { RNG: 2 } },
      { uid: 2, pos: 9, team: 'enemy' },
    ],
    out = A.plan([{ kind: 'damage', source: 1, target: 2, amount: 5 }], units);
  a.equal(out[0].sourceTrait, '화염');
});
test('augment modal shows one tier, three distinct full effects and explicit confirmation buttons', () => {
  context.AutoAugments = require('./src/legacy/augments');
  vm.runInContext(fs.readFileSync('src/legacy/stage-ui.js', 'utf8'), context);
  vm.runInContext(
    "state.augments=[];state.roundPhase='augment';state.augmentState={version:1,completedPicks:[],skippedPicks:[],pendingPick:{node:'3-3',pick:2,tier:'gold',optionIds:['G01','G08','G12']}};showAugment();",
    context,
  );
  const html = element('modalContent').innerHTML;
  a(html.includes('2 / 3'));
  a(html.includes('3-3 진입 전'));
  a(html.includes('골드 증강'));
  a.equal((html.match(/data-augment=/g) || []).length, 3);
  for (const id of ['G01', 'G08', 'G12']) a(html.includes(context.AutoAugments.byId(id).text));
  a.equal((html.match(/선택 확정/g) || []).length, 3);
  a(element('modal').open);
});
test('recruit clicks stay inside even after the bought card is detached during rerender', () => {
  vm.runInContext(
    'var recruitTransitions=[];setRecruitOpen=function(open){recruitTransitions.push(open);};',
    context,
  );
  const detached = { closest: () => null },
    dispatch = (path) => {
      for (const fn of document.handlers.click) fn({ target: detached, composedPath: () => path });
    };
  dispatch([detached, { id: 'shop' }, { id: 'recruitPopover' }]);
  a.equal(context.recruitTransitions.length, 0);
  dispatch([detached, { id: 'openRecruitBtn' }]);
  a.equal(context.recruitTransitions.length, 0);
  dispatch([detached, { id: 'board' }]);
  a.deepEqual(Array.from(context.recruitTransitions), [false]);
});
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
console.log('\n' + count + ' interface/element tests passed.');
