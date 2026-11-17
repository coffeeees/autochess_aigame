// Skills of cost-4 characters (C34-C41), moved unchanged from
// the switch in Battle#cast. Called as skill.call(battle, caster, target, stats).
import { distance } from '../geometry.ts';

export default {
  C34(u, target, s) {
    const list = this.allies(u);
    for (const a of list) this.heal(a, s.AP * 1.4, u);
    const low = this.allies(u).sort(
      (a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP || a.uid - b.uid,
    )[0];
    if (low) this.heal(low, s.AP * 1.6, u);
  },
  C35(u, target, s) {
    for (const foe of this.skillTargets(u, target, 4)) {
      this.deal(u, foe, s.AP * 2.1, 'magic');
      if (!foe.dead) this.dot(foe, u, 'venomStorm', '맹독 폭풍', s.AP * 0.25, 4);
    }
  },
  C36(u, target, s) {
    this.deal(u, target, s.AD * 3);
    this.debuff(target, u, 'earthCut', 'GD −25%', 'GD', 0.75, 4);
  },
  C37(u, target, s) {
    u.hp = Math.max(1, u.hp * 0.92);
    for (const foe of this.skillTargets(u, target, 3)) this.deal(u, foe, s.AD * 2.1);
  },
  C38(u, target, s) {
    this.summon(u, 'specter');
    this.summon(u, 'specter');
  },
  C39(u, target, s) {
    for (const ally of this.allies(u).filter((a) => a === u || this.adjacent(u, a)))
      this.shield(ally, s.AP * 2.2, 5, u, 'absoluteWall');
  },
  C40(u, target, s) {
    for (let i = 0; i < 4; i++)
      this.deal(u, target, s.AD, 'physical', {
        kind: 'skill',
        canCrit: i === 3 ? true : undefined,
        critBonus: i === 3 ? 30 : 0,
      });
  },
  C41(u, target, s) {
    const c = this.config.board.columns,
      dx = (target.pos % c) - (u.pos % c),
      dy = Math.floor(target.pos / c) - Math.floor(u.pos / c);
    for (const foe of this.enemies(u)
      .filter(
        (e) =>
          (e === target || this.adjacent(e, target)) &&
          ((e.pos % c) - (u.pos % c)) * dx + (Math.floor(e.pos / c) - Math.floor(u.pos / c)) * dy >
            0,
      )
      .sort(
        (a, b) =>
          Number(b === target) - Number(a === target) ||
          distance(a.pos, u.pos, c) - distance(b.pos, u.pos, c) ||
          a.uid - b.uid,
      )
      .slice(0, 3)) {
      this.deal(u, foe, s.AD * 2.4);
      this.addStatus(foe, {
        key: 'stun',
        source: u.uid,
        label: '기절',
        expires: this.time + 1 * u.statusDuration,
        harmful: true,
      });
    }
  },
};
