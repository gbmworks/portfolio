/* ------------------------------------------------------------------
   The About window — one floating panel, shared by every page.

   The work history, education, awards, skills, languages and interests
   come from js/cv.js; the contact line and the PDF come from
   js/site.js.  Nothing about the person is written here.

   This window is also where the resume is taken away from.  The top
   bar's Resume link opens the PDF, and that is the whole of it there —
   a bar has room for a destination, not for a choice — so the pair of
   actions lives here, on every page, at both device sizes.
   ------------------------------------------------------------------ */

import {
  EXPERIENCE, EDUCATION, AWARDS, SKILLS,
  LANGUAGES, INTERESTS, SUMMARY
} from './cv.js';
import { SITE } from './site.js';
import { BASED_LINE } from './icons.js';

function panelHTML() {
  const jobs = EXPERIENCE.map(j => `
    <article class="xp${j.now ? ' is-now' : ''}">
      <header class="xp__head">
        <h4 class="xp__role">${j.role}</h4>
        <span class="xp__org">${j.org}</span>
        <span class="xp__when">${j.when}</span>
      </header>
      <ul class="xp__points">${j.points.map(p => `<li>${p}</li>`).join('')}</ul>
    </article>`).join('');

  const edu = EDUCATION.map(e => `
    <li class="edu">
      <span class="edu__what">${e.what}</span>
      ${e.note ? `<span class="edu__note">${e.note}</span>` : ''}
      <span class="edu__when">${e.when}</span>
      <span class="edu__score">${e.score}</span>
    </li>`).join('');

  const awards = AWARDS.map(a => `
    <li class="award"><span class="award__n">${a.n}</span>
      <span class="award__t">${a.title}</span>
      <span class="award__w">${a.when}</span></li>`).join('');

  const skills = SKILLS.map(g => `
    <div class="skill">
      <span class="skill__k">${g.group}</span>
      <p class="skill__v">${g.items.join(' · ')}</p>
    </div>`).join('');

  return `
    <div class="win__panel">
      <button class="win__close" data-close="about" type="button" aria-label="Close">×</button>

      <header class="win__head">
        <figure class="win__portrait">
          <img src="assets/portrait.jpg" width="760" height="760"
               alt="${SITE.name}" decoding="async" loading="lazy">
        </figure>
        <div class="win__intro">
          <h2>About</h2>
          <p class="win__lede">${SUMMARY}</p>
          <p class="win__meta">
            <a href="mailto:${SITE.email}">${SITE.email}</a>
            <span>${BASED_LINE(SITE)}</span>
          </p>

          <!-- The same history as this window, as a file.  Two actions
               and not one, because a single link cannot do both jobs:
               the first opens the PDF in the browser's own viewer, the
               second saves it.  Phones in particular will happily open
               a PDF and give no obvious way to keep it, which is the
               case the download attribute exists for.

               No backticks in here: this comment is inside a template
               literal, and a pair of them ends the string. -->
          <p class="win__cv">
            <a class="win__cta" href="${SITE.cv}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>
              </svg>
              Resume (PDF)</a>
            <a class="win__cta win__cta--ghost" href="${SITE.cv}" download="${SITE.cvName}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                   stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/>
              </svg>
              Download</a>
          </p>
        </div>
      </header>

      <div class="win__body">
        <section class="win__col">
          <h3 class="win__k">Work</h3>
          ${jobs}
          <h3 class="win__k win__k--gap">Skills</h3>
          <div class="skills">${skills}</div>
        </section>

        <aside class="win__side">
          <h3 class="win__k">Education</h3>
          <ul class="edus">${edu}</ul>

          <h3 class="win__k">Awards</h3>
          <ul class="awards">${awards}</ul>

          <h3 class="win__k">Languages</h3>
          <p class="win__tags">${LANGUAGES.map(l => `<span>${l}</span>`).join('')}</p>

          <h3 class="win__k">Interests</h3>
          <p class="win__tags">${INTERESTS.map(i => `<span>${i}</span>`).join('')}</p>
        </aside>
      </div>
    </div>`;
}

export function initOverlays() {
  const el = document.createElement('div');
  el.id = 'about';
  el.className = 'win';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = panelHTML();
  document.body.appendChild(el);

  const close = () => { el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true'); };
  const open = () => { el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); };

  document.querySelectorAll('[data-open="about"]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); open(); }));
  el.querySelectorAll('[data-close="about"]').forEach(b => b.addEventListener('click', close));
  el.addEventListener('click', e => { if (e.target === el) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return { open, close };
}
