/**
 * Face shape classification.
 *
 * There is no maintained npm package for this. The two open implementations
 * worth knowing about are MartinSaraka/face-metrics (MIT, MediaPipe-based,
 * advertised as `@becometen/face-metrics` but never actually published to the
 * registry) and edrfhhokmjun-cmd/face-shape-data (a table of the four
 * measurements as percentages of face length). Both rest on the same
 * anthropometry that every optical retailer's shape guide uses, so this module
 * implements that directly rather than vendoring an unpublished dependency.
 *
 * What is different here: the classic guides are decision trees of hard
 * thresholds, which means a face a millimetre either side of a cutoff flips
 * category and no face is ever reported as being between two shapes. Real
 * faces are between shapes most of the time. So each shape is expressed as a
 * point in a five-dimensional ratio space, faces are scored by weighted
 * distance to each, and the scores are softmaxed. A face that sits between
 * "oval" and "heart" reports exactly that, which is both more honest and more
 * useful for recommending a frame.
 */

import type { FaceMeasurements } from './measure';

export type FaceShapeId =
  | 'oval'
  | 'round'
  | 'square'
  | 'rectangle'
  | 'heart'
  | 'diamond'
  | 'triangle'
  | 'invertedTriangle';

export interface ShapeDefinition {
  id: FaceShapeId;
  label: string;
  /** One line, in the voice of a shop assistant who knows their stuff. */
  description: string;
  /** What a frame should do about it. */
  frameAdvice: string;
}

export const SHAPES: Record<FaceShapeId, ShapeDefinition> = {
  oval: {
    id: 'oval',
    label: 'Oval',
    description:
      'Balanced proportions, gently rounded jaw, forehead a touch wider than the chin.',
    frameAdvice:
      'The most forgiving shape. Almost anything works, so choose on character rather than correction. Keep the frame width close to your face width.',
  },
  round: {
    id: 'round',
    label: 'Round',
    description: 'Width and length are close, with soft curves and a full cheek line.',
    frameAdvice:
      'Angular frames add the definition the face does not supply. Rectangles and squares with a strong browline work; avoid small round frames.',
  },
  square: {
    id: 'square',
    label: 'Square',
    description: 'Broad forehead, strong jaw, with the two close to the same width.',
    frameAdvice:
      'Round and oval frames soften a hard jaw. Keep the frame wider than the cheekbones and avoid sharp rectangles that echo the jawline.',
  },
  rectangle: {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'A long face with a square jaw — the length carries past the width.',
    frameAdvice:
      'Deep lenses shorten the face. Choose tall frames with a low bridge and decorated temples to break up the vertical run.',
  },
  heart: {
    id: 'heart',
    label: 'Heart',
    description: 'Wide forehead and cheekbones tapering to a narrow, pointed chin.',
    frameAdvice:
      'Bottom-heavy or rimless-bottom frames shift weight downward. Light colours and thin rims at the top keep the forehead from dominating.',
  },
  diamond: {
    id: 'diamond',
    label: 'Diamond',
    description: 'Cheekbones are the widest point, with a narrow forehead and chin.',
    frameAdvice:
      'Frames with a strong browline or distinctive top rim widen the forehead. Oval and cat-eye shapes flatter the cheekbones.',
  },
  triangle: {
    id: 'triangle',
    label: 'Triangle',
    description: 'The jaw is the widest part of the face, narrowing toward the forehead.',
    frameAdvice:
      'Weight at the top balances a heavy jaw. Cat-eye and browline frames wider than the jaw work best.',
  },
  invertedTriangle: {
    id: 'invertedTriangle',
    label: 'Inverted triangle',
    description: 'A wide forehead running down to a narrow jaw, with a squarer chin than a heart.',
    frameAdvice:
      'Keep frames no wider than the forehead and favour thin rims or rimless at the top, with a little weight at the bottom.',
  },
};

/**
 * The five ratios the classifier works in.
 *
 * All are dimensionless, so the result does not depend on how well the iris
 * scale estimate went, and every width is a span of the face contour measured
 * at a defined height (see `measure.ts`) rather than a fixed landmark index.
 */
interface Ratios {
  /** Face length / widest face width. The long-vs-round axis. */
  lengthToWidth: number;
  /** Jaw width / face width. How much the face tapers below. */
  jawToCheek: number;
  /** Forehead width / face width. How much it tapers above. */
  foreheadToCheek: number;
  /** Chin width / jaw width. Pointed vs. square chin. */
  chinToJaw: number;
  /** Jaw angle, normalised: 0 at a hard 118 deg, 1 at a soft 146 deg. */
  jawSoftness: number;
}

export function ratiosOf(m: FaceMeasurements): Ratios {
  const width = m.faceWidth || 1;
  return {
    lengthToWidth: m.faceLength / width,
    jawToCheek: m.jawWidth / width,
    foreheadToCheek: m.foreheadWidth / width,
    chinToJaw: m.chinWidth / (m.jawWidth || 1),
    jawSoftness: clamp01((m.gonialAngle - 118) / 28),
  };
}

/**
 * Archetype centres.
 *
 * `oval` is not a guess. It is MediaPipe's own canonical face model -- the
 * average face the landmarker is fitted against -- run through this exact
 * measurement code, which is also what the normalising constants in
 * `ratiosOf` were set from. Anchoring to a measured average rather than to
 * numbers copied out of a styling guide matters, because those guides never
 * say how they measured, and a ratio is meaningless without that.
 *
 * Every other shape is then that average displaced along the axes its name
 * describes. The offsets are the definitions written as numbers: "square" is
 * a wider jaw, a wider chin and a harder jaw angle; "rectangle" is square
 * plus length; "heart" and "inverted triangle" differ only in the chin, which
 * is the entire reason `chinToJaw` is in the feature set.
 */
