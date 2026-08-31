/* ------------------------------------------------------------------
   Full-page media gallery.

   The wall sits desaturated and still.  Hover a tile and it comes to
   colour and plays at normal speed; move away and it settles back.
   Only what you are actually looking at decodes.

   A tile whose piece is published links straight out to that Behance
   project or Instagram post; anything unpublished opens in a lightbox.
   ------------------------------------------------------------------ */

import { PROFILE, IG_HIGHLIGHTS, behanceUrl, igUrl, coverUrl } from './data.js';

const ATTACH_PX = 400;      // load a poster frame this close to the viewport
const RELEASE_MS = 5000;    // ...and release it this long after leaving
const MAX_AUTO = 2;         // tiles that play unattended on touch screens

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isVideo = (src) => /\.(webm|mp4|mov)$/i.test(src);

/* marks for a tile that has no image of its own to show */
const GLYPH = {
  Instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
      <rect x="3" y="3" width="18" height="18" rx="5"/>
      <circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>
    </svg>`,
  Behance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
      <path d="M2 6h6.2a3 3 0 0 1 0 6H2zM2 12h6.8a3 3 0 0 1 0 6H2z" stroke-linejoin="round"/>
      <path d="M14.4 14.2h7.2a3.6 3.6 0 1 0-7.2 0zM15 7.4h6"/>
    </svg>`
};

/* ------------------------------------------------------------------
   Published-work index.  Shared by both layouts: every row links out
   to its Behance project or Instagram post.
   ------------------------------------------------------------------ */
export function linkList(def) {
  const rows = (link, url) => link.map((p, i) => {
    /* a Behance project's own cover doubles as the stage still */
    const still = p.still || coverUrl(p);
    return `
    <a class="plink" href="${url(p)}" target="_blank" rel="noopener noreferrer"
       ${p.preview ? `data-preview="${p.preview}"` : ''}
       ${still ? `data-still="${still}"` : ''}>
      <span class="plink__n">${String(i + 1).padStart(2, '0')}</span>
      <span class="plink__t">${p.title}</span>
      <span class="plink__y">${p.year || ''}</span>
      <svg class="plink__go" viewBox="0 0 24 24" width="13" height="13" fill="none"
           stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 17 17 7M9 7h8v8"/>
      </svg>
    </a>`;
  }).join('');

  const block = (title, handle, href, items, url, note, tags) => !items.length ? '' : `
    <section class="plinks">
      <header class="plinks__head">
        <h2>${title}</h2>
        <a href="${href}" target="_blank" rel="noopener noreferrer">${handle} ↗</a>
      </header>
      ${note ? `<p class="plinks__note">${note}</p>` : ''}
      ${tags && tags.length ? `<p class="plinks__tags">${tags.map(t => `<span>${t}</span>`).join('')}</p>` : ''}
      <div class="plinks__list">${rows(items, url)}</div>
    </section>`;

  const hl = IG_HIGHLIGHTS[def.id] || [];

  return block('Published work', 'behance.net/govindbm', PROFILE.behance,
               def.behance || [], behanceUrl, def.behanceNote)
       + block('On Instagram', '@vindgo.visual', PROFILE.instagram,
               def.instagram || [], igUrl, '',
               hl.length ? hl.map(h => 'Highlight: ' + h) : null);
}

/* the same index, rendered as tiles so a gallery page stays one mosaic */
export function linkTiles(def) {
  /* Anything already standing in the mosaic above — same clip, or same
     destination — must not appear again down here. */
  const shownClips = new Set();
  const shownHrefs = new Set();
  (def.gallery || []).forEach(g => {
    if (g.href) shownHrefs.add(g.href);
    g.items.forEach(it => {
      shownClips.add(it.src);
      if (it.href) shownHrefs.add(it.href);
    });
  });

  const rows = [
    ...(def.behance || []).map(p => ({ ...p, url: behanceUrl(p), cover: coverUrl(p), src: 'Behance' })),
    ...(def.instagram || []).map(p => ({ ...p, url: igUrl(p), src: 'Instagram' }))
  ].filter(p => !shownHrefs.has(p.url) && !(p.preview && shownClips.has(p.preview)));

  if (!rows.length) return '';

  const tiles = rows.map(p => `
    <figure class="tile tile--link has-link${p.cover || p.preview ? '' : ' is-flat'}"
            data-title="${p.title}" data-href="${p.url}"
            data-kind="${p.cover ? 'image' : p.preview ? 'video' : 'none'}"
            ${p.cover ? `data-src="${encodeURI(p.cover)}"`
              : p.preview ? `data-src="${encodeURI(p.preview)}"` : ''}>
      <div class="tile__media">
        ${p.cover
          ? `<img class="tile__el" data-src="${encodeURI(p.cover)}" alt="${p.title}" decoding="async">
             <span class="tile__spin"></span>`
          : p.preview
          ? `<video class="tile__el" data-src="${encodeURI(p.preview)}" muted loop playsinline
                    preload="none" tabindex="-1"></video><span class="tile__spin"></span>`
          : `<span class="tile__glyph">${GLYPH[p.src] || ''}</span>
             <span class="tile__mark">${p.src} post</span>`}
      </div>
      <figcaption class="tile__cap">
        <span class="tile__group">${p.src}</span>
        <span class="tile__title">${p.title}</span>
        <span class="tile__src">${p.src} ↗</span>
      </figcaption>
    </figure>`).join('');

  return tiles;
}

