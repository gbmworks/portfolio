/* ------------------------------------------------------------------
   Optional real-HDRI override.

   The procedural skies are the default.  To swap one for a real
   equirectangular .hdr — your own Blender render, or a CC0 capture —
   drop the file in assets/hdri/ and list its theme key in
   assets/hdri/manifest.json:

     ["technical-art", "visualization"]

   ...loads assets/hdri/technical-art.hdr and visualization.hdr and
   uses them for both the sky and the image-based lighting.  Anything
   not listed stays procedural, and nothing is requested at all while
   the manifest is empty.
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
