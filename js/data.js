/* ------------------------------------------------------------------
   All content lives here.

   SECTIONS drives everything: the wheel geometry, the labels, the
   section pages and the navigation between them.

   `behance` is the published project index, pulled from
   behance.net/govindbm and sorted into the three sectors.  Every entry
   links straight out to its Behance page; add `cover: 'assets/covers/x.jpg'`
   to give a row a thumbnail.
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
export const coverUrl = (p) =>
  !p.cover ? '' : (p.cover.startsWith('assets/') ? p.cover : BE_CDN + p.cover);

export const igUrl = (p) => 'https://www.instagram.com/' + p.kind + '/' + p.code + '/';

export const behanceUrl = (p) => 'https://www.behance.net/gallery/' + p.id + '/' + p.slug;

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
      </svg>`,
    behance: [
      { title: 'Muse | Watch | Product · UI/UX',          year: '',         id: '135998795', slug: 'Muse-Watch-Product-UIUX-Design' , cover: 'project_modules/disp/767e3b135998795.61f18e9b774d6.png' },
      { title: 'BBC League | Trophy Design',              year: '2020',     id: '135274949', slug: 'BBC-League-Trophy-Design' , cover: 'project_modules/disp/fa036a135274949.61e56320ce525.png' },
      { title: 'Toruk | Custom Bike',                     year: '',         id: '134159769', slug: 'Toruk-Custom-bike' , cover: 'project_modules/disp/584bc3134159769.61cf7e1b55429.png' },
      { title: 'E-Waste & Consumerism | System Design',   year: '',         id: '116688785', slug: 'E-Waste-Consumerism-System-Design' , cover: 'project_modules/disp/80c843116688785.6066e5354f11b.png' },
      { title: 'Aloka 2.0 | Smart Eyewear',               year: '2020',     id: '112336929', slug: 'Aloka-20-Smart-Eyewear-2020' , cover: 'project_modules/disp/97cad3112336929.60128b37c82a0.png' },
      { title: 'Concept Footwear | Cosmo',                year: '',         id: '110261387', slug: 'Concept-Footwear-Design-Cosmo' , cover: 'project_modules/disp/b01584110261387.5fe8b415f212f.png' },
      { title: 'Parametric Pendant Light | JEEV',         year: '',         id: '110045715', slug: 'Parametric-Pendant-Light-JEEV' , cover: 'project_modules/disp/4cc2d9110045715.5fe2375195684.png' },
      { title: 'Bottle Design | Dabur Vatika Hair Oil',   year: '',         id: '106502681', slug: 'Bottle-Design-Dabur-Vatika-Hair-Oil' , cover: 'project_modules/disp/0bb832106502681.5f9147f243634.png' },
      { title: 'Aloka | Smart Eyewear',                   year: '2019',     id: '98908263', slug: 'Aloka-Smart-Eyewear-2019' , cover: 'project_modules/disp/f0d94898908263.5ee737466d4a2.png' },
      { title: 'Headphone Concepts | Internship at DFO',  year: '2019',     id: '94654855', slug: 'Headphone-Concepts-Internship-at-DFO-2019' , cover: 'projects/max_808/5c576d94654855.Y3JvcCwxMzkwLDEwODcsMTcsNDQ.png' },
      { title: 'Monsoon Fiesta | Trophy Design',          year: '2019',     id: '94660631', slug: 'Monsoon-Fiesta-Trophy-Design-2019' , cover: 'projects/max_808/69b80a94660631.Y3JvcCwxMDgxLDg0NiwyMTksMA.png' },
      { title: 'Form Studies',                            year: '',         id: '94018607', slug: 'Form-Studies' , cover: 'projects/max_808/0de8d394018607.Y3JvcCwxMDA3LDc4OCwyMjksMA.png' },
      { title: 'Red Raven | Retro Collectible Toy',       year: '2018',     id: '94656165', slug: 'Red-Raven-A-Retro-Collectible-Toy-2018' , cover: 'projects/max_808/0836d194656165.Y3JvcCw1MTEzLDQwMDAsNTY5LDA.jpg' },
      { title: 'XOXO | 10,000 BC Cross Stool',            year: '2019',     id: '94102309', slug: 'XOXO-A-10000-BC-Cross-Stool-Classroom-project-2019' , cover: 'projects/max_808/a486c894102309.Y3JvcCw5OTAsNzc0LDc2LDMwMzA.png' },
      { title: 'Installation',                            year: '2019',     id: '93403109', slug: 'INSTALLATION-2019' , cover: 'project_modules/disp/20a20593403109.5e7bc9f6b0498.jpg' },
      { title: 'Product Tear-down | Scaled Model Making', year: '2018',     id: '79570257', slug: 'Product-tear-down-Scaled-down-model-making-2018' , cover: 'project_modules/disp/81a06c79570257.5cc7639cb6504.jpg' },
      { title: 'Worldskills Regionals | BIEC',            year: '2018',     id: '79651289', slug: 'Worldskills-Regionals-BIEC-21-23rd-June-2018' , cover: 'project_modules/disp/63c9d779651289.5cc9dc25d8c20.jpg' },
      { title: 'Foundation Year | NID Ahmedabad',         year: '2017-18',  id: '79560199', slug: 'Foundation-year-2017-18-NID-Ahmedabad' , cover: 'project_modules/disp/8b35f579560199.5cc72c64c763d.jpg' },
      { title: 'A Collection of My Old Works',            year: 'pre-2017', id: '79545819', slug: 'A-Collection-Of-my-old-works-Before-2017' , cover: 'project_modules/disp/0fd03d79545819.5ee7570719394.jpg' }
    ],
    instagram: [
      { title: 'Infinity Mirror — the build',                 code: 'DYob7EGT4Rb', kind: 'reel'  , cover: 'assets/covers/instagram/DYob7EGT4Rb.jpg' },
      { title: 'Infinity Mirror — transition',                code: 'DYoJ6mfTi0C', kind: 'reel'   , cover: 'assets/covers/instagram/DYoJ6mfTi0C.jpg' },
      { title: 'Chandelier form sculpting',                   code: 'DGpeQLrINo7', kind: 'reel'   , cover: 'assets/covers/instagram/DGpeQLrINo7.jpg' },
      { title: 'Grilled iPhone — BMW Motorsport',             code: 'DEm5d3BtpuF', kind: 'reel'  , cover: 'assets/covers/instagram/DEm5d3BtpuF.jpg' },
      { title: 'Personalised watch — Titan',              code: 'CwGUW4Ky1pX', kind: 'p'  , cover: 'assets/covers/instagram/CwGUW4Ky1pX.jpg' },
      { title: 'BBC League — trophy',                     code: 'CY1Tccvv3tV', kind: 'p'  , cover: 'assets/covers/instagram/CY1Tccvv3tV.jpg' },
      { title: 'Brat-built Yamaha FZ150',                 code: 'CPIeojBp4YM', kind: 'reel'   , cover: 'assets/covers/instagram/CPIeojBp4YM.jpg' },
      { title: 'Café racer — feature',                    code: 'CKbrJJHp8kK', kind: 'p'   , cover: 'assets/covers/instagram/CKbrJJHp8kK.jpg' },
      { title: 'Café racer — build',                      code: 'CKbq7F2pErQ', kind: 'p'   , cover: 'assets/covers/instagram/CKbq7F2pErQ.jpg' },
      { title: 'BBC League — NID',                        code: 'CJSklJHJZHQ', kind: 'p'  , cover: 'assets/covers/instagram/CJSklJHJZHQ.jpg' },
      { title: 'Concept kicks — Outerverse',              code: 'CJN3wEPpxaV', kind: 'p'  , cover: 'assets/covers/instagram/CJN3wEPpxaV.jpg' },
      { title: 'Concept study — Keyshot',                 code: 'CIFZG_uJOU3', kind: 'p'  , cover: 'assets/covers/instagram/CIFZG_uJOU3.jpg' },
      { title: 'Product render — 3DHOC',                  code: 'CIDI928Jn5p', kind: 'p'   , cover: 'assets/covers/instagram/CIDI928Jn5p.jpg' },
      { title: 'Flatpack furniture',                      code: 'CFghnTnJad_', kind: 'reel' , cover: 'assets/covers/instagram/CFghnTnJad_.jpg' },
      { title: 'Dabur Vatika — bottle',                   code: 'CD1KISlDFBK', kind: 'p' , cover: 'assets/covers/instagram/CD1KISlDFBK.jpg' },
      { title: 'Dabur Vatika — render',                   code: 'CD0g4DSDU7H', kind: 'p' , cover: 'assets/covers/instagram/CD0g4DSDU7H.jpg' },
      { title: 'Tacklebox — concept kicks',               code: 'CDtk-QOjhxc', kind: 'p' , cover: 'assets/covers/instagram/CDtk-QOjhxc.jpg' },
      { title: 'Sneaker concept',                         code: 'CDlpBAQDHiN', kind: 'p' , cover: 'assets/covers/instagram/CDlpBAQDHiN.jpg' },
      { title: 'Product render study',                    code: 'CDipHiwjXKP', kind: 'p' , cover: 'assets/covers/instagram/CDipHiwjXKP.jpg' },
      { title: 'Adidas concept',                          code: 'CCoAxWMjytt', kind: 'p' , cover: 'assets/covers/instagram/CCoAxWMjytt.jpg' },
      { title: 'Adidas concept — II',                     code: 'CCmI1ZajXaI', kind: 'p' , cover: 'assets/covers/instagram/CCmI1ZajXaI.jpg' },
      { title: 'Icon helmet — Keyshot',                   code: 'B8A3qZMH3eJ', kind: 'reel' , cover: 'assets/covers/instagram/B8A3qZMH3eJ.jpg' },
      { title: 'NID — product render',                    code: 'B5VbJ41nHIV', kind: 'p' , cover: 'assets/covers/instagram/B5VbJ41nHIV.jpg' }
    ]
  },

  {
    id: 'technical-art',
    layout: 'stack',
    index: '02',
    title: 'Technical Art',
    subtitle: 'Rigs, shapekeys, shaders and the pipeline underneath',
    color: '#ff5a12',
    glow: '#ff9048',
    blurb:
      'Character technical art — deformation rigs, viseme and speech shapekey systems, corrective shapes, retopology, LOD chains and asset optimization. The unglamorous layer that makes everything above it possible.',
    icon: `
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <!-- a joint chain with a control handle: a rig -->
        <path d="M17 47 27 37"/><path d="M35 30 45 19"/>
        <circle cx="14" cy="50" r="4"/>
        <circle cx="31" cy="33" r="4"/>
        <circle cx="48" cy="16" r="4"/>
        <rect x="24" y="26" width="14" height="14" rx="2" stroke-dasharray="3.2 3.2"/>
      </svg>`,
    behanceNote: 'Most of this work ships inside client projects rather than published case studies — the rigs, viseme systems and optimization passes behind the reels in Visualization.',
    behance: [
      { title: 'Strandbeest | Theo Jansen Mechanism',     year: '2018',     id: '79602877', slug: 'Strandbeast-Theo-jansen-mechanism-2018' , cover: 'project_modules/disp/3f9aa579602877.5cc867b21aede.jpg' }
    ],
    instagram: [
      { title: 'Hand tracking in TouchDesigner',              code: 'DZhUGT6zLUH', kind: 'reel' , cover: 'assets/covers/instagram/DZhUGT6zLUH.jpg' },
      { title: 'Roto & isolation workflow',                   code: 'DY5Se7pTini', kind: 'reel' , cover: 'assets/covers/instagram/DY5Se7pTini.jpg' },
      { title: 'Make anything breathe or bounce — Blender',   code: 'C_fxgvZo0Jm', kind: 'reel' , cover: 'assets/covers/instagram/C_fxgvZo0Jm.jpg' },
      { title: 'Fluid sim — viewport vs render',              code: 'C5S8PcUyYaS', kind: 'p' , cover: 'assets/covers/instagram/C5S8PcUyYaS.jpg' },
      { title: 'FPS environment in Unreal 5',                 code: 'C30IwA0S86z', kind: 'p' , cover: 'assets/covers/instagram/C30IwA0S86z.jpg' },
      { title: 'Crystalverse — web-based 3D game',            code: 'C5qKbaqoS81', kind: 'p' , cover: 'assets/covers/instagram/C5qKbaqoS81.jpg' },
      { title: 'Compositing in After Effects',            code: 'C3zEIFYSZDz', kind: 'reel' , cover: 'assets/covers/instagram/C3zEIFYSZDz.jpg' },
      { title: 'Dynamic outfit & 3D UI overlays',         code: 'C3xN8HcSitr', kind: 'reel' , preview: 'assets/web/fitmint/AvatarF.webm' , cover: 'assets/covers/instagram/C3xN8HcSitr.jpg' }
    ]
  },

  {
    id: 'visualization',
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
      </svg>`,
    /* ----------------------------------------------------------------
       Gallery for the Visualization page.

       Titles are derived from your filenames — rename them and write the
       captions.  `caption` is optional; leave it out and the tile shows
       just its title.  Every path is lazy-loaded: nothing is fetched
       until the tile is near the viewport.
       ---------------------------------------------------------------- */
    layout: 'gallery',
    gallery: [
      {
        title: 'Fitmint',
        note: 'Client work — avatars, environments and hype pieces.',
        href: 'https://www.instagram.com/p/C4zkP75yvL3/', source: 'Instagram',
        items: [
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
        ]
      },
      {
        title: 'Lenskart',
        note: 'Product reels — the John Jacobs × Masaba campaign.',
        href: 'https://www.behance.net/gallery/199186729/JohnJacobs-X-MasabaGupta', source: 'Behance',
        items: [
          { src: 'assets/web/Lenskart/ReelFinal.webm', title: 'Reel — Final' },
          { src: 'assets/web/Lenskart/shellReel.webm', title: 'Shell Reel' }
        ]
      },
      {
        title: 'Loops & Studies',
        note: 'Personal pieces, VJ loops and one-offs.',
        items: [
          { src: 'assets/web/1stroke.webm',    title: 'One Stroke' , href: 'https://www.instagram.com/p/C6eGhKYIsUI/', source: 'Instagram' },
          { src: 'assets/web/astronaut1.webm', title: 'Astronaut' , href: 'https://www.instagram.com/p/DCzA-Kmozdd/', source: 'Instagram' },
          { src: 'assets/web/Halo_bg.webm',    title: 'Halo' },
          { src: 'assets/web/drip_2.webm',     title: 'Drip' },
          { src: 'assets/web/shroomF.webm',    title: 'Shroom' , href: 'https://www.behance.net/gallery/198751431/Mushroom-Fiend-vs-Humans', source: 'Behance' },
          { src: 'assets/web/grind.webm',      title: 'Grind' },
          { src: 'assets/web/Unicorn F.webm',  title: 'Unicorn' },
          { src: 'assets/web/fiver.webm',      title: 'Fiver' },
          { src: 'assets/web/postFF.webm',     title: 'Post FF' },
          { src: 'assets/web/2hrutul.webm',    title: 'Hrutul' , href: 'https://www.instagram.com/p/DGdAAn0oQAJ/', source: 'Instagram' }
        ]
      }
    ],
    behance: [
      { title: 'JohnJacobs × Masaba Gupta',               year: '',         id: '199186729', slug: 'JohnJacobs-X-MasabaGupta' , preview: 'assets/web/Lenskart/ReelFinal.webm' , cover: 'projects/max_808/3601bc199186729.Y3JvcCwxNDAwLDEwOTUsMCw4Njk.jpg' },
      { title: 'Mushroom Fiend vs Humans',                year: '',         id: '198751431', slug: 'Mushroom-Fiend-vs-Humans' , preview: 'assets/web/shroomF.webm' , cover: 'projects/max_808/97a057198751431.Y3JvcCwxMDM1LDgxMCw0NDMsMA.png' },
      { title: 'Dreamhome',                               year: '',         id: '134159883', slug: 'Dreamhome' , cover: 'projects/max_808/f1b200134159883.61cf7fb5866dc.jpg' },
      { title: 'Product Visualisation | 3D',              year: '',         id: '100310627', slug: 'Product-Visualisation-3D' , cover: 'project_modules/disp/34e1ff100310627.6654537f465c1.png'  },
      { title: '3D Rendering',                            year: '',         id: '81079963', slug: '3D-Rendering' , cover: 'project_modules/disp/586aaa81079963.5ee75b55371ba.jpg' },
      { title: 'Mobius Ring | Exploration',               year: '',         id: '79602537', slug: 'Mobius-Ring-Exploration' , cover: 'project_modules/disp/2880c679602537.5cc865857f372.jpg' },
      { title: 'Digital Illustration',                    year: '',         id: '79562775', slug: 'Digital-Illustration' , cover: 'project_modules/disp/4a9cbb79562775.5e7349a597d97.jpg'  },
      { title: 'Photography',                             year: '',         id: '79603139', slug: 'Photography' , cover: 'project_modules/disp/3b4d5079603139.5cc869393f5b2.jpg'  }
    ],
    instagram: [
      { title: 'Saturday night visuals',                      code: 'DV8nZzIkxXn', kind: 'reel'  , cover: 'assets/covers/instagram/DV8nZzIkxXn.jpg' },
      { title: 'Diaz, Goa — first set',                       code: 'DCoVgrcIE9J', kind: 'p'   , cover: 'assets/covers/instagram/DCoVgrcIE9J.jpg' },
      { title: 'Projection mapping exercise',                 code: 'DY1ZLdrzDMn', kind: 'reel'  , cover: 'assets/covers/instagram/DY1ZLdrzDMn.jpg' },
      { title: 'Visuals for Hrutul Patel',                    code: 'DGdAAn0oQAJ', kind: 'p' , preview: 'assets/web/2hrutul.webm'  , cover: 'assets/covers/instagram/DGdAAn0oQAJ.jpg' },
      { title: '1stroke — live painting',                     code: 'C6eGhKYIsUI', kind: 'p' , preview: 'assets/web/1stroke.webm'  , cover: 'assets/covers/instagram/C6eGhKYIsUI.jpg' },
      { title: 'Mushroom Fiend — Pwnisher challenge',         code: 'C7CCDc6osNr', kind: 'reel' , preview: 'assets/web/shroomF.webm' , cover: 'assets/covers/instagram/C7CCDc6osNr.jpg' },
      { title: 'Fitmint — Apex asset series',                 code: 'C4zkP75yvL3', kind: 'p' , preview: 'assets/web/fitmint/GOAt.webm' , cover: 'assets/covers/instagram/C4zkP75yvL3.jpg' },
      { title: 'John Jacobs × Masaba — campaign',                      code: 'C7VvUorIkbB', kind: 'p'  , cover: 'assets/covers/instagram/C7VvUorIkbB.jpg' },
      { title: 'Geode NFT',                                   code: 'C7ONyGwI_ay', kind: 'p' , cover: 'assets/covers/instagram/C7ONyGwI_ay.jpg' },
      { title: 'Artwork for Bonzai Music',                    code: 'DBi2HkxIX1H', kind: 'p' , cover: 'assets/covers/instagram/DBi2HkxIX1H.jpg' },
      { title: 'Digital wardrobe collage',                    code: 'DBblehryOvP', kind: 'p' , cover: 'assets/covers/instagram/DBblehryOvP.jpg' },
      { title: 'The Game',                                    code: 'DCwKJScIyjX', kind: 'p' , cover: 'assets/covers/instagram/DCwKJScIyjX.jpg' },
      { title: 'Just floating around',                        code: 'DCzA-Kmozdd', kind: 'p' , preview: 'assets/web/astronaut1.webm' , cover: 'assets/covers/instagram/DCzA-Kmozdd.jpg' },
      { title: 'Do you have gum bro?',                        code: 'C93AJFvIDgv', kind: 'p' , cover: 'assets/covers/instagram/C93AJFvIDgv.jpg' },
      { title: '2024 recap',                                  code: 'DEhw2rOKdE8', kind: 'p' , cover: 'assets/covers/instagram/DEhw2rOKdE8.jpg' },
      { title: 'Fitmint — onboarding visuals',            code: 'CxrwSzcyniD', kind: 'reel' , cover: 'assets/covers/instagram/CxrwSzcyniD.jpg' },
      { title: 'Fitmint — NFT',                           code: 'CxA3q1JS0za', kind: 'reel' , cover: 'assets/covers/instagram/CxA3q1JS0za.jpg' },
      { title: 'Batman',                                  code: 'Cy75XuoSpS8', kind: 'p' , cover: 'assets/covers/instagram/Cy75XuoSpS8.jpg' }
    ]
  }
];
