/* ------------------------------------------------------------------
   Landing page: 3s intro, then the wheel.

   Hovering a slice cross-fades the whole environment — sky, IBL,
   light colour, fog and the backdrop geometry — to that sector's
   world.  Clicking dives into its page.
   ------------------------------------------------------------------ */

import { SECTIONS, TOTAL } from './sectors.js';
import { ACCENT, ACCENT_GLOW } from './site.js';
import { sectorUrl } from './links.js';
import { createStage, reducedMotion } from './stage.js';
import { Wheel } from './wheel.js';
import { DEFAULT_THEME } from './env/themes.js';
import { mountShell, mountGround } from './shell.js';
import { bindNav } from './nav.js';
import { mountReel } from './reel.js';

const INTRO_MS = 3000;
const $ = (s) => document.querySelector(s);

const canvas   = $('#stage');
const introEl  = $('#intro');
const introBar = $('#introBar');
const uiEl     = $('#ui');
const labelsEl = $('#labels');
const hubValue = $('#hubValue');
const hubEl    = $('#hub');
const hintText = $('#hintText');

const state = { mode: 'intro' };

/* ---------------- intro ----------------
   It runs once a visit.  Coming back to the wheel from a section page —
   which happens constantly — should land you on the wheel, not make you
   sit through the name again.  A new tab or a fresh visit still gets it. */
const SEEN_INTRO = 'introSeen';
let introDone = false;

function endIntro() {
  if (introDone) return;
  introDone = true;
  state.mode = 'select';
  sessionStorage.setItem(SEEN_INTRO, '1');
  introEl.classList.add('is-out');
  uiEl.classList.add('is-in');
  setTimeout(() => introEl.remove(), 1200);
}

if (sessionStorage.getItem(SEEN_INTRO)) {
  introDone = true;
  state.mode = 'select';
  introEl.remove();
  uiEl.classList.add('is-in');
} else {
  requestAnimationFrame(() => {
    /* scaleX, not width: this runs for three seconds, and animating
       width relayouts the bar on every one of those frames. */
    introBar.style.transition = 'transform ' + INTRO_MS + 'ms linear';
    introBar.style.transform = 'scaleX(1)';
  });
  setTimeout(endIntro, reducedMotion ? 900 : INTRO_MS);
  introEl.addEventListener('click', endIntro);
}

/* ---------------- the shared bar, and the About window it opens ----------------
   the landing page is already home, so the bar links out rather than back */
mountShell({ home: false });

/* ---------------- stage ---------------- */
const themeKeys = SECTIONS.map(s => s.id);
/* the landing page is the subject: bloom on, the larger pixel budget */
const stage = await createStage(canvas, themeKeys, { bloom: true, budget: 'hero' });
const wheel = new Wheel({ sections: SECTIONS, scene: stage.scene, camera: stage.camera, labelsEl });
const nav = bindNav({ accent: ACCENT, zoom: -3.4, getZ: () => stage.camera.position.z });

/* Composition: the wheel's centre sits on the vertical golden section
   (61.8% across) and on the horizontal centre line; the type column runs
   down the first third.  On narrow screens it recentres. */
const PHI_X = 0.618;
function compose() {
  wheel.fitCamera(stage.camera);
  const perPx = wheel.perPixel(stage.camera);
  /* Three tiers, not two.  `narrow` used to run from a 900px tablet all
     the way down to a 360px phone on one scale, and at the bottom of
     that range the wheel outgrew the screen: the sector labels sit on a
     radius, so they left the pie, crossed the tick ring and ran off the
     side.  A phone gets its own scale and its own vertical seat, which
     is what leaves room under the wheel for the headline. */
  const narrow = innerWidth <= 900;
  const phone  = innerWidth <= 620;
  /* the tier classes go on first: the seat below is measured off the
     bar and the headline, and both are sized by them */
  document.body.classList.toggle('is-narrow', narrow);
  document.body.classList.toggle('is-phone', phone);

  wheel.view.rigX = narrow ? 0 : (innerWidth * PHI_X - innerWidth / 2) * perPx;
  wheel.view.scale = phone ? 0.78 : narrow ? 0.86 : 1;
  wheel.view.rigY = phone ? seatY(perPx) : narrow ? -0.10 : 0;
  /* Push the names outward on a phone.  Centred on the middle of the
     band, "VISUALIZATION" reached back over the hub disc and collided
     with "A SECTOR" printed on it — two unrelated lines of type
     touching, which reads as one.  0.63 puts the inner edge of the
     longest name clear of the hub; the slack it spends is on the rim
     side, where the only thing to cross is the tick ring.

     The margin matters more than it looks, because this is the one
     collision that gets worse on a *shorter* phone rather than a
     narrower one: the wheel is sized off the viewport and a name is
     10px whatever the viewport is, so a 667px screen gives the same
     words a smaller band to sit in than an 844px one does. */
  wheel.view.labelSeat = phone ? 0.63 : 0.5;
  /* the accent uplight belongs under the wheel, not under the page */
  stage.lights.bounce.position.x = wheel.view.rigX;
}

