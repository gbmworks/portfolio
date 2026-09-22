/**
 * Everything the customer can choose, in one place.
 *
 * Deliberately a trimmed version of the flowchart. The full tree has frame
 * material, hardware, temple engraving, lens configuration and a prescription
 * form; this keeps the four components and the choices that visibly change the
 * product, because an editor whose controls mostly do nothing you can see is
 * worse than a smaller one that is honest.
 *
 * Values are data only -- no three.js in here -- so a configuration can be
 * serialised, priced and diffed. `materials.ts` turns them into materials.
 */

import {
  DEFAULT_BRIDGE_OPTION,
  DEFAULT_FRONT_SHAPE,
  DEFAULT_TEMPLE_DESIGN,
  TEMPLE_DESIGNS,
  angleOf,
} from '../frame/shapes';

export type ComponentId = 'frame' | 'lens' | 'temple' | 'bridge';

export type StepId = 'shape' | 'colour' | 'lens' | 'temple' | 'bridge';

/**
 * The editor as an ordered walk, not a pile of panels.
 *
 * Numbered steps because the decisions genuinely have an order -- the shape
 * settles what you are buying, the colour dresses it, and the lens and fit
 * follow -- and because a customer who does not know what a pantoscopic tilt
 * is still knows what "3 of 5" means. Every step stays clickable at any time,
 * so it guides without trapping anyone.
 *
 * `component` is which piece of geometry the step is about, used to highlight
 * it in the viewer and to let clicking a part jump to the right step.
 */
export const STEPS: {
  id: StepId;
  label: string;
  blurb: string;
  component: ComponentId;
}[] = [
  { id: 'shape', label: 'Frame shape', blurb: 'Choose the silhouette of the front.', component: 'frame' },
  { id: 'colour', label: 'Frame colour', blurb: 'Choose the colour and finish.', component: 'frame' },
  { id: 'lens', label: 'Lens', blurb: 'Tint, finish and prescription.', component: 'lens' },
  { id: 'temple', label: 'Temple', blurb: 'Arm design, colour and metal.', component: 'temple' },
  { id: 'bridge', label: 'Bridge', blurb: 'Profile, shape and how it sits.', component: 'bridge' },
];

/* ------------------------------------------------------------- frame ---- */

export type FrameColourId =
  | 'black'
  | 'tortoise'
  | 'brown'
  | 'olive'
  | 'navy'
  | 'crystal'
  | 'blue'
  | 'smoke'
  | 'amber'
  | 'red';

export interface Colour {
  label: string;
  hex: string;
  swatch: string;
  /** Translucent acetates render with a little transparency. */
  translucent?: boolean;
  /** Albedo map under `public/textures/`, for patterned acetates. */
  map?: string;
  /** Tiling for that map. Acetate sheet is milled, so the pattern is fine. */
  mapRepeat?: number;
  /**
   * How far light travels into the material, 0..1.
   *
   * What makes a tortoise shell read as depth rather than as a printed
   * pattern: real acetate is not opaque, and a few millimetres of travel is
   * the difference between a photograph of tortoise and the thing itself.
   */
  transmission?: number;
  /** Optical path in millimetres. The geometry is unscaled mm, so this is mm. */
  thickness?: number;
}

