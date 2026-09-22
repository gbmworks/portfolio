/**
 * The interface's voice: short synthesised cues, no audio files.
 *
 * Synthesised rather than sampled for three reasons. It ships nothing -- no
 * megabyte of clips for sounds that last 90 milliseconds. It cannot be caught
 * half-loaded, so the first click sounds like the hundredth. And the pitch can
 * be *derived* from what the customer just did, which is the whole point:
 * dragging the shape wheel plays a run up a pentatonic scale rather than
 * firing the same click eight times. A sampled set cannot do that without
 * eight samples, and eight samples of the same click is noise.
 *
 * Everything here is deliberately quiet and deliberately short. A configurator
 * is used for minutes at a time; a cue that announces itself is one the
 * customer mutes, and a muted interface has no voice at all. Peak gain is
 * about 6% and nothing rings for longer than a fifth of a second.
 *
 * Nothing in here may ever throw into the UI. Audio is a decoration on a tool
 * that measures faces -- if the context will not start, the product still has
 * to work in silence.
 */

const STORAGE_KEY = 'eyewear.sound';

/**
 * A minor pentatonic run, in semitones from the root.
 *
 * Pentatonic because the customer controls the order: the shape wheel can be
 * dragged to any position, forwards or backwards, fast or slow. Any subset of
 * these intervals sounds intentional in any sequence, which a diatonic scale
 * cannot promise -- it has semitone neighbours that clash when two land close
 * together.
 */
const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17];

/** Root of that scale, Hz. A5 -- high enough to stay out of the way of speech. */
const ROOT = 440;

const semitone = (n: number): number => ROOT * Math.pow(2, n / 12);

let context: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = read();

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Private mode, or storage disabled. Sound on is the better default; the
    // toggle still works for this session.
    return true;
  }
}

/**
 * The audio graph, built on first use.
 *
 * Not at module load: a context created before a user gesture starts
 * `suspended` under every browser's autoplay policy, and some of them log a
 * warning for it. Every caller here is already inside a click or a drag, so
 * building it lazily means it is always allowed to start.
 */
function graph(): { context: AudioContext; master: GainNode } | null {
  if (!enabled) return null;
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.06;
      master.connect(context.destination);
    }
    // Browsers suspend the context when a tab is hidden, and returning to it
    // does not always resume automatically.
    if (context.state === 'suspended') void context.resume();
    return master ? { context, master } : null;
  } catch {
    return null;
  }
}

interface Voice {
  /** Hz. */
  frequency: number;
  type?: OscillatorType;
  /** Seconds. */
  attack?: number;
  decay?: number;
  /** Relative to the master gain. */
  level?: number;
  /** Seconds to wait before this voice starts. */
  delay?: number;
  /** Lowpass corner, Hz. Rounds off the edge a bare oscillator has. */
  cutoff?: number;
}

/**
 * One plucked voice: a fast attack and an exponential tail.
 *
 * Exponential rather than linear because that is how struck and plucked
 * instruments actually decay, and a linear fade on a tone this short reads as
 * a click being cut off rather than a note ending.
 */
function pluck(voice: Voice): void {
  const g = graph();
  if (!g) return;
  try {
    const { context: ctx, master: out } = g;
    const now = ctx.currentTime + (voice.delay ?? 0);
    const attack = voice.attack ?? 0.004;
    const decay = voice.decay ?? 0.12;

    const osc = ctx.createOscillator();
    osc.type = voice.type ?? 'sine';
    osc.frequency.setValueAtTime(voice.frequency, now);

    const gain = ctx.createGain();
    const level = voice.level ?? 1;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.cutoff ?? 5200, now);
    filter.Q.value = 0.7;

    osc.connect(gain).connect(filter).connect(out);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  } catch {
    /* A cue that fails is silence, never an error. */
  }
}

/* ------------------------------------------------------------- the cues -- */

export const sound = {
  /** Any ordinary control: a step, a button, a view. */
  tap(): void {
    pluck({ frequency: semitone(12), type: 'triangle', decay: 0.07, level: 0.5, cutoff: 3400 });
  },

  /**
   * Moving through the frame shapes.
   *
   * `index` walks the scale, so the wheel is an instrument rather than eight
   * copies of one click. Called on every settled step of a drag, which is why
   * it is the shortest cue here.
   */
  shape(index: number): void {
    const note = PENTATONIC[((index % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length];
    pluck({ frequency: semitone(note), type: 'triangle', decay: 0.16, level: 0.85, cutoff: 4200 });
  },

  /**
   * Choosing a colour or a finish.
   *
   * A fifth, struck as two voices a few milliseconds apart rather than one
   * note, so colour reads as *warmer and rounder* than shape without being
   * louder. Sine, not triangle: fewer harmonics, softer edge.
   */
  colour(): void {
    pluck({ frequency: semitone(0), type: 'sine', decay: 0.2, level: 0.75, cutoff: 2600 });
    pluck({ frequency: semitone(7), type: 'sine', decay: 0.26, level: 0.45, delay: 0.035, cutoff: 2600 });
  },

  /** Committing: the next step, saving. Rises, where everything else falls. */
  advance(): void {
    pluck({ frequency: semitone(7), type: 'triangle', decay: 0.1, level: 0.6, cutoff: 3600 });
    pluck({ frequency: semitone(14), type: 'triangle', decay: 0.18, level: 0.5, delay: 0.06, cutoff: 3600 });
  },

  /* ----------------------------------------------------------- the switch */

  get enabled(): boolean {
    return enabled;
  },

  /** Returns the new state, so a caller can render it without asking again. */
  toggle(): boolean {
    enabled = !enabled;
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      /* The choice still holds for this session. */
    }
    // Confirm out loud, because silence is the one state that cannot confirm
    // itself -- switching on with no sound is indistinguishable from broken.
    if (enabled) sound.tap();
    return enabled;
  },
};
