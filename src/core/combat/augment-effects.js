// 증강의 전투 효과. 증강 ID가 아니라 effect 필드로 판정한다(이전 증강 36종과 v0.16.0 후보 54종이 같은 장치를 씀).
// 기본안(사용자 승인 2026-11-18):
//  - 능력치 %: 현재 값에 곱하기. GD +n: 고정값. 피해량 +%끼리는 더한 뒤 곱한다.
//  - 앞줄·뒷줄: 전투 시작 때 아군이 서 있는 가장 앞(적과 가까운) 줄 / 가장 뒷줄. 전방 2줄 = 아군 4줄 중 앞 2줄.
//  - 동률: 코스트 → 성급 → 앞쪽 칸(번호가 작은 칸).
//  - 소환수·분신: 처치는 주인 몫. 아군 사망·생존 판정에서는 뺀다.
import A from '../augments.js';
import D from '../data/units.js';
import { distance } from './geometry.ts';

const alive = (u) => u && !u.dead && u.hp > 0;
const list = (b, key) => A.effects(b.augmentIds, key);
const first = (b, key) => list(b, key)[0];
const cost = (u) => D.byId(u.id)?.cost ?? 0;
const rowOf = (b, u) => Math.floor(u.pos / b.config.board.columns);
/** 아군 중 소환수·분신이 아닌 유닛 */
const crew = (b, all = false) =>
  b.units.filter((u) => u.team === 'ally' && !u.summon && (all || alive(u)));
/** 동률 규칙: 코스트 높은(desc) 또는 낮은(asc) 순 → 성급 같은 방향 → 앞쪽 칸 */
function pick(units, order = 'high') {
  const dir = order === 'high' ? -1 : 1;
  return [...units].sort(
    (a, b) => dir * (cost(a) - cost(b)) || dir * ((a.star || 1) - (b.star || 1)) || a.pos - b.pos,
  )[0];
}
const scaleStat = (u, key, mult) => {
  u.stats[key] *= mult;
  if (key === 'HP') u.hp = u.stats.HP;
};

/** 방어·회피·치명타를 무시하는 고정 피해. 보호막에는 먼저 막힌다. minHp가 있으면 그 아래로 내리지 않는다. */
function fixedDamage(b, target, amount, label, minHp = 0) {
  if (!alive(target) || amount <= 0) return 0;
  let rest = amount;
  for (const s of target.shields) {
    const used = Math.min(s.amount, rest);
    s.amount -= used;
    rest -= used;
  }
  const before = target.hp;
  target.hp = Math.max(minHp, target.hp - rest);
  const dealt = before - target.hp;
  b.log('damage', `${label} → ${target.name} −${Math.round(dealt)}`, {
    target: target.uid,
    amount: dealt,
    damageType: 'magic',
    attackKind: 'skill',
    sourceTag: 'AUGMENT',
  });
  if (target.hp <= 0) b.kill(target, null);
  return dealt;
}

/** 원본 옆 빈 칸(가까운 순) */
function freeCellNear(b, pos) {
  const occupied = new Set(b.units.filter((u) => !u.dead).map((u) => u.pos)),
    queue = [pos],
    seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p !== pos && !occupied.has(p)) return p;
    for (const q of b.neighbors(p))
      if (!seen.has(q)) {
        seen.add(q);
        queue.push(q);
      }
  }
  return null;
}
/** 분신: 원본의 현재 능력치에서 최대 HP·AD·AP를 비율만큼. 장비 없음, 기본 공격만(소환수는 스킬을 쓰지 않음). */
function spawnClone(b, orig, e) {
  const pos = freeCellNear(b, orig.pos);
  if (pos === null) {
    b.log('augment', `${orig.name} 분신 · 소환 공간 없음`, { source: orig.uid });
    return null;
  }
  const unit = b.makeUnit({ id: orig.id, pos, star: orig.star, itemIds: [] }, 'ally');
  unit.stats = { ...orig.stats, MP: 0 };
  unit.stats.HP = orig.stats.HP * e.hp;
  unit.stats.AD = orig.stats.AD * e.power;
  unit.stats.AP = orig.stats.AP * e.power;
  unit.hp = unit.stats.HP;
  unit.mp = 0;
  unit.summon = true;
  unit.summonKind = 'clone';
  unit.owner = orig.uid;
  unit.name = orig.name + ' 분신';
  unit.expires = 1e9; // 전투 끝까지(JSON으로 Worker에 넘어가도 유지되는 큰 수)
  unit.augmentState = {};
  b.units.push(unit);
  b.statsTotal.summons++;
  b.log('summon', `${orig.name} → ${unit.name} 소환`, { source: orig.uid, target: unit.uid });
  return unit;
}

