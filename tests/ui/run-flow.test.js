// Migrated from the v0.15.18 suite test-v01510.cjs (tests for: ui).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';
import $augments from '../../src/core/augments.js';
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
  V = $preparation,
  W = $encounters,
  A = $augments,
  I = $items,
  N = require('../../src/legacy/patch-notes');
let count = 0;
const copy = (x) => JSON.parse(JSON.stringify(x)),
  near = (x, y) => a(Math.abs(x - y) < 1e-7);
function state(stage = 1, round = 3) {
  const s = P.initialize({
    gold: 25,
    health: 75,
    units: [],
    shop: ['C01', null, 'C24', 'C03', 'C05'],
  });
  Object.assign(s, { stage, round });
  s.wave = P.ordinal(s);
  return s;
}
function combat(s, winner = 'ally') {
  s.roundPhase = 'combat';
  return P.settleRound(s, { winner }, () => 0.99);
}
function supply(s, rng) {
  P.beginSupply(s, () => 0.1);
  P.toggleSupply(s, 0);
  P.toggleSupply(s, 1);
  return P.confirmSupply(s, rng);
}
test('patch exports separate approved decisions, Codex additions and notification changes', () => {
  a.equal(N.current, '0.15.18');
  const e = N.history.find((x) => x.version === '0.15.10');
  for (const key of ['approvedDecisions', 'additionalChanges', 'notificationChanges'])
    a(e[key].length > 0);
  const md = N.toMarkdown();
  for (const text of [
    'Codex 판단으로 추가·조정한 사항',
    '알림·팝업·표시 조건 변경',
    'T01~T41',
    '수동 새로고침 시 잠금 해제',
    '메타레벨',
  ])
    a(md.includes(text), text);
  a.equal(require('../../src/legacy/notice-policy').allows('T08'), false);
});
const els = new Map(),
  get = (id) => {
    if (!els.has(id))
      els.set(id, {
        id,
        innerHTML: '',
        textContent: '',
        hidden: false,
        style: {},
        attrs: {},
        handlers: {},
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(t, fn) {
          (this.handlers[t] ??= []).push(fn);
        },
        showModal() {
          this.open = true;
        },
        close() {
          this.open = false;
        },
        getBoundingClientRect() {
          return { left: 10, top: 10, width: 50, height: 50 };
        },
      });
    return els.get(id);
  },
  doc = {
    getElementById: get,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { appendChild() {}, classList: { remove() {} } },
  };
const ctx = vm.createContext({
  AutoData: D,
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: W,
  AutoPreparation: V,
  AutoItems: I,
  AutoAugments: A,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  AutoPatchNotes: N,
  document: doc,
  console,
  setTimeout,
  clearTimeout,
  clearInterval,
  localStorage: { setItem() {} },
});
const src = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(src.slice(0, src.lastIndexOf('\nload();')), ctx);
for (const p of ['interaction-ui', 'content-ui', 'catalog-ui', 'run-flow-ui'])
  vm.runInContext(fs.readFileSync('src/legacy/' + p + '.js', 'utf8'), ctx);
