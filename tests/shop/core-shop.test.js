// Stage 5b: buying, selling, merging and run setup as core functions
// (src/core/shop.ts, merge.ts, run.ts), used by every UI.
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

test('new run: 7G, level 3, two 1-cost and one 2-cost units, fixed first shop', () => {
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
  // different seeds give different starting rosters (checked over several seeds)
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

test('buying pays the cost, fills the bench, empties the slot and refreshes the shop', () => {
  const s = run();
  s.shop = ['C01', 'C02', 'C03', 'C04', 'C05'];
  const result = buyUnit(s, 'C01', { uid: 10, slot: 0 });
  a.equal(result.ok, true);
  a.equal(s.gold, 7 - D.byId('C01').cost);
  a.equal(s.units.find((u) => u.uid === 10).location, 'bench');
  a.equal(s.shop[0], null);
  a.deepEqual(result.merges, []);
});

test('buying refuses with the original notices and changes nothing', () => {
  const s = run();
  s.gold = 0;
  let before = clone(s);
  a.deepEqual(buyUnit(s, 'C01', { uid: 10 }), { ok: false, notice: 'T06' });
  a.deepEqual(clone(s), before);
  // full bench without a merge
  s.gold = 50;
  s.units = D.playableIds
    .slice(10, 20)
    .map((id, i) => ({ uid: i + 1, id, location: 'bench', pos: -1, star: 1, benchSlot: i }));
  before = clone(s);
  a.deepEqual(buyUnit(s, 'C01', { uid: 30 }), { ok: false, notice: 'T05' });
  a.deepEqual(clone(s), before);
  // owned at 3 stars
  s.units = [{ uid: 1, id: 'C01', location: 'bench', pos: -1, star: 3, benchSlot: 0 }];
  a.deepEqual(buyUnit(s, 'C01', { uid: 30 }), { ok: false, notice: 'T04' });
  // during a battle nothing happens
  a.deepEqual(buyUnit(s, 'C02', { uid: 30, busy: true }), { ok: false, notice: null });
});

test('a full bench still accepts the copy that completes a merge', () => {
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

test('merging keeps the board copy, returns consumed equipment and chains to 3 stars', () => {
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
  // bench only: leftmost slot is the anchor
  a.equal(
    mergeAnchor([
      { uid: 7, location: 'bench', benchSlot: 4 },
      { uid: 8, location: 'bench', benchSlot: 1 },
    ]).uid,
    8,
  );
  // nine copies chain to one 3-star
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

test('selling refunds cost x 3^(star-1) and returns equipment', () => {
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

test('battle setup: deployed units with gear, cached enemies, seed drawn after the formation', () => {
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
  // same state, same setup; a second call reuses the cached formation
  a.deepEqual(battleSetup(copy), setup);
  a.deepEqual(battleSetup(s).enemies, setup.enemies);
  V.normalize(s);
});
