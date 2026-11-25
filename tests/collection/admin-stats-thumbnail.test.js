// v0.25.0 관리자 캐릭터 설정 확장: 기본 능력치 10개 편집 규칙·반영 경로, 인게임 썸네일, 내보내기 v2.
// (요청서 AUTOCHESS_ADMIN_CHARACTER_STATS_THUMBNAILS_2026-11-25) 실제 업로드·가져오기 도구·새 게임 적용은 브라우저에서 확인.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import D from '../../src/core/data/units.js';
import W from '../../src/core/encounters.js';
import P from '../../src/core/progression.js';
import U from '../../src/core/unit-stats.ts';
import S from '../../src/core/card-settings.ts';
import Engine from '../../src/core/combat/battle.js';
import overrides from '../../src/core/data/unit-stat-overrides.generated.js';
import { buildExport, checkRecords, ExportError } from '../../src/ui/adminExport.ts';

test('기본 능력치 10개: 원본(sourceStats)과 게임 값(stats), 반영본이 비어 있으면 같고 소수도 그대로', () => {
  a.deepEqual(U.statKeys, D.statKeys);
  for (const u of D.roster) {
    a.deepEqual({ ...u.sourceStats }, U.sourceStats(u.id));
    const merged = { ...u.sourceStats, ...(overrides[u.id] || {}) };
    a.deepEqual(u.stats, merged, u.id);
    a(!Object.keys(u).includes('sourceStats'), '명단 데이터 모양은 그대로(열거 안 됨)');
  }
  a.equal(U.gameStats('C01').AS, 0.8, '소수 보존');
});

test('능력치 검사: 숫자만, HP·MP·AS > 0, RNG 1 이상 정수, 나머지 0 이상, 근거 없는 상한 없음', () => {
  const ok = U.gameStats('C01');
  a.deepEqual(U.checkStats(ok), {});
  a.deepEqual(U.checkStats({ ...ok, CTC: 100, DOD: 90, AS: 7.25, HP: 99999 }), {}, '상한 없음');
  const bad = U.checkStats({
    ...ok,
    HP: 0,
    MP: -1,
    AD: NaN,
    AP: Infinity,
    RNG: 1.5,
    AS: 0,
    DOD: -2,
  });
  a.deepEqual(Object.keys(bad).sort(), ['AD', 'AP', 'AS', 'DOD', 'HP', 'MP', 'RNG']);
  a.equal(U.checkStats({ ...ok, XX: 1 }).XX, '알 수 없는 능력치');
  for (const t of ['', ' ', 'abc', '1,000', '--1', '1e999x']) a(Number.isNaN(U.parseStat(t)), t);
  a.equal(U.parseStat(' 0.875 '), 0.875);
  a.equal(U.parseStat('12'), 12);
  a.deepEqual(U.diffFromSource('C01', { ...U.sourceStats('C01'), HP: 600, AS: 0.85 }), {
    HP: 600,
    AS: 0.85,
  });
  a.deepEqual(U.diffFromSource('C01', U.sourceStats('C01')), {});
});

test('반영본 합치기: 그 캐릭터의 바뀐 키만, 숫자가 아닌 값·모르는 키는 무시, 다른 캐릭터·원본은 그대로', () => {
  const units = [
    { id: 'C01', stats: { HP: 10, AD: 5 } },
    { id: 'C02', stats: { HP: 20, AD: 6 } },
  ];
  D.applyStatOverrides(units, { C01: { HP: 15, AD: 'x', ZZ: 3 } });
  a.deepEqual(units[0].stats, { HP: 15, AD: 5 });
  a.deepEqual({ ...units[0].sourceStats }, { HP: 10, AD: 5 });
  a.deepEqual(units[1].stats, { HP: 20, AD: 6 });
});

test('전투·미리보기는 캐릭터 stats를 쓰고, 적군은 원본 능력치를 쓴다(캐릭터 수정이 적에 번지지 않음)', () => {
  for (const e of W.enemies.filter((x) => !x.bonus))
    a.deepEqual(e.stats, { ...D.byId(e.skillId).sourceStats }, e.id);
  const unit = D.byId('C03');
  const before = unit.stats.HP;
  try {
    unit.stats.HP = 1234; // 반영본이 들어온 상황 흉내
    const b = new Engine.Battle(
      [{ id: 'C03', pos: 27, star: 1, uid: 1 }],
      [{ id: 'E06', pos: 30 }],
      { rng: () => 0.5 },
    );
    a.equal(b.units.find((u) => u.persistentUid === 1).stats.HP, 1234);
    a.equal(
      P.previewStats({ inventory: [], augments: [] }, { id: 'C03', uid: 1, star: 1 }).HP,
      1234,
    );
    a.equal(W.combatSpec('E06').stats.HP, D.byId('C10').sourceStats.HP, '적은 그대로');
  } finally {
    unit.stats.HP = before;
  }
});

test('썸네일 안내: 정사각형·투명 권장(저장은 막지 않음), 빈 설정 판정에 썸네일·능력치 포함', () => {
  a.equal(S.imageWarnings('thumbnail', { format: 'png', width: 512, height: 512 }).length, 0);
  a.equal(S.imageWarnings('thumbnail', { format: 'png', width: 512, height: 700 }).length, 1);
  a.equal(S.imageWarnings('thumbnail', { format: 'jpeg', width: 512, height: 512 }).length, 1);
  a.equal(S.isEmptySettings({ ...S.emptySettings('C01'), stats: U.gameStats('C01') }), false);
  a.equal(S.isEmptySettings({ ...S.emptySettings('C01'), thumbnailImage: {} }), false);
});

test('내보내기 v2: 썸네일·능력치만 바꾼 캐릭터도 포함, 잘못된 능력치는 어느 캐릭터·항목인지 알리고 파일을 만들지 않음', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);
  const stats = { ...U.gameStats('C05'), HP: 777, AS: 0.95 };
  const recs = [
    { ...S.emptySettings('C05'), stats },
    {
      ...S.emptySettings('C07'),
      thumbnailImage: {
        blob: new Blob([png]),
        format: 'png',
        name: 't.png',
        size: 9,
        width: 64,
        height: 64,
      },
    },
  ];
  const { manifest } = await buildExport(recs, 'test');
  const [c05, c07] = manifest.modules.characters.cards;
  a.deepEqual(c05.stats, stats);
  a.equal(c05.thumbnailImage, null);
  a.equal(c07.thumbnailImage.file, 'cards/C07/thumbnail.png');
  a.equal(c07.stats, null);
  const broken = [{ ...S.emptySettings('C09'), stats: { ...stats, RNG: 0.5, HP: -1 } }];
  a.deepEqual(
    checkRecords(broken).map((p) => p.characterId + ' ' + p.field),
    ['C09 HP', 'C09 RNG'],
  );
  await a.rejects(
    buildExport(broken, 'test'),
    (e) => e instanceof ExportError && e.problems.length === 2,
  );
});

test('가져오기 도구·반영본 파일: v1·v2 읽기, 썸네일·능력치 경로를 안다', () => {
  const tool = fs.readFileSync('tools/import-admin-export.py', 'utf8');
  for (const s of [
    '(1, 2, 3)',
    'thumbnail',
    'unit-stat-overrides.generated.js',
    'src/core/unit-stats.ts',
  ])
    a(tool.includes(s), s);
  for (const [id, st] of Object.entries(overrides)) {
    a(D.byId(id), id);
    a.deepEqual(U.checkStats({ ...D.byId(id).sourceStats, ...st }), {}, id);
  }
});
