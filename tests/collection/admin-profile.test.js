// v0.26.4 관리자 캐릭터 설정(종족·직업·특성·성별) + 카드 코스트 위치 + 썸네일 배경 + 컬렉션 흑백 목록 + 시작 화면 도감.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import D from '../../src/core/data/units.js';
import PF from '../../src/core/unit-profile.ts';
import S from '../../src/core/card-settings.ts';
import Engine from '../../src/core/combat/battle.js';
import overrides from '../../src/core/data/unit-profile-overrides.generated.js';
import { buildExport, checkRecords } from '../../src/ui/adminExport.ts';

test('캐릭터 설정: 원본(sourceProfile)과 게임 값, 고를 수 있는 값은 지금 게임에 있는 값뿐', () => {
  for (const u of D.roster) {
    const merged = { ...u.sourceProfile, ...(overrides[u.id] || {}) };
    a.deepEqual(PF.gameProfile(u.id), merged, u.id);
    a(!Object.keys(u).includes('sourceProfile'), '명단 데이터 모양은 그대로');
  }
  const jobs = PF.profileFields.find((f) => f.key === 'job').options;
  for (const j of ['마법사', '사제', '주술사', '소환사', '전사', '궁수']) a(jobs.includes(j), j);
  a.deepEqual(PF.checkProfile(PF.gameProfile('C01')), {});
  a.deepEqual(
    Object.keys(PF.checkProfile({ ...PF.gameProfile('C01'), job: '용사', gender: 'x' })).sort(),
    ['gender', 'job'],
  );
  a.deepEqual(PF.profileDiff('C01', { ...PF.sourceProfile('C01'), job: '마법사' }), {
    job: '마법사',
  });
});

test('반영본 합치기: 바뀐 항목만, 모르는 키·문자열이 아닌 값은 무시, 직업은 전투 MP 획득에 쓰인다', () => {
  const units = [{ id: 'C01', race: '언데드', job: '궁수', trait: '화염', gender: 'male' }];
  D.applyProfileOverrides(units, { C01: { job: '마법사', race: 7, zz: 'a' } });
  a.equal(units[0].job, '마법사');
  a.equal(units[0].race, '언데드');
  a.equal(units[0].sourceProfile.job, '궁수');
  const u = D.byId('C01');
  const before = u.job;
  try {
    u.job = '마법사';
    const b = new Engine.Battle(
      [{ id: 'C01', pos: 27, star: 1, uid: 1 }],
      [{ id: 'E06', pos: 30 }],
      {
        rng: () => 0.5,
      },
    );
    const me = b.units.find((x) => x.persistentUid === 1);
    me.mp = 0;
    b.gainMana(me, 10);
    a.equal(me.mp, 15, '마법 직업 ×1.5');
  } finally {
    u.job = before;
  }
});

test('설정만 바꿔도 저장할 설정이고 내보내기 v4에 profile, 잘못된 값은 막는다', async () => {
  a.equal(S.isEmptySettings({ ...S.emptySettings('C02'), profile: PF.gameProfile('C02') }), false);
  const profile = { ...PF.gameProfile('C02'), trait: '번개' };
  const { manifest } = await buildExport([{ ...S.emptySettings('C02'), profile }], 't');
  a.equal(manifest.version, 4);
  a.deepEqual(manifest.modules.characters.cards[0].profile, profile);
  a.deepEqual(
    checkRecords([{ ...S.emptySettings('C02'), profile: { ...profile, race: '외계인' } }]).map(
      (p) => p.field,
    ),
    ['race'],
  );
  const tool = fs.readFileSync('tools/import-admin-export.py', 'utf8');
  a(
    tool.includes('unit-profile-overrides.generated.js') &&
      tool.includes('src/core/unit-profile.ts'),
  );
});

test('카드 코스트 숫자는 프레임과 같은 판(함께 움직임), 프레임 왼쪽 위 원 안', () => {
  const view = fs.readFileSync('src/ui/components/CardView.tsx', 'utf8');
  const layer = view.slice(
    view.indexOf('data-layer="frame"'),
    view.indexOf('</div>', view.indexOf('data-layer="frame"')),
  );
  a(layer.includes('styles.cost'), '코스트가 프레임 판 안');
  a(!view.includes('data-layer="cost"'), '따로 움직이는 코스트 층 없음');
  const css = fs.readFileSync('src/ui/components/CardView.module.css', 'utf8');
  a(/\.cost \{[^}]*left: 6\.04%;[^}]*top: 4\.25%;[^}]*width: 13\.77%;/.test(css));
});

