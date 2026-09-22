/**
 * Named landmark groups over MediaPipe's 478-point face mesh.
 *
 * Indices 0-467 are the classic FaceMesh; 468-477 are the refined iris points
 * that the `face_landmarker` bundle adds (right iris first, then left). The
 * iris points are the most metrically reliable thing in the whole set -- the
 * iris is very close to 11.7 mm across in every adult -- so they carry the
 * real-world scale for this app.
 *
 * "Left" and "right" below are the *subject's* left and right, matching
 * MediaPipe's own naming. On a mirrored selfie view the subject's left appears
 * on screen right.
 */

import { MIRROR_PAIRS } from './mirrorPairs';

/** Outer boundary of the visible face, in drawing order (a closed loop). */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162,
  21, 54, 103, 67, 109,
] as const;

/** Upper eyelid + lower eyelid, closed loops. */
export const LEFT_EYE = [
  362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381,
  382,
] as const;
export const RIGHT_EYE = [
  133, 173, 157, 158, 159, 160, 161, 246, 33, 7, 163, 144, 145, 153, 154, 155,
] as const;

/** Upper edge of each eyebrow, temple -> nose. */
export const LEFT_BROW = [383, 300, 293, 334, 296, 336, 285] as const;
export const RIGHT_BROW = [156, 70, 63, 105, 66, 107, 55] as const;

/** Outer lip contour, closed loop. */
export const OUTER_LIPS = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146,
] as const;

/** Inner lip contour, closed loop -- used to split the mouth line. */
export const INNER_LIPS = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87,
  178, 88, 95,
] as const;

/** Bridge of the nose, nasion -> tip. */
export const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4] as const;
/**
 * The nose, drawn as three short strokes.
 *
 * The full nose contour is deliberately not exported: traced at illustration
 * line weight it reads as a mask across the middle of the face. These are the
 * two ala curves and the line under the septum, which is all the reference
 * art uses to imply a nose.
 */
export const NOSE_ALA_RIGHT = [102, 64, 98, 97] as const;
export const NOSE_ALA_LEFT = [331, 294, 327, 326] as const;
export const NOSE_BASE_LINE = [97, 2, 326] as const;

export const IRIS_RIGHT = [469, 470, 471, 472] as const;
export const IRIS_LEFT = [474, 475, 476, 477] as const;
export const IRIS_RIGHT_CENTRE = 468;
export const IRIS_LEFT_CENTRE = 473;

/** Single points the measurement and fit code refers to by name. */
export const P = {
  /** Centre of the hairline, the top of the face oval. */
  foreheadTop: 10,
  /** Bottom of the chin (menton). */
  chin: 152,
  /** Bridge of the nose between the eyes (nasion) -- where a frame sits. */
  nasion: 168,
  /** Tip of the nose. */
  noseTip: 4,
  /** Base of the nose, between the nostrils (subnasale). */
  subnasale: 2,
  /** Outer face edge level with the ear canal (tragion), right and left. */
  tragionRight: 234,
  tragionLeft: 454,
  /** Temple, at brow height -- where the frame front ends. */
  templeRight: 127,
  templeLeft: 356,
  /** Upper forehead corners. */
  foreheadRight: 54,
  foreheadLeft: 284,
  /**
   * Mid-brow. This is the anatomical reference the forehead width is measured
   * from, not the forehead points above -- those sit high on the forehead
   * already, and halfway from there to the hairline lands on the temple where
   * the face oval has begun curving in.
   */
  browRight: 105,
  browLeft: 334,
  /** Cheekbone (zygomatic prominence). */
  cheekRight: 116,
  cheekLeft: 345,
  /** Jaw corner (gonion). */
  jawRight: 172,
  jawLeft: 397,
  /** Jaw, one step in from the chin -- gives chin taper. */
  chinRight: 148,
  chinLeft: 377,
  /** Inner and outer eye corners. */
  eyeInnerRight: 133,
  eyeOuterRight: 33,
  eyeInnerLeft: 362,
  eyeOuterLeft: 263,
} as const;

/**
 * Mirror pairs for the full 478-point set.
 *
 * Indices 0-467 come from `MIRROR_PAIRS`, a constant derived offline from the
 * canonical mesh. The ten iris points the refined model adds are not in that
 * model, so they are matched here -- but only against each other, which makes
 * it a ten-element problem with an unambiguous answer rather than a 478-way
 * search that can mis-pair.
 *
 * Matching is *mutual* best match. One-sided nearest-neighbour is what broke
 * the previous version: a point could claim a partner that had a better match
 * elsewhere, leaving the loser unpaired and treated as a midline point.
 */
export function buildMirrorMap(points: Float32Array, count: number): Int32Array {
  const map = new Int32Array(count).fill(-1);
  for (let i = 0; i < Math.min(count, MIRROR_PAIRS.length); i++) {
    map[i] = MIRROR_PAIRS[i];
  }

  const iris: number[] = [];
  for (let i = IRIS_RIGHT_CENTRE; i < count && i < IRIS_LEFT_CENTRE + 5; i++) iris.push(i);

  const reflectedDistance = (a: number, b: number) => {
    const dx = points[b * 3] + points[a * 3];
    const dy = points[b * 3 + 1] - points[a * 3 + 1];
    const dz = points[b * 3 + 2] - points[a * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };

  const nearest = new Map<number, number>();
  for (const i of iris) {
    let best = -1;
    let bestD = Infinity;
    for (const j of iris) {
      if (j === i) continue;
      const d = reflectedDistance(i, j);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    nearest.set(i, best);
  }
  for (const i of iris) {
    const j = nearest.get(i) ?? -1;
    if (j !== -1 && nearest.get(j) === i) map[i] = j;
  }

  return map;
}
