'use strict';
// 0단계 전투 기준선.
// 정해진 시드 전투들을 로직 모듈로 실행해 승자, 시간, 피해 합계, 남은 HP,
// 이벤트·로그 수, 해시를 기록한다.
// Usage:
//   node tools/combat-baseline.mjs            -> JSON을 표준 출력으로
//   node tools/combat-baseline.mjs --write    -> docs/archive/combat-baseline.json에 기록
//   node tools/combat-baseline.mjs --check    -> 저장된 파일과 비교, 다르면 종료 코드 1
// 게임 로직은 src/core(ES 모듈)에서 불러온다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/archive/combat-baseline.json');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 모듈 안의 Math.random 호출도 고정해서, 기준선이 숨은 무작위에 의존하지 않게 한다.
let globalRng = mulberry32(1);
Math.random = () => globalRng();

// 위에서 Math.random을 바꾼 뒤에 불러온다
const load = async (p) => (await import(new URL('../src/core/' + p, import.meta.url))).default;
const D = await load('data/units.js');
const I = await load('items.js');
const W = await load('encounters.js');
const B = await load('board.js');
// 시나리오의 고정 칸은 예전 상하 대치 좌표(7열×8행)로 적혀 있다. v0.18.0 좌우 대치 전장에서는 여기서 한 번 회전한다
const R = B.rotateOldPos;
const { Battle } = await load('combat/battle.js');
// v0.20.0 캐릭터 개명: 기준선(v0.15.18) 로그 문구에는 예전 표시 이름이 들어 있다. 전투 내용은 이름과 무관하므로
// 여기서만 예전 이름으로 되돌려 실행한다(게임 데이터는 바꾸지 않음, 이 도구 안의 사본만)
const OLD_NAMES =
  '녹스 아즈칼 태건 리엔 루아 카인 유하 벨모르 라칸 울프릭 둔가르 엘리엘 브룬 적호 베스퍼 토비 이그니스 아우라 설아 진무 오르페 골룸바 로제트 유키나 지그 흐로드 비올라 시그룬 카르도 네레이드 홍련 제피로 아그니 아스텔 메두라 참월 카르미나 오르딘 글라시아 월하 뇌진 바하무트 라이진 백야 아바돈'.split(
    ' ',
  );
D.roster.forEach((u, i) => (u.name = OLD_NAMES[i]));

const hash = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const round = (n) => Math.round(n * 1000) / 1000;

const CELL_KEYS = new Set(['pos', 'sourcePos', 'targetPos', 'from', 'to']);
function oldCells(value) {
  if (Array.isArray(value)) return value.map(oldCells);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      CELL_KEYS.has(k) && Number.isInteger(v) ? B.unrotatePos(v) : oldCells(v),
    ]),
  );
}

function run(name, seed, allies, enemies, options = {}) {
  globalRng = mulberry32(seed ^ 0x9e3779b9);
  const battle = new Battle(allies, enemies, { ...options, rng: mulberry32(seed) });
  let ticks = 0;
  while (!battle.result && ticks < 5000) {
    battle.tick();
    ticks++;
  }
  const units = battle.units.map((u) => ({
    id: u.id,
    team: u.team,
    star: u.star,
    hp: round(Math.max(0, u.hp)),
    alive: u.hp > 0,
  }));
  return {
    name,
    seed,
    ticks,
    winner: battle.result && battle.result.winner,
    time: battle.result && battle.result.time,
    stats:
      battle.result &&
      Object.fromEntries(Object.entries(battle.result.stats).map(([k, v]) => [k, round(v)])),
    allyHpLeft: round(units.filter((u) => u.team === 'ally').reduce((a, u) => a + u.hp, 0)),
    enemyHpLeft: round(units.filter((u) => u.team === 'enemy').reduce((a, u) => a + u.hp, 0)),
    skillUses: battle.skillUses,
    eventCount: battle.events.length,
    logCount: battle.logs.length,
    unitsHash: hash(units),
    eventsHash: hash(battle.events),
    // 기준선(v0.15.18)의 로그는 예전 칸 번호라, 칸 필드만 예전 좌표로 되돌려 해시한다(전투 내용은 같음)
    logsHash: hash(battle.logs.map(oldCells)),
  };
}

