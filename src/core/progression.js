import B from './board.js';
import D from './data/units.js';
import A from './augments.js';
import I from './items.js';
import { runRng, nextSeed } from './rng.js';

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
  equipment: { slotsPerUnit: 3, unequipCost: 0, allowDuplicates: true, preparationOnly: true },
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
const legacyAugments = [
  { id: 'training', name: '전투 훈련', text: '모든 아군 AD +10%', icon: '⚔' },
  { id: 'mana', name: '마력 순환', text: '아군 전투 시작 MP +20 · 최대 MP 상한', icon: '✧' },
  { id: 'funds', name: '전쟁 자금', text: '선택 즉시 +10G', icon: 'G' },
];
const augments = A.augments;
const label = (s) => `${s.stage}-${s.round}`,
  ordinal = (s) => (s.stage - 1) * config.roundsPerStage + s.round;
const roundType = (stage, round) =>
  (stage === 1 ? config.firstStage : config.laterStages)[round - 1];
const itemById = I.byId,
  augmentById = (id) =>
    augments.find((a) => a.id === id) || legacyAugments.find((a) => a.id === id);
function initialize(state) {
  state.shopLocked = false;
  state.shopCarry = null;
  state.completionChoice = null;
  state.version = 2;
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
function migrate(state) {
  if (state.version === 2) {
    normalizeRunFeatures(state);
    B.migrate(state);
    state.recommendedBond = state.recommendedBond || null;
    state.skipDeploymentWarning = state.skipDeploymentWarning === true;
    normalizeAugments(state);
    return state;
  }
  const wave = state.wave || 1,
    done = state.done,
    oldColumns = state.boardColumns || 8;
  initialize(state);
  state.boardColumns = oldColumns;
  B.migrate(state);
  state.stage = Math.floor((wave - 1) / 5) + 1;
  state.round = ((wave - 1) % 5) + 1;
  state.wave = wave;
  state.level = Math.max(3, Math.min(10, state.units.filter((u) => u.location === 'board').length));
  state.done = !!done;
  state.migrationNotice = `기존 동료·골드·체력을 보존했습니다. 배치 인원에 맞춰 레벨 ${state.level}로 이관했습니다.`;
  state.augmentState = null;
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
  return true;
}
function addItem(state, id) {
  if (!itemById(id)) throw Error('알 수 없는 아이템');
  const item = { uid: 'I' + ++state.itemSequence, id, equippedTo: null };
  state.inventory.push(item);
  return item;
}
function randomItem(state, rng) {
  return addItem(state, items[Math.min(items.length - 1, Math.floor(rng() * items.length))].id);
}
function normalizeAugments(state) {
  state.augments = [...new Set(Array.isArray(state.augments) ? state.augments : [])].filter((id) =>
    augmentById(id),
  );
  state.augmentSelections = state.augmentSelections || {};
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
    data.completedPicks.length >= A.config.maxPicks
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
  [next.stage, next.round] = pending.node.split('-').map(Number);
  next.wave = ordinal(next);
  next.lastResult = null;
  next.roundPhase = 'prepare';
  Object.assign(state, next);
  return true;
}
function rerollCost(state) {
  return state.augments?.includes('S11')
    ? A.byId('S11').effect.reroll
    : D.prototypeConfig.economy.rerollCost;
}
function equip(state, itemUid, unitUid) {
  if (state.done || state.roundPhase !== 'prepare') return false;
  const item = state.inventory.find((i) => i.uid === itemUid),
    unit = state.units.find((u) => u.uid === unitUid);
  if (!item || !unit || item.equippedTo !== null) return false;
  const equipped = state.inventory.filter((i) => i.equippedTo === unitUid);
  if (equipped.length >= config.equipment.slotsPerUnit || !I.canStack(item.id, equipped))
    return false;
  item.equippedTo = unitUid;
  return true;
}
function unequip(state, itemUid) {
  if (state.done || state.roundPhase !== 'prepare') return false;
  const item = state.inventory.find((i) => i.uid === itemUid);
  if (!item || item.equippedTo === null || state.gold < config.equipment.unequipCost) return false;
  state.gold -= config.equipment.unequipCost;
  item.equippedTo = null;
  return true;
}
function releaseEquipment(state, uids) {
  for (const item of state.inventory) if (uids.includes(item.equippedTo)) item.equippedTo = null;
}
function unitBonuses(state, uid) {
  return I.bonuses(state.inventory.filter((i) => i.equippedTo === uid));
}
function unitItemIds(state, uid) {
  return state.inventory.filter((i) => i.equippedTo === uid).map((i) => i.id);
}
function allyModifiers(state) {
  return {
    adMultiplier: state.augments.includes('training') ? 1.1 : 1,
    startManaFlat: state.augments.includes('mana') ? 20 : 0,
    augmentIds: state.augments.filter((id) => A.byId(id)),
  };
}
function previewStats(state, u) {
  return A.applyStats(
    I.applyStats(
      D.byId(u.id).stats,
      unitBonuses(state, u.uid),
      D.prototypeConfig.economy.starMultiplier ** ((u.star || 1) - 1),
      allyModifiers(state).adMultiplier,
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
      ? Math.min(D.prototypeConfig.economy.maxInterest, Math.floor(interestBasis / 10))
      : 0;
  let extra = null,
    bonusGold = 0,
    bossItem = null;
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
    const tier = state.stage === 1 ? 1 : state.stage <= 4 ? 2 : 3,
      item = addItem(state, I.drawTier(tier, rng));
    bossItem = { kind: 'item', itemId: item.id, itemUid: item.uid };
  }

  if (type !== 'SUPPLY') state.winStreak = win ? (state.winStreak || 0) + 1 : 0;
  const streakBonus =
    type !== 'SUPPLY' && win
      ? Math.min(config.rewards.streakCap, state.winStreak * config.rewards.streakPerWin)
      : 0;
  const monsterLoot = state.bonusLootLedger?.[key] || null,
    monsterGold = monsterLoot?.kind === 'gold' ? monsterLoot.amount : 0;
  const augmentGold = type !== 'SUPPLY' && win ? A.aggregate(state.augments).winGold : 0;
  const survivors = outcome.survivingEnemies || 0,
    legacyDamage =
      D.prototypeConfig.run.lossBase + ordinal(state) * D.prototypeConfig.run.lossPerWave,
    loss =
      type === 'SUPPLY' || win
        ? 0
        : Math.min(
            state.health,
            config.loss.mode === 'survivors'
              ? Math.max(1, survivors) * config.loss.survivorDamage
              : legacyDamage,
          ),
    total = base + interest + bonusGold + streakBonus + augmentGold;
  const healthBefore = state.health,
    healthAfterWin =
      type !== 'SUPPLY' && win
        ? Math.min(config.rewards.maxHealth, state.health + config.rewards.winHealth)
        : null,
    healing = healthAfterWin === null ? 0 : Math.max(0, healthAfterWin - state.health);
  state.gold += total;
  state.health = healthAfterWin === null ? state.health - loss : healthAfterWin;
  const levelBefore = state.level,
    xpGained = config.level.roundXp;
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
    winStreak: state.winStreak || 0,
    monsterLoot,
    bossItem,
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
  capacity,
  addXp,
  buyXp,
  addItem,
  ensureAugment,
  availableAugments,
  chooseAugment,
  equip,
  unequip,
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
