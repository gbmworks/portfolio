/* ------------------------------------------------------------------
   Environment themes.

   The system is monochrome.  Each sector is told apart by the *shape*
   of its light — overhead strips, hanging bulbs, a horizon band — not
   by colour, and `sat` desaturates each baked sky down to near-grey.
   Push a theme's `sat` back towards 1 to bring its original hue back.

   The one colour in the palette is the fluorescent orange bounce
   sitting under everything, which is also the hover accent.

   shader     which branch of the procedural equirect shader to render
   sat        0 = greyscale, 1 = the shader's own colour
   bgI        how bright the sky dome is drawn behind the UI
   envI       scene.environmentIntensity — how hard it lights the glass
   fog        fog / horizon tint
   key, rim   directional light tints
   bounce     the accent uplight
   ------------------------------------------------------------------ */

const ACCENT = 0xff5a12;

export const THEMES = {
  'neutral': {
    shader: 0, sat: 0.06,
    bgI: 0.70, envI: 1.05,
    fog: 0x0c0c10,
    key: 0xffffff, keyI: 1.35,
    rim: 0xc6c8d2, rimI: 0.75,
    bounce: ACCENT, bounceI: 9
  },

  /* a dark hall under skylight strips, one furnace burning off-axis */
  'industrial-design': {
    shader: 1, sat: 0.08,
    bgI: 0.78, envI: 1.40,
    fog: 0x111114,
    key: 0xffffff, keyI: 1.55,
    rim: 0xbfc6d8, rimI: 0.70,
    bounce: ACCENT, bounceI: 16
  },

  /* hanging bulbs, steam, a wet floor — light in points, not planes */
  'technical-art': {
    shader: 2, sat: 0.08,
    bgI: 0.72, envI: 1.45,
    fog: 0x101010,
    key: 0xfff4ea, keyI: 1.40,
    rim: 0xd2d6dc, rimI: 0.60,
    bounce: ACCENT, bounceI: 14
  },

  /* one hard horizon and a low sun — light as a band */
  'visualization': {
    shader: 3, sat: 0.10,
    bgI: 0.86, envI: 1.35,
    fog: 0x0d0d14,
    key: 0xeaf2ff, keyI: 1.30,
    rim: 0xe8e8f2, rimI: 0.95,
    bounce: ACCENT, bounceI: 18
  }
};

export const DEFAULT_THEME = 'neutral';
