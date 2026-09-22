/**
 * Turning the averaged head-local mesh into numbers a dispenser would use.
 *
 * Everything is derived from the rectified mean, so these are pose-corrected
 * measurements rather than measurements of one photograph. Absolute scale
 * comes from the iris (see `millimetresPerUnit`).
 *
 * The widths are sampled off the face contour **at anatomically defined
 * heights**, not read from fixed landmark indices. That is a deliberate
 * change from the obvious approach and it matters: the guides these ratios
 * come from say "the widest point of the forehead", and no single MediaPipe
 * index sits there on every face. Picking one index makes the measurement a
 * lottery on face shape -- on a low hairline the index that worked lands in
 * hair, on a high one it lands on the brow. Interpolating the contour at
 * "halfway from brow to hairline" measures the same anatomy on everyone.
 */

import { at, millimetresPerUnit } from './headFrame';
import { FACE_OVAL, P } from './landmarks';

export interface FaceMeasurements {
  /** Millimetres per rectified unit -- the scale everything else is in. */
  mmPerUnit: number;

  /** Widest point of the face contour. The denominator of every shape ratio. */
  faceWidth: number;
  /** Contour width halfway between the brow and the hairline. */
  foreheadWidth: number;
  /** Across the jaw corners (gonions). */
  jawWidth: number;
  /** Contour width a third of the way up from the chin. */
  chinWidth: number;
  /** Hairline to chin. */
  faceLength: number;
  /** Across the head at ear level -- what a frame front has to clear. */
  headWidth: number;

  /** Interpupillary distance, from the iris centres. */
  pd: number;
  pdRight: number;
  pdLeft: number;

  /** Nasion to the ear plane, horizontally. Sets the temple length. */
  earDepth: number;
  /** Nasion height above the pupil line; negative means below. */
  bridgeHeight: number;
  /** Angle of the jawline at the gonion, degrees. Bigger is softer. */
  gonialAngle: number;

  /** Suggested total frame front width, mm. */
  suggestedFrameWidth: number;
  /** Suggested temple length, mm, rounded to the stock sizes. */
  suggestedTempleLength: number;
}

/**
 * @param mean the pose-averaged mesh -- the only one with usable depth.
 * @param frontal the average over near-frontal frames. Every lateral span is
 *   taken from this, because a turned head measures narrower than it is: the
 *   far tragion is partly self-occluded and its estimate creeps inward.
 */
export function measure(mean: Float32Array, frontal: Float32Array = mean): FaceMeasurements {
  const mm = millimetresPerUnit(frontal);
  const u = (v: number) => v * mm;

  const top = at(frontal, P.foreheadTop);
  const chin = at(frontal, P.chin);
  const brow = at(frontal, P.browRight);
  const gonionR = at(frontal, P.jawRight);

  const contour = FACE_OVAL.map((i) => {
    const p = at(frontal, i);
    return { x: p.x, y: p.y };
  });

  // Widest point of the face. Searching the contour rather than naming a
  // landmark means this is right whether the widest part is the cheekbones,
  // the jaw or the temples -- which is itself one of the things that
  // distinguishes the shapes.
  const faceWidth = widestSpan(contour);

  const foreheadY = brow.y + (top.y - brow.y) * 0.5;
  const chinY = chin.y + (gonionR.y - chin.y) * 0.3;

  const irisR = at(frontal, 468);
  const irisL = at(frontal, 473);

  const nasion = at(frontal, P.nasion);
  const tragionR = at(frontal, P.tragionRight);
  const tragionL = at(frontal, P.tragionLeft);

  const gonial = angleAt(at(mean, P.jawRight), at(mean, P.tragionRight), at(mean, P.chin));
  const headWidth = u(Math.abs(tragionL.x - tragionR.x));

  // Depth is the one thing only the turned frames know.
  const depthNasion = at(mean, P.nasion);
  const earDepth =
    u(Math.abs(depthNasion.z - (at(mean, P.tragionRight).z + at(mean, P.tragionLeft).z) / 2));

  const pd = u(Math.abs(irisL.x - irisR.x));

  return {
    mmPerUnit: mm,
    faceWidth: u(faceWidth),
    foreheadWidth: u(spanAt(contour, foreheadY)),
    jawWidth: u(Math.abs(at(frontal, P.jawLeft).x - gonionR.x)),
    chinWidth: u(spanAt(contour, chinY)),
    faceLength: u(Math.abs(top.y - chin.y)),
    headWidth,
    pd,
    pdRight: u(Math.abs(irisR.x)),
    pdLeft: u(Math.abs(irisL.x)),
    earDepth,
    bridgeHeight: u(nasion.y - (irisR.y + irisL.y) / 2),
    gonialAngle: gonial,

    // Sized from the PD, not from the head width.
    //
    // The head width is the obvious choice and the worse one: it comes from
    // the tragion landmarks, which sit on the self-occluding edge of the face
    // and are the least reliable points in the set -- a real scan came back at
    // 125 mm for a 63 mm PD, a ratio no adult head has. The PD comes straight
    // off the irises, which are the best-conditioned measurement we take.
    //
    // 2.2x is the empirical ratio: a 63 mm PD wears a 139 mm front, a 58 mm PD
    // a 128 mm one, a 68 mm PD a 150 mm one. That spans the stock range and
    // agrees with what this frame was hand-fitted to.
    suggestedFrameWidth: pd * 2.2,

    // Temple length is the run from the frame front back to the ear plus the
    // bend down behind it. The bend is near enough constant at 55-60 mm; the
    // part that varies between people is the depth, which we measured.
    suggestedTempleLength: Math.round((earDepth + 60) / 5) * 5,
  };
}

/** Widest horizontal span of a closed contour, ignoring height. */
function widestSpan(contour: Array<{ x: number; y: number }>): number {
  let min = Infinity;
  let max = -Infinity;
  for (const p of contour) {
    if (p.x < min) min = p.x;
    if (p.x > max) max = p.x;
  }
  return max - min;
}

/**
 * Width of the contour at height `y`.
 *
 * Each side is found separately by walking the contour for the edge that
 * straddles `y`, then interpolating along it. Taking the outermost crossing on
 * each side is what keeps a wobble in the jawline from returning a span
 * measured across a notch.
 */
function spanAt(contour: Array<{ x: number; y: number }>, y: number): number {
  let left = 0;
  let right = 0;

  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    if (a.y === b.y) continue;
    const t = (y - a.y) / (b.y - a.y);
    if (t < 0 || t > 1) continue;
    const x = a.x + (b.x - a.x) * t;
    if (x < left) left = x;
    if (x > right) right = x;
  }

  return right - left;
}

/** Interior angle at `vertex`, in degrees. */
function angleAt(
  vertex: { x: number; y: number; z: number },
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y, z: a.z - vertex.z };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y, z: b.z - vertex.z };
  const d = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
  return m > 1e-9 ? (Math.acos(Math.max(-1, Math.min(1, d / m))) * 180) / Math.PI : 0;
}
