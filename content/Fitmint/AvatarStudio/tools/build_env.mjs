/**
 * Derives the lighting presets from the prepared HDRIs and writes
 * src/environments.js.
 *
 * For each probe (a raw float32 RGB dump from build_hdri.py) this works out:
 *   - where the dominant light actually is, so the key light and its shadow
 *     line up with the sun or lamp you can see in the backdrop
 *   - a fill and a rim placed relative to that key
 *   - exposure balance, so a noon soccer field and a dim alley light the avatar
 *     to roughly the same level instead of one blowing out
 * The HDRI is never shown as a backdrop - the stage is a plain white-to-grey
 * gradient - so this only has to get the lighting right.
 *
 *   node tools/build_env.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ENV = path.join(ROOT, 'assets', 'env');

// Display names; anything present but unlisted keeps its file stem.
const LABELS = { TCom_ColorfulAlley_colorful_alley_1K_hdri_sphere: 'Alley' };

const manifest = JSON.parse(fs.readFileSync(path.join(ENV, '_hdri.json'), 'utf8'));

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEG = Math.PI / 180;

/**
 * Read a probe into pixels tagged with their world direction.
 *
 * Blender writes rows bottom-first, and three samples an equirect as
 * u = atan2(z, x) / 2pi + 0.5, v = asin(y) / pi + 0.5 with flipY on, so row 0
 * is v = 0 is straight down. Solid angle falls off as cos(elevation).
 */
function readProbe(entry) {
  const [W, H] = entry.probeSize;
  const raw = fs.readFileSync(path.join(ENV, 'probe', entry.probe));
  const f = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);

  const pixels = [];
  for (let row = 0; row < H; row++) {
    const v = (row + 0.5) / H;
    const y = Math.sin((v - 0.5) * Math.PI);
    const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
    for (let col = 0; col < W; col++) {
      const u = (col + 0.5) / W;
      const phi = (u - 0.5) * 2 * Math.PI;
      const i = (row * W + col) * 3;
      const r = f[i];
      const g = f[i + 1];
      const b = f[i + 2];
      pixels.push({
        r, g, b,
        l: luma(r, g, b),
        dir: [Math.cos(phi) * horizontal, y, Math.sin(phi) * horizontal],
        weight: horizontal, // solid angle
      });
    }
  }
  return { pixels, W, H, f };
}

/** Luminance-weighted centroid of the brightest patch above the horizon. */
function findSun(pixels) {
  const upper = pixels.filter((p) => p.dir[1] > -0.05);
  const sorted = [...upper].sort((a, b) => b.l - a.l);
  const top = sorted.slice(0, Math.max(8, Math.round(sorted.length * 0.0025)));

  const dir = [0, 0, 0];
  const color = [0, 0, 0];
  let total = 0;
  for (const p of top) {
    const w = p.l + 1e-6;
    for (let i = 0; i < 3; i++) dir[i] += p.dir[i] * w;
    color[0] += p.r * w;
    color[1] += p.g * w;
    color[2] += p.b * w;
    total += w;
  }
  const len = Math.hypot(...dir) || 1;
  const normalised = dir.map((d) => d / len);
  const rgb = color.map((c) => c / total);
  const peak = Math.max(...rgb) || 1;

  return {
    dir: normalised,
    // Hue of the light source, at unit brightness; strength is set separately.
    color: rgb.map((c) => clamp(c / peak, 0, 1)),
    strength: top.reduce((n, p) => n + p.l, 0) / top.length,
  };
}

/** Solid-angle weighted mean colour over the whole sphere. */
function meanColor(pixels) {
  const sum = [0, 0, 0];
  let total = 0;
  for (const p of pixels) {
    sum[0] += p.r * p.weight;
    sum[1] += p.g * p.weight;
    sum[2] += p.b * p.weight;
    total += p.weight;
  }
  return total ? sum.map((c) => c / total) : [0, 0, 0];
}

const toHex = (rgb) => {
  // Linear -> sRGB, then normalise so the hex carries hue, not exposure.
  const peak = Math.max(...rgb, 1e-6);
  const norm = rgb.map((c) => clamp(c / peak, 0, 1));
  const srgb = norm.map((c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  return Number(
    '0x' + srgb.map((c) => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, '0')).join('')
  );
};

/** Place a light by rotating away from the key's azimuth. */
function place(sunDir, azimuthOffsetDeg, elevationDeg, distance = 4) {
  const azimuth = Math.atan2(sunDir[2], sunDir[0]) + azimuthOffsetDeg * DEG;
  const elevation = elevationDeg * DEG;
  return [
    Math.cos(azimuth) * Math.cos(elevation) * distance,
    Math.sin(elevation) * distance,
    Math.sin(azimuth) * Math.cos(elevation) * distance,
  ].map((n) => Number(n.toFixed(3)));
}

// How bright we want the avatar lit, regardless of the HDRI's own exposure.
const TARGET_AMBIENT = 0.32;
const presets = [];

for (const entry of manifest) {
  const id = entry.id;
  const label = LABELS[id] || id;

  const { pixels } = readProbe(entry);
  const sun = findSun(pixels);
  const ambient = meanColor(pixels);
  const ambientLuma = Math.max(luma(...ambient), 1e-4);

  const envIntensity = Number(clamp(TARGET_AMBIENT / ambientLuma, 0.25, 3.5).toFixed(3));

  // Key strength tracks how dominant the light source is over the ambient, so a
  // hard sun throws a real shadow and an overcast yard barely does.
  const contrast = clamp(sun.strength / ambientLuma, 1, 60);
  const keyIntensity = Number(clamp(0.55 + Math.log10(contrast) * 1.55, 0.5, 3.2).toFixed(2));

  const sunElevation = Math.asin(clamp(sun.dir[1], -1, 1)) / DEG;
  const keyElevation = clamp(sunElevation, 18, 68);


  presets.push({
    id,
    label,
    hdr: `assets/env/${entry.hdr}?v=${Math.floor(fs.statSync(path.join(ENV, entry.hdr)).mtimeMs)}`,
    envIntensity,
    exposure: 1.0,
    key: {
      color: toHex(sun.color),
      intensity: keyIntensity,
      position: place(sun.dir, 0, keyElevation),
    },
    shadow: Number(clamp(0.1 + Math.log10(contrast) * 0.11, 0.1, 0.34).toFixed(2)),
  });

  console.log(
    `${label.padEnd(9)} sun az=${(Math.atan2(sun.dir[2], sun.dir[0]) / DEG).toFixed(0).padStart(5)}deg ` +
    `el=${sunElevation.toFixed(0).padStart(3)}deg  contrast=${contrast.toFixed(1).padStart(5)}  ` +
    `env=${envIntensity}  key=${keyIntensity}`
  );
}

const out = `// GENERATED by tools/build_env.mjs from the source HDRIs - do not edit by hand.
//
// Measured from the HDRI: the key light sits where the dominant light in that
// image actually is, so its cast shadow agrees with it, and exposure is
// normalised so any environment lights the avatar to the same level. Fill and
// rim are not here - the character carries its own point-light rig for those.
// The HDRI itself is never shown; the stage is a plain white-to-grey gradient.
export const ENVIRONMENTS = ${JSON.stringify(presets, null, 2)};

export const DEFAULT_ENVIRONMENT = ${JSON.stringify(presets[0]?.id ?? '')};
`;

fs.writeFileSync(path.join(ROOT, 'src', 'environments.js'), out);
console.log(`\nWrote src/environments.js with ${presets.length} presets.`);
