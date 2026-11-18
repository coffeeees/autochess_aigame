// 증강의 원정 효과(v0.16.0 후보 54종): 선택 즉시 보상, 라운드·스테이지·전투 정산 시점 보상,
// 동료 지급, 맡긴 골드, 무료 새로고침. 진행 상태는 state.augmentRun에 저장한다.
// 기본안(사용자 승인 2026-11-18):
//  - 동료 지급 때 대기석이 가득 차 있고 합성으로 자리가 나지도 않으면 그 동료의 판매가만큼 골드로 준다.
//  - 무작위 동료는 해당 코스트의 플레이 가능 캐릭터 중 이미 3성을 가진 캐릭터를 뺀 목록에서 고른다(상점과 같음).
//  - "전투" 횟수는 일반·보스 전투 정산만 센다(보급 제외). 선택한 노드부터 센다.
//  - 늦게 받는 보상은 원정이 끝나면 사라지고, 늦게 고른 경우의 보정은 없다.
import A from './augments.js';
import D from './data/units.js';
import P from './progression.js';
import V from './preparation.js';
import { mergeAll } from './merge.ts';
import { runRng } from './rng.ts';

const C = D.prototypeConfig;
const unitCost = (id) => D.byId(id)?.cost ?? 0;
const salePrice = (id, star) => unitCost(id) * 3 ** (star - 1);

/** state.augmentRun 기본값을 채운다(예전 저장에도 안전) */
function normalize(state) {
  const r = (state.augmentRun ||= {});
  r.delayed = Array.isArray(r.delayed) ? r.delayed : [];
  r.invest = Array.isArray(r.invest) ? r.invest : [];
  r.freeRerolls = Number.isInteger(r.freeRerolls) && r.freeRerolls > 0 ? r.freeRerolls : 0;
  r.freeStageUsed = Number.isInteger(r.freeStageUsed) ? r.freeStageUsed : 0;
  r.valueUnitId = typeof r.valueUnitId === 'string' ? r.valueUnitId : null;
  r.valuePickNode = typeof r.valuePickNode === 'string' ? r.valuePickNode : null;
  r.cloneTarget = Number.isInteger(r.cloneTarget) ? r.cloneTarget : null;
  r.lastRoundStart = typeof r.lastRoundStart === 'string' ? r.lastRoundStart : null;
  r.log = Array.isArray(r.log) ? r.log.slice(-30) : [];
  return r;
}
/** 기록 한 줄. 증강을 고를 때는 아직 이전 라운드라 선택 시점(node)을 key로 넘긴다 */
const note = (state, text, key = P.label(state)) => normalize(state).log.push(`${key} ${text}`);

/** 고를 수 없는 증강이면 이유(지금은 S18: 플레이어 HP 부족) */
function chooseBlock(state, id) {
  const e = A.byId(id)?.effect;
  if (e?.hpCost?.flat && state.health <= e.hpCost.flat)
    return `플레이어 HP가 ${e.hpCost.flat} 이하라 선택할 수 없습니다.`;
  return null;
}

/** 동료 1명 지급. 대기석이 가득 차고 합성도 안 되면 판매가만큼 골드 */
function grantUnit(state, id, star = 1, key = P.label(state)) {
  const benchFull = state.units.filter((u) => u.location === 'bench').length >= C.board.benchSize;
  const canMerge =
    star < 3 && state.units.filter((u) => u.id === id && u.star === star).length >= 2;
  if (benchFull && !canMerge) {
    const gold = salePrice(id, star);
    state.gold += gold;
    note(state, `대기석이 가득 차 ${D.byId(id).name} ${star}성 대신 ${gold}G`, key);
    return { ok: false, gold };
  }
  const uid = Math.max(0, ...state.units.map((u) => u.uid)) + 1;
  state.units.push({ uid, id, location: 'bench', pos: -1, star });
  V.normalize(state);
  mergeAll(state);
  V.normalize(state);
  note(state, `${D.byId(id).name} ${star}성 획득`, key);
  return { ok: true, uid };
}
/** 해당 코스트 무작위 캐릭터(3성 보유 캐릭터 제외). 없으면 null */
function randomOfCost(state, cost, rng) {
  const pool = V.shopPool(state).filter((id) => unitCost(id) === cost);
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : null;
}

/** 선택 즉시 효과(next = 선택 반영 중인 원정 사본). gold·xp·items는 progression.chooseAugment가 처리 */
function applyChoice(next, choice, node, rng) {
  const e = choice.effect,
    r = normalize(next);
  if (e.hpCost) {
    const loss = e.hpCost.flat ?? Math.floor(next.health * e.hpCost.ratio);
    next.health = Math.max(1, next.health - loss);
  }
  for (const g of e.units || [])
    for (let i = 0; i < g.count; i++) {
      const id = randomOfCost(next, g.cost, rng);
      if (id) grantUnit(next, id, 1, node);
    }
  if (e.valueInvest) {
    const id = randomOfCost(next, e.valueInvest.cost, rng);
    if (id) {
      r.valueUnitId = id;
      r.valuePickNode = node;
      grantUnit(next, id, e.valueInvest.star, node);
    }
  }
  if (e.delayed) r.delayed.push({ id: choice.id, left: e.delayed.battles, gold: e.delayed.gold });
  if (e.invest) {
    const amount = Math.floor(next.gold * e.invest.ratio);
    next.gold -= amount;
    r.invest.push({ amount, left: e.invest.battles, multiplier: e.invest.multiplier });
    note(next, `${amount}G 맡김`, node);
  }
}

