/**
 * How the frame sits on the face.
 *
 * Everything in here is in millimetres relative to the nasion, which is also
 * where the loaded frame's origin is, so a fit of all zeros means "bridge
 * exactly on the bridge of the nose". That makes the numbers legible: a
 * `noseSlide` of 6 is six millimetres further down the nose, not six of some
 * unit nobody can picture.
 */

export interface FitSettings {
  /**
   * Where the frame sits up or down the face, mm. Positive raises it.
   *
   * There used to be a second control for sliding down the nose, which added
   * a forward component as well. It was removed: at the range a fitting needs
   * the two were indistinguishable on screen, and two sliders that appear to
   * do the same thing is worse than one that does it properly.
   */
  height: number;
  /** Vertex distance trim, mm. Positive moves the frame away from the eye. */
  depth: number;
  /** Pantoscopic tilt, degrees. Positive tips the bottom rim toward the face. */
  pantoscopic: number;
  /** Temple splay, degrees. Positive opens the arms outward. */
  splay: number;
  /** Overall frame size, as a multiplier on the nominal front width. */
  scale: number;
}

export const DEFAULT_FIT: FitSettings = {
  height: 0,
  depth: 0,
  // A dispensed frame is normally tilted 8-12 degrees so the lower rim sits
  // closer to the cheek; starting at 8 looks right before anyone touches a
  // control.
  pantoscopic: 8,
  splay: 0,
  scale: 1,
};

export const FIT_RANGES: Record<keyof FitSettings, { min: number; max: number; step: number }> = {
  height: { min: -30, max: 20, step: 0.5 },
  depth: { min: -6, max: 10, step: 0.5 },
  pantoscopic: { min: -4, max: 20, step: 0.5 },
  splay: { min: -12, max: 12, step: 0.5 },
  // Wide on purpose. A plausible dispensing range would be 0.85-1.15, but
  // the placeholder FBX comes from a set whose absolute scale is known not
  // to be trustworthy, so the control has to be able to reach past that to
  // let a real size be found by eye.
  scale: { min: 0.5, max: 1.8, step: 0.01 },
};

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface EarTargets {
  /** Ear-top contact point for each side, in head-local mm. */
  left: Point3;
  right: Point3;
}

/**
 * How far outside the skin the temple should ride, mm.
 *
 * Not cosmetic. The head is wider at the ears than a frame front is, so a
 * temple with no splay runs *inside* the skull -- physically impossible, and
 * the head mask duly culls the near arm along with the far one. Pushing the
 * target a few millimetres proud of the skin is what a real temple does and
 * what keeps the near arm on the visible side of the mask.
 */
const TEMPLE_CLEARANCE = 4;

/**
 * Where the temple tips should land, in head-local millimetres.
 *
 * Derived from the scan rather than assumed: the ears are out at the measured
 * head half-width, back at the measured ear depth, and at the height the brow
 * sits -- which is where the top of the ear is on almost everyone.
 */
export function earTargets(
  measurements: { headWidth: number; earDepth: number },
  browHeightMm: number,
): EarTargets {
  const x = measurements.headWidth / 2 + TEMPLE_CLEARANCE;
  // The ear canal sits below the brow; the top of the ear is level with it.
  // A third of the brow height above the nasion is the contact point.
  const y = browHeightMm * 0.35;
  const z = -measurements.earDepth;
  return { left: { x, y, z }, right: { x: -x, y, z } };
}

export interface TempleGeometry {
  /** Where the temple leaves the front, head-local mm. */
  hinge: { x: number; y: number; z: number };
  /** Where it ends, head-local mm. */
  tip: { x: number; y: number; z: number };
}

/**
 * Splay, in degrees, that puts this temple's tip out at `earX`.
 *
 * Rotating the tip about the hinge in the x-z plane gives
 * `dx*cos(t) + dz*sin(t) = W`, which is `R*cos(t - phi) = W` -- a closed form,
 * not a search.
 *
 * The side is taken from the hinge's own x, never from the part's name. The
 * placeholder FBX labels its arms LEFT_ARM and RIGHT_ARM, and LEFT_ARM sits at
 * *negative* x, so trusting the name pairs each arm with the opposite ear and
 * the solve silently no-ops because the target is out of reach.
 */
