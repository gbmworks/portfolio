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

/* Same rules, smaller frame: this one sits inside a line of 9.5px mono
   rather than in a 42px button, so it is drawn at 12x12 on a 24-unit
   grid and takes the line's own colour and baseline. */
const inlineSvg = (body, w = 1.7) => `
  <svg class="mark" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
       stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${body}
  </svg>`;

export const ICONS = {
  /* Two arrows back to back — the mark between two place names.  It is
     drawn and not typed because none of the Unicode candidates is in
     JetBrains Mono: U+21C4, U+21C6, U+2194, U+27F7 and U+21CC all fall
     through to a system face 40% wider than the mono cell, which in a
     line of tracked monospace reads as a mistake.  Measured, not
     assumed — the cell is 6.6px at 11px and every one of them came back
     9.2 or more. */
  shuttle: inlineSvg(`
    <path d="M4 9.5h16l-3.4-3.2"/>
    <path d="M20 14.5H4l3.4 3.2"/>`),

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

/* The two place names with the mark between them.  It lives here, next
   to the mark, rather than in site.js — site.js holds the facts and
   this file holds every drawing on the site. */
export const BASED_LINE = (site) =>
  `<span class="between">${site.from}${ICONS.shuttle}${site.to}</span>`;
