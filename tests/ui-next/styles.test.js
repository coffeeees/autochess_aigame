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
