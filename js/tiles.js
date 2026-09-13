/* ------------------------------------------------------------------
   Tile walls.

   One engine renders every grid on the site: the Visualization mosaic,
   the archive of published galleries, a project page's own media, and
   the Instagram strip under an index.  The wall sits desaturated and
   still; hover a tile and it comes to colour and plays at normal
   speed.  Only what you are actually looking at decodes.

   A tile either goes somewhere — a project page, a Behance gallery, a
   published post — or, having nowhere to go, opens in the lightbox.
   ------------------------------------------------------------------ */

import { pageEntries } from './projects.js';

const ATTACH_PX = 400;      // load a poster frame this close to the viewport
const RELEASE_MS = 5000;    // ...and release it this long after leaving
const MAX_AUTO = 2;         // tiles that play unattended on touch screens

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The four ratios a mosaic tile may be cropped to, and the rule for
   picking one.  Measured across the 29 pieces on Visualization: 17 are
   9:16 reels, 8 sit between 0.64 and 1.0, 3 are Behance covers near
   4:3, one is 16:9.  Nearest-in-log-space, so 1.0 is judged equally far
   from 3:4 and 4:3 rather than being pulled to the wider one. */
const SHAPES = { '9x16': 9 / 16, '3x4': 3 / 4, '4x3': 4 / 3, '16x9': 16 / 9 };

function nearestShape(ar) {
  let best = '3x4', d = Infinity;
  for (const [name, r] of Object.entries(SHAPES)) {
    const dist = Math.abs(Math.log(ar / r));
    /* strict, and the list runs tallest first, so a square — exactly
       equidistant from 3:4 and 4:3 — keeps the wall's portrait rhythm
       instead of being cropped into a landscape cell */
    if (dist < d) { d = dist; best = name; }
  }
  return best;
}
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

/*  still  'path'             an image to show
    clip   'path'             a local file, lazy-loaded
    focus  '50% 25%'          object-position for the still, for a cover
                              whose subject is not in the middle of it
    href   ''                 where a click goes; empty opens the lightbox
    group  'Fitmint'          the small line above the title
    mark   'Behance'          badge naming where a click lands  */
