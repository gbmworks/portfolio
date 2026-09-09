/* ------------------------------------------------------------------
   The work, in two tiers.

   PROJECTS are case studies.  A case study has something to say — a
   write-up, its own media, or a set of posts — so it earns a page at
   project.html?p=<slug>, a row in its sector's index and a line in the
   sitemap.

   ARCHIVE is everything else: published galleries that are a cover, a
   title and a year.  Twenty-two of the forty records here used to be
   case studies whose entire page read "this one lives as a published
   gallery rather than a write-up".  They are not less real, they are
   just not written up, so they now sit in one grid per sector and link
   straight out to Behance.  Nothing was deleted; promote an entry by
   moving the record into PROJECTS and giving it a body.

   A project can belong to more than one sector — Fitmint is technical
   art *and* visualization, the John Jacobs line is industrial design
   *and* visualization — so it is written once and tagged with each.

   PROJECTS fields
     slug      the URL: project.html?p=<slug>
     sectors   one or more SECTIONS ids; the first is where it lives
     title     display name
     client    who it was for, if anyone
     role      what you did on it
     year      free text — '2019', '2023 — 24', 'pre-2017'
     tools     only where it is actually known; an empty list is fine
     summary   one paragraph, shown on the index row and the page lede
     body      further paragraphs, shown only on the project page
     cover     hero still — 'assets/...' local, or a Behance CDN path
     live      a running thing on this site rather than a write-up — the
               game at game/unicorn.  A record with one is opened by that
               URL wherever it is listed: clicking the row plays it.
     preview   a local clip; plays in the index preview stage and hero
     media     [{ src, title }] shown as a grid on the project page
     behance   { id, slug } — the published case study
     posts     [{ code, kind, title, cover }] — Instagram entries
     feature   pulled to the top of its sector's index

   ARCHIVE fields are a subset: slug, sectors, title, year, cover,
   behance and an optional summary.  No body, no media, no page.

   Anything that is a one-off rather than a project stays a POST: an
   Instagram entry listed under its sector, linked straight out.
   ------------------------------------------------------------------ */

import { PAGES, pageRefs } from './pages.js';
import { coverUrl, igUrl, behanceUrl, projectUrl, posterUrl } from './links.js';

