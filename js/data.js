/* ------------------------------------------------------------------
   Sectors and identity.

   SECTIONS is the *shape* of the site — it drives the wheel geometry,
   the labels, the section pages and the navigation between them.  It
   deliberately holds no work any more: projects live in projects.js,
   because a project can belong to more than one sector and a sector
   should not own it.

   layout   'sheet'   an index on a drawing sheet, preview stage beside it
            'gallery' a mosaic of covers that owns the page
   ------------------------------------------------------------------ */

export const PROFILE = {
  name: 'Govind B Mohan',
  role: '3D Generalist | XR',
  location: 'Thiruvananthapuram, India',
  behance: 'https://www.behance.net/govindbm',
  instagram: 'https://www.instagram.com/vindgo.visual/',
  links: 'https://linktr.ee/govindbmwork'
};

/* Instagram collections he curates himself, as story highlights */
export const IG_HIGHLIGHTS = {
  'industrial-design': ['Nvisage 2020'],
  'technical-art': ['Nodes'],
  'visualization': ['VJ', 'JJ | Masaba', 'Unicorn', 'Fitmint']
};

export const ACCENT = '#ff5a12';
export const ACCENT_GLOW = '#ff9048';

/* Behance serves project covers from an unsigned, stable CDN path, so the
   tiles reference them directly — nothing is copied or re-hosted. */
const BE_CDN = 'https://mir-s3-cdn-cf.behance.net/';
export const coverUrl = (path) =>
  !path ? '' : (path.startsWith('assets/') ? path : BE_CDN + path);

export const igUrl = (p) => 'https://www.instagram.com/' + p.kind + '/' + p.code + '/';

export const behanceUrl = (b) => 'https://www.behance.net/gallery/' + b.id + '/' + b.slug;

export const SECTIONS = [
  {
    id: 'industrial-design',
    layout: 'sheet',
    index: '01',
    title: 'Industrial Design',
    subtitle: 'Objects, systems, and the hands that use them',
    color: '#ff5a12',
    glow: '#ff9048',
    blurb:
      'Product form development from first sketch to manufacturable CAD — ergonomics, material and process choices, CMF, and the renders that sell the idea before the tooling exists.',
    icon: `
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <!-- a caliper measuring a form: the whole job in one mark -->
        <circle cx="32" cy="39" r="10"/>
        <path d="M9 18h46"/>
        <path d="M20 18v20"/><path d="M20 38h3.5"/>
        <path d="M44 18v20"/><path d="M44 38h-3.5"/>
        <rect x="37" y="13" width="15" height="10" rx="2"/>
        <path d="M25 21v3M30 21v3M35 21v3"/>
      </svg>`
  },

  {
    id: 'technical-art',
    layout: 'sheet',
    index: '02',
    title: 'Technical Art',
    subtitle: 'Rigs, shapekeys, shaders and the pipeline underneath',
    color: '#ff5a12',
    glow: '#ff9048',
    blurb:
      'Character technical art — deformation rigs, viseme and speech shapekey systems, corrective shapes, retopology, LOD chains and asset optimization. The unglamorous layer that makes everything above it possible.',
    note:
      'Most of this work ships inside a client’s product rather than a published case study, so the pages below are written from the brief rather than linked out to a gallery.',
    icon: `
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <!-- a joint chain with a control handle: a rig -->
        <path d="M17 47 27 37"/><path d="M35 30 45 19"/>
        <circle cx="14" cy="50" r="4"/>
        <circle cx="31" cy="33" r="4"/>
        <circle cx="48" cy="16" r="4"/>
        <rect x="24" y="26" width="14" height="14" rx="2" stroke-dasharray="3.2 3.2"/>
      </svg>`
  },

  {
    id: 'visualization',
    layout: 'gallery',
    index: '03',
    title: 'Visualization',
    subtitle: '3D artwork, animation and live audiovisual sets',
    color: '#ff5a12',
    glow: '#ff9048',
    blurb:
      'Where it all gets shown: rendered 3D artwork, motion pieces, and VJ sets — generative and reactive visuals built to be mixed live in front of a room full of people.',
    icon: `
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <!-- a screen playing, over sound: moving image and audio -->
        <rect x="8" y="11" width="48" height="31" rx="4"/>
        <path d="M27 20 39 26.5 27 33Z"/>
        <path d="M11 55v-4M18 55v-9M25 55v-6M32 55v-12M39 55v-5M46 55v-9M53 55v-3"/>
      </svg>`
  }
];

export const sectionById = (id) => SECTIONS.find(s => s.id === id) || null;
