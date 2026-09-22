/**
 * Single source of truth.
 *
 * The scan result is kept as a plain object rather than recomputed per view:
 * the portrait, the shape read-out, the frame sizing and the ear targets all
 * derive from the same averaged mesh, and deriving them twice is how two
 * screens end up quietly disagreeing about how wide someone's face is.
 */

import { create } from 'zustand';

import { classify, type FaceShapeResult } from '../face/faceShape';
import { measure, type FaceMeasurements } from '../face/measure';
import { P } from '../face/landmarks';
import type { FrameAppearance } from '../ar/arScene';
import { DEFAULT_FIT, initialFit, type FitSettings } from '../ar/fit';
import type { LoadedFrame } from '../frame/loadFrame';
import {
  DEFAULT_APPEARANCE as FRAME_APPEARANCE_DEFAULT,
} from '../ar/arScene';
import {
  DEFAULT_CONFIGURATION,
  LENS_TYPES,
  METALS,
  frameColour,
  lensColour,
  templeColourSpec,
  type StepId,
  type Configuration,
} from '../editor/options';

export type Route = 'landing' | 'editor' | 'scan' | 'result' | 'tryon';

export interface ScanResult {
  /** Averaged head-local mesh, interocular distance normalised to 1. */
  mean: Float32Array;
  measurements: FaceMeasurements;
  shape: FaceShapeResult;
  samples: number;
  takenAt: number;
}

interface AppState {
  route: Route;
  scan: ScanResult | null;
  fit: FitSettings;
  appearance: FrameAppearance;

  /** The whole design. The single source of truth for what is being built. */
  config: Configuration;
  /** Which step of the editor is open. */
  step: StepId;

  /**
   * The loaded frame, kept here so the fit defaults can be solved against its
   * real geometry rather than against the nominal numbers.
   */
  frame: LoadedFrame | null;
  /**
   * Whether the customer has moved a fit control.
   *
   * Once they have, arriving scan or frame data must not quietly overwrite
   * their adjustment -- having the frame jump after you have just positioned
   * it by hand is the most annoying thing a fitting tool can do.
   */
  fitEdited: boolean;

  go: (route: Route) => void;
  completeScan: (mean: Float32Array, frontalMean: Float32Array, samples: number) => void;
  clearScan: () => void;
  adoptFrame: (frame: LoadedFrame) => void;
  setFit: (patch: Partial<FitSettings>) => void;
  resetFit: () => void;
  setAppearance: (patch: Partial<FrameAppearance>) => void;
  patchConfig: (patch: { [K in keyof Configuration]?: Partial<Configuration[K]> }) => void;
  setStep: (id: StepId) => void;
}

/** Solve the baseline fit from whatever of scan and frame we currently have. */
function baselineFit(scan: ScanResult | null, frame: LoadedFrame | null): FitSettings {
  if (!scan || !frame) return DEFAULT_FIT;
  // Brow height above the nasion, which places the ear contact point.
  const browHeight =
    (scan.mean[P.browRight * 3 + 1] - scan.mean[P.nasion * 3 + 1]) * scan.measurements.mmPerUnit;
  return initialFit(scan.measurements, frame, browHeight);
}

export const useStore = create<AppState>((set, get) => ({
  route: 'landing',
  scan: null,
  fit: DEFAULT_FIT,
  appearance: appearanceFor(DEFAULT_CONFIGURATION),
  config: DEFAULT_CONFIGURATION,
  step: 'shape',
  frame: null,
  fitEdited: false,

  go: (route) => set({ route }),

  completeScan: (mean, frontalMean, samples) => {
    const measurements = measure(mean, frontalMean);
    const scan: ScanResult = {
      mean,
      measurements,
      shape: classify(measurements),
      samples,
      takenAt: Date.now(),
    };
    set({
      scan,
      // A fresh scan is a fresh face, so the fit starts over even if the
      // previous one had been adjusted.
      fit: baselineFit(scan, get().frame),
      fitEdited: false,
      route: 'result',
    });
  },

  clearScan: () => set({ scan: null, fit: DEFAULT_FIT, fitEdited: false, route: 'landing' }),

  adoptFrame: (frame) => {
    const { scan, fitEdited } = get();
    set({ frame, fit: fitEdited ? get().fit : baselineFit(scan, frame) });
  },

  setFit: (patch) => set({ fit: { ...get().fit, ...patch }, fitEdited: true }),

  resetFit: () => set({ fit: baselineFit(get().scan, get().frame), fitEdited: false }),

  setAppearance: (patch) => set({ appearance: { ...get().appearance, ...patch } }),

  /**
   * Merge one level deep.
   *
   * A plain spread would replace a whole component's settings with whichever
   * single field was being edited, so changing a lens tint would silently
   * reset the prescription.
   */
  patchConfig: (patch) => {
    const current = get().config;
    // Written key by key rather than with a mapped loop: TypeScript cannot
    // prove that `patch[key]` belongs to the same group as `current[key]`
    // when the key is only known to be one of the four, and widening it to
    // satisfy the checker would throw away the protection this gives.
    set((state) => {
      const next: Configuration = {
        frame: patch.frame ? { ...current.frame, ...patch.frame } : current.frame,
        lens: patch.lens ? { ...current.lens, ...patch.lens } : current.lens,
        temple: patch.temple ? { ...current.temple, ...patch.temple } : current.temple,
        bridge: patch.bridge ? { ...current.bridge, ...patch.bridge } : current.bridge,
      };
      void state;
      return { config: next, appearance: appearanceFor(next) };
    });
  },

  setStep: (step) => set({ step }),
}));

/**
 * The try-on's materials, derived from the design.
 *
 * Deriving rather than storing is the point: there is one design, and the
 * editor and the try-on are two views of it. Keeping a separate appearance
 * that the editor had to remember to push across is exactly how the two end
 * up showing different colours.
 */
export function appearanceFor(config: Configuration): FrameAppearance {
  const lens = LENS_TYPES[config.lens.type];
  return {
    ...FRAME_APPEARANCE_DEFAULT,
    // The whole colour, not its hex. A hex alone loses the texture map, the
    // translucency and the optical depth -- which is how the try-on came to
    // render tortoise as a near-white frame: that hex *is* near-white, and
    // the map it exists to carry never arrived.
    front: frameColour(config),
    temple: templeColourSpec(config),
    lensTint: lensColour(config),
    lensOpacity: lens.opacity,
    lensReflectivity: lens.reflectivity,
    // The try-on used to keep the default gold here whatever the customer
    // picked, so the metal was the one choice the editor could not show them
    // on their own face.
    bridgeMetal: METALS[config.bridge.metal],
    templeMetal: METALS[config.temple.metal],
  };
}


