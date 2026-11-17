// Skills of cost-5 characters (C42-C45), moved unchanged from
// the switch in Battle#cast. Called as skill.call(battle, caster, target, stats).
import { distance } from '../geometry.js';

export default {
  C42(u, target, s) {
    for (const foe of this.enemies(u)) {
      this.deal(u, foe, s.AP * 2.3, 'magic');
      this.debuff(foe, u, 'tempestMark', 'AS −25%', 'AS', 0.75, 3);
    }
  },
  C43(u, target, s) {
    for (let i = 0; i < 6; i++) this.deal(u, target, s.AD * 0.9);
    for (const foe of this.enemies(u).filter((e) => e !== target && this.adjacent(e, target)))
      this.deal(u, foe, s.AP * 1.5, 'magic');
  },
  C44(u, target, s) {
    const rear = this.enemies(u).sort(
      (a, b) => distance(u.pos, b.pos) - distance(u.pos, a.pos) || a.uid - b.uid,
    )[0];
    if (!rear) return;
    const path = this.pathToRange(u, rear, 1);
    if (path.length) {
      u.pos = path.at(-1);
      u.castUntil += path.length * this.config.combat.chargeStepSeconds;
      this.log('move', u.name + ' 영점 돌진', { source: u.uid });
    }
    if (this.adjacent(u, rear)) {
      this.deal(u, rear, s.AD * 3.5);
      this.addStatus(rear, {
        key: 'stun',
        source: u.uid,
        label: '기절',
        expires: this.time + 2 * u.statusDuration,
        harmful: true,
      });
    } else this.log('system', u.name + ' 돌진 경로 막힘');
  },
  C45(u, target, s) {
    const cells = this.skillRay(u.pos, target.pos);
    for (const foe of this.enemies(u)
      .filter((e) => cells.includes(e.pos))
      .sort((a, b) => cells.indexOf(a.pos) - cells.indexOf(b.pos) || a.uid - b.uid)
      .slice(0, 4)) {
      this.deal(u, foe, s.AD * 3);
      this.addStatus(foe, {
        key: 'doomArrow',
        source: u.uid,
        label: '받는 피해 +15%',
        damageAmp: 0.15,
        expires: this.time + 4,
        harmful: true,
      });
    }
  },
};