/** 전투 시작 전 단계(유대 효과보다 먼저): 희생(P18), 조합 단계 올림(P14) */
function setup(b) {
  b.augment = {
    heatTick: 0,
    dominionUsed: false,
    haste: [],
    avenge: 0,
    lastStandUsed: false,
    judgmentDone: false,
    sacrifice: null,
    boosted: null,
  };
  const sac = first(b, 'sacrifice');
  if (sac) {
    const allies = crew(b);
    if (allies.length >= 2) {
      const victim = pick(allies, 'low');
      b.units.splice(b.units.indexOf(victim), 1);
      b.augment.sacrifice = { id: victim.id, cost: cost(victim), perCost: sac.perCost };
      b.synergySnapshot.ally = D.evaluateSynergies(crew(b));
      b.log('augment', `희생의 의식 · ${victim.name}`, {});
    }
  }
  if (list(b, 'bondBoost').length) {
    const open = b.synergySnapshot.ally.filter((s) => s.tier > 0 && s.tier < s.thresholds.length);
    if (open.length) {
      const s = open[Math.min(open.length - 1, Math.floor(b.rng() * open.length))];
      s.tier++;
      s.threshold = s.thresholds[s.tier - 1];
      b.augment.boosted = s.name;
      b.log('augment', `이중 조합 · ${s.name} ${s.threshold}명 단계`, {});
    }
  }
}

function start(b) {
  b.augment ||= { haste: [], avenge: 0 };
  for (const u of b.units) u.augmentState = {};
  // 이전 증강: 시작 보호막
  for (const shield of list(b, 'startShield'))
    for (const u of b.alive('ally')) b.shield(u, u.stats.HP * shield.ratio, shield.seconds, u);
  const allies = crew(b);
  if (!allies.length) return;
  const rows = allies.map((u) => rowOf(b, u)),
    front = Math.min(...rows),
    back = Math.max(...rows),
    allyTop = b.config.board.rows / 2; // 아군 4줄의 첫 줄 번호
  const sac = b.augment.sacrifice;
  if (sac)
    for (const u of allies) {
      const m = 1 + sac.cost * sac.perCost;
      scaleStat(u, 'AD', m);
      scaleStat(u, 'AP', m);
      scaleStat(u, 'HP', m);
    }
  for (const e of list(b, 'frontRow'))
    for (const u of allies.filter((u) => rowOf(b, u) === front)) scaleStat(u, 'HP', 1 + e.hp);
  for (const e of list(b, 'backRow'))
    for (const u of allies.filter((u) => rowOf(b, u) === back)) scaleStat(u, 'AS', 1 + e.as);
  for (const e of list(b, 'twinGuard')) {
    const line = allies.filter((u) => rowOf(b, u) === front);
    if (line.length === 2) for (const u of line) u.stats.GD += e.gd;
  }
  for (const e of list(b, 'ace')) {
    const best = [...allies].sort(
      (x, y) => b.stats(y).AD - b.stats(x).AD || cost(y) - cost(x) || x.pos - y.pos,
    )[0];
    scaleStat(best, 'AS', 1 + e.as);
    best.augmentState.ace = true;
  }
  const extraDamage = (u, v) => (u.augmentState.damage = (u.augmentState.damage || 0) + v);
  for (const e of list(b, 'chosen')) {
    const u = pick(allies);
    scaleStat(u, 'HP', 1 + e.hp);
    extraDamage(u, e.damage);
    u.augmentState.chosen = true;
  }
  for (const e of list(b, 'king')) {
    const u = pick(allies);
    scaleStat(u, 'HP', 1 + e.hp);
    extraDamage(u, e.damage);
    u.augmentState.king = e.deathDamage;
  }
  const activeBonds = b.synergySnapshot.ally.filter((s) => s.tier > 0).length;
  for (const e of list(b, 'bondPower'))
    for (const u of allies) {
      scaleStat(u, 'AD', 1 + e.power * activeBonds);
      scaleStat(u, 'AP', 1 + e.power * activeBonds);
      if (e.hp) {
        u.stats.HP += e.hp * activeBonds;
        u.hp = u.stats.HP;
      }
    }
  b.augment.harmony = 0;
  for (const e of list(b, 'harmony'))
    if (activeBonds >= e.bonds) {
      b.augment.harmony += e.damage;
      for (const u of allies) scaleStat(u, 'HP', 1 + e.hp);
    }
  for (const e of list(b, 'command')) {
    const frontCount = allies.filter((u) => rowOf(b, u) < allyTop + 2).length;
    for (const u of allies.filter((u) => rowOf(b, u) >= allyTop + 2))
      extraDamage(u, Math.min(e.max, e.per * frontCount));
  }
  for (const e of list(b, 'clone')) {
    let orig = null;
    if (e.pick === 'designated' && b.allyModifiers.cloneTarget != null)
      orig = allies.find((u) => u.persistentUid === b.allyModifiers.cloneTarget) || null;
    orig ||= pick(allies);
    if (alive(orig)) spawnClone(b, orig, e);
  }
}

