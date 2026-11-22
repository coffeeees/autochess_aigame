// 완성 장비 36종의 고유 효과(v0.20.0 아이템 개편, 요청서의 1차 테스트안 그대로·임시값). 장비의 effectKey로 판정한다.
// 능력치(재료에서 이어받은 % 능력치·추가 능력치)는 items.applyStats가 전투 전에 이미 넣었다. 여기서는 발동 효과만.
// 사용자 결정(2026-11-23): 같은 완성 장비 중복 착용 허용 → 효과는 개수만큼 더한다(배율은 합산, 추가 타격·보호막은 개수만큼).
// 회피·치명타 확률 상한은 따로 두지 않는다(치명타는 전투 기본 규칙대로 100%까지). 소환수에는 장비 효과가 없다.
// 추가 공격·추가 피해(itemProc)는 다시 추가 공격·추가 피해를 만들지 않는다(연쇄 차단).
// 보호막 지속 시간·발동 간격은 요청서에 정해지지 않아 전투 끝까지(999초)로 둔다(테스트용 임시값).
import I from '../items.js';

const LONG = 999;
const active = (b, u) => !b.result && u && !u.dead && u.hp > 0;
/** 유닛이 가진 그 효과 장비 수(소환수는 0) */
function count(u, key) {
  if (!u || u.summon) return 0;
  let n = 0;
  for (const id of u.itemIds || []) if (I.byId(id)?.effectKey === key) n++;
  return n;
}
function proc(b, fn) {
  b.itemProcDepth = (b.itemProcDepth || 0) + 1;
  try {
    return fn();
  } finally {
    b.itemProcDepth--;
  }
}
function note(b, u, key, text) {
  b.log('item', key + ' · ' + text, { source: u.uid, sourceTag: 'ITEM_PROC', itemEffect: key });
}
/** 보호막(보호막 강화 유대 등과 무관하게 장비 수치 그대로) */
function shield(b, u, amount) {
  if (amount <= 0 || !active(b, u)) return;
  u.shields.push({ amount, expires: b.time + LONG, source: u.uid, kind: 'normal' });
  b.statsTotal.shielding += amount;
  b.log('shield', `${u.name} 장비 보호막 +${Math.round(amount)}`, {
    source: u.uid,
    target: u.uid,
    amount,
  });
}
function addMana(u, ratio) {
  if (u.dead || u.summon || ratio <= 0) return;
  u.mp = Math.min(u.stats.MP, u.mp + u.stats.MP * ratio);
}
/** 일정 시간 버프(능력치 배율): 같은 열쇠면 시간만 늘린다 */
function buff(b, u, key, label, stat, mult, seconds) {
  b.addStatus(u, {
    key,
    label,
    stat,
    mult,
    source: u.uid,
    expires: b.time + seconds,
    harmful: false,
  });
}

function start(b) {
  for (const u of b.alive()) {
    const st = (u.itemState ||= {});
    st.basicCount = 0;
    const guard = count(u, 'guardianblade');
    if (guard) shield(b, u, u.stats.HP * 0.15 * guard);
    const heart = count(u, 'manaheart');
    if (heart) addMana(u, 0.3 * heart);
  }
}

function update(b) {
  if (b.result) return;
  for (const u of b.alive()) {
    const n = count(u, 'regencloak');
    if (!n) continue;
    const st = (u.itemState ||= {});
    st.nextRegen ??= 5;
    if (b.time + 1e-8 >= st.nextRegen) {
      st.nextRegen += 5;
      const missing = Math.max(0, u.stats.HP - u.hp);
      if (missing > 0) proc(b, () => b.heal(u, missing * 0.08 * n, u));
    }
  }
}

/** 예전 장비(불사의 갑주)의 치명상 방지 자리. v0.20.0 장비에는 없어 항상 false */
function preventDeath() {
  return false;
}

