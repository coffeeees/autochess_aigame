// 밸런스 자동 시뮬레이션: 간단한 플레이 봇이 화면과 같은 core 함수로 원정을 진행한다.
// 브라우저 실제 플레이가 아니라 "자동 시뮬레이션"이다(결과를 기록할 때 구분할 것).
//
// 사용: node tools/balance-sim.mjs [--seeds 4] [--difficulty 1] [--out 경로.json] [--part base|S|G|P] [--ids S07,S08 --nodes 1-3,3-3] [--augment S01 --node 1-3]
//   기본: 무작위 증강 기준선(seeds × 5) + 54종 × 선택 시점 3곳(1-3/3-3/5-3) × seeds
// 봇 규칙(고정, 증강과 무관하게 같음):
//   보급: 처음 두 칸. 증강: 강제 대상이 있으면 그 노드에서 그것, 아니면 후보 중 무작위.
//   판매: 대기석이 8칸 이상 차면 배치 순위 밖에서 짝이 없고 약한 캐릭터부터 7칸이 될 때까지 판다.
//   상점: 이미 가진 캐릭터 → 코스트 높은 순으로 살 수 있는 만큼(대기석 여유). 2스테이지까지 20G·3스테이지부터 10G를 남기고
//   XP 구매(레벨 6/9까지), 남는 골드로 새로고침 최대 4회.
//   배치: 성급·코스트 높은 순으로 배치 한도만큼(G13이 있으면 같은 캐릭터 한 쌍을 먼저), 사거리 1은 앞줄·나머지는 뒷줄. 장비: 강한 캐릭터부터 3칸.
//   6-5를 마치면 원정 종료를 고른다.
import fs from 'node:fs';
const root = new URL('../src/core/', import.meta.url);
const load = async (f) => (await import(new URL(f, root))).default;
const A = await load('augments.js');
const D = await load('data/units.js');
const P = await load('progression.js');
const V = await load('preparation.js');
const W = await load('encounters.js');
const Engine = await load('combat/battle.js');
const { newRun, battleSetup } = await import(new URL('run.ts', root));
const { buyUnit, sellUnit } = await import(new URL('shop.ts', root));
const { createRng } = await import(new URL('rng.ts', root));
const M = (await import(new URL('meta.ts', root))).default;

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, v, i, all) => (v.startsWith('--') ? [...acc, [v.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
const SEEDS = Number(args.seeds ?? 4);
const DIFFICULTY = Number(args.difficulty ?? 1);
const cost = (id) => D.byId(id)?.cost ?? 0;
const C = D.prototypeConfig;

function playRun({ seed, forced = null, record = false }) {
  const s = newRun({ seed, difficulty: DIFFICULTY });
  const bot = createRng(seed ^ 0x5bd1e995);
  const rounds = [];
  const t0 = Date.now();
  let guard = 0;
  while (!s.done && guard++ < 200) {
    if (s.roundPhase === 'augment') {
      const pending = s.augmentState.pendingPick;
      let pick = null;
      if (forced && pending.node === forced.node && !s.augments.includes(forced.id)) {
        const def = A.byId(forced.id);
        pending.tier = def.tier;
        pending.optionIds = [forced.id, ...pending.optionIds.filter((x) => x !== forced.id)].slice(
          0,
          3,
        );
        pick = forced.id;
      }
      const options = P.availableAugments(s).map((x) => x.id);
      const order = pick ? [pick] : [...options].sort(() => bot() - 0.5);
      if (!order.some((id) => P.chooseAugment(s, id, createRng(seed + s.wave))))
        throw Error('증강을 고를 수 없음 ' + options.join());
      continue;
    }
    if (s.roundPhase === 'result') {
      if (s.completionChoice === 'pending') {
        P.chooseCompletion(s, 'end');
        break;
      }
      if (!P.advanceRound(s)) break;
      if (s.roundPhase === 'prepare') V.enterShop(s);
      continue;
    }
    if (s.roundPhase !== 'prepare') throw Error('예상 못 한 단계 ' + s.roundPhase);
    const key = P.label(s),
      type = P.roundType(s.stage, s.round);
    W.encounter(s);
    shop(s, bot);
    deploy(s);
    if (type === 'SUPPLY') {
      P.beginSupply(s);
      P.toggleSupply(s, 0);
      P.toggleSupply(s, 1);
      P.confirmSupply(s);
    } else battle(s);
    const r = s.lastResult;
    rounds.push({
      key,
      type,
      win: r.win,
      time: r.time,
      health: s.health,
      gold: s.gold,
      level: s.level,
      augments: [...s.augments],
      team: record
        ? s.units
            .filter((u) => u.location === 'board')
            .map((u) => `${u.id}★${u.star}`)
            .join(' ')
        : undefined,
      augmentGold: r.augmentGold || 0,
    });
  }
  const fights = rounds.filter((r) => r.type !== 'SUPPLY');
  return {
    seed,
    forced,
    reached: rounds.at(-1)?.key,
    forcedPicked: forced ? s.augments.includes(forced.id) : null,
    cleared: s.health > 0 && rounds.at(-1)?.key === '6-5',
    metaXp: M.runReward(s).xp, // 이 원정이 끝났을 때 받는 메타 XP(v0.17.2)
    health: s.health,
    wins: fights.filter((r) => r.win).length,
    fights: fights.length,
    gold: s.gold,
    level: s.level,
    augments: s.augments,
    augmentGold: rounds.reduce((n, r) => n + r.augmentGold, 0),
    avgBattleTime: fights.length
      ? fights.reduce((n, r) => n + (r.time || 0), 0) / fights.length
      : 0,
    log: s.augmentRun?.log ?? [],
    rounds: record ? rounds : undefined,
    ms: Date.now() - t0,
  };
}

function rank(s) {
  const copies = (id) => s.units.filter((u) => u.id === id).length;
  return [...s.units].sort(
    (x, y) =>
      y.star - x.star || cost(y.id) - cost(x.id) || copies(y.id) - copies(x.id) || x.uid - y.uid,
  );
}

/** 전장에 둘 캐릭터: 배치 순위대로 한도만큼, 같은 캐릭터는 1명(G13이면 같은 캐릭터 한 쌍을 먼저 넣는다) */
function team(s) {
  const cap = P.capacity(s),
    limit = A.sameUnitLimit(s.augments),
    ranked = rank(s),
    chosen = [];
  if (limit > 1 && cap >= 2) {
    const pairs = [...new Set(s.units.map((u) => u.id))]
      .map((id) => ranked.filter((u) => u.id === id).slice(0, 2))
      .filter((p) => p.length === 2)
      .sort(
        (x, y) => y[0].star + y[1].star - (x[0].star + x[1].star) || cost(y[0].id) - cost(x[0].id),
      );
    if (pairs[0]) chosen.push(...pairs[0]);
  }
  for (const u of ranked) {
    if (chosen.length >= cap) break;
    if (chosen.includes(u) || chosen.filter((c) => c.id === u.id).length >= limit) continue;
    chosen.push(u);
  }
  return chosen;
}

function sellSpare(s) {
  const bench = () => s.units.filter((u) => u.location === 'bench');
  for (let n = 0; n < 10 && bench().length >= 8; n++) {
    const keep = new Set(team(s));
    const copies = (id) => s.units.filter((u) => u.id === id && u.star === 1).length;
    const spare = bench()
      .filter((u) => !keep.has(u))
      .sort((x, y) => x.star - y.star || copies(x.id) - copies(y.id) || cost(x.id) - cost(y.id))[0];
    if (!spare || !sellUnit(s, spare.uid).ok) break;
  }
}

function shop(s, bot) {
  sellSpare(s);
  const nextUid = () => Math.max(0, ...s.units.map((u) => u.uid)) + 1;
  const buyable = () =>
    s.shop
      .map((id, slot) => ({ id, slot }))
      .filter((x) => x.id && cost(x.id) <= s.gold)
      .sort(
        (x, y) =>
          s.units.filter((u) => u.id === y.id).length -
            s.units.filter((u) => u.id === x.id).length || cost(y.id) - cost(x.id),
      );
  for (let n = 0; n < 12; n++) {
    const pick = buyable()[0];
    if (!pick) break;
    if (!buyUnit(s, pick.id, { uid: nextUid(), slot: pick.slot }).ok) break;
  }
  // 2스테이지까지는 이자를 모으고, 3스테이지부터는 10G만 남기고 레벨·새로고침에 쓴다.
  const keep = s.stage >= 3 ? 10 : 20;
  while (s.gold >= keep + 4 && s.level < (s.stage >= 3 ? 9 : 6) && P.buyXp(s));
  for (let r = 0; r < 4 && s.gold >= keep + 2 && V.manualReroll(s); r++) {
    sellSpare(s);
    for (let n = 0; n < 6; n++) {
      const pick = buyable()[0];
      if (!pick || s.gold - cost(pick.id) < keep) break;
      if (!buyUnit(s, pick.id, { uid: nextUid(), slot: pick.slot }).ok) break;
    }
  }
}

function deploy(s) {
  const chosen = team(s);
  for (const u of s.units.filter((u) => u.location === 'board' && !chosen.includes(u)))
    V.moveUnit(s, u.uid, { location: 'bench' });
  const front = [31, 30, 32, 29, 33, 28, 34, 38, 37, 39],
    back = [52, 51, 53, 45, 44, 46, 50, 54, 43, 47];
  for (const u of chosen) {
    if (u.location === 'board') continue;
    const melee = D.byId(u.id).stats.RNG <= 1;
    const taken = new Set(s.units.filter((x) => x.location === 'board').map((x) => x.pos));
    const pos = (melee ? [...front, ...back] : [...back, ...front]).find((p) => !taken.has(p));
    V.moveUnit(s, u.uid, { location: 'board', pos });
  }
  // 장비: 강한 캐릭터부터 3칸
  for (const item of s.inventory.filter((i) => i.equippedTo === null)) {
    const target = chosen.find((u) => s.inventory.filter((i) => i.equippedTo === u.uid).length < 3);
    if (target) V.transferItem(s, item.uid, target.uid);
  }
  const best = chosen[0];
  if (best && A.effects(s.augments, 'clone').some((e) => e.pick === 'designated'))
    s.augmentRun.cloneTarget = best.uid;
}

function battle(s) {
  if (!s.units.some((u) => u.location === 'board')) {
    // 배치할 캐릭터가 없으면 패배로 정산(봇이 막힌 경우)
    s.roundPhase = 'combat';
    P.settleRound(s, { winner: 'enemy', time: 0, allyLosses: 0, damageRows: [] });
    return;
  }
  const setup = battleSetup(s);
  const b = new Engine.Battle(setup.allies, setup.enemies, {
    ...setup.options,
    onUnitKilled: (unit, source) => source?.team === 'ally' && W.claimBonusLoot(s, unit),
  });
  s.roundPhase = 'combat';
  let n = 0;
  let result = null;
  while (!result && n++ < 6000) result = b.tick();
  P.settleRound(s, {
    ...result,
    survivingEnemies: b.alive('enemy').filter((u) => !u.summon).length,
    skillUses: { ...b.skillUses },
    damageRows: V.damageRows(b),
    allyLosses: b.units.filter((u) => u.team === 'ally' && !u.summon && u.dead).length,
  });
}

const out = {
  difficulty: DIFFICULTY,
  seeds: SEEDS,
  startedAt: new Date().toISOString(),
  baseline: [],
  forced: [],
};
if (args.augment) {
  const r = playRun({
    seed: 1,
    forced: { id: args.augment, node: args.node ?? '1-3' },
    record: true,
  });
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
}
// --part base|S|G|P: 나눠서 병렬로 돌릴 때(기본: 전부)
const part = args.part ?? 'all';
if (part === 'all' || part === 'base')
  for (let i = 0; i < SEEDS * 5; i++) out.baseline.push(playRun({ seed: 1000 + i, record: i < 3 }));
// --ids S07,S08 --nodes 1-3,3-3: 일부 증강·시점만 다시 돌릴 때
const onlyIds = args.ids ? args.ids.split(',') : null;
const nodes = args.nodes ? args.nodes.split(',') : A.config.nodes;
for (const aug of A.augments.filter(
  (x) => !x.hold && (part === 'all' || x.id[0] === part) && (!onlyIds || onlyIds.includes(x.id)),
))
  for (const node of nodes)
    for (let i = 0; i < SEEDS; i++)
      out.forced.push(playRun({ seed: 1000 + i, forced: { id: aug.id, node } }));
out.finishedAt = new Date().toISOString();
const path = args.out ?? 'balance-sim.json';
fs.writeFileSync(path, JSON.stringify(out));
console.log(`기준선 ${out.baseline.length}판, 강제 선택 ${out.forced.length}판 → ${path}`);
