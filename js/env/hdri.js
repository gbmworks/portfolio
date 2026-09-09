/* ------------------------------------------------------------------
   Optional real-HDRI override.

   The site has one sky now, so there is one override.  The procedural
   bake is the default; to replace it with a real equirectangular .hdr —
   your own Blender render, or a CC0 capture — drop the file in
   assets/hdri/ named after SKY.key in env/themes.js, and list that name
   in assets/hdri/manifest.json:

     ["sky"]

   ...loads assets/hdri/sky.hdr and uses it for both the visible dome
   and the image-based lighting.  With the manifest empty nothing is
   requested at all, which is the default.

   This still takes a key rather than hardcoding one: the loader has no
   opinion about how many skies there are, and per-sector .hdr files
   would work again the moment the manager asked for them.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const DIR = new URL('../../assets/hdri/', import.meta.url);
let manifest = null;

function getManifest() {
  if (!manifest) {
    manifest = fetch(new URL('manifest.json', DIR).href)
      .then(r => (r.ok ? r.json() : []))
      .then(list => (Array.isArray(list) ? list : []))
      .catch(() => []);
  }
  return manifest;
}

export async function loadHdriOverride(key) {
  const list = await getManifest();
  if (!list.includes(key)) return null;
  try {
    const tex = await new RGBELoader().loadAsync(new URL(key + '.hdr', DIR).href);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  } catch (err) {
    console.warn('[hdri] could not load ' + key + '.hdr — staying procedural', err);
    return null;
  }
}