/** 회피 성공 뒤 효과(대상 = 회피한 쪽) */
function afterEvade(b, u) {
  if (!active(b, u)) return;
  const st = (u.itemState ||= {});
  const gale = count(u, 'galeblade');
  if (gale) buff(b, u, 'itemGale', '질풍검 AS+20%', 'AS', 1 + 0.2 * gale, 3);
  if (count(u, 'phantombow')) st.guaranteedCrit = true;
  const armor = count(u, 'phantomarmor');
  if (armor) st.phantomArmor = { until: b.time + 3, gd: 15 * armor };
  const flow = count(u, 'flowcrystal');
  if (flow) addMana(u, 0.1 * flow);
  const shadow = count(u, 'shadowglove');
  if (shadow) st.shadowGlove = { until: b.time + 4, ctc: 20 * shadow };
}

const extension = {
  name: 'item-effects',
  order: 10,
  around: {
    stats(inner, u) {
      const s = inner(u),
        st = u.itemState || {};
      if (st.phantomArmor && this.time < st.phantomArmor.until) s.GD += st.phantomArmor.gd;
      if (st.shadowGlove && this.time < st.shadowGlove.until) s.CTC += st.shadowGlove.ctc;
      if (st.inBasic) s.CTH += 30 * count(u, 'assassinglove'); // 암살자의 장갑: 기본 공격 치명타 피해만
      return s;
    },
    cast(inner, u, target) {
      if (!active(this, u) || !target || target.dead) return;
      const previous = this.itemCastFrame;
      this.itemCastFrame = { source: u.uid, focused: false };
      try {
        inner(u, target);
      } finally {
        this.itemCastFrame = previous;
      }
      if (this.itemProcDepth || !active(this, u)) return;
      const st = (u.itemState ||= {});
      const cut = count(u, 'spellcutter');
      if (cut) st.spellcut = 0.35 * cut;
      proc(this, () => {
        const life = count(u, 'lifestaff');
        if (life) {
          this.heal(u, u.stats.HP * 0.05 * life, u);
          const low = this.allies(u)
            .filter((a) => a !== u && !a.summon && active(this, a))
            .sort((a, c) => a.hp / a.stats.HP - c.hp / c.stats.HP || a.uid - c.uid)[0];
          if (low) this.heal(low, low.stats.HP * 0.05 * life, u);
        }
        const spring = count(u, 'lifespring');
        if (spring) this.heal(u, u.stats.HP * 0.08 * spring, u);
        const barrier = count(u, 'manabarrier');
        if (barrier) shield(this, u, u.stats.HP * 0.1 * barrier);
      });
      const tome = count(u, 'archtome');
      if (tome) addMana(u, 0.15 * tome);
      const wind = count(u, 'windstaff');
      if (wind) buff(this, u, 'itemWind', '바람술사 AS+25%', 'AS', 1 + 0.25 * wind, 3);
      const ward = count(u, 'arcaneshield');
      if (ward) st.arcaneShield = { until: this.time + 4, cut: 0.15 * ward };
    },
    deal(inner, source, target, amount, type = 'physical', opts = {}) {
      const kind = opts.kind || 'skill',
        valid = active(this, target),
        normal =
          !this.itemProcDepth && !opts.itemProc && !opts.bondTransfer && active(this, source);
      const st = source ? (source.itemState ||= {}) : {};
      if (normal && valid) {
        // 주는 피해
        if (kind === 'basic') {
          amount *= 1 + 0.2 * count(source, 'berserker');
          if (st.spellcut && !opts.extraAttack) {
            amount *= 1 + st.spellcut;
            st.spellcut = 0;
          }
          if (st.guaranteedCrit) {
            opts = { ...opts, critBonus: (opts.critBonus || 0) + 1000 };
            st.guaranteedCrit = false;
          }
        }
        if (kind === 'skill') {
          amount *= 1 + 0.2 * count(source, 'archcrown');
          if (count(source, 'arcaneeye')) opts = { ...opts, canCrit: true };
        }
        const exe = count(source, 'executioner');
        if (exe && target.hp / target.stats.HP <= 0.3) amount *= 1 + 0.2 * exe;
      }
      // 받는 피해(장착자 쪽, 회피와 무관하게 피해량에만)
      if (valid && !opts.bondTransfer) {
        const tst = target.itemState || {};
        let cut = 0.12 * count(target, 'immortalarmor');
        if (tst.arcaneShield && this.time < tst.arcaneShield.until) cut += tst.arcaneShield.cut;
        if (cut) amount *= Math.max(0, 1 - cut);
      }
      if (normal && kind === 'basic') st.inBasic = true;
      let result;
      try {
        result = inner(source, target, amount, type, opts);
      } finally {
        st.inBasic = false;
      }
      if (this.result) return result;
      if (result.evaded) {
        if (valid && !opts.bondTransfer) afterEvade(this, target);
        return result;
      }
      // 맞은 쪽 효과
      if (valid && !opts.bondTransfer && result.damage > 0) {
        const mark = count(target, 'survivormark');
        const tst = (target.itemState ||= {});
        if (
          mark &&
          !tst.survivorUsed &&
          active(this, target) &&
          target.hp / target.stats.HP <= 0.3
        ) {
          tst.survivorUsed = true;
          shield(this, target, target.stats.HP * 0.2 * mark);
          note(this, target, 'survivormark', '보호막');
        }
        const counter = count(target, 'counterarmor');
        if (
          counter &&
          kind === 'basic' &&
          active(this, source) &&
          active(this, target) &&
          !opts.itemProc
        )
          proc(this, () =>
            this.deal(target, source, this.stats(target).GD * 0.5 * counter, 'physical', {
              kind: 'item',
              canCrit: false,
              itemProc: true,
            }),
          );
      }
      if (!normal || !active(this, source)) return result;
      // 가한 쪽 효과
      if (result.damage > 0) {
        const vamp = count(source, 'vampblade');
        if (vamp) proc(this, () => this.heal(source, result.damage * 0.12 * vamp, source));
      }
      if (kind === 'skill' && result.critical) {
        const focus = count(source, 'focuscrystal');
        const frame = this.itemCastFrame;
        if (focus && (!frame || !frame.focused)) {
          if (frame) frame.focused = true;
          addMana(source, 0.1 * focus);
        }
      }
      if (kind !== 'basic' || opts.extraAttack) return result;
      // 기본 공격 횟수 효과(추가 공격은 세지 않음)
      st.basicCount = (st.basicCount || 0) + 1;
      const n = st.basicCount;
      const ap = () => this.stats(source).AP;
      proc(this, () => {
        const rune = count(source, 'runeblade');
        if (rune && active(this, target))
          this.deal(source, target, ap() * 0.2 * rune, 'magic', {
            kind: 'item',
            canCrit: false,
            itemProc: true,
          });
        const bow = count(source, 'spellbow');
        if (bow && n % 3 === 0 && active(this, target))
          this.deal(source, target, ap() * 0.35 * bow, 'magic', {
            kind: 'item',
            canCrit: false,
            itemProc: true,
          });
        const vital = count(source, 'vitalbow');
        if (vital) this.heal(source, source.stats.HP * 0.01 * vital, source);
        const wall = count(source, 'bulwarkbow');
        if (wall && n % 4 === 0) shield(this, source, source.stats.HP * 0.05 * wall);
      });
      const rapid = count(source, 'rapidbow');
      if (rapid && n % 5 === 0)
        buff(this, source, 'itemRapid', '속사 AS+25%', 'AS', 1 + 0.25 * rapid, 3);
      const manaBow = count(source, 'manabow');
      if (manaBow) this.gainMana(source, this.config.combat.manaOnAttack * 0.2 * manaBow);
      const storm = count(source, 'stormblade');
      if (storm && n % 4 === 0)
        for (let i = 0; i < storm && active(this, target) && active(this, source); i++)
          this.deal(source, target, this.stats(source).AD, source.attackType || 'physical', {
            kind: 'basic',
            extraAttack: true,
          });
      return result;
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
const api = { extension, install, start, update, preventDeath, count, proc };

export default api;
