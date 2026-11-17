// Skill registry (stage 3): Battle#cast looks skills up by id instead of a 45-case switch.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import D from '../../src/core/data/units.js';
import Engine from '../../src/core/combat/battle.js';
import skills from '../../src/core/combat/skills/index.js';
import cost1 from '../../src/core/combat/skills/cost1.js';
import cost2 from '../../src/core/combat/skills/cost2.js';
import cost3 from '../../src/core/combat/skills/cost3.js';
import cost4 from '../../src/core/combat/skills/cost4.js';
import cost5 from '../../src/core/combat/skills/cost5.js';

test('registry has one function per character skill and nothing else', () => {
  a.deepEqual(Object.keys(skills).sort(), Object.keys(D.skills).sort());
  a.deepEqual(Object.keys(skills).sort(), [...D.playableIds].sort());
  a(Object.values(skills).every((fn) => typeof fn === 'function' && fn.length === 3));
  a(Object.isFrozen(skills));
});

test('each skill file holds exactly the characters of its cost', () => {
  const files = { 1: cost1, 2: cost2, 3: cost3, 4: cost4, 5: cost5 };
  for (const [cost, group] of Object.entries(files))
    a.deepEqual(
      Object.keys(group).sort(),
      D.roster
        .filter((u) => u.cost === Number(cost))
        .map((u) => u.id)
        .sort(),
      'cost ' + cost,
    );
});

test('cast runs the registered skill with the battle as this', () => {
  const b = new Engine.Battle([{ id: 'C01', pos: 38 }], [{ id: 'E01', pos: 31 }], {
    rng: () => 0.5,
  });
  const caster = b.units.find((u) => u.team === 'ally'),
    target = b.units.find((u) => u.team === 'enemy');
  const before = target.hp;
  b.cast(caster, target);
  a.equal(b.skillUses.C01, 1);
  a(target.hp < before);
  a(target.statuses.some((e) => e.key === 'burn'));
});

test('the battle loop no longer contains per-character skill code', () => {
  const src = fs.readFileSync('src/core/combat/battle.js', 'utf8');
  a(!/case 'C\d\d'/.test(src));
  a(/skills\[id\]\?\.call\(this, u, target, s\)/.test(src));
});
