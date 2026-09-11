/* ------------------------------------------------------------------
   The icon set.

   Drawn here rather than pulled from a library or stood in for by a
   glyph font: three marks at one size, one stroke weight, one corner
   treatment.  Everything on this site that needs a social mark reads
   from this file, so Instagram is the same Instagram in the tile badge
   at the foot of a wall and in the footer under the wheel.

   24×24, stroke 1.4, no fills except where a mark genuinely has one
   (Instagram's lens dot).  Matching the sector icons in sectors.js,
   which are drawn to the same rules.
   ------------------------------------------------------------------ */

const svg = (body, w = 1.4) => `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${body}
  </svg>`;

export const ICONS = {
  instagram: svg(`
    <rect x="3" y="3" width="18" height="18" rx="5"/>
    <circle cx="12" cy="12" r="4.2"/>
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>`),

  behance: svg(`
    <path d="M2 6h6.2a3 3 0 0 1 0 6H2zM2 12h6.8a3 3 0 0 1 0 6H2z"/>
    <path d="M14.4 14.2h7.2a3.6 3.6 0 1 0-7.2 0zM15 7.4h6"/>`),

  linkedin: svg(`
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M7.3 10.4v6.3"/>
    <circle cx="7.3" cy="7.4" r="1.05" fill="currentColor" stroke="none"/>
    <path d="M11.2 16.7v-6.3"/>
    <path d="M11.2 12.9a2.5 2.5 0 0 1 5 0v3.8"/>`)
};