export const FRAME_COLOURS: Record<FrameColourId, Colour> = {
  black: { label: 'Black', hex: '#15151a', swatch: 'linear-gradient(145deg,#3b3b42,#0b0b0e)' },
  tortoise: {
    label: 'Tortoise',
    // Near-white base so the map carries the colour rather than being tinted
    // brown twice over.
    hex: '#c9c6c2',
    // The sheet itself, not an impression of it. A gradient has to stand in
    // for a pattern the customer is specifically choosing *because* of its
    // pattern, and no two-stop ramp does that.
    swatch: `url("${import.meta.env.BASE_URL}textures/tortoise.png") center / cover`,
    map: 'tortoise.png',
    // One tile, because the model's own unwrap already lays the front out
    // across the whole 0-1 square. Repeating it now would be exactly the "UV
    // manipulation" the authored coordinates exist to avoid.
    mapRepeat: 1,
    transmission: 0.42,
    thickness: 3.2,
  },
  brown: { label: 'Brown', hex: '#3b2306', swatch: 'linear-gradient(145deg,#6b431a,#2a1804)' },
  olive: { label: 'Olive', hex: '#475935', swatch: 'linear-gradient(145deg,#71855a,#2e3a22)' },
  navy: { label: 'Navy', hex: '#041c4f', swatch: 'linear-gradient(145deg,#28417d,#020e2b)' },
  crystal: {
    label: 'Crystal',
    hex: '#8e8ead',
    swatch: 'linear-gradient(145deg,#c3c3da,#5e5e7c)',
    translucent: true,
  },
  blue: {
    label: 'Blue',
    hex: '#182f8a',
    swatch: 'linear-gradient(145deg,#4a63c7,#0c1a4f)',
    translucent: true,
  },
  smoke: {
    label: 'Smoke',
    hex: '#5b5b60',
    swatch: 'linear-gradient(145deg,#8e8e95,#3a3a3f)',
    translucent: true,
  },
  amber: {
    label: 'Amber',
    hex: '#6b3400',
    swatch: 'linear-gradient(145deg,#a85d1c,#3d1d00)',
    translucent: true,
  },
  red: {
    label: 'Red',
    hex: '#730000',
    swatch: 'linear-gradient(145deg,#b02020,#3d0000)',
    translucent: true,
  },
};

/** Swatch groups, so the palette reads as a range rather than a wall. */
export const COLOUR_GROUPS: { label: string; ids: FrameColourId[] }[] = [
  { label: 'Solid', ids: ['black', 'tortoise', 'brown', 'olive', 'navy'] },
  { label: 'Translucent', ids: ['crystal', 'blue', 'smoke', 'amber', 'red'] },
];

/*
 * Frame size used to be a small / medium / large choice here. It was removed:
 * three per cent either side of the modelled width is a fit adjustment, not a
 * design decision, and it belongs with the other fit controls in the try-on
 * rather than sitting beside the shape as though it changed the product.
 */

/* -------------------------------------------------------------- lens ---- */

export type LensTypeId = 'clear' | 'sun' | 'bluelight';
export type LensColourId =
  | 'grey'
  | 'smoke'
  | 'brown'
  | 'amber'
  | 'green'
  | 'olive'
  | 'blue'
  | 'slate'
  | 'rose'
  | 'violet';
export type PrescriptionId = 'plano' | 'single' | 'progressive';

/**
 * Three lens types, all built on the same two surfaces that read well in the
 * viewport.
 *
 * `clear` and `sun` share one surface and differ only in what colour goes on
 * it -- a clear lens is a sun lens with the tint taken out, which is close to
 * true and means the two cannot drift apart visually. `bluelight` uses the
 * glassier, more reflective surface, with the tint pulled most of the way to
 * neutral: a blue-light filter is a faint cast, not a colour.
 */
export const LENS_TYPES: Record<
  LensTypeId,
  {
    label: string;
    /** Whether the customer picks the tint colour. */
    tinted: boolean;
    opacity: number;
    reflectivity: number;
    /**
     * Alpha for the blended fallback.
     *
     * Used wherever transmission cannot run -- the try-on, where the camera
     * feed lives behind the canvas rather than in the scene, so there is
     * nothing in the transmission buffer for a lens to refract. The editor's
     * `glass` path ignores this and opens the body up with `transmission`
     * instead, so a glass type needs a *believable* number here rather than a
     * placeholder: setting it to 1 rendered the try-on's clear lens as a solid
     * grey card.
     */
    /** Fixed colour for untinted types. */
    fixed?: string;
    /** Fraction of the chosen colour's saturation to keep. */
    saturation?: number;
    /**
     * Render as refracting glass rather than as a faded fill.
     *
     * Alpha blending multiplies the *whole* shaded result by opacity, the
     * specular highlight along with the body -- so a lens made transparent
     * that way loses exactly the thing that makes glass look like glass, and
     * ends up reading as cellophane. Transmission keeps the surface fully
     * lit and lets light through the volume instead, which is what a real
     * lens does.
     */
    glass?: boolean;
    /** How much light passes through, for `glass` types. */
    transmission?: number;
  }
