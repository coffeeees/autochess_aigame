import B from '../data/bonds.js';

const alive = (u) => u && !u.dead && u.hp > 0;
function rule(u, name) {
  return u?.bondRules?.[name] || {};
}
function init(b) {
  b.bondPulses = {};
  for (const team of ['ally', 'enemy']) {
    const entries = b.synergySnapshot[team].filter((x) => x.threshold);
    const fate = entries.some((x) => x.name === '운명' && x.threshold >= 4)
      ? Math.floor(b.rng() * 3)
      : null;
    b.bondPulses[team] = 5;
    for (const u of b.alive(team)) {
      u.bondRules = {};
      u.bondState = { attacks: 0, deaths: 0, nextSkill: 0, revived: false };
      for (const entry of entries.filter((x) => x.members.includes(u.id))) {
        const r = B.rules[entry.name][entry.tier - 1];
        u.bondRules[entry.name] = { ...r };
        for (const k of ['HP', 'AD', 'AP', 'AS']) if (r[k]) u.stats[k] *= 1 + r[k];
        for (const k of ['GD', 'CTC']) if (r[k]) u.stats[k] += r[k];
        if (r.fate) {
          if (fate === 0) {
            u.stats.AD *= 1.1;
            u.stats.AP *= 1.1;
          }
          if (fate === 1) u.stats.GD += 15;
          if (fate === 2) u.mp = Math.min(u.stats.MP, u.mp + 20);
          u.bondState.fate = fate;
        }
      }
      u.hp = u.stats.HP;
    }
    for (const u of b.alive(team)) {
      const r = rule(u, '철혈');
      if (r.startShield) b.shield(u, u.stats.HP * r.startShield, 8, u);
      if (b.allies(u).some((a) => a !== u && rule(a, '천명').adjacentGD && b.adjacent(a, u)))
        u.stats.GD += 10;
    }
  }
}
function stats(b, u, s) {
  const st = u.bondState;
  if (!st || u.summon) return s;
  const blood = rule(u, '혈광'),
    martial = rule(u, '무극'),
    cycle = rule(u, '윤회');
  s.AS *=
    1 +
    (blood.low && u.hp / u.stats.HP <= blood.low ? blood.lowAS : 0) +
    (martial.stackAS || 0) * Math.min(martial.stackCap || 0, st.attacks);
  if (cycle.deathPower) {
    s.AD *= 1 + st.deaths * cycle.deathPower;
    s.AP *= 1 + st.deaths * cycle.deathPower;
  }
  return s;
}
function healPower(u) {
  return 1 + (rule(u, '생명').healing || 0);
}
function preventLethal(b, target, source, opts, F, A) {
  const depth = b.itemProcDepth;
  if (opts.bondTransfer) b.itemProcDepth = 0;
  try {
    return (
      F.preventDeath(b, target, source, opts.bondTransfer ? {} : opts) || A.preventDeath(b, target)
    );
  } finally {
    b.itemProcDepth = depth;
  }
}
function beforeCast(b, u) {
  const st = u.bondState;
  if (!st || u.summon || b.itemProcDepth) return null;
  const previous = b.bondCastFrame,
    r = rule(u, '금단');
  b.bondCastFrame = { source: u.uid, power: st.nextSkill || 0, targets: [], previous };
  st.nextSkill = r.nextSkill || 0;
  if (r.hpCost) u.hp = Math.max(1, u.hp * (1 - r.hpCost));
  return b.bondCastFrame;
}
function afterCast(b, u, frame) {
  if (!frame) return;
  const mp = rule(u, '아르카나').castMP;
  if (mp && alive(u)) u.mp = Math.min(u.stats.MP, u.mp + mp);
  b.bondCastFrame = frame.previous;
}
function beforeDamage(b, source, target, amount, opts) {
  if (
    opts.bondTransfer ||
    opts.bondProc ||
    opts.itemProc ||
    b.itemProcDepth ||
    !alive(source) ||
    !alive(target)
  )
    return { amount, opts };
  const st = source.bondState || {},
    kind = opts.kind || 'skill',
    basic = kind === 'basic',
    skill = kind === 'skill';
  let factor = 1;
  const execute = rule(source, '종언'),
    moon = rule(source, '월하'),
    martial = rule(source, '무극'),
    forbidden = rule(source, '금단');
  if (execute.execute && target.hp / target.stats.HP <= execute.execute)
    factor *= 1 + execute.executeDamage;
  if (target.bondCrownUntil > b.time) factor *= 1.1;
  if (basic) {
    if (moon.chain) {
      st.chain = st.lastTarget === target.uid ? Math.min(moon.chainCap, (st.chain || 0) + 1) : 0;
      st.lastTarget = target.uid;
      factor *= 1 + st.chain * moon.chain;
    }
    if (martial.fullBasic && st.attacks >= martial.stackCap) factor *= 1 + martial.fullBasic;
    if (st.forceCrit) {
      opts = { ...opts, critBonus: 100 };
      st.forceCrit = false;
    }
  }
  if (skill)
    factor *=
      1 +
      (forbidden.skill || 0) +
      (b.bondCastFrame?.source === source.uid ? b.bondCastFrame.power : 0);
  return { amount: amount * factor, opts };
}
function proc(b, fn) {
  b.itemProcDepth = (b.itemProcDepth || 0) + 1;
  try {
    return fn();
  } finally {
    b.itemProcDepth--;
  }
}
function extra(b, u, t, amount, type) {
  if (alive(t))
    return proc(b, () =>
      b.deal(u, t, amount, type, {
        kind: 'bond',
        bondProc: true,
        itemProc: true,
        canCrit: false,
      }),
    );
}
// Share post-mitigation, before either shield; transfer bypasses attack and on-hit hooks.
function share(b, source, target, damage, type, opts = {}) {
  const protector = b
    .allies(target)
    .filter((u) => u !== target && rule(u, '성약').share && b.adjacent(u, target))
    .sort((a, c) => a.uid - c.uid)[0];
  if (!protector) return damage;
  const value = damage * 0.15,
    originalKind = opts.kind || 'skill',
    originalProc = !!opts.itemProc || !!b.itemProcDepth;
  proc(b, () =>
    b.deal(source, protector, value, type, {
      kind: 'bondTransfer',
      bondTransfer: true,
      bondOriginalKind: originalKind,
      bondOriginalProc: originalProc,
      itemProc: true,
      canCrit: false,
    }),
  );
  return damage - value;
}
function afterDamage(b, source, target, result, opts) {
  if (result.damage > 0 && alive(source)) {
    if (rule(source, '혈광').leech) proc(b, () => b.heal(source, result.damage * 0.1, source));
    if (
      opts.bondTransfer &&
      opts.bondOriginalKind === 'skill' &&
      !opts.bondOriginalProc &&
      rule(source, '금단').skillLeech
    )
      proc(b, () => b.heal(source, result.damage * 0.1, source));
  }
  if (
    opts.bondTransfer ||
    opts.bondProc ||
    opts.itemProc ||
    b.itemProcDepth ||
    !source.bondState ||
    result.evaded
  )
    return;
  const kind = opts.kind || 'skill',
    basic = kind === 'basic',
    skill = kind === 'skill';
  const st = source.bondState,
    shadow = rule(source, '흑월'),
    res = rule(source, '공명'),
    abyss = rule(source, '심연'),
    forbid = rule(source, '금단');
  if (basic) st.attacks = Math.min(rule(source, '무극').stackCap || 0, st.attacks + 1);
  if (result.critical && shadow.critExtra) {
    extra(b, source, target, b.stats(source).AD * shadow.critExtra, 'physical');
    if (shadow.critKill && target.dead) st.forceCrit = true;
  }
  if (result.damage > 0 && alive(source)) {
    if (skill && forbid.skillLeech)
      proc(b, () => b.heal(source, result.damage * forbid.skillLeech, source));
  }
  if (skill) {
    if (abyss.antiheal && alive(target))
      b.addStatus(target, {
        key: 'bondAbyss',
        source: source.uid,
        label: '심연 · 받는 회복 −30%',
        healingReduction: 0.3,
        harmful: true,
        expires: b.time + 4,
      });
    if (res.resonance) {
      const frame = b.bondCastFrame;
      if (frame?.source === source.uid && !frame.targets.includes(target.uid)) {
        frame.targets.push(target.uid);
        const amount = b.stats(source).AP * res.resonance;
        extra(b, source, target, amount, 'magic');
        if (res.splash) {
          const other = b
            .enemies(source)
            .filter((u) => u !== target && b.adjacent(u, target))
            .sort((a, c) => a.uid - c.uid)[0];
          extra(b, source, other, amount * res.splash, 'magic');
        }
      }
    }
  }
}
function status(b, target, status) {
  const source = b.units.find((u) => u.uid === status.source);
  if (status.harmful && ['stun', 'root'].includes(status.key) && rule(source, '왕권').ccAmp)
    target.bondCrownUntil = Math.max(target.bondCrownUntil || 0, b.time + 3);
}
function beforeKill(b, target, source, expired) {
  if (expired) return false;
  for (const u of b.allies(target).filter((u) => u !== target)) {
    const r = rule(u, '윤회');
    if (r.deathPower) u.bondState.deaths = Math.min(r.deathCap, u.bondState.deaths + 1);
  }
  const r = rule(target, '윤회');
  if (r.revive && !target.bondState.revived) {
    target.bondState.revived = true;
    target.hp = target.stats.HP * r.revive;
    b.log('revive', target.name + ' · 윤회 HP 30% 부활', {
      source: target.uid,
      target: target.uid,
    });
    return true;
  }
  if (source && source.team !== target.team && rule(source, '종언').killMP && alive(source))
    source.mp = Math.min(source.stats.MP, source.mp + 20);
  return false;
}
function update(b) {
  for (const team of ['ally', 'enemy'])
    while (b.time + 1e-8 >= b.bondPulses[team]) {
      b.bondPulses[team] += 5;
      const source = b
        .alive(team)
        .filter((u) => rule(u, '생명').pulse)
        .sort((a, c) => a.uid - c.uid)[0];
      if (!source) continue;
      const target = b
          .alive(team)
          .sort((a, c) => a.hp / a.stats.HP - c.hp / c.stats.HP || a.uid - c.uid)[0],
        r = rule(source, '생명');
      b.heal(target, target.stats.HP * r.pulse, source);
      if (r.pulseShield) b.shield(target, target.stats.HP * r.pulseShield, 5, source);
    }
}
/** Battle hooks for bond effects: start/update events (see combat/hooks.js). */
const extension = {
  name: 'bond-effects',
  on: {
    // through `api` so a replaced api.init/api.update (tests) is used
    start: { order: 10, run: (b) => api.init(b) },
    update: { order: 30, run: (b) => api.update(b) },
  },
};
const api = {
  extension,
  init,
  stats,
  healPower,
  preventLethal,
  beforeCast,
  afterCast,
  beforeDamage,
  afterDamage,
  share,
  status,
  beforeKill,
  update,
  rule,
};

export default api;
