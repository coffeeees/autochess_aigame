import D from './data/units.js';
import P from './progression.js';
import I from './items.js';
import A from './augments.js';
import { runRng } from './rng.ts';

const editable = (s) => !s.done && s.roundPhase === 'prepare';
function normalize(s) {
  s.recommendedBonds = [
    ...new Set(
      Array.isArray(s.recommendedBonds)
        ? s.recommendedBonds
        : s.recommendedBond
          ? [s.recommendedBond]
          : [],
    ),
  ]
    .filter((id) => D.synergies.some((b) => b.id === id))
    .slice(0, 3);
  delete s.recommendedBond;
  const bench = s.units.filter((u) => u.location === 'bench'),
    used = new Set(),
    kept = new Set(),
    size = D.prototypeConfig.board.benchSize;
  for (const u of bench)
    if (
      Number.isInteger(u.benchSlot) &&
      u.benchSlot >= 0 &&
      u.benchSlot < size &&
      !used.has(u.benchSlot)
    ) {
      used.add(u.benchSlot);
      kept.add(u);
    }
  for (const u of bench)
    if (!kept.has(u)) {
      let slot = 0;
      while (used.has(slot)) slot++;
      u.benchSlot = slot;
      used.add(slot);
    }
  return s;
}
function benchSlots(s) {
  normalize(s);
  return Math.max(
    D.prototypeConfig.board.benchSize,
    ...s.units.filter((u) => u.location === 'bench').map((u) => u.benchSlot + 1),
  );
}
function repairDeployment(s) {
  normalize(s);
  const seen = new Set();
  let moved = 0;
  for (const u of s.units.filter((u) => u.location === 'board')) {
    if (seen.has(u.id)) {
      const used = new Set(s.units.filter((x) => x.location === 'bench').map((x) => x.benchSlot));
      let i = 0;
      while (used.has(i)) i++;
      u.location = 'bench';
      u.pos = -1;
      u.benchSlot = i;
      moved++;
    } else seen.add(u.id);
  }
  return moved;
}
const sameUnitMessage = (limit) =>
  limit > 1
    ? `쌍둥이 전술: 동일한 캐릭터는 전장에 ${limit}명까지 배치할 수 있습니다.`
    : '동일한 캐릭터는 전장에 1명만 배치할 수 있습니다.';
