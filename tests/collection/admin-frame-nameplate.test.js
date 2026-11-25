// v0.26.0 관리자 캐릭터별 카드 프레임·이름표(요청서 AUTOCHESS_ADMIN_CARD_FRAME_NAMEPLATE_EDIT_2026-11-26).
// 개별 그림이 없으면 공통 기본 그림, 있으면 그 캐릭터 카드에만. 내보내기 v3에 그림·삭제(null) 상태를 담는다.
// 실제 업로드·카드 미리보기·가져오기·새 배포 반영은 브라우저와 도구로 확인했다(패치노트 테스트 기록).
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import S from '../../src/core/card-settings.ts';
import { buildExport, checkRecords } from '../../src/ui/adminExport.ts';
import { bakedCardArt } from '../../src/ui/art/card-art.generated.ts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 6]);
const img = (name, width, height) => ({
  blob: new Blob([png]),
  format: 'png',
  name,
  size: png.length,
  width,
  height,
});

test('프레임·이름표 안내: 기본 비율(714×1000·750×279)과 다르면·가운데가 불투명하면·JPG면 알림(자동 변환 없음)', () => {
  a.deepEqual(S.imageWarnings('frame', { format: 'png', width: 714, height: 1000 }), []);
  a.deepEqual(
    S.imageWarnings('frame', { format: 'png', width: 1428, height: 2000 }),
    [],
    '같은 비율',
  );
  a.equal(S.imageWarnings('frame', { format: 'png', width: 800, height: 800 }).length, 1);
  a.equal(
    S.imageWarnings('frame', { format: 'png', width: 714, height: 1000, opaqueCenter: true })
      .length,
    1,
  );
  a.equal(S.imageWarnings('frame', { format: 'jpeg', width: 714, height: 1000 }).length, 1);
  a.deepEqual(S.imageWarnings('nameplate', { format: 'png', width: 750, height: 279 }), []);
  a.equal(S.imageWarnings('nameplate', { format: 'png', width: 500, height: 500 }).length, 1);
});

test('개별 프레임·이름표만 있어도 저장할 설정(내보내기 수에 포함), 없으면 빈 설정', () => {
  a.equal(
    S.isEmptySettings({ ...S.emptySettings('C01'), frameImage: img('f.png', 714, 1000) }),
    false,
  );
  a.equal(
    S.isEmptySettings({ ...S.emptySettings('C01'), nameplateImage: img('n.png', 750, 279) }),
    false,
  );
  a.equal(S.isEmptySettings(S.emptySettings('C01')), true);
});

test('내보내기 v3: C01 프레임·이름표 파일과 경로, 이름표만 지운 C02는 null(공통 기본으로 복구)', async () => {
  const { zip, manifest } = await buildExport(
    [
      {
        ...S.emptySettings('C01'),
        frameImage: img('my-frame.png', 714, 1000),
        nameplateImage: img('my-plate.png', 750, 279),
      },
      { ...S.emptySettings('C02'), displayNameOverride: '이름만' },
    ],
    'test',
  );
  a.equal(manifest.version, 3);
  const [c01, c02] = manifest.modules.characters.cards;
  a.equal(c01.frameImage.file, 'cards/C01/frame.png');
  a.equal(c01.nameplateImage.file, 'cards/C01/nameplate.png');
  a.equal(c01.characterImage, null, '프레임만 바꿔도 다른 그림 칸은 그대로 상태로 남음');
  a.equal(c02.frameImage, null);
  a.equal(c02.nameplateImage, null);
  const names = new TextDecoder('latin1').decode(zip);
  a(names.includes('cards/C01/frame.png') && names.includes('cards/C01/nameplate.png'));
  a(!names.includes('cards/C02/frame'), '공통 기본 그림은 내보내지 않음');
  const bad = checkRecords([{ ...S.emptySettings('C03'), frameImage: { ...img('x', 0, 0) } }]);
  a.deepEqual(
    bad.map((p) => p.field),
    ['카드 프레임'],
  );
});

test('카드 렌더러: 개별 그림이 없으면 공통 기본, 프레임은 비율 유지(늘리지 않음), 가져오기 도구는 v3·무손실', () => {
  const view = fs.readFileSync('src/ui/components/CardView.tsx', 'utf8');
  a(view.includes('card.frame || cardFrame') && view.includes('card.nameplate || cardNameplate'));
  const css = fs.readFileSync('src/ui/components/CardView.module.css', 'utf8');
  a(/\.frame \{[^}]*object-fit: contain;/.test(css));
  const tool = fs.readFileSync('tools/import-admin-export.py', 'utf8');
  a(
    tool.includes('(1, 2, 3)') &&
      tool.includes("slot in ('frame', 'nameplate')") &&
      tool.includes('lossless=True'),
  );
  for (const [id, e] of Object.entries(bakedCardArt))
    for (const slot of ['frame', 'nameplate'])
      if (e[slot]) a(fs.existsSync('public/' + e[slot].src), `${id} ${slot}`);
});
