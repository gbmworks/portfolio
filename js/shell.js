/* ------------------------------------------------------------------
   The chrome every page wears.

   The top bar was hardcoded into four HTML files, each with its own
   copy of the name, the role line and the contact URL.  It is built
   here instead, from site.js, so those facts exist once.

   Mounting it also mounts the About window, because the bar carries
   the only link that opens it and the two have to agree about order.
   ------------------------------------------------------------------ */

import { SITE, ROLE_LINE } from './site.js';
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
