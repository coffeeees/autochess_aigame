(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.AutoData;
  const P =
    typeof module !== 'undefined' && module.exports
      ? require('./progression.js')
      : root.AutoProgression;
  const config = {
    bonusEncounterChance: 0.1,
    bonusItemChance: 0.4,
    bonusGoldMin: 3,
    bonusGoldMax: 5,
    metaGrowthEnabled: false,
  };
  const difficulties = Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    startingHealth: 100 - Math.floor((i + 1) / 2) * 10,
    enemyDamageMultiplier: (6 + i) / 10,
    damagePercent: -40 + i * 10,
  }));
  const rows = [
    ['E01', '해골 궁수', 'C01', '궁수', '#c9c7b5'],
    ['E02', '역병 거미', 'C02', '소환사', '#99af79'],
    ['E03', '고블린 검병', 'C03', '전사', '#94ab79'],
    ['E04', '그림자 박쥐', 'C04', '암살자', '#9d8cb7'],
    ['E05', '심해 슬라임', 'C08', '마법사', '#81aec7'],
    ['E06', '바위 골렘', 'C10', '기사', '#ad9273'],
    ['E07', '잿불 정령', 'C11', '소환사', '#d49465'],
    ['E08', '가시 수호자', 'C12', '기사', '#adba8c'],
  ];
  const enemies = rows.map(([id, name, skillId, job, color]) => ({
    id,
    name,
    skillId,
    job,
    color,
    race: '적군',
    trait: '몬스터',
    enemyOnly: true,
    stats: { ...D.byId(skillId).stats },
  }));
  enemies.push({
    id: 'E99',
    name: '보물 슬라임',
    skillId: 'C10',
    job: '기사',
    color: '#e7c96d',
    race: '보너스 몬스터',
    trait: '보물',
    enemyOnly: true,
    bonus: true,
    stats: { ...D.byId('C03').stats, HP: 650, AD: 35, GD: 20 },
  });
  const enemyIds = enemies.filter((e) => !e.bonus).map((e) => e.id),
    byId = (id) => enemies.find((e) => e.id === id),
    combatSpec = (id) => D.byId(id) || byId(id);
  const difficulty = (level) =>
    difficulties.find((d) => d.level === Number(level)) || difficulties[0];
  function ensureRunDefaults(state) {
    state.difficulty = difficulty(state.difficulty).level;
    state.maxHealth = 100;
    state.winStreak = state.winStreak || 0;
    state.bonusLootLedger = state.bonusLootLedger || {};
    return state;
  }
  function configureNewRun(state, level) {
    ensureRunDefaults(state);
    const d = difficulty(level);
    state.difficulty = d.level;
    state.health = d.startingHealth;
    state.maxHealth = 100;
    state.winStreak = 0;
    state.enemyEncounter = null;
    state.bonusLootLedger = {};
    return state;
  }
  function stageStars(stage, count) {
    const upgrades = Math.max(0, (stage - 1) * 2);
    return Array.from(
      { length: count },
      (_, i) => 1 + Math.min(2, Math.floor(upgrades / count) + (i < upgrades % count ? 1 : 0)),
    );
  }
  function encounter(state, rng = Math.random) {
    ensureRunDefaults(state);
    const key = P.label(state);
    if (P.roundType(state.stage, state.round) === 'SUPPLY') return [];
    if (state.enemyEncounter?.key === key) return state.enemyEncounter.units;
    const wave = P.ordinal(state),
      n = Math.min(10, 2 + Math.floor(wave * 0.8)),
      front = [17, 18, 16, 19, 15],
      back = [3, 4, 2, 5, 1],
      frontIds = ['E03', 'E06', 'E08', 'E04'];
    const units = Array.from({ length: n }, (_, i) => ({
      id:
        i < Math.ceil(n / 2)
          ? frontIds[(i + wave - 1) % frontIds.length]
          : enemyIds[(i * 2 + wave) % enemyIds.length],
      pos: i < Math.ceil(n / 2) ? front[i] : back[i - Math.ceil(n / 2)],
      star: stageStars(state.stage, n)[i],
      boss: P.roundType(state.stage, state.round) === 'BOSS' && i === 0,
      scale: D.prototypeConfig.run.enemyScaleBase + wave * D.prototypeConfig.run.enemyScalePerWave,
    }));
    const bonusAppeared = rng() < config.bonusEncounterChance;
    if (bonusAppeared) {
      const index = Math.min(n - 1, Math.floor(rng() * n));
      units[index] = { ...units[index], id: 'E99', bonus: true };
    }
    state.enemyEncounter = { key, units, bonusAppeared };
    return units;
  }
  function claimBonusLoot(state, unit, rng = Math.random) {
    ensureRunDefaults(state);
    const key = P.label(state);
    if (unit.id !== 'E99' || unit.team !== 'enemy' || unit.summon || state.bonusLootLedger[key])
      return null;
    let loot;
    if (rng() < config.bonusItemChance) {
      const def = P.items[Math.min(P.items.length - 1, Math.floor(rng() * P.items.length))],
        item = P.addItem(state, def.id);
      loot = { kind: 'item', itemId: item.id, itemUid: item.uid, key };
    } else {
      const amount =
        config.bonusGoldMin +
        Math.min(
          config.bonusGoldMax - config.bonusGoldMin,
          Math.floor(rng() * (config.bonusGoldMax - config.bonusGoldMin + 1)),
        );
      state.gold += amount;
      loot = { kind: 'gold', amount, key };
    }
    state.bonusLootLedger[key] = loot;
    return loot;
  }
  function newProfile() {
    return { version: 1, metaLevel: 1, metaXp: 0, growthEnabled: false };
  }
  const api = {
    config,
    difficulties,
    difficulty,
    enemies,
    enemyIds,
    byId,
    combatSpec,
    stageStars,
    ensureRunDefaults,
    configureNewRun,
    encounter,
    claimBonusLoot,
    newProfile,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
