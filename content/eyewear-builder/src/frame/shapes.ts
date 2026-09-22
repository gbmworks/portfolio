/**
 * The customisable shape catalogue.
 *
 * The front and the lens carry the same eight shapes under the same shape-key
 * names, and they are always driven together -- a lens that does not follow
 * its rim is not a design option, it is a bug, so the two are never exposed
 * separately.
 *
 * "Cat" is the **basis** shape, not a morph target. Blender shows the basis
 * key without a value slider, which is exactly how it appears in the source
 * file: `Cat` has no number beside it and the other seven read 0.000. So
 * selecting Cat-eye means every influence at zero, and there are seven morphs
 * for eight choices.
 */

export type FrontShapeId =
  | 'cat'
  | 'oval'
  | 'round'
  | 'square'
  | 'rectangle'
  | 'geometric'
  | 'wayfarer'
  | 'aviator';

export interface FrontShape {
  id: FrontShapeId;
  label: string;
  /**
   * Shape-key name in the source file, or null for the basis.
   *
   * Matched case-insensitively at load: Blender's key names are authored by
   * hand and a stray capital should not silently disable a shape.
   */
  morph: string | null;
  /** Position on the selection wheel, degrees clockwise from the top. */
  angle: number;
}

/**
 * Wheel order, clockwise from just right of top.
 *
 * Eight positions at 45 degree spacing, offset by 22.5 so that nothing sits
 * dead on an axis -- which is how the reference layout is drawn, and it keeps
 * the two vertical pairs from colliding with the label of the ring itself.
 */
export const FRONT_SHAPES: FrontShape[] = [
  { id: 'cat', label: 'Cat-eye', morph: null, angle: 22.5 },
  { id: 'oval', label: 'Oval', morph: 'Oval', angle: 67.5 },
  { id: 'round', label: 'Round', morph: 'Round', angle: 112.5 },
  { id: 'square', label: 'Square', morph: 'Square', angle: 157.5 },
  { id: 'rectangle', label: 'Rectangle', morph: 'Rectangle', angle: 202.5 },
  { id: 'geometric', label: 'Geometric', morph: 'Geometric', angle: 247.5 },
  { id: 'wayfarer', label: 'Wayfarer', morph: 'Wayfarer', angle: 292.5 },
  { id: 'aviator', label: 'Aviator', morph: 'Aviator', angle: 337.5 },
];

export const DEFAULT_FRONT_SHAPE: FrontShapeId = 'cat';

/**
 * The bridge is chosen as a pair: a profile and a shape.
 *
 * They are separate degrees of freedom on the model, so the panel offers every
 * combination rather than making the customer discover that the two interact.
 * With two of each that is four buttons, which is small enough to show as a
 * grid and read at a glance.
 */
export type BridgeProfileId = 'profileA' | 'profileB';
export type BridgeShapeId = 'shapeA' | 'shapeB';

export interface BridgeOption {
  id: string;
  profile: BridgeProfileId;
  shape: BridgeShapeId;
  label: string;
  /** Shape-key names to drive, or null where that half is the basis. */
  morphs: (string | null)[];
}

/**
 * Read off the model: the bridge carries four keys, `Profile1`, `Profile2`,
 * `Shape1` and `Shape2`, and the two axes are independent -- so every
 * combination is a real option rather than a guess about which pair the
 * designer intended.
 *
 * Unlike the front, none of these is the basis; the basis bridge is its own
 * unmorphed shape and is not offered, because the four named combinations are
 * what was authored.
 */
export const BRIDGE_OPTIONS: BridgeOption[] = [
  { id: 'a1', profile: 'profileA', shape: 'shapeA', label: 'Design 1', morphs: ['Profile1', 'Shape1'] },
  { id: 'a2', profile: 'profileA', shape: 'shapeB', label: 'Design 2', morphs: ['Profile1', 'Shape2'] },
  { id: 'b1', profile: 'profileB', shape: 'shapeA', label: 'Design 3', morphs: ['Profile2', 'Shape1'] },
  { id: 'b2', profile: 'profileB', shape: 'shapeB', label: 'Design 4', morphs: ['Profile2', 'Shape2'] },
];

export const DEFAULT_BRIDGE_OPTION = 'a1';

/* ------------------------------------------------------------ temple ---- */

export interface TempleDesign {
  id: string;
  label: string;
  /** `null` is the shape the arm was modelled in -- see below. */
  morph: string | null;
}

/**
 * Four arm designs from three shape keys.
 *
 * The same arithmetic as the front: the arm as modelled *is* the first
 * design, and each key moves it to another, so three keys give four options.
 * The numbering therefore does not line up -- the file's `Design1` is shown
 * as Design 2 -- which looks like an off-by-one until you remember the basis
 * has no key of its own to be named by.
 *
 * Both halves of the arm carry this identical key set, the acetate and the
 * wire running through it, and they are always driven together. An arm whose
 * wire kept the old shape would poke through the side of the new one.
 */
export const TEMPLE_DESIGNS: TempleDesign[] = [
  { id: 'd1', label: 'Design 1', morph: null },
  { id: 'd2', label: 'Design 2', morph: 'Design1' },
  { id: 'd3', label: 'Design 3', morph: 'Design2' },
  { id: 'd4', label: 'Design 4', morph: 'Design3' },
];

export const DEFAULT_TEMPLE_DESIGN = 'd1';

/** Case- and separator-insensitive lookup of a shape-key name. */
export function resolveMorphName(
  dictionary: Record<string, number> | undefined,
  wanted: string | null,
): number | null {
  if (!dictionary || !wanted) return null;
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalise(wanted);
  for (const [name, index] of Object.entries(dictionary)) {
    if (normalise(name) === target) return index;
  }
  return null;
}

/* ------------------------------------------------------------ blending -- */

export interface ShapeBlend {
  from: FrontShape;
  to: FrontShape;
  /** 0 = entirely `from`, 1 = entirely `to`. */
  t: number;
}

/** Wrap an angle into [0, 360). */
export const normaliseAngle = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Turn a position on the wheel into a pair of shapes and a mix.
 *
 * The wheel is a circle, so the pair that straddles an angle can wrap round
 * the end of the list -- the segment between Aviator at 337.5 and Cat-eye at
 * 22.5 crosses zero. Searching for a bracketing pair in a sorted array quietly
 * fails there; stepping by segment index does not.
 */
export function shapeBlend(angleDeg: number): ShapeBlend {
  const first = FRONT_SHAPES[0].angle;
  const step = 360 / FRONT_SHAPES.length;
  const position = normaliseAngle(angleDeg - first) / step;
  const index = Math.floor(position);
  const t = position - index;
  return {
    from: FRONT_SHAPES[index % FRONT_SHAPES.length],
    to: FRONT_SHAPES[(index + 1) % FRONT_SHAPES.length],
    t,
  };
}

/** The angle a named shape sits at, for snapping. */
export function angleOf(id: FrontShapeId): number {
  return FRONT_SHAPES.find((s) => s.id === id)?.angle ?? FRONT_SHAPES[0].angle;
}

/** The shape a blend is closest to, for naming the design. */
export function dominantShape(angleDeg: number): FrontShape {
  const blend = shapeBlend(angleDeg);
  return blend.t < 0.5 ? blend.from : blend.to;
}
