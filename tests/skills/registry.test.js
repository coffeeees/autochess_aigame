// 스킬 등록표(3단계): Battle#cast는 45개 switch 대신 ID로 스킬을 찾는다.
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

test('등록표에는 캐릭터 스킬마다 함수 하나만 있다', () => {
  a.deepEqual(Object.keys(skills).sort(), Object.keys(D.skills).sort());
  a.deepEqual(Object.keys(skills).sort(), [...D.playableIds].sort());
  a(Object.values(skills).every((fn) => typeof fn === 'function' && fn.length === 3));
  a(Object.isFrozen(skills));
});

test('스킬 파일마다 해당 코스트 캐릭터만 들어 있다', () => {
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

test('cast는 등록된 스킬을 this = 전투로 실행한다', () => {
  const b = new Engine.Battle([{ id: 'C01', pos: 26 }], [{ id: 'E01', pos: 27 }], {
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

test('전투 루프에는 더 이상 캐릭터별 스킬 코드가 없다', () => {
  const src = fs.readFileSync('src/core/combat/battle.js', 'utf8');
  a(!/case 'C\d\d'/.test(src));
  a(/skills\[id\]\?\.call\(this, u, target, s\)/.test(src));
});
