import D from '../data/units.js';
import W from '../encounters.js';
import A from '../augments.js';
import AF from './augment-effects.js';
import I from '../items.js';
import Bonds from './bond-effects.js';
import F from './item-effects.js';
import MF from './meta-effects.js';
import { storedRng } from '../rng.ts';
import { enableHooks } from './hooks.ts';
import { distance } from './geometry.ts';
import skills from './skills/index.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
/** 실제 회피 판정에 쓰는 회피 확률 %: 0 ~ 상한(cfg.dodgeCap, 기본 40) */
function effectiveDodge(dod, cfg = D.prototypeConfig.combat) {
  return Math.min(cfg.dodgeCap ?? 40, Math.max(0, dod || 0));
}
function mitigatedDamage(raw, gd, denominator = 100) {
  return (Math.max(0, raw) * denominator) / (denominator + Math.max(0, gd));
}
class Battle {
  constructor(allies, enemies, options = {}) {
    this.config = clone(D.prototypeConfig);
    if (options.rng) this.rng = options.rng;
    else {
      // Seeded battle: the generator state is a plain field, so it travels with
      // the battle to the worker and continues there (see combat-worker-host.js).
      this.rngState = (options.seed ?? 0) >>> 0;
      this.rng = storedRng(this, 'rngState', () => 0);
    }
    this.time = 0;
    this.units = [];
    this.logs = [];
    this.events = [];
    this.nextUid = 0;
    this.result = null;
    this.skillUses = {};
    this.statsTotal = { physical: 0, magic: 0, healing: 0, shielding: 0, summons: 0 };
    this.allyModifiers = options.allyModifiers || {};
    this.augmentIds = A.selected(this.allyModifiers.augmentIds).map((a) => a.id);
    this.enemyDamageMultiplier = options.enemyDamageMultiplier ?? 1;
    this.onUnitKilled = options.onUnitKilled || null;
    this.config.experimentalSynergyEffects.enabled = false;
    if (options.quickMana) this.config.combat.startMana = 1;
    this.synergySnapshot = {
      ally: D.evaluateSynergies(allies),
      enemy: D.evaluateSynergies(enemies),
    };
    if (
      allies.length >
        Math.min(
          A.config.maxCapacity,
          this.config.board.maxDeployed + A.aggregate(this.augmentIds).capacity,
        ) ||
      enemies.length > this.config.board.maxDeployed
    )
      throw Error('전장 배치 한도를 초과했습니다.');
    const sameLimit = A.sameUnitLimit(this.augmentIds); // G13 쌍둥이 전술이면 2명
    if (allies.some((u) => allies.filter((x) => x.id === u.id).length > sameLimit))
      throw Error(
        sameLimit > 1
          ? `동일한 캐릭터는 전장에 ${sameLimit}명까지 배치할 수 있습니다.`
          : '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.',
      );
    const occupied = new Set();
    for (const [team, list] of [
      ['ally', allies],
      ['enemy', enemies],
    ])
      for (const entry of list) {
        if (!D.playableIds.includes(entry.id) && !(team === 'enemy' && W.byId(entry.id)))
          throw Error('비활성 캐릭터는 전투에 사용할 수 없습니다: ' + entry.id);
        if (
          !Number.isInteger(entry.pos) ||
          entry.pos < 0 ||
          entry.pos >= this.config.board.columns * this.config.board.rows ||
          occupied.has(entry.pos)
        )
          throw Error('잘못되거나 중복된 배치 좌표');
        occupied.add(entry.pos);
        this.units.push(this.makeUnit(entry, team));
      }
    if (!allies.length || !enemies.length) throw Error('양쪽 진영에 캐릭터가 필요합니다.');
    this.emit('start'); // bond -> item -> augment effects (combat/hooks.js)
    this.log('system', '전투 시작 · 유대 단계는 전투 종료까지 고정됩니다.');
  }
  makeUnit(entry, team) {
    const spec = W.combatSpec(entry.id),
      star = entry.star || 1,
      mult = this.config.economy.starMultiplier ** (star - 1),
      scale = entry.scale || 1;
    const equipmentStats = I.applyStats(spec.stats, entry.bonuses || {}, mult * scale),
      stats = team === 'ally' ? A.applyStats(equipmentStats, this.augmentIds) : equipmentStats;
    const startMana = Math.min(
      stats.MP,
      stats.MP *
        Math.max(
          this.config.combat.startMana,
          team === 'ally' ? A.aggregate(this.augmentIds).startMana : 0,
        ),
    );
    return {
      uid: ++this.nextUid,
      persistentUid: entry.uid ?? null,
      id: entry.id,
      name: spec.name,
      skillId: spec.skillId || entry.id,
      bonus: !!(entry.bonus || spec.bonus),
      team,
      pos: entry.pos,
      star,
      boss: !!entry.boss,
      itemIds: entry.itemIds || [],
      itemState: {},
      augmentState: {},
      stats,
      hp: stats.HP,
      mp: startMana,
      statuses: [],
      shields: [],
      cooldown: 0,
      castUntil: 0,
      moveCooldown: 0,
      dead: false,
      summon: false,
      skillPower: 1,
      healingPower: 1,
      // 장비 MP 획득량 %(v0.20.0 마나 결정 계열). 최대 MP는 그대로
      manaGain: 1 + (entry.bonuses?.MPGainPercent || 0) / 100,
      regen: 0,
      lifesteal: 0,
      healingReduction: 0,
      statusDuration: 1,
      castHpCost: 0,
      damageDone: 0,
      healingDone: 0,
    };
  }
  log(kind, message, extra = {}) {
    const row = { time: Number(this.time.toFixed(1)), kind, message, ...extra };
    this.logs.push(row);
    if (this.logs.length > 600) this.logs.shift();
    this.events.push(row);
    return row;
  }
  alive(team) {
    return this.units.filter((u) => !u.dead && u.hp > 0 && (!team || u.team === team));
  }
  enemies(u) {
    return this.alive(u.team === 'ally' ? 'enemy' : 'ally');
  }
  allies(u) {
    return this.alive(u.team);
  }
  adjacent(a, b) {
    return distance(a.pos, b.pos, this.config.board.columns) <= 1;
  }
  stats(u) {
    const s = { ...u.stats };
    for (const effect of u.statuses)
      if (effect.stat && effect.expires > this.time) s[effect.stat] *= effect.mult;
    return Bonds.stats(this, u, s);
  }
  addStatus(target, status) {
    if (target.dead) return;
    const old = target.statuses.find((e) => e.key === status.key && e.source === status.source);
    if (old) {
      old.expires = Math.max(old.expires, status.expires);
      if (status.amount !== undefined) old.amount = status.amount;
    } else target.statuses.push({ ...status });
    Bonds.status(this, target, status);
    this.log('status', `${target.name} · ${status.label}`, { target: target.uid });
  }
  debuff(target, source, key, label, stat, mult, duration) {
    this.addStatus(target, {
      key,
      label,
      stat,
      mult,
      source: source.uid,
      expires: this.time + duration * source.statusDuration,
      harmful: true,
    });
  }
  dot(target, source, key, label, amount, duration) {
    this.addStatus(target, {
      key,
      label,
      source: source.uid,
      amount,
      expires: this.time + duration,
      nextTick: this.time + 1,
      interval: 1,
      harmful: true,
    });
  }
  gainMana(u, amount) {
    if (u.dead || u.summon) return;
    const magic = ['마법사', '사제', '주술사', '소환사'].includes(W.combatSpec(u.id).job)
      ? this.config.combat.magicManaMultiplier
      : 1;
    u.mp = Math.min(u.stats.MP, u.mp + amount * magic * u.manaGain);
  }
  shield(target, amount, duration, source, kind = 'normal') {
    if (!target || target.dead) return;
    amount *= Bonds.healPower(source);
    target.shields.push({ amount, expires: this.time + duration, source: source.uid, kind });
    this.statsTotal.shielding += amount;
    this.log('shield', `${source.name} → ${target.name} 보호막 +${Math.round(amount)}`, {
      source: source.uid,
      target: target.uid,
      amount,
    });
  }
  heal(target, amount, source) {
    if (!target || target.dead) return 0;
    const actual = Math.max(
      0,
      Math.min(
        target.stats.HP - target.hp,
        amount *
          Bonds.healPower(source) *
          source.healingPower *
          (1 -
            Math.min(
              0.9,
              Math.max(
                target.healingReduction,
                ...target.statuses
                  .filter((e) => e.healingReduction && e.expires > this.time)
                  .map((e) => e.healingReduction),
              ),
            )),
      ),
    );
    target.hp += actual;
    source.healingDone += actual;
    this.statsTotal.healing += actual;
    this.log('heal', `${source.name} → ${target.name} 회복 +${Math.round(actual)}`, {
      source: source.uid,
      target: target.uid,
      amount: actual,
    });
    return actual;
  }
  deal(source, target, amount, type = 'physical', opts = {}) {
    if (!target || target.dead || target.hp <= 0) return { damage: 0, critical: false };
    const bondInput = Bonds.beforeDamage(this, source, target, amount, opts);
    amount = bondInput.amount;
    opts = bondInput.opts;
    const cfg = this.config.combat,
      kind = opts.kind || 'skill',
      sourceStats = this.stats(source),
      targetStats = this.stats(target);
    const dodge =
      !opts.bondTransfer &&
      (kind === 'basic' ? cfg.basicDodge : kind === 'skill' ? cfg.skillsDodge : false);
    // 회피 상한(v0.21.0): 모든 출처를 더한 최종 회피 확률을 판정에서 최대 cfg.dodgeCap(40)%로
    if (dodge && this.rng() * 100 < effectiveDodge(targetStats.DOD, cfg)) {
      this.log('evade', `${target.name} 회피`, { target: target.uid });
      return { damage: 0, critical: false, evaded: true };
    }
    if (kind === 'basic') target.lastBasicAttacker = source.uid;
    const canCrit =
      opts.canCrit !== undefined
        ? opts.canCrit
        : kind === 'basic' || (kind === 'skill' && cfg.skillsCrit);
    const critical =
      canCrit && this.rng() * 100 < Math.min(100, sourceStats.CTC + (opts.critBonus || 0));
    const amp = Math.max(
      0,
      ...target.statuses
        .filter((e) => e.expires > this.time && e.damageAmp)
        .map((e) => e.damageAmp),
    );
    const raw =
      amount *
      (1 + amp) *
      (source.team === 'enemy' ? this.enemyDamageMultiplier : 1) *
      (critical ? sourceStats.CTH / 100 : 1) *
      (kind === 'skill' || kind === 'dot' ? source.skillPower : 1);
    let damage = opts.bondTransfer
      ? amount
      : mitigatedDamage(raw, targetStats.GD, cfg.defenseDenominator);
    if (!opts.bondTransfer && !opts.bondProc)
      damage = Bonds.share(this, source, target, damage, type, opts);
    const beforeShield = damage;
    const flameGuard = target.shields.find(
      (s) => s.kind === 'firewall' && s.amount > 0 && s.expires > this.time,
    );
    const absoluteWall = target.shields.find(
      (s) => s.kind === 'absoluteWall' && s.amount > 0 && s.expires > this.time,
    );
    const corrosive = target.shields.some(
      (s) => s.kind === 'corrosion' && s.amount > 0 && s.expires > this.time,
    );
    for (const shield of target.shields) {
      if (shield.expires <= this.time || shield.amount <= 0) continue;
      const block = Math.min(shield.amount, damage);
      shield.amount -= block;
      damage -= block;
      if (damage <= 0) break;
    }
    if (damage >= target.hp && Bonds.preventLethal(this, target, source, opts, F, AF))
      damage = Math.max(0, target.hp - 1);
    const actual = Math.min(target.hp, damage);
    target.hp = Math.max(0, target.hp - damage);
    source.damageDone += actual;
    this.statsTotal[type] += actual;
    this.log(
      'damage',
      `${source.name} → ${target.name} ${Math.round(actual)} ${type === 'physical' ? '물리' : '마법'}${critical ? ' 치명타' : ''}${beforeShield > damage ? ' (보호막 흡수)' : ''}`,
      {
        source: source.uid,
        target: target.uid,
        amount: actual,
        damageType: type,
        attackKind: kind,
        sourceTag: opts.itemProc || this.itemProcDepth ? 'ITEM_PROC' : 'NORMAL',
        critical,
      },
    );
    if (!opts.bondTransfer) this.gainMana(target, cfg.manaOnHit);
    if (absoluteWall && !opts.bondTransfer && kind === 'basic' && source.hp > 0) {
      const caster = this.units.find((u) => u.uid === absoluteWall.source) || target;
      this.debuff(source, caster, 'absoluteWallSlow', 'AS −20%', 'AS', 0.8, 3);
    }
    if (!opts.bondTransfer && corrosive && kind === 'basic')
      this.debuff(source, target, 'corrosion', '부식 GD −15%', 'GD', 0.85, 3);
    if (!opts.bondTransfer && source.lifesteal && kind === 'basic')
      this.heal(source, actual * source.lifesteal, source);
    if (
      !opts.bondTransfer &&
      flameGuard &&
      kind === 'basic' &&
      this.adjacent(source, target) &&
      source.hp > 0
    ) {
      const caster = this.units.find((u) => u.uid === flameGuard.source) || target;
      this.deal(caster, source, flameGuard.counterDamage || 0, 'magic', {
        kind: 'counter',
        canCrit: false,
      });
    }
    if (target.hp <= 0) this.kill(target, source);
    const result = { damage: actual, critical };
    Bonds.afterDamage(this, source, target, result, opts);
    return result;
  }
  kill(target, source = null, expired = false) {
    if (target.dead) return;
    if (Bonds.beforeKill(this, target, source, expired)) return;
    target.dead = true;
    target.hp = 0;
    if (this.onUnitKilled) this.onUnitKilled(target, source);
    this.log('death', `${target.name} ${expired ? '지속시간 종료' : '쓰러짐'}`, {
      target: target.uid,
    });
    if (target.summon && target.summonKind === 'fire') {
      const owner = this.units.find((u) => u.uid === target.owner) || target;
      this.log('skill', `${target.name} 소멸 폭발`, { source: target.uid });
      const foes = this.enemies(target).filter(
        (u) =>
          distance(u.pos, target.pos, this.config.board.columns) <=
          this.config.summons.fire.explosionRadius,
      );
      for (const enemy of foes) this.deal(owner, enemy, target.explosionDamage, 'magic');
    }
  }
  neighbors(pos) {
    const c = this.config.board.columns,
      r = this.config.board.rows;
    // 좌우 대치 전장(v0.18.0): 탐색 순서를 예전 상하 대치의 [위, 아래, 왼쪽, 오른쪽]을 회전한 것과 같게 둔다
    // (적 쪽 → 아군 쪽 → 위 → 아래). 같은 거리의 길 중 고르는 길이 예전과 같아 전투 결과가 바뀌지 않는다
    return [
      ...(pos % c < c - 1 ? [pos + 1] : []),
      ...(pos % c > 0 ? [pos - 1] : []),
      pos - c,
      pos + c,
    ].filter((p) => p >= 0 && p < c * r);
  }
  pathToRange(u, target, range) {
    if (u.statuses.some((e) => e.key === 'root' && e.expires > this.time)) return [];
    const occupied = new Set(
        this.alive()
          .filter((x) => x !== u)
          .map((x) => x.pos),
      ),
      queue = [u.pos],
      previous = new Map([[u.pos, null]]);
    let end = null;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (distance(p, target.pos, this.config.board.columns) <= range) {
        end = p;
        break;
      }
      for (const q of this.neighbors(p))
        if (!occupied.has(q) && !previous.has(q)) {
          previous.set(q, p);
          queue.push(q);
        }
    }
    if (end === null) return [];
    const path = [];
    while (end !== u.pos) {
      path.unshift(end);
      end = previous.get(end);
    }
    return path;
  }
  target(u) {
    return this.enemies(u).sort(
      (a, b) =>
        distance(u.pos, a.pos, this.config.board.columns) -
          distance(u.pos, b.pos, this.config.board.columns) ||
        a.hp - b.hp ||
        a.uid - b.uid,
    )[0];
  }
  skillTargets(u, target, count) {
    return this.enemies(u)
      .sort(
        (a, b) =>
          Number(b === target) - Number(a === target) ||
          distance(a.pos, u.pos, this.config.board.columns) -
            distance(b.pos, u.pos, this.config.board.columns) ||
          a.uid - b.uid,
      )
      .slice(0, count);
  }
  skillRay(from, to) {
    const c = this.config.board.columns,
      rows = this.config.board.rows;
    let x = from % c,
      y = Math.floor(from / c);
    const tx = to % c,
      ty = Math.floor(to / c),
      dx = tx - x,
      dy = ty - y,
      n = Math.max(Math.abs(dx), Math.abs(dy));
    if (!n) return [];
    const cells = [];
    for (let k = 1; k < c * rows; k++) {
      const px = Math.round(x + (dx * k) / n),
        py = Math.round(y + (dy * k) / n);
      if (px < 0 || py < 0 || px >= c || py >= rows) break;
      const pos = py * c + px;
      if (!cells.includes(pos)) cells.push(pos);
    }
    return cells;
  }
  summon(owner, kind) {
    const cfg =
        kind === 'specter'
          ? { HP: 400, AS: 0.85, RNG: 2 }
          : kind === 'lightning'
            ? { HP: 260, AS: 0.85, RNG: 2 }
            : this.config.summons[kind],
      cap = ['plague', 'lightning', 'specter'].includes(kind) ? 2 : 1;
    if (
      this.alive(owner.team).filter(
        (u) => u.summon && u.owner === owner.uid && u.summonKind === kind,
      ).length >= cap
    ) {
      this.log('summon', `${owner.name} · 소환수 상한 도달`, { source: owner.uid });
      return null;
    }
    const occupied = new Set(this.alive().map((u) => u.pos)),
      queue = [owner.pos],
      seen = new Set(queue);
    let pos = null;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (p !== owner.pos && !occupied.has(p)) {
        pos = p;
        break;
      }
      if (
        distance(p, owner.pos, this.config.board.columns) >=
        this.config.combat.summonPlacementRadius
      )
        continue;
      for (const q of this.neighbors(p))
        if (!seen.has(q)) {
          seen.add(q);
          queue.push(q);
        }
    }
    if (pos === null) {
      this.log('summon', `${owner.name} · 소환 공간 없음`);
      return null;
    }
    const ap = this.stats(owner).AP,
      unit = this.makeUnit({ id: owner.id, pos }, owner.team);
    unit.summon = true;
    unit.owner = owner.uid;
    unit.summonKind = kind;
    unit.name =
      kind === 'specter'
        ? '수호 망령'
        : kind === 'plague'
          ? '역병충'
          : kind === 'lightning'
            ? '전격 늑대'
            : '화염 정령';
    unit.stats = {
      HP: cfg.HP * 2 ** (owner.star - 1),
      MP: 0,
      AD:
        ap *
        (kind === 'specter' ? 0.7 : kind === 'plague' ? 0.4 : kind === 'lightning' ? 0.55 : 0.6),
      AP: ap,
      CTH: 150,
      CTC: 0,
      GD: 0,
      AS: cfg.AS,
      RNG: cfg.RNG,
      DOD: 0,
    };
    unit.hp = unit.stats.HP;
    unit.mp = 0;
    unit.attackType = kind === 'plague' ? 'physical' : 'magic';
    unit.expires = this.time + (kind === 'specter' ? 10 : 8);
    unit.explosionDamage = ap;
    unit.poisonDamage = ap * this.config.summons.plague.poisonApRatio;
    this.units.push(unit);
    this.statsTotal.summons++;
    this.log('summon', `${owner.name} → ${unit.name} 소환 (8초)`, {
      source: owner.uid,
      target: unit.uid,
    });
    return unit;
  }
  cast(u, target) {
    const bondFrame = Bonds.beforeCast(this, u);
    const s = this.stats(u),
      id = u.skillId || u.id;
    u.mp = 0;
    u.castUntil = this.time + this.config.combat.castTime;
    this.skillUses[id] = (this.skillUses[id] || 0) + 1;
    this.log('skill', `${u.name} · ${D.skills[id].name}`, { source: u.uid });
    if (u.castHpCost) u.hp = Math.max(1, u.hp - u.stats.HP * u.castHpCost);
    // skill bodies live in ./skills/ (id -> function, this = battle)
    skills[id]?.call(this, u, target, s);
    Bonds.afterCast(this, u, bondFrame);
  }
  applyExperimental() {
    return;
    for (const team of ['ally', 'enemy'])
      for (const synergy of this.synergySnapshot[team].filter((s) => s.tier)) {
        const rule = this.config.experimentalSynergyEffects.rules[synergy.name];
        if (!rule || rule.scope === 'summons') continue;
        const targets =
          rule.scope === 'enemy'
            ? this.alive(team === 'ally' ? 'enemy' : 'ally')
            : rule.scope === 'team'
              ? this.alive(team)
              : this.alive(team).filter(
                  (u) => W.combatSpec(u.id)[synergy.category] === synergy.name,
                );
        for (const u of targets) {
          for (const key of ['HP', 'AD', 'AS'])
            if (rule[key]) u.stats[key] *= 1 + rule[key] * synergy.tier;
          for (const key of ['GD', 'DOD', 'CTC', 'CTH'])
            if (rule[key]) u.stats[key] += rule[key] * synergy.tier;
          for (const key of ['skillPower', 'healingPower', 'manaGain', 'statusDuration'])
            if (rule[key]) u[key] += rule[key] * synergy.tier;
          for (const key of ['regen', 'lifesteal', 'healingReduction', 'castHpCost'])
            if (rule[key]) u[key] += rule[key] * synergy.tier;
          u.hp = u.stats.HP;
          if (rule.shield) this.shield(u, rule.shield * synergy.tier, 90, u);
        }
      }
  }
  tick(dt = this.config.combat.tickSeconds) {
    if (this.result) return this.result;
    this.events = [];
    this.time += dt;
    this.emit('update'); // item -> augment -> bond effects (combat/hooks.js)
    // Timed effects happen before actions. Units act sequentially in stable uid order.
    for (const u of [...this.units]) {
      if (u.dead) continue;
      if (u.summon && this.time >= u.expires) {
        this.kill(u, null, true);
        continue;
      }
      u.shields = u.shields.filter((s) => s.amount > 0 && s.expires > this.time);
      for (const effect of [...u.statuses])
        if (effect.interval) {
          while (
            effect.nextTick <= this.time + 1e-8 &&
            effect.nextTick <= effect.expires + 1e-8 &&
            !u.dead
          ) {
            const source = this.units.find((x) => x.uid === effect.source);
            if (source)
              this.deal(source, u, effect.amount, 'magic', {
                kind: 'dot',
                itemProc: !!effect.itemProc,
              });
            effect.nextTick += effect.interval;
          }
        }
      u.statuses = u.statuses.filter((e) => e.expires > this.time + 1e-8);
      if (u.regen && u.hp > 0) u.hp = Math.min(u.stats.HP, u.hp + u.stats.HP * u.regen * dt);
    }
    for (const u of [...this.units]) {
      if (u.dead || u.hp <= 0) continue;
      u.cooldown = Math.max(0, u.cooldown - dt);
      u.moveCooldown = Math.max(0, u.moveCooldown - dt);
      if (u.castUntil > this.time || u.statuses.some((s) => s.key === 'stun')) continue;
      const target = this.target(u);
      if (!target) break;
      const s = this.stats(u),
        inRange = distance(u.pos, target.pos, this.config.board.columns) <= s.RNG;
      const globalSkill = [
        'C02',
        'C05',
        'C10',
        'C11',
        'C12',
        'C15',
        'C16',
        'C18',
        'C20',
        'C23',
        'C24',
        'C30',
        'C34',
        'C38',
        'C39',
        'C42',
      ].includes(u.skillId || u.id);
      if (
        !u.summon &&
        u.mp >= u.stats.MP - 1e-6 &&
        (inRange || globalSkill || ['C09', 'C28'].includes(u.skillId || u.id))
      ) {
        this.cast(u, target);
        continue;
      }
      if (!inRange) {
        if (u.statuses.some((e) => e.key === 'root' && e.expires > this.time)) continue;
        if (u.moveCooldown <= 0) {
          const path = this.pathToRange(u, target, s.RNG);
          if (path.length) {
            u.pos = path[0];
            this.log('move', `${u.name} 이동`, { source: u.uid });
          }
          u.moveCooldown = 0.35;
        }
        continue;
      }
      if (u.cooldown > 0) continue;
      this.gainMana(u, this.config.combat.manaOnAttack);
      const hit = this.deal(u, target, s.AD, u.attackType || 'physical', { kind: 'basic' });
      if (
        !hit.evaded &&
        !target.dead &&
        u.statuses.some((e) => e.key === 'bloodFrenzy' && e.expires > this.time)
      )
        this.deal(u, target, s.AD * 0.2, 'physical', { kind: 'bonusBasic', canCrit: false });
      if (u.summon && u.summonKind === 'plague' && !target.dead) {
        const owner = this.units.find((x) => x.uid === u.owner) || u;
        this.dot(target, owner, 'poison', '중독', u.poisonDamage, 3);
      }
      u.cooldown = 1 / Math.max(0.1, this.stats(u).AS);
    }
    const ally = this.alive('ally').length,
      enemy = this.alive('enemy').length;
    if (!ally || !enemy || this.time >= this.config.combat.maxSeconds) {
      this.result = {
        winner: !ally && !enemy ? 'draw' : !enemy ? 'ally' : !ally ? 'enemy' : 'timeout',
        time: Number(this.time.toFixed(1)),
        stats: { ...this.statsTotal },
      };
      this.log('result', `전투 종료 · ${this.result.winner}`);
    }
    return this.result;
  }
}
enableHooks(Battle);
Battle.use(F.extension);
Battle.use(AF.setupExtension);
Battle.use(AF.extension);
Battle.use(Bonds.extension);
Battle.use(MF.extension); // 메타 영구 강화(v0.19.0, 전투 옵션에 meta가 있을 때만)
const api = { Battle, distance, mitigatedDamage, effectiveDodge };

export default api;
