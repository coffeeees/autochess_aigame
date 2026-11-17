'use strict';
const a = require('node:assert/strict'),
  D = require('./src/legacy/data.js'),
  P = require('./src/legacy/progression.js'),
  V = require('./src/legacy/preparation.js'),
  { Battle } = require('./src/legacy/engine.js');
let count = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function test(name, fn) {
  fn();
  count++;
  console.log('PASS ' + name);
}
function state() {
  return V.normalize(
    P.initialize({
      health: 100,
      gold: 12,
      units: [
        { uid: 1, id: 'C03', star: 1, location: 'board', pos: 38 },
        { uid: 2, id: 'C05', star: 1, location: 'board', pos: 53 },
        { uid: 3, id: 'C01', star: 1, location: 'board', pos: 52 },
        { uid: 4, id: 'C03', star: 1, location: 'bench', pos: -1 },
        { uid: 5, id: 'C02', star: 1, location: 'bench', pos: -1 },
      ],
      shop: ['C03', 'C05', 'C01', 'C02', 'C04'],
    }),
  );
}
test('board move, same-cell and swaps preserve UID and equipment', () => {
  const s = state(),
    item = P.addItem(s, 'armor');
  P.equip(s, item.uid, 1);
  a(V.moveUnit(s, 1, { location: 'board', pos: 37 }).ok);
  a.equal(s.units[0].pos, 37);
  a(V.moveUnit(s, 1, { location: 'board', pos: 37 }).ok);
  a(V.moveUnit(s, 1, { location: 'board', pos: 53 }).ok);
  a.equal(s.units[0].pos, 53);
  a.equal(s.units[1].pos, 37);
  a.equal(item.equippedTo, 1);
});
test('duplicate character rejected independent of star and without mutation', () => {
  const s = state();
  s.level = 10;
  s.units[3].star = 2;
  const before = clone(s);
  a(!V.moveUnit(s, 4, { location: 'board', pos: 37 }).ok);
  a.deepEqual(s, before);
  a(!V.moveUnit(s, 4, { location: 'board', pos: 53 }).ok);
  a.deepEqual(s, before);
});
test('same-ID replacement of existing character is legal; different ID swap too', () => {
  const s = state();
  a(V.moveUnit(s, 4, { location: 'board', pos: 38 }).ok);
  a.equal(s.units[0].location, 'bench');
  a.equal(s.units[3].location, 'board');
  a(V.moveUnit(s, 5, { location: 'board', pos: 53 }).ok);
  a.equal(s.units[1].location, 'bench');
  a.equal(s.units[4].pos, 53);
});
test('capacity restriction allows replacements and bench transfer frees capacity', () => {
  const s = state();
  a(!V.moveUnit(s, 5, { location: 'board', pos: 37 }).ok);
  a(V.moveUnit(s, 1, { location: 'bench', slot: 4 }).ok);
  a.equal(s.units[0].benchSlot, 4);
  a(V.moveUnit(s, 5, { location: 'board', pos: 37 }).ok);
  a.equal(s.units[4].pos, 37);
});
test('bench-to-bench swaps exact slots; full bench board transfer cannot add unit', () => {
  const s = state();
  a(V.moveUnit(s, 4, { location: 'bench', slot: 1 }).ok);
  a.equal(s.units[3].benchSlot, 1);
  a.equal(s.units[4].benchSlot, 0);
  for (let i = 0; i < 10; i++)
    s.units.push({ uid: 6 + i, id: 'C04', star: 1, location: 'bench', pos: -1 });
  V.normalize(s);
  a(V.moveUnit(s, 1, { location: 'bench', slot: 0 }).ok);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 12);
});
test('enemy positions, missing targets, invalid slots and nonprepare moves fail atomically', () => {
  for (const target of [
    { location: 'board', pos: 3 },
    { location: 'board', pos: 56 },
    { location: 'bench', slot: 99 },
    null,
  ]) {
    const s = state(),
      before = clone(s);
    a(!V.moveUnit(s, 1, target).ok);
    a.deepEqual(s, before);
  }
  for (const phase of ['combat', 'result', 'augment', 'gameover']) {
    const s = state();
    s.roundPhase = phase;
    const before = clone(s);
    a(!V.moveUnit(s, 1, { location: 'board', pos: 37 }).ok);
    a.deepEqual(s, before);
  }
});
test('legacy duplicate deployment repaired without losing units or gear, even full bench', () => {
  const s = state();
  s.units[3].location = 'board';
  s.units[3].pos = 37;
  for (let i = 0; i < 11; i++)
    s.units.push({ uid: 6 + i, id: 'C04', star: 1, location: 'bench', pos: -1 });
  const item = P.addItem(s, 'sword');
  item.equippedTo = 4;
  const n = s.units.length;
  a.equal(V.repairDeployment(s), 1);
  a.equal(s.units.length, n);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 13);
  a.equal(item.equippedTo, 4);
  a.equal(V.repairDeployment(s), 0);
  a.equal(V.benchSlots(s), 13);
});
test('engine rejects repeated allied IDs while independent enemy repeats remain valid', () => {
  a.throws(
    () =>
      new Battle(
        [
          { id: 'C03', pos: 35 },
          { id: 'C03', pos: 36 },
        ],
        [{ id: 'E01', pos: 3 }],
      ),
  );
  new Battle(
    [{ id: 'C03', pos: 35 }],
    [
      { id: 'E01', pos: 3 },
      { id: 'E01', pos: 4 },
    ],
  );
});
test('three equipment slots apply all stats; fourth and duplicate type blocked', () => {
  const s = state();
  for (const id of ['sword', 'armor', 'crystal']) {
    const item = P.addItem(s, id);
    a(P.equip(s, item.uid, 1));
  }
  a.equal(s.inventory.filter((i) => i.equippedTo === 1).length, 3);
  a.deepEqual(P.unitBonuses(s, 1), { AD: 10, GD: 10, AP: 10 });
  const fourth = P.addItem(s, 'sword');
  a(!P.equip(s, fourth.uid, 1));
  a(!V.transferItem(s, fourth.uid, 1).ok);
  const stats = P.previewStats(s, s.units[0]);
  for (const k of ['AD', 'GD', 'AP']) a.equal(stats[k], D.byId('C03').stats[k] + 10);
  a(V.transferItem(s, s.inventory[0].uid, 2).ok);
  a.equal(P.previewStats(s, s.units[0]).AD, D.byId('C03').stats.AD);
  a.equal(P.previewStats(s, s.units[1]).AD, D.byId('C05').stats.AD + 10);
  a(V.transferItem(s, s.inventory[0].uid, 2).ok);
});
test('equipment transfer failure atomic, return to storage, phase guards preserved', () => {
  const s = state(),
    first = P.addItem(s, 'I26'),
    second = P.addItem(s, 'I26');
  P.equip(s, first.uid, 1);
  P.equip(s, second.uid, 2);
  a(V.transferItem(s, first.uid, 2).ok);
  const third = P.addItem(s, 'I26');
  a(P.equip(s, third.uid, 2));
  const fourth = P.addItem(s, 'I26');
  const before = clone(s);
  a(!V.transferItem(s, fourth.uid, 2).ok);
  a.deepEqual(s, before);
  s.roundPhase = 'combat';
  a(!V.transferItem(s, first.uid, 3).ok);
  a(!P.unequip(s, first.uid));
  s.roundPhase = 'prepare';
  a(P.unequip(s, first.uid));
  a.equal(first.equippedTo, null);
  a.equal(s.gold, 12);
});
test('recommendation migration, unique max3, toggles, invalid and fourth preserve list', () => {
  const s = state();
  delete s.recommendedBonds;
  s.recommendedBond = '철혈';
  V.normalize(s);
  a.deepEqual(s.recommendedBonds, ['철혈']);
  a(V.toggleRecommendation(s, '금단').ok);
  a(V.toggleRecommendation(s, '종언').ok);
  a(!V.toggleRecommendation(s, '생명').ok);
  a(!V.toggleRecommendation(s, 'bogus').ok);
  a.deepEqual(s.recommendedBonds, ['철혈', '금단', '종언']);
  a(V.toggleRecommendation(s, '철혈').ok);
  a(V.toggleRecommendation(s, '생명').ok);
  a.deepEqual(s.recommendedBonds, ['금단', '종언', '생명']);
  a.deepEqual(V.recommendedFor(s, 'C02'), ['금단']);
  a.deepEqual(V.recommendedFor(s, 'C01'), ['종언']);
  a.deepEqual(V.recommendedFor(s, 'C10'), []);
  a.deepEqual(V.normalize(clone(s)).recommendedBonds, s.recommendedBonds);
});
test('owned3star excluded on bench or field, lower copies eligible, sale restores pool', () => {
  const s = state();
  s.units[0].star = 3;
  for (const location of ['board', 'bench']) {
    s.units[0].location = location;
    a(!V.shopPool(s).includes('C03'));
    for (let i = 0; i < 30; i++) a(!V.rollShop(s, () => i / 30).includes('C03'));
  }
  s.units = s.units.filter((u) => u.uid !== 1);
  a(V.shopPool(s).includes('C03'));
  const pool = V.shopPool(s).filter((id) => D.byId(id).cost === 1);
  let turn = 0;
  a(
    V.rollShop(s, () => (turn++ % 2 ? pool.indexOf('C03') / pool.length : 0)).every(
      (id) => id === 'C03',
    ),
  );
  s.units[0].star = 2;
  a(V.shopPool(s).includes(s.units[0].id));
});
test('3star sanitizes current offers only, all-complete pool returns empty safely', () => {
  const s = state();
  s.units[0].star = 3;
  const rest = s.shop.slice(1);
  V.refreshShop(s, () => 0);
  a(!s.shop.includes('C03'));
  a.deepEqual(s.shop.slice(1), rest);
  s.units = D.playableIds.map((id, i) => ({ uid: i, id, star: 3, location: 'bench', pos: -1 }));
  a.deepEqual(V.rollShop(s), [null, null, null, null, null]);
});
test('damage aggregation includes dead summons, excludes enemies and zero allies retained', () => {
  const b = new Battle(
    [
      { id: 'C02', uid: 1, pos: 38 },
      { id: 'C05', uid: 2, pos: 53 },
    ],
    [{ id: 'E01', pos: 3 }],
    { rng: () => 0.99 },
  );
  const pet = b.summon(b.units[0], 'plague');
  b.units[0].damageDone = 100;
  b.units[2].damageDone = 900;
  pet.damageDone = 250;
  pet.dead = true;
  const rows = V.damageRows(b);
  a.equal(rows.length, 2);
  a.equal(rows[0].id, 'C02');
  a.equal(rows[0].damage, 350);
  a.equal(rows[1].damage, 0);
  a.equal(
    rows.reduce((n, r) => n + r.damage, 0),
    350,
  );
});
test('actual battle damage conserved in report and survives settlement/reload without mutating receipt', () => {
  const b = new Battle(
    [
      { id: 'C02', uid: 1, pos: 38 },
      { id: 'C05', uid: 2, pos: 53 },
    ],
    [{ id: 'E01', pos: 3 }],
    { quickMana: true, rng: () => 0.99 },
  );
  while (!b.result) b.tick();
  const rows = V.damageRows(b);
  a(
    Math.abs(
      rows.reduce((sum, r) => sum + r.damage, 0) -
        b.units.filter((u) => u.team === 'ally').reduce((sum, u) => sum + u.damageDone, 0),
    ) < 1e-6,
  );
  const s = state();
  s.round = 3;
  s.roundPhase = 'combat';
  const r = P.settleRound(s, { winner: 'ally', damageRows: rows });
  a.deepEqual(r.damageRows, rows);
  rows[0].damage = 999999;
  a.notEqual(r.damageRows[0].damage, 999999);
  a.deepEqual(clone(s).lastResult.damageRows, r.damageRows);
});
test('ten-slot reserve fills at10, rejects11th slot and keeps same-slot replacement legal', () => {
  const s = P.initialize({
    health: 100,
    gold: 7,
    shop: [],
    units: Array.from({ length: 10 }, (_, i) => ({
      uid: i + 1,
      id: D.playableIds[i],
      star: 1,
      location: 'bench',
      pos: -1,
      benchSlot: i,
    })),
  });
  s.units.push({ uid: 11, id: 'C15', star: 1, location: 'board', pos: 31 });
  a.equal(D.prototypeConfig.board.benchSize, 10);
  a.equal(V.benchSlots(s), 10);
  a(!V.moveUnit(s, 11, { location: 'bench', slot: 10 }).ok);
  a(V.moveUnit(s, 11, { location: 'bench', slot: 0 }).ok);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 10);
});
test('legacy12 reserve units and equipment survive, overflow compacts as units leave', () => {
  const s = P.initialize({
      health: 100,
      gold: 7,
      shop: [],
      units: Array.from({ length: 12 }, (_, i) => ({
        uid: i + 1,
        id: D.playableIds[i],
        star: 1,
        location: 'bench',
        pos: -1,
        benchSlot: i,
      })),
    }),
    item = P.addItem(s, 'I28');
  item.equippedTo = 12;
  V.normalize(s);
  a.equal(s.units.length, 12);
  a.equal(new Set(s.units.map((u) => u.benchSlot)).size, 12);
  a.equal(s.units.filter((u) => u.benchSlot >= 10).length, 2);
  a(V.moveUnit(s, 11, { location: 'board', pos: 31 }).ok);
  V.normalize(s);
  a.equal(s.units.filter((u) => u.location === 'bench' && u.benchSlot >= 10).length, 1);
  a(V.moveUnit(s, 12, { location: 'board', pos: 32 }).ok);
  V.normalize(s);
  a.equal(V.benchSlots(s), 10);
  a.equal(s.units.filter((u) => u.location === 'bench').length, 10);
  a.equal(item.equippedTo, 12);
  a.equal(s.gold, 7);
});
console.log('\n' + count + ' preparation/UI-rules tests passed.');
