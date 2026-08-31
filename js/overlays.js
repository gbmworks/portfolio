/* ------------------------------------------------------------------
   The About window — one floating panel, shared by every page.

   It is built entirely from js/cv.js: the summary, the work history,
   education, awards, skills, languages and interests all come from the
   CV, so that file stays the single source of truth for the person.
   ------------------------------------------------------------------ */

import {
  EXPERIENCE, EDUCATION, AWARDS, SKILLS,
  LANGUAGES, INTERESTS, SUMMARY, CONTACT
} from './cv.js';

function panelHTML() {
  const jobs = EXPERIENCE.map(j => `
    <article class="xp${j.now ? ' is-now' : ''}">
      <header class="xp__head">
        <h3 class="xp__role">${j.role}</h3>
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
        <h2>About</h2>
        <p class="win__lede">${SUMMARY}</p>
        <p class="win__meta">
          <a href="mailto:${CONTACT.email}">${CONTACT.email}</a>
          <span>${CONTACT.based}</span>
        </p>
      </header>

      <div class="win__body">
        <section class="win__col">
          <h4 class="win__k">Work</h4>
          ${jobs}
          <h4 class="win__k win__k--gap">Skills</h4>
          <div class="skills">${skills}</div>
        </section>

        <aside class="win__side">
          <h4 class="win__k">Education</h4>
          <ul class="edus">${edu}</ul>

          <h4 class="win__k">Awards</h4>
          <ul class="awards">${awards}</ul>

          <h4 class="win__k">Languages</h4>
          <p class="win__tags">${LANGUAGES.map(l => `<span>${l}</span>`).join('')}</p>

          <h4 class="win__k">Interests</h4>
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
