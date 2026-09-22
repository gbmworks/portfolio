/**
 * The guided capture: turn left and right, then nod up and down.
 *
 * The motion is not theatre. A single frontal frame gives one viewpoint's worth
 * of a monocular depth guess, and the parts of the face that matter most for
 * eyewear -- how far the temples sit back, how deep the nose bridge is, where
 * the ear tops are -- are exactly the parts a frontal view compresses. Sampling
 * across +/-30 degrees of yaw and +/-18 of pitch and averaging in head-local
 * space cancels most of that error.
 *
 * Capture is organised as a yaw/pitch bin grid. A pose only counts once per
 * bin, so lingering in one spot cannot swamp the average, and the progress
 * readout is simply how many bins are filled.
 */

import { headFrameFrom, rectify, type HeadFrame } from './headFrame';
import type { FaceSample } from './landmarker';

export type ScanStage = 'centre' | 'yaw' | 'pitch' | 'done';

/** Bin edges in degrees. Centre bin is deliberately narrow. */
const YAW_BINS = [-32, -20, -9, 9, 20, 32];
const PITCH_BINS = [-20, -9, 9, 20];

export interface ScanProgress {
  stage: ScanStage;
  /** 0..1 over the whole capture. */
  overall: number;
  /** 0..1 within the current stage. */
  stageProgress: number;
  /** Which way to move next, for the on-screen prompt. */
  hint: string;
  /** Live yaw/pitch in degrees, for the guidance dial. */
  yawDeg: number;
  pitchDeg: number;
  /** Set when the frame was rejected, with the reason. */
  warning: string | null;
  filledYaw: boolean[];
  filledPitch: boolean[];
}

interface Keyframe {
  rectified: Float32Array;
  weight: number;
}

const DEG = 180 / Math.PI;

function binOf(value: number, edges: number[]): number {
  for (let i = 0; i < edges.length - 1; i++) {
    if (value >= edges[i] && value < edges[i + 1]) return i;
  }
  return -1;
}

export class ScanSession {
  private yawSlots: (Keyframe | null)[] = Array(YAW_BINS.length - 1).fill(null);
  private pitchSlots: (Keyframe | null)[] = Array(PITCH_BINS.length - 1).fill(null);
  private centreFrames: Keyframe[] = [];
  /** The best near-frontal sample, kept whole for the portrait's proportions. */
  private bestCentre: { score: number; sample: FaceSample; frame: HeadFrame } | null = null;

  stage: ScanStage = 'centre';

  /** Frontal frames needed before the yaw stage unlocks. */
  private static readonly CENTRE_TARGET = 12;

  /**
   * Feed one tracked frame.
   *
   * Returns the progress to show. Rejected frames still return progress, with
   * `warning` set, so the UI can explain itself rather than just stalling.
   */
  push(sample: FaceSample): ScanProgress {
    const frame = headFrameFrom(sample.points);
    const yawDeg = frame.yaw * DEG;
    const pitchDeg = frame.pitch * DEG;
    const rollDeg = frame.roll * DEG;

    const warning = this.qualityWarning(sample, rollDeg);
    if (!warning) {
      const rectified = rectify(sample.points, frame);
      this.record(rectified, yawDeg, pitchDeg, sample, frame);
    }

    return this.progress(yawDeg, pitchDeg, warning);
  }

  /**
   * Reject frames that would corrupt the average.
   *
   * A blink collapses the eyelid contour, an open jaw moves a third of the
   * face oval, and heavy roll means the tragion pair is being measured across
   * a tilted axis. None of these are recoverable after averaging, so they are
   * screened here.
   */
  private qualityWarning(sample: FaceSample, rollDeg: number): string | null {
    const b = sample.blendshapes;
    const blink = Math.max(b.get('eyeBlinkLeft') ?? 0, b.get('eyeBlinkRight') ?? 0);
    if (blink > 0.45) return 'Hold your eyes open';
    const jaw = b.get('jawOpen') ?? 0;
    if (jaw > 0.25) return 'Close your mouth';
    if (Math.abs(rollDeg) > 14) return 'Keep your head upright';
    return null;
  }

  private record(
    rectified: Float32Array,
    yawDeg: number,
    pitchDeg: number,
    sample: FaceSample,
    frame: HeadFrame,
  ): void {
    const nearCentre = Math.abs(yawDeg) < 9 && Math.abs(pitchDeg) < 9;

    if (nearCentre) {
      // Frontal frames are the most trustworthy, so they are weighted up and
      // kept in quantity rather than one-per-bin.
      if (this.centreFrames.length < ScanSession.CENTRE_TARGET) {
        this.centreFrames.push({ rectified, weight: 2 });
      }
      const score = 1 / (1 + Math.abs(yawDeg) + Math.abs(pitchDeg));
      if (!this.bestCentre || score > this.bestCentre.score) {
        this.bestCentre = { score, sample, frame };
      }
    }

    if (this.stage === 'centre') {
      if (this.centreFrames.length >= ScanSession.CENTRE_TARGET) this.stage = 'yaw';
      return;
    }

    if (this.stage === 'yaw') {
      // Only count off-centre yaw while the head stays roughly level, so a
      // diagonal sweep does not fill a yaw bin with a pitched sample.
      if (Math.abs(pitchDeg) < 12) {
        const bin = binOf(yawDeg, YAW_BINS);
        if (bin >= 0 && !this.yawSlots[bin]) this.yawSlots[bin] = { rectified, weight: 1 };
      }
      if (this.yawSlots.every(Boolean)) this.stage = 'pitch';
      return;
    }

    if (this.stage === 'pitch') {
      if (Math.abs(yawDeg) < 12) {
        const bin = binOf(pitchDeg, PITCH_BINS);
        if (bin >= 0 && !this.pitchSlots[bin]) this.pitchSlots[bin] = { rectified, weight: 1 };
      }
      if (this.pitchSlots.every(Boolean)) this.stage = 'done';
    }
  }