/** 새 라운드 준비 시작(라운드 진행·증강 선택 직후). 같은 라운드에 두 번 주지 않는다 */
function onRoundStart(state, rng = runRng(state)) {
  const r = normalize(state),
    key = P.label(state);
  if (r.lastRoundStart === key) return;
  r.lastRoundStart = key;
  if (state.round === 1 && state.stage > 1)
    for (const g of A.effects(state.augments, 'stageGold')) {
      state.gold += g;
      note(state, `황금의 흐름 +${g}G`);
    }
  if (r.valueUnitId && r.valuePickNode !== key && A.hasEffect(state.augments, 'valueInvest')) {
    // 이미 3성이면 더 받아도 쓸 수 없으므로 1성 판매가만큼 골드(대기석 만석 규칙과 같은 방식)
    if (state.units.some((u) => u.id === r.valueUnitId && u.star >= 3)) {
      const gold = salePrice(r.valueUnitId, 1);
      state.gold += gold;
      note(state, `가치 투자 동료가 이미 3성이라 ${gold}G`);
    } else grantUnit(state, r.valueUnitId, 1);
  }
}

/** 레벨이 오른 만큼(G12) 동료 지급 */
function onLevelUp(state, levels, rng = runRng(state)) {
  for (const e of A.effects(state.augments, 'levelUnits'))
    for (let i = 0; i < levels; i++) {
      const cost = e.costs[Math.min(e.costs.length - 1, Math.floor(rng() * e.costs.length))];
      const id = randomOfCost(state, cost, rng);
      if (id) grantUnit(state, id, 1);
    }
}

/**
 * 라운드 정산 때 증강 보상. 반환값은 영수증에 넣을 골드 내역(합계는 total).
 * fight: 일반·보스 전투인지, win: 승리, before: 보상 전 골드, allyLosses: 쓰러진 아군 수(소환수·분신 제외)
 */
function settle(state, { fight, win, before, allyLosses }) {
  const r = normalize(state),
    ids = state.augments,
    parts = {};
  const add = (k, v) => v > 0 && (parts[k] = (parts[k] || 0) + v);
  if (fight && win && allyLosses === 0)
    for (const g of A.effects(ids, 'flawlessGold')) add('flawless', g);
  if (fight && !win) {
    for (const g of A.effects(ids, 'lossGold')) add('loss', g);
    for (const n of A.effects(ids, 'lossFreeReroll')) r.freeRerolls += n;
  }
  if (fight && win)
    for (const e of A.effects(ids, 'winInterest'))
      add('compound', Math.min(e.max, Math.floor(before * e.ratio)));
  if (fight) {
    for (const d of r.delayed) if (d.left > 0 && --d.left === 0) add('delayed', d.gold);
    for (const v of r.invest)
      if (v.left > 0 && --v.left === 0) add('invest', v.amount * v.multiplier);
  }
  const total = Object.values(parts).reduce((n, v) => n + v, 0);
  return { parts, total };
}

/** 이자 상한(P12: 10G) */
function interestCap(state) {
  return Math.max(C.economy.maxInterest, A.aggregate(state.augments).interestCap || 0);
}
/** 새로고침 비용: 무료(G08 스테이지 첫 번째, G10 쌓인 무료)가 있으면 0 */
function rerollCost(state) {
  const r = normalize(state);
  if (A.hasEffect(state.augments, 'freeRerollPerStage') && r.freeStageUsed !== state.stage)
    return 0;
  if (r.freeRerolls > 0) return 0;
  const reroll = A.effects(state.augments, 'reroll');
  return reroll.length ? Math.min(...reroll) : C.economy.rerollCost;
}
/** 새로고침 1회 사용(무료가 있으면 무료를 먼저 씀) */
function useReroll(state) {
  const r = normalize(state);
  if (A.hasEffect(state.augments, 'freeRerollPerStage') && r.freeStageUsed !== state.stage) {
    r.freeStageUsed = state.stage;
    return 0;
  }
  if (r.freeRerolls > 0) {
    r.freeRerolls--;
    return 0;
  }
  const cost = rerollCost(state);
  state.gold -= cost;
  return cost;
}

/** P10: 상점에 등장 가능한 최고 코스트 동료가 없으면 한 칸을 그 코스트로 바꾼다 */
function guaranteeShop(state, rng) {
  if (!A.hasEffect(state.augments, 'shopGuarantee')) return;
  const odds = V.shopOdds(state);
  let top = -1;
  odds.forEach((p, i) => p > 0 && (top = i + 1));
  if (top < 1 || state.shop.some((id) => id && unitCost(id) === top)) return;
  const id = randomOfCost(state, top, rng);
  if (!id) return;
  const slot = Math.min(state.shop.length - 1, Math.floor(rng() * state.shop.length));
  state.shop[slot] = id;
}

export default {
  normalize,
  chooseBlock,
  grantUnit,
  randomOfCost,
  applyChoice,
  onRoundStart,
  onLevelUp,
  settle,
  interestCap,
  rerollCost,
  useReroll,
  guaranteeShop,
};