export const PROJECTS = [

  /* ============================================================
     Current and client work
     ============================================================ */

  {
    slug: 'primetrace-companion',
    sectors: ['technical-art'],
    title: 'AI Virtual Companion',
    client: 'Primetrace Labs',
    role: '3D Generalist',
    year: '2025 — present',
    tools: [],
    feature: true,
    summary:
      'An AI-driven virtual companion where a conversational system and interactive ' +
      'gameplay share one character.',
    body: [
      'I designed and implemented the core engagement systems — feeding gameplay, ' +
      'touch interactions and the adaptive behaviour that keeps the companion ' +
      'responding differently over time.',
      'On the art side I produced and integrated the 3D character itself: rigging, ' +
      'facial expressions, animation sequences, and the interaction-driven behaviour ' +
      'that connects the two halves.'
    ]
  },

  {
    slug: 'metabrix-avatar-bodies',
    sectors: ['technical-art'],
    title: 'Customisable Avatar Body System',
    client: 'Metabrix Labs',
    role: '3D Technical Artist',
    year: '2024',
    tools: ['Blender', 'Shape keys'],
    feature: true,
    summary:
      'A shape-key driven body mesh system for male and female avatars inside an ' +
      'AI-powered 3D avatar generation platform.',
    body: [
      'One mesh per gender had to cover diverse body types, skin tones, outfits and ' +
      'animation without the rig or the clothing breaking at the extremes. I built ' +
      'and maintained that system for eight months.'
    ]
  },

  /* The 2024 freelance run is one entry, not four.  Suta, The Eyewear
     Project, Soul Jams and Besodetres were four separate records with a
     one-line summary, no artwork and nothing to link to — four pages
     that said nothing.  The CV lists them as one role, so they are one
     project here.  Hrutul and Diaz came out of the same six months but
     have their own work to show, so they keep their own pages. */
  {
    slug: 'freelance-2024',
    sectors: ['visualization', 'industrial-design'],
    title: 'Freelance, 2024',
    client: 'Suta · The Eyewear Project · Soul Jams · Besodetres',
    role: '3D Generalist',
    year: '2024',
    tools: [],
    feature: true,
    summary:
      'Eight months freelancing across five cities — character work, product ' +
      'visualization, brand iconography and launch visuals.',
    body: [
      'Suta (Mumbai) — 3D character development of the two founders, composited ' +
      'onto real footage for a store launch.',
      'The Eyewear Project (Goa) — 1300+ eyewear product renders for their website, ' +
      'produced as a repeatable pipeline rather than one-off shots.',
      'Soul Jams (Bangalore) — 3D iconography for a rebrand, worked to the brand ' +
      'guidelines.',
      'Besodetres (Tulum) — brand identity and launch visuals for a techno duo.',
      'The same stretch also produced the Youforia visuals for Hrutul Patel and the ' +
      'Diaz techno night in Goa, both of which have their own pages.'
    ]
  },

  {
    slug: 'fitmint-avatars',
    sectors: ['technical-art', 'visualization'],
    title: 'Fitmint',
    client: 'Fitmint',
    role: 'Character Technical Artist & 3D Generalist',
    year: '2023 — 24',
    tools: ['Blender', 'three.js'],
    feature: true,
    cover: 'assets/web/fitmint/coverf.jpg',
    preview: 'assets/web/fitmint/AvatarF.webm',
    summary:
      'The 3D avatar system for a crypto-based fitness app — onboarding with ' +
      'customisable avatars, skin tones, facial features, hairstyles and outfits.',
    body: [
      'Beyond the avatars I integrated 3D assets across the app’s use cases — ' +
      'power-ups, UI overlays — each one optimised for a three.js framework and ' +
      'rendered inside a web view, which sets a hard budget on everything.',
      'I worked directly with the developers on integration, and produced the social ' +
      'and website content around it: promotional videos, Reels and the hype pieces below.'
    ],
    media: [
      { src: 'assets/web/fitmint/clubs_F.webm',      title: 'Clubs' },
      { src: 'assets/web/fitmint/AvatarF.webm',      title: 'Avatar' },
      { src: 'assets/web/fitmint/Burj Khalifa.webm', title: 'Burj Khalifa' },
      { src: 'assets/web/fitmint/male.webm',         title: 'Male Character' },
      { src: 'assets/web/fitmint/GOAt.webm',         title: 'GOAT' },
      { src: 'assets/web/fitmint/coverf.jpg',        title: 'Cover' },
      { src: 'assets/web/fitmint/1.jpg',             title: 'Still 01' },
      { src: 'assets/web/fitmint/2.jpg',             title: 'Still 02' },
      { src: 'assets/web/fitmint/3.jpg',             title: 'Still 03' },
      { src: 'assets/web/fitmint/4.jpg',             title: 'Still 04' }
    ],
    posts: [
      { code: 'C3xN8HcSitr', kind: 'reel', title: 'Dynamic outfit & 3D UI overlays', cover: 'assets/covers/instagram/C3xN8HcSitr.jpg' },
      { code: 'C4zkP75yvL3', kind: 'p',    title: 'Apex asset series',               cover: 'assets/covers/instagram/C4zkP75yvL3.jpg' },
      { code: 'CxrwSzcyniD', kind: 'reel', title: 'Onboarding visuals',              cover: 'assets/covers/instagram/CxrwSzcyniD.jpg' },
      { code: 'CxA3q1JS0za', kind: 'reel', title: 'NFT',                             cover: 'assets/covers/instagram/CxA3q1JS0za.jpg' }
    ]
  },

  {
    slug: 'john-jacobs-masaba',
    sectors: ['industrial-design', 'visualization'],
    title: 'John Jacobs × Masaba Gupta',
    client: 'Lenskart',
    role: 'Eyewear Designer',
    year: '2022 — 23',
    tools: [],
    feature: true,
    cover: 'projects/max_808/3601bc199186729.Y3JvcCwxNDAwLDEwOTUsMCw4Njk.jpg',
    preview: 'assets/web/Lenskart/ReelFinal.webm',
    summary:
      'A capsule eyewear collection with Masaba Gupta, part of 50+ models designed ' +
      'across Lenskart collections — and the product reels that launched it.',
    behance: { id: '199186729', slug: 'JohnJacobs-X-MasabaGupta' },
    media: [
      { src: 'assets/web/Lenskart/ReelFinal.webm', title: 'Reel — Final' },
      { src: 'assets/web/Lenskart/shellReel.webm', title: 'Shell Reel' }
    ],
    posts: [
      { code: 'C7VvUorIkbB', kind: 'p', title: 'Campaign', cover: 'assets/covers/instagram/C7VvUorIkbB.jpg' }
    ]
  },

  {
    slug: 'lenskart-ar-game',
    sectors: ['technical-art'],
    title: 'Unicorn and the Crystalverse',
    client: 'Lenskart',
    role: 'XR & Game Designer',
    year: '2022 — 23',
    tools: ['three.js', 'WebGL', 'Blender', 'Draco'],
    /* The only entry on the site that is neither a page here nor a link
       out: it is the thing itself, deployed at game/unicorn, and clicking
       the row plays it. */
    live: 'game/unicorn/',
    cover: 'assets/covers/unicorn-crystalverse.jpg',
    summary:
      'A 3D game for children that runs in a phone browser — find seven crystals ' +
      'scattered across a floating island and carry them back to the magic pot.',
    body: [
      'An experimental role at Lenskart developing AR media. The game had to run in a ' +
      'browser on a phone, open from a QR scan with no install, and stay tied to the ' +
      'eyewear collection it was promoting — built on three.js and WebGL.',
      'The island is a navmesh: tapping the ground asks three-pathfinding for a route ' +
      'and the unicorn walks it rather than sliding towards the tap. Every model is ' +
      'Draco-compressed, four characters are selectable, and the whole thing — world, ' +
      'characters, sound and the illustrated story that opens it — is about 16 MB.'
    ]
  },

  {
    slug: 'muse-watch',
    sectors: ['industrial-design'],
    title: 'Muse — Personalised Watch System',
    client: 'Titan Company',
    role: 'Industrial Designer · Graduation project',
    year: '2021',
    tools: [],
    feature: true,
    cover: 'project_modules/disp/767e3b135998795.61f18e9b774d6.png',
    summary:
      'A parametric system for personalised watch design and purchase, made as my ' +
      'graduation project at Titan.',
    body: [
      'The customer defines the case shape and size; the dial takes an embossed image ' +
      'and laser etching; and a mirrored message, readable only on the hour, is ' +
      'revealed by the hand as it passes. Product design and the UI/UX of the ' +
      'configurator that drives it.'
    ],
    behance: { id: '135998795', slug: 'Muse-Watch-Product-UIUX-Design' },
    posts: [
      { code: 'CwGUW4Ky1pX', kind: 'p', title: 'Personalised watch', cover: 'assets/covers/instagram/CwGUW4Ky1pX.jpg' }
    ]
  },

  {
    slug: 'hecoll-protective-range',
    sectors: ['industrial-design'],
    title: 'Anti-Viral Protective Range',
    client: 'Hecoll',
    role: 'Industrial & Graphic Designer',
    year: '2021',
    tools: [],
    summary:
      'A range of COVID-19 protective products in Hecoll’s anti-viral cloth — face ' +
      'masks, headgear and school uniforms.',
    body: [
      'The brief ran from the products through to how they were sold: packaging for the ' +
      'range, and a dedicated exhibition stall for the Hitex Health Expo in Hyderabad.'
    ]
  },

  /* ============================================================
     Studio, student and self-directed — industrial design
     ============================================================ */

  {
    slug: 'bbc-league-trophy',
    sectors: ['industrial-design'],
    title: 'BBC League — Trophy Design',
    year: '2020',
    tools: [],
    cover: 'project_modules/disp/fa036a135274949.61e56320ce525.png',
    summary: '',
    behance: { id: '135274949', slug: 'BBC-League-Trophy-Design' },
    posts: [
      { code: 'CY1Tccvv3tV', kind: 'p', title: 'Trophy', cover: 'assets/covers/instagram/CY1Tccvv3tV.jpg' },
      { code: 'CJSklJHJZHQ', kind: 'p', title: 'At NID', cover: 'assets/covers/instagram/CJSklJHJZHQ.jpg' }
    ]
  },

  {
    slug: 'toruk-custom-bike',
    sectors: ['industrial-design'],
    title: 'Toruk — Custom Bike',
    year: '',
    tools: [],
    cover: 'project_modules/disp/584bc3134159769.61cf7e1b55429.png',
    summary: '',
    behance: { id: '134159769', slug: 'Toruk-Custom-bike' },
    posts: [
      { code: 'CPIeojBp4YM', kind: 'reel', title: 'Brat-built Yamaha FZ150', cover: 'assets/covers/instagram/CPIeojBp4YM.jpg' },
      { code: 'CKbrJJHp8kK', kind: 'p',    title: 'Café racer — feature', cover: 'assets/covers/instagram/CKbrJJHp8kK.jpg' },
      { code: 'CKbq7F2pErQ', kind: 'p',    title: 'Café racer — build',   cover: 'assets/covers/instagram/CKbq7F2pErQ.jpg' }
    ]
  },

  {
    slug: 'cosmo-footwear',
    sectors: ['industrial-design'],
    title: 'Cosmo — Concept Footwear',
    year: '',
    tools: [],
    cover: 'project_modules/disp/b01584110261387.5fe8b415f212f.png',
    summary: '',
    behance: { id: '110261387', slug: 'Concept-Footwear-Design-Cosmo' },
    posts: [
      { code: 'CJN3wEPpxaV', kind: 'p', title: 'Outerverse',        cover: 'assets/covers/instagram/CJN3wEPpxaV.jpg' },
      { code: 'CDtk-QOjhxc', kind: 'p', title: 'Tacklebox',         cover: 'assets/covers/instagram/CDtk-QOjhxc.jpg' },
      { code: 'CDlpBAQDHiN', kind: 'p', title: 'Sneaker concept',   cover: 'assets/covers/instagram/CDlpBAQDHiN.jpg' },
      { code: 'CCoAxWMjytt', kind: 'p', title: 'Adidas concept',    cover: 'assets/covers/instagram/CCoAxWMjytt.jpg' },
      { code: 'CCmI1ZajXaI', kind: 'p', title: 'Adidas concept II', cover: 'assets/covers/instagram/CCmI1ZajXaI.jpg' }
    ]
  },

  {
    slug: 'jeev-pendant-light',
    sectors: ['industrial-design'],
    title: 'JEEV — Parametric Pendant Light',
    year: '',
    tools: [],
    cover: 'project_modules/disp/4cc2d9110045715.5fe2375195684.png',
    summary: '',
    behance: { id: '110045715', slug: 'Parametric-Pendant-Light-JEEV' },
    posts: [
      { code: 'DGpeQLrINo7', kind: 'reel', title: 'Chandelier form sculpting', cover: 'assets/covers/instagram/DGpeQLrINo7.jpg' }
    ]
  },

  {
    slug: 'dabur-vatika-bottle',
    sectors: ['industrial-design'],
    title: 'Dabur Vatika — Hair Oil Bottle',
    client: 'Dabur',
    year: '',
    tools: [],
    cover: 'project_modules/disp/0bb832106502681.5f9147f243634.png',
    summary: '',
    behance: { id: '106502681', slug: 'Bottle-Design-Dabur-Vatika-Hair-Oil' },
    posts: [
      { code: 'CD1KISlDFBK', kind: 'p', title: 'Bottle', cover: 'assets/covers/instagram/CD1KISlDFBK.jpg' },
      { code: 'CD0g4DSDU7H', kind: 'p', title: 'Render', cover: 'assets/covers/instagram/CD0g4DSDU7H.jpg' }
    ]
  },

  {
    slug: 'xoxo-stool',
    sectors: ['industrial-design'],
    title: 'XOXO — 10,000 BC Cross Stool',
    year: '2019',
    tools: [],
    cover: 'projects/max_808/a486c894102309.Y3JvcCw5OTAsNzc0LDc2LDMwMzA.png',
    summary: '',
    behance: { id: '94102309', slug: 'XOXO-A-10000-BC-Cross-Stool-Classroom-project-2019' },
    posts: [
      { code: 'CFghnTnJad_', kind: 'reel', title: 'Flatpack furniture', cover: 'assets/covers/instagram/CFghnTnJad_.jpg' }
    ]
  },

  {
    slug: 'installation',
    sectors: ['industrial-design'],
    title: 'Installation',
    year: '2019',
    tools: [],
    cover: 'project_modules/disp/20a20593403109.5e7bc9f6b0498.jpg',
    summary: '',
    behance: { id: '93403109', slug: 'INSTALLATION-2019' },
    posts: [
      { code: 'DYob7EGT4Rb', kind: 'reel', title: 'Infinity Mirror — the build',  cover: 'assets/covers/instagram/DYob7EGT4Rb.jpg' },
      { code: 'DYoJ6mfTi0C', kind: 'reel', title: 'Infinity Mirror — transition', cover: 'assets/covers/instagram/DYoJ6mfTi0C.jpg' }
    ]
  },

  /* ============================================================
     Visualization, motion and live work
     ============================================================ */

  {
    slug: 'mushroom-fiend',
    sectors: ['visualization'],
    title: 'Mushroom Fiend vs Humans',
    role: 'Personal · Pwnisher challenge',
    year: '',
    tools: [],
    feature: true,
    cover: 'projects/max_808/97a057198751431.Y3JvcCwxMDM1LDgxMCw0NDMsMA.png',
    preview: 'assets/web/shroomF.webm',
    summary: 'An entry for a Pwnisher community render challenge.',
    behance: { id: '198751431', slug: 'Mushroom-Fiend-vs-Humans' },
    media: [
      { src: 'assets/web/shroomF.webm', title: 'Mushroom Fiend' }
    ],
    posts: [
      { code: 'C7CCDc6osNr', kind: 'reel', title: 'Pwnisher challenge', cover: 'assets/covers/instagram/C7CCDc6osNr.jpg' }
    ]
  },

  {
    slug: 'hrutul-youforia',
    sectors: ['visualization'],
    title: 'Youforia Show',
    client: 'Hrutul Patel, Ahmedabad',
    role: 'Visuals · Freelance',
    year: '2024',
    tools: [],
    feature: true,
    preview: 'assets/web/2hrutul.webm',
    summary:
      'Visuals for the Youforia Show — a theme-based 360° immersive audiovisual concert.',
    media: [
      { src: 'assets/web/2hrutul.webm', title: 'Youforia' }
    ],
    posts: [
      { code: 'DGdAAn0oQAJ', kind: 'p', title: 'Visuals for Hrutul Patel', cover: 'assets/covers/instagram/DGdAAn0oQAJ.jpg' }
    ]
  },

  {
    slug: 'diaz-goa',
    sectors: ['visualization'],
    title: 'Diaz, Goa — Techno Night',
    client: 'Visual Jockey, Goa',
    role: 'VJ · Freelance',
    year: '2024',
    tools: ['TouchDesigner', 'Resolume Arena'],
    feature: true,
    summary:
      'Parametric, audio-reactive visuals and 3D animation for a techno night — built ' +
      'to be mixed live in the room.',
    posts: [
      { code: 'DCoVgrcIE9J', kind: 'p',    title: 'Diaz, Goa — first set',  cover: 'assets/covers/instagram/DCoVgrcIE9J.jpg' },
      { code: 'DV8nZzIkxXn', kind: 'reel', title: 'Saturday night visuals', cover: 'assets/covers/instagram/DV8nZzIkxXn.jpg' }
    ]
  },

  {
    slug: 'loops-and-studies',
    sectors: ['visualization'],
    title: 'Loops & Studies',
    role: 'Personal',
    year: '',
    tools: [],
    preview: 'assets/web/Halo_bg.webm',
    summary:
      'VJ loops, one-offs and the pieces made to find out whether something would work.',
    media: [
      { src: 'assets/web/1stroke.webm',    title: 'One Stroke' },
      { src: 'assets/web/astronaut1.webm', title: 'Astronaut' },
      { src: 'assets/web/Halo_bg.webm',    title: 'Halo' },
      { src: 'assets/web/drip_2.webm',     title: 'Drip' },
      { src: 'assets/web/grind.webm',      title: 'Grind' },
      { src: 'assets/web/Unicorn F.webm',  title: 'Unicorn' },
      { src: 'assets/web/fiver.webm',      title: 'Fiver' },
      { src: 'assets/web/postFF.webm',     title: 'Post FF' }
    ],
    posts: [
      { code: 'C6eGhKYIsUI', kind: 'p', title: '1stroke — live painting', cover: 'assets/covers/instagram/C6eGhKYIsUI.jpg' },
      { code: 'DCzA-Kmozdd', kind: 'p', title: 'Just floating around',    cover: 'assets/covers/instagram/DCzA-Kmozdd.jpg' }
    ]
  }
];

