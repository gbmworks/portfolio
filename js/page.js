/* ------------------------------------------------------------------
   Section pages.

   No wheel here — that space is the preview stage.  The 3D world stays
   as the backdrop, the index sits in its own layout per sector, and
   hovering a row plays that work large in the stage.

     sheet    Industrial Design — drawing sheet left, stage right
     stack    Technical Art — centred column, stage full-bleed behind it
     gallery  Visualization — the mosaic owns the page
   ------------------------------------------------------------------ */

import { SECTIONS } from './data.js';
import { createStage, reducedMotion } from './stage.js';
import { buildGallery, startGallery, linkList } from './gallery.js';
import { initStage } from './preview.js';
import { initOverlays } from './overlays.js';

const $ = (s) => document.querySelector(s);

export async function initSection(id) {
  const index = SECTIONS.findIndex(s => s.id === id);
  if (index === -1) { console.warn('unknown section', id); return; }
  const def = SECTIONS[index];
  const isGallery = def.layout === 'gallery' && Array.isArray(def.gallery);
  const mode = isGallery ? 'gallery' : (def.layout || 'sheet');
  document.body.dataset.layout = mode;

  document.documentElement.style.setProperty('--accent', def.color);
  const veil = $('#veil');
  veil.style.background = def.color;
  if (sessionStorage.getItem('cameFromWheel')) {
    veil.classList.add('is-on');
    sessionStorage.removeItem('cameFromWheel');
  }
  requestAnimationFrame(() => veil.classList.remove('is-on'));

  /* ---------------- content ---------------- */
  if (isGallery) {
    document.body.classList.add('is-gallery');
    buildGallery($('#page'), def, SECTIONS);
    startGallery();
  } else {
    buildPanel(def, index);
    initStage({
      mount: $('#stagePreview'),
      rows: [...document.querySelectorAll('.plink')],
      sector: def.title
    });
  }
  initOverlays();

  /* ---------------- backdrop ---------------- */
  const canvas = $('#stage');
  const stage = await createStage(canvas, SECTIONS.map(s => s.id));
  stage.env.set(def.id, true);

  const state = { leaving: false };

  function layout() {
    /* nothing to frame any more — the camera just sits back far enough
       for the world to read behind the copy */
    stage.camera.position.z = 8.6;
    stage.camera.updateProjectionMatrix();
    stage.lights.bounce.position.x = 0;
  }

  let t = 0;
  stage.on({
    resize: layout,
    frame: (dt) => {
      t += dt;
      stage.scene.rotation.y = Math.sin(t * 0.05) * 0.03;   // never quite still
      if (state.leaving) {
        stage.camera.position.z += (state.zTarget - stage.camera.position.z) * (1 - Math.exp(-3.5 * dt));
      }
    }
  });

  /* ---------------- navigation ---------------- */
  function goto(i) {
    if (state.leaving || i === index || i < 0) return;
    const s = SECTIONS[i];
    state.leaving = true;
    state.zTarget = stage.camera.position.z - 3.0;
    veil.style.background = s.color;
    veil.classList.add('is-on');
    sessionStorage.setItem('cameFromWheel', '1');
    setTimeout(() => { location.href = s.id + '.html'; }, reducedMotion ? 60 : 520);
  }

  function leaveHome() {
    if (state.leaving) return;
    state.leaving = true;
    veil.style.background = def.color;
    veil.classList.add('is-on');
    setTimeout(() => { location.href = 'index.html'; }, reducedMotion ? 60 : 440);
  }
  document.querySelectorAll('[data-home]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); leaveHome(); }));

  document.querySelectorAll('.panel__nav a, .sectors a').forEach(a => {
    const target = (a.getAttribute('href') || '').replace('.html', '');
    const i = SECTIONS.findIndex(s => s.id === target);
    if (i === -1) return;
    a.addEventListener('click', e => { e.preventDefault(); goto(i); });
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= SECTIONS.length) goto(n - 1);
  });

  addEventListener('pageshow', () => { state.leaving = false; veil.classList.remove('is-on'); });

  layout();
  stage.start();
  document.documentElement.setAttribute('data-ready', '');
}

/* ---------------------------------------------------------------- */

function sectorNav(index) {
  return `<nav class="sectors">${SECTIONS.map((s, i) => `
    <a href="${s.id}.html" class="${i === index ? 'is-current' : ''}"
       ${i === index ? 'aria-current="page"' : ''}>
      <span>${s.index}</span>${s.title}
    </a>`).join('')}</nav>`;
}

function buildPanel(def, index) {
  const prev = SECTIONS[(index - 1 + SECTIONS.length) % SECTIONS.length];
  const next = SECTIONS[(index + 1) % SECTIONS.length];

  $('#panel').innerHTML = `
    <div class="panel__scroll">
      <a class="panel__back" href="index.html" data-home>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
             stroke-width="1.6"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All work</a>
      <header class="panel__head">
        <span class="panel__index">${def.index} / ${String(SECTIONS.length).padStart(2, '0')}</span>
        <h1 class="panel__title">${def.title}</h1>
        <p class="panel__sub">${def.subtitle}</p>
        <p class="panel__blurb">${def.blurb}</p>
      </header>
      ${sectorNav(index)}
      ${linkList(def)}
      <nav class="panel__nav">
        <a href="${prev.id}.html" style="--lc:${prev.glow}"><span>Previous</span><strong>${prev.title}</strong></a>
        <a href="${next.id}.html" style="--lc:${next.glow}" class="is-next"><span>Next</span><strong>${next.title}</strong></a>
      </nav>
    </div>`;
}
