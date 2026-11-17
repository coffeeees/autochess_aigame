// Serves and emits the pre-module game scripts in src/legacy/ unchanged.
//
// The v0.15.18 game is ~40 classic scripts that share globals and must load in
// the order of the <script defer> tags in index.html; the combat worker loads the
// logic files with importScripts() by bare file name. Until stage 3 turns them
// into ES modules, this plugin keeps that exact runtime layout:
//   - dev:   GET /<name>.js is answered from src/legacy/<name>.js, and editing a
//            legacy file triggers a full page reload
//   - build: every src/legacy/*.js file is copied to the output root under the
//            same name, next to index.html
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