function tile({ title, group = '', href = '', still = '', clip = '', focus = '', mark = '', label = '' }) {
  const src = still || clip;
  const kind = still ? 'image' : clip ? 'video' : 'none';

  /* A still and a clip are no longer either/or.  Every clip has a poster
     (tools/media.mjs), so the tile paints the poster and layers the
     video over it — and the video's src stays unset until somebody
     hovers.  A wall of twenty-six tiles used to pull `preload=metadata`
     from twenty-six multi-megabyte clips just to show a frame.

     Only the still takes `focus`.  The clip layered over it is a
     different file framed differently — the same reason preview.js
     points `previewFocus` at the video and leaves its still centred. */
  const el = still
    ? `<img class="tile__el" data-src="${encodeURI(still)}" alt="${esc(title)}" decoding="async"
              ${focus ? `style="object-position:${esc(focus)}"` : ''}>
       ${clip ? `<video class="tile__clip" data-src="${encodeURI(clip)}" muted loop playsinline
              preload="none" tabindex="-1"></video>` : ''}
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

/* One tile for anything on a page.

   There is deliberately no projectTile / archiveTile / postTile any
   more.  A page is one running order and everything in it is drawn the
   same way; `entry.href` already knows whether the click stays here,
   opens a Behance gallery or opens a post, and nothing on the tile
   announces which. */
export const entryTile = (entry) => tile({
  title: entry.title,
  group: entry.meta,
  href: entry.href,
  still: entry.still,
  clip: entry.clip,
  focus: entry.stillFocus,
  label: entry.title + (entry.external ? ' — opens where it is published' : '')
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
   the gallery layout: the page's running order as one wall
   ------------------------------------------------------------------ */
export function buildMosaic(container, def, entries, { nav = '', foot = '' } = {}) {
  container.innerHTML = `
    <header class="galbar">
      <a class="galbar__back" href="index.html" data-home>← All work</a>
      <h1 class="galbar__title"><span>${def.index}</span>${def.title}</h1>
      <span class="galbar__count">${entries.length} pieces</span>
      ${nav}
    </header>

    ${grid(entries.map(entryTile).join(''))}

    <footer class="page-foot">
      ${foot}
      <p class="page-foot__note">
        Hover a tile to bring it to colour.
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
    /* the hover-only video layered over a poster, if there is one */
    clip: el.querySelector('.tile__clip'),
    isVideo: el.dataset.kind === 'video',
    href: el.dataset.href || '',
    attached: false,
    clipOn: false,
    releaseTimer: 0
  }));
  if (!tiles.length) return { destroy() {} };
  const byEl = new Map(tiles.map(t => [t.el, t]));

  /* ---- the mosaic's row spans ----

     The gallery grid lays 8px row tracks so a tile can stop where its
     content stops instead of waiting for the tallest cell in its row.
     That means something has to say how many tracks each tile occupies,
     and only the browser knows: the media's ratio comes from CSS, the
     caption's height from how many lines the title wrapped to.

     So it is measured, once per tile, whenever its size changes — a
     poster landing, a title rewrapping at a new width, a breakpoint
     moving the column count.  A ResizeObserver catches all three
     without polling and without a resize listener. */
  const ROW = 8;
  const GAP = 14;
  const wall = root.querySelector && root.querySelector('.gal-grid');
  const packs = !!wall && getComputedStyle(wall).gridAutoRows === ROW + 'px';

  const span = (el) => {
    const h = el.getBoundingClientRect().height;
    if (h) el.style.gridRowEnd = 'span ' + Math.max(1, Math.round((h + GAP) / ROW));
  };

  const sizer = packs ? new ResizeObserver(rows => rows.forEach(r => span(r.target))) : null;
  if (sizer) tiles.forEach(t => sizer.observe(t.el));

  /* ---- lazy poster frames ---- */
  const attach = (t) => {
    clearTimeout(t.releaseTimer);
    if (t.attached || !t.media) return;
    t.attached = true;
    const src = t.media.dataset.src;
    const ready = () => {
      const w = t.media.videoWidth || t.media.naturalWidth;
      const h = t.media.videoHeight || t.media.naturalHeight;
      /* Report the shape of the file and let the stylesheet decide what
         to draw.  `orient` is the coarse answer the masonry walls use;
         `shape` is the nearest of the four ratios the sector mosaic
         crops to, so a 4:5 post is not stretched to 9:16 and a Behance
         cover at 1.28 is not squashed to 16:9. */
      if (w && h) {
        t.el.dataset.orient = w < h ? 'portrait' : 'landscape';
        t.el.dataset.shape = nearestShape(w / h);
      }
      t.el.classList.add('is-ready');
    };
    if (t.isVideo) {
      /* metadata + a media fragment paints a still without playing.
         Both events are worth listening to: loadedmetadata gives the
         dimensions the wall needs, and loadeddata is what fires once
         there is an actual frame — a clip whose seek to 0.1s never
         completes would otherwise sit grey forever. */
      t.media.preload = 'metadata';
      t.media.src = src + '#t=0.1';
      t.media.addEventListener('loadedmetadata', ready, { once: true });
      t.media.addEventListener('loadeddata', ready, { once: true });
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

  /* ---- hover brings a tile to colour and plays it ----
     This is the only place a clip is ever requested.  Until someone
     hovers, a tile costs one poster JPEG. */
  const wake = (t) => {
    if (!t || reduced) return;
    attach(t);
    t.el.classList.add('is-live');
    if (t.isVideo) { t.media.play().catch(() => {}); return; }
    if (!t.clip) return;
    if (!t.clipOn) {
      t.clipOn = true;
      t.clip.preload = 'auto';
      t.clip.src = t.clip.dataset.src;
      t.clip.addEventListener('loadeddata', () => t.el.classList.add('is-clip'), { once: true });
    }
    t.clip.play().catch(() => {});
  };
  const rest = (t) => {
    if (!t) return;
    t.el.classList.remove('is-live', 'is-clip');
    if (t.isVideo) t.media.pause();
    else if (t.clip && t.clipOn) t.clip.pause();
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
     else either opens where it is published or opens here */
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

  return { destroy() { sizer && sizer.disconnect(); near.disconnect(); box.remove(); } };
}
