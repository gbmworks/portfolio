/* ------------------------------------------------------------------
   Assemble the deployable game.

     node deploy.mjs          copy the shipped files into ../../game/unicorn
     npm run deploy           webpack --mode production, then this

   dist/ is the working folder: it holds every model that was ever in the
   project, including the ones the game does not load — Crystalverse.gltf
   (16 MB), mapTrees.glb (11 MB), Unicorn4.gltf, mushroom1.glb and the
   leftovers from the navmesh example this was built on. Together those are
   40 of its 59 MB, and no browser has ever requested one of them.

   So this file, not a recursive copy, is what decides what ships. MODELS is
   the list the game actually loads — grep any name here and you will find
   the loader call in src/index.ts. Adding a model to the game means adding
   its filename here too, and deploy refuses to run if one is missing rather
   than shipping a folder that 404s halfway through the first level.

   Everything else is copied whole because every file in it is used: gemUI is
   the 2D art and the three Lottie animations, sounds is the four cues, video
   is the four character-select clips, draco is the decoder those compressed
   models need, favicon_io is the tab icon.

   The originals stay in dist/, untracked, the way assets/media does for the
   rest of the site: heavy source on this machine, the web-sized copy in git.
   ------------------------------------------------------------------ */

import { cp, mkdir, readdir, stat, rm, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FROM = join(here, "dist");
const TO = join(here, "..", "..", "game", "unicorn");

/* the models the game loads, and nothing else */
const MODELS = [
  "crystalverse.glb", //  the island
  "paths.glb", //  the navmesh three-pathfinding walks
  "trees.glb",
  "crystals.glb",
  "clouds.glb",
  "pot.glb", //  where the gems go back
  "gem.glb",
  "gemVfx.glb",
  "animated.glb", //  the gem's pickup effect
  "unicorn1.glb", //  Jade, Pearl, Topaz, Opal
  "unicorn2.glb",
  "unicorn3.glb",
  "unicorn4.glb",
  "sky.jpg",
  "envMap.jpg",
  ...["red", "orange", "yellow", "green", "blue", "indigo", "violet"].map((c) => `rainbow/${c}.glb`),
];

/* copied whole */
const FOLDERS = ["gemUI", "sounds", "video", "draco", "favicon_io"];

/* authored here, served as they are */
const FILES = ["index.html", "style.css"];

const exists = (p) =>
  access(p).then(
    () => true,
    () => false
  );

/* --- check before writing anything --------------------------------- */

const missing = [];
for (const f of [...FILES, ...FOLDERS, ...MODELS.map((m) => `models/${m}`)]) {
  if (!(await exists(join(FROM, f)))) missing.push(f);
}

if (missing.length) {
  console.error("\nMissing from dist/:\n  " + missing.join("\n  "));
  console.error("\nNothing copied. The game would 404 on these.\n");
  process.exit(1);
}

/* --- copy ---------------------------------------------------------- */

/* Clear the models folder first so a renamed model does not leave its old
   file behind to be deployed forever. The bundle and everything else is
   overwritten in place. */
await rm(join(TO, "models"), { recursive: true, force: true });
await mkdir(join(TO, "models", "rainbow"), { recursive: true });

for (const f of FILES) await cp(join(FROM, f), join(TO, f));
for (const d of FOLDERS) await cp(join(FROM, d), join(TO, d), { recursive: true });
for (const m of MODELS) await cp(join(FROM, "models", m), join(TO, "models", m));

/* --- report -------------------------------------------------------- */

async function size(p) {
  const s = await stat(p);
  if (!s.isDirectory()) return s.size;
  let total = 0;
  for (const e of await readdir(p, { withFileTypes: true })) total += await size(join(p, e.name));
  return total;
}

const mb = (n) => (n / 1048576).toFixed(1).padStart(5) + " MB";
const rows = [...FILES, ...FOLDERS, "models", "index.js"];

console.log("\ngame/unicorn —");
for (const r of rows) {
  if (!(await exists(join(TO, r)))) {
    console.log(`  ${r.padEnd(12)} ${"—".padStart(8)}  not built yet: npm run deploy`);
    continue;
  }
  console.log(`  ${r.padEnd(12)} ${mb(await size(join(TO, r)))}`);
}
console.log(`  ${"total".padEnd(12)} ${mb(await size(TO))}\n`);