/* ------------------------------------------------------------------
   The archive — published galleries, not case studies.

   Each is a cover, a title, a year and a link to Behance.  They appear
   as one grid at the foot of their sector and nowhere else: no page,
   no prev/next, no sitemap entry.  Covers come from the same unsigned,
   stable Behance CDN path the tiles already use, so nothing is
   re-hosted here either.
   ------------------------------------------------------------------ */

export const ARCHIVE = [

  /* --- Industrial Design --- */
  {
    slug: 'dfo-headphones',
    sectors: ['industrial-design'],
    title: 'Headphone Concepts',
    client: 'Zebronics, via DesignFlyOver',
    year: '2019',
    summary: 'Premium-range headphones exploring folding mechanisms — a summer internship at DesignFlyOver.',
    cover: 'projects/max_808/5c576d94654855.Y3JvcCwxMzkwLDEwODcsMTcsNDQ.png',
    behance: { id: '94654855', slug: 'Headphone-Concepts-Internship-at-DFO-2019' }
  },
  {
    slug: 'e-waste-system-design',
    sectors: ['industrial-design'],
    title: 'E-Waste & Consumerism',
    year: '',
    cover: 'project_modules/disp/80c843116688785.6066e5354f11b.png',
    behance: { id: '116688785', slug: 'E-Waste-Consumerism-System-Design' }
  },
  {
    slug: 'aloka-2',
    sectors: ['industrial-design'],
    title: 'Aloka 2.0 — Smart Eyewear',
    year: '2020',
    cover: 'project_modules/disp/97cad3112336929.60128b37c82a0.png',
    behance: { id: '112336929', slug: 'Aloka-20-Smart-Eyewear-2020' }
  },
  {
    slug: 'aloka',
    sectors: ['industrial-design'],
    title: 'Aloka — Smart Eyewear',
    year: '2019',
    cover: 'project_modules/disp/f0d94898908263.5ee737466d4a2.png',
    behance: { id: '98908263', slug: 'Aloka-Smart-Eyewear-2019' }
  },
  {
    slug: 'monsoon-fiesta-trophy',
    sectors: ['industrial-design'],
    title: 'Monsoon Fiesta — Trophy Design',
    year: '2019',
    cover: 'projects/max_808/69b80a94660631.Y3JvcCwxMDgxLDg0NiwyMTksMA.png',
    behance: { id: '94660631', slug: 'Monsoon-Fiesta-Trophy-Design-2019' }
  },
  {
    slug: 'form-studies',
    sectors: ['industrial-design'],
    title: 'Form Studies',
    year: '',
    cover: 'projects/max_808/0de8d394018607.Y3JvcCwxMDA3LDc4OCwyMjksMA.png',
    behance: { id: '94018607', slug: 'Form-Studies' }
  },
  {
    slug: 'red-raven-toy',
    sectors: ['industrial-design'],
    title: 'Red Raven — Retro Collectible Toy',
    year: '2018',
    cover: 'projects/max_808/0836d194656165.Y3JvcCw1MTEzLDQwMDAsNTY5LDA.jpg',
    behance: { id: '94656165', slug: 'Red-Raven-A-Retro-Collectible-Toy-2018' }
  },
  {
    slug: 'product-teardown',
    sectors: ['industrial-design'],
    title: 'Product Tear-down & Scaled Model Making',
    year: '2018',
    cover: 'project_modules/disp/81a06c79570257.5cc7639cb6504.jpg',
    behance: { id: '79570257', slug: 'Product-tear-down-Scaled-down-model-making-2018' }
  },
  {
    slug: 'worldskills-regionals',
    sectors: ['industrial-design'],
    title: 'WorldSkills Regionals — BIEC',
    year: '2018',
    cover: 'project_modules/disp/63c9d779651289.5cc9dc25d8c20.jpg',
    behance: { id: '79651289', slug: 'Worldskills-Regionals-BIEC-21-23rd-June-2018' }
  },
  {
    slug: 'nid-foundation',
    sectors: ['industrial-design'],
    title: 'Foundation Year — NID Ahmedabad',
    year: '2017 — 18',
    cover: 'project_modules/disp/8b35f579560199.5cc72c64c763d.jpg',
    behance: { id: '79560199', slug: 'Foundation-year-2017-18-NID-Ahmedabad' }
  },
  {
    slug: 'old-works',
    sectors: ['industrial-design'],
    title: 'A Collection of My Old Works',
    year: 'pre-2017',
    cover: 'project_modules/disp/0fd03d79545819.5ee7570719394.jpg',
    behance: { id: '79545819', slug: 'A-Collection-Of-my-old-works-Before-2017' }
  },

  /* --- Technical Art --- */
  {
    slug: 'strandbeest',
    sectors: ['technical-art'],
    title: 'Strandbeest — Theo Jansen Mechanism',
    year: '2018',
    cover: 'project_modules/disp/3f9aa579602877.5cc867b21aede.jpg',
    behance: { id: '79602877', slug: 'Strandbeast-Theo-jansen-mechanism-2018' }
  },

  /* --- Visualization --- */
  {
    slug: 'dreamhome',
    sectors: ['visualization'],
    title: 'Dreamhome',
    year: '',
    cover: 'projects/max_808/f1b200134159883.61cf7fb5866dc.jpg',
    behance: { id: '134159883', slug: 'Dreamhome' }
  },
  {
    slug: 'product-visualisation',
    sectors: ['visualization'],
    title: 'Product Visualisation',
    year: '',
    cover: 'project_modules/disp/34e1ff100310627.6654537f465c1.png',
    behance: { id: '100310627', slug: 'Product-Visualisation-3D' }
  },
  {
    slug: '3d-rendering',
    sectors: ['visualization'],
    title: '3D Rendering',
    year: '',
    cover: 'project_modules/disp/586aaa81079963.5ee75b55371ba.jpg',
    behance: { id: '81079963', slug: '3D-Rendering' }
  },
  {
    slug: 'mobius-ring',
    sectors: ['visualization'],
    title: 'Mobius Ring — Exploration',
    year: '',
    cover: 'project_modules/disp/2880c679602537.5cc865857f372.jpg',
    behance: { id: '79602537', slug: 'Mobius-Ring-Exploration' }
  },
  {
    slug: 'digital-illustration',
    sectors: ['visualization'],
    title: 'Digital Illustration',
    year: '',
    cover: 'project_modules/disp/4a9cbb79562775.5e7349a597d97.jpg',
    behance: { id: '79562775', slug: 'Digital-Illustration' }
  },
  {
    slug: 'photography',
    sectors: ['visualization'],
    title: 'Photography',
    year: '',
    cover: 'project_modules/disp/3b4d5079603139.5cc869393f5b2.jpg',
    behance: { id: '79603139', slug: 'Photography' }
  }
];


