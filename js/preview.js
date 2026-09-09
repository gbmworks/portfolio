/* ------------------------------------------------------------------
   Preview stage.

   On a section page the wheel is gone and the space it used to fill is
   the stage: hovering a row plays that project there, large, centred in
   whatever the sheet leaves.

   Three states, in order of what a row actually has:

     play    a clip.  The row's still, if it has one, paints underneath
             while the video decodes, so sweeping a long index never
             flashes black between rows.
     still   a cover and no clip.
     empty   neither — which is honest, not broken: three of the four
             Technical Art projects have no artwork in this repo at all.
             That state is a typographic plate, the project's name set
             large on the dark card, the same treatment the tile wall
             uses, rather than one grey line adrift in a large frame.

   One <video> and one <img> are reused for the whole page, so running
   down a fifty-row index never spawns a second decoder.
   ------------------------------------------------------------------ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initStage({ mount, rows, sector = '' } = {}) {
  if (!mount) return { destroy() {} };

  mount.innerHTML = `
    <div class="stage__frame">
      <img class="stage__still" alt="">
      <video class="stage__video" muted loop playsinline preload="none"></video>
      <div class="stage__empty">
        <span class="stage__title"></span>
        <span class="stage__meta"></span>
        <span class="stage__note"></span>
      </div>
      <div class="stage__idle">
        <span class="stage__sector">${sector}</span>
        <span class="stage__hint">Hover a project</span>
      </div>
    </div>`;

  const frame = mount.querySelector('.stage__frame');
  const video = mount.querySelector('.stage__video');
  const still = mount.querySelector('.stage__still');
  const title = mount.querySelector('.stage__title');
  const meta = mount.querySelector('.stage__meta');
  const note = mount.querySelector('.stage__note');

  let live = null;
  let idleTimer = 0;

  /* The clip reveals itself when it can actually paint, not when play()
     resolves — play() resolving only means playback started, and on a
     cold element it can settle after the pointer has already moved on.
     Listening to the element instead means the still holds until there
     is a real frame to cross-fade to. */
  const reveal = () => {
    if (live && video.dataset.src === live.dataset.preview && video.readyState >= 2) {
      frame.dataset.mode = 'play';
    }
  };
  video.addEventListener('loadeddata', reveal);
  video.addEventListener('playing', reveal);

  const textOf = (row, sel) => {
    const el = row.querySelector(sel);
    return el ? el.textContent.trim() : '';
  };

  const show = (row) => {
    clearTimeout(idleTimer);
    live = row;

    const clip = row.dataset.preview;
    const img = row.dataset.still;

    title.textContent = (textOf(row, '.plink__t') || row.textContent.trim()).slice(0, 70);
    meta.textContent = textOf(row, '.plink__y');

    /* the still is the instant layer — set it first, whether or not a
       clip follows, so something is on screen this frame */
    if (img && still.dataset.src !== img) {
      still.dataset.src = img;
      still.src = encodeURI(img);
    }

    if (clip && !reduced) {
      if (video.dataset.src !== clip) {
        video.dataset.src = clip;
        /* preload="none" is right for a tile wall, wrong for the one
           element the whole page shares: without this the element sits
           at readyState 0 and play() never resolves */
        video.preload = 'auto';
        video.src = encodeURI(clip);
      }
      /* hold on the still (or the last frame) until the clip can
         actually paint, then cross-fade to it */
      frame.dataset.mode = img ? 'still' : 'empty';
      if (!img) note.textContent = 'Loading…';
      try { video.currentTime = 0; } catch { /* not seekable yet */ }
      video.play().catch(() => {
        /* autoplay refused or the file is missing — fall back honestly */
        if (live === row && !img) {
          frame.dataset.mode = 'empty';
          note.textContent = 'No artwork here yet — open the project';
        }
      });
    } else if (img) {
      frame.dataset.mode = 'still';
      video.pause();
    } else {
      frame.dataset.mode = 'empty';
      video.pause();
      note.textContent = 'No artwork here yet — open the project';
    }

    mount.classList.add('is-on');
  };

  const rest = () => {
    live = null;
    video.pause();
    /* hold the last frame for a beat so sweeping the list does not strobe */
    idleTimer = setTimeout(() => {
      if (live) return;
      frame.dataset.mode = 'idle';
      mount.classList.remove('is-on');
    }, 420);
  };

  rows.forEach(row => {
    row.addEventListener('pointerenter', () => show(row));
    row.addEventListener('pointerleave', rest);
    row.addEventListener('focus', () => show(row));
    row.addEventListener('blur', rest);
  });

  frame.dataset.mode = 'idle';

  return {
    destroy() {
      clearTimeout(idleTimer);
      mount.innerHTML = '';
    }
  };
}
