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

  /* ---- hover, playback and where a click goes ----
     the whole of it, from the same engine that draws every other wall */
  const tiles = startTiles(host, { onNavigate });

  /* ---- the drift ----
     It exists so the strip is never a dead row of stills, and it stops
     for good the moment somebody takes hold of it — a carousel that
     keeps moving under a pointer is a carousel that loses a click.

     Two things here are about cost rather than behaviour, and both were
     measured rather than guessed.

     **The loop is started and cancelled, not left running and skipped.**
     It used to re-request a frame unconditionally and then `return`
     early when there was nothing to do — so a visitor who never scrolled
     this far, or who had reduced motion on, or who had already taken
     hold of the strip once, still paid sixty wake-ups a second for as
     long as the tab was open.  Lighthouse attributed 2.3 s of the
     landing page's blocking time to this file for 63 ms of actual
     script.  An early `return` gives up the work; it does not give up
     the frame.

     Note what this does *not* fix: the drift still does not move an
     inch, because `scroll-snap-type` on the track re-snaps every write.
     That is a separate bug and a separate commit — this one is only
     about not paying for a loop nobody is watching.

     **The track is measured once, not sixty times a second.**
     `scrollWidth` and `clientWidth` force layout, and neither changes
     between resizes.  The offset is now carried in `pos` and only
     written to the element, so a drifting frame costs one style write
     and no read at all. */
  let drifting = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inView = false;
  let maxScroll = 0;
  let pos = 0;
  let last = 0;
  let raf = 0;

  const measure = () => { maxScroll = Math.max(0, track.scrollWidth - track.clientWidth); };

  const stop = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    last = 0;
  };
  const start = () => {
    if (raf || !drifting || !inView || document.hidden) return;
    measure();
    pos = track.scrollLeft;
    raf = requestAnimationFrame(tick);
  };

  const stopDrift = () => { drifting = false; stop(); };
  ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(t =>
    track.addEventListener(t, stopDrift, { passive: true, once: true }));
  host.addEventListener('pointerenter', stopDrift);

  function tick(t) {
    if (!drifting || !inView || document.hidden) { stop(); return; }
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
    last = t;
    if (maxScroll <= 0) { stop(); return; }
    pos = Math.min(pos + DRIFT_PX_S * dt, maxScroll);
    track.scrollLeft = pos;
    if (pos >= maxScroll) { drifting = false; stop(); return; }
    raf = requestAnimationFrame(tick);
  }

  /* A hidden tab throttles rAF rather than stopping it, and a phone
     with the screen off is the case that matters — nothing on this
     strip is worth a wake-up nobody can see. */
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  /* ---- the reveal, and the gate on the drift ----
     The cards are staggered by --i, but only once the strip is
     actually looked at: animating them on load would spend the
     animation while the visitor is still three seconds into the intro
     and a screen above it.

     The observer used to disconnect itself after that first reveal.  It
     stays connected now because the drift needs the other edge too:
     being revealed is a one-shot, being *on screen* is not, and a strip
     scrolled back out of view has no reason to keep moving. */
  const seen = new IntersectionObserver((rows) => {
    rows.forEach(r => {
      inView = r.isIntersecting;
      if (inView) { host.classList.add('is-in'); start(); } else stop();
    });
  }, { rootMargin: '-12% 0px' });
  seen.observe(host);

  /* ---- arrows ---- */
  host.querySelectorAll('.reel__arrow').forEach(btn =>
    btn.addEventListener('click', () => {
      drifting = false;
      track.scrollBy({ left: STEP() * Number(btn.dataset.dir), behavior: 'smooth' });
    }));

  /* an arrow that cannot go anywhere says so rather than sitting there
     looking live */
  const ends = () => {
    host.querySelector('[data-dir="-1"]').disabled = track.scrollLeft <= 0;
    host.querySelector('[data-dir="1"]').disabled = track.scrollLeft >= maxScroll - 1;
  };

  /* Only a scroll the drift did not cause is worth re-syncing from — a
     swipe, an arrow, a keyboard.  Re-syncing from our own writes would
     put `pos` back to whatever the element decided to land on, which is
     not the same number while anything is fighting us for it. */
  track.addEventListener('scroll', () => {
    if (!raf) pos = track.scrollLeft;
    ends();
  }, { passive: true });
  addEventListener('resize', () => { measure(); ends(); });
  measure();
  ends();

  return {
    destroy() {
      stop();
      seen.disconnect();
      tiles.destroy();
    }
  };
}
