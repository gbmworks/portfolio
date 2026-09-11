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
  based:   'Bangalore, India · from Kerala',

  origin: 'https://www.govindbmohan.com',

  email:     'govindbmwork@gmail.com',
  handle:    '@vindgo.visual',
  instagram: 'https://www.instagram.com/vindgo.visual/',
  behance:   'https://www.behance.net/govindbm',

  /* The live "Contact" link.  NOTE: the 2026 CV gives
     beacons.ai/govindbmohan instead — the two have not been
     reconciled, so this keeps what is currently deployed. */
  links:   'https://linktr.ee/govindbmwork',
  beacons: 'https://beacons.ai/govindbmohan',

  /* The profiles the footer links out to, in the order they are shown.
     Add `linkedin: '…'` above and it appears — SOCIALS drops anything
     the card does not have a URL for, so a missing profile is a missing
     icon rather than a dead link. */
  linkedin: ''
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

/* the monochrome system's single accent — sectors do not vary it */
export const ACCENT = '#ff5a12';
export const ACCENT_GLOW = '#ff9048';

export const absolute = (path) =>
  /^https?:/i.test(path) ? path : SITE.origin + '/' + String(path).replace(/^\//, '');