  private progress(yawDeg: number, pitchDeg: number, warning: string | null): ScanProgress {
    const filledYaw = this.yawSlots.map(Boolean);
    const filledPitch = this.pitchSlots.map(Boolean);
    const centre = Math.min(1, this.centreFrames.length / ScanSession.CENTRE_TARGET);
    const yaw = filledYaw.filter(Boolean).length / filledYaw.length;
    const pitch = filledPitch.filter(Boolean).length / filledPitch.length;

    let stageProgress = centre;
    let hint = 'Look straight at the camera';
    if (this.stage === 'yaw') {
      stageProgress = yaw;
      hint = this.nextYawHint(filledYaw);
    } else if (this.stage === 'pitch') {
      stageProgress = pitch;
      hint = this.nextPitchHint(filledPitch);
    } else if (this.stage === 'done') {
      stageProgress = 1;
      hint = 'Scan complete';
    }

    return {
      stage: this.stage,
      overall: centre * 0.2 + yaw * 0.45 + pitch * 0.35,
      stageProgress,
      hint,
      yawDeg,
      pitchDeg,
      warning,
      filledYaw,
      filledPitch,
    };
  }

  private nextYawHint(filled: boolean[]): string {
    const half = filled.length / 2;
    const leftDone = filled.slice(Math.ceil(half)).every(Boolean);
    const rightDone = filled.slice(0, Math.floor(half)).every(Boolean);
    if (!rightDone) return 'Slowly turn your head to the right';
    if (!leftDone) return 'Now slowly turn to the left';
    return 'Back to centre';
  }

  private nextPitchHint(filled: boolean[]): string {
    const upDone = filled.slice(Math.ceil(filled.length / 2)).every(Boolean);
    const downDone = filled.slice(0, Math.floor(filled.length / 2)).every(Boolean);
    if (!downDone) return 'Slowly tip your chin down';
    if (!upDone) return 'Now tip your chin up';
    return 'Back to centre';
  }

  get complete(): boolean {
    return this.stage === 'done';
  }

  /**
   * Weighted mean of every accepted keyframe, in head-local space.
   *
   * Straight mean rather than median: the per-bin cap already removes the
   * dwell bias a median would be protecting against, and the mean keeps the
   * sub-pixel detail that the portrait's curvature depends on.
   */
  aggregate(): {
    mean: Float32Array;
    frontalMean: Float32Array;
    frontal: FaceSample | null;
    samples: number;
  } {
    const all: Keyframe[] = [
      ...this.centreFrames,
      ...(this.yawSlots.filter(Boolean) as Keyframe[]),
      ...(this.pitchSlots.filter(Boolean) as Keyframe[]),
    ];
    if (all.length === 0) {
      const empty = new Float32Array(478 * 3);
      return { mean: empty, frontalMean: empty, frontal: null, samples: 0 };
    }

    const mean = new Float32Array(all[0].rectified.length);
    let total = 0;
    for (const k of all) {
      total += k.weight;
      for (let i = 0; i < mean.length; i++) mean[i] += k.rectified[i] * k.weight;
    }
    for (let i = 0; i < mean.length; i++) mean[i] /= total;

    // A second average over the near-frontal frames only.
    //
    // Turning the head is what makes the *depth* measurements real, but it
    // makes the width measurements worse: at yaw the far tragion is partly
    // self-occluded and MediaPipe's estimate for it creeps inward, so folding
    // those frames into a width narrows the face by several millimetres. The
    // measurement code takes lateral spans from this one and depths from the
    // full average, which is the combination where each pose contributes what
    // it is actually good for.
    const frontalMean = new Float32Array(mean.length);
    if (this.centreFrames.length > 0) {
      for (const k of this.centreFrames) {
        for (let i = 0; i < frontalMean.length; i++) frontalMean[i] += k.rectified[i];
      }
      for (let i = 0; i < frontalMean.length; i++) frontalMean[i] /= this.centreFrames.length;
    } else {
      frontalMean.set(mean);
    }

    return {
      mean,
      frontalMean,
      frontal: this.bestCentre?.sample ?? null,
      samples: all.length,
    };
  }
}
