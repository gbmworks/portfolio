/* ------------------------------------------------------------------
   Assemble the deployable Avatar Studio.

     node deploy.mjs          copy the shipped files into ../../../studio/fitmint
     npm run deploy           the same thing

   This folder is a working copy, not a deployable one. `assets/items/`
   is the 59 MB intermediate from build stage 1 — FBX converted to GLB,
   before textures are WebP'd and geometry is meshopt'd — and nothing at
   runtime reads a byte of it. `tools/node_modules/` is the build's own
   dependencies. Both stay here.

   What ships is index.html, src/, vendor/ and four of the five asset
   folders: opt (the models the app loads), tex (skin and iris maps),
   thumbs (the wardrobe grid) and env (the measured HDRI).

   The guard is derived rather than hand-written. Every `assets/...`
   path in the source — the generated catalog.js, environments.js and
   the preload in index.html — is collected and checked against what is
   actually on disk before anything is copied, so a catalog row whose
   asset was never built fails here rather than 404ing under somebody's
   click. (The build already reports Beard07 and Beard08 as CSV rows
   with no mesh; those carry no asset path, so they never reach this.)

   The same split as content/Unicorn -> game/unicorn, and assets/media
   -> assets/web: heavy source on this machine, the web-sized copy in
   git.
   ------------------------------------------------------------------ */

import { cp, mkdir, readdir, readFile, stat, rm, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TO = join(here, '..', '..', '..', 'studio', 'fitmint');

/* copied whole — every file in each of these is loaded at runtime */
const FOLDERS = ['src', 'vendor', 'assets/opt', 'assets/tex', 'assets/thumbs', 'assets/env'];

/* authored here, served as they are */
const FILES = ['index.html'];

/* the source files that name an asset: two generated, one authored */
const MANIFESTS = ['src/catalog.js', 'src/environments.js', 'index.html'];

const exists = (p) => access(p).then(() => true, () => false);

async function size(p) {
  const s = await stat(p);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(p, { withFileTypes: true })) total += await size(join(p, e.name));
  return total;
}

const mb = (n) => (n / 1048576).toFixed(1).padStart(6) + ' MB';

/* --- what does the app actually ask for? --------------------------- */

/* `assets/opt/Male.glb?v=1789107982156` -> `assets/opt/Male.glb`.
   The ?v= is the file's mtime, baked in at build time so a host can
   cache hard and a rebuild still reaches the browser. */
const wanted = new Set();
for (const m of MANIFESTS) {
  const text = await readFile(join(here, m), 'utf8');
  for (const [, path] of text.matchAll(/["'`](assets\/[^"'`?]+)/g)) wanted.add(path);
}

/* --- check before writing anything --------------------------------- */

const missing = [];
for (const f of [...FILES, ...FOLDERS, ...wanted]) {
  if (!(await exists(join(here, f)))) missing.push(f);
}

if (missing.length) {
  console.error('\nMissing from the working copy:\n  ' + missing.join('\n  '));
  console.error('\nNothing copied. The studio would 404 on these.');
  console.error('Run `npm run build` (or `npm run build:fast`) first.\n');
  process.exit(1);
}

/* --- copy ---------------------------------------------------------- */

/* Clear the asset folders first so a renamed texture does not leave its
   old file behind to be deployed forever. src/ and vendor/ are small
   and fully overwritten, but the same argument applies to a renamed
   module, so they go too. */
await rm(TO, { recursive: true, force: true });
await mkdir(join(TO, 'assets'), { recursive: true });

for (const f of FILES) await cp(join(here, f), join(TO, f));
for (const d of FOLDERS) await cp(join(here, d), join(TO, d), { recursive: true });

/* --- and check the copy, not just the source ----------------------- */

const short = [];
for (const f of wanted) if (!(await exists(join(TO, f)))) short.push(f);
if (short.length) {
  console.error('\nCopied, but these did not arrive:\n  ' + short.join('\n  ') + '\n');
  process.exit(1);
}

/* --- report -------------------------------------------------------- */

console.log('\nstudio/fitmint —');
for (const r of [...FILES, ...FOLDERS]) console.log(`  ${r.padEnd(16)} ${mb(await size(join(TO, r)))}`);
console.log(`  ${'total'.padEnd(16)} ${mb(await size(TO))}`);
console.log(`  ${wanted.size} asset paths in the catalog, all present\n`);
