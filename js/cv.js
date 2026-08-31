/* ------------------------------------------------------------------
   Career, from the 2026 CV.  Kept apart from SECTIONS because it is
   about the person rather than the work: the Experience window reads
   from here, nothing else does.
   ------------------------------------------------------------------ */

export const CONTACT = {
  email: 'govindbmwork@gmail.com',
  links: 'https://beacons.ai/govindbmohan',
  based: 'Bangalore, India · from Kerala'
};

export const SUMMARY =
  'Hailing from Kerala, India. I love visuals, cloud gazing and speculating ' +
  'future scenarios. I aspire to be a future synthesist and work at the ' +
  'intersection of Tech and Design.';

export const EXPERIENCE = [
  {
    role: '3D Generalist',
    org: 'Primetrace Labs',
    when: 'Jan 2025 — present',
    now: true,
    points: [
      'Built an AI-driven virtual companion, integrating conversational systems with interactive gameplay.',
      'Designed and implemented the core engagement systems — feeding gameplay, touch interactions, adaptive experiences.',
      'Produced and integrated the 3D character assets: rigging, facial expressions, animation sequences and interaction-driven behaviour.'
    ]
  },
  {
    role: '3D Generalist',
    org: 'Freelance',
    when: 'May — Dec 2024',
    points: [
      'Suta Bombay (Mumbai) — 3D character development of the co-founders, and compositing 3D animation onto real footage for a store launch.',
      'The Eyewear Project (Goa) — 1300+ eyewear product renders for their website.',
      'Hrutul Patel (Ahmedabad) — visuals for the Youforia Show, a theme-based 360° immersive audiovisual concert.',
      'Soul Jams (Bangalore) — 3D iconography for a rebrand, working to the brand guidelines.',
      'Besodetres (Tulum) — brand identity and launch visuals for a techno duo.',
      'Visual Jockey (Goa) — parametric, audio-reactive visuals and 3D animation for a techno night at Diaz.'
    ]
  },
  {
    role: '3D Technical Artist',
    org: 'Metabrix Labs',
    when: 'Jan — Aug 2024',
    points: [
      'Built and maintained a customisable, shape-key driven body mesh system for male and female avatars — diverse body types, skin tones, outfits and animation — inside an AI-powered 3D avatar generation platform.'
    ]
  },
  {
    role: 'Character Technical Artist & 3D Generalist',
    org: 'Fitmint',
    when: 'May 2023 — Apr 2024',
    points: [
      'Built and maintained the 3D avatar system for a crypto-based fitness app: user onboarding with customisable avatars, skin tones, facial features, hairstyles and outfits.',
      'Integrated 3D assets across app use cases — power-ups and UI overlays — optimised for a three.js framework and rendered in a web view.',
      'Worked closely with developers on integration, and produced social and website content including promotional videos and Reels.'
    ]
  },
  {
    role: 'Eyewear Designer, XR & Game Designer',
    org: 'Lenskart',
    when: 'Mar 2022 — Apr 2023',
    points: [
      'Designed 50+ eyewear models across multiple collections, including the Masaba × John Jacobs line.',
      'Moved into an experimental role developing AR media, including a tap-to-play 3D game for children — mobile-optimised, launched by QR code, tied to a related eyewear collection, built on three.js and WebGL.'
    ]
  },
  {
    role: 'Industrial Designer',
    org: 'Titan Company',
    when: 'Mar — Sep 2021',
    points: [
      'Graduation project on watches: a parametric system for personalised watch design and purchase — user-defined case shapes and sizes, image embossing on the dial, laser etching, and a time-dependent mirrored message revealed on the hour hand.'
    ]
  },
  {
    role: 'Industrial & Graphic Designer',
    org: 'Hecoll',
    when: 'Nov — Dec 2021',
    points: [
      'Designed a range of COVID-19 protective products in their anti-viral cloth — face masks, headgear, school uniforms — with packaging and a dedicated exhibition stall for the 2020 Hitex Health Expo, Hyderabad.'
    ]
  },
  {
    role: 'Industrial Designer',
    org: 'DesignFlyOver',
    when: 'May — Jun 2019',
    points: [
      'Summer internship: premium-range headphones for Zebronics, exploring folding mechanisms.',
      'A range of shampoo and conditioner bottles.'
    ]
  }
];

export const EDUCATION = [
  { what: 'National Institute of Design', when: '2017 — 2022',
    note: "Bachelor's in Industrial Design, specialising in Product Design", score: 'CGPA 7.0 / 10' },
  { what: 'Arya Central School (CBSE), Trivandrum', when: '2017', note: '', score: '93.8%' },
  { what: 'Christ Nagar (CBSE), Trivandrum', when: '2015', note: '', score: 'CGPA 10 / 10' }
];

export const SKILLS = [
  { group: '3D & Digital Design', items: [
    'NURBS / Mesh / Parametric modelling', 'UV optimisation & unwrapping', 'Texturing',
    'Rigging & animation', '3D rendering', 'Game design', 'AR / VR',
    'Motion graphics', 'Video editing', 'Motion tracking', 'Facial mocap'
  ]},
  { group: 'Software', items: [
    'Unreal Engine 5', 'Character Creator 4', 'iClone 8', 'Rhinoceros 3D', 'Grasshopper',
    'Keyshot', 'Blender', 'Substance Painter', 'After Effects', 'Photoshop',
    'Illustrator', 'InDesign', 'TouchDesigner', 'Resolume Arena', 'Figma'
  ]},
  { group: 'Prototyping & physical', items: [
    'Rapid prototyping', 'Sketching', 'Painting', 'Sculpting', 'Mechanisms'
  ]},
  { group: 'Working with people', items: [
    'Design research', 'User research', 'Conceptualisation',
    'Communication', 'Teamwork', 'Problem solving', 'Adaptive'
  ]}
];

export const LANGUAGES = ['English', 'Hindi', 'Malayalam', 'Tamil'];

export const INTERESTS = [
  'Futuring', 'Tinkering', 'Sneakerhead', 'Motorbikes', 'Football', 'Techno music',
  'Mix-media', 'Artificial intelligence', 'Puzzles', 'Creative coding',
  'Mixed reality', 'Roadtrips'
];

export const AWARDS = [
  { n: '01', title: 'Winner — Titan Nvisage 2.0', when: '2019' },
  { n: '02', title: 'Finalist — Titan Nvisage', when: '2018' },
  { n: '03', title: 'Finalist — IndiaSkills Regionals, Cabinet Making', when: '2018' },
  { n: '04', title: 'All India Rank 2 — NID Entrance', when: '2017' }
];
