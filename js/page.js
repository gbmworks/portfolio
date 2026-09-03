/* ------------------------------------------------------------------
   Section pages.

   No wheel here — that space is the preview stage.  The 3D world stays
   as the backdrop, and the sector's projects are listed in its own
   layout.  Hovering a row plays that project in the stage; clicking it
   opens the project's own page.

     sheet    a drawing sheet on the left, the preview stage on the right
     gallery  a mosaic of project covers that owns the page
   ------------------------------------------------------------------ */

import { SECTIONS, IG_HIGHLIGHTS, PROFILE, coverUrl } from './data.js';
import { bySector, POSTS, projectUrl, projectStill } from './projects.js';
import { createStage } from './stage.js';
import { buildMosaic, startTiles, postTile, grid } from './tiles.js';
import { initStage } from './preview.js';
import { initOverlays } from './overlays.js';
import { bindNav } from './nav.js';

const $ = (s) => document.querySelector(s);

export async function initSection(id) {
  const index = SECTIONS.findIndex(s => s.id === id);
  if (index === -1) { console.warn('unknown section', id); return; }
  const def = SECTIONS[index];
  const projects = bySector(id);
  const posts = POSTS[id] || [];
  const isGallery = def.layout === 'gallery';
  document.body.dataset.layout = isGallery ? 'gallery' : 'sheet';

  document.documentElement.style.setProperty('--accent', def.color);

  /* ---------------- content ---------------- */
  if (isGallery) {
    document.body.classList.add('is-gallery');
    buildMosaic($('#page'), def, projects, posts, SECTIONS);
  } else {
    buildPanel(def, index, projects, posts);
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

  function layout() {
    /* nothing to frame any more — the camera just sits back far enough
       for the world to read behind the copy */
    stage.camera.position.z = 8.6;
    stage.camera.updateProjectionMatrix();
    stage.lights.bounce.position.x = 0;
  }

  const nav = bindNav({
    accent: def.color, zoom: -3.0, getZ: () => stage.camera.position.z
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
      const s = SECTIONS[n - 1];
      nav.leave(s.id + '.html', s.color);
    }
  });

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

/* one project, as a row in the index */
function projectRow(p, i) {
  const raw = projectStill(p);
  const still = raw ? coverUrl(raw) : '';
  const meta = [p.client, p.year].filter(Boolean).join(' · ');
  return `
    <a class="plink" href="${projectUrl(p)}" data-nav
       ${p.preview ? `data-preview="${encodeURI(p.preview)}"` : ''}
       ${still ? `data-still="${encodeURI(still)}"` : ''}>
      <span class="plink__n">${String(i + 1).padStart(2, '0')}</span>
      <span class="plink__t">${p.title}</span>
      <span class="plink__y">${meta}</span>
      <svg class="plink__go" viewBox="0 0 24 24" width="13" height="13" fill="none"
           stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 5l7 7-7 7"/>
      </svg>
    </a>`;
}

function buildPanel(def, index, projects, posts) {
  const prev = SECTIONS[(index - 1 + SECTIONS.length) % SECTIONS.length];
  const next = SECTIONS[(index + 1) % SECTIONS.length];
  const hl = IG_HIGHLIGHTS[def.id] || [];

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

      <section class="plinks">
        <header class="plinks__head">
          <h2>Projects</h2>
          <span class="plinks__count">${projects.length}</span>
        </header>
        ${def.note ? `<p class="plinks__note">${def.note}</p>` : ''}
        ${hl.length ? `<p class="plinks__tags">${hl.map(h => `<span>Highlight: ${h}</span>`).join('')}</p>` : ''}
        <div class="plinks__list">${projects.map(projectRow).join('')}</div>
      </section>

      ${posts.length ? `
        <section class="plinks">
          <header class="plinks__head">
            <h2>Also on Instagram</h2>
            <a href="${PROFILE.instagram}" target="_blank" rel="noopener noreferrer">@vindgo.visual ↗</a>
          </header>
          ${grid(posts.map(postTile).join(''), 'gal--small')}
        </section>` : ''}

      <nav class="panel__nav">
        <a href="${prev.id}.html" style="--lc:${prev.glow}"><span>Previous</span><strong>${prev.title}</strong></a>
        <a href="${next.id}.html" style="--lc:${next.glow}" class="is-next"><span>Next</span><strong>${next.title}</strong></a>
      </nav>
    </div>`;
}
