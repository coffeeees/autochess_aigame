// 5단계 규칙: 새 UI의 CSS는 !important로 규칙을 강제하지 않는다.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('src/ui 스타일에 !important가 없다', () => {
  const css = files('src/ui').filter((f) => f.endsWith('.css'));
  a(css.length > 0);
  for (const f of css) a(!fs.readFileSync(f, 'utf8').includes('!important'), f);
});

test('글꼴 부분 집합: 소스에 쓰인 글자가 모두 담겨 있다(새 글자를 쓰면 tools/subset-font.py 다시 실행)', () => {
  const { chars, fallback } = JSON.parse(fs.readFileSync('docs/specs/font-subset.json', 'utf8'));
  const known = new Set([...chars, ...fallback]);
  const files = ['index.html'];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|css|html|json)$/.test(e.name)) files.push(p);
    }
  };
  walk('src');
  const missing = new Set();
  for (const f of files)
    for (const c of fs.readFileSync(f, 'utf8'))
      if (c.codePointAt(0) > 0x7e && !/\s/.test(c) && !known.has(c)) missing.add(c);
  a.deepEqual([...missing], []);
  const woff2 = fs.readFileSync('public/assets/fonts/pretendard-subset.woff2');
  a.equal(woff2.subarray(0, 4).toString('latin1'), 'wOF2');
  a(woff2.length < 600 * 1024, '600KB 미만');
});
