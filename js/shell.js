/* ------------------------------------------------------------------
   The chrome every page wears.

   The top bar was hardcoded into four HTML files, each with its own
   copy of the name, the role line and the contact URL.  It is built
   here instead, from site.js, so those facts exist once.

   Mounting it also mounts the About window, because the bar carries
   the only link that opens it and the two have to agree about order.
   ------------------------------------------------------------------ */

import { SITE, ROLE_LINE, SOCIALS } from './site.js';
import { ICONS, BASED_LINE } from './icons.js';
import { initOverlays } from './overlays.js';

/* the landing page is already home, so it links out rather than back.

   The bar carries one control.  It held Contact, then Resume, and the
   Resume link was redundant the moment the About window grew the pair
   of PDF actions: the bar was offering a second door to a room that is
   already the first thing inside the first door.  One door, and it can
   be bigger for being alone.

   Everything the bar used to reach — the profiles, the address, the
   link hub, the CV as a file — is now one level in: in the About
   window, or in the footer under the work. */
export function mountShell({ home = true, mount = '#ui' } = {}) {
  const host = document.querySelector(mount);
  if (!host) return null;

  const id = home
    ? `<a href="index.html" data-home><strong>${SITE.short}</strong></a>`
    : `<strong>${SITE.short}</strong>`;

  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML = `
    <div class="topbar__id">
      ${id}
      <span>${ROLE_LINE}</span>
    </div>
    <nav class="topbar__nav">
      ${home ? '<a href="index.html" data-home>All work</a>' : ''}
      <a href="#" data-open="about" class="topbar__about">About</a>
    </nav>`;

  host.prepend(bar);
  return initOverlays();
}

/* ------------------------------------------------------------------
   The ground — what is under the work.

   The landing page ends on the reel, and a wall of pieces with nothing
   after it reads as a page that was cut off.  This is the other end of
   the top bar: the same card, the same three facts, and the way out to
   the places the work is actually published.

   Built from SOCIALS, which drops any profile site.js has no URL for,
   so the row is never a dead link.

   The row is icons alone.  It used to carry each name beside its mark
   on the argument that a bare icon makes a visitor guess — true of an
   unfamiliar mark, and these three are not: LinkedIn, Behance and
   Instagram are the most recognised glyphs a portfolio can put in a
   footer.  What the names cost was a row that wrapped to two lines on
   anything narrow.  The name is still on every one of them, in
   `aria-label` for a screen reader and `title` for a cursor. */
export function mountGround({ mount = '#ground' } = {}) {
  const host = document.querySelector(mount);
  if (!host) return false;

  host.innerHTML = `
    <div class="ground__in">
      <div class="ground__id">
        <strong>${SITE.name}</strong>
        <span>${ROLE_LINE}</span>
        <span>${BASED_LINE(SITE)}</span>
      </div>

      <nav class="ground__social" aria-label="Elsewhere">
        ${SOCIALS.map(s => `
          <a href="${s.url}" target="_blank" rel="noopener noreferrer"
             aria-label="${s.label}" title="${s.label}">
            ${ICONS[s.key] || ''}
          </a>`).join('')}
      </nav>

      <a class="ground__mail" href="mailto:${SITE.email}">${SITE.email}</a>
    </div>`;
  return true;
}
