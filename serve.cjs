const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');
http
  .createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(__dirname, 'dist', name === '/' ? 'index.html' : name);
    if (!file.startsWith(path.join(__dirname, 'dist') + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        'Content-Type',
        {
          html: 'text/html; charset=utf-8',
          js: 'text/javascript; charset=utf-8',
          css: 'text/css; charset=utf-8',
          webp: 'image/webp',
          png: 'image/png',
          woff2: 'font/woff2',
          ttf: 'font/ttf',
        }[file.split('.').pop()] || 'application/octet-stream',
      );
      res.end(data);
    });
  })
  .listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
