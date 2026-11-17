'use strict';
const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = require('./dist/data'),
  P = require('./dist/progression'),
  V = require('./dist/preparation'),
  Policy = require('./dist/notice-policy');
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log('PASS ' + name);
}
let nextTimer = 0;
const timers = new Map(),
  animations = [];
class Node {
  constructor(id) {
    this.id = id;
    this.style = {};
    this.innerHTML = '';
    this.hidden = false;
    this.open = false;
    this.handlers = {};
    this.attrs = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  addEventListener(t, f) {
    (this.handlers[t] ??= []).push(f);
  }
  getBoundingClientRect() {
    return { left: 10, top: 20, width: 80, height: 60 };
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
  animate(frames, options) {
    animations.push({ id: this.id, frames, options });
    return { cancel() {}, finished: Promise.resolve() };
  }
}
const nodes = new Map(),
  el = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Node(id));
    return nodes.get(id);
  },
  document = {
    getElementById: el,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    body: { classList: { remove() {} } },
  };
const context = vm.createContext({
  combatView: null,
  AutoData: D,
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: require('./dist/encounters'),
  AutoPreparation: V,
  AutoNoticePolicy: Policy,
  AutoItems: require('./dist/items'),
  document,
  console,
  localStorage: { setItem() {} },
  setTimeout: (fn, ms) => {
    const id = ++nextTimer;
    timers.set(id, { fn, ms });
    return id;
  },
  clearTimeout: (id) => timers.delete(id),
  clearInterval() {},
  matchMedia: () => ({ matches: false }),
});
const source = fs.readFileSync('dist/prototype.js', 'utf8');
vm.runInContext(source.slice(0, source.lastIndexOf('\nload();')), context);
vm.runInContext(fs.readFileSync('dist/interaction-ui.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('dist/content-ui.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('dist/stage-ui.js', 'utf8'), context);
const run = (s) => vm.runInContext(s, context);
run(
  'var events=[];queueMergeEffect=(keep,removed)=>events.push({center:keep.uid,star:keep.star,parts:removed.map(u=>u.uid)});render=()=>{};save=()=>{};',
);
function state(units = []) {
  context.seed = units;
  run(
    "state=P.initialize({units:seed,inventory:[],health:100,gold:20,shop:[]});battle=null;message='';selected=null;events=[];",
  );
}
test('all41 IDs have exactly12 retained,28 silent and one approved T28 route', () => {
  a.equal(Policy.retained.length, 12);
  a.equal(Policy.deleted.length, 28);
  for (let i = 1; i <= 41; i++) {
    const id = 'T' + String(i).padStart(2, '0');
    context.noticeId = id;
    const allowed = run("notify(noticeId,'検証')");
    a.equal(allowed, Policy.retained.includes(id) || id === 'T28');
  }
  const audit = require('./dist/notice-audit');
  a.equal(audit.rows.filter((r) => r.status === '유지').length, 12);
  a.equal(audit.rows.filter((r) => r.status.startsWith('삭제')).length, 28);
  a(audit.rows.find((r) => r.id === 'T28').status.includes('승인'));
});
test('retained notices last3seconds, restart on a new retained event and silent actions do not restart', () => {
  timers.clear();
  run("notify('T06','골드가 부족합니다.')");
  a.equal(timers.size, 1);
  const first = [...timers.keys()][0];
  a.equal(timers.get(first).ms, 3000);
  run("notify('T07','영입 성공')");
  a(timers.has(first));
  a.equal(run('message'), '골드가 부족합니다.');
  run("notify('T15','중복')");
  a(!timers.has(first));
  const current = [...timers.keys()][0];
  timers.get(current).fn();
  const exit = [...timers.values()].find((t) => t.ms === 180);
  a(exit);
  exit.fn();
  a(el('message').hidden);
});
test('drag routing keeps only specified errors and removes every success and invalid-drop message', () => {
  const entries = [
    ['unit', { ok: true }, 'T10'],
    ['item', { ok: true }, 'T11'],
    ['unit', { ok: false, message: '아군 진영 아래 4줄에만 배치할 수 있습니다.' }, 'T14'],
    ['unit', { ok: false, message: '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.' }, 'T15'],
    ['unit', { ok: false, message: '현재 레벨에서는 4명까지 배치할 수 있습니다.' }, 'T16'],
    ['unit', { ok: false, message: '대기석이 가득 찼습니다.' }, 'T19'],
    ['item', { ok: false, message: '캐릭터당 아이템은 최대 3개입니다.' }, 'T23'],
    ['item', { ok: false, message: '동일한 3티어 장비는 중복 장착할 수 없습니다.' }, 'T24'],
    ['item', { ok: false }, 'T25'],
    ['item', { ok: false, message: '아이템을 버렸습니다. 되돌리기로 복원할 수 있습니다.' }, 'T26'],
  ];
  for (const [kind, result, id] of entries) a.equal(Policy.dragId(kind, result), id);
});
test('T28 keeps rejection behavior and uses user-approved wording for all four failure causes', () => {
  state([{ uid: 1, id: 'C01', star: 1, location: 'bench', benchSlot: 0 }]);
  run("state.inventory=[{uid:'eq',id:'I01',equippedTo:1}]");
  const checks = [
    ['state.done=true', 'eq', '원정이 종료되어 아이템을 버릴 수 없습니다.'],
    [
      "state.done=false;state.roundPhase='combat'",
      'eq',
      '준비 단계에서만 아이템을 버릴 수 있습니다.',
    ],
    ["state.roundPhase='prepare'", 'missing', '아이템을 찾을 수 없습니다.'],
    ['', 'eq', '장착 중인 아이템은 먼저 보관함으로 회수하세요.'],
  ];
  for (const [setup, uid, text] of checks) {
    run(setup);
    context.refusedUid = uid;
    const before = run('JSON.stringify(state)');
    run('discardSelectedItem(refusedUid)');
    a.equal(run('message'), text);
    a.equal(run('JSON.stringify(state)'), before);
  }
});
test('board merge center retains its unit and returns only consumed copies equipment', () => {
  state([
    { uid: 1, id: 'C01', star: 1, location: 'bench', pos: -1, benchSlot: 0 },
    { uid: 2, id: 'C01', star: 1, location: 'board', pos: 31 },
    { uid: 3, id: 'C01', star: 1, location: 'bench', pos: -1, benchSlot: 5 },
  ]);
  run("state.inventory=[{uid:'a',id:'I01',equippedTo:1},{uid:'b',id:'I02',equippedTo:2}];merge();");
  a.equal(run('state.units.length'), 1);
  a.equal(run('state.units[0].uid'), 2);
  a.equal(run('state.units[0].star'), 2);
  a.equal(run('events[0].center'), 2);
  a.equal(run('events[0].parts.length'), 2);
  a.equal(run('state.inventory[0].equippedTo'), null);
  a.equal(run('state.inventory[1].equippedTo'), 2);
  a.equal(run('message'), '');
});
test('bench merge anchors the leftmost slot rather than source array order', () => {
  state([
    { uid: 1, id: 'C02', star: 1, location: 'bench', pos: -1, benchSlot: 8 },
    { uid: 2, id: 'C02', star: 1, location: 'bench', pos: -1, benchSlot: 1 },
    { uid: 3, id: 'C02', star: 1, location: 'bench', pos: -1, benchSlot: 4 },
  ]);
  run('merge()');
  a.equal(run('state.units[0].uid'), 2);
  a.equal(run('state.units[0].benchSlot'), 1);
  a.equal(run('events[0].center'), 2);
  a.equal(run('state.gold'), 20);
});
test('nine copies still chain to one3star with two consumed units per visual event', () => {
  state(
    Array.from({ length: 9 }, (_, i) => ({
      uid: i + 1,
      id: 'C03',
      star: 1,
      location: 'bench',
      pos: -1,
      benchSlot: i,
    })),
  );
  run('merge()');
  a.equal(run('state.units.length'), 1);
  a.equal(run('state.units[0].star'), 3);
  a.equal(run('events.length'), 4);
  a(run('events.every(e=>e.parts.length===2)'));
  a.equal(run('message'), '');
});
test('base inventory has12 slots and all17 overflow items remain visible/reachable without mutation', () => {
  state();
  run('renderInventory()');
  a.equal((el('inventory').innerHTML.match(/빈 보관함 칸/g) || []).length, 12);
  context.looseItems = Array.from({ length: 17 }, (_, i) => ({
    uid: 'gear' + i,
    id: 'I' + String(i + 1).padStart(2, '0'),
    equippedTo: null,
  }));
  run("state.inventory=[...looseItems,{uid:'owned',id:'I02',equippedTo:1}]");
  const before = run('JSON.stringify(state.inventory)');
  run('renderInventory()');
  a.equal((el('inventory').innerHTML.match(/data-item-uid=/g) || []).length, 17);
  a.equal((el('inventory').innerHTML.match(/빈 보관함 칸/g) || []).length, 1);
  a(!el('inventoryOverflow').hidden);
  a.equal(el('inventoryOverflow').textContent, '추가 5개 ↓');
  a.equal(run('JSON.stringify(state.inventory)'), before);
});
test('empty combat is disabled and cannot settle even with forced confirmation; supplies stay available', () => {
  state();
  run(
    'state.round=3;state.skipDeploymentWarning=true;renderInventory=()=>{};renderShell=()=>{};renderProgression();',
  );
  a(el('fightBtn').disabled);
  a.equal(el('fightBtn').textContent, '아군 배치 필요');
  a(el('fightBtn').title.includes('1명'));
  const before = run('JSON.stringify(state)');
  run('startBattle(true)');
  a.equal(run('JSON.stringify(state)'), before);
  run("state.units=[{uid:1,id:'C01',location:'board',star:1,pos:31}];renderProgression()");
  a(!el('fightBtn').disabled);
  run('state.units=[];state.round=1;renderProgression()');
  a(!el('fightBtn').disabled);
});
test('level animation runs only on real level increases, not initialization or XP-only updates', () => {
  vm.runInContext(fs.readFileSync('dist/presentation-effects.js', 'utf8'), context);
  el('gameView').hidden = false;
  run('observeLevelEffects(3);observeLevelEffects(3)');
  a.equal(animations.length, 0);
  run('observeLevelEffects(4)');
  a.equal(animations.length, 1);
  run('observeLevelEffects(4);observeLevelEffects(3)');
  a.equal(animations.length, 1);
  el('gameView').hidden = true;
  run('observeLevelEffects(5)');
  a.equal(animations.length, 1);
});
console.log('\n' + count + ' UI/notice refinement tests passed.');
