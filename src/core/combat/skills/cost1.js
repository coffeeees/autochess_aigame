// Skills of cost-1 characters (C01-C12), moved unchanged from
// the switch in Battle#cast. Called as skill.call(battle, caster, target, stats).
import { distance } from '../geometry.js';

export default {
  C01(u, target, s) {
    this.deal(u, target, s.AD * 1.6);
    this.dot(target, u, 'burn', '화상', s.AD * 0.15, 4);
  },
  C02(u, target, s) {
    this.summon(u, 'plague');
  },
  C03(u, target, s) {
    this.deal(u, target, s.AD * 1.8);
    this.debuff(target, u, 'shadow', 'AD −15%', 'AD', 0.85, 4);
  },
  C04(u, target, s) {
    const result = this.deal(u, target, s.AD * 2, 'physical', {
      canCrit: true,
      critBonus: 20,
    });
    if (result.critical) this.deal(u, target, s.AD * 0.5, 'magic');
  },
  C05(u, target, s) {
    const ally = this.allies(u).sort(
      (a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP || a.uid - b.uid,
    )[0];
    if (ally) {
      this.heal(ally, s.AP * 1.8, u);
      const i = ally.statuses.findIndex((e) => e.harmful);
      if (i >= 0) {
        const [cleansed] = ally.statuses.splice(i, 1);
        this.log('cleanse', `${ally.name} · ${cleansed.label} 정화`, { target: ally.uid });
      }
    }
  },
  C06(u, target, s) {
    this.deal(u, target, s.AD * 1.4);
    this.deal(u, target, s.AD * 1.4);
    this.addStatus(u, {
      key: 'wind',
      label: 'AS +20%',
      source: u.uid,
      stat: 'AS',
      mult: 1.2,
      expires: this.time + 4,
      harmful: false,
    });
  },
  C07(u, target, s) {
    const origin = { uid: target.uid, pos: target.pos, landed: false },
      start = u.pos;
    for (let i = 0; i < 3; i++) {
      const valid = !target.dead && target.hp > 0,
        result = this.deal(u, target, s.AD * 0.75, 'physical', {
          kind: 'skill',
          skillVisual: 'c07-primary',
        });
      if (valid && !result.evaded) origin.landed = true;
    }
    const chains = [];
    for (const foe of this.enemies(u)
      .filter((e) => e !== target)
      .sort(
        (a, b) =>
          distance(a.pos, origin.pos, this.config.board.columns) -
            distance(b.pos, origin.pos, this.config.board.columns) || a.uid - b.uid,
      )
      .slice(0, 2)) {
      if (foe.dead) continue;
      const point = { uid: foe.uid, pos: foe.pos },
        hit = this.deal(u, foe, s.AD * 0.7, 'magic', {
          kind: 'skill',
          skillVisual: 'c07-chain',
        });
      if (!hit.evaded) chains.push(point);
    }
    this.log('chainLightning', '유하 · 연속 사격 연쇄', {
      source: u.uid,
      sourceId: u.id,
      sourcePos: start,
      primary: origin,
      chains,
    });
  },
  C08(u, target, s) {
    this.deal(u, target, s.AP * 2.2, 'magic');
    this.debuff(target, u, 'waterSlow', 'AS −15%', 'AS', 0.85, 3);
  },
  C09(u, target, s) {
    const path = this.pathToRange(u, target, 1);
    if (path.length) {
      u.pos = path.at(-1);
      u.castUntil += path.length * this.config.combat.chargeStepSeconds;
      this.log('move', `${u.name} 돌진`, { source: u.uid });
    }
    if (this.adjacent(u, target)) {
      this.deal(u, target, s.AD * 1.7);
      this.addStatus(target, {
        key: 'stun',
        label: '기절',
        source: u.uid,
        expires: this.time + 1,
        harmful: true,
      });
    } else this.log('system', `${u.name} 돌진 경로 막힘`);
  },
  C10(u, target, s) {
    this.addStatus(u, {
      key: 'earthGuard',
      label: 'GD +30%',
      source: u.uid,
      stat: 'GD',
      mult: 1.3,
      expires: this.time + 5,
      harmful: false,
    });
    const ally = this.allies(u)
      .filter((a) => a !== u && this.adjacent(u, a))
      .sort((a, b) => a.hp / a.stats.HP - b.hp / b.stats.HP)[0];
    if (ally) this.shield(ally, this.stats(u).GD * 2, 5, u);
  },
  C11(u, target, s) {
    this.summon(u, 'fire');
  },
  C12(u, target, s) {
    this.shield(u, s.GD * 2.5, 5, u, 'corrosion');
  },
};
