// v0.26.1 내보내기 용량: 그림을 게임 크기로 줄여 담고(encode), 한 파일이 한도를 넘으면 캐릭터 단위로 나눈다.
// 실제 브라우저 압축(compressForExport)과 여러 파일 내려받기·가져오기는 브라우저와 도구로 확인했다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import S from '../../src/core/card-settings.ts';
import { buildExportParts, exportFileName } from '../../src/ui/adminExport.ts';

const big = (n, seed) => {
  const b = new Uint8Array(n).map((_, i) => (i * seed) & 255);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
};
const img = (bytes) => ({
  blob: new Blob([bytes]),
  format: 'png',
  name: 'x.png',
  size: bytes.length,
  width: 2000,
  height: 3000,
});

test('한도를 넘으면 캐릭터 단위로 여러 파일, 파일마다 manifest·README·part 표시, 한 캐릭터는 한 파일에만', async () => {
  const MB = 1024 * 1024;
  const recs = ['C01', 'C02', 'C03'].map((id, i) => ({
    ...S.emptySettings(id),
    characterImage: img(big(3 * MB, i + 3)),
    backgroundImage: img(big(2 * MB, i + 7)),
  }));
  const now = new Date(2026, 10, 26, 10, 0);
  const { parts, manifest, sourceBytes } = await buildExportParts(recs, 't', {
    now,
    maxPartBytes: 6 * MB,
  });
  a.equal(sourceBytes, 15 * MB);
  a.equal(parts.length, 3);
  a.deepEqual(
    parts.map((p) => p.manifest.modules.characters.cards.map((c) => c.characterId)),
    [['C01'], ['C02'], ['C03']],
  );
  for (const [i, p] of parts.entries()) {
    a.deepEqual(p.manifest.part, { index: i + 1, total: 3 });
    a(p.zip.length < 6 * MB);
    const text = new TextDecoder('latin1').decode(p.zip.subarray(0, 4096));
    a(text.includes('manifest.json'));
  }
  a.equal(manifest.modules.characters.cards.length, 3, '전체 요약');
  a.equal(
    exportFileName(now, { index: 2, total: 3 }),
    'autochess-admin-export-20261126-1000-part2of3.zip',
  );
  const one = await buildExportParts(recs, 't', { now, maxPartBytes: 100 * MB });
  a.equal(one.parts.length, 1);
  a.equal(one.parts[0].manifest.part, undefined, '나누지 않으면 part 없음');
});

test('줄여 담기(encode): 보낸 파일의 sha256과 브라우저 원본의 sourceSha256을 함께 적는다', async () => {
  const original = big(5000, 3);
  const small = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);
  const { parts } = await buildExportParts(
    [
      {
        ...S.emptySettings('C05'),
        characterImage: img(original),
        nameplateImage: img(big(100, 5)),
      },
    ],
    't',
    {
      encode: async (slot, im) =>
        slot === 'character'
          ? {
              ...im,
              blob: new Blob([small]),
              format: 'webp',
              size: small.length,
              width: 1365,
              height: 2048,
            }
          : im,
    },
  );
  const c = parts[0].manifest.modules.characters.cards[0];
  const hex = (b) => createHash('sha256').update(b).digest('hex');
  a.equal(c.characterImage.file, 'cards/C05/character.webp');
  a.equal(c.characterImage.sha256, hex(small));
  a.equal(c.characterImage.sourceSha256, hex(original));
  a.deepEqual([c.characterImage.width, c.characterImage.height], [1365, 2048]);
  a.equal(c.nameplateImage.sourceSha256, undefined, '바꾸지 않은 그림은 원본 해시만');
});

test('브라우저 압축 규칙과 가져오기 도구: 캐릭터·배경 2048px·썸네일 1024px·WebP 0.92, 프레임·이름표는 2MB까지 원본, 여러 ZIP·sourceSha256', () => {
  const enc = fs.readFileSync('src/ui/imageEncode.ts', 'utf8');
  for (const s of [
    'character: 2048',
    'background: 2048',
    'thumbnail: 1024',
    'quality: 0.92',
    'keepOriginalUpTo: 2 * 1024 * 1024',
  ])
    a(enc.includes(s), s);
  const tool = fs.readFileSync('tools/import-admin-export.py', 'utf8');
  a(tool.includes('for path in args:') && tool.includes("img.get('sourceSha256')"));
});
