/* ------------------------------------------------------------------
   The chrome every page wears.

   The top bar was hardcoded into four HTML files, each with its own
   copy of the name, the role line and the contact URL.  It is built
   here instead, from site.js, so those facts exist once.

   Mounting it also mounts the About window, because the bar carries
   the only link that opens it and the two have to agree about order.
   ------------------------------------------------------------------ */

import { SITE, ROLE_LINE, SOCIALS } from './site.js';
import { ICONS } from './icons.js';
import { initOverlays } from './overlays.js';

/* the landing page is already home, so it links out rather than back */
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
      <a href="#" data-open="about">About</a>
      <a href="${SITE.links}" target="_blank" rel="noopener noreferrer">Contact</a>
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
   ------------------------------------------------------------------ */
export function mountGround({ mount = '#ground' } = {}) {
  const host = document.querySelector(mount);
  if (!host) return false;

  host.innerHTML = `
    <div class="ground__in">
      <div class="ground__id">
        <strong>${SITE.name}</strong>
        <span>${ROLE_LINE}</span>
        <span>${SITE.based}</span>
      </div>

      <nav class="ground__social" aria-label="Elsewhere">
        ${SOCIALS.map(s => `
          <a href="${s.url}" target="_blank" rel="noopener noreferrer"
             aria-label="${s.label}" title="${s.label}">
            ${ICONS[s.key] || ''}<span>${s.label}</span>
          </a>`).join('')}
      </nav>

      <a class="ground__mail" href="mailto:${SITE.email}">${SITE.email}</a>
    </div>`;
  return true;
}
