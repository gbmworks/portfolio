/* ------------------------------------------------------------------
   Say so when a panel has more in it.

   The sector pages do not scroll — `pageScroll` is zero on a phone.
   Everything is inside panels, and measured at 390x844 there are three
   of them with something hidden: the sheet's own column (1523px past
   the fold), the work strip (2489px sideways) and the project window
   (3507px).  None of them said so.  A scrollbar is hidden on the
   horizontal ones by design and a phone draws none on the vertical
   ones until you are already moving, so the page looked like all there
   was.

   This only reports.  The stylesheet draws.  An element carries
   `data-scroll` (vertical) or `data-scroll-x` (horizontal), set to
   "more" while there is something past the edge and "end" once there
   is not — so the mark can retire when it has been taken rather than
   sitting there for the rest of the visit.  An element that does not
   overflow carries neither, which is what keeps the mark off a strip
   that happens to fit.

   The same idea, and deliberately the same attribute names, as
   `useScrollNudge` in content/eyewear-builder.
   ------------------------------------------------------------------ */

/** Slack, px.  Sub-pixel layout means a scroller at rest is rarely exact. */
const EPSILON = 4;

/**
 * Watch everything matching `selector`, now and as the page rebuilds.
 *
 * @param {string} selector
 * @returns {() => void} stop
 */
export function nudgeScrollers(selector) {
  /** @type {Map<Element, () => void>} */
  const watched = new Map();

  const mark = (el) => {
    const x = el.scrollWidth - el.clientWidth;
    const y = el.scrollHeight - el.clientHeight;

    if (y > EPSILON) {
      el.dataset.scroll = el.scrollTop >= y - EPSILON ? 'end' : 'more';
    } else {
      delete el.dataset.scroll;
    }

    if (x > EPSILON) {
      el.dataset.scrollX = el.scrollLeft >= x - EPSILON ? 'end' : 'more';
    } else {
      delete el.dataset.scrollX;
    }
  };

  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      /* Either the scroller itself resized, or something inside it did —
         a ResizeObserver on a scroller fires for its own box, never for
         its content's, so the children are observed too. */
      const el = entry.target.closest(selector);
      if (el) mark(el);
    }
  });

  const watch = (el) => {
    if (watched.has(el)) return;
    const onScroll = () => mark(el);
    el.addEventListener('scroll', onScroll, { passive: true });
    resize.observe(el);
    for (const child of el.children) resize.observe(child);
    watched.set(el, () => {
      el.removeEventListener('scroll', onScroll);
      delete el.dataset.scroll;
      delete el.dataset.scrollX;
    });
    mark(el);
  };

  const sweep = () => {
    for (const el of document.querySelectorAll(selector)) watch(el);
    for (const [el, stop] of watched) {
      if (el.isConnected) continue;
      stop();
      watched.delete(el);
    }
  };

  sweep();
  /* These pages render their panels from JS and swap them as you move
     between sectors, so the set is not fixed at load. */
  const mutate = new MutationObserver(sweep);
  mutate.observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', sweep, { passive: true });

  return () => {
    mutate.disconnect();
    removeEventListener('resize', sweep);
    resize.disconnect();
    for (const stop of watched.values()) stop();
    watched.clear();
  };
}
