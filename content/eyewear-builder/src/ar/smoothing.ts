/**
 * One Euro filter, for the head pose.
 *
 * Landmark output jitters by a pixel or two even on a perfectly still face,
 * and glasses anchored straight to it visibly shiver. A fixed low-pass fixes
 * the shiver and replaces it with lag, which is worse -- the glasses swim
 * behind the head on every turn.
 *
 * One Euro adapts: the cutoff rises with the speed of the signal, so it
 * filters hard when the head is still and barely at all when it moves. It is
 * the standard choice for exactly this problem (Casiez, Roussel & Vogel,
 * CHI 2012) and is about thirty lines.
 */

export class OneEuro {
  private prev: number | null = null;
  private prevDerivative = 0;
  private prevTime = 0;

  constructor(
    /** Cutoff at zero speed, Hz. Lower is steadier and laggier. */
    private readonly minCutoff = 1.2,
    /** How much the cutoff opens up with speed. */
    private readonly beta = 0.012,
    /** Cutoff for the speed estimate itself. */
    private readonly derivativeCutoff = 1.0,
  ) {}

  filter(value: number, timestampMs: number): number {
    if (this.prev === null) {
      this.prev = value;
      this.prevTime = timestampMs;
      return value;
    }

    const dt = Math.max(1e-3, (timestampMs - this.prevTime) / 1000);
    this.prevTime = timestampMs;
    const rate = 1 / dt;

    const derivative = (value - this.prev) * rate;
    const smoothedDerivative = lowpass(
      derivative,
      this.prevDerivative,
      alpha(rate, this.derivativeCutoff),
    );
    this.prevDerivative = smoothedDerivative;

    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    const result = lowpass(value, this.prev, alpha(rate, cutoff));
    this.prev = result;
    return result;
  }

  reset(): void {
    this.prev = null;
    this.prevDerivative = 0;
  }
}

function alpha(rate: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau * rate);
}

const lowpass = (value: number, previous: number, a: number) => a * value + (1 - a) * previous;

/** A filter per component, for vectors and quaternions. */
export class OneEuroVec {
  private readonly filters: OneEuro[];

  constructor(size: number, minCutoff?: number, beta?: number) {
    this.filters = Array.from({ length: size }, () => new OneEuro(minCutoff, beta));
  }

  filter(values: number[], timestampMs: number, out: number[] = []): number[] {
    for (let i = 0; i < this.filters.length; i++) {
      out[i] = this.filters[i].filter(values[i], timestampMs);
    }
    return out;
  }

  reset(): void {
    for (const f of this.filters) f.reset();
  }
}
