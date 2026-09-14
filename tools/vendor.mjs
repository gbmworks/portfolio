/* ------------------------------------------------------------------
   Pull three.js into the repo, so the site has no second origin.

   Every page used to open `three` and `three/addons/` at
   cdn.jsdelivr.net.  That is 209 KB and fourteen requests on a domain
   the site does not control, discovered only *after* the import map has
   been parsed — so on a phone it lands in series behind everything
   else.  Measured before this existed: first contentful paint 4.0s on
   a throttled 4G phone, against 0.9s on desktop.

   It was also the hole the boot guard was written for.  A blocked or
   slow CDN is the one failure that takes every page down at once, and
   `js/boot.js` has a seven-second fallback in it for exactly that.
   Self-hosting does not make the guard redundant — it makes the case it
   defends against much rarer.

   This is a generator, like allocate.mjs and sitemap.mjs: run it, and
   `vendor/three/` is whatever the pin says it should be.  Do not edit
   anything under vendor/ by hand — this overwrites it.

       node tools/vendor.mjs            # fetch at the pinned version
       node tools/vendor.mjs --check    # verify, write nothing, exit 1 on drift

   Raising the version is a one-line edit here plus a re-run, and then
   the boot check in NOTES over all five shells.  The mirror keeps
   three's own directory layout, so an addon's relative imports of its
   siblings resolve without rewriting a single line of upstream source.
   ------------------------------------------------------------------ */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, posix } from 'node:path';

const PIN = '0.169.0';
const CDN = `https://cdn.jsdelivr.net/npm/three@${PIN}/`;
const OUT = 'vendor/three/';

/* What the site actually opens.  `stage.js` imports the four
   postprocessing passes, `props.js` the GLTF loader, `hdri.js` the RGBE
   one; everything under them is discovered by following imports rather
   than listed here, because a hand-kept list of a library's internals
   is a list that goes stale on the next version bump. */
const ENTRIES = [
  'build/three.module.min.js',
  'examples/jsm/loaders/GLTFLoader.js',
  'examples/jsm/loaders/RGBELoader.js',
  'examples/jsm/postprocessing/EffectComposer.js',
  'examples/jsm/postprocessing/RenderPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js',
  'examples/jsm/postprocessing/OutputPass.js',
];

/* `from './x.js'`, `import './x.js'`, `import('./x.js')` — relative
   only.  A bare `three` is left alone: the import map answers it, and
   rewriting it to a path would defeat the map's whole purpose. */
const REL = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;

const check = process.argv.includes('--check');
const seen = new Map();
const queue = [...ENTRIES];
let fetched = 0;

while (queue.length) {
  const path = queue.shift();
  if (seen.has(path)) continue;

  const res = await fetch(CDN + path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  const src = await res.text();
  seen.set(path, src);
  fetched++;

  for (const [, rel] of src.matchAll(REL)) {
    const next = posix.normalize(posix.join(posix.dirname(path), rel));
    if (!seen.has(next)) queue.push(next);
  }
}

let drift = 0;
for (const [path, src] of seen) {
  const dest = OUT + path;
  const current = existsSync(dest) ? await readFile(dest, 'utf8') : null;
  if (current === src) continue;
  drift++;
  if (check) { console.log('DRIFT', dest); continue; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, src);
}

const bytes = [...seen.values()].reduce((a, s) => a + Buffer.byteLength(s), 0);
console.log(`three@${PIN}: ${fetched} files, ${(bytes / 1024).toFixed(1)} KB`);

if (check) {
  console.log(drift ? `${drift} file(s) differ from the pin` : 'vendor/ matches the pin');
  process.exit(drift ? 1 : 0);
}
console.log(drift ? `wrote ${drift} file(s) to ${OUT}` : `${OUT} was already current`);