/* Where the wheel sits on a phone.

   The page is a single column there — bar, wheel, headline — so the
   wheel wants the middle of the band the other two leave it, not the
   middle of the viewport.  Measuring that band rather than nudging the
   rig by a constant is what keeps it seated on a 667px phone and a
   932px one alike, and what stops the headline growing a line from
   pushing the wheel out of the composition. */
function seatY(perPx) {
  const bar  = document.querySelector('.topbar');
  const lede = document.querySelector('.lede');
  const top    = bar  ? bar.getBoundingClientRect().bottom : 76;
  const bottom = lede ? lede.getBoundingClientRect().top   : innerHeight - 220;
  /* +Y is up, so a seat above the viewport's centre is a positive rig Y */
  return (innerHeight / 2 - (top + bottom) / 2) * perPx;
}

stage.on({
  resize: compose,
  frame: (dt, t) => {
    wheel.frame(dt, t, { entering: state.mode === 'intro' });
    if (nav.leaving) {
      stage.camera.position.z += (nav.zTarget - stage.camera.position.z) * (1 - Math.exp(-3.5 * dt));
    }
  },
  afterMatrix: () => {
    wheel.projectLabels(state.mode === 'intro');
    wheel.projectHub(hubEl);
  }
});

/* ---------------- hover / selection ---------------- */
/* index.html ships the hover wording because that is what a desktop
   visitor sees first.  A touch device never hovers, and until now it
   read "Hover a slice" until the first tap rewrote it. */
if (!wheel.enableParallax) hintText.textContent = 'Tap a slice to preview';

function setHover(i) {
  if (!wheel.setHover(i)) return;
  document.body.style.cursor = i === -1 ? '' : 'pointer';

  const s = i === -1 ? null : SECTIONS[i];
  stage.env.set(s ? s.id : DEFAULT_THEME);
  document.documentElement.style.setProperty('--accent', ACCENT);
  hubValue.textContent = s
    ? s.index + ' / ' + TOTAL
    : 'A SECTOR';
  hubValue.style.color = s ? ACCENT_GLOW : '';
  hintText.textContent = s
    ? (wheel.enableParallax ? 'Click to enter ' + s.title : 'Tap again to enter')
    : (wheel.enableParallax ? 'Hover a slice · the world changes' : 'Tap a slice to preview');
}

function onMove(e) {
  wheel.parallax.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  if (state.mode !== 'select' || nav.leaving || e.pointerType === 'touch') return;
  setHover(wheel.pick(e.clientX, e.clientY));
}
addEventListener('pointermove', onMove, { passive: true });
addEventListener('mousemove', onMove, { passive: true });

/* dive into a section */
function enter(i) {
  if (nav.leaving || i < 0) return;
  const s = SECTIONS[i];
  wheel.setActive(i);
  hintText.textContent = 'Entering ' + s.title + '…';
  nav.leave(sectorUrl(s), ACCENT);
}

canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'select' || nav.leaving) return;
  const i = wheel.pick(e.clientX, e.clientY);
  if (i === -1) return;
  if (e.pointerType === 'touch' && wheel.hover !== i) { setHover(i); return; }
  enter(i);
});
canvas.addEventListener('pointerleave', () => { if (state.mode === 'select') setHover(-1); });

/* labels are real links — keep them working, but play the transition */
wheel.labels.forEach((el, i) => {
  el.addEventListener('click', e => { e.preventDefault(); enter(i); });
  el.addEventListener('focus', () => setHover(i));
  el.addEventListener('blur', () => setHover(-1));
});

addEventListener('keydown', e => {
  if (state.mode === 'intro') { endIntro(); return; }
  if (e.key === 'Escape') return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= SECTIONS.length) enter(n - 1);
});

compose();

/* The strip of selected work a screen below the wheel.  `has-reel` is
   what lets the page scroll at all — body is `overflow:hidden` by
   default, and it stays that way if the reel never mounts, so a failure
   here leaves the landing page exactly as it was rather than leaving a
   scrollbar over nothing. */
mountReel({ onNavigate: nav.leave }) && document.body.classList.add('has-reel');
mountGround();

stage.start();
document.documentElement.setAttribute('data-ready', '');
