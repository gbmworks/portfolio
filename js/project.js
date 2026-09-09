/* ------------------------------------------------------------------
   One project.

   project.html?p=<slug> — a single template that renders any case
   study in projects.js.  The 3D world behind it is themed to the
   project's primary sector, so walking from a sector index into a
   project does not change the room you are standing in.

   The head carries only generic metadata, since the file is shared;
   the title, description and canonical URL are corrected here once the
   slug is known.

   A slug that is no longer a page is not a dead end.  Twenty-two
   records became archive entries and four became one, so this file
   knows about both and says where the work went instead of showing an
   empty shell.
   ------------------------------------------------------------------ */

import { SECTIONS, sectionById } from './sectors.js';
import { SITE, ACCENT, ACCENT_GLOW, absolute } from './site.js';
import { coverUrl, behanceUrl, projectUrl, sectorUrl } from './links.js';
import { bySlug, archiveBySlug, MOVED, neighbours, homeSector, pageEntries, projectStill } from './projects.js';
import { createStage } from './stage.js';
import { mediaTile, startTiles, grid } from './tiles.js';
import { mountShell } from './shell.js';
import { bindNav } from './nav.js';

const $ = (s) => document.querySelector(s);

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function initProject() {
  const slug = new URLSearchParams(location.search).get('p') || '';

  /* a slug that was folded into another project keeps working */
  const p = bySlug(MOVED[slug] || slug);

  if (!p) { missing(slug); return; }

  /* the page it is actually listed on, not the tag it carries */
  const sector = sectionById(homeSector(p)) || SECTIONS[0];
  document.body.dataset.layout = 'project';
  document.documentElement.style.setProperty('--accent', ACCENT);

  describe(p, sector);
  mountShell();
  $('#work').innerHTML = projectHTML(p, sector);

  /* ---------------- backdrop ---------------- */
  /* a backdrop, not the subject — see the note in page.js */
  const stage = await createStage($('#stage'), SECTIONS.map(s => s.id),
    { fps: 24, quality: 0.84, bloom: false });
  stage.env.set(sector.id, true);

  const nav = bindNav({
    accent: ACCENT, zoom: -2.4, getZ: () => stage.camera.position.z
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
  const desc = p.summary || `${p.title} — ${sector.title} by ${SITE.name}.`;
  document.title = `${p.title} — ${SITE.name}`;
  const set = (sel, attr, val) => { const el = $(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', desc);
  set('meta[property="og:title"]', 'content', document.title);
  set('meta[property="og:description"]', 'content', desc);
  set('meta[name="twitter:title"]', 'content', document.title);
  set('meta[name="twitter:description"]', 'content', desc);
  set('link[rel="canonical"]', 'href', absolute(projectUrl(p)));
  set('meta[property="og:url"]', 'content', absolute(projectUrl(p)));
  const still = projectStill(p);
  if (still) {
    const img = absolute(coverUrl(still));
    set('meta[property="og:image"]', 'content', img);
    set('meta[name="twitter:image"]', 'content', img);
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
      return s ? `<a href="${sectorUrl(s)}" data-nav>${s.title}</a>` : '';
    }).filter(Boolean).join(', ')]
  ].filter(([, v]) => v);

  const links = [];
  /* If the work is playable, that is the first thing to offer.  Nothing on
     the site links here — the sector index goes straight to the game — but
     an old or shared project URL should still lead to it. */
  if (p.live) links.push(['Play the game', p.live]);
  if (p.behance) links.push(['Full case study on Behance', behanceUrl(p.behance)]);
  links.push(['More on Instagram', SITE.instagram]);

  return `
    <article class="proj">
      <a class="panel__back" href="${sectorUrl(sector)}" data-nav>
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
            ? `<p class="proj__thin">Not written up — what there is to see is the
                 gallery and the posts below.</p>` : ''}
          <ul class="proj__links">
            ${links.map(([label, href]) => {
              const out = /^https?:/i.test(href);
              return `<li><a href="${href}"${out ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}${out ? ' ↗' : ''}</a></li>`;
            }).join('')}
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
          ${grid(p.posts.map(x => mediaTile({ src: x.cover, title: x.title })).join(''), 'gal--small')}
        </section>` : ''}

      <nav class="panel__nav pnav">
        ${prev ? `<a href="${prev.live || projectUrl(prev)}" style="--lc:${ACCENT_GLOW}">
          <span>Previous</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
        ${next ? `<a href="${next.live || projectUrl(next)}" style="--lc:${ACCENT_GLOW}" class="is-next">
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

/* ------------------------------------------------------------------
   A slug with no page.

   Either it is in the archive — in which case the work exists, it just
   lives on Behance now — or it is nothing, and the sectors are listed.
   ------------------------------------------------------------------ */
function missing(slug) {
  document.body.dataset.layout = 'project';
  document.documentElement.style.setProperty('--accent', ACCENT);
  mountShell();

  const a = archiveBySlug(slug);
  const head = a
    ? {
        k: 'Archive',
        title: a.title,
        lede: 'This one is a published gallery rather than a write-up, so it lives ' +
              'on Behance rather than as a page here.',
        links: [
          a.behance ? [`Open “${a.title}” on Behance`, behanceUrl(a.behance)] : null,
          ...a.sectors.map(id => {
            const s = sectionById(id);
            return s ? [`${s.title} — the rest of the sector`, sectorUrl(s)] : null;
          })
        ].filter(Boolean)
      }
    : {
        k: '404',
        title: `No project called “${slug}”`,
        lede: 'It may have been renamed. Everything is listed by sector:',
        links: [
          ...SECTIONS.map(s => [`${s.title} — ${pageEntries(s.id).length} pieces`, sectorUrl(s)]),
          ['All work', 'index.html']
        ]
      };

  document.title = (a ? a.title : 'Not found') + ' — ' + SITE.name;

  $('#work').innerHTML = `
    <article class="proj">
      <header class="proj__head">
        <span class="proj__k">${esc(head.k)}</span>
        <h1 class="proj__title">${esc(head.title)}</h1>
        <p class="proj__lede">${esc(head.lede)}</p>
      </header>
      <div class="proj__body">
        <div class="proj__copy">
          <ul class="proj__links">
            ${head.links.map(([label, href]) => {
              const out = /^https?:/i.test(href);
              return `<li><a href="${href}"${out ? ' target="_blank" rel="noopener noreferrer"' : ' data-nav'}>${esc(label)}${out ? ' ↗' : ''}</a></li>`;
            }).join('')}
          </ul>
        </div>
      </div>
    </article>`;

  bindNav({ accent: ACCENT });
  document.documentElement.setAttribute('data-ready', '');
}