function update(b) {
  if (b.result) return;
  const g = b.augment;
  // 이전 증강: 5초마다 AD·AP 중첩, 10초 1회 강화
  const heat = first(b, 'heat');
  if (heat) {
    const tick = Math.min(heat.max, Math.floor((b.time + 1e-8) / heat.interval));
    while (g.heatTick < tick) {
      g.heatTick++;
      for (const u of b.alive('ally')) {
        u.augmentState.heat = Math.min(heat.max, (u.augmentState.heat || 0) + 1);
        b.log('augment', '전투의 열기 ' + u.augmentState.heat + '중첩', { source: u.uid });
      }
    }
  }
  const dominion = first(b, 'dominion');
  if (dominion && !g.dominionUsed && b.time + 1e-8 >= dominion.at) {
    g.dominionUsed = true;
    for (const u of b.alive('ally')) {
      u.augmentState.dominion = true;
      b.log('augment', '전장의 지배자 발동', { source: u.uid });
    }
  }
  // 시간마다 아군 전체 AS 중첩(S02·G03)
  list(b, 'haste').forEach((e, i) => {
    const tick = Math.min(e.max, Math.floor((b.time + 1e-8) / e.interval));
    if ((g.haste[i] || 0) < tick) {
      g.haste[i] = tick;
      b.log('augment', `AS 가속 ${tick}중첩`, {});
    }
  });
  const judgment = first(b, 'judgment');
  if (judgment && !g.judgmentDone && b.time + 1e-8 >= judgment.at) {
    g.judgmentDone = true;
    for (const u of b.alive('enemy').filter((x) => !x.summon))
      fixedDamage(b, u, u.stats.HP * (u.boss ? judgment.boss : judgment.ratio), '최후의 심판');
  }
}

/** 이전 증강·불멸의 군단: 전투당 1회 HP 1로 생존 + 보호막 */
function preventDeath(b, target) {
  const e = first(b, 'immortal');
  if (!e || target.team !== 'ally' || !alive(target) || target.augmentState.immortalUsed)
    return false;
  target.augmentState.immortalUsed = true;
  b.shield(target, target.stats.HP * e.ratio, e.seconds, target);
  const name = A.selected(b.augmentIds).find((x) => x.effect.immortal)?.name;
  b.log('augment', name + ' · HP1 생존', { source: target.uid });
  return true;
}

