// 5b단계: 구매·판매·합성·원정 생성을 core 함수로(src/core/shop.ts, merge.ts, run.ts).
// 모든 UI가 이 함수를 쓴다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import D from '../../src/core/data/units.js';
import P from '../../src/core/progression.js';
import V from '../../src/core/preparation.js';
import { buyUnit, salePrice, sellUnit, canSell } from '../../src/core/shop.ts';
import { mergeAll, mergeAnchor } from '../../src/core/merge.ts';
import { newRun, battleSetup, FIRST_SHOP } from '../../src/core/run.ts';

const clone = (x) => JSON.parse(JSON.stringify(x));
const run = (seed = 11) => newRun({ seed, difficulty: 3 });
const oneCost = D.roster.filter((u) => u.cost === 1).map((u) => u.id);

test('새 원정: 7G, 레벨 3, 1코스트 2명·2코스트 1명, 고정된 첫 상점', () => {
  const s = run();
  a.equal(s.gold, 7);
  a.equal(s.level, 3);
  a.deepEqual(s.shop, FIRST_SHOP);
  a.deepEqual(s.units.map((u) => D.byId(u.id).cost).sort(), [1, 1, 2]);
  a.deepEqual(
    s.units.map((u) => u.uid),
    [1, 2, 3],
  );
  a.equal(s.difficulty, 3);
  a.deepEqual(clone(run(11)), clone(s), 'same seed, same run');
  // 시드가 다르면 시작 캐릭터가 다르다(여러 시드로 확인)
  const rosters = new Set(
    [1, 2, 3, 4, 5, 6].map((k) =>
      run(k)
        .units.map((u) => u.id)
        .join(),
    ),
  );
  a(rosters.size > 1);
  a.deepEqual(
    newRun({ seed: 11, difficulty: 3, firstUid: 40 }).units.map((u) => u.uid),
    [40, 41, 42],
  );
});

test('구매하면 골드를 내고 대기석에 넣고 상점 칸을 비운 뒤 상점을 갱신한다', () => {
  const s = run();
  s.shop = ['C01', 'C02', 'C03', 'C04', 'C05'];
  const result = buyUnit(s, 'C01', { uid: 10, slot: 0 });
  a.equal(result.ok, true);
  a.equal(s.gold, 7 - D.byId('C01').cost);
  a.equal(s.units.find((u) => u.uid === 10).location, 'bench');
  a.equal(s.shop[0], null);
  a.deepEqual(result.merges, []);
});

test('구매 거절은 기존 알림 ID를 돌려주고 아무것도 바꾸지 않는다', () => {
  const s = run();
  s.gold = 0;
  let before = clone(s);
  a.deepEqual(buyUnit(s, 'C01', { uid: 10 }), { ok: false, notice: 'T06' });
  a.deepEqual(clone(s), before);
  // 합성 없이 대기석 가득 참
  s.gold = 50;
  s.units = D.playableIds
    .slice(10, 20)
    .map((id, i) => ({ uid: i + 1, id, location: 'bench', pos: -1, star: 1, benchSlot: i }));
  before = clone(s);
  a.deepEqual(buyUnit(s, 'C01', { uid: 30 }), { ok: false, notice: 'T05' });
  a.deepEqual(clone(s), before);
  // 3성 보유
  s.units = [{ uid: 1, id: 'C01', location: 'bench', pos: -1, star: 3, benchSlot: 0 }];
  a.deepEqual(buyUnit(s, 'C01', { uid: 30 }), { ok: false, notice: 'T04' });
  // 전투 중에는 아무 일도 없음
  a.deepEqual(buyUnit(s, 'C02', { uid: 30, busy: true }), { ok: false, notice: null });
});

test('대기석이 가득 차도 합성을 완성하는 구매는 받는다', () => {
  const s = run();
  s.gold = 50;
  s.units = [
    { uid: 1, id: 'C01', location: 'bench', pos: -1, star: 1, benchSlot: 0 },
    { uid: 2, id: 'C01', location: 'bench', pos: -1, star: 1, benchSlot: 1 },
    ...D.playableIds
      .slice(10, 18)
      .map((id, i) => ({ uid: i + 3, id, location: 'bench', pos: -1, star: 1, benchSlot: i + 2 })),
  ];
  const seen = [];
  const result = buyUnit(s, 'C01', {
    uid: 99,
    beforeMerge: (keep, removed) =>
      seen.push([keep.uid, removed.map((u) => u.uid), s.units.length]),
  });
  a.equal(result.ok, true);
  a.equal(result.merges.length, 1);
  a.deepEqual(seen, [[1, [2, 99], 11]], 'callback runs before the copies are removed');
  a.equal(s.units.find((u) => u.uid === 1).star, 2);
  a.equal(s.units.length, 9);
});