vm.runInContext(
  "function renderHealth(){}function renderBoard(){}function renderDetail(){}function renderDebug(){}function renderProgression(){}function setRecruitOpen(){} state=P.initialize({gold:25,health:75,units:[],shop:['C24']});setupRunFlowUI();setupCatalogUI();",
  ctx,
);
test('catalog hub has4 routes; dedicated catalogs include all records and preserve prior tools', () => {
  vm.runInContext('showCatalog()', ctx);
  a.equal((get('modalContent').innerHTML.match(/data-catalog=/g) || []).length, 4);
  vm.runInContext('showAugmentCatalog()', ctx);
  a.equal((get('modalContent').innerHTML.match(/class="catalog-card augment-/g) || []).length, 36);
  a(!get('modalContent').innerHTML.includes('data-augment='));
  vm.runInContext('showItemCatalog()', ctx);
  a.equal(
    (get('modalContent').innerHTML.match(/class="catalog-card item-tier-/g) || []).length,
    40,
  );
  for (const i of I.items) a(get('modalContent').innerHTML.includes(i.name));
  vm.runInContext('showRoster()', ctx);
  a.equal((get('modalContent').innerHTML.match(/data-free=/g) || []).length, 45);
  a(get('modalContent').innerHTML.includes('아바돈'));
  vm.runInContext('showBonds()', ctx);
  a.equal((get('modalContent').innerHTML.match(/data-recommend=/g) || []).length, 16);
  a(get('modalContent').innerHTML.includes('data-catalog-home'));
});
test('completion result renders exact2 choices and record-only notice with no ordinary next button', () => {
  const s = state(6, 5);
  combat(s);
  ctx.saved = copy(s);
  vm.runInContext('state=saved;showResult(state.lastResult)', ctx);
  const html = get('modalContent').innerHTML;
  a.equal((html.match(/data-completion=/g) || []).length, 2);
  a(!html.includes('data-continue'));
  a(html.includes('메타레벨(전체레벨) 경험치를 받지 않으며'));
  vm.runInContext("P.chooseCompletion(state,'end');showCompletionSummary();", ctx);
  a(get('modalContent').innerHTML.includes('기본 진행 구간 완료'));
});
test('shop preview is visible beside ownership/recommendations and disappears after actual merge', () => {
  vm.runInContext(
    "state=P.initialize({gold:25,health:75,units:[{id:'C24',star:1,uid:1,location:'board',pos:31},{id:'C24',star:1,uid:2,location:'bench',benchSlot:0}],shop:['C24']});state.recommendedBonds=['흑월'];nextUid=2;render();",
    ctx,
  );
  const html = get('shop').innerHTML;
  a(html.includes('구매 시 2성 합성'));
  a(html.includes('owned-badge'));
  a(html.includes('matched-bond'));
  vm.runInContext("recruit('C24',false,0)", ctx);
  a.equal(vm.runInContext('state.units.length', ctx), 1);
  a.equal(vm.runInContext('state.units[0].star', ctx), 2);
  a(!get('shop').innerHTML.includes('merge-preview'));
});
test('rendered supply outcome explicitly includes received/no extra gold and actual healedHP only', () => {
  for (const [rng, value] of [
    [() => 0.1, '+2 G'],
    [() => 0.9, '미획득'],
  ]) {
    const s = state(1, 1);
    supply(s, rng);
    ctx.saved = s;
    vm.runInContext('state=saved;showResult(state.lastResult)', ctx);
    a(get('modalContent').innerHTML.includes(value));
    a(!get('modalContent').innerHTML.includes('전투 승리 체력 회복'));
  }
  const s = state();
  s.health = 99;
  combat(s);
  ctx.saved = s;
  vm.runInContext('state=saved;showResult(state.lastResult)', ctx);
  a(get('modalContent').innerHTML.includes('+1 HP'));
});
test('patch UI shows same additional and notification records as exportedMD', () => {
  vm.runInContext('showPatchNotes()', ctx);
  a(get('modalContent').innerHTML.includes('Codex 판단으로 추가·조정한 사항'));
  a(get('modalContent').innerHTML.includes('기존 공통 알림T01~T41'));
});
test('item tooltip uses top-layer within modal and returns safely to body when hidden', () => {
  const el = get('itemPopover'),
    modal = get('modal'),
    anchor = {},
    body = doc.body;
  let open = false,
    shows = 0,
    hides = 0;
  el.matches = () => open;
  el.showPopover = () => {
    open = true;
    shows++;
  };
  el.hidePopover = () => {
    open = false;
    hides++;
  };
  modal.contains = (x) => x === anchor;
  modal.appendChild = (x) => {
    x.parentElement = modal;
  };
  body.appendChild = (x) => {
    x.parentElement = body;
  };
  el.parentElement = body;
  modal.open = true;
  ctx.anchor = anchor;
  vm.runInContext('raiseItemTooltip(anchor)', ctx);
  a.equal(el.parentElement, modal);
  a.equal(el.hidden, false);
  a.equal(shows, 1);
  vm.runInContext('raiseItemTooltip(anchor)', ctx);
  a.equal(shows, 1);
  vm.runInContext('hideItemDetail()', ctx);
  a.equal(el.hidden, true);
  a.equal(el.parentElement, body);
  a.equal(hides, 1);
  modal.open = false;
});
