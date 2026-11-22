import B from './board.js';
import D from './data/units.js';
import A from './augments.js';
import I from './items.js';
import R from './augment-run.js';
import U from './meta-upgrades.ts';
import E from './equipment.ts';
import { runRng, nextSeed } from './rng.ts';

const config = {
  roundsPerStage: 5,
  firstStage: ['SUPPLY', 'SUPPLY', 'BATTLE', 'BATTLE', 'BOSS'],
  laterStages: ['BATTLE', 'BATTLE', 'SUPPLY', 'BATTLE', 'BOSS'],
  repeatAfterStage6: true,
  augmentStages: [],
  augmentNodes: A.config.nodes,
  level: {
    start: 3,
    max: 10,
    xpPurchaseGold: 4,
    xpPurchaseAmount: 4,
    roundXp: 2,
    roundXpProvisional: true,
    requirements: { 1: 2, 2: 2, 3: 6, 4: 10, 5: 20, 6: 36, 7: 56, 8: 68, 9: 68 },
  },
  rewards: {
    winHealth: 2,
    maxHealth: 100,
    supplyBonusChance: 0.5,
    supplyBonusAmounts: [2, 3],
    battle: { win: 3, lose: 1 },
    boss: { win: 5, lose: 3 },
    streakPerWin: 1,
    streakCap: 5,
    interestBasis: 'before-base',
    supplyInterest: false,
    supplyGold: 0,
    bossExtraGoldChance: 0.6,
    guaranteedBossItem: true,
    bossExtraGold: { 1: 5, 2: 7, 3: 9, 4: 11, 5: 13, 6: 15 },
    laterBossExtraGold: 15,
  },
  // v0.20.0: 무료 장비 회수 없음(회수기만, equipment.ts). 같은 완성 장비 중복 착용 허용
  equipment: { slotsPerUnit: 3, allowDuplicates: true, preparationOnly: true },
  loss: { mode: 'legacy-round', survivorDamage: 2 },
  notes: [
    '보상 전 소지금 기준 이자는 기존 동작 유지·최종 확정 전 설정값',
    '보급 기본 골드 0 / 이자 없음은 신규 임시 규칙',
    '라운드 자동 2XP·요구 XP·장비 3칸·무료 해제는 테스트 설정',
    '적군은 별도 몬스터 데이터. 난이도별 피해 보정·보스 구분 적용, 스킬은 기존 엔진 사용',
    '패배 피해는 기존 10+전체 라운드 번호×2 유지. 생존 적 수는 기록하며 공식 변경 가능',
    '7스테이지 이후는 2~6과 동일 패턴 임시 반복',
  ],
};
const items = I.items;
/** 원정 저장 버전(save.ts SAVE_VERSION과 같음). v0.17.0: 4, v0.18.0(좌우 대치 전장): 5, v0.20.0(장비 개편): 6 */
const VERSION = 6;
const augments = A.augments;
const label = (s) => `${s.stage}-${s.round}`,
  ordinal = (s) => (s.stage - 1) * config.roundsPerStage + s.round;
const roundType = (stage, round) =>
  (stage === 1 ? config.firstStage : config.laterStages)[round - 1];
const itemById = I.byId,
  augmentById = A.byId;
function initialize(state) {
  state.shopLocked = false;
  state.shopCarry = null;
  state.completionChoice = null;
  state.version = VERSION;
  state.boardColumns = B.config.columns;
  state.stage = 1;
  state.round = 1;
  state.wave = 1;
  state.level = config.level.start;
  state.xp = 0;
  state.inventory = [];
  state.itemSequence = 0;
  state.augments = [];
  state.augmentSelections = {};
  state.augmentState = { version: 1, completedPicks: [], skippedPicks: [], pendingPick: null };
  state.augmentRun = null;
  state.recoveryTools = E.config.recovery.start; // 회수기(v0.20.0): 새 원정 2개
  R.normalize(state);
  state.completedRounds = {};
  state.roundPhase = 'prepare';
  state.lastResult = null;
  state.done = false;
  state.winStreak = 0;
  state.skipDeploymentWarning = false;
  return state;
}
function normalizeRunFeatures(state) {
  state.shopLocked = state.shopLocked === true;
  if (
    !state.shopCarry ||
    !Array.isArray(state.shopCarry.offers) ||
    typeof state.shopCarry.node !== 'string'
  )
    state.shopCarry = null;
  if (!['pending', 'continue', 'end', 'legacy'].includes(state.completionChoice))
    state.completionChoice =
      state.stage > 6
        ? 'legacy'
        : state.stage === 6 && state.round === 5 && state.roundPhase === 'result' && !state.done
          ? 'pending'
          : null;
  return state;
}
/**
 * 불러온 원정 정리(새로고침·다시 열기). 현재 저장 버전만 받는다.
 * v0.17.0부터 이전 버전 저장은 이관하지 않고 save.ts가 지운다.
 */
