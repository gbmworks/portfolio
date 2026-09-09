/* ------------------------------------------------------------------
   Section pages.

   No wheel here — that space is the preview stage.  The 3D world stays
   as the backdrop, and the sector's work is listed in its own layout.
   Hovering a row plays that project in the stage; clicking it opens
   the project's own page.

     sheet    a drawing sheet on the left, the preview stage on the right
     gallery  a mosaic of project covers that owns the page

   Each page is ONE running order, set in js/pages.js from the
   allocation sheet.  There are no sub-headings and no tiers: a project,
   a published gallery and an Instagram post sit in the same list, drawn
   the same way, and what a thing is only decides where clicking it
   goes.
   ------------------------------------------------------------------ */

import { SECTIONS, TOTAL, IG_HIGHLIGHTS } from './sectors.js';
import { ACCENT, ACCENT_GLOW } from './site.js';
import { sectorUrl } from './links.js';
import { pageEntries } from './projects.js';
import { createStage } from './stage.js';
import { buildMosaic, startTiles } from './tiles.js';
import { initStage } from './preview.js';
import { mountShell } from './shell.js';
import { bindNav } from './nav.js';

const $ = (s) => document.querySelector(s);

export async function initSection(id) {
  const index = SECTIONS.findIndex(s => s.id === id);
  if (index === -1) { console.warn('unknown section', id); return; }
  const def = SECTIONS[index];
  const entries = pageEntries(id);
  const isGallery = def.layout === 'gallery';
  document.body.dataset.layout = isGallery ? 'gallery' : 'sheet';

  document.documentElement.style.setProperty('--accent', ACCENT);

  /* ---------------- content ---------------- */
  mountShell();
  if (isGallery) {
    document.body.classList.add('is-gallery');
    buildMosaic($('#page'), def, entries, { foot: sectorFoot(index) });
  } else {
    buildPanel(def, index, entries);
    initStage({
      mount: $('#stagePreview'),
      rows: [...document.querySelectorAll('.plink')],
      sector: def.title
    });
  }

  /* ---------------- backdrop ---------------- */
  const canvas = $('#stage');
  /* a backdrop, not the subject: no bloom (thirteen fullscreen passes
     the scrim would hide anyway, and four modules never fetched), a
     smaller pixel budget, and 24fps for a drift this slow */
  const stage = await createStage(canvas, SECTIONS.map(s => s.id),
    { fps: 24, quality: 0.84, bloom: false });
  stage.env.set(def.id, true);

  function layout() {
    /* nothing to frame any more — the camera just sits back far enough
       for the world to read behind the copy */
    stage.camera.position.z = 8.6;
    stage.camera.updateProjectionMatrix();
    stage.lights.bounce.position.x = 0;
  }

  const nav = bindNav({
    accent: ACCENT, zoom: -3.0, getZ: () => stage.camera.position.z
  });
  startTiles(isGallery ? document : $('#panel'), { onNavigate: nav.leave });

  let t = 0;
  stage.on({
    resize: layout,
    frame: (dt) => {
      t += dt;
      stage.scene.rotation.y = Math.sin(t * 0.05) * 0.03;   // never quite still
      if (nav.leaving) {
        stage.camera.position.z += (nav.zTarget - stage.camera.position.z) * (1 - Math.exp(-3.5 * dt));
      }
    }
  });

  /* number keys jump between sectors */
  addEventListener('keydown', e => {
    if (e.key === 'Escape') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= SECTIONS.length && n - 1 !== index) {
      nav.leave(sectorUrl(SECTIONS[n - 1]), ACCENT);
    }
  });

  layout();
  stage.start();
  document.documentElement.setAttribute('data-ready', '');
}

/* ------------------------------------------------------------------
   Navigation between sectors.

   The sheet builds this into its scrolling column and the mosaic takes
   the footer as a string, so nothing here has to know which layout it
   ends up in — and tiles.js never has to import back from this file.
   ------------------------------------------------------------------ */

export function sectorNav(index) {
  return `<nav class="sectors">${SECTIONS.map((s, i) => `
    <a href="${sectorUrl(s)}" class="${i === index ? 'is-current' : ''}"
       ${i === index ? 'aria-current="page"' : ''}>
      <span>${s.index}</span>${s.title}
    </a>`).join('')}</nav>`;
}

/* prev / next between sectors — the same pair on both layouts */
export function sectorFoot(index) {
  const prev = SECTIONS[(index - 1 + SECTIONS.length) % SECTIONS.length];
  const next = SECTIONS[(index + 1) % SECTIONS.length];
  return `
    <nav class="panel__nav">
      <a href="${sectorUrl(prev)}" style="--lc:${ACCENT_GLOW}">
        <span>Previous</span><strong>${prev.title}</strong></a>
      <a href="${sectorUrl(next)}" style="--lc:${ACCENT_GLOW}" class="is-next">
        <span>Next</span><strong>${next.title}</strong></a>
    </nav>`;
}

/* ---------------------------------------------------------------- */

/* One row for anything on the page.

   The row carries its own still and clip as data attributes, which is
   what the preview stage reads on hover.  `still` is a cover if there is
   one and the clip's poster otherwise, so the stage always has something
   to paint on the first frame of a hover.  An entry that leaves the site
   opens in a new tab; one that has a page here transitions to it. */
function entryRow(e, i) {
  const out = e.external;
  return `
    <a class="plink" href="${e.href}"
       ${out ? 'target="_blank" rel="noopener noreferrer"' : 'data-nav'}
       ${e.clip ? `data-preview="${encodeURI(e.clip)}"` : ''}
       ${e.still ? `data-still="${encodeURI(e.still)}"` : ''}>
      <span class="plink__n">${String(i + 1).padStart(2, '0')}</span>
      <span class="plink__t">${e.title}</span>
      <span class="plink__y">${e.meta}</span>
      <svg class="plink__go" viewBox="0 0 24 24" width="13" height="13" fill="none"
           stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 5l7 7-7 7"/>
      </svg>
    </a>`;
}

function buildPanel(def, index, entries) {
  const hl = IG_HIGHLIGHTS[def.id] || [];

  $('#panel').innerHTML = `
    <div class="panel__scroll">
      <a class="panel__back" href="index.html" data-home>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
             stroke-width="1.6"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All work</a>
      <header class="panel__head">
        <span class="panel__index">${def.index} / ${TOTAL}</span>
        <h1 class="panel__title">${def.title}</h1>
        <p class="panel__sub">${def.subtitle}</p>
        <p class="panel__blurb">${def.blurb}</p>
      </header>
      ${sectorNav(index)}

      <section class="plinks">
        <header class="plinks__head">
          <h2>Work</h2>
          <span class="plinks__count">${entries.length}</span>
        </header>
        ${def.note ? `<p class="plinks__note">${def.note}</p>` : ''}
        ${hl.length ? `<p class="plinks__tags">${hl.map(h => `<span>Highlight: ${h}</span>`).join('')}</p>` : ''}
        <div class="plinks__list">${entries.map(entryRow).join('')}</div>
      </section>

      ${sectorFoot(index)}
    </div>`;
}