/* ------------------------------------------------------------------
   One-offs.  An Instagram entry that belongs to no project: listed
   under its sector, linked straight out, never dressed as a project.
   ------------------------------------------------------------------ */

export const POSTS = {
  'industrial-design': [
    { code: 'DEm5d3BtpuF', kind: 'reel', title: 'Grilled iPhone — BMW Motorsport', cover: 'assets/covers/instagram/DEm5d3BtpuF.jpg' },
    { code: 'CIFZG_uJOU3', kind: 'p',    title: 'Concept study — Keyshot',         cover: 'assets/covers/instagram/CIFZG_uJOU3.jpg' },
    { code: 'CIDI928Jn5p', kind: 'p',    title: 'Product render — 3DHOC',          cover: 'assets/covers/instagram/CIDI928Jn5p.jpg' },
    { code: 'CDipHiwjXKP', kind: 'p',    title: 'Product render study',            cover: 'assets/covers/instagram/CDipHiwjXKP.jpg' },
    { code: 'B8A3qZMH3eJ', kind: 'reel', title: 'Icon helmet — Keyshot',           cover: 'assets/covers/instagram/B8A3qZMH3eJ.jpg' },
    { code: 'B5VbJ41nHIV', kind: 'p',    title: 'NID — product render',            cover: 'assets/covers/instagram/B5VbJ41nHIV.jpg' }
  ],
  'technical-art': [
    { code: 'DZhUGT6zLUH', kind: 'reel', title: 'Hand tracking in TouchDesigner',  cover: 'assets/covers/instagram/DZhUGT6zLUH.jpg' },
    { code: 'DY5Se7pTini', kind: 'reel', title: 'Roto & isolation workflow',       cover: 'assets/covers/instagram/DY5Se7pTini.jpg' },
    { code: 'C_fxgvZo0Jm', kind: 'reel', title: 'Make anything breathe or bounce', cover: 'assets/covers/instagram/C_fxgvZo0Jm.jpg' },
    { code: 'C5S8PcUyYaS', kind: 'p',    title: 'Fluid sim — viewport vs render',  cover: 'assets/covers/instagram/C5S8PcUyYaS.jpg' },
    { code: 'C30IwA0S86z', kind: 'p',    title: 'FPS environment in Unreal 5',     cover: 'assets/covers/instagram/C30IwA0S86z.jpg' },
    { code: 'C5qKbaqoS81', kind: 'p',    title: 'Crystalverse — web-based 3D game', cover: 'assets/covers/instagram/C5qKbaqoS81.jpg' },
    { code: 'C3zEIFYSZDz', kind: 'reel', title: 'Compositing in After Effects',    cover: 'assets/covers/instagram/C3zEIFYSZDz.jpg' }
  ],
  'visualization': [
    { code: 'DY1ZLdrzDMn', kind: 'reel', title: 'Projection mapping exercise', cover: 'assets/covers/instagram/DY1ZLdrzDMn.jpg' },
    { code: 'C7ONyGwI_ay', kind: 'p',    title: 'Geode NFT',                   cover: 'assets/covers/instagram/C7ONyGwI_ay.jpg' },
    { code: 'DBi2HkxIX1H', kind: 'p',    title: 'Artwork for Bonzai Music',    cover: 'assets/covers/instagram/DBi2HkxIX1H.jpg' },
    { code: 'DBblehryOvP', kind: 'p',    title: 'Digital wardrobe collage',    cover: 'assets/covers/instagram/DBblehryOvP.jpg' },
    { code: 'DCwKJScIyjX', kind: 'p',    title: 'The Game',                    cover: 'assets/covers/instagram/DCwKJScIyjX.jpg' },
    { code: 'C93AJFvIDgv', kind: 'p',    title: 'Do you have gum bro?',        cover: 'assets/covers/instagram/C93AJFvIDgv.jpg' },
    { code: 'DEhw2rOKdE8', kind: 'p',    title: '2024 recap',                  cover: 'assets/covers/instagram/DEhw2rOKdE8.jpg' },
    { code: 'Cy75XuoSpS8', kind: 'p',    title: 'Batman',                      cover: 'assets/covers/instagram/Cy75XuoSpS8.jpg' }
  ]
};

