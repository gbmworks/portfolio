/**
 * What is pointing at this app.
 *
 * Asked of the pointer rather than of the width, because they are not the
 * same question: a touch laptop at 1400px still taps and pinches, and a mouse
 * in a narrow window still clicks and scrolls. The stylesheet draws the same
 * distinction -- `pointer: coarse` for the finger, `max-width` for the room --
 * and this is the half of it that has to reach the words.
 *
 * Instructions are the reason it exists. "Click a shape" and "Scroll to zoom"
 * are not merely stale on a phone, they are advice that cannot be taken, and
 * an interface caught giving one impossible instruction is not believed about
 * the next one either.
 *
 * Read once at module load. A device does not grow a mouse mid-visit, and the
 * two places this is used are both fixed labels rather than live state, so
 * subscribing to the media query would buy nothing and cost a listener per
 * mount.
 */
export const COARSE =
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
