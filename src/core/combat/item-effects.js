import B from '../board.js';

const has = (u, id) => !u.summon && (u.itemIds || []).includes(id);
const active = (b, u) => !b.result && u && !u.dead && u.hp > 0;
const distance = B.distance;
function proc(b, fn) {
  b.itemProcDepth = (b.itemProcDepth || 0) + 1;
  try {
    return fn();
  } finally {
    b.itemProcDepth--;
  }
}
function note(b, u, id, text) {
  b.log('item', id + ' · ' + text, { source: u.uid, sourceTag: 'ITEM_PROC', itemId: id });
}
function start(b) {
  for (const u of b.alive()) {
    if (has(u, 'I37')) {
      proc(b, () => {
        for (const ally of b.allies(u).filter((a) => distance(a.pos, u.pos) <= 1))
          b.shield(ally, u.stats.HP * 0.15, 6, u);
      });
      note(b, u, 'I37', '시작 보호막');
    }
  }
}
function update(b) {
  if (b.result) return;
  for (const u of b.alive()) {
    const st = u.itemState;
    if (!st?.manaReturns) continue;
    st.manaReturns = st.manaReturns.filter((job) => {
      if (job.due > b.time + 1e-8) return true;
      u.mp = Math.min(u.stats.MP, u.mp + u.stats.MP * 0.3);
      note(b, u, 'I30', '최대 MP30% 회복');
      return false;
    });
  }
}
function preventDeath(b, target, source, opts = {}) {
  if (
    !active(b, target) ||
    !has(target, 'I28') ||
    target.itemState.immortalUsed ||
    b.itemProcDepth ||
    opts.itemProc
  )
    return false;
  target.itemState.immortalUsed = true;
  proc(b, () => b.shield(target, target.stats.HP * 0.3, 4, target));
  note(b, target, 'I28', '치명상 방지 · HP1 생존');
  return true;
}
/** Battle hooks for item-effects (see combat/hooks.js for ordering). */
const extension = {
  name: 'item-effects',
  order: 10,
  around: {
    stats(inner, u) {
      const s = inner(u),
        st = u.itemState || {};
      if (st.warStacks) {
        s.AD *= 1 + st.warStacks * 0.05;
        s.AP *= 1 + st.warStacks * 0.05;
      }
      if (st.frenzyStacks) s.AS *= 1 + st.frenzyStacks * 0.05;
      return s;
    },
    heal(inner, target, amount, source) {
      const eligible =
        active(this, source) &&
        has(source, 'I35') &&
        this.itemCastFrame?.source === source.uid &&
        !this.itemProcDepth;
      if (eligible) amount *= 1.3;
      const actual = inner(target, amount, source);
      if (eligible && actual > 0 && active(this, target))
        proc(this, () => {
          this.shield(target, actual * 0.25, 3, source);
        });
      return actual;
    },
    summon(inner, owner, kind) {
      const pet = inner(owner, kind);
      if (pet && active(this, owner) && has(owner, 'I31') && !this.itemProcDepth) {
        pet.stats.AD *= 1.3;
        pet.expires = this.time + (pet.expires - this.time) * 1.4;
        note(this, owner, 'I31', '소환수 공격피해+30% · 지속시간+40%');
      }
      return pet;
    },
    kill(inner, target, source = null, expired = false) {
      const wasAlive = !target.dead,
        previous = this.itemSplashFrame;
      if (!previous) this.itemSplashFrame = { origins: new Set(), recipients: new Set() };
      try {
        const result = inner(target, source, expired);
        if (
          wasAlive &&
          target.dead &&
          !expired &&
          active(this, source) &&
          source.team !== target.team &&
          has(source, 'I40') &&
          !this.itemProcDepth
        ) {
          source.itemState.warStacks = Math.min(5, (source.itemState.warStacks || 0) + 1);
          note(this, source, 'I40', '처치 중첩 ' + source.itemState.warStacks);
        }
        return result;
      } finally {
        this.itemSplashFrame = previous;
      }
    },
    cast(inner, u, target) {
      if (!active(this, u) || !target || target.dead) return;
      const previous = this.itemCastFrame;
      this.itemCastFrame = { source: u.uid, origins: new Set(), recipients: new Set() };
      try {
        inner(u, target);
        if (this.itemProcDepth || !active(this, u)) return;
        const st = u.itemState;
        if (has(u, 'I30') && this.time >= (st.nextManaReturn || 0)) {
          st.nextManaReturn = this.time + 8;
          st.manaReturns = st.manaReturns || [];
          st.manaReturns.push({ due: this.time + 3 });
          note(this, u, 'I30', '3초 후 마나 회복 예약');
        }
        if (has(u, 'I27') && this.enemies(u).length && this.rng() < 0.25) {
          const next = active(this, target) ? target : this.target(u);
          if (next) {
            const mp = u.mp;
            note(this, u, 'I27', '무료 추가 스킬');
            proc(this, () => {
              inner(u, next);
            });
            u.mp = mp;
          }
        }
      } finally {
        this.itemCastFrame = previous;
      }
    },
    deal(inner, source, target, amount, type = 'physical', opts = {}) {
      const kind = opts.kind || 'skill',
        valid = active(this, target),
        external = !!opts.itemProc && !this.itemProcDepth;
      if (external) this.itemProcDepth = (this.itemProcDepth || 0) + 1;
      try {
        const normal = !this.itemProcDepth && active(this, source);
        if (normal && valid && kind === 'basic') {
          if (has(source, 'I34') && target.hp / target.stats.HP <= 0.25) amount *= 1.5;
          if (has(source, 'I38')) {
            const st = source.itemState;
            if (st.lastAttackTarget !== target.uid) {
              st.lastAttackTarget = target.uid;
              st.frenzyStacks = 0;
            }
            st.frenzyStacks = Math.min(8, (st.frenzyStacks || 0) + 1);
          }
        }
        const result = inner(source, target, amount, type, opts);
        if (!normal || !valid || this.result) return result;
        if (result.evaded) {
          if (
            active(this, target) &&
            has(target, 'I36') &&
            this.time >= (target.itemState.nextEvade || 0)
          ) {
            target.itemState.nextEvade = this.time + 6;
            this.addStatus(target, {
              key: 'itemEvade',
              label: '폭풍 망토 AS+20%',
              stat: 'AS',
              mult: 1.2,
              source: target.uid,
              expires: this.time + 4,
              harmful: false,
            });
            note(this, target, 'I36', '회피 후 AS강화');
          }
          return result;
        }
        if (!active(this, source)) return result;
        if (kind === 'basic') {
          if (has(source, 'I29') && result.damage > 0)
            proc(this, () => this.heal(source, result.damage * 0.2, source));
          if (has(source, 'I32') && active(this, target)) {
            this.dot(
              target,
              source,
              'itemHellfire',
              '지옥불 화상',
              this.stats(source).AP * 0.25,
              4,
            );
            const status = target.statuses.find(
              (s) => s.key === 'itemHellfire' && s.source === source.uid,
            );
            if (status) status.itemProc = true;
          }
          const foes = this.enemies(source)
            .filter((e) => e !== target && distance(e.pos, target.pos) <= 1)
            .sort(
              (a, b) => distance(a.pos, target.pos) - distance(b.pos, target.pos) || a.uid - b.uid,
            )
            .slice(0, 2);
          if (has(source, 'I26') && foes.length && this.rng() < 0.25) {
            note(this, source, 'I26', '연쇄 번개');
            proc(this, () => {
              for (const foe of foes)
                this.deal(source, foe, this.stats(source).AD * 0.6, 'magic', {
                  kind: 'item',
                  canCrit: false,
                  itemProc: true,
                });
            });
          }
        }
        if (kind === 'skill' && result.damage > 0) {
          if (has(source, 'I33') && active(this, target)) {
            this.debuff(target, source, 'itemFrost', '영원의 서리 AS−25%', 'AS', 0.75, 3);
            const st = source.itemState;
            st.frostCounts = st.frostCounts || {};
            st.frostCounts[target.uid] = (st.frostCounts[target.uid] || 0) + 1;
            if (st.frostCounts[target.uid] >= 3) {
              st.frostCounts[target.uid] = 0;
              this.addStatus(target, {
                key: 'stun',
                label: '서리 기절',
                source: source.uid,
                expires: this.time + 1,
                harmful: true,
              });
            }
          }
          if (has(source, 'I39')) {
            const frame = this.itemCastFrame ||
              this.itemSplashFrame || { origins: new Set(), recipients: new Set() };
            if (!frame.origins.has(target.uid)) {
              frame.origins.add(target.uid);
              const foes = this.enemies(source).filter(
                (e) =>
                  e !== target && distance(e.pos, target.pos) <= 1 && !frame.recipients.has(e.uid),
              );
              proc(this, () => {
                for (const foe of foes) {
                  frame.recipients.add(foe.uid);
                  this.deal(source, foe, result.damage * 0.35, 'magic', {
                    kind: 'item',
                    canCrit: false,
                    itemProc: true,
                  });
                }
              });
            }
          }
        }
        return result;
      } finally {
        if (external) this.itemProcDepth--;
      }
    },
  },
  on: {
    start: { order: 20, run: (b) => api.start(b) },
    update: { order: 10, run: (b) => api.update(b) },
  },
};
/** Register on a Battle class (kept for callers of the old API). */
function install(Battle) {
  Battle.use(extension);
}
const api = {
  extension,
  install,
  start,
  update,
  preventDeath,
  has,
  proc,
};

export default api;
