/**
 * Re-encodes every embedded texture in a GLB to WebP and caps it at 1024 px.
 *
 * gltf-transform's own `textureCompress` step throws
 * `colourspace: parameter space not set` against the sharp build installed here,
 * so we drive sharp directly and register EXT_texture_webp ourselves.
 * three's GLTFLoader reads that extension natively.
 *
 * Usage: node textures_webp.js <in.glb> <out.glb> [maxSize]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , inPath, outPath, maxArg] = process.argv;
const MAX = Number(maxArg) || 1024;

// Male.glb arrives Draco-compressed; item GLBs may already be meshopt-encoded.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});
const doc = await io.read(inPath);
const root = doc.getRoot();

// Textures that feed normal / roughness data need a cleaner encode than albedo.
const dataTextures = new Set();
for (const mat of root.listMaterials()) {
  for (const getter of ['getNormalTexture', 'getMetallicRoughnessTexture', 'getOcclusionTexture']) {
    const tex = mat[getter]?.();
    if (tex) dataTextures.add(tex);
  }
}

let before = 0;
let after = 0;

for (const texture of root.listTextures()) {
  const image = texture.getImage();
  if (!image) continue;
  before += image.byteLength;

  const isData = dataTextures.has(texture);
  let pipe = sharp(Buffer.from(image)).toColourspace('srgb');

  const meta = await pipe.metadata();
  if (Math.max(meta.width, meta.height) > MAX) {
    pipe = pipe.resize({
      width: meta.width >= meta.height ? MAX : undefined,
      height: meta.height > meta.width ? MAX : undefined,
      fit: 'inside',
      kernel: 'lanczos3',
    });
  }

  const encoded = await pipe
    .webp({ quality: isData ? 90 : 82, alphaQuality: 95, effort: 5, smartSubsample: !isData })
    .toBuffer();

  texture.setImage(new Uint8Array(encoded)).setMimeType('image/webp');
  after += encoded.byteLength;
}

if (root.listTextures().length) doc.createExtension(EXTTextureWebP).setRequired(false);

await io.write(outPath, doc);

const kb = (n) => (n / 1024).toFixed(1).padStart(8) + ' KB';
console.log(
  `${inPath.split(/[\\/]/).pop().padEnd(26)} textures ${kb(before)} ->${kb(after)}` +
    (before ? `  (${Math.round((100 * after) / before)}%)` : '')
);
