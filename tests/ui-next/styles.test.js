// Stage 5 rule: the rebuilt UI's CSS never forces rules with !important.
import { test } from 'vitest';
import a from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('no !important in src/ui styles', () => {
  const css = files('src/ui').filter((f) => f.endsWith('.css'));
  a(css.length > 0);
  for (const f of css) a(!fs.readFileSync(f, 'utf8').includes('!important'), f);
});
