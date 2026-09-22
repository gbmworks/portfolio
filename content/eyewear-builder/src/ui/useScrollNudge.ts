/**
 * Say so when there is more below.
 *
 * A panel that scrolls and does not look like it is a panel whose lower half
 * does not exist. It was costing real controls: on a phone the try-on's last
 * slider sat under the foot and the reset and head-mask row were off the
 * bottom entirely, with nothing on screen to suggest either was reachable.
 *
 * This only reports; the stylesheet draws. The element carries
 * `data-scroll="more"` while there is something past the fold and
 * `data-scroll="end"` once there is not, so the nudge can fade out when it has
 * been taken rather than sitting there for the rest of the visit. An element
 * that does not overflow at all carries neither.
 *
 * Three things can change the answer and all three are watched: the box
 * resizing (rotate the phone), the contents changing height (a different step
 * has a different number of controls), and the customer scrolling. The
 * `MutationObserver` is the one that is easy to forget -- a `ResizeObserver`
 * on a scroller fires for its own box, not for its content's.
 */

import { useEffect, type RefObject } from 'react';

/** Slack, px. Sub-pixel layout means a scroller at rest is rarely exact. */
const EPSILON = 4;

export function useScrollNudge(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const overflow = node.scrollHeight - node.clientHeight;
      if (overflow <= EPSILON) {
        delete node.dataset.scroll;
        return;
      }
      node.dataset.scroll = node.scrollTop >= overflow - EPSILON ? 'end' : 'more';
    };

    update();
    node.addEventListener('scroll', update, { passive: true });

    const resize = new ResizeObserver(update);
    resize.observe(node);
    // Children too: a step with three swatch rows and one with a colour picker
    // are different heights inside a box that never changes size.
    for (const child of node.children) resize.observe(child);

    const mutate = new MutationObserver(() => {
      for (const child of node.children) resize.observe(child);
      update();
    });
    mutate.observe(node, { childList: true, subtree: true, characterData: true });

    return () => {
      node.removeEventListener('scroll', update);
      resize.disconnect();
      mutate.disconnect();
      delete node.dataset.scroll;
    };
  }, [ref]);
}
