/**
 * Full asset pipeline: source art -> everything the browser loads.
 *
 *   node tools/build.mjs [--skip-convert] [--skip-thumbs]
 *
 * Stages
 *   1. convert   Blender: each wardrobe FBX -> GLB with rebuilt PBR materials
 *   2. optimize  textures -> WebP (sharp), geometry/animation -> meshopt
 *   3. textures  skin tone chips and iris thumbnails
 *   4. thumbs    Blender: a 320px render per wardrobe item -> WebP
 *   5. hdri      Blender: source .exr -> 512x256 .hdr + an analysis probe
 *   6. env       measures each HDRI -> src/environments.js
 *   7. catalog   src/catalog.js, generated from "Fitmint - Male.csv"
 *
 * Blender is only needed for stages 1, 4 and 5; pass the skip flags to re-run
 * the cheap stages against assets that are already converted.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.resolve(ROOT, '..', 'Male');
const ITEMS = path.join(ROOT, 'assets', 'items');
const OPT = path.join(ROOT, 'assets', 'opt');
const THUMBS = path.join(ROOT, 'assets', 'thumbs');
const ENV = path.join(ROOT, 'assets', 'env');
const HDRI_SRC = path.resolve(ROOT, '..', 'hdri');
const TEX = path.join(ROOT, 'assets', 'tex');

const args = new Set(process.argv.slice(2));
const MAX_TEX = 1024;

const BLENDER_CANDIDATES = [
  process.env.BLENDER,
  'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe',
  'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  'blender',
].filter(Boolean);

const blender = BLENDER_CANDIDATES.find((p) => p === 'blender' || fs.existsSync(p));
const GLTF_TRANSFORM = path.join(HERE, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

const run = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, { stdio: 'inherit', cwd: HERE, ...opts });

const step = (n, name) => console.log(`\n[${n}/7] ${name}`);

const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
      )
    : [];

const bytes = (dir, ext) =>
  walk(dir).filter((f) => f.endsWith(ext)).reduce((n, f) => n + fs.statSync(f).size, 0);

// ------------------------------------------------------------------ 1. convert

if (!args.has('--skip-convert')) {
  step(1, 'Converting wardrobe FBX to GLB (Blender)');
  if (!blender) throw new Error('Blender not found; set BLENDER=/path/to/blender');
  run(blender, ['-b', '--factory-startup', '-P', 'convert_fbx.py', '--', SRC, ITEMS], { stdio: 'pipe' });
  fs.copyFileSync(path.join(SRC, 'Male.glb'), path.join(ITEMS, 'Male.glb'));
  // The overalls ship as finished GLBs beside their FBX; convert_fbx.py skips
  // those and this picks them up instead.
  run(process.execPath, ['build_overalls.mjs'], { stdio: 'inherit' });
  console.log(`   ${walk(ITEMS).filter((f) => f.endsWith('.glb')).length} GLB written`);
} else {
  step(1, 'Converting wardrobe FBX to GLB (skipped)');
}

// ----------------------------------------------------------------- 2. optimize

step(2, 'Compressing textures and geometry');
const before = bytes(ITEMS, '.glb');
fs.rmSync(OPT, { recursive: true, force: true });
const tmp = path.join(ROOT, 'assets', '.tmp');
fs.rmSync(tmp, { recursive: true, force: true });

for (const file of walk(ITEMS).filter((f) => f.endsWith('.glb')).sort()) {
  const rel = path.relative(ITEMS, file);
  const staged = path.join(tmp, rel);
  const out = path.join(OPT, rel);
  fs.mkdirSync(path.dirname(staged), { recursive: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });

  run(process.execPath, ['textures_webp.js', file, staged, String(MAX_TEX)], { stdio: 'pipe' });
  // Call the CLI's entry script directly: no shell, so paths with spaces are safe.
  run(process.execPath, [GLTF_TRANSFORM, 'optimize', staged, out,
    '--flatten', 'false', '--join', 'false', '--instance', 'false', '--palette', 'false',
    '--simplify', 'false', '--compress', 'meshopt', '--meshopt-level', 'high',
    '--texture-compress', 'false'], { stdio: 'pipe' });
}
fs.rmSync(tmp, { recursive: true, force: true });
const after = bytes(OPT, '.glb');
console.log(`   ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB`);

// ----------------------------------------------------------------- 3. textures

step(3, 'Building skin and eye textures');
fs.mkdirSync(path.join(TEX, 'skin'), { recursive: true });
fs.mkdirSync(path.join(TEX, 'eye'), { recursive: true });

for (let i = 1; i <= 6; i++) {
  const skin = path.join(SRC, 'Skin', `maleTexture_${i}.jpg`);
  const eye = path.join(SRC, 'Eye', `eye_${i}.jpg`);

  await sharp(skin).toColourspace('srgb').resize({ width: MAX_TEX, height: MAX_TEX, fit: 'inside' })
    .webp({ quality: 86, effort: 5 }).toFile(path.join(TEX, 'skin', `maleTexture_${i}.webp`));
  await sharp(eye).toColourspace('srgb').resize({ width: 512, height: 512, fit: 'inside' })
    .webp({ quality: 88, effort: 5 }).toFile(path.join(TEX, 'eye', `eye_${i}.webp`));

  // Skin chip: median of a clean cheek patch, rendered as a flat tone. A literal
  // crop of the UV sheet would show lips and empty eye sockets instead.
  const { data, info } = await sharp(skin)
    .extract({ left: 52, top: 96, width: 96, height: 96 }).raw().toBuffer({ resolveWithObject: true });
  const pixels = [];
  for (let p = 0; p < data.length; p += info.channels) {
    const rgb = [data[p], data[p + 1], data[p + 2]];
    if (rgb[0] + rgb[1] + rgb[2] > 120) pixels.push(rgb); // skip the black background
  }
  pixels.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const [r, g, b] = pixels[Math.floor(pixels.length / 2)];
  const lit = (c) => Math.min(255, Math.round(c * 1.09));
  const dim = (c) => Math.round(c * 0.86);
  const svg = `<svg width="128" height="128"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="rgb(${lit(r)},${lit(g)},${lit(b)})"/>
    <stop offset="1" stop-color="rgb(${dim(r)},${dim(g)},${dim(b)})"/>
    </linearGradient></defs><rect width="128" height="128" fill="url(#g)"/></svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 92 })
    .toFile(path.join(TEX, 'skin', `maleTexture_${i}.thumb.webp`));

  // Iris crop reads instantly; the full sheet is mostly sclera.
  await sharp(eye).extract({ left: 150, top: 128, width: 224, height: 224 })
    .resize(128, 128, { fit: 'cover' }).webp({ quality: 88 })
    .toFile(path.join(TEX, 'eye', `eye_${i}.thumb.webp`));
}
console.log('   24 files');

// ------------------------------------------------------------------- 4. thumbs

if (!args.has('--skip-thumbs')) {
  step(4, 'Rendering item thumbnails (Blender)');
  if (!blender) throw new Error('Blender not found; set BLENDER=/path/to/blender');
  run(blender, ['-b', '--factory-startup', '-P', 'render_thumbs.py', '--', ITEMS, THUMBS], { stdio: 'pipe' });
  let n = 0;
  for (const png of walk(THUMBS).filter((f) => f.endsWith('.png'))) {
    await sharp(png).resize(256, 256, { fit: 'inside' })
      .webp({ quality: 86, alphaQuality: 90, effort: 5 }).toFile(png.replace(/\.png$/, '.webp'));
    fs.unlinkSync(png);
    n++;
  }
  console.log(`   ${n} thumbnails`);
} else {
  step(4, 'Rendering item thumbnails (skipped)');
}

// --------------------------------------------------------------- 5 & 6. hdri

if (!args.has('--skip-hdri')) {
  step(5, 'Preparing HDRIs (Blender)');
  if (!blender) throw new Error('Blender not found; set BLENDER=/path/to/blender');
  if (!fs.existsSync(HDRI_SRC)) throw new Error(`No HDRI source folder at ${HDRI_SRC}`);
  run(blender, ['-b', '--factory-startup', '-P', 'build_hdri.py', '--', HDRI_SRC, ENV], { stdio: 'pipe' });
  console.log(`   ${(bytes(ENV, '.hdr') / 1048576).toFixed(2)} MB of .hdr`);

  step(6, 'Measuring lighting presets');
  run(process.execPath, ['build_env.mjs']);
  // The float probes are build-time only; nothing serves them.
  fs.rmSync(path.join(ENV, 'probe'), { recursive: true, force: true });
} else {
  step(5, 'Preparing HDRIs (skipped)');
  step(6, 'Measuring lighting presets (skipped)');
}

// ------------------------------------------------------------------ 7. catalog

step(7, 'Generating src/catalog.js');
run(process.execPath, ['build_catalog.mjs']);

const total = after + bytes(THUMBS, '.webp') + bytes(TEX, '.webp') + bytes(ENV, '.hdr') + bytes(ENV, '.webp');
console.log(`\nDone. Browser payload: ${(total / 1048576).toFixed(2)} MB across ${walk(path.join(ROOT, 'assets')).length} files.`);
