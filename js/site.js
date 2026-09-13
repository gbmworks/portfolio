/* ------------------------------------------------------------------
   The site itself — identity, origin, and where to find him.

   Before this file the same facts were written in three places and
   disagreed: data.js said Thiruvananthapuram, cv.js said Bangalore;
   data.js linked to linktr.ee, cv.js to beacons.ai; every HTML file
   hardcoded the role line and the social links again.

   Everything that names the person now comes from here.  cv.js is
   still the person's *history*; this is their card.
   ------------------------------------------------------------------ */

export const SITE = {
  name:  'Govind B Mohan',
  short: 'GOVIND',

  /* the role line, written once and joined where it is shown */
  roles: ['3D Generalist', 'Industrial Designer', 'Artist'],

  tagline: 'aspiring creative technologist',
  /* Two places, not a place and a footnote.  "Bangalore, India · from
     Kerala" read as a bio line; the pair reads as the arrangement —
     the work moves between the two, and BASED_LINE draws the mark that
     says so.  Kept as a pair here so the fact stays a fact: the
     drawing is in icons.js, which is where every other mark on the
     site is. */
  from:    'Kerala',
  to:      'Bangalore, India',

  origin: 'https://www.govindbmohan.com',

  email:     'govindbmwork@gmail.com',
  handle:    '@vindgo.visual',
  instagram: 'https://www.instagram.com/vindgo.visual/',
  behance:   'https://www.behance.net/govindbm',

  /* The link hub.  NOTE: the 2026 CV gives beacons.ai/govindbmohan
     instead — the two have not been reconciled, so this keeps what is
     currently deployed.  It came off the top bar when Resume took that
     slot; the footer's icon row and the email under it are the way out
     now, and both say where they go. */
  links:   'https://linktr.ee/govindbmwork',
  beacons: 'https://beacons.ai/govindbmohan',

  /* The CV as a file.  The About window is the same history in HTML —
     readable on a phone, linkable, and indexable — so this is the
     copy you take away rather than the copy you read here.  Renamed
     on the way in: the source is 'Govind B Mohan - CV 2026-new.pdf'
     and a URL with spaces in it gets percent-escaped by every tool
     that touches it.  `cvName` is what a download is saved as, which
     is why it is a person's name and not the slug. */
  cv:     'assets/cv/govind-b-mohan-cv-2026.pdf',
  cvName: 'Govind B Mohan — CV 2026.pdf',

  /* The profiles the footer links out to, in the order they are shown.
     SOCIALS drops anything the card has no URL for, so a profile that
     is not here is a missing icon rather than a dead link. */
  linkedin: 'https://www.linkedin.com/in/gbmworks/'
};

/* name → SITE key, in display order */
const SOCIAL_KEYS = [
  ['LinkedIn',  'linkedin'],
  ['Behance',   'behance'],
  ['Instagram', 'instagram']
];

export const SOCIALS = SOCIAL_KEYS
  .filter(([, key]) => SITE[key])
  .map(([label, key]) => ({ label, key, url: SITE[key] }));

/* '3D Generalist · Industrial Designer · Artist' */
export const ROLE_LINE = SITE.roles.join(' · ');

/* 'Kerala ⇄ Bangalore, India' — the plain-text form, for anywhere that
   cannot take markup.  BASED_LINE in icons.js is the drawn one. */
export const BASED_TEXT = SITE.from + ' ⇄ ' + SITE.to;

/* the monochrome system's single accent — sectors do not vary it */
export const ACCENT = '#ff5a12';
export const ACCENT_GLOW = '#ff9048';

export const absolute = (path) =>
  /^https?:/i.test(path) ? path : SITE.origin + '/' + String(path).replace(/^\//, '');
