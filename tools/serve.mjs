/* ------------------------------------------------------------------
   The development server.

     node tools/serve.mjs          → http://127.0.0.1:8123

   `python -m http.server` works too, and that is what the README used
   to say — but it sends no Cache-Control header at all, so Chrome falls
   back to heuristic caching and holds on to ES modules and stylesheets
   hard.  Editing js/env/themes.js and reloading would keep running the
   version from ten minutes ago, which looks exactly like the edit not
   having worked.

   This server sends `Cache-Control: no-store` on everything.  Nothing is
   ever cached, every reload is honest, and there is no hard-reload
   dance.  It is a development server: it does that precisely because it
   is the wrong thing to do in production, where GitHub Pages sets
   sensible caching for you.

   No dependencies — node's own http and fs.
   ------------------------------------------------------------------ */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const PORT = Number(process.argv[2]) || 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.hdr': 'image/vnd.radiance',
  '.woff2': 'font/woff2',
  /* Without this the CV falls through to application/octet-stream and
     the browser saves it instead of opening it — which makes the two
     resume actions look identical locally and different in production,
     where Pages sends application/pdf. */
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const server = createServer((req, res) => {
  /* strip the query string — cache busters like ?fresh=1 are not paths */
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  /* never let a path climb out of the repo */
  const file = join(ROOT, normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  let stat;
  try {
    stat = statSync(file);
    if (stat.isDirectory()) throw new Error('dir');
  } catch {
    /* the same 404 page the host serves, so it can be tested locally */
    res.writeHead(404, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    createReadStream(join(ROOT, '404.html')).on('error', () => res.end('Not found')).pipe(res);
    return;
  }

  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';

  /* Range support, because a <video> always asks for one.  Without it a
     clip can stall at readyState 0 instead of painting a poster frame. */
  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = s ? Number(s) : 0;
    const end = e ? Math.min(Number(e), stat.size - 1) : stat.size - 1;
    if (start <= end) {
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Cache-Control': 'no-store'
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    /* the whole point of this file */
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT}`);
  console.log(`  http://127.0.0.1:${PORT}   — Cache-Control: no-store, Range supported`);
});