> = {
  clear: {
    label: 'Clear',
    tinted: false,
    // The blue-light surface -- the glassiest of the three -- in neutral
    // grey, with the body opened up by transmission in the editor and by this
    // alpha everywhere else. Low, because clear glass is almost nothing but
    // its highlights.
    opacity: 0.12,
    reflectivity: 0.75,
    fixed: '#666565',
    glass: true,
    transmission: 0.96,
  },
  sun: { label: 'Sun', tinted: true, opacity: 0.68, reflectivity: 0.55 },
  bluelight: {
    label: 'Blue light',
    tinted: true,
    opacity: 0.76,
    reflectivity: 0.75,
    saturation: 0.2,
  },
};

export const LENS_COLOURS: Record<LensColourId, { label: string; hex: string }> = {
  grey: { label: 'Grey', hex: '#4a4a4f' },
  smoke: { label: 'Smoke', hex: '#2b2b2f' },
  // Darker than it was: at the old value a brown sun lens read as amber.
  brown: { label: 'Brown', hex: '#4a3220' },
  amber: { label: 'Amber', hex: '#7a4a18' },
  green: { label: 'Green', hex: '#33452f' },
  olive: { label: 'Olive', hex: '#4e4a24' },
  blue: { label: 'Blue', hex: '#2c3f5c' },
  slate: { label: 'Slate', hex: '#3a4a55' },
  rose: { label: 'Rose', hex: '#5c2f3a' },
  violet: { label: 'Violet', hex: '#3d2f5c' },
};

/**
 * The colour a lens actually renders in.
 *
 * Desaturation is done here rather than by listing a second palette, so the
 * blue-light tints can never drift out of step with the sun ones.
 */
export function lensColour(config: Configuration): string {
  const type = LENS_TYPES[config.lens.type];
  if (!type.tinted) return type.fixed ?? '#eef1f3';
  const hex = config.lens.customColour ?? LENS_COLOURS[config.lens.colour].hex;
  return type.saturation === undefined ? hex : desaturate(hex, type.saturation);
}

/**
 * The acetate a part actually renders as.
 *
 * A custom colour replaces the palette entry's hex but keeps its map and
 * transmission, so dialling in a tortoise tint still looks like tortoise
 * rather than losing the pattern.
 */
export function frameColour(config: Configuration): Colour {
  const base = FRAME_COLOURS[config.frame.colour];
  return config.frame.customColour ? { ...base, hex: config.frame.customColour } : base;
}

export function templeColourSpec(config: Configuration): Colour {
  const id = templeColour(config);
  const base = FRAME_COLOURS[id];

  // The arms' own custom colour wins outright. Mixing one is a deliberate act
  // and it is the thing most recently chosen, so it also ends the match with
  // the front -- otherwise a later change to the front would silently throw
  // the mixed colour away.
  if (config.temple.customColour) return { ...base, hex: config.temple.customColour };

  // Otherwise a custom *front* colour carries across only while the arms are
  // set to match it; a deliberately contrasting arm keeps its palette colour.
  return config.temple.colour === 'match' && config.frame.customColour
    ? { ...base, hex: config.frame.customColour }
    : base;
}

/** Pull a hex colour toward its own grey, keeping `keep` of the chroma. */
function desaturate(hex: string, keep: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  // Rec. 709 luma: a flat mean turns a dark blue into a mid grey.
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mix = (c: number) => Math.round(luma + (c - luma) * keep);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0')}`;
}