function migrate(state) {
  // 버전 4(상하 대치 전장)는 전장 칸을 한 번 회전해 5로 올린다. 그보다 오래된 저장은 받지 않는다
  if (state.version === 4) {
    B.migrate(state);
    state.version = 5;
  }
  // 버전 5 → 6(v0.20.0 장비 개편): 예전 1~3티어 장비는 보관함·장착 모두에서 지우고 원정은 이어간다(사용자 결정 2026-11-23).
  // 예전 장비가 든 보급 후보는 버리고 준비 단계로 돌려 새 기본 장비로 다시 뽑는다. 회수기는 새 원정처럼 2개.
  if (state.version === 5) {
    state.inventory = (state.inventory || []).filter((i) => itemById(i.id));
    if (state.discardedItem && !itemById(state.discardedItem.id)) state.discardedItem = null;
    if (state.supplyOffer?.options?.some((id) => !itemById(id))) {
      state.supplyOffer = null;
      if (state.roundPhase === 'supply') state.roundPhase = 'prepare';
    }
    state.recoveryTools = E.config.recovery.start;
    state.version = VERSION;
  }
  if (state.version !== VERSION)
    throw Error('이전 버전 저장은 불러오지 않습니다: ' + state.version);
  normalizeRunFeatures(state);
  B.migrate(state);
  state.recommendedBond = state.recommendedBond || null;
  state.skipDeploymentWarning = state.skipDeploymentWarning === true;
  normalizeAugments(state);
  return state;
}
function capacity(state) {
  return Math.min(
    A.config.maxCapacity,
    Math.min(config.level.max, state.level || config.level.start) +
      A.aggregate(state.augments).capacity,
  );
}
function addXp(state, amount) {
  const before = state.level;
  if (state.level >= config.level.max) {
    state.xp = 0;
    return 0;
  }
  state.xp += amount;
  while (state.level < config.level.max && state.xp >= config.level.requirements[state.level]) {
    state.xp -= config.level.requirements[state.level];
    state.level++;
  }
  if (state.level === config.level.max) state.xp = 0;
  // 성장의 보상(G12): 오른 레벨만큼 동료 지급
  if (state.level > before && A.hasEffect(state.augments, 'levelUnits'))
    R.onLevelUp(state, state.level - before);
  return state.level - before;
}
function buyXp(state) {
  if (
    state.done ||
    state.roundPhase !== 'prepare' ||
    state.level >= config.level.max ||
    state.gold < config.level.xpPurchaseGold
  )
    return false;
  state.gold -= config.level.xpPurchaseGold;
  addXp(state, config.level.xpPurchaseAmount);
  if (state.level < config.level.max && U.take(state, 'G4')) addXp(state, 1); // 경험 축적(메타)
  return true;
}
function addItem(state, id) {
  if (!itemById(id)) throw Error('알 수 없는 아이템');
  const item = { uid: 'I' + ++state.itemSequence, id, equippedTo: null };
  state.inventory.push(item);
  return item;
}
/** 무작위 장비 하나(v0.20.0: 기본 장비 8종 중) */
function randomItem(state, rng) {
  return addItem(state, I.draw(0, rng));
}
function normalizeAugments(state) {
  state.augments = [...new Set(Array.isArray(state.augments) ? state.augments : [])].filter((id) =>
    augmentById(id),
  );
  state.augmentSelections = state.augmentSelections || {};
  R.normalize(state);
  if (!state.augmentState || state.augmentState.version !== 1) {
    state.augmentState = {
      version: 1,
      completedPicks: [],
      skippedPicks: A.config.nodes.filter((n) => A.nodeOrdinal(n) <= ordinal(state)),
      pendingPick: null,
    };
    if (state.roundPhase === 'augment') state.roundPhase = 'prepare';
    state.pendingAugmentStage = null;
  }
  return state.augmentState;
}
function requestAugment(state, node, rng = runRng(state)) {
  const data = normalizeAugments(state);
  if (
    state.done ||
    !A.config.nodes.includes(node) ||
    data.completedPicks.includes(node) ||
    data.skippedPicks.includes(node)
  )
    return false;
  if (!data.pendingPick)
    data.pendingPick = {
      node,
      pick: A.config.nodes.indexOf(node) + 1,
      ...A.draw(state.augments, rng),
    };
  state.roundPhase = 'augment';
  return true;
}
function ensureAugment(state, rng = runRng(state)) {
  const data = normalizeAugments(state);
  if (state.done) return false;
  if (data.pendingPick) {
    state.roundPhase = 'augment';
    return true;
  }
  return state.roundPhase === 'prepare' && requestAugment(state, label(state), rng);
}
function availableAugments(state) {
  const pending = normalizeAugments(state).pendingPick;
  return pending ? pending.optionIds.map(augmentById).filter(Boolean) : [];
}
function chooseAugment(state, id, rng = runRng(state)) {
  const data = normalizeAugments(state),
    pending = data.pendingPick;
  if (
    state.done ||
    state.roundPhase !== 'augment' ||
    !pending ||
    data.completedPicks.includes(pending.node) ||
    state.augments.includes(id) ||
    !pending.optionIds.includes(id) ||
    data.completedPicks.length >= A.config.maxPicks ||
    R.chooseBlock(state, id)
  )
    return false;
  const choice = A.byId(id);
  if (!choice || choice.tier !== pending.tier) return false;
  const next = JSON.parse(JSON.stringify(state)),
    e = choice.effect;
  next.augments.push(id);
  next.augmentState.completedPicks.push(pending.node);
  next.augmentSelections[pending.node] = id;
  next.augmentState.pendingPick = null;
  next.gold += e.gold || 0;
  if (e.xp) addXp(next, e.xp);
  if (e.items) for (let i = 0; i < e.items.count; i++) addItem(next, I.drawTier(e.items.tier, rng));
  R.applyChoice(next, choice, pending.node, rng);
  [next.stage, next.round] = pending.node.split('-').map(Number);
  next.wave = ordinal(next);
  next.lastResult = null;
  next.roundPhase = 'prepare';
  Object.assign(state, next);
  R.onRoundStart(state, rng);
  return true;
}
/** 선택할 수 없는 증강이면 이유(화면 표시용). 고를 수 있으면 null */
function augmentBlock(state, id) {
  return R.chooseBlock(state, id);
}
/** 새로고침 비용(증강의 reroll 값, 무료 새로고침이 있으면 0) */
function rerollCost(state) {
  return R.rerollCost(state);
}
/** 보관함 장비를 캐릭터에 놓기(장착 또는 들고 있던 기본 장비와 조합, equipment.ts) */
function equip(state, itemUid, unitUid) {
  return E.dropOnUnit(state, itemUid, unitUid).ok;
}
function releaseEquipment(state, uids) {
  for (const item of state.inventory) if (uids.includes(item.equippedTo)) item.equippedTo = null;
}
function unitBonuses(state, uid) {
  const b = I.bonuses(state.inventory.filter((i) => i.equippedTo === uid));
  // S3 장비 숙련(메타): 장착 아이템의 수치 보너스만 +x%(고유 효과·발동은 그대로). 반올림하지 않는다
  const s3 = U.value(state, 'S3');
  if (s3 > 0)
    for (const key of Object.keys(b))
      b[key] = key === 'ASMultiplier' ? 1 + (b[key] - 1) * (1 + s3) : b[key] * (1 + s3);
  return b;
}
function unitItemIds(state, uid) {
  return state.inventory.filter((i) => i.equippedTo === uid).map((i) => i.id);
}
function allyModifiers(state) {
  return {
    augmentIds: state.augments.filter((id) => A.byId(id)),
    cloneTarget: state.augmentRun?.cloneTarget ?? null,
    // 메타 영구 강화(v0.19.0). 강화가 없으면 넣지 않아 전투 입력이 예전과 같다
    ...(U.combatInfo(state) ? { meta: U.combatInfo(state) } : {}),
  };
}
function previewStats(state, u) {
  return A.applyStats(
    I.applyStats(
      D.byId(u.id).stats,
      unitBonuses(state, u.uid),
      D.prototypeConfig.economy.starMultiplier ** ((u.star || 1) - 1),
    ),
    state.augments,
  );
}
function recommendedMembers(name) {
  const bond = D.synergies.find((s) => s.id === name);
  return bond ? D.roster.filter((u) => u.playable && D.hasBond(u, name)).map((u) => u.id) : [];
}
function beginSupply(state, rng = runRng(state)) {
  const key = label(state);
  if (
    state.done ||
    roundType(state.stage, state.round) !== 'SUPPLY' ||
    state.completedRounds[key] ||
    !['prepare', 'supply'].includes(state.roundPhase)
  )
    return null;
  if (state.supplyOffer?.key !== key) {
    const options = [];
    while (options.length < 4) options.push(I.draw(state.stage, rng, options));
    state.supplyOffer = { key, options, selected: [] };
  }
  state.roundPhase = 'supply';
  return state.supplyOffer;
}
function toggleSupply(state, index) {
  const offer = state.supplyOffer;
  if (
    state.roundPhase !== 'supply' ||
    !offer ||
    offer.key !== label(state) ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 3
  )
    return false;
  const i = offer.selected.indexOf(index);
  if (i >= 0) offer.selected.splice(i, 1);
  else if (offer.selected.length < 2) offer.selected.push(index);
  else return false;
  return true;
}
function confirmSupply(state, rng = runRng(state)) {
  if (state.completedRounds[label(state)]) return state.completedRounds[label(state)];
  if (
    state.roundPhase !== 'supply' ||
    state.supplyOffer?.key !== label(state) ||
    state.supplyOffer.selected.length !== 2
  )
    return null;
  return settleRound(state, {}, rng);
}
function discardItem(state, uid) {
  if (state.done || state.roundPhase !== 'prepare') return false;
  const index = state.inventory.findIndex((i) => i.uid === uid && i.equippedTo === null);
  if (index < 0) return false;
  state.discardedItem = state.inventory.splice(index, 1)[0];
  return true;
}
function undoDiscard(state) {
  if (
    state.done ||
    state.roundPhase !== 'prepare' ||
    !state.discardedItem ||
    state.inventory.some((i) => i.uid === state.discardedItem.uid)
  )
    return false;
  state.inventory.push(state.discardedItem);
  state.discardedItem = null;
  return true;
}
function settleRound(state, outcome = {}, rng = runRng(state)) {
  const key = label(state);
  if (state.completedRounds[key]) return state.completedRounds[key];
  if (state.done || !['prepare', 'combat', 'supply'].includes(state.roundPhase)) return null;
  const type = roundType(state.stage, state.round);
  if (type !== 'SUPPLY' && state.roundPhase !== 'combat') return null;
  if (
    type === 'SUPPLY' &&
    (state.roundPhase !== 'supply' ||
      state.supplyOffer?.key !== key ||
      state.supplyOffer.selected.length !== 2)
  )
    return null;
  const before = state.gold,
    win = type === 'SUPPLY' ? true : outcome.winner === 'ally',
    reward = type === 'BOSS' ? config.rewards.boss : config.rewards.battle,
    base = type === 'SUPPLY' ? config.rewards.supplyGold : win ? reward.win : reward.lose;
  const interestEligible = type !== 'SUPPLY' || config.rewards.supplyInterest,
    interestBasis = config.rewards.interestBasis === 'after-base' ? before + base : before,
    interest = interestEligible
      ? Math.min(R.interestCap(state), Math.floor(interestBasis / 10))
      : 0;
  let extra = null,
    bonusGold = 0,
    bossItem = null,
    recovery = 0;
  if (type === 'SUPPLY') {
    const received = state.supplyOffer.selected.map((index) =>
      addItem(state, state.supplyOffer.options[index]),
    );
    extra = {
      kind: 'items',
      itemIds: received.map((i) => i.id),
      itemUids: received.map((i) => i.uid),
    };
    if (rng() < config.rewards.supplyBonusChance)
      bonusGold = config.rewards.supplyBonusAmounts[Math.min(1, Math.floor(rng() * 2))];
  } else if (type === 'BOSS' && win) {
    if (rng() >= 1 - config.rewards.bossExtraGoldChance) {
      bonusGold = config.rewards.bossExtraGold[state.stage] ?? config.rewards.laterBossExtraGold;
      extra = { kind: 'gold', amount: bonusGold };
    }
    // 보스 확정 장비 1개(v0.20.0: 등급 없이 기본 장비 8종 중). 난수 사용 횟수는 예전과 같다
    const item = addItem(state, I.drawTier(0, rng));
    bossItem = { kind: 'item', itemId: item.id, itemUid: item.uid };
    // 회수기: 보스 승리마다 따로 확률 판정(장비·골드 보상과 독립)
    recovery = E.rollBossRecovery(state, rng);
  }

  if (type !== 'SUPPLY') state.winStreak = win ? (state.winStreak || 0) + 1 : 0;
  const streakBonus =
    type !== 'SUPPLY' && win
      ? Math.min(config.rewards.streakCap, state.winStreak * config.rewards.streakPerWin)
      : 0;
  const monsterLoot = state.bonusLootLedger?.[key] || null,
    monsterGold = monsterLoot?.kind === 'gold' ? monsterLoot.amount : 0;
  const fight = type !== 'SUPPLY';
  // 메타 영구 강화(v0.19.0): 기본 보상은 그대로 두고 추가분만. 횟수는 원정마다(state.metaRun.used)
  const normal = type === 'BATTLE',
    metaParts = {},
    addMeta = (id, n = 1) => (metaParts[id] = (metaParts[id] || 0) + n);
  if (normal && win && U.take(state, 'E2')) addMeta('E2');
  if (normal && !win && U.take(state, 'E3')) addMeta('E3');
  if (type === 'SUPPLY' && U.take(state, 'E6')) addMeta('E6');
  if (type === 'BOSS' && win && U.take(state, 'E7')) addMeta('E7');
  if (interest > 0 && U.take(state, 'E8')) addMeta('E8');
  // S4 보급 전문가: 보급 완료마다 독립 확률(강화가 있을 때만 난수를 뽑아 예전 원정과 같은 난수 흐름 유지)
  const s4 = U.value(state, 'S4');
  if (type === 'SUPPLY' && s4 > 0 && rng() * 100 < s4) addMeta('S4');
  const metaGold = Object.values(metaParts).reduce((n, v) => n + v, 0);
  const metaXp =
    (normal && win && U.take(state, 'G2') ? 1 : 0) +
    (normal && !win && U.take(state, 'G3') ? 1 : 0);
  const augmentRun = R.settle(state, {
    fight,
    win,
    before,
    allyLosses: outcome.allyLosses ?? null,
  });
  const augmentGold = (fight && win ? A.aggregate(state.augments).winGold : 0) + augmentRun.total;
  const survivors = outcome.survivingEnemies || 0,
    legacyDamage =
      D.prototypeConfig.run.lossBase + ordinal(state) * D.prototypeConfig.run.lossPerWave,
    rawLoss =
      type === 'SUPPLY' || win
        ? 0
        : Math.min(
            state.health,
            config.loss.mode === 'survivors'
              ? Math.max(1, survivors) * config.loss.survivorDamage
              : legacyDamage,
          ),
    // S8 원정 보험(메타): HP를 잃는 패배의 첫 n번은 손실 −1(최소 0). 한 패배에 한 번
    insured = rawLoss > 0 && U.take(state, 'S8') ? 1 : 0,
    loss = rawLoss - insured,
    total = base + interest + bonusGold + streakBonus + augmentGold + metaGold;
  // HP 상한: 원정의 maxHealth(S1 원정의 가호로 늘어남, 없으면 기본 100). S2는 일반 전투 승리 회복에만 더한다
  const healthCap = Math.max(config.rewards.maxHealth, U.healthCap(state)),
    winHeal = config.rewards.winHealth + (normal ? U.value(state, 'S2') : 0);
  const healthBefore = state.health,
    healthAfterWin = type !== 'SUPPLY' && win ? Math.min(healthCap, state.health + winHeal) : null,
    healing = healthAfterWin === null ? 0 : Math.max(0, healthAfterWin - state.health);
  state.gold += total;
  state.health = healthAfterWin === null ? state.health - loss : healthAfterWin;
  const levelBefore = state.level,
    stageXp =
      state.round === 5 ? A.effects(state.augments, 'stageXp').reduce((n, v) => n + v, 0) : 0,
    xpGained = config.level.roundXp + stageXp + metaXp;
  addXp(state, xpGained);
  state.done = state.health <= 0;
  state.roundPhase = state.done ? 'gameover' : 'result';
  if (state.stage === 6 && state.round === 5 && !state.done && !state.completionChoice)
    state.completionChoice = 'pending';
  const receipt = {
    key,
    stage: state.stage,
    round: state.round,
    type,
    win,
    before,
    base,
    interest,
    bonusGold,
    streakBonus,
    augmentGold,
    augmentParts: augmentRun.parts,
    ...(metaGold || metaXp || insured ? { metaGold, metaParts, metaXp, insured } : {}),
    winStreak: state.winStreak || 0,
    monsterLoot,
    bossItem,
    ...(recovery ? { recovery } : {}),
    total,
    totalEarned: total + monsterGold,
    extra,
    healthBefore,
    healing,
    loss,
    survivors,
    gold: state.gold,
    health: state.health,
    done: state.done,
    xpGained,
    levelBefore,
    levelAfter: state.level,
    time: outcome.time || 0,
    reason: type === 'SUPPLY' ? 'supply' : outcome.winner,
    skillUses: outcome.skillUses || {},
    damageRows: JSON.parse(JSON.stringify(outcome.damageRows || [])),
  };
  state.completedRounds[key] = receipt;
  state.lastResult = receipt;
  return receipt;
}
function advanceRound(state, rng = runRng(state)) {
  if (
    state.done ||
    state.completionChoice === 'pending' ||
    state.roundPhase !== 'result' ||
    !state.completedRounds[label(state)]
  )
    return false;
  const round = state.round === 5 ? 1 : state.round + 1,
    stage = state.stage + (state.round === 5 ? 1 : 0),
    node = stage + '-' + round;
  state.shopCarry = { node, offers: state.shopLocked ? [...state.shop] : null };
  state.shopLocked = false;
  if (!state.shopCarry.offers) state.shopCarry = null;
  if (requestAugment(state, node, rng)) return true;
  state.stage = stage;
  state.round = round;
  state.wave = ordinal(state);
  state.lastResult = null;
  state.roundPhase = 'prepare';
  R.onRoundStart(state, rng);
  return true;
}
function chooseCompletion(state, choice) {
  if (
    state.done ||
    state.completionChoice !== 'pending' ||
    state.stage !== 6 ||
    state.round !== 5 ||
    state.roundPhase !== 'result' ||
    !['continue', 'end'].includes(choice)
  )
    return false;
  state.completionChoice = choice;
  if (choice === 'end') {
    state.done = true;
    state.roundPhase = 'complete';
  }
  return true;
}
/** Seed for the next battle, drawn from the run generator. */
function battleSeed(state) {
  return nextSeed(runRng(state));
}
const api = {
  runRng,
  battleSeed,
  normalizeRunFeatures,
  chooseCompletion,
  config,
  items,
  augments,
  label,
  ordinal,
  roundType,
  itemById,
  augmentById,
  initialize,
  migrate,
  normalizeAugments,
  requestAugment,
  rerollCost,
  useReroll: (state) => R.useReroll(state),
  guaranteeShop: (state, rng) => R.guaranteeShop(state, rng),
  augmentBlock,
  capacity,
  addXp,
  buyXp,
  addItem,
  ensureAugment,
  availableAugments,
  chooseAugment,
  equip,
  releaseEquipment,
  unitBonuses,
  unitItemIds,
  beginSupply,
  toggleSupply,
  confirmSupply,
  discardItem,
  undoDiscard,
  allyModifiers,
  previewStats,
  recommendedMembers,
  settleRound,
  advanceRound,
};

export default api;
