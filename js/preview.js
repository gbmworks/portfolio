/* ------------------------------------------------------------------
   Preview stage.

   On a section page the wheel is gone and the space it used to fill is
   the stage: hovering a row plays that project there, large.

   Only rows that actually have a cover or a clip show one — a row with
   neither says so and waits to be clicked.  One <video> is reused for
   the whole page.
   ------------------------------------------------------------------ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initStage({ mount, rows, sector = '' } = {}) {
  if (!mount) return { destroy() {} };

  mount.innerHTML = `
    <div class="stage__frame">
      <video class="stage__video" muted loop playsinline preload="none"></video>
      <img class="stage__still" alt="">
      <div class="stage__empty">
        <span class="stage__title"></span>
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
  const note = mount.querySelector('.stage__note');

  let live = null;
  let idleTimer = 0;

  const show = (row) => {
    clearTimeout(idleTimer);
    live = row;
    const src = row.dataset.preview;
    const img = row.dataset.still;
    title.textContent = (row.querySelector('.plink__t') || row).textContent.trim().slice(0, 70);

    if (img) {
      frame.dataset.mode = 'still';
      video.pause();
      if (still.dataset.src !== img) { still.dataset.src = img; still.src = encodeURI(img); }
    } else if (src && !reduced) {
      frame.dataset.mode = 'play';
      if (video.dataset.src !== src) {
        video.dataset.src = src;
        video.src = encodeURI(src);
      }
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      frame.dataset.mode = 'empty';
      video.pause();
      note.textContent = 'Open the project';
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