export const PRESCRIPTIONS: Record<PrescriptionId, { label: string; detail: string }> = {
  plano: { label: 'Non-prescription', detail: 'Plano — no correction' },
  single: { label: 'Single vision', detail: 'One correction across the lens' },
  progressive: { label: 'Progressive', detail: 'Distance, intermediate and near' },
};

/* ------------------------------------------------------------ temple ---- */

/** `match` follows the front, so changing the frame colour changes both. */
export type TempleColourId = 'match' | FrameColourId;

/*
 * Temple length used to be a 130-150 mm slider here. It was removed: the arm
 * is not modelled as a length, so the control could only stretch the mesh
 * along its own axis, and a stretched arm is a *distorted* arm rather than a
 * longer one -- the tip bend flattens out as it goes. The four authored
 * designs are the real choice; a fitted length belongs with the other fit
 * controls in the try-on, against a measured face.
 */

/* ------------------------------------------------------------ metal ----- */

export type MetalId = 'silver' | 'gunmetal' | 'gold' | 'black';

/**
 * Finishes for the metalwork.
 *
 * Roughness varies with the finish as well as the colour: gunmetal and black
 * are brushed or coated and scatter more, polished silver and gold less. A
 * palette that only changed the tint would read as four colours of the same
 * chrome.
 *
 * Applied to every metal part, not the bridge alone. The hinges are small and
 * half hidden, but a gold bridge above silver hinges reads as a mistake
 * rather than as a choice.
 */
export const METALS: Record<MetalId, { label: string; hex: string; roughness: number }> = {
  silver: { label: 'Silver', hex: '#cfd2d6', roughness: 0.18 },
  gunmetal: { label: 'Gunmetal', hex: '#70757e', roughness: 0.3 },
  gold: { label: 'Gold', hex: '#b99748', roughness: 0.22 },
  // Not actually black: a true black metal has nothing to reflect and goes
  // flat and dead under any lighting. Lifted again from #1e1f22 -- even a
  // very dark grey loses its form against a dark acetate front.
  black: { label: 'Black', hex: '#3a3c42', roughness: 0.34 },
};

/* ------------------------------------------------------------ bridge ---- */

export const BRIDGE_HEIGHT = { min: -4, max: 4, step: 0.5 };

/* ----------------------------------------------------- configuration ---- */

export interface Configuration {
  /**
   * `customColour` on either group overrides the palette choice.
   *
   * Written only by the temporary HSB picker; drop both fields with it.
   */
  frame: { shapeAngle: number; colour: FrameColourId; customColour?: string | null };
  lens: {
    type: LensTypeId;
    colour: LensColourId;
    prescription: PrescriptionId;
    customColour?: string | null;
  };
  temple: {
    colour: TempleColourId;
    /** Overrides `colour`, and breaks the match with the front. */
    customColour?: string | null;
    /** One of `TEMPLE_DESIGNS`. */
    design: string;
    /** Finish for the wire and the hinges; independent of the bridge. */
    metal: MetalId;
  };
  bridge: { option: string; height: number; metal: MetalId };
}

export const DEFAULT_CONFIGURATION: Configuration = {
  frame: { shapeAngle: angleOf(DEFAULT_FRONT_SHAPE), colour: 'black' },
  lens: { type: 'clear', colour: 'grey', prescription: 'plano' },
  temple: { colour: 'match', design: DEFAULT_TEMPLE_DESIGN, metal: 'silver' },
  bridge: { option: DEFAULT_BRIDGE_OPTION, height: 0, metal: 'silver' },
};

/** Label of the selected arm design, for the price breakdown. */
export function templeDesignLabel(config: Configuration): string {
  return (
    TEMPLE_DESIGNS.find((d) => d.id === config.temple.design)?.label ?? TEMPLE_DESIGNS[0].label
  );
}

/** The colour a temple actually renders in, resolving `match`. */
export function templeColour(config: Configuration): FrameColourId {
  return config.temple.colour === 'match' ? config.frame.colour : config.temple.colour;
}

