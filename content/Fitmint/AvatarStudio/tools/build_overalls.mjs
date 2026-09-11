/**
 * Prepares GOAT and ALIEN from the artist's own GLBs.
 *
 * Both ship beside their FBX in Male/Outfit/Overalls, skin to the same
 * 199-joint rig as Male.glb (rest poses match exactly), and already carry
 * correct PBR values plus most of their roughness and normal maps. That makes
 * them strictly better than running the FBX through convert_fbx.py, which had
 * to infer materials and could not find the textures at all.
 *
 * The one real gap is the G.O.A.T. shoe: every other part has its detail maps
 * embedded, the shoe has none, and `G.shoe.BumpRoughness.jpg` sits loose in the
 * same folder. That is packed and attached here.
 *
 *   node tools/build_overalls.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, unpartition } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.resolve(ROOT, '..', 'Male', 'Outfit', 'Overalls');
const OUT = path.join(ROOT, 'assets', 'items', 'overalls');
const TEX = path.join(ROOT, 'assets', '.overall-tex');

/**
 * Detail maps to wire in, per part.
 *
 * Each part's map is both its roughness and its bump - the same grayscale
 * serves for the packed metallic-roughness texture and for a Sobel-derived
 * normal. Both default to "fill": materials that already carry an
 * artist-authored map keep it, and only the gaps are filled. GOAT.glb ships
 * with several materials that have roughness but no bump, and a few with
 * neither.
 *
 * The one exception is the glove's roughness, which the source wires to its
 * *bump* map while the dedicated G.glove.roughness.jpg sits unused beside it -
 * that one is replaced outright.
 */
const PATCHES = {
  'GOAT.glb': [
    { prefix: 'G.bag', detail: 'G.bag.bumpRoughness.jpg' },
    { prefix: 'G.bodysuit', detail: 'G.bodysuit.bumpRoughness_1k.jpg' },
    { prefix: 'G.glove', detail: 'G.glove.roughness.jpg', roughness: 'replace' },
    { prefix: 'G.shoe', detail: 'G.shoe.BumpRoughness.jpg' },
  ],
  'ALIEN.glb': [],
};

/** Normal-map strength, applied to every material in the file that has one. */
const NORMAL_SCALE = {
  'GOAT.glb': 1.0, // full strength - its weave is meant to read
  'ALIEN.glb': 0.25, // its bump is far too pronounced at the authored strength
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
});

fs.mkdirSync(OUT, { recursive: true });

// sharp cannot share this process - see the note at the top of goat_textures.mjs.
const parts = Object.values(PATCHES).flat();
if (parts.length) {
  execFileSync(process.execPath, [path.join(HERE, 'goat_textures.mjs'), SRC, TEX, JSON.stringify(parts)],
    { stdio: 'inherit' });
}

for (const [file, patches] of Object.entries(PATCHES)) {
  const source = path.join(SRC, file);
  if (!fs.existsSync(source)) {
    console.warn(`  ${file} not found in ${SRC} - skipped`);
    continue;
  }

  const doc = await io.read(source);

  for (const part of patches) {
    const inPart = doc.getRoot().listMaterials().filter((m) => m.getName().startsWith(part.prefix));
    if (!inPart.length) continue;

    const needsRoughness = part.roughness === 'replace'
      ? inPart : inPart.filter((m) => !m.getMetallicRoughnessTexture());
    // Metal fittings are left flat. The detail maps are woven fabric, and
    // draping that over a buckle or an armour plate reads as a dent rather than
    // a surface - none of these metals were authored with a normal map either.
    const needsNormal = (part.normal === 'replace'
      ? inPart : inPart.filter((m) => !m.getNormalTexture())
    ).filter((m) => m.getMetallicFactor() <= 0.5);

    if (needsRoughness.length) {
      const roughness = doc.createTexture(`${part.prefix}.roughness`)
        .setImage(new Uint8Array(fs.readFileSync(path.join(TEX, `${part.prefix}.roughness.webp`))))
        .setMimeType('image/webp');
      for (const mat of needsRoughness) mat.setMetallicRoughnessTexture(roughness);
    }
    if (needsNormal.length) {
      const normal = doc.createTexture(`${part.prefix}.normal`)
        .setImage(new Uint8Array(fs.readFileSync(path.join(TEX, `${part.prefix}.normal.webp`))))
        .setMimeType('image/webp');
      // Strength is set for the whole file below, after the patches.
      for (const mat of needsNormal) mat.setNormalTexture(normal);
    }
    const metals = inPart.filter((m) => m.getMetallicFactor() > 0.5).length;
    console.log(
      `  ${file}: ${part.prefix.padEnd(11)} roughness +${needsRoughness.length}  bump +${needsNormal.length}` +
        `  (of ${inPart.length}${metals ? `, ${metals} metal left flat` : ''})`
    );
  }

  const scale = NORMAL_SCALE[file];
  if (scale !== undefined) {
    let n = 0;
    for (const mat of doc.getRoot().listMaterials()) {
      if (!mat.getNormalTexture()) continue;
      mat.setNormalScale(scale);
      n++;
    }
    if (n) console.log(`  ${file}: normal strength ${scale} on ${n} materials`);
  }

  await doc.transform(dedup(), unpartition());

  // Keep the intermediate uncompressed: the optimize stage handles that, and
  // Blender's glTF importer cannot read EXT_meshopt_compression for thumbnails.
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'EXT_meshopt_compression') ext.dispose();
  }

  const dst = path.join(OUT, file);
  await io.write(dst, doc);

  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
    .reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(
    `  ${file.padEnd(10)} ${(fs.statSync(dst).size / 1024).toFixed(0).padStart(5)} KB  ` +
      `${Math.round(tris)} tris  ${doc.getRoot().listMaterials().length} materials  ` +
      `${doc.getRoot().listTextures().length} textures`
  );
}

fs.rmSync(TEX, { recursive: true, force: true });
