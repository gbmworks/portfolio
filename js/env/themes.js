/* ------------------------------------------------------------------
   Environment themes.

   ONE SKY.  There used to be four — a dark hall, a brass workshop, a
   neon horizon and a neutral studio — and hovering a slice cross-faded
   the whole sky and its image-based lighting from one to the next.
   That meant four equirect bakes, four PMREM chains, a dome shader
   sampling two skies per pixel, and a PMREM swap hidden under a dip in
   the exposure.

   Now the sky is baked once, from SKY below, and never changes.  What
   changes on hover is the *backdrop geometry* — the exploded
   assemblies, the gear train, the terrain and the character — which is
   what actually told the three worlds apart anyway.

   The per-sector entries below are what is left: scalars and colours,
   lerped on hover, costing nothing. They keep each world's mood without
   re-lighting the scene from a different map.

   bgI        how bright the sky dome is drawn behind the UI
   envI       scene.environmentIntensity — how hard it lights the glass
   fog        fog / horizon tint
   key, rim   directional light tints
   bounce     the accent uplight
   ------------------------------------------------------------------ */

const ACCENT = 0xff5a12;

/* The one sky, and the only place `shader` and `sat` still mean
   anything.  `shader` picks a branch of the procedural equirect shader
   in procedural.js — 0 studio, 1 foundry, 2 workshop, 3 neon — and
   `sat` desaturates it (0 = greyscale, 1 = its own colour).  Change
   these two numbers to re-light the whole site. */
export const SKY = {
  key: 'sky',        // the filename a real .hdr override would use
  shader: 0,         // 0 studio · 1 foundry · 2 workshop · 3 neon
  sat: 0.06          // 0 = greyscale, 1 = the shader's own colour
};

export const THEMES = {
  'neutral': {
    bgI: 0.70, envI: 1.05,
    fog: 0x0c0c10,
    key: 0xffffff, keyI: 1.35,
    rim: 0xc6c8d2, rimI: 0.75,
    bounce: ACCENT, bounceI: 9
  },

  /* a hard, bright hall: the strongest key, the coolest rim */
  'industrial-design': {
    bgI: 0.78, envI: 1.40,
    fog: 0x111114,
    key: 0xffffff, keyI: 1.55,
    rim: 0xbfc6d8, rimI: 0.70,
    bounce: ACCENT, bounceI: 16
  },

  /* warmer and dimmer — tungsten key, the rim pulled back */
  'technical-art': {
    bgI: 0.72, envI: 1.45,
    fog: 0x101010,
    key: 0xfff4ea, keyI: 1.40,
    rim: 0xd2d6dc, rimI: 0.60,
    bounce: ACCENT, bounceI: 14
  },

  /* the coldest key and the brightest sky, over the strongest bounce */
  'visualization': {
    bgI: 0.86, envI: 1.35,
    fog: 0x0d0d14,
    key: 0xeaf2ff, keyI: 1.30,
    rim: 0xe8e8f2, rimI: 0.95,
    bounce: ACCENT, bounceI: 18
  }
};

export const DEFAULT_THEME = 'neutral';
