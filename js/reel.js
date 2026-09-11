/* ------------------------------------------------------------------
   The reel — a strip of selected work under the wheel.

   The landing page used to be exactly one screen: the wheel, or
   nothing.  That asks a visitor to commit to a sector before they have
   seen a single piece of work.  Scrolling now brings up a horizontal
   strip of ten pieces, mixed across all three sectors, and any of them
   is one click from its page.

   It reuses the tile engine rather than growing a second one.  A card
   here *is* a `.tile` — same markup from `entryTile()`, same lazy
   poster, same hover-to-colour-and-play, same rules about where a
   click goes — so nothing about playback or navigation is written
   twice.  What this file adds is only what a strip needs that a wall
   does not: a horizontal track, arrows, a reveal, and the drift.

   The wheel behind it does not move: `.ui` is `position:fixed`, so the
   strip scrolls up over a world that stays where it was.
   ------------------------------------------------------------------ */

import { featuredEntries } from './projects.js';
import { entryTile, startTiles } from './tiles.js';

/* how far the idle drift creeps, in px per second — slow enough that
   it reads as "this is a thing that moves" rather than as a carousel
   taking the wheel away from you */
const DRIFT_PX_S = 14;

/* one card's worth of scroll per arrow press */
const STEP = () => {
  const card = document.querySelector('.reel__track .tile');
  return card ? card.getBoundingClientRect().width + 18 : 320;
};

export function mountReel({ mount = '#reel', onNavigate = null } = {}) {
  const host = document.querySelector(mount);
  if (!host) return { destroy() {} };

  const entries = featuredEntries();
  if (!entries.length) return { destroy() {} };

  host.innerHTML = `
    <div class="reel__cue">Selected work<span></span></div>
    <div class="reel__head">
      <h2 class="reel__title">Selected work</h2>
      <p class="reel__note">Across all three sectors — hover to play, click to open.</p>
      <div class="reel__arrows">
        <button class="reel__arrow" data-dir="-1" aria-label="Scroll left">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <button class="reel__arrow" data-dir="1" aria-label="Scroll right">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
    <div class="reel__track" role="list">
      ${entries.map((e, i) => `<div class="reel__cell" role="listitem" style="--i:${i}">${entryTile(e)}</div>`).join('')}
    </div>`;

  const track = host.querySelector('.reel__track');

  /* ---- the reveal ----
     The cards are staggered by --i, but only once the strip is
     actually looked at: animating them on load would spend the
     animation while the visitor is still three seconds into the intro
     and a screen above it. */
  const seen = new IntersectionObserver((rows) => {
    rows.forEach(r => {
      if (!r.isIntersecting) return;
      host.classList.add('is-in');
      seen.disconnect();
    });
  }, { rootMargin: '-12% 0px' });
  seen.observe(host);

  /* ---- hover, playback and where a click goes ----
     the whole of it, from the same engine that draws every other wall */
  const tiles = startTiles(host, { onNavigate });

  /* ---- the drift ----
     It exists so the strip is never a dead row of stills, and it stops
     for good the moment somebody takes hold of it — a carousel that
     keeps moving under a pointer is a carousel that loses a click. */
  let drifting = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = 0;
  let raf = 0;

  const stopDrift = () => { drifting = false; };
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(t =>
    track.addEventListener(t, stopDrift, { passive: true, once: true }));
  host.addEventListener('pointerenter', () => { drifting = false; });

  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
    last = t;
    if (!drifting || !host.classList.contains('is-in')) return;
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 0) return;
    if (track.scrollLeft >= max - 1) { drifting = false; return; }
    track.scrollLeft += DRIFT_PX_S * dt;
  };
  raf = requestAnimationFrame(tick);

  /* ---- arrows ---- */
  host.querySelectorAll('.reel__arrow').forEach(btn =>
    btn.addEventListener('click', () => {
      drifting = false;
      track.scrollBy({ left: STEP() * Number(btn.dataset.dir), behavior: 'smooth' });
    }));

  /* an arrow that cannot go anywhere says so rather than sitting there
     looking live */
  const ends = () => {
    const max = track.scrollWidth - track.clientWidth - 1;
    host.querySelector('[data-dir="-1"]').disabled = track.scrollLeft <= 0;
    host.querySelector('[data-dir="1"]').disabled = track.scrollLeft >= max;
  };
  track.addEventListener('scroll', ends, { passive: true });
  addEventListener('resize', ends);
  ends();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      seen.disconnect();
      tiles.destroy();
    }
  };
}
