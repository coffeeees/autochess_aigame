// Skills of cost-3 characters (C24-C33), moved unchanged from
// the switch in Battle#cast. Called as skill.call(battle, caster, target, stats).
import { distance } from '../geometry.ts';

export default {
  C24(u, target, s) {
    const allies = this.allies(u)
      .sort((a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP || a.uid - b.uid)
      .slice(0, 2);
    for (const ally of allies) {
      this.heal(ally, s.AP * 2.1, u);
      const attacker = this.enemies(u).find((e) => e.uid === ally.lastBasicAttacker);
      if (attacker) this.debuff(attacker, u, 'winterPrayer', 'AS −20%', 'AS', 0.8, 2);
    }
  },
  C25(u, target, s) {
    let next = target;
    const hit = new Set();
    for (const ratio of [2.2, 1.5, 1]) {
      if (!next) break;
      hit.add(next.uid);
      this.deal(u, next, s.AP * ratio, 'magic');
      const origin = next.pos;
      next = this.enemies(u)
        .filter((e) => !hit.has(e.uid))
        .sort((a, b) => distance(origin, a.pos) - distance(origin, b.pos) || a.uid - b.uid)[0];
    }
  },
  C26(u, target, s) {
    const execute = target.hp / target.stats.HP <= 0.4;
    this.deal(u, target, s.AD * 2.2);
    if (execute) this.deal(u, target, s.AD * 0.7);
  },
  C27(u, target, s) {
    this.deal(u, target, s.AD * 1.7);
    this.dot(target, u, 'poisonRain', '독', s.AP * 0.2, 5);
  },
  C28(u, target, s) {
    const rear = this.enemies(u).sort(
      (a, b) => distance(u.pos, b.pos) - distance(u.pos, a.pos) || a.uid - b.uid,
    )[0];
    if (!rear) return;
    const path = this.pathToRange(u, rear, 1);
    if (path.length) {
      u.pos = path.at(-1);
      u.castUntil += path.length * this.config.combat.chargeStepSeconds;
      this.log('move', u.name + ' 그림자 급습', { source: u.uid });
    }
    if (this.adjacent(u, rear)) {
      this.deal(u, rear, s.AD * 2.5);
      this.debuff(rear, u, 'shadowRush', 'AD −15%', 'AD', 0.85, 3);
    } else this.log('system', u.name + ' 돌진 경로 막힘');
  },
  C29(u, target, s) {
    this.deal(u, target, s.AD * 2);
    this.debuff(target, u, 'shatterShot', 'GD −20%', 'GD', 0.8, 4);
  },
  C30(u, target, s) {
    this.shield(u, s.AP * 2.5, 5, u);
    for (const ally of this.allies(u)
      .filter((a) => a !== u && this.adjacent(u, a))
      .sort((a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP || a.uid - b.uid)
      .slice(0, 2))
      this.heal(ally, s.AP, u);
  },
  C31(u, target, s) {
    this.deal(u, target, s.AD * 2.3);
    this.dot(target, u, 'scorchLeap', '화상', s.AP * 0.2, 3);
  },
  C32(u, target, s) {
    for (const foe of this.enemies(u).filter((e) => distance(e.pos, target.pos) <= 1)) {
      this.deal(u, foe, s.AP * 2, 'magic');
      this.addStatus(foe, {
        key: 'stun',
        label: '띄우기',
        source: u.uid,
        expires: this.time + u.statusDuration,
        harmful: true,
      });
    }
  },
  C33(u, target, s) {
    const other = this.enemies(u)
      .filter((e) => e !== target)
      .sort(
        (a, b) => distance(target.pos, a.pos) - distance(target.pos, b.pos) || a.uid - b.uid,
      )[0];
    for (const foe of [target, other].filter(Boolean)) {
      this.deal(u, foe, s.AP * 1.6, 'magic');
      this.addStatus(foe, {
        key: 'flameCurse',
        label: '받는 회복 −30%',
        healingReduction: 0.3,
        source: u.uid,
        expires: this.time + 4 * u.statusDuration,
        harmful: true,
      });
    }
  },
};
