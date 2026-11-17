import A from '../augments.js';

const has = (b, id) => b.augmentIds.includes(id),
  effect = (id) => A.byId(id).effect;
const alive = (u) => u && !u.dead && u.hp > 0;
function start(b) {
  b.augmentHeatTick = 0;
  b.augmentDominionUsed = false;
  for (const u of b.units) u.augmentState = {};
  for (const a of A.selected(b.augmentIds)) {
    const shield = a.effect.startShield;
    if (shield)
      for (const u of b.alive('ally')) b.shield(u, u.stats.HP * shield.ratio, shield.seconds, u);
  }
}
function update(b) {
  if (b.result) return;
  if (has(b, 'G07')) {
    const h = effect('G07').heat,
      tick = Math.min(h.max, Math.floor((b.time + 1e-8) / h.interval));
    while (b.augmentHeatTick < tick) {
      b.augmentHeatTick++;
      for (const u of b.alive('ally')) {
        u.augmentState.heat = Math.min(h.max, (u.augmentState.heat || 0) + 1);
        b.log('augment', '전투의 열기 ' + u.augmentState.heat + '중첩', { source: u.uid });
      }
    }
  }
  if (has(b, 'P06') && !b.augmentDominionUsed && b.time + 1e-8 >= effect('P06').dominion.at) {
    b.augmentDominionUsed = true;
    for (const u of b.alive('ally')) {
      u.augmentState.dominion = true;
      b.log('augment', '전장의 지배자 발동', { source: u.uid });
    }
  }
}
function preventDeath(b, target) {
  if (
    target.team !== 'ally' ||
    !alive(target) ||
    !has(b, 'P04') ||
    target.augmentState.immortalUsed
  )
    return false;
  target.augmentState.immortalUsed = true;
  const e = effect('P04').immortal;
  b.shield(target, target.stats.HP * e.ratio, e.seconds, target);
  b.log('augment', '불멸의 군대 · HP1 생존', { source: target.uid });
  return true;
}
function install(Battle) {
  const p = Battle.prototype;
  if (p.augmentEffectsInstalled) return;
  p.augmentEffectsInstalled = true;
  const stats = p.stats;
  p.stats = function (u) {
    const s = stats.call(this, u),
      st = u.augmentState;
    if (u.team === 'ally' && st) {
      if (st.heat) {
        const ratio = 1 + effect('G07').heat.ratio * st.heat;
        s.AD *= ratio;
        s.AP *= ratio;
      }
      if (st.dominion) {
        const d = effect('P06').dominion;
        s.AD *= 1 + d.power;
        s.AP *= 1 + d.power;
        s.AS *= 1 + d.as;
      }
    }
    return s;
  };
  const summon = p.summon;
  p.summon = function (owner, kind) {
    const pet = summon.call(this, owner, kind);
    if (pet) {
      pet.augmentState = {};
      if (pet.team === 'ally') {
        pet.stats = A.applyStats(pet.stats, this.augmentIds);
        pet.hp = pet.stats.HP;
      }
    }
    return pet;
  };
  const cast = p.cast;
  p.cast = function (u, target) {
    if (!alive(u) || !alive(target)) return;
    const eligible = u.team === 'ally' && has(this, 'G08') && !this.itemProcDepth;
    const result = cast.call(this, u, target);
    if (eligible && alive(u) && this.time + 1e-8 >= (u.augmentState.nextMana || 0)) {
      const e = effect('G08').manaReturn;
      u.augmentState.nextMana = this.time + e.cooldown;
      u.mp = Math.min(u.stats.MP, u.mp + u.stats.MP * e.ratio);
      this.log('augment', '마나 순환', { source: u.uid });
    }
    return result;
  };
  const deal = p.deal;
  p.deal = function (source, target, amount, type = 'physical', opts = {}) {
    const valid = alive(target),
      normal = source?.team === 'ally' && !this.itemProcDepth && !opts.itemProc,
      kind = opts.kind || 'skill';
    const result = deal.call(this, source, target, amount, type, opts);
    if (
      normal &&
      valid &&
      alive(source) &&
      result.damage > 0 &&
      ['basic', 'skill'].includes(kind)
    ) {
      const ratio =
        (kind === 'basic' && has(this, 'G06') ? effect('G06').basicLeech : 0) +
        (has(this, 'P05') ? effect('P05').attackLeech : 0);
      if (ratio > 0) {
        this.itemProcDepth = (this.itemProcDepth || 0) + 1;
        try {
          this.heal(source, result.damage * ratio, source);
        } finally {
          this.itemProcDepth--;
        }
      }
    }
    return result;
  };
}
const api = { start, update, preventDeath, install };

export default api;
