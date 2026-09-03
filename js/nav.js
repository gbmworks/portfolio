/* ------------------------------------------------------------------
   Leaving a page.

   Every page fades out through the same coloured veil on the way to
   the next one, and clears it on the way in.  The landing page, the
   section pages and the project pages all used to carry their own copy
   of this; now they share it.

   Any same-site link inside the page transitions rather than jumps —
   [data-home] goes back to the wheel, and .sectors / .panel__nav /
   [data-nav] links animate to wherever they point.
   ------------------------------------------------------------------ */

import { reducedMotion } from './stage.js';

const LEAVE_MS = 480;
const INTERNAL = '.sectors a, .panel__nav a, .pnav a, [data-nav]';

export function bindNav({ accent = '#ff5a12', zoom = 0, getZ = null } = {}) {
  const veil = document.querySelector('#veil');

  /* arriving: if the last page painted the veil on its way out, hold it
     for one frame so the two pages meet on the same colour */
  if (veil) {
    veil.style.background = accent;
    if (sessionStorage.getItem('inTransit')) {
      veil.classList.add('is-on');
      sessionStorage.removeItem('inTransit');
    }
    requestAnimationFrame(() => veil.classList.remove('is-on'));
  }

  const nav = { leaving: false, zTarget: 0, leave };

  function leave(href, color) {
    if (nav.leaving || !href) return;
    nav.leaving = true;
    if (getZ) nav.zTarget = getZ() + zoom;
    if (veil) {
      veil.style.background = color || accent;
      veil.classList.add('is-on');
    }
    sessionStorage.setItem('inTransit', '1');
    setTimeout(() => { location.href = href; }, reducedMotion ? 60 : LEAVE_MS);
  }

  document.querySelectorAll('[data-home]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); leave('index.html'); }));

  document.querySelectorAll(INTERNAL).forEach(a => {
    const href = a.getAttribute('href');
    if (!href || /^(https?:|mailto:|#)/i.test(href)) return;
    a.addEventListener('click', e => {
      e.preventDefault();
      leave(href, a.style.getPropertyValue('--lc') || accent);
    });
  });

  /* coming back through the browser's history cache */
  addEventListener('pageshow', () => {
    nav.leaving = false;
    if (veil) veil.classList.remove('is-on');
  });

  return nav;
}
