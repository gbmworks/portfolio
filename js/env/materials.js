/* ------------------------------------------------------------------
   Material library.

   The whole site is monochrome: every surface is glass, chrome or
   smoke, and the only colour in the system is one fluorescent orange
   that appears on hover.  Each world is told apart by the *shape* of
   its light and its contents, not by hue.

   Transmission (real refraction) is expensive — it costs one extra
   scene render per frame, shared across every transmissive material —
   so it is spent on a handful of hero surfaces and everything else
   leans on chrome and iridescence, which are free.
   ------------------------------------------------------------------ */

import * as THREE from 'three';

export const PALETTE = {
  accent:     0xff5a12,      // fluorescent orange
  accentGlow: 0xff9048,
  ink:        0xf4f2f0,
  chrome:     0xd8d8de,
  steel:      0x8e8e96,
  graphite:   0x3a3a42,
  smoke:      0x1c1c22,
  void:       0x0d0d11
};

export const ACCENT_CSS = '#ff5a12';
export const ACCENT_GLOW_CSS = '#ff9048';

/* Refraction costs an extra scene render every frame. Phones and
   trackpad-less touch devices get the look without the pass: the glass
   keeps its tint and its environment reflections, and simply becomes
   translucent instead of refractive. */
export const LOW_POWER =
  matchMedia('(max-width: 900px), (pointer: coarse)').matches;

const phys = (o) => {
  if (LOW_POWER && o.transmission) {
    o = { ...o, transmission: 0, opacity: Math.min(1, 0.45 + o.roughness * 0.5) };
  }
  return new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 1, ...o });
};

/* --- glass ------------------------------------------------------- */

/** optically clear, sharp refraction */
export function clearGlass(tint = 0xffffff, opts = {}) {
  return phys({
    color: tint,
    metalness: 0,
    roughness: 0.02,
    transmission: 1,
    thickness: 1.1,
    ior: 1.52,
    specularIntensity: 1,
    envMapIntensity: 1.5,
    ...opts
  });
}

/** half-there glass — still reads as a solid form */
export function translucentGlass(tint = 0xdcdce2, opts = {}) {
  return phys({
    color: tint,
    metalness: 0,
    roughness: 0.14,
    transmission: 0.78,
    thickness: 1.6,
    ior: 1.46,
    attenuationColor: new THREE.Color(0x9aa0aa),
    attenuationDistance: 3.5,
    envMapIntensity: 1.35,
    ...opts
  });
}

/** frosted / sandblasted — blurs whatever is behind it */
export function frostedGlass(tint = 0xc8c8d0, opts = {}) {
  return phys({
    color: tint,
    metalness: 0,
    roughness: 0.52,
    transmission: 0.9,
    thickness: 2.0,
    ior: 1.45,
    envMapIntensity: 1.2,
    ...opts
  });
}

/* --- metal ------------------------------------------------------- */

/** mirror chrome */
export function chrome(tint = PALETTE.chrome, opts = {}) {
  return phys({
    color: tint,
    metalness: 1,
    roughness: 0.045,
    envMapIntensity: 1.7,
    ...opts
  });
}

/** blasted / satin metal */
export function brushedChrome(tint = PALETTE.steel, opts = {}) {
  return phys({
    color: tint,
    metalness: 1,
    roughness: 0.30,
    envMapIntensity: 1.45,
    ...opts
  });
}

/** dark machined graphite, for the parts that should sit back */
export function graphite(tint = PALETTE.graphite, opts = {}) {
  return phys({
    color: tint,
    metalness: 0.85,
    roughness: 0.42,
    envMapIntensity: 1.1,
    ...opts
  });
}

/* --- thin-film --------------------------------------------------- */

/** iridescent chrome — the film shifts hue with viewing angle */
export function iridescent(tint = 0xe6e6ee, opts = {}) {
  return phys({
    color: tint,
    metalness: 1,
    roughness: 0.12,
    iridescence: 1,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [120, 640],
    envMapIntensity: 1.6,
    ...opts
  });
}

/** dichroic glass — refracts *and* splits into film colour */
export function dichroic(tint = 0xffffff, opts = {}) {
  return phys({
    color: tint,
    metalness: 0,
    roughness: 0.06,
    transmission: 1,
    thickness: 1.4,
    ior: 1.5,
    iridescence: 1,
    iridescenceIOR: 2.1,
    iridescenceThicknessRange: [180, 900],
    envMapIntensity: 1.6,
    ...opts
  });
}

/* --- the accent -------------------------------------------------- */

/** the one warm surface in the system, used for live/hovered state */
export function accentGlass(opts = {}) {
  return phys({
    color: 0x2a1408,
    emissive: PALETTE.accent,
    emissiveIntensity: 0.9,
    metalness: 0.2,
    roughness: 0.22,
    transmission: 0.35,
    thickness: 0.8,
    envMapIntensity: 1.2,
    ...opts
  });
}

/* ------------------------------------------------------------------
   Transmission needs a render target the size of the drawing buffer.
   Trim it on weaker GPUs so the refraction pass does not halve the
   frame rate.
   ------------------------------------------------------------------ */
export function tuneTransmission(renderer) {
  if ('transmissionResolutionScale' in renderer) {
    renderer.transmissionResolutionScale = devicePixelRatio > 1.5 ? 0.5 : 0.75;
  }
}
