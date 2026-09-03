/* ------------------------------------------------------------------
   One project.

   project.html?p=<slug> — a single template that renders any record in
   projects.js.  The 3D world behind it is themed to the project's
   primary sector, so walking from a sector index into a project does
   not change the room you are standing in.

   The head carries only generic metadata, since the file is shared;
   the title, description and canonical URL are corrected here once the
   slug is known.
   ------------------------------------------------------------------ */

import { SECTIONS, sectionById, PROFILE, coverUrl, behanceUrl } from './data.js';
import { bySlug, bySector, neighbours, projectUrl, projectStill } from './projects.js';
import { createStage } from './stage.js';
import { mediaTile, postTile, startTiles, grid } from './tiles.js';
import { initOverlays } from './overlays.js';
import { bindNav } from './nav.js';

const $ = (s) => document.querySelector(s);

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function initProject() {
  const slug = new URLSearchParams(location.search).get('p') || '';
  const p = bySlug(slug);

  if (!p) { notFound(slug); return; }

  const sector = sectionById(p.sectors[0]) || SECTIONS[0];
  document.body.dataset.layout = 'project';
  document.documentElement.style.setProperty('--accent', sector.color);

  describe(p, sector);
  $('#work').innerHTML = projectHTML(p, sector);
  initOverlays();

  /* ---------------- backdrop ---------------- */
  const stage = await createStage($('#stage'), SECTIONS.map(s => s.id), { fps: 30, quality: 0.84 });
  stage.env.set(sector.id, true);

  const nav = bindNav({
    accent: sector.color, zoom: -2.4, getZ: () => stage.camera.position.z
  });
  startTiles(document, { onNavigate: nav.leave });

  function layout() {
    stage.camera.position.z = 9.2;
    stage.camera.updateProjectionMatrix();
    stage.lights.bounce.position.x = 0;
  }

  let t = 0;
  stage.on({
    resize: layout,
    frame: (dt) => {
      t += dt;
      stage.scene.rotation.y = Math.sin(t * 0.05) * 0.03;
      if (nav.leaving) {
        stage.camera.position.z += (nav.zTarget - stage.camera.position.z) * (1 - Math.exp(-3.5 * dt));
      }
    }
  });

  layout();
  stage.start();
  document.documentElement.setAttribute('data-ready', '');
}

/* ---------------------------------------------------------------- */

/* the shell is generic, so correct the metadata once we know the work */
function describe(p, sector) {
  const desc = p.summary || `${p.title} — ${sector.title} by ${PROFILE.name}.`;
  document.title = `${p.title} — ${PROFILE.name}`;
  const set = (sel, attr, val) => { const el = $(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', desc);
  set('meta[property="og:title"]', 'content', document.title);
  set('meta[property="og:description"]', 'content', desc);
  set('meta[name="twitter:title"]', 'content', document.title);
  set('meta[name="twitter:description"]', 'content', desc);
  set('link[rel="canonical"]', 'href', 'https://www.govindbmohan.com/' + projectUrl(p));
  set('meta[property="og:url"]', 'content', 'https://www.govindbmohan.com/' + projectUrl(p));
  const still = projectStill(p);
  if (still) {
    const img = coverUrl(still);
    const abs = img.startsWith('http') ? img : 'https://www.govindbmohan.com/' + img;
    set('meta[property="og:image"]', 'content', abs);
    set('meta[name="twitter:image"]', 'content', abs);
  }
}

function projectHTML(p, sector) {
  const { prev, next } = neighbours(p, sector.id);
  const hero = heroHTML(p);

  const facts = [
    ['Client', p.client],
    ['Role', p.role],
    ['Year', p.year],
    ['Tools', (p.tools || []).join(' · ')],
    ['Sector', p.sectors.map(id => {
      const s = sectionById(id);
      return s ? `<a href="${s.id}.html" data-nav>${s.title}</a>` : '';
    }).filter(Boolean).join(', ')]
  ].filter(([, v]) => v);

  const links = [];
  if (p.behance) links.push(['Full case study on Behance', behanceUrl(p.behance)]);
  links.push(['More on Instagram', PROFILE.instagram]);

  return `
    <article class="proj">
      <a class="panel__back" href="${sector.id}.html" data-nav>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
             stroke-width="1.6"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${esc(sector.title)}</a>

      <header class="proj__head">
        <span class="proj__k">${esc(sector.index)} · ${esc(sector.title)}</span>
        <h1 class="proj__title">${esc(p.title)}</h1>
        ${p.summary ? `<p class="proj__lede">${esc(p.summary)}</p>` : ''}
      </header>

      ${hero}

      <div class="proj__body">
        <dl class="facts">
          ${facts.map(([k, v]) => `
            <div class="facts__row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
        </dl>

        <div class="proj__copy">
          ${(p.body || []).map(t => `<p>${esc(t)}</p>`).join('')}
          ${!p.body && !p.summary
            ? `<p class="proj__thin">This one lives as a published gallery rather than a
                 write-up — the full set of images is on Behance.</p>` : ''}
          <ul class="proj__links">
            ${links.map(([label, href]) => `
              <li><a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a></li>`).join('')}
          </ul>
        </div>
      </div>

      ${p.media && p.media.length ? `
        <section class="proj__media">
          <h2 class="proj__h2">Work</h2>
          ${grid(p.media.map(m => mediaTile(m)).join(''))}
        </section>` : ''}

      ${p.posts && p.posts.length ? `
        <section class="proj__media">
          <h2 class="proj__h2">Posts</h2>
          ${grid(p.posts.map(postTile).join(''), 'gal--small')}
        </section>` : ''}

      <nav class="panel__nav pnav">
        ${prev ? `<a href="${projectUrl(prev)}" style="--lc:${sector.glow}">
          <span>Previous</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
        ${next ? `<a href="${projectUrl(next)}" style="--lc:${sector.glow}" class="is-next">
          <span>Next</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
      </nav>
    </article>`;
}

/* a still if there is one, a clip if there is not, nothing if neither */
function heroHTML(p) {
  const still = projectStill(p);
  if (still) {
    return `<figure class="proj__hero">
      <img src="${encodeURI(coverUrl(still))}" alt="${esc(p.title)}" decoding="async">
    </figure>`;
  }
  if (p.preview) {
    return `<figure class="proj__hero">
      <video src="${encodeURI(p.preview)}" autoplay loop muted playsinline></video>
    </figure>`;
  }
  return '';
}

function notFound(slug) {
  document.body.dataset.layout = 'project';
  document.title = 'Project not found — ' + PROFILE.name;
  $('#work').innerHTML = `
    <article class="proj">
      <header class="proj__head">
        <span class="proj__k">404</span>
        <h1 class="proj__title">No project called “${esc(slug)}”</h1>
        <p class="proj__lede">It may have been renamed. Everything is listed by sector:</p>
      </header>
      <div class="proj__body">
        <div class="proj__copy">
          <ul class="proj__links">
            ${SECTIONS.map(s => `<li><a href="${s.id}.html">${s.title} — ${bySector(s.id).length} projects</a></li>`).join('')}
            <li><a href="index.html">All work</a></li>
          </ul>
        </div>
      </div>
    </article>`;
  document.documentElement.setAttribute('data-ready', '');
}
