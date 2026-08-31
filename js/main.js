/* ------------------------------------------------------------------
   Landing page: 3s intro, then the wheel.

   Hovering a slice cross-fades the whole environment — sky, IBL,
   light colour, fog and the backdrop geometry — to that sector's
   world.  Clicking dives into its page.
   ------------------------------------------------------------------ */

import { SECTIONS, ACCENT, ACCENT_GLOW } from './data.js';
import { createStage, reducedMotion } from './stage.js';
import { Wheel } from './wheel.js';
import { DEFAULT_THEME } from './env/themes.js';
import { initOverlays } from './overlays.js';

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
const veil     = $('#veil');

const state = { mode: 'intro', leaving: false };

/* ---------------- intro ---------------- */
let introDone = false;
function endIntro() {
  if (introDone) return;
  introDone = true;
  state.mode = 'select';
  introEl.classList.add('is-out');
  uiEl.classList.add('is-in');
  setTimeout(() => introEl.remove(), 1200);
}
requestAnimationFrame(() => {
  introBar.style.transition = 'width ' + INTRO_MS + 'ms linear';
  introBar.style.width = '100%';
});
setTimeout(endIntro, reducedMotion ? 900 : INTRO_MS);
introEl.addEventListener('click', endIntro);

/* ---------------- floating windows ---------------- */
initOverlays();

/* ---------------- stage ---------------- */
const themeKeys = SECTIONS.map(s => s.id);
const stage = await createStage(canvas, themeKeys);
const wheel = new Wheel({ sections: SECTIONS, scene: stage.scene, camera: stage.camera, labelsEl });

/* Composition: the wheel's centre sits on the vertical golden section
   (61.8% across) and on the horizontal centre line; the type column runs
   down the first third.  On narrow screens it recentres. */
const PHI_X = 0.618;
function compose() {
  wheel.fitCamera(stage.camera);
  const perPx = wheel.perPixel(stage.camera);
  const narrow = innerWidth <= 900;
  wheel.view.rigX = narrow ? 0 : (innerWidth * PHI_X - innerWidth / 2) * perPx;
  wheel.view.rigY = narrow ? -0.10 : 0;
  wheel.view.scale = narrow ? 0.86 : 1;
  /* the accent uplight belongs under the wheel, not under the page */
  stage.lights.bounce.position.x = wheel.view.rigX;
  document.body.classList.toggle('is-narrow', narrow);
}

stage.on({
  resize: compose,
  frame: (dt, t) => {
    wheel.frame(dt, t, { entering: state.mode === 'intro' });
    if (state.leaving) {
      stage.camera.position.z += (state.zTarget - stage.camera.position.z) * (1 - Math.exp(-3.5 * dt));
    }
  },
  afterMatrix: () => {
    wheel.projectLabels(state.mode === 'intro');
    wheel.projectHub(hubEl);
  }
});

/* ---------------- hover / selection ---------------- */
function setHover(i) {
  if (!wheel.setHover(i)) return;
  document.body.style.cursor = i === -1 ? '' : 'pointer';

  const s = i === -1 ? null : SECTIONS[i];
  stage.env.set(s ? s.id : DEFAULT_THEME);
  document.documentElement.style.setProperty('--accent', ACCENT);
  hubValue.textContent = s
    ? s.index + ' / ' + String(SECTIONS.length).padStart(2, '0')
    : 'A SECTOR';
  hubValue.style.color = s ? ACCENT_GLOW : '';
  hintText.textContent = s
    ? (wheel.enableParallax ? 'Click to enter ' + s.title : 'Tap again to enter')
    : (wheel.enableParallax ? 'Hover a slice · the world changes with it' : 'Tap a slice to preview');
}

function onMove(e) {
  wheel.parallax.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  if (state.mode !== 'select' || state.leaving || e.pointerType === 'touch') return;
  setHover(wheel.pick(e.clientX, e.clientY));
}
addEventListener('pointermove', onMove, { passive: true });
addEventListener('mousemove', onMove, { passive: true });

/* dive into a section */
function enter(i) {
  if (state.leaving || i < 0) return;
  const s = SECTIONS[i];
  state.leaving = true;
  state.zTarget = stage.camera.position.z - 3.4;
  wheel.setActive(i);
  veil.style.background = s.color;
  veil.classList.add('is-on');
  hintText.textContent = 'Entering ' + s.title + '…';
  sessionStorage.setItem('cameFromWheel', '1');
  setTimeout(() => { location.href = s.id + '.html'; }, reducedMotion ? 60 : 620);
}

canvas.addEventListener('pointerdown', e => {
  if (state.mode !== 'select' || state.leaving) return;
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

/* arriving back from a section page */
addEventListener('pageshow', () => {
  state.leaving = false;
  veil.classList.remove('is-on');
});

compose();
stage.start();