/* ---------------------------------------------------------------- */
/* lookups                                                            */
/* ---------------------------------------------------------------- */

/* look-ups by id — the page lists in pages.js reference these */

export const bySlug = (slug) => PROJECTS.find(p => p.slug === slug) || null;

export const archiveBySlug = (slug) => ARCHIVE.find(p => p.slug === slug) || null;

/* Slugs that used to be their own page and are not any more.  The four
   2024 freelance jobs became one record, so a link to any of them still
   lands somewhere true rather than on a 404. */
export const MOVED = {
  'suta-bombay': 'freelance-2024',
  'the-eyewear-project': 'freelance-2024',
  'soul-jams': 'freelance-2024',
  'besodetres': 'freelance-2024'
};

/* The still to represent a project with: its own cover, or failing that
   the thumbnail of the first post attached to it. */
export const projectStill = (p) =>
  p.cover || (p.posts && p.posts.length && p.posts[0].cover) || '';

/* ------------------------------------------------------------------
   One page, one list.

   js/pages.js says what is on each page and in what order.  Everything
   in that list is rendered the same way — same tile, same row, no
   heading telling you which of these is "really" a project.  All this
   resolver does is answer three questions about a reference: what is
   it called, what picture represents it, and where does clicking it
   go.

     'muse-watch'       a project, opens project.html?p=muse-watch
     'aloka'            a published gallery, opens on Behance
     'ig:Cy75XuoSpS8'   an Instagram post, opens there

   One record answers the third question differently: the Lenskart game
   carries `live`, so its row opens the game at game/unicorn rather than
   a page describing it.

   `kind` comes back so a caller can decide whether to use the client
   and year, or whether the link leaves the site — not so it can print
   a category label.
   ------------------------------------------------------------------ */