/* ---------------------------------------------------------- pricing ----- */

export const CURRENCY = '₹';

/**
 * The most a fully loaded configuration may come to.
 *
 * A ceiling on the *total*, not on any one line, so the tables below are
 * scaled to fit underneath it rather than clamped at the end. Clamping would
 * be the easy way and it lies to the customer: two different configurations
 * would price the same and an upgrade would appear to be free.
 */
export const PRICE_CEILING = 4000;

const BASE_FRAME = 2000;
const LENS_PRICE: Record<LensTypeId, number> = {
  clear: 350,
  sun: 600,
  bluelight: 700,
};
const PRESCRIPTION_PRICE: Record<PrescriptionId, number> = {
  plano: 0,
  single: 400,
  progressive: 750,
};
/**
 * Gold plating is the only finish that costs anything extra.
 *
 * Charged per group -- bridge, and wire-plus-hinges -- because they are plated
 * separately and a customer who picks gold for both is buying twice as much
 * of it.
 */
const METAL_PRICE: Record<MetalId, number> = {
  silver: 0,
  gunmetal: 0,
  black: 0,
  gold: 250,
};

/**
 * The worst case, derived from the tables rather than remembered.
 *
 * Every price here is a number someone will eventually edit, and the ceiling
 * is an invariant across all of them that no single edit looks like it
 * breaks. Computing the maximum from the tables themselves means the check
 * below still means something after that edit -- a hand-checked comment would
 * not. Metal counts twice: the bridge and the temple group are chosen
 * separately and can both be gold.
 */
function maxConfiguredTotal(): number {
  const dearest = (prices: Record<string, number>) => Math.max(...Object.values(prices));
  return (
    BASE_FRAME +
    dearest(LENS_PRICE) +
    2 * dearest(METAL_PRICE) +
    dearest(PRESCRIPTION_PRICE)
  );
}

if (import.meta.env.DEV && maxConfiguredTotal() > PRICE_CEILING) {
  console.error(
    `[price] the dearest configuration comes to ${maxConfiguredTotal()}, over the ` +
      `${PRICE_CEILING} ceiling. Scale the tables in options.ts down rather than ` +
      'clamping the total.',
  );
}

export interface PriceLine {
  id: string;
  label: string;
  detail: string;
  amount: number;
}

export function computePrice(
  config: Configuration,
  shapeLabel: string,
  bridgeLabel: string,
): { lines: PriceLine[]; total: number } {
  const lines: PriceLine[] = [
    {
      id: 'frame',
      label: 'Frame',
      detail: `${shapeLabel} · ${FRAME_COLOURS[config.frame.colour].label}`,
      amount: BASE_FRAME,
    },
    {
      id: 'lens',
      label: 'Lens',
      detail: LENS_TYPES[config.lens.type].tinted
        ? `${LENS_TYPES[config.lens.type].label} · ${LENS_COLOURS[config.lens.colour].label}`
        : LENS_TYPES[config.lens.type].label,
      amount: LENS_PRICE[config.lens.type],
    },
    {
      id: 'temple',
      label: 'Temple',
      detail: `${templeDesignLabel(config)} · ${config.temple.colour === 'match' ? 'Matched' : FRAME_COLOURS[config.temple.colour].label} · ${METALS[config.temple.metal].label}`,
      amount: METAL_PRICE[config.temple.metal],
    },
    {
      id: 'bridge',
      label: 'Bridge',
      detail: `${bridgeLabel} · ${METALS[config.bridge.metal].label}`,
      amount: METAL_PRICE[config.bridge.metal],
    },
    {
      id: 'prescription',
      label: 'Prescription',
      detail: PRESCRIPTIONS[config.lens.prescription].label,
      amount: PRESCRIPTION_PRICE[config.lens.prescription],
    },
  ];

  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

export function formatPrice(amount: number): string {
  return `${CURRENCY} ${amount.toLocaleString('en-IN')}`;
}