const OVAL: Ratios = {
  lengthToWidth: 1.14,
  jawToCheek: 0.77,
  foreheadToCheek: 0.81,
  chinToJaw: 0.56,
  jawSoftness: 0.5,
};

const OFFSETS: Record<FaceShapeId, Partial<Ratios>> = {
  oval: {},
  round: { lengthToWidth: -0.11, jawToCheek: 0.05, jawSoftness: 0.3 },
  square: { lengthToWidth: -0.05, jawToCheek: 0.15, foreheadToCheek: 0.1, chinToJaw: 0.22, jawSoftness: -0.35 },
  rectangle: { lengthToWidth: 0.2, jawToCheek: 0.13, foreheadToCheek: 0.09, chinToJaw: 0.2, jawSoftness: -0.28 },
  heart: { foreheadToCheek: 0.09, jawToCheek: -0.1, chinToJaw: -0.18, jawSoftness: 0.15 },
  diamond: { lengthToWidth: 0.07, foreheadToCheek: -0.1, jawToCheek: -0.09, chinToJaw: -0.1 },
  triangle: { jawToCheek: 0.13, foreheadToCheek: -0.1, chinToJaw: 0.1, jawSoftness: -0.15 },
  invertedTriangle: { foreheadToCheek: 0.12, jawToCheek: -0.11, chinToJaw: 0.04 },
};

const ARCHETYPES = Object.fromEntries(
  (Object.keys(OFFSETS) as FaceShapeId[]).map((id) => [
    id,
    {
      lengthToWidth: OVAL.lengthToWidth + (OFFSETS[id].lengthToWidth ?? 0),
      jawToCheek: OVAL.jawToCheek + (OFFSETS[id].jawToCheek ?? 0),
      foreheadToCheek: OVAL.foreheadToCheek + (OFFSETS[id].foreheadToCheek ?? 0),
      chinToJaw: OVAL.chinToJaw + (OFFSETS[id].chinToJaw ?? 0),
      jawSoftness: OVAL.jawSoftness + (OFFSETS[id].jawSoftness ?? 0),
    },
  ]),
) as Record<FaceShapeId, Ratios>;

/**
 * Per-axis weights.
 *
 * The three proportion ratios are what the shape names are really about, so
 * they carry the decision. Chin width and jaw angle are tie-breakers between
 * otherwise adjacent archetypes, and are also the two noisiest measurements,
 * so they are damped.
 */
const WEIGHTS: Ratios = {
  lengthToWidth: 4.0,
  jawToCheek: 3.4,
  foreheadToCheek: 3.0,
  chinToJaw: 1.4,
  jawSoftness: 0.8,
};

export interface ShapeScore {
  id: FaceShapeId;
  /** 0..1, the softmax share. The top two normally sum to well over half. */
  weight: number;
}

export interface FaceShapeResult {
  primary: FaceShapeId;
  secondary: FaceShapeId;
  /** All eight, descending. */
  scores: ShapeScore[];
  /**
   * True when the top two are close enough that calling it one shape would be
   * overclaiming. The UI reads this as "a mix of X and Y".
   */
  isBlend: boolean;
  /** How decisive the call is, 0..1. Drives the wording, not the result. */
  confidence: number;
  ratios: Ratios;
}

export function classify(m: FaceMeasurements): FaceShapeResult {
  const r = ratiosOf(m);
  const keys = Object.keys(ARCHETYPES) as FaceShapeId[];

  const distances = keys.map((id) => {
    const a = ARCHETYPES[id];
    let sum = 0;
    sum += sq((r.lengthToWidth - a.lengthToWidth) * WEIGHTS.lengthToWidth);
    sum += sq((r.jawToCheek - a.jawToCheek) * WEIGHTS.jawToCheek);
    sum += sq((r.foreheadToCheek - a.foreheadToCheek) * WEIGHTS.foreheadToCheek);
    sum += sq((r.chinToJaw - a.chinToJaw) * WEIGHTS.chinToJaw);
    sum += sq((r.jawSoftness - a.jawSoftness) * WEIGHTS.jawSoftness);
    return { id, d: Math.sqrt(sum) };
  });

  // Softmax over negative distance. Temperature sets how readily the result is
  // reported as a blend: lower is more decisive. Tuned so that a face sitting
  // midway between two archetypes lands near a 40/30 split rather than 95/2,
  // which is what makes "a mix of two" a meaningful statement, while the
  // canonical average face still comes out decisively oval.
  const T = 0.075;
  const min = Math.min(...distances.map((x) => x.d));
  const exps = distances.map((x) => ({ id: x.id, e: Math.exp(-(x.d - min) / T) }));
  const total = exps.reduce((s, x) => s + x.e, 0);

  const scores = exps
    .map((x) => ({ id: x.id, weight: x.e / total }))
    .sort((a, b) => b.weight - a.weight);

  const [first, second] = scores;
  // A blend when the runner-up holds at least 60% of the leader's share.
  const isBlend = second.weight > first.weight * 0.6;

  return {
    primary: first.id,
    secondary: second.id,
    scores,
    isBlend,
    confidence: clamp01((first.weight - second.weight) / first.weight),
    ratios: r,
  };
}

/** The sentence the result screen shows. */
export function describe(result: FaceShapeResult): string {
  const a = SHAPES[result.primary];
  const b = SHAPES[result.secondary];
  if (result.isBlend) {
    const pa = Math.round(result.scores[0].weight * 100);
    const pb = Math.round(result.scores[1].weight * 100);
    return `A mix of ${a.label.toLowerCase()} and ${b.label.toLowerCase()} — roughly ${pa}/${pb}.`;
  }
  return a.description;
}

const sq = (x: number) => x * x;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
