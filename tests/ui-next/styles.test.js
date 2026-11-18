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

// v0.17.1: 게임 화면(.screen)은 HUD·전장·대기석 3행 격자다. 그 직속 자식으로 그려지는 연출·창의 최상위 상자가
// 격자 칸을 차지하면 암묵적인 행과 간격이 생겨 전장이 줄고 대기석이 올라간다(합성 연출 중 레이아웃 변형 버그).
test('게임 화면 격자의 직속 연출·창은 격자 칸을 차지하지 않는다(position: fixed 또는 display: contents)', () => {
  const rule = (file, cls) => {
    const css = fs.readFileSync(`src/ui/components/${file}`, 'utf8');
    const m = css.match(new RegExp(`(^|\\n)\\.${cls} \\{([^}]*)\\}`));
    a(m, `${file} .${cls}`);
    return m[2];
  };
  const overlays = [
    ['ScreenCues.module.css', ['mergeLayer', 'stage', 'round', 'impact']],
    ['DragLayer.module.css', ['sellZone', 'ghost']],
    ['UnitDetail.module.css', ['popover']],
    ['Modals.module.css', ['backdrop']],
  ];
  for (const [file, classes] of overlays)
    for (const cls of classes) {
      const body = rule(file, cls);
      a(/position:\s*fixed|display:\s*contents/.test(body), `${file} .${cls}`);
    }
  // 합성 연출 묶음은 mergeLayer(상자 없음)로 감싼다
  a(
    fs
      .readFileSync('src/ui/components/ScreenCues.tsx', 'utf8')
      .includes('class={styles.mergeLayer}'),
  );
});
