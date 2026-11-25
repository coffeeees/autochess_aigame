// v0.24.0 관리자 내보내기: ZIP 형식(CRC·UTF-8 이름·내용 그대로), 매니페스트(모듈별·카드 전체 상태·해시), 반영본 등록표.
// 실제 내려받기·가져오기 도구(tools/import-admin-export.py)는 브라우저와 로컬에서 확인했다(패치노트 테스트 기록).
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { crc32, makeZip } from '../../src/ui/zip.ts';
import { buildExport, exportFileName, EXPORT_FORMAT } from '../../src/ui/adminExport.ts';
import { bakedCardArt } from '../../src/ui/art/card-art.generated.ts';
import S from '../../src/core/card-settings.ts';

/** 테스트용 ZIP 읽기(stored만): 이름 → 바이트, CRC 확인 */
function readZip(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = new Map();
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    a.equal(v.getUint16(p + 6, true) & 0x0800, 0x0800, 'UTF-8 이름');
    a.equal(v.getUint16(p + 8, true), 0, 'stored');
    const crc = v.getUint32(p + 14, true);
    const size = v.getUint32(p + 18, true);
    const nameLen = v.getUint16(p + 26, true);
    const name = new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nameLen));
    const data = buf.subarray(p + 30 + nameLen, p + 30 + nameLen + size);
    a.equal(crc32(data), crc, name);
    out.set(name, data);
    p += 30 + nameLen + size;
  }
  const end = buf.length - 22;
  a.equal(v.getUint32(end, true), 0x06054b50, '끝 레코드');
  a.equal(v.getUint16(end + 10, true), out.size, '항목 수');
  return out;
}

test('CRC32 표준값과 ZIP 왕복(한글 이름·바이너리 그대로)', () => {
  a.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bin = new Uint8Array(300).map((_, i) => (i * 7) & 255);
  const zip = makeZip([
    { name: '설명.txt', data: new TextEncoder().encode('안녕') },
    { name: 'a/b.bin', data: bin },
  ]);
  const files = readZip(zip);
  a.equal(new TextDecoder().decode(files.get('설명.txt')), '안녕');
  a.deepEqual([...files.get('a/b.bin')], [...bin]);
});

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const img = (bytes, format, name) => ({
  blob: new Blob([bytes]),
  format,
  name,
  size: bytes.length,
  width: 10,
  height: 20,
});

test('내보내기: 매니페스트(형식·버전 2·카드 전체 상태·sha256) + 원본 그림 + README_APPLY.md, 캐릭터 ID 순', async () => {
  const records = [
    {
      ...S.emptySettings('C12'),
      backgroundImage: img(jpg, 'jpeg', '배경.jpg'),
      updatedAt: 1,
    },
    {
      ...S.emptySettings('C01'),
      displayNameOverride: '카드 녹스',
      characterImage: img(png, 'png', 'nox.png'),
      updatedAt: 2,
    },
  ];
  const now = new Date(2026, 10, 24, 9, 5);
  const { zip, manifest } = await buildExport(records, '0.24.0', now);
  const files = readZip(zip);
  a.deepEqual(
    [...files.keys()],
    ['manifest.json', 'README_APPLY.md', 'cards/C01/character.png', 'cards/C12/background.jpg'],
  );
  const m = JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  a.deepEqual(m, JSON.parse(JSON.stringify(manifest)));
  a.equal(m.format, EXPORT_FORMAT);
  a.equal(m.version, 2);
  a.equal(m.schemaVersion, 2);
  a.equal(m.gameVersion, '0.24.0');
  const [c01, c12] = m.modules.characters.cards;
  a.equal(c01.characterId, 'C01');
  a.equal(c01.displayNameOverride, '카드 녹스');
  a.equal(c01.backgroundImage, null, '그림 없음도 상태로 남김');
  a.equal(c01.characterImage.sha256, createHash('sha256').update(png).digest('hex'));
  a.deepEqual([...files.get('cards/C01/character.png')], [...png]);
  a.equal(c12.displayNameOverride, null);
  a.equal(c12.backgroundImage.format, 'jpeg');
  a.equal(m.modules.characters.cards.length, 2);
  a.equal(c01.thumbnailImage, null);
  a.equal(c01.stats, null, '능력치를 안 바꿨으면 null');
  const guide = new TextDecoder().decode(files.get('README_APPLY.md'));
  for (const path of [
    'src/ui/art/card-art.generated.ts',
    'src/core/data/unit-stat-overrides.generated.js',
    'public/assets/cards/<id>/',
    'tools/import-admin-export.py',
  ])
    a(guide.includes(path), path);
  a(guide.includes('대화창에 첨부') && guide.includes('반영되지 않습니다'));
  // 없는 캐릭터 ID는 내보내지 않고 알린다
  await a.rejects(buildExport([{ ...S.emptySettings('X99'), displayNameOverride: '무시' }], 't'));
  a.equal(exportFileName(now), 'autochess-admin-export-20261124-0905.zip');
});

test('반영본 등록표: 캐릭터 ID·배포 파일·해시 형식이 맞다(비어 있어도 됨)', () => {
  for (const [id, e] of Object.entries(bakedCardArt)) {
    a(S.isCharacterId(id), id);
    if (e.displayName) a([...e.displayName].length <= S.limits.nameMax, id);
    for (const slot of ['background', 'character', 'thumbnail']) {
      const im = e[slot];
      if (!im) continue;
      a(fs.existsSync('public/' + im.src), im.src);
      a(
        im.sha256.length === 2 && im.sha256.every((h) => /^[0-9a-f]{64}$/.test(h)),
        `${id} ${slot}`,
      );
      a.equal(
        createHash('sha256')
          .update(fs.readFileSync('public/' + im.src))
          .digest('hex'),
        im.sha256[1],
        `${id} ${slot} 배포본 해시`,
      );
    }
  }
});
