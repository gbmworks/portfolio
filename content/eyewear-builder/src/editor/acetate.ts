/**
 * Painting an acetate part, shared by the editor and the try-on.
 *
 * It lives here, called from both, because the alternative was tried: each
 * scene wrote its own. They drifted, and the drift was invisible until
 * someone picked the one colour that exposed it. The try-on's copy set
 * `material.color` and nothing else, so **tortoise rendered white** -- its hex
 * is a near-white base chosen precisely so the *map* carries the colour, and
 * the try-on never applied a map. Every translucent acetate came out opaque
 * for the same reason.
 *
 * A colour is more than a hex here -- it can carry a texture, translucency and
 * an optical depth -- so anywhere that turns one into a material has to
 * understand all four. One function that does is cheaper than two that agree
 * only while someone keeps checking.
 */

import type * as THREE from 'three';

import { texture } from './materialTable';
import type { Colour } from './options';

/**
 * Surface for a translucent acetate: the sun lens's, in a frame colour.
 *
 * Kept beside the lens numbers it copies so the two cannot drift apart.
 */
export const TRANSLUCENT = {
  opacity: 0.68,
  roughness: 0.06,
  clearcoat: 0.55,
  clearcoatRoughness: 0.05,
};

/**
 * The material properties that select a different compiled shader.
 *
 * Everything else -- colour, roughness, metalness, opacity, clearcoat
 * strength -- is a uniform, and a uniform costs nothing to change. Capture
 * this before painting and compare after; raise `needsUpdate` only if it
 * moved. Raising it unconditionally throws away and rebuilds every program on
 * the scene on every click, the lens's transmission shader included.
 */
export function programKey(material: THREE.MeshPhysicalMaterial): string {
  return [
    material.map ? 1 : 0,
    material.normalMap ? 1 : 0,
    material.transparent ? 1 : 0,
    material.transmission > 0 ? 1 : 0,
    material.clearcoat > 0 ? 1 : 0,
    material.flatShading ? 1 : 0,
  ].join('');
}

export interface AcetateOptions {
  /** Tiling for a map that does not specify its own. */
  repeat?: number;
  /**
   * Whether `transmission` may be used.
   *
   * False in the try-on. Transmission refracts whatever is in the
   * transmission buffer, and there the buffer holds the frame alone -- the
   * camera feed is a video element behind a transparent canvas, so a
   * transmissive front would sample nothing and go dark. A tortoise that is
   * opaque but correctly textured beats one that is physically right and
   * black. See NOTES trap 45.
   */
  transmission?: boolean;
}

/**
 * Base colour, optional albedo map, optional transmission or translucency.
 *
 * Whatever roughness and clearcoat the caller set beforehand survive a solid
 * colour and are deliberately overridden by a translucent one, which needs a
 * glassier surface than an acetate to read as translucent rather than dusty.
 */
export function applyColour(
  material: THREE.MeshPhysicalMaterial,
  colour: Colour,
  options: AcetateOptions = {},
): void {
  const { repeat = 1, transmission = true } = options;

  material.color.set(colour.hex);
  material.map = colour.map ? texture(colour.map, colour.mapRepeat ?? repeat) : null;

  if (colour.transmission && transmission) {
    material.transmission = colour.transmission;
    material.thickness = colour.thickness ?? 3;
    material.ior = 1.5;
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
  } else if (colour.translucent) {
    // Translucent acetates are shaded like a sun lens rather than as a
    // slightly faded solid: same opacity, same low roughness, same clearcoat.
    // At 0.88 opaque with an acetate's roughness they read as dusty plastic,
    // which is the opposite of what a crystal frame is.
    material.transmission = 0;
    material.thickness = 0;
    material.transparent = true;
    material.opacity = TRANSLUCENT.opacity;
    material.roughness = TRANSLUCENT.roughness;
    material.clearcoat = TRANSLUCENT.clearcoat;
    material.clearcoatRoughness = TRANSLUCENT.clearcoatRoughness;
    material.depthWrite = true;
  } else {
    material.transmission = 0;
    material.thickness = 0;
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
  }
  // No `needsUpdate` here: the caller owns that decision, because only the
  // caller knows what the material looked like before the whole paint began.
  // See `programKey`.
}
