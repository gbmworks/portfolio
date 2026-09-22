/**
 * Head pose and rectification, derived from the landmarks themselves.
 *
 * Why not just use MediaPipe's `facialTransformationMatrixes`? We do use it --
 * for a stability cross-check -- but not as the primary source. That matrix is
 * fitted against the *canonical* metric face in a camera space whose intrinsics
 * we would then have to match exactly; any mismatch shows up as glasses that
 * float off the nose. A basis built from the landmarks we are also drawing is
 * aligned with the video by construction, which is the property that actually
 * matters for a try-on.
 *
 * The basis convention, matching three.js and the rest of the app:
 *   +X  subject's left, across the face
 *   +Y  up
 *   +Z  out of the face, toward the camera
 */

import { P } from './landmarks';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface HeadFrame {
  /** Origin: the nasion, i.e. where a frame's bridge lands. */
  origin: Vec3;
  /** Orthonormal basis, columns of the head -> world rotation. */
  x: Vec3;
  y: Vec3;
  z: Vec3;
  /** Tragion-to-tragion distance in the incoming coordinate space. */
  width: number;
  /** Radians. Yaw is + when the subject turns to their own left. */
  yaw: number;
  pitch: number;
  roll: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Read point `i` out of a flat xyz array. */
export const at = (pts: Float32Array, i: number): Vec3 => ({
  x: pts[i * 3],
  y: pts[i * 3 + 1],
  z: pts[i * 3 + 2],
});

const mid = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

/**
 * Build the head basis from a flat xyz landmark array.
 *
 * X comes from the tragion pair and Z from the cross product, because those
 * are the two directions the mesh pins down most stiffly. Y is then
 * re-derived rather than taken from forehead-to-chin: the chin moves when the
 * jaw opens, and letting that steer the up axis makes the glasses nod when the
 * subject talks.
 */
export function headFrameFrom(pts: Float32Array): HeadFrame {
  const right = at(pts, P.tragionRight);
  const left = at(pts, P.tragionLeft);
  const origin = at(pts, P.nasion);
  const chin = at(pts, P.chin);
  const brow = at(pts, P.foreheadTop);

  const xAxis = norm(sub(left, right));
  const upRough = norm(sub(brow, chin));
  const zAxis = norm(cross(xAxis, upRough));
  const yAxis = norm(cross(zAxis, xAxis));

  // Camera looks down -Z in three.js, so a head facing the camera has its own
  // +Z pointing back at it. Extract Euler angles in that convention.
  const yaw = Math.atan2(zAxis.x, zAxis.z);
  const pitch = Math.asin(Math.max(-1, Math.min(1, -zAxis.y)));
  const roll = Math.atan2(xAxis.y, yAxis.y);

  return {
    origin,
    x: xAxis,
    y: yAxis,
    z: zAxis,
    width: len(sub(left, right)),
    yaw,
    pitch,
    roll,
  };
}

/**
 * Express every landmark in head-local coordinates, scaled so the interocular
 * distance is 1.
 *
 * This is the step that makes the guided scan worth doing: rectified samples
 * taken at different yaws and pitches land in the same frame, so averaging
 * them cancels the per-frame foreshortening error instead of baking one
 * viewpoint's distortion into the result.
 */
export function rectify(pts: Float32Array, frame: HeadFrame): Float32Array {
  const n = pts.length / 3;
  const out = new Float32Array(pts.length);

  const eyeR = mid(at(pts, P.eyeInnerRight), at(pts, P.eyeOuterRight));
  const eyeL = mid(at(pts, P.eyeInnerLeft), at(pts, P.eyeOuterLeft));
  const scale = 1 / (len(sub(eyeL, eyeR)) || 1);

  for (let i = 0; i < n; i++) {
    const d = sub(at(pts, i), frame.origin);
    out[i * 3] = dot(d, frame.x) * scale;
    out[i * 3 + 1] = dot(d, frame.y) * scale;
    out[i * 3 + 2] = dot(d, frame.z) * scale;
  }
  return out;
}

/**
 * Real-world scale, in millimetres per rectified unit.
 *
 * The iris is the one facial feature with a tight population spread: the
 * horizontal visible iris diameter is 11.7 mm +/- 0.5 in adults, which is why
 * it is the standard reference in optical dispensing software. Everything
 * downstream -- PD, frame width recommendation, the mm grid on the portrait --
 * hangs off this number, so it is measured rather than assumed.
 */
export const IRIS_DIAMETER_MM = 11.7;

export function millimetresPerUnit(rectified: Float32Array): number {
  // Horizontal diameter of each iris: points 471/469 and 476/474 are the
  // left/right extremes of the two iris rings.
  const d1 = Math.abs(rectified[471 * 3] - rectified[469 * 3]);
  const d2 = Math.abs(rectified[476 * 3] - rectified[474 * 3]);
  const mean = (d1 + d2) / 2;
  return mean > 1e-6 ? IRIS_DIAMETER_MM / mean : 0;
}