function scenarios() {
  const out = [];
  const ids = D.playableIds;
  const allyCells = [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41].map(R);

  // 1) 플레이 가능한 캐릭터 전원을 5명씩 2성으로, 고정된 적 편성과 대결.
  for (let g = 0; g < ids.length; g += 5) {
    const group = ids.slice(g, g + 5);
    out.push(
      run(
        `roster-${group.join('-')}`,
        1000 + g,
        group.map((id, i) => ({ id, pos: allyCells[i], star: 2 })),
        ['E03', 'E06', 'E08', 'E01', 'E04'].map((id, i) => ({
          id,
          pos: R([17, 18, 16, 3, 4][i]),
          star: 2,
        })),
      ),
    );
  }

  // 2) 플레이어 캐릭터끼리 대결(모든 스킬을 플레이어 상대로 사용).
  for (let g = 0; g < ids.length; g += 9) {
    const a = ids.slice(g, g + 4);
    const b = ids.slice(g + 4, g + 8);
    if (b.length === 0) continue;
    out.push(
      run(
        `mirror-${g}`,
        2000 + g,
        a.map((id, i) => ({ id, pos: allyCells[i] })),
        b.map((id, i) => ({ id, pos: R([17, 18, 16, 19][i]) })),
        { quickMana: true },
      ),
    );
  }

  // 3) 아이템: 모든 아이템을 한 번 이상 장착. v0.20.0에 예전 1~3티어 장비(I01~I40)를 지우고 기본·완성 장비(IB·IC)로
  //    바꿨으므로, 기준선의 예전 장비 전투(items-I0…)는 --check에서 비교하지 않고 새 장비 전투(items-IB…)는 기록만 한다.
  const itemIds = I.items.map((it) => it.id);
  for (let k = 0; k < itemIds.length; k += 6) {
    const gear = itemIds.slice(k, k + 6);
    const wearers = [ids[k % ids.length], ids[(k + 7) % ids.length]];
    const allies = wearers
      .map((id, i) => {
        const itemIdsFor = gear.slice(i * 3, i * 3 + 3).filter(Boolean);
        return { id, pos: allyCells[i + 2], itemIds: itemIdsFor, bonuses: I.bonuses(itemIdsFor) };
      })
      .filter((u) => u.itemIds.length);
    out.push(
      run(`items-${gear.join('-')}`, 3000 + k, allies, [
        { id: 'E06', pos: R(17), star: 2 },
        { id: 'E01', pos: R(3) },
        { id: 'E03', pos: R(18) },
      ]),
    );
  }

  // 4) 증강: v0.15.18 기준선에는 그때의 증강 36종 전투가 있었지만, v0.17.0에서 그 증강을 지웠다.
  //    그래서 이 단계는 더 만들지 않고 --check에서도 비교하지 않는다(새 증강은 tests/augments/가 확인).

  // 5) 적 편성 생성기로 만든 실제 편성, 여러 스테이지·난이도.
  const stages = [
    [1, 3],
    [2, 2],
    [2, 5],
    [3, 4],
    [4, 5],
    [5, 5],
    [6, 5],
    [7, 2],
  ];
  stages.forEach(([stage, roundNo], k) => {
    for (const difficulty of [1, 5, 10]) {
      const state = { stage, round: roundNo, difficulty };
      let enemies;
      try {
        enemies = W.encounter(state, mulberry32(5000 + k * 10 + difficulty));
      } catch (e) {
        enemies = null;
      }
      if (!enemies || !enemies.length) continue;
      const squad = ids.slice(k * 4, k * 4 + Math.min(10, 3 + stage)).map((id, i) => ({
        id,
        pos: allyCells[i],
        star: stage >= 4 ? 2 : 1,
      }));
      out.push(
        run(
          `encounter-${stage}-${roundNo}-d${difficulty}`,
          5000 + k * 10 + difficulty,
          squad,
          enemies.map((u) => ({ ...u })),
          { enemyDamageMultiplier: W.difficulty(difficulty).enemyDamageMultiplier },
        ),
      );
    }
  });

  return out;
}

const result = {
  version: '0.15.18',
  generatedBy: 'tools/combat-baseline.mjs',
  battles: scenarios(),
};
const json = JSON.stringify(result, null, 2) + '\n';

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  console.log(`wrote ${result.battles.length} battles to ${path.relative(ROOT, OUT)}`);
} else if (process.argv.includes('--check')) {
  const stored = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  // 지운 증강의 기준선 전투(augment-*)와 지운 예전 장비 전투(items-I0…, v0.20.0)는 비교하지 않는다
  const removed = (name) => name.startsWith('augment-') || /^items-I\d/.test(name);
  const kept = stored.battles.filter((b) => !removed(b.name));
  // 새 장비 전투(items-IB…)는 기준선에 없으므로 비교 대상에서 뺀다
  const current = result.battles.filter((b) => !/^items-I[BC]/.test(b.name));
  const now = new Map(current.map((b) => [b.name, b]));
  let diffs = 0;
  for (const b of kept)
    if (JSON.stringify(b) !== JSON.stringify(now.get(b.name))) {
      diffs++;
      console.error(`DIFF ${b.name}`);
    }
  if (kept.length !== current.length) diffs++;
  const skippedAug = stored.battles.filter((b) => b.name.startsWith('augment-')).length;
  const skippedItems = stored.battles.filter((b) => /^items-I\d/.test(b.name)).length;
  console.log(
    diffs
      ? `${diffs} battle(s) differ`
      : `all ${kept.length} battles match (지운 증강 전투 ${skippedAug}건·지운 예전 장비 전투 ${skippedItems}건은 비교하지 않음)`,
  );
  process.exit(diffs ? 1 : 0);
} else {
  process.stdout.write(json);
}