/* ---------------------------------------------------------------- */
/* markup                                                             */
/* ---------------------------------------------------------------- */

export function buildGallery(container, def, sections) {
  const index = sections.findIndex(s => s.id === def.id);
  const prev = sections[(index - 1 + sections.length) % sections.length];
  const next = sections[(index + 1) % sections.length];
  const count = def.gallery.reduce((n, g) => n + g.items.length, 0);

  /* One continuous wall — no group headers.  The group name rides on
     the tile instead, so the Fitmint / Lenskart context is not lost. */
  const media = def.gallery.flatMap(g => g.items.map(item => {
    const src = encodeURI(item.src);
    const href = item.href || g.href || '';
    const source = item.source || (item.href ? '' : g.source) || '';
    const el = isVideo(item.src)
      ? `<video class="tile__el" data-src="${src}" muted loop playsinline
                preload="none" tabindex="-1"></video>`
      : `<img class="tile__el" data-src="${src}" alt="${item.title}" decoding="async">`;
    return `
      <figure class="tile${href ? ' has-link' : ''}" data-title="${item.title}" data-src="${src}"
              data-kind="${isVideo(item.src) ? 'video' : 'image'}"
              ${href ? `data-href="${href}"` : ''}>
        <div class="tile__media">${el}<span class="tile__spin"></span></div>
        <figcaption class="tile__cap">
          <span class="tile__group">${g.title}</span>
          <span class="tile__title">${item.title}</span>
          ${source ? `<span class="tile__src">${source} ↗</span>` : ''}
        </figcaption>
      </figure>`;
  })).join('');

  container.innerHTML = `
    <header class="galbar">
      <a class="galbar__back" href="index.html" data-home>← All work</a>
      <h1 class="galbar__title"><span>${def.index}</span>${def.title}</h1>
      <span class="galbar__count">${count} pieces</span>
    </header>

    <div class="gal gal--mosaic">
      <div class="gal-grid">${media}${linkTiles(def)}</div>
    </div>

    <footer class="page-foot">
      <nav class="panel__nav">
        <a href="${prev.id}.html" style="--lc:${prev.glow}"><span>Previous</span><strong>${prev.title}</strong></a>
        <a href="${next.id}.html" style="--lc:${next.glow}" class="is-next"><span>Next</span><strong>${next.title}</strong></a>
      </nav>
      <p class="page-foot__note">
        Hover a tile to bring it to colour and play it. Tiles marked Behance or
        Instagram open the published post; the rest open here.
      </p>
    </footer>`;

  return {};
}

/* ---------------------------------------------------------------- */
/* playback                                                           */
/* ---------------------------------------------------------------- */

export function startGallery() {
  const tiles = [...document.querySelectorAll('.tile')].map(el => ({
    el,
    media: el.querySelector('.tile__el'),
    isVideo: el.dataset.kind === 'video',
    href: el.dataset.href || '',
    attached: false,
    releaseTimer: 0
  }));
  const byEl = new Map(tiles.map(t => [t.el, t]));

  /* ---- lazy poster frames ---- */
  const attach = (t) => {
    clearTimeout(t.releaseTimer);
    if (t.attached) return;
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
  tiles.forEach(t => near.observe(t.el));

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
    stage.innerHTML = t.isVideo
      ? `<video src="${src}" autoplay loop muted playsinline controls></video>`
      : `<img src="${src}" alt="${t.el.dataset.title}">`;
    box.querySelector('.lightbox__cap').textContent = t.el.dataset.title;
    box.classList.add('is-open');
    document.body.classList.add('is-locked');
  };

  document.addEventListener('click', e => {
    const tileEl = e.target.closest && e.target.closest('.tile');
    if (tileEl) {
      const t = byEl.get(tileEl);
      if (t && t.href) window.open(t.href, '_blank', 'noopener,noreferrer');
      else if (t) openBox(t);
      return;
    }
    if (e.target.closest('.lightbox')) closeBox();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeBox(); });

  return {
    /* 0 at the top of the hero, 1 once it has scrolled away */
    /* the mosaic owns the page, so the wheel hands over immediately */
    heroProgress() { return 1; }
  };
}
