/**
 * Static file server for Avatar Studio.
 *
 * ES modules and GLB fetches need a real HTTP origin, so the page cannot be
 * opened straight off the filesystem.  `node serve.mjs [port]`
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const target = path.join(ROOT, url === '/' ? 'index.html' : url);

  // Never serve anything above the app directory.
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    // Revalidate everything: this server is for development, where assets are
    // regenerated in place. A CDN should fingerprint and cache them instead.
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache',
      'last-modified': stat.mtime.toUTCString(),
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Fitmint Avatar Studio  ->  http://localhost:${PORT}`);
});
