// 메타 영구 강화의 전투 효과(v0.19.0, 수치는 data/meta-upgrades.js 임시값).
// 전투 옵션 allyModifiers.meta = { levels, stage }가 있을 때만 동작한다(없으면 전투가 예전과 완전히 같다).
// 아군에만 적용하고 적에게는 적용하지 않는다.
//
// 계산 순서(한 전투에 한 번, 전투 시작 order 7: 증강 준비(희생·조합 올림) 뒤, 유대·아이템·증강 시작 효과 앞):
//   유닛 능력치 = 기본 × 성급 + 장비(S3 장비 숙련 포함, 원정 쪽에서 반영) → 증강 기본 능력치(makeUnit)
//   → 메타: % 증가는 같은 능력치끼리 더한 뒤 한 번 곱한다
//        HP  × (1 + D1 + D6(전열) + G6 × 활성 조합 수 + S6(보스 전투))
//        AD  × (1 + A1 + G8(4라운드부터)),  AP × (1 + A2 + G8),  AS × (1 + A3)
//      고정값·%p는 더한다: GD + D2 + S7 + G7(전열·후열 모두 있으면), CTC + A4, CTH + A5, DOD + D3
//      MP 획득량 × (1 + A6)(최대 MP는 그대로), 그다음 D8 보호막(최대 HP × D8, 전투 끝까지)
//   → 유대·아이템·증강의 전투 시작 효과(증강의 HP·AS 배율 등은 그 위에 곱해진다)
// 피해·회복(around 층 15: 아이템 10과 증강 20 사이):
//   주는 피해 × (1 + A7 + A8(대상이 보스)): 피해 한 번(deal 호출)마다 한 번. 물리·마법 피해가 따로 들어오면 각각 한 번.
//   받는 피해 × (1 − D5 − D7(후열)): GD 방어와 별도, 회복에는 영향 없음. 유대 피해 분담(bondTransfer)은 다시 줄이지 않는다.
//   받는 회복 × (1 + D4): 아군 캐릭터 회복만(플레이어 HP는 원정 쪽이라 무관).
// 전열·후열(요청서 임시 판정, 좌우 대치): 아군 col 2~3 = 전열, col 0~1 = 후열. 전투 시작 배치로 고정(이동해도 그대로).
// 소환수(아군): 전체 아군 대상 능력치(A1~A5·D1~D3·S6·S7·G6~G8)를 소환 때 한 번 준다(전열·후열 효과 D6·D7은 없음).
// 증강 분신은 원본 능력치를 복사하므로 다시 주지 않는다(중복 방지).
import B from '../board.js';
import U from '../meta-upgrades.ts';

const alive = (u) => u && !u.dead && u.hp > 0;
/** 이 전투의 메타 정보(없으면 null) */
const metaOf = (b) => b.allyModifiers?.meta || null;
const val = (m, id) => U.valueAt(id, m.levels[id] || 0);

/** 요청서 임시 판정: 아군 col 2~3 전열, col 0~1 후열(함수로 분리해 나중에 진형 규칙으로 바꿀 수 있게) */
export function lineOf(pos) {
  return B.depth(pos, 'ally') >= 2 ? 'front' : 'back';
}

/** 모든 아군 대상 능력치(전열 HP·후열 피해 감소 제외). 소환수에도 이것만 준다 */
function sharedBonus(b, m) {
  const late = (m.stage || 0) >= 4 ? val(m, 'G8') : 0;
  const bonds = b.synergySnapshot.ally.filter((s) => s.tier > 0).length;
  const boss = b.units.some((u) => u.team === 'enemy' && u.boss);
  const crew = b.units.filter((u) => u.team === 'ally' && !u.summon);
  const both =
    crew.some((u) => lineOf(u.pos) === 'front') && crew.some((u) => lineOf(u.pos) === 'back');
  return {
    hp: val(m, 'D1') + val(m, 'G6') * bonds + (boss ? val(m, 'S6') : 0),
    ad: val(m, 'A1') + late,
    ap: val(m, 'A2') + late,
    as: val(m, 'A3'),
    gd: val(m, 'D2') + val(m, 'S7') + (both ? val(m, 'G7') : 0),
    ctc: val(m, 'A4'),
    cth: val(m, 'A5'),
    dod: val(m, 'D3'),
    bonds,
    boss,
    both,
  };
}

function applyStats(u, bonus, extraHp = 0) {
  const s = u.stats;
  const before = {
    HP: s.HP,
    AD: s.AD,
    AP: s.AP,
    AS: s.AS,
    GD: s.GD,
    CTC: s.CTC,
    CTH: s.CTH,
    DOD: s.DOD,
  };
  s.HP *= 1 + bonus.hp + extraHp;
  s.AD *= 1 + bonus.ad;
  s.AP *= 1 + bonus.ap;
  s.AS *= 1 + bonus.as;
  s.GD += bonus.gd;
  s.CTC += bonus.ctc;
  s.CTH += bonus.cth;
  s.DOD += bonus.dod;
  u.hp = s.HP;
  return before;
}

function start(b) {
  const m = metaOf(b);
  if (!m || b.metaApplied) return; // 한 전투에 한 번
  b.metaApplied = true;
  const bonus = sharedBonus(b, m);
  b.metaBonus = bonus;
  const manaGain = val(m, 'A6'),
    frontHp = val(m, 'D6'),
    shield = val(m, 'D8');
  for (const u of b.units.filter((x) => x.team === 'ally' && !x.summon)) {
    u.metaLine = lineOf(u.pos);
    const before = applyStats(u, bonus, u.metaLine === 'front' ? frontHp : 0);
    u.manaGain *= 1 + manaGain;
    if (shield > 0) {
      const amount = u.stats.HP * shield;
      u.shields.push({ amount, expires: 1e9, source: u.uid, kind: 'normal' });
      b.statsTotal.shielding += amount;
    }
    if (m.debug)
      b.log('meta', `메타 강화 · ${u.name}`, {
        source: u.uid,
        before,
        after: { HP: u.stats.HP, AD: u.stats.AD, AP: u.stats.AP, AS: u.stats.AS, GD: u.stats.GD },
        line: u.metaLine,
      });
  }
}

const extension = {
  name: 'meta-effects',
  order: 15,
  around: {
    summon(inner, owner, kind) {
      const pet = inner(owner, kind);
      const m = metaOf(this);
      if (pet && m && pet.team === 'ally' && this.metaBonus) applyStats(pet, this.metaBonus);
      return pet;
    },
    deal(inner, source, target, amount, type = 'physical', opts = {}) {
      const m = metaOf(this);
      if (m && !opts.bondTransfer && alive(target)) {
        if (source?.team === 'ally')
          amount *= 1 + val(m, 'A7') + (target.team === 'enemy' && target.boss ? val(m, 'A8') : 0);
        if (target.team === 'ally')
          amount *= Math.max(0, 1 - val(m, 'D5') - (target.metaLine === 'back' ? val(m, 'D7') : 0));
      }
      return inner(source, target, amount, type, opts);
    },
    heal(inner, target, amount, source) {
      const m = metaOf(this);
      if (m && target?.team === 'ally') amount *= 1 + val(m, 'D4');
      return inner(target, amount, source);
    },
  },
  on: {
    start: { order: 7, run: (b) => start(b) },
  },
};

export default { extension, start, lineOf, sharedBonus };
