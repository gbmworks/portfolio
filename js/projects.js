/* ------------------------------------------------------------------
   The work, as projects.

   A project is a thing you made, not a link you posted.  It owns its
   own page, carries its own media, and can belong to more than one
   sector — Fitmint is technical art *and* visualization, the John
   Jacobs line is industrial design *and* visualization.  Before this
   file existed, each of those was typed out once per sector and a
   de-duplication pass tried to hide the copies.

   Fields
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
     preview   a local clip; plays in the index preview stage and hero
     media     [{ src, title }] shown as a grid on the project page
     behance   { id, slug } — the published case study
     posts     [{ code, kind, title, cover }] — Instagram entries
     feature   pulled to the top of its sector's index

   Anything with no page worth building stays a POST: a one-off on
   Instagram, linked out from the sector index, never pretending to be
   a case study.
   ------------------------------------------------------------------ */

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
    title: 'Tap-to-Play AR Game',
    client: 'Lenskart',
    role: 'XR & Game Designer',
    year: '2022 — 23',
    tools: ['three.js', 'WebGL'],
    summary:
      'A mobile-optimised 3D game for children, launched by QR code and tied to a ' +
      'related eyewear collection.',
    body: [
      'An experimental role at Lenskart developing AR media. The game had to run in a ' +
      'browser on a phone, open from a scan with no install, and stay tied to the ' +
      'product it was promoting — built on three.js and WebGL.'
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
    slug: 'dfo-headphones',
    sectors: ['industrial-design'],
    title: 'Headphone Concepts',
    client: 'Zebronics, via DesignFlyOver',
    role: 'Industrial Design intern',
    year: '2019',
    tools: [],
    cover: 'projects/max_808/5c576d94654855.Y3JvcCwxMzkwLDEwODcsMTcsNDQ.png',
    summary:
      'Premium-range headphones for Zebronics, exploring folding mechanisms — a ' +
      'summer internship at DesignFlyOver.',
    behance: { id: '94654855', slug: 'Headphone-Concepts-Internship-at-DFO-2019' }
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
     Industrial design — published case studies
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
    slug: 'e-waste-system-design',
    sectors: ['industrial-design'],
    title: 'E-Waste & Consumerism',
    role: 'System design',
    year: '',
    tools: [],
    cover: 'project_modules/disp/80c843116688785.6066e5354f11b.png',
    summary: '',
    behance: { id: '116688785', slug: 'E-Waste-Consumerism-System-Design' }
  },

  {
    slug: 'aloka-2',
    sectors: ['industrial-design'],
    title: 'Aloka 2.0 — Smart Eyewear',
    year: '2020',
    tools: [],
    cover: 'project_modules/disp/97cad3112336929.60128b37c82a0.png',
    summary: '',
    behance: { id: '112336929', slug: 'Aloka-20-Smart-Eyewear-2020' }
  },

  {
    slug: 'aloka',
    sectors: ['industrial-design'],
    title: 'Aloka — Smart Eyewear',
    year: '2019',
    tools: [],
    cover: 'project_modules/disp/f0d94898908263.5ee737466d4a2.png',
    summary: '',
    behance: { id: '98908263', slug: 'Aloka-Smart-Eyewear-2019' }
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
    slug: 'monsoon-fiesta-trophy',
    sectors: ['industrial-design'],
    title: 'Monsoon Fiesta — Trophy Design',
    year: '2019',
    tools: [],
    cover: 'projects/max_808/69b80a94660631.Y3JvcCwxMDgxLDg0NiwyMTksMA.png',
    summary: '',
    behance: { id: '94660631', slug: 'Monsoon-Fiesta-Trophy-Design-2019' }
  },

  {
    slug: 'form-studies',
    sectors: ['industrial-design'],
    title: 'Form Studies',
    year: '',
    tools: [],
    cover: 'projects/max_808/0de8d394018607.Y3JvcCwxMDA3LDc4OCwyMjksMA.png',
    summary: '',
    behance: { id: '94018607', slug: 'Form-Studies' }
  },

  {
    slug: 'red-raven-toy',
    sectors: ['industrial-design'],
    title: 'Red Raven — Retro Collectible Toy',
    year: '2018',
    tools: [],
    cover: 'projects/max_808/0836d194656165.Y3JvcCw1MTEzLDQwMDAsNTY5LDA.jpg',
    summary: '',
    behance: { id: '94656165', slug: 'Red-Raven-A-Retro-Collectible-Toy-2018' }
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

  {
    slug: 'product-teardown',
    sectors: ['industrial-design'],
    title: 'Product Tear-down & Scaled Model Making',
    year: '2018',
    tools: [],
    cover: 'project_modules/disp/81a06c79570257.5cc7639cb6504.jpg',
    summary: '',
    behance: { id: '79570257', slug: 'Product-tear-down-Scaled-down-model-making-2018' }
  },

  {
    slug: 'worldskills-regionals',
    sectors: ['industrial-design'],
    title: 'WorldSkills Regionals — BIEC',
    year: '2018',
    tools: [],
    cover: 'project_modules/disp/63c9d779651289.5cc9dc25d8c20.jpg',
    summary: '',
    behance: { id: '79651289', slug: 'Worldskills-Regionals-BIEC-21-23rd-June-2018' }
  },

  {
    slug: 'nid-foundation',
    sectors: ['industrial-design'],
    title: 'Foundation Year — NID Ahmedabad',
    year: '2017 — 18',
    tools: [],
    cover: 'project_modules/disp/8b35f579560199.5cc72c64c763d.jpg',
    summary: '',
    behance: { id: '79560199', slug: 'Foundation-year-2017-18-NID-Ahmedabad' }
  },

  {
    slug: 'old-works',
    sectors: ['industrial-design'],
    title: 'A Collection of My Old Works',
    year: 'pre-2017',
    tools: [],
    cover: 'project_modules/disp/0fd03d79545819.5ee7570719394.jpg',
    summary: '',
    behance: { id: '79545819', slug: 'A-Collection-Of-my-old-works-Before-2017' }
  },

  /* ============================================================
     Technical art
     ============================================================ */

  {
    slug: 'strandbeest',
    sectors: ['technical-art'],
    title: 'Strandbeest — Theo Jansen Mechanism',
    year: '2018',
    tools: [],
    cover: 'project_modules/disp/3f9aa579602877.5cc867b21aede.jpg',
    summary: '',
    behance: { id: '79602877', slug: 'Strandbeast-Theo-jansen-mechanism-2018' }
  },

  /* ============================================================
     Visualization
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
    slug: 'suta-bombay',
    sectors: ['visualization'],
    title: 'Suta — Store Launch',
    client: 'Suta, Mumbai',
    role: '3D & compositing · Freelance',
    year: '2024',
    tools: [],
    summary:
      '3D character development of the founders, composited onto real footage for a ' +
      'store launch.'
  },

  {
    slug: 'the-eyewear-project',
    sectors: ['visualization', 'industrial-design'],
    title: 'The Eyewear Project',
    client: 'The Eyewear Project, Goa',
    role: 'Product visualization · Freelance',
    year: '2024',
    tools: [],
    summary: '1300+ eyewear product renders for their website.'
  },

  {
    slug: 'soul-jams',
    sectors: ['visualization'],
    title: 'Soul Jams — Rebrand Iconography',
    client: 'Soul Jams, Bangalore',
    role: '3D iconography · Freelance',
    year: '2024',
    tools: [],
    summary: '3D iconography for a rebrand, worked to the brand guidelines.'
  },

  {
    slug: 'besodetres',
    sectors: ['visualization'],
    title: 'Besodetres',
    client: 'Besodetres, Tulum',
    role: 'Brand identity & visuals · Freelance',
    year: '2024',
    tools: [],
    summary: 'Brand identity and launch visuals for a techno duo.'
  },

  {
    slug: 'dreamhome',
    sectors: ['visualization'],
    title: 'Dreamhome',
    year: '',
    tools: [],
    cover: 'projects/max_808/f1b200134159883.61cf7fb5866dc.jpg',
    summary: '',
    behance: { id: '134159883', slug: 'Dreamhome' }
  },

  {
    slug: 'product-visualisation',
    sectors: ['visualization'],
    title: 'Product Visualisation',
    year: '',
    tools: [],
    cover: 'project_modules/disp/34e1ff100310627.6654537f465c1.png',
    summary: '',
    behance: { id: '100310627', slug: 'Product-Visualisation-3D' }
  },

  {
    slug: '3d-rendering',
    sectors: ['visualization'],
    title: '3D Rendering',
    year: '',
    tools: [],
    cover: 'project_modules/disp/586aaa81079963.5ee75b55371ba.jpg',
    summary: '',
    behance: { id: '81079963', slug: '3D-Rendering' }
  },

  {
    slug: 'mobius-ring',
    sectors: ['visualization'],
    title: 'Mobius Ring — Exploration',
    year: '',
    tools: [],
    cover: 'project_modules/disp/2880c679602537.5cc865857f372.jpg',
    summary: '',
    behance: { id: '79602537', slug: 'Mobius-Ring-Exploration' }
  },

  {
    slug: 'digital-illustration',
    sectors: ['visualization'],
    title: 'Digital Illustration',
    year: '',
    tools: [],
    cover: 'project_modules/disp/4a9cbb79562775.5e7349a597d97.jpg',
    summary: '',
    behance: { id: '79562775', slug: 'Digital-Illustration' }
  },

  {
    slug: 'photography',
    sectors: ['visualization'],
    title: 'Photography',
    year: '',
    tools: [],
    cover: 'project_modules/disp/3b4d5079603139.5cc869393f5b2.jpg',
    summary: '',
    behance: { id: '79603139', slug: 'Photography' }
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
   Loose posts.

   Instagram entries that belong to no project — a technique, a study,
   a one-off.  They link straight out; they never get a page.
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

/* Featured first, then source order — which already runs newest to oldest. */
export const bySector = (id) =>
  PROJECTS.filter(p => p.sectors.includes(id))
          .sort((a, b) => (b.feature ? 1 : 0) - (a.feature ? 1 : 0));

export const bySlug = (slug) => PROJECTS.find(p => p.slug === slug) || null;

export const projectUrl = (p) => 'project.html?p=' + p.slug;

/* The still to represent a project with: its own cover, or failing that
   the thumbnail of the first post attached to it.  A project with
   neither has no artwork in the repo at all and says so. */
export const projectStill = (p) =>
  p.cover || (p.posts && p.posts.length && p.posts[0].cover) || '';

/* Where a project sits in a sector's list — for prev / next. */
export const neighbours = (p, sectorId) => {
  const list = bySector(sectorId);
  const i = list.findIndex(x => x.slug === p.slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: list[(i - 1 + list.length) % list.length],
    next: list[(i + 1) % list.length]
  };
};
