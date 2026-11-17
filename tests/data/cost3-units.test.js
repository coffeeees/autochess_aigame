// Migrated from the v0.15.18 suite test-v0159.cjs (tests for: data).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  D = require('../../src/legacy/data'),
  P = require('../../src/legacy/progression'),
  V = require('../../src/legacy/preparation'),
  W = require('../../src/legacy/encounters'),
  { Battle, mitigatedDamage } = require('../../src/legacy/engine'),
  H = require('../../src/legacy/health-effects');
require('../../src/legacy/bond-effects').init = (b) => {
  b.bondPulses = { ally: Infinity, enemy: Infinity };
};
let count = 0;
const near = (x, y) => a(Math.abs(x - y) < 1e-7, `${x} != ${y}`);
const battle = (
  id,
  allies = [],
  enemies = [
    { id: 'E06', pos: 24 },
    { id: 'E03', pos: 23 },
    { id: 'E01', pos: 3 },
  ],
) => new Battle([{ id, pos: 31 }, ...allies], enemies, { rng: () => 0.99 });
test('all45 names exactly match approved ID mapping, with45 playable', () => {
  const expected =
    '녹스 아즈칼 태건 리엔 루아 카인 유하 벨모르 라칸 울프릭 둔가르 엘리엘 브룬 적호 베스퍼 토비 이그니스 아우라 설아 진무 오르페 골룸바 로제트 유키나 지그 흐로드 비올라 시그룬 카르도 네레이드 홍련 제피로 아그니 아스텔 메두라 참월 카르미나 오르딘 글라시아 월하 뇌진 바하무트 라이진 백야 아바돈'.split(
      ' ',
    );
  a.deepEqual(
    D.roster.map((u) => u.name),
    expected,
  );
  a.equal(D.playableIds.length, 45);
  a(D.roster.filter((u) => u.cost > 3).every((u) => u.playable));
});
function clock(reduced = false) {
  let now = 0,
    seq = 0,
    jobs = new Map(),
    values = [],
    bursts = 0,
    cleaned = 0;
  const h = H.create({
    paint: (n) => values.push(n),
    burst: () => {
      bursts++;
      return () => cleaned++;
    },
    reduced: () => reduced,
    later: (fn, ms) => {
      jobs.set(++seq, { fn, due: now + ms });
      return seq;
    },
    clear: (id) => jobs.delete(id),
  });
  return {
    h,
    values,
    get now() {
      return now;
    },
    get pending() {
      return jobs.size;
    },
    get bursts() {
      return bursts;
    },
    get cleaned() {
      return cleaned;
    },
    run() {
      while (jobs.size) {
        const [id, j] = [...jobs].sort((a, b) => a[1].due - b[1].due)[0];
        jobs.delete(id);
        now = j.due;
        j.fn();
      }
    },
  };
}
const elements = new Map(),
  el = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        innerHTML: '',
        textContent: '',
        style: {},
        disabled: false,
        checked: false,
        hidden: false,
        open: false,
        setAttribute() {},
        addEventListener() {},
        classList: { add() {}, remove() {}, toggle() {} },
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 50, height: 50 };
        },
      });
    return elements.get(id);
  };
const ctx = vm.createContext({
  AutoData: D,
  AutoItems: require('../../src/legacy/items'),
  AutoEngine: {},
  AutoProgression: P,
  AutoWorld: W,
  AutoPreparation: V,
  AutoNoticePolicy: require('../../src/legacy/notice-policy'),
  document: {
    getElementById: el,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { classList: { remove() {} } },
  },
  console,
  setTimeout,
  clearTimeout,
  clearInterval,
  localStorage: { setItem() {} },
});
const code = fs.readFileSync('src/legacy/prototype.js', 'utf8');
vm.runInContext(code.slice(0, code.lastIndexOf('\nload();')), ctx);
vm.runInContext(fs.readFileSync('src/legacy/interaction-ui.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/legacy/content-ui.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/legacy/drag-sales.js', 'utf8'), ctx);
vm.runInContext(
  "function renderHealth(){}function renderBoard(){}function renderDetail(){}function renderDebug(){}function renderProgression(){}function setRecruitOpen(){}function hideItemDetail(){}function renderOdds(){} state=V.normalize(P.initialize({gold:100,health:100,shop:['C24','C01','C25',null,null],units:[{id:'C24',uid:1,location:'board',pos:31,star:1},{id:'C01',uid:2,location:'bench',benchSlot:0,star:1}]}));state.recommendedBonds=['흑월'];nextUid=2;",
  ctx,
);
const nodes = new Set(),
  durations = [],
  animations = [];
let reduced = false;
const fx = vm.createContext({
  document: {
    querySelector: () => ({
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 40, height: 40 }),
    }),
    body: { appendChild: (n) => nodes.add(n) },
    createElement: () => ({
      style: {},
      remove() {
        nodes.delete(this);
      },
      animate(frames, options) {
        durations.push(options.duration);
        let resolve, reject;
        const finished = new Promise((a, b) => {
          resolve = a;
          reject = b;
        });
        const job = {
          finished,
          cancel() {
            reject(Error('cancelled'));
          },
          resolve,
        };
        animations.push(job);
        return job;
      },
    }),
  },
  $: (id) => (id === 'gameView' ? { hidden: false } : { open: false }),
  matchMedia: () => ({ matches: reduced }),
  pawn: () => '<i></i>',
});
vm.runInContext(fs.readFileSync('src/legacy/presentation-effects.js', 'utf8'), fx);
const seed = () =>
  vm.runInContext(
    'queueMergeEffect({uid:1},[{uid:2},{uid:3}],{left:0,top:0,width:40,height:40});flushMergeEffects();',
    fx,
  );
