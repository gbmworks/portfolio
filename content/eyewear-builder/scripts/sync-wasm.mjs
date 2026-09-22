/**
 * Copy MediaPipe's wasm runtime into `public/wasm/`.
 *
 * The runtime has to be served from our own origin rather than a CDN -- the
 * scan runs entirely on the customer's machine, and pulling the tracker off
 * someone else's server would quietly undo that. But it is 34 MB, it is a
 * byte-for-byte copy of a published npm package, and a copy checked into git
 * silently goes stale the moment the dependency is bumped.
 *
 * So it is generated instead, from whatever version is installed, and
 * `public/wasm/` is gitignored. Runs automatically before `dev` and `build`.
 */

import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'wasm');

if (!existsSync(from)) {
  console.error(
    `[wasm] ${from} is missing.\n` +
      '       Run `npm install` first -- the runtime is copied out of the ' +
      '@mediapipe/tasks-vision package, not downloaded.',
  );
  process.exit(1);
}

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });

const files = await readdir(to);
let bytes = 0;
for (const file of files) bytes += (await stat(join(to, file))).size;
console.log(`[wasm] ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB -> public/wasm/`);