function moveUnit(s, uid, target) {
  normalize(s);
  if (!editable(s)) return { ok: false, message: '준비 단계에서만 이동할 수 있습니다.' };
  const unit = s.units.find((u) => u.uid === uid);
  if (!unit) return { ok: false, message: '캐릭터를 찾을 수 없습니다.' };
  if (!target || !['board', 'bench'].includes(target.location))
    return { ok: false, message: '전장이나 대기석에 놓아주세요.' };
  if (
    target.location === 'board' &&
    (!Number.isInteger(target.pos) ||
      target.pos < D.prototypeConfig.board.columns * D.prototypeConfig.board.playerFirstRow ||
      target.pos >= D.prototypeConfig.board.columns * D.prototypeConfig.board.rows)
  )
    return { ok: false, message: '아군 진영 아래 4줄에만 배치할 수 있습니다.' };
  if (
    target.location === 'bench' &&
    (!Number.isInteger(target.slot) || target.slot < 0 || target.slot >= benchSlots(s))
  )
    return { ok: false, message: '대기석 칸에 놓아주세요.' };
  const other = s.units.find((u) =>
    target.location === 'board'
      ? u.location === 'board' && u.pos === target.pos
      : u.location === 'bench' && u.benchSlot === target.slot,
  );
  if (other === unit) return { ok: true };
  const next = s.units.map((u) => ({ ...u })),
    moving = next.find((u) => u.uid === uid),
    swapped = other && next.find((u) => u.uid === other.uid),
    old = { location: unit.location, pos: unit.pos, benchSlot: unit.benchSlot };
  moving.location = target.location;
  moving.pos = target.location === 'board' ? target.pos : -1;
  if (target.location === 'bench') moving.benchSlot = target.slot;
  if (swapped) Object.assign(swapped, old);
  const board = next.filter((u) => u.location === 'board');
  // 같은 캐릭터는 전장에 1명(G13 쌍둥이 전술이 있으면 2명까지)
  const limit = A.sameUnitLimit(s.augments);
  if (board.some((u) => board.filter((x) => x.id === u.id).length > limit))
    return { ok: false, message: sameUnitMessage(limit) };
  if (board.length > P.capacity(s))
    return {
      ok: false,
      message: '현재 레벨에서는 ' + P.capacity(s) + '명까지 배치할 수 있습니다.',
    };
  // Overflow slots only preserve legacy saves; new bench units still use the normal ten slots.
  const bench = next.filter((u) => u.location === 'bench');
  if (
    bench.length > D.prototypeConfig.board.benchSize &&
    bench.length > s.units.filter((u) => u.location === 'bench').length
  )
    return { ok: false, message: '대기석이 가득 찼습니다.' };
  for (const u of next)
    Object.assign(
      s.units.find((x) => x.uid === u.uid),
      u,
    );
  return { ok: true };
}
function toggleRecommendation(s, id) {
  normalize(s);
  if (!D.synergies.some((b) => b.id === id)) return { ok: false };
  const i = s.recommendedBonds.indexOf(id);
  if (i >= 0) {
    s.recommendedBonds.splice(i, 1);
    return { ok: true };
  }
  if (s.recommendedBonds.length >= 3)
    return {
      ok: false,
      message: '추천은 최대 3개까지 선택할 수 있습니다. 먼저 하나를 해제해 주세요.',
    };
  s.recommendedBonds.push(id);
  return { ok: true };
}
function recommendedFor(s, id) {
  const unit = D.byId(id);
  return unit
    ? (s.recommendedBonds || []).filter((name) => {
        const b = D.synergies.find((x) => x.id === name);
        return b && D.hasBond(unit, name);
      })
    : [];
}
const shopPool = (s) =>
  D.playableIds.filter((id) => !s.units.some((u) => u.id === id && u.star >= 3));