/* every Instagram post, wherever it was written down */
const IG_BY_CODE = new Map();
for (const p of PROJECTS) for (const x of (p.posts || [])) IG_BY_CODE.set(x.code, x);
for (const list of Object.values(POSTS)) for (const x of list) IG_BY_CODE.set(x.code, x);

export const postByCode = (code) => IG_BY_CODE.get(code) || null;

export function resolveEntry(ref) {
  if (typeof ref !== 'string' || !ref) return null;

  if (ref.startsWith('ig:')) {
    const post = IG_BY_CODE.get(ref.slice(3));
    if (!post) return null;
    return {
      kind: 'post', ref, id: post.code,
      title: post.title,
      meta: '',
      still: post.cover || '',
      clip: '',
      href: igUrl(post),
      external: true
    };
  }

  const project = bySlug(ref);
  if (project) {
    const still = projectStill(project);
    const clip = project.preview || '';
    return {
      kind: 'project', ref, id: project.slug,
      title: project.title,
      meta: [project.client, project.year].filter(Boolean).join(' · '),
      /* a cover if it has one, otherwise the clip's poster — either way
         something paints without touching the video */
      still: still ? coverUrl(still) : posterUrl(clip),
      clip,
      /* a record with something running on this site opens that, not a
         page about it — see `live` in the field list */
      href: project.live || projectUrl(project),
      external: false,
      project
    };
  }

  const gallery = archiveBySlug(ref);
  if (gallery) {
    return {
      kind: 'gallery', ref, id: gallery.slug,
      title: gallery.title,
      meta: [gallery.client, gallery.year].filter(Boolean).join(' · '),
      still: gallery.cover ? coverUrl(gallery.cover) : '',
      clip: '',
      href: gallery.behance ? behanceUrl(gallery.behance) : '',
      external: true
    };
  }

  return null;
}

/* the page, in order, with anything unresolvable dropped rather than
   rendered as a hole */
export const pageEntries = (sectorId) =>
  pageRefs(sectorId).map(resolveEntry).filter(Boolean);

/* Where a project sits in the running order of its page — for prev /
   next.  It walks the page, not the sector tag, so it matches what the
   visitor actually clicked through. */
export function neighbours(p, sectorId) {
  const list = pageEntries(sectorId).filter(e => e.kind === 'project');
  const i = list.findIndex(x => x.id === p.slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: list[(i - 1 + list.length) % list.length].project,
    next: list[(i + 1) % list.length].project
  };
}

/* which page a project belongs to, by where it is actually listed */
export function homeSector(p) {
  for (const s of Object.keys(PAGES)) {
    if (pageRefs(s).includes(p.slug)) return s;
  }
  return p.sectors[0];
}
