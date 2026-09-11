/**
 * Builds the G.O.A.T. detail textures. Run as its own process by build_goat.mjs.
 *
 * It has to be a separate process: `@gltf-transform/functions` pulls in
 * ndarray-pixels, which bundles its own sharp (0.35.x) alongside the top-level
 * one (0.34.x). Loading both puts two libvips copies in the process and their
 * VipsInterpretation enums disagree, so every colourspace-touching call dies
 * with "colourspace: parameter space not set". Keeping sharp out of the
 * gltf-transform process avoids the clash entirely.
 *
 *   node goat_textures.mjs <SRC_DIR> <OUT_DIR> <partsJson>
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [, , SRC, OUT, partsJson] = process.argv;
const PARTS = JSON.parse(partsJson);

const SIZE = 512; // detail maps, not artwork - 1k buys nothing here
const NORMAL_STRENGTH = 2.4;

fs.mkdirSync(OUT, { recursive: true });

/**
 * Index every image under the source tree by basename.
 *
 * The supplied folder gets reorganised between drops - the glove and shoe maps
 * have already moved from their part subfolders up to the root - so the build
 * looks files up by name rather than by the path they happened to arrive at.
 */
const BY_NAME = new Map();
(function index(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) index(full);
    else if (/\.(jpe?g|png)$/i.test(entry.name)) BY_NAME.set(entry.name.toLowerCase(), full);
  }
})(SRC);

function locate(name) {
  const found = BY_NAME.get(name.toLowerCase());
  if (!found) throw new Error(`No image named "${name}" under ${SRC}`);
  return found;
}

/** Read a map as one grayscale plane; these are already grey, so take red. */
async function readGray(file, size) {
  const { data, info } = await sharp(file)
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gray = Buffer.alloc(size * size);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * info.channels];
  return gray;
}

/**
 * Pack the detail into green (roughness) and hold blue (metalness) at 1.
 *
 * glTF reads roughness from G and metalness from B of the same texture, so a
 * plain grayscale map here would drive metalness from the same pixels and
 * flatten every metal fitting on the suit.
 */
async function packRoughness(file, dst) {
  const gray = await readGray(file, SIZE);
  const rgb = Buffer.alloc(SIZE * SIZE * 3, 255);
  for (let i = 0; i < gray.length; i++) rgb[i * 3 + 1] = gray[i];
  await sharp(rgb, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .webp({ quality: 88, effort: 5 })
    .toFile(dst);
}

/** Sobel the height map into a tangent-space normal map. */
async function deriveNormal(file, dst) {
  const N = SIZE;
  const h = await readGray(file, N);
  const at = (x, y) => h[((y + N) % N) * N + ((x + N) % N)] / 255;

  const out = Buffer.alloc(N * N * 3);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      const nx = dx * NORMAL_STRENGTH;
      const ny = dy * NORMAL_STRENGTH;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * N + x) * 3;
      out[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
    }
  }
  await sharp(out, { raw: { width: N, height: N, channels: 3 } })
    .webp({ quality: 92, effort: 5 })
    .toFile(dst);
}

for (const part of PARTS) {
  await packRoughness(locate(part.detail), path.join(OUT, `${part.prefix}.roughness.webp`));
  await deriveNormal(locate(part.bump || part.detail), path.join(OUT, `${part.prefix}.normal.webp`));
  console.log(`  ${part.prefix.padEnd(12)} roughness + normal @ ${SIZE}px`);
}
