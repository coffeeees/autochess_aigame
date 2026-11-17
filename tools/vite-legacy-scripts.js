// src/legacy/의 기존 화면 스크립트를 그대로 제공·출력한다.
//
// 기존 화면은 전역을 공유하는 일반 스크립트들이라 legacy.html의 <script defer> 순서대로
// 불러와야 한다. 이 플러그인은 그 실행 구조를 그대로 유지한다:
//   - 개발: GET /<이름>.js 요청에 src/legacy/<이름>.js를 돌려주고, 파일을 고치면
//           페이지 전체를 새로고침한다
//   - 빌드: src/legacy/*.js를 모두 같은 이름으로 출력 폴더 최상위(legacy.html 옆)에 복사한다
import fs from 'node:fs';
import path from 'node:path';

export default function legacyScripts({ dir }) {
  const root = path.resolve(dir);
  const list = () => fs.readdirSync(root).filter((f) => f.endsWith('.js'));
  const fileFor = (url) => {
    const name = decodeURIComponent((url || '').split('?')[0]).replace(/^\//, '');
    if (!/^[\w.-]+\.js$/.test(name)) return null;
    const file = path.join(root, name);
    return fs.existsSync(file) ? file : null;
  };
  return {
    name: 'autochess-legacy-scripts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = fileFor(req.url);
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(fs.readFileSync(file));
      });
      server.watcher.add(root);
      server.watcher.on('change', (file) => {
        if (path.resolve(file).startsWith(root + path.sep)) server.ws.send({ type: 'full-reload' });
      });
    },
    generateBundle() {
      for (const name of list()) {
        this.emitFile({
          type: 'asset',
          fileName: name,
          source: fs.readFileSync(path.join(root, name), 'utf8'),
        });
      }
    },
  };
}