test('합성은 전장 캐릭터를 남기고 재료 장비를 돌려주며 3성까지 이어진다', () => {
  const s = run();
  s.units = [
    { uid: 1, id: 'C05', location: 'bench', pos: -1, star: 1, benchSlot: 2 },
    { uid: 2, id: 'C05', location: 'board', pos: 38, star: 1 },
    { uid: 3, id: 'C05', location: 'bench', pos: -1, star: 1, benchSlot: 0 },
  ];
  const item = P.addItem(s, 'I01');
  item.equippedTo = 3;
  a.equal(mergeAnchor(s.units).uid, 2);
  const events = mergeAll(s);
  a.deepEqual(
    events.map((e) => [e.keep.uid, e.removed.map((u) => u.uid), e.star]),
    [[2, [1, 3], 2]],
  );
  a.equal(s.inventory[0].equippedTo, null);
  // 대기석만 있으면 가장 왼쪽 칸이 남는다
  a.equal(
    mergeAnchor([
      { uid: 7, location: 'bench', benchSlot: 4 },
      { uid: 8, location: 'bench', benchSlot: 1 },
    ]).uid,
    8,
  );
  // 9명은 3성 하나로 이어서 합성
  s.units = Array.from({ length: 9 }, (_, i) => ({
    uid: i + 1,
    id: oneCost[0],
    location: 'bench',
    pos: -1,
    star: 1,
    benchSlot: i,
  }));
  const chain = mergeAll(s);
  a.equal(chain.length, 4);
  a.deepEqual(
    s.units.map((u) => u.star),
    [3],
  );
});

test('판매하면 코스트 × 3^(성급-1)을 돌려주고 장비를 회수한다', () => {
  const s = run();
  const unit = s.units[0];
  unit.star = 2;
  const item = P.addItem(s, 'I01');
  item.equippedTo = unit.uid;
  const gold = s.gold;
  a.equal(salePrice(unit), D.byId(unit.id).cost * 3);
  a.equal(canSell(s, unit.uid, true), false);
  a.deepEqual(sellUnit(s, unit.uid, true), { ok: false });
  a.deepEqual(sellUnit(s, unit.uid), { ok: true, price: D.byId(unit.id).cost * 3 });
  a.equal(s.gold, gold + D.byId(unit.id).cost * 3);
  a.equal(s.inventory[0].equippedTo, null);
  a.deepEqual(sellUnit(s, unit.uid), { ok: false }, 'a repeated sale is inert');
});

test('판매가는 모든 캐릭터에서 코스트 × 3^(성급-1)', () => {
  for (const id of D.playableIds)
    for (let star = 1; star <= 3; star++)
      a.equal(salePrice({ id, star }), D.byId(id).cost * 3 ** (star - 1), `${id} ${star}성`);
});

test('3성을 가진 캐릭터는 상점에서 빠지고, 팔면 다시 나온다(T04)', () => {
  const s = run();
  const id = s.units[0].id;
  s.units[0].star = 3;
  a(!V.shopPool(s).includes(id));
  s.shop = [id, null, null, null, null];
  s.gold = 50;
  a.deepEqual(buyUnit(s, id, { uid: 99, slot: 0 }), { ok: false, notice: 'T04' });
  a(sellUnit(s, s.units[0].uid).ok);
  a(V.shopPool(s).includes(id), '판매 뒤 다시 후보');
});

test('전투 준비: 장비를 반영한 배치 캐릭터, 캐시된 적 편성, 편성 다음에 뽑는 시드', () => {
  const s = run();
  s.stage = 1;
  s.round = 3;
  s.units[0].location = 'board';
  s.units[0].pos = 38;
  const copy = clone(s);
  const setup = battleSetup(s);
  a.deepEqual(
    setup.allies.map((u) => u.uid),
    [s.units[0].uid],
  );
  a(setup.enemies.length > 0);
  a.equal(typeof setup.options.seed, 'number');
  // 같은 상태면 같은 준비, 두 번째 호출은 캐시된 편성을 다시 쓴다
  a.deepEqual(battleSetup(copy), setup);
  a.deepEqual(battleSetup(s).enemies, setup.enemies);
  V.normalize(s);
});

test('B1: 퍼센트 표기는 소수점 오차 없이 둘째 자리까지, 뒤의 0은 뗀다', async () => {
  const { percent, percentNumber } = await import('../../src/core/format.ts');
  a.equal(percent(0.07), '7');
  a.equal(percent(0.075), '7.5');
  a.equal(percentNumber(72.22222222), '72.22');
  a.equal(percentNumber(-0.001), '0');
  const texts = JSON.stringify(D.evaluateSynergies([]));
  a(!/\d\.\d{4,}/.test(texts), '유대 설명에 긴 소수 없음');
  a(texts.includes('아군 사망 시 AD/AP +7%'));
  // 상점 확률은 재정규화로 소수가 생겨도 둘째 자리까지
  const s = run();
  s.level = 4;
  for (const p of V.shopOdds(s)) a(/^\d+(\.\d{1,2})?$/.test(percentNumber(p)));
});