export function solveSplay(temple: TempleGeometry, earHalfWidth: number): number {
  const dx = temple.tip.x - temple.hinge.x;
  const dz = temple.tip.z - temple.hinge.z;
  const reach = Math.hypot(dx, dz);
  if (reach < 1e-3) return 0;

  const side = Math.sign(temple.hinge.x) || 1;
  const wanted = side * earHalfWidth - temple.hinge.x;
  // Out of reach means the frame is simply too narrow for the head; opening
  // the arms as far as they go is the best available answer, and the size
  // control is the real fix.
  const phi = Math.atan2(dz, dx);
  const theta = phi + Math.acos(clamp(wanted / reach, -1, 1));

  // `arScene` applies -sign(hinge.x) * splay to each arm, so invert that here.
  return clampRange(-side * toDegrees(wrap(theta)), FIT_RANGES.splay);
}

/** Fold an angle into (-pi, pi]. */
function wrap(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

/**
 * A starting fit from the scan, before the customer touches anything.
 *
 * Two dispensing rules, both worth more than a neutral default:
 *
 *  - **Size to the head.** The front should run a little narrower than the
 *    head so the arms pass straight back to the ears rather than gripping or
 *    gapping. `suggestedFrameWidth` already carries that allowance.
 *
 *  - **Set the height from the pupil, not the bridge.** Anchoring a frame at
 *    the bridge saddle puts its top rim above the brows, because the saddle
 *    is most of the frame's depth below the rim. What a dispenser actually
 *    sets is the pupil sitting at, or just above, the vertical centre of the
 *    lens. Solving for that is the difference between a try-on that looks
 *    like glasses and one that looks like a mask.
 */
export function initialFit(
  measurements: {
    suggestedFrameWidth: number;
    bridgeHeight: number;
    headWidth: number;
    earDepth: number;
  },
  frame: {
    frontWidth: number;
    lensCentreY: number;
    lensHeight: number;
    hingeLeft: Point3;
    tipLeft: Point3;
  },
  browHeightMm = 20,
): FitSettings {
  const scale = clampRange(
    measurements.suggestedFrameWidth / (frame.frontWidth || 1),
    FIT_RANGES.scale,
  );

  // Pupil position relative to the bridge saddle, in head-local mm. Positive
  // `bridgeHeight` means the nasion sits above the pupil line.
  const pupilY = -measurements.bridgeHeight;
  // Where the pupil should end up.
  const target = (frame.lensCentreY + frame.lensHeight * PUPIL_ABOVE_CENTRE) * scale;

  const base: FitSettings = {
    ...DEFAULT_FIT,
    scale,
    height: clampRange(pupilY - target, FIT_RANGES.height),
  };

  // Open the arms onto the ears straight away rather than leaving them
  // parallel. A frame front is narrower than the head, so arms with no splay
  // pass through the skull -- which the head mask then dutifully culls, and
  // the near arm vanishes along with the far one.
  //
  // Only the splay. The tilt is left at the dispensing default: solving it
  // here would trade a correct 8 degrees for whatever angle this particular
  // placeholder's straight arms happen to need, on every face.
  return {
    ...base,
    splay: solveSplay(
      scaleTemple({ hinge: frame.hingeLeft, tip: frame.tipLeft }, scale),
      Math.abs(earTargets(measurements, browHeightMm).left.x),
    ),
  };
}

/** The frame is drawn scaled, so the solve has to see scaled geometry. */
export function scaleTemple(temple: TempleGeometry, scale: number): TempleGeometry {
  const mul = (p: Point3): Point3 => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale });
  return { hinge: mul(temple.hinge), tip: mul(temple.tip) };
}

/**
 * Where the pupil sits in the lens, as a fraction of lens depth above centre.
 *
 * A fraction rather than a fixed millimetre offset, so it holds for a shallow
 * frame and a deep one alike. 0.24 puts the pupil in the upper quarter, which
 * is where glasses sit when worn -- a pupil on the geometric centre looks like
 * the frame has slid down the nose.
 *
 * Calibrated against a hand-adjusted fit on a real scan: it reproduces the
 * -15 mm that face was dialled to. Worth re-checking on a second face.
 */
const PUPIL_ABOVE_CENTRE = 0.24;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clampRange = (v: number, r: { min: number; max: number }) => clamp(v, r.min, r.max);
const toDegrees = (r: number) => (r * 180) / Math.PI;