test('썸네일: 대기석·영입 금테(v0.26.6 밝은 금+빛줄)·전장 아군 파랑/적 빨강·안쪽 코스트 색 그라데이션, 컬렉션 45명 흑백(미보유), 시작 화면 도감 버튼', () => {
  const pawn = fs.readFileSync('src/ui/components/Pawn.module.css', 'utf8');
  a(
    pawn.includes('var(--gold-frame) border-box') && pawn.includes('border: 4px solid transparent'),
  );
  a(
    pawn.includes("[data-context='field']") && pawn.includes('var(--field-ally)'),
    '전장은 아군 파랑',
  );
  const img = fs.readFileSync('src/ui/components/CharacterImage.module.css', 'utf8');
  a(img.includes('linear-gradient') && img.includes('var(--cost-color'));
  const field = fs.readFileSync('src/ui/render/battlefield.ts', 'utf8');
  a(field.includes("'#4fa3ff'") && field.includes("'#c44d63'"), '전투 화면 아군 파랑·적 빨강');
  const col = fs.readFileSync('src/ui/components/Collection.tsx', 'utf8');
  a(col.includes('data-owned={entry.owned}'));
  a(fs.readFileSync('src/ui/components/Collection.module.css', 'utf8').includes('grayscale(1)'));
  const home = fs.readFileSync('src/ui/components/Home.tsx', 'utf8');
  a(home.includes("openOverlay({ kind: 'codex', page: 'home' })"));
});

test('영입 카드(v0.26.7): 오른쪽 위 원형 표시(추천 별 위, 보유 중 책 아래 세로), 추천 테두리 이글거림, 금테 진한 선', () => {
  const tsx = fs.readFileSync('src/ui/components/ShopPopover.tsx', 'utf8');
  const rec = tsx.indexOf('data-badge="recommend"');
  const own = tsx.indexOf('data-badge="owned"');
  a(rec > 0 && own > rec, '추천이 먼저(위), 보유 중이 그 아래');
  a(!tsx.includes('✓ 보유 중'), '이전 보유 중 글자 표시 없음');
  const css = fs.readFileSync('src/ui/components/ShopPopover.module.css', 'utf8');
  a(
    /\.marks \{[^}]*top: 5px;[^}]*right: 5px;[^}]*flex-direction: column;/.test(css),
    '오른쪽 위 세로',
  );
  a(/\.mark \{[^}]*border-radius: 50%;/.test(css), '원형');
  a(css.includes('blazeFlow') && css.includes('blazeFlicker'), '추천 테두리 이글거림');
  a(/prefers-reduced-motion[^}]*data-recommended='true'\] \{\s*animation: none;/.test(css));
  const tokens = fs.readFileSync('src/ui/styles/tokens.css', 'utf8');
  a(
    tokens.includes('0 0 0 1px #7a5410') && tokens.includes('inset 0 0 0 1px #8a5f12'),
    '금테 바깥·안쪽 선',
  );
});

test('썸네일 줄인 사본(v0.26.8): 반영된 썸네일마다 128·192·288·432px 사본이 있고 영입·대기석은 srcset으로 고른다', async () => {
  const { bakedCardArt } = await import('../../src/ui/art/card-art.generated.ts');
  const { thumbnailWidths, thumbnailSrcset } = await import('../../src/ui/art/cards.ts');
  const { portraitOf } = await import('../../src/ui/art/characters.ts');
  const tool = fs.readFileSync('tools/import-admin-export.py', 'utf8');
  a(
    tool.includes(`THUMB_WIDTHS = (${thumbnailWidths.join(', ')})`),
    '도구와 화면의 너비 목록이 같다',
  );
  let n = 0;
  for (const [id, e] of Object.entries(bakedCardArt)) {
    const t = e.thumbnail;
    if (!t) continue;
    n++;
    a.deepEqual(
      t.variants,
      thumbnailWidths.filter((w) => w < t.width),
      id,
    );
    const dir = t.src.slice(0, t.src.lastIndexOf('/') + 1);
    for (const w of t.variants) a(fs.existsSync(`public/${dir}thumbnail-${w}.webp`), `${id} ${w}`);
    const set = portraitOf(id).thumbnailSrcset;
    a.equal(set, thumbnailSrcset(t));
    a(set.endsWith(`${t.src} ${t.width}w`) && set.includes(`thumbnail-128.webp 128w`), id);
  }
  a(n > 0);
  const img = fs.readFileSync('src/ui/components/CharacterImage.tsx', 'utf8');
  a(
    img.includes('srcset={srcset}') &&
      img.includes("shop: '140px'") &&
      img.includes("bench: '90px'"),
  );
});
