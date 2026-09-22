/* ------------------------------------------------------------------
   Assemble the deployable Eyewear Builder.

     node deploy.mjs          copy the built app into ../../studio/eyewear
     npm run deploy           build first, then the same thing

   This folder is a working copy, not a deployable one. `dist/` is what
   Vite writes and `node_modules/` is what it writes it from; neither is
   tracked. What ships is a trimmed copy of `dist/` under
   `studio/eyewear/`, and THAT is what is in git — the same split as
   content/Unicorn -> game/unicorn and content/Fitmint -> studio/fitmint.

   Two things are checked rather than assumed.

   1. **The build is relocatable.** `vite.config.ts` sets `base: './'`
      and every runtime asset is fetched through
      `import.meta.env.BASE_URL`, so the app runs from any folder. If a
      build ever emits a root-absolute `/assets/...` the app would 404
      under /studio/eyewear/, so index.html is read and refused here.

   2. **The MediaPipe runtime is trimmed, on evidence.** `sync-wasm.mjs`
      copies all six files out of the package — 33.8 MB. Only four can
      ever be fetched: `FilesetResolver.forVisionTasks(path)` builds its
      filename as

        `${path}/vision_wasm${_module?}${_nosimd?}_internal.js`

      and `_module` is only reached when its second argument is true.
      `src/face/landmarker.ts` calls it with one argument, so the
      `vision_wasm_module_internal` pair (12.1 MB) is never asked for.
      It is dropped. `nosimd` stays — it is the real fallback for a
      browser without WebAssembly SIMD.

      That call is checked below rather than trusted, because the day
      somebody passes `true` this trim turns into a 404 halfway through
      a face scan.
   ------------------------------------------------------------------ */

import { cp, mkdir, readdir, readFile, stat, rm, access } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FROM = join(here, 'dist');
const TO = join(here, '..', '..', 'studio', 'eyewear');

/* The wasm pair that forVisionTasks can never name — see the header. */
const DROP = ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm'];

const exists = (p) => access(p).then(() => true, () => false);

async function size(p) {
  const s = await stat(p);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(p, { withFileTypes: true })) total += await size(join(p, e.name));
  return total;
}

const mb = (n) => (n / 1048576).toFixed(1).padStart(6) + ' MB';

/* --- is there a build to ship? ------------------------------------- */

if (!(await exists(join(FROM, 'index.html')))) {
  console.error('\nNo dist/index.html — nothing to deploy.');
  console.error('Run `npm run build` first.\n');
  process.exit(1);
}

/* --- refuse a build that is pinned to a host root ------------------ */

const html = await readFile(join(FROM, 'index.html'), 'utf8');
const absolute = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
if (absolute.length) {
  console.error('\ndist/index.html asks for root-absolute paths:\n  ' + absolute.join('\n  '));
  console.error('\nThese 404 under /studio/eyewear/. Is `base` still \'./\' in vite.config.ts?\n');
  process.exit(1);
}

/* --- refuse a trim that the source has outgrown -------------------- */

const landmarker = await readFile(join(here, 'src', 'face', 'landmarker.ts'), 'utf8');
const call = landmarker.match(/forVisionTasks\(([^)]*)\)/);
if (!call) {
  console.error('\nCould not find the forVisionTasks call in src/face/landmarker.ts.');
  console.error('The wasm trim below is justified by its arguments. Re-read it.\n');
  process.exit(1);
}
if (call[1].includes(',')) {
  console.error(`\nforVisionTasks is called with more than one argument:\n  ${call[0]}`);
  console.error('\nA second argument of `true` asks for the vision_wasm_module_internal');
  console.error('pair, which this script drops. Remove it from DROP or drop the flag.\n');
  process.exit(1);
}

/* --- copy ---------------------------------------------------------- */

/* Clear first, so a renamed hashed chunk does not leave its predecessor
   behind to be deployed forever. */
await rm(TO, { recursive: true, force: true });
await mkdir(TO, { recursive: true });
await cp(FROM, TO, {
  recursive: true,
  filter: (src) => !DROP.includes(relative(FROM, src).split(/[\\/]/).pop()),
});

/* --- check the copy, not just the source --------------------------- */

/* Everything the app fetches at runtime by a path it builds itself —
   these never appear in index.html, so a missing one is only found by
   a click. Kept in step with the BASE_URL reads in src/. */
const RUNTIME = [
  'index.html',
  'materials.csv',
  'frames/final.glb',
  'hdri/empty_warehouse_01.hdr',
  'models/face_landmarker.task',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js',
  'wasm/vision_wasm_nosimd_internal.wasm',
];

const short = [];
for (const f of RUNTIME) if (!(await exists(join(TO, f)))) short.push(f);
if (short.length) {
  console.error('\nCopied, but these did not arrive:\n  ' + short.join('\n  ') + '\n');
  process.exit(1);
}

for (const f of DROP) {
  if (await exists(join(TO, 'wasm', f))) {
    console.error(`\n${f} was supposed to be dropped and is still there.\n`);
    process.exit(1);
  }
}

/* --- report -------------------------------------------------------- */

console.log('\nstudio/eyewear —');
for (const e of await readdir(TO, { withFileTypes: true })) {
  console.log(`  ${e.name.padEnd(16)} ${mb(await size(join(TO, e.name)))}`);
}
console.log(`  ${'total'.padEnd(16)} ${mb(await size(TO))}`);
console.log(`  ${RUNTIME.length} runtime paths checked, all present`);
console.log(`  ${DROP.length} unused wasm files dropped\n`);
