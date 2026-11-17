// Skills of cost-2 characters (C13-C23), moved unchanged from
// the switch in Battle#cast. Called as skill.call(battle, caster, target, stats).
import { distance } from '../geometry.ts';

export default {
  C13(u, target, s) {
    const foes = this.enemies(u).filter((e) => distance(e.pos, target.pos) <= 1);
    for (const foe of foes) {
      this.deal(u, foe, s.AP * 1.9, 'magic');
      this.debuff(foe, u, 'frostBurst', 'AS −20%', 'AS', 0.8, 3);
    }
  },
  C14(u, target, s) {
    for (let i = 0; i < 3; i++) this.deal(u, target, s.AD * 0.85);
    this.dot(target, u, 'redFlame', '화상', s.AP * 0.15, 3);
  },
  C15(u, target, s) {
    const ally = this.allies(u).sort(
      (a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP || a.uid - b.uid,
    )[0];
    this.heal(ally, s.AP * 2, u);
    this.addStatus(ally, {
      key: 'darkMend',
      label: 'GD +15%',
      source: u.uid,
      stat: 'GD',
      mult: 1.15,
      expires: this.time + 4,
      harmful: false,
    });
  },
  C16(u, target, s) {
    this.summon(u, 'lightning');
  },
  C17(u, target, s) {
    u.hp = Math.max(1, u.hp * 0.92);
    const hit = this.deal(u, target, s.AD * 2.3);
    this.heal(u, hit.damage * 0.2, u);
  },
  C18(u, target, s) {
    const ally = this.allies(u).sort(
      (a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP || a.uid - b.uid,
    )[0];
    this.heal(ally, s.AP * 1.8, u);
    this.shield(ally, s.AP * 1.2, 4, u);
  },
  C19(u, target, s) {
    this.deal(u, target, s.AP * 1.5, 'magic');
    this.addStatus(target, {
      key: 'root',
      label: '속박 · 이동 불가',
      source: u.uid,
      expires: this.time + 1.5 * u.statusDuration,
      harmful: true,
    });
  },
  C20(u, target, s) {
    u.hp = Math.max(1, u.hp * 0.94);
    this.addStatus(u, {
      key: 'bloodFrenzy',
      label: 'AS +30% · 기본 공격 추가타',
      source: u.uid,
      stat: 'AS',
      mult: 1.3,
      expires: this.time + 5,
      harmful: false,
    });
  },
  C21(u, target, s) {
    this.deal(u, target, s.AP * 2.3, 'magic');
    const ally =
      this.allies(u)
        .filter((a) => a !== u)
        .sort((a, b) => distance(a.pos, u.pos) - distance(b.pos, u.pos) || a.uid - b.uid)[0] || u;
    this.shield(ally, s.AP, 4, u);
  },
  C22(u, target, s) {
    this.deal(u, target, s.AD * 1.7);
    this.addStatus(u, {
      key: 'tectonicGuard',
      label: 'GD +20%',
      source: u.uid,
      stat: 'GD',
      mult: 1.2,
      expires: this.time + 4,
      harmful: false,
    });
  },
  C23(u, target, s) {
    for (const ally of this.allies(u).filter((a) => a === u || this.adjacent(u, a))) {
      this.shield(ally, s.AP * 1.4, 4, u, 'firewall');
      ally.shields.at(-1).counterDamage = s.AP * 0.5;
    }
  },
};
