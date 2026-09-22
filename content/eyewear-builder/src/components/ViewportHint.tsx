/**
 * How to move the camera, offered when the customer pauses.
 *
 * The viewport is a bare canvas. Nothing about it says it can be orbited, and
 * anyone who does not discover that judges a frame from one fixed angle --
 * the worst way to judge eyewear, because the arms and the profile are most
 * of the design.
 *
 * **Offered on idle, not on arrival.** Someone who lands and immediately
 * starts dragging has already answered the question, and telling them anyway
 * is noise. Three seconds of a still mouse is the moment they are most likely
 * to be looking for what to do next, which is exactly when advice is worth
 * having.
 *
 * **One at a time.** Two instructions side by side is a legend to be read;
 * one sentence, then another, is someone showing you. The pair is shown once
 * per visit, and never again once the camera has actually been moved -- at
 * that point the lesson has landed and repeating it is a tutorial that will
 * not close.
 *
 * It sits above the view bar rather than over the product: a hint that covers
 * the thing it is describing is worse than no hint.
 */

import { useEffect, useRef, useState } from 'react';

import { COARSE } from '../ui/pointer';

const STORAGE_KEY = 'eyewear.viewporthint';

/** Still-mouse time before the first hint is offered. */
const IDLE = 3000;
/** How long each hint holds before the next one replaces it. */
const DWELL = 2900;
/** Matches the leaving animation in the stylesheet. */
const FADE = 400;

/* Telling someone to scroll on a phone is advice they cannot take, and it
   discredits the sentence before it -- which is the one that matters. */
const HINTS = [
  { id: 'orient', icon: 'orbit', text: 'Drag to orient' },
  {
    id: 'zoom',
    icon: COARSE ? 'pinch' : 'scroll',
    text: COARSE ? 'Pinch to zoom' : 'Scroll to zoom',
  },
] as const;

export function ViewportHint({ stage }: { stage: React.RefObject<HTMLElement | null> }) {
  /** -1 is nothing showing; otherwise the index in `HINTS`. */
  const [index, setIndex] = useState(-1);
  const [leaving, setLeaving] = useState(false);

  // Refs, not state: the listeners below are bound once and have to read the
  // live values without re-binding on every tick of the sequence.
  const done = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    try {
      done.current = window.sessionStorage.getItem(STORAGE_KEY) === 'seen';
    } catch {
      /* Storage off: offer it, which is the safe way to be wrong. */
    }

    /*
     * One scheduler, and every timeout it creates is tracked.
     *
     * An earlier version let the hide-after-fade timer escape the list. A
     * mouse move would queue one, the idle timer would then show a hint, and
     * the stray timer would pull it straight back down 400ms later -- while
     * the rest of the sequence ran on invisibly and still marked itself seen.
     * The hint was "shown" and nobody could have read it. Anything scheduled
     * here goes in `timers`, and `clear` is the only way out.
     */
    const after = (ms: number, run: () => void) => {
      timers.current.push(window.setTimeout(run, ms));
    };

    const clear = () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };

    const finish = () => {
      done.current = true;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, 'seen');
      } catch {
        /* Then it is offered again next visit, which is survivable. */
      }
    };

    /** Show each hint in turn, then stop for the rest of the visit. */
    const play = () => {
      if (done.current) return;
      setLeaving(false);
      setIndex(0);
      for (let i = 1; i < HINTS.length; i++) {
        after(DWELL * i, () => setIndex(i));
      }
      after(DWELL * HINTS.length, () => setLeaving(true));
      after(DWELL * HINTS.length + FADE, () => {
        setIndex(-1);
        finish();
      });
    };

    /** Take anything on screen down, then optionally re-arm the idle timer. */
    const stand = (ended: boolean) => {
      clear();
      setLeaving(true);
      after(FADE, () => setIndex(-1));
      if (ended) finish();
      else if (!done.current) after(IDLE, play);
    };

    clear();
    after(IDLE, play);

    // Movement postpones the offer; using the camera ends it for the visit.
    const onMove = () => stand(false);
    const onUse = () => stand(true);

    node.addEventListener('pointermove', onMove, { passive: true });
    node.addEventListener('pointerdown', onUse);
    node.addEventListener('wheel', onUse, { passive: true });
    return () => {
      clear();
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerdown', onUse);
      node.removeEventListener('wheel', onUse);
    };
  }, [stage]);

  if (index < 0) return null;
  const hint = HINTS[index];

  return (
    <div
      className={leaving ? 'viewhint viewhint--leaving' : 'viewhint'}
      // Advisory, and it describes a pointing gesture. Announcing it would
      // interrupt a screen reader mid-sentence with something it cannot use;
      // the same guidance is on the view buttons as labels.
      aria-hidden
    >
      {/* Keyed so React swaps the element rather than mutating it, which
          re-runs the entrance and makes the second hint read as a new remark
          instead of the first one's text changing under you. */}
      <span className="viewhint__row" key={hint.id}>
        {hint.icon === 'orbit' ? <OrbitIcon /> : hint.icon === 'pinch' ? <PinchIcon /> : <ScrollIcon />}
        {hint.text}
      </span>
    </div>
  );
}

/* Drawn, not borrowed: one family, 1.6px stroke, 24px box, round joins. */

function OrbitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="viewhint__icon" aria-hidden focusable="false">
      <ellipse cx="12" cy="12" rx="9.5" ry="4.5" transform="rotate(-22 12 12)" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M18.4 7.4 20.6 6.2 21.2 8.6" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg viewBox="0 0 24 24" className="viewhint__icon" aria-hidden focusable="false">
      <rect x="7.5" y="2.8" width="9" height="14.4" rx="4.5" />
      <path d="M12 6.2v2.6" />
      <path d="M12 20.4 10.2 22.2M12 20.4 13.8 22.2" />
    </svg>
  );
}

/* Two fingers and the arrows they travel along -- the gesture drawn, rather
   than a hand, which at 24px is a blob. Same family as the other two. */
function PinchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="viewhint__icon" aria-hidden focusable="false">
      <circle cx="6.6" cy="6.6" r="2.6" />
      <circle cx="17.4" cy="17.4" r="2.6" />
      <path d="M10.6 13.4 5.2 18.8M5.2 18.8h3.4M5.2 18.8v-3.4" />
      <path d="M13.4 10.6 18.8 5.2M18.8 5.2h-3.4M18.8 5.2v3.4" />
    </svg>
  );
}