// Currency Wars baseline cost-tier odds, transcribed from BWIKI (2026-11-11).
const oddsSource = 'https://wiki.biligame.com/sr/%E8%B4%A7%E5%B8%81%E6%88%98%E4%BA%89#刷新概率';
const baseOdds = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [100, 0, 0, 0, 0],
  4: [65, 25, 10, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [18, 25, 32, 22, 3],
  9: [15, 20, 25, 30, 10],
  10: [5, 10, 20, 40, 25],
};
function shopOdds(s) {
  const base = baseOdds[Math.max(1, Math.min(10, s.level || 3))],
    pool = shopPool(s),
    available = [1, 2, 3, 4, 5].map((cost) => pool.some((id) => D.byId(id).cost === cost)),
    sum = base.reduce((n, w, i) => n + (available[i] ? w : 0), 0);
  return base.map((w, i) => (sum && available[i] ? (w / sum) * 100 : 0));
}
function drawShop(s, rng = runRng(s)) {
  const pool = shopPool(s),
    odds = shopOdds(s),
    roll = rng() * 100;
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += odds[i];
    if (roll < total) {
      const members = pool.filter((id) => D.byId(id).cost === i + 1);
      return members.length
        ? members[Math.min(members.length - 1, Math.floor(rng() * members.length))]
        : null;
    }
  }
  return null;
}
function enterShop(s, rng = runRng(s)) {
  if (s.shopCarry?.node === P.label(s)) {
    s.shop = s.shopCarry.offers.map((id) =>
      id && D.playableIds.includes(id) && !s.units.some((u) => u.id === id && u.star === 3)
        ? id
        : null,
    );
    s.shopCarry = null;
    return s.shop;
  }
  return rollShop(s, rng);
}
function manualReroll(s, rng = runRng(s)) {
  if (!editable(s) || s.gold < P.rerollCost(s)) return false;
  P.useReroll(s); // 무료 새로고침(증강)이 있으면 그것부터 쓴다
  s.shopLocked = false;
  s.shopCarry = null;
  rollShop(s, rng);
  return true;
}
function rollShop(s, rng = runRng(s)) {
  s.shop = Array.from({ length: D.prototypeConfig.economy.shopSlots }, () => drawShop(s, rng));
  P.guaranteeShop(s, rng); // 운명의 상점(P10)
  return s.shop;
}
function refreshShop(s, rng = runRng(s)) {
  const pool = shopPool(s);
  s.shop = s.shop.map((id) => (id && !pool.includes(id) ? drawShop(s, rng) : id));
  return s.shop;
}
function transferItem(s, itemUid, unitUid) {
  if (!editable(s)) return { ok: false, message: '아이템은 준비 단계에서 옮길 수 있습니다.' };
  const item = s.inventory.find((i) => i.uid === itemUid),
    unit = s.units.find((u) => u.uid === unitUid);
  if (!item || !unit) return { ok: false, message: '아이템을 아군 캐릭터 위에 놓아주세요.' };
  if (item.equippedTo === unitUid) return { ok: true };
  const equipped = s.inventory.filter((i) => i.equippedTo === unitUid);
  if (equipped.length >= P.config.equipment.slotsPerUnit)
    return { ok: false, message: '캐릭터당 아이템은 최대 3개입니다.' };
  item.equippedTo = unitUid;
  return { ok: true };
}
function damageRows(b) {
  if (!b) return [];
  const rows = b.units
      .filter((u) => u.team === 'ally' && !u.summon)
      .map((u) => ({
        uid: u.uid,
        persistentUid: u.persistentUid,
        id: u.id,
        name: u.name,
        star: u.star,
        damage: 0,
      })),
    map = new Map(rows.map((r) => [r.uid, r]));
  for (const u of b.units.filter((u) => u.team === 'ally')) {
    let owner = u,
      seen = new Set();
    while (owner.summon && owner.owner && !seen.has(owner.uid)) {
      seen.add(owner.uid);
      const next = b.units.find((x) => x.uid === owner.owner);
      if (!next) break;
      owner = next;
    }
    const row = map.get(owner.uid);
    if (row) row.damage += Math.max(0, u.damageDone || 0);
  }
  return rows.sort((a, b) => b.damage - a.damage || a.uid - b.uid);
}
function deploymentStatus(s) {
  const count = s.units.filter((u) => u.location === 'board').length,
    capacity = P.capacity(s);
  return {
    count,
    capacity,
    missing: Math.max(0, capacity - count),
    shouldWarn: count < capacity && s.skipDeploymentWarning !== true,
  };
}
function startingRoster(rng) {
  const one = D.roster.filter((u) => u.cost === 1).map((u) => u.id),
    two = D.roster.filter((u) => u.cost === 2).map((u) => u.id),
    pick = (pool) => pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0];
  return [pick(one), pick(one), pick(two)];
}
// Preview uses only a count copy; it cannot mutate units, gear, money or RNG.
function mergePreview(s, id) {
  if (!D.playableIds.includes(id)) return 0;
  const { maxStar, mergeCopies } = D.prototypeConfig.economy,
    counts = Array(maxStar + 1).fill(0);
  for (const u of s.units) if (u.id === id) counts[u.star] = (counts[u.star] || 0) + 1;
  if (counts[maxStar]) return 0;
  counts[1]++;
  let result = 0;
  for (let star = 1; star < maxStar; star++) {
    const merges = Math.floor(counts[star] / mergeCopies);
    if (merges) {
      counts[star + 1] += merges;
      result = star + 1;
    }
  }
  return result;
}
const api = {
  mergePreview,
  enterShop,
  manualReroll,
  startingRoster,
  deploymentStatus,
  editable,
  normalize,
  benchSlots,
  repairDeployment,
  moveUnit,
  toggleRecommendation,
  recommendedFor,
  shopPool,
  baseOdds,
  oddsSource,
  shopOdds,
  drawShop,
  rollShop,
  refreshShop,
  transferItem,
  damageRows,
};

export default api;
