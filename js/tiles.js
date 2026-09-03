/* ------------------------------------------------------------------
   Tile walls.

   One engine renders every grid on the site: the Visualization mosaic,
   a project page's own media, and the Instagram strip under an index.
   The wall sits desaturated and still; hover a tile and it comes to
   colour and plays at normal speed.  Only what you are actually
   looking at decodes.

   A tile either goes somewhere — a project page, a published post —
   or, having nowhere to go, opens in the lightbox.
   ------------------------------------------------------------------ */

import { coverUrl, igUrl } from './data.js';
import { projectUrl, projectStill } from './projects.js';

const ATTACH_PX = 400;      // load a poster frame this close to the viewport
const RELEASE_MS = 5000;    // ...and release it this long after leaving
const MAX_AUTO = 2;         // tiles that play unattended on touch screens

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isVideo = (src) => /\.(webm|mp4|mov)$/i.test(src);
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* marks for a tile that has no image of its own to show */
const GLYPH = {
  Instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="3" y="3" width="18" height="18" rx="5"/>
      <circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>
    </svg>`,
  Behance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
      <path d="M2 6h6.2a3 3 0 0 1 0 6H2zM2 12h6.8a3 3 0 0 1 0 6H2z" stroke-linejoin="round"/>
      <path d="M14.4 14.2h7.2a3.6 3.6 0 1 0-7.2 0zM15 7.4h6"/>
    </svg>`,
  Project: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"
                 stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5 12 21l9-4.5"/>
    </svg>`
};

/* ------------------------------------------------------------------
   one tile
   ------------------------------------------------------------------ */

/*  media  { src }            a local file, lazy-loaded
    still  'path'             an image to show instead
    href   ''                 where a click goes; empty opens the lightbox
    group  'Fitmint'          the small line above the title
    mark   'Behance'          badge for a tile with no image of its own  */
function tile({ title, group = '', href = '', still = '', clip = '', mark = '', label = '' }) {
  const src = still || clip;
  const kind = still ? 'image' : clip ? 'video' : 'none';
  const el = still
    ? `<img class="tile__el" data-src="${encodeURI(still)}" alt="${esc(title)}" decoding="async">
       <span class="tile__spin"></span>`
    : clip
    ? `<video class="tile__el" data-src="${encodeURI(clip)}" muted loop playsinline
              preload="none" tabindex="-1"></video><span class="tile__spin"></span>`
    /* no artwork anywhere for this one — say the name instead of showing
       a broken frame, and let the card carry it */
    : `<span class="tile__plate">${esc(title)}</span>
       ${mark ? `<span class="tile__glyph">${GLYPH[mark] || GLYPH.Project}</span>` : ''}`;

  return `
    <figure class="tile${href ? ' has-link' : ''}${kind === 'none' ? ' is-flat' : ''}"
            data-title="${esc(title)}" data-kind="${kind}"
            ${src ? `data-src="${encodeURI(src)}"` : ''}
            ${href ? `data-href="${esc(href)}"` : ''}
            tabindex="0" role="${href ? 'link' : 'button'}"
            aria-label="${esc(label || title)}">
      <div class="tile__media">${el}</div>
      <figcaption class="tile__cap">
        ${group ? `<span class="tile__group">${esc(group)}</span>` : ''}
        <span class="tile__title">${esc(title)}</span>
        ${mark ? `<span class="tile__src">${esc(mark)} ↗</span>` : ''}
      </figcaption>
    </figure>`;
}

/* a project, as a tile that opens its page */
export const projectTile = (p) => {
  const still = projectStill(p);
  return tile({
    title: p.title,
    group: p.client || p.role || '',
    href: projectUrl(p),
    still: still ? coverUrl(still) : '',
    clip: still ? '' : (p.preview || ''),
    label: p.title + ' — open the project'
  });
};

/* an Instagram one-off, as a tile that opens the post */
export const postTile = (post) => tile({
  title: post.title,
  href: igUrl(post),
  still: post.cover || '',
  mark: 'Instagram',
  label: post.title + ' — opens on Instagram'
});

/* a file belonging to a project — nowhere to go, so it opens large */
export const mediaTile = (item, group = '') => tile({
  title: item.title,
  group,
  still: isVideo(item.src) ? '' : item.src,
  clip: isVideo(item.src) ? item.src : ''
});

export const grid = (html, extra = '') =>
  `<div class="gal gal--mosaic${extra ? ' ' + extra : ''}"><div class="gal-grid">${html}</div></div>`;

/* ------------------------------------------------------------------
   the Visualization page: every project in the sector, then the
   one-offs that never became one
   ------------------------------------------------------------------ */
export function buildMosaic(container, def, projects, posts, sections) {
  const index = sections.findIndex(s => s.id === def.id);
  const prev = sections[(index - 1 + sections.length) % sections.length];
  const next = sections[(index + 1) % sections.length];

  container.innerHTML = `
    <header class="galbar">
      <a class="galbar__back" href="index.html" data-home>← All work</a>
      <h1 class="galbar__title"><span>${def.index}</span>${def.title}</h1>
      <span class="galbar__count">${projects.length} projects</span>
    </header>

    ${grid(projects.map(projectTile).join(''))}

    ${posts.length ? `
      <section class="strip">
        <header class="strip__head">
          <h2>Also on Instagram</h2>
          <a href="https://www.instagram.com/vindgo.visual/" target="_blank"
             rel="noopener noreferrer">@vindgo.visual ↗</a>
        </header>
        ${grid(posts.map(postTile).join(''), 'gal--small')}
      </section>` : ''}

    <footer class="page-foot">
      <nav class="panel__nav">
        <a href="${prev.id}.html" style="--lc:${prev.glow}"><span>Previous</span><strong>${prev.title}</strong></a>
        <a href="${next.id}.html" style="--lc:${next.glow}" class="is-next"><span>Next</span><strong>${next.title}</strong></a>
      </nav>
      <p class="page-foot__note">
        Hover a tile to bring it to colour. Project tiles open a page here;
        Instagram tiles open the post.
      </p>
    </footer>`;
}

/* ------------------------------------------------------------------
   playback — lazy poster frames, hover-to-play, lightbox
   ------------------------------------------------------------------ */

export function startTiles(root = document, { onNavigate = null } = {}) {
  const tiles = [...root.querySelectorAll('.tile')].map(el => ({
    el,
    media: el.querySelector('.tile__el'),
    isVideo: el.dataset.kind === 'video',
    href: el.dataset.href || '',
    attached: false,
    releaseTimer: 0
  }));
  if (!tiles.length) return { destroy() {} };
  const byEl = new Map(tiles.map(t => [t.el, t]));

  /* ---- lazy poster frames ---- */
  const attach = (t) => {
    clearTimeout(t.releaseTimer);
    if (t.attached || !t.media) return;
    t.attached = true;
    const src = t.media.dataset.src;
    const ready = () => {
      const w = t.media.videoWidth || t.media.naturalWidth;
      const h = t.media.videoHeight || t.media.naturalHeight;
      /* the wall stays even: every tile is 3:4 or 4:3, cropped to fit,
         rather than following a 9:16 clip all the way down the page */
      if (w && h) t.el.style.setProperty('--ar', w < h ? '3 / 4' : '4 / 3');
      t.el.classList.add('is-ready');
    };
    if (t.isVideo) {
      /* metadata + a media fragment paints a still without playing */
      t.media.preload = 'metadata';
      t.media.src = src + '#t=0.1';
      t.media.addEventListener('loadedmetadata', ready, { once: true });
    } else {
      t.media.src = src;
      t.media.addEventListener('load', ready, { once: true });
    }
  };

  const release = (t) => {
    if (!t.attached || !t.isVideo) return;
    t.releaseTimer = setTimeout(() => {
      t.media.pause();
      t.media.removeAttribute('src');
      t.media.load();
      t.attached = false;
      t.el.classList.remove('is-ready', 'is-live');
    }, RELEASE_MS);
  };

  const near = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const t = byEl.get(e.target);
      if (!t) return;
      if (e.isIntersecting) attach(t); else release(t);
    });
  }, { rootMargin: `${ATTACH_PX}px 0px` });
  tiles.forEach(t => t.media && near.observe(t.el));

  /* ---- hover brings a tile to colour and plays it ---- */
  const wake = (t) => {
    if (!t || reduced) return;
    attach(t);
    t.el.classList.add('is-live');
    if (t.isVideo) t.media.play().catch(() => {});
  };
  const rest = (t) => {
    if (!t) return;
    t.el.classList.remove('is-live');
    if (t.isVideo) t.media.pause();
  };

  if (finePointer) {
    tiles.forEach(t => {
      t.el.addEventListener('pointerenter', () => wake(t));
      t.el.addEventListener('pointerleave', () => rest(t));
    });
  } else {
    /* touch has no hover: whatever is squarely on screen plays, two at a time */
    const live = new Set();
    const auto = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const t = byEl.get(e.target);
        if (!t) return;
        if (e.intersectionRatio > 0.6) {
          if (live.size < MAX_AUTO || live.has(t)) { live.add(t); wake(t); }
        } else if (live.has(t)) { live.delete(t); rest(t); }
      });
    }, { threshold: [0, 0.6, 0.9] });
    tiles.forEach(t => auto.observe(t.el));
  }

  /* focus brings a tile to life too, so keyboard users see the same thing */
  tiles.forEach(t => {
    t.el.addEventListener('focus', () => wake(t));
    t.el.addEventListener('blur', () => rest(t));
  });

  /* ---- lightbox, for pieces with nowhere to link ---- */
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<button class="lightbox__close" type="button" aria-label="Close">×</button>
                   <div class="lightbox__stage"></div>
                   <p class="lightbox__cap"></p>`;
  document.body.appendChild(box);
  const stage = box.querySelector('.lightbox__stage');

  const closeBox = () => {
    box.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    stage.innerHTML = '';
  };
  const openBox = (t) => {
    const src = t.el.dataset.src;
    if (!src) return;
    stage.innerHTML = t.isVideo
      ? `<video src="${src}" autoplay loop muted playsinline controls></video>`
      : `<img src="${src}" alt="${esc(t.el.dataset.title)}">`;
    box.querySelector('.lightbox__cap').textContent = t.el.dataset.title;
    box.classList.add('is-open');
    document.body.classList.add('is-locked');
  };

  /* a project tile is a same-site link, so it navigates; everything
     else either opens its post in a new tab or opens here */
  const activate = (t) => {
    if (!t) return;
    if (!t.href) { openBox(t); return; }
    if (/^https?:/i.test(t.href)) window.open(t.href, '_blank', 'noopener,noreferrer');
    else if (onNavigate) onNavigate(t.href);
    else location.href = t.href;
  };

  document.addEventListener('click', e => {
    const tileEl = e.target.closest && e.target.closest('.tile');
    if (tileEl) { activate(byEl.get(tileEl)); return; }
    if (e.target.closest('.lightbox')) closeBox();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeBox(); return; }
    /* Enter / Space activate a focused tile, same as a click */
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tileEl = document.activeElement && document.activeElement.closest('.tile');
    if (!tileEl) return;
    e.preventDefault();
    activate(byEl.get(tileEl));
  });

  return { destroy() { near.disconnect(); box.remove(); } };
}