/** 쓰러짐 처리: 처치 보상(처치자는 소환수면 주인), 아군 사망 반응 */
function afterDeath(b, target, source) {
  const killer = source?.summon ? b.units.find((u) => u.uid === source.owner) || source : source;
  if (target.team === 'enemy') {
    if (alive(killer) && killer.team === 'ally') {
      for (const e of list(b, 'killRush')) {
        killer.augmentState.killRush = { until: b.time + e.seconds, power: e.power };
        b.log('augment', '승리의 여세', { source: killer.uid });
      }
      for (const ratio of list(b, 'killRecover'))
        b.heal(killer, Math.max(0, killer.stats.HP - killer.hp) * ratio, killer);
    }
    for (const e of list(b, 'killHeal')) {
      const low = [...crew(b)].sort(
        (x, y) => x.hp / x.stats.HP - y.hp / y.stats.HP || cost(y) - cost(x) || x.pos - y.pos,
      )[0];
      if (low) b.heal(low, low.stats.HP * e.ratio, low);
    }
    return;
  }
  if (target.summon) return; // 소환수·분신의 사망은 아군 사망으로 세지 않음
  for (const e of list(b, 'inherit')) {
    const s = b.stats(target),
      heir = [...crew(b)].sort(
        (x, y) =>
          distance(x.pos, target.pos, b.config.board.columns) -
            distance(y.pos, target.pos, b.config.board.columns) ||
          cost(y) - cost(x) ||
          x.pos - y.pos,
      )[0];
    if (heir) {
      const f = (heir.augmentState.flat ||= { AD: 0, AP: 0, GD: 0 });
      f.AD += s.AD * e.ratio;
      f.AP += s.AP * e.ratio;
      f.GD += s.GD * e.ratio;
      b.log('augment', `영혼의 계승 → ${heir.name}`, { source: heir.uid });
    }
  }
  // 복수 중첩은 계승 계산(사망 순간 능력치) 뒤에 올린다
  for (const e of list(b, 'avenge')) b.augment.avenge = Math.min(e.max, b.augment.avenge + 1);
  if (target.augmentState.king !== undefined)
    for (const u of crew(b))
      fixedDamage(b, u, u.stats.HP * target.augmentState.king, '왕의 친위대', 1);
  const rest = crew(b);
  for (const e of list(b, 'lastStand'))
    if (rest.length === 1 && !b.augment.lastStandUsed) {
      b.augment.lastStandUsed = true;
      const u = rest[0];
      b.shield(u, u.stats.HP * e.shield, 999, u);
      u.augmentState.lastStand = e.as;
      b.log('augment', '마지막 수호자', { source: u.uid });
    }
}

/** HP가 처음 임계 이하로 내려간 아군(S04·G02) */
function lowHealth(b, u) {
  if (!alive(u) || u.team !== 'ally' || u.summon) return;
  const ratio = u.hp / u.stats.HP;
  for (const e of list(b, 'lowGuard'))
    if (!u.augmentState.lowGuard && ratio <= e.threshold) {
      u.augmentState.lowGuard = true;
      b.shield(u, u.stats.HP * e.shield, e.seconds, u);
      b.log('augment', '최후의 저항', { source: u.uid });
    }
  for (const e of list(b, 'lowRally'))
    if (!u.augmentState.lowRally && ratio <= e.threshold) {
      u.augmentState.lowRally = { until: b.time + e.seconds, gd: e.gd };
      b.heal(u, u.stats.HP * e.heal, u);
      b.log('augment', '불굴의 의지', { source: u.uid });
    }
}

/** 피해량 배율(아군 쪽 공격자). 피해량 +%끼리는 더한다 */
function damageBonus(b, source, target, kind) {
  if (!source || source.team !== 'ally') return 0;
  const g = b.augment || {},
    st = source.augmentState || {};
  let bonus = (g.harmony || 0) + (st.damage || 0);
  for (const e of list(b, 'lateDamage')) if (b.time + 1e-8 >= e.at) bonus += e.damage;
  const focus = first(b, 'focus');
  if (focus && kind === 'basic') {
    if (st.focusTarget !== target.uid) {
      st.focusTarget = target.uid;
      st.focus = 0;
    }
    bonus += focus.per * (st.focus || 0);
  }
  return bonus;
}

