// Migrated from the v0.15.18 suite test-preparation.cjs (tests for: shop).
// Shared setup is copied as-is so each file stays independent.
import { test } from 'vitest';

const a = require('node:assert/strict'),
  D = require('../../src/legacy/data.js'),
  P = require('../../src/legacy/progression.js'),
  V = require('../../src/legacy/preparation.js'),
  { Battle } = require('../../src/legacy/engine.js');
let count = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
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