/** Battle hooks for augment-effects (see combat/hooks.js for ordering). */
const extension = {
  name: 'augment-effects',
  order: 20,
  around: {
    stats(inner, u) {
      const s = inner(u),
        st = u.augmentState,
        g = this.augment;
      if (!st || !g) return s;
      const timeLord = first(this, 'timeLord');
      const tlOn =
        timeLord && this.time + 1e-8 >= timeLord.at && this.time < timeLord.at + timeLord.seconds;
      if (u.team === 'enemy') {
        if (tlOn) s.AS *= 1 + timeLord.enemy;
        return s;
      }
      // 이전 증강
      const heat = first(this, 'heat');
      if (heat && st.heat) {
        const ratio = 1 + heat.ratio * st.heat;
        s.AD *= ratio;
        s.AP *= ratio;
      }
      const dominion = first(this, 'dominion');
      if (dominion && st.dominion) {
        s.AD *= 1 + dominion.power;
        s.AP *= 1 + dominion.power;
        s.AS *= 1 + dominion.as;
      }
      // 후보 54종
      list(this, 'haste').forEach((e, i) => (s.AS *= 1 + e.as * (g.haste[i] || 0)));
      if (tlOn) s.AS *= 1 + timeLord.ally;
      if (st.killRush && this.time < st.killRush.until) {
        s.AD *= 1 + st.killRush.power;
        s.AP *= 1 + st.killRush.power;
      }
      const castPower = first(this, 'castPower');
      if (castPower && st.castPower) s.AP *= 1 + castPower.ap * st.castPower;
      if (st.castBuff && this.time < st.castBuff.until) s.AP *= 1 + st.castBuff.ap;
      const avenge = first(this, 'avenge');
      if (avenge && g.avenge && !u.summon) {
        s.AD *= 1 + avenge.power * g.avenge;
        s.AP *= 1 + avenge.power * g.avenge;
      }
      if (st.lowRally && this.time < st.lowRally.until) s.GD += st.lowRally.gd;
      if (st.flat) {
        s.AD += st.flat.AD;
        s.AP += st.flat.AP;
        s.GD += st.flat.GD;
      }
      if (st.lastStand) s.AS *= 1 + st.lastStand;
      return s;
    },
    summon(inner, owner, kind) {
      const pet = inner(owner, kind);
      if (pet) {
        pet.augmentState = {};
        if (pet.team === 'ally') {
          pet.stats = A.applyStats(pet.stats, this.augmentIds);
          pet.hp = pet.stats.HP;
        }
      }
      return pet;
    },
    kill(inner, target, source = null, expired = false) {
      const wasDead = target.dead;
      const result = inner(target, source, expired);
      if (!wasDead && target.dead && this.augment) afterDeath(this, target, source);
      return result;
    },
    cast(inner, u, target) {
      if (!alive(u) || !alive(target)) return;
      const manaReturn = first(this, 'manaReturn');
      const eligible = u.team === 'ally' && manaReturn && !this.itemProcDepth;
      const result = inner(u, target);
      if (u.team === 'ally' && alive(u) && !this.itemProcDepth) {
        const castPower = first(this, 'castPower');
        if (castPower)
          u.augmentState.castPower = Math.min(castPower.max, (u.augmentState.castPower || 0) + 1);
        const castBuff = first(this, 'castBuff');
        if (castBuff)
          u.augmentState.castBuff = { until: this.time + castBuff.seconds, ap: castBuff.ap };
      }
      if (eligible && alive(u) && this.time + 1e-8 >= (u.augmentState.nextMana || 0)) {
        u.augmentState.nextMana = this.time + manaReturn.cooldown;
        u.mp = Math.min(u.stats.MP, u.mp + u.stats.MP * manaReturn.ratio);
        this.log('augment', '마나 순환', { source: u.uid });
      }
      return result;
    },
    deal(inner, source, target, amount, type = 'physical', opts = {}) {
      const valid = alive(target),
        normal = source?.team === 'ally' && !this.itemProcDepth && !opts.itemProc,
        kind = opts.kind || 'skill';
      const bonus =
        !opts.bondTransfer && this.augment ? damageBonus(this, source, target, kind) : 0;
      const result = inner(source, target, amount * (1 + bonus), type, opts);
      if (this.augment && first(this, 'focus') && kind === 'basic' && source?.team === 'ally') {
        const st = source.augmentState;
        st.focus = Math.min(first(this, 'focus').max, (st.focus || 0) + 1);
      }
      if (normal && valid && alive(source) && result.damage > 0) {
        let ratio = 0;
        if (kind === 'basic') ratio += list(this, 'basicLeech').reduce((n, v) => n + v, 0);
        if (['basic', 'skill'].includes(kind))
          ratio += list(this, 'attackLeech').reduce((n, v) => n + v, 0);
        if (['basic', 'skill', 'dot'].includes(kind))
          ratio += list(this, 'allLeech').reduce((n, v) => n + v, 0);
        if (ratio > 0) {
          this.itemProcDepth = (this.itemProcDepth || 0) + 1;
          try {
            this.heal(source, result.damage * ratio, source);
          } finally {
            this.itemProcDepth--;
          }
        }
      }
      if (this.augment && result.damage > 0) lowHealth(this, target);
      return result;
    },
  },
  on: {
    start: { order: 30, run: (b) => api.start(b) },
    update: { order: 20, run: (b) => api.update(b) },
  },
};
/** 유대 효과보다 먼저 실행하는 전투 시작 단계(희생·조합 단계 올림). */
const setupExtension = {
  name: 'augment-setup',
  on: { start: { order: 5, run: (b) => api.setup(b) } },
};
/** Register on a Battle class (kept for callers of the old API). */
function install(Battle) {
  Battle.use(setupExtension);
  Battle.use(extension);
}
const api = {
  extension,
  setupExtension,
  setup,
  start,
  update,
  preventDeath,
  fixedDamage,
  install,
};

export default api;
