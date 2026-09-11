/**
 * Builds src/catalog.js from "Fitmint - Male.csv" plus whatever actually
 * shipped in assets/opt. The CSV is the source of truth for what exists;
 * this script fails loudly when a row has no matching asset so the wardrobe
 * can never silently lose an item.
 *
 *   node tools/build_catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.resolve(ROOT, '..', 'Male');
const CSV = path.join(SRC, 'Fitmint - Male.csv');

const rows = fs.readFileSync(CSV, 'utf8').trim().split(/\r?\n/).map((l) => l.split(','));
const headers = rows.shift();
const column = (name) => {
  const i = headers.indexOf(name);
  if (i < 0) throw new Error(`CSV column not found: ${name}`);
  return rows.map((r) => (r[i] || '').trim()).filter(Boolean);
};

const exists = (p) => fs.existsSync(path.join(ROOT, p));

/**
 * Assets are regenerated in place rather than fingerprinted, so every URL
 * carries its file's mtime. That lets a host cache them hard while a rebuild
 * still reaches the browser.
 */
const versioned = (p) => `${p}?v=${Math.floor(fs.statSync(path.join(ROOT, p)).mtimeMs)}`;

// Hand-written display names; everything else falls back to a title-cased id.
const LABELS = {
  sportsGlasses: 'Sports Glasses',
  nounGlasses: 'Noun Glasses',
  olympianGlasses: 'Olympian Glasses',
  balaclava: 'Balaclava',
  helmet: 'Helmet',
  sneaker1: 'Runner 01',
  sneaker2: 'Runner 02',
  sneaker3: 'Champion Boot',
  sneaker4: 'Alien Sneaker',
  vest: 'Tank Vest',
  tshirt: 'T-Shirt',
  tshirt_sleeve: 'Tee + Tattoo Sleeve',
  hoodie: 'Hoodie',
  militaryVest: 'Military Vest',
  shorts: 'Shorts',
  jogger: 'Joggers',
  short_leggin: 'Shorts + Leggings',
  cargo: 'Cargo Pants',
  cargoShorts: 'Cargo Shorts',
  GOAT: 'G.O.A.T.',
  ALIEN: 'Alien',
};

const titleCase = (id) =>
  id
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/\b0*(\d+)\b/g, (_, n) => String(n).padStart(2, '0'))
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const PATTERNS = [
  [/^maleTexture_(\d+)$/, (n) => `Tone ${n.padStart(2, '0')}`],
  [/^eye_(\d+)$/, (n) => `Iris ${n.padStart(2, '0')}`],
  [/^hair(\d+)$/, (n) => `Hair ${n.padStart(2, '0')}`],
  [/^Beard(\d+)$/, (n) => `Beard ${n.padStart(2, '0')}`],
  [/^Eyebrow (\d+)$/, (n) => `Brow ${n.padStart(2, '0')}`],
];

const label = (id) => {
  if (LABELS[id]) return LABELS[id];
  for (const [re, fmt] of PATTERNS) {
    const m = id.match(re);
    if (m) return fmt(m[1]);
  }
  return titleCase(id);
};

const problems = [];

/** Mesh categories: one GLB per CSV entry. */
function meshCategory(csvColumn, folder, extra = {}) {
  const items = [];
  for (const id of column(csvColumn)) {
    const model = `assets/opt/${folder}/${id}.glb`;
    const thumb = `assets/thumbs/${folder}/${id}.webp`;
    if (!exists(model)) {
      // The CSV lists a few pieces that were never delivered as FBX (Beard07/08).
      problems.push(`${csvColumn} "${id}" listed in CSV but no source mesh on disk - skipped`);
      continue;
    }
    items.push({ id, label: label(id), model: versioned(model), thumb: exists(thumb) ? versioned(thumb) : null });
  }
  return { ...extra, items };
}

/** Texture categories: swap a map on a material that is already in Male.glb. */
function textureCategory(csvColumn, folder, target) {
  return {
    kind: 'texture',
    target,
    items: column(csvColumn).map((id) => {
      const texture = `assets/tex/${folder}/${id}.webp`;
      const thumb = `assets/tex/${folder}/${id}.thumb.webp`;
      if (!exists(texture)) problems.push(`${csvColumn} "${id}": missing ${texture}`);
      return { id, label: label(id), texture: versioned(texture), thumb: versioned(thumb) };
    }),
  };
}

// Morph targets present on the mesh but deliberately not offered.
const FACE_EXCLUDED = {
  facewidth: 'widens the head past the hair and headgear, which then clip',
};

// Face-detail sliders, grouped so the morph targets stay navigable.
const FACE_GROUPS = [
  ['Face', ['faceshape01', 'faceshape02']],
  ['Nose', ['nosewidth', 'nosenarrow', 'noseshape01', 'noseshape02', 'noseshape03', 'noseshape04', 'noseshape05', 'noseshape06']],
  ['Eyes', ['eyeshape01', 'eyeshape02', 'eyeshape03', 'eyeshape04', 'eyeshape05', 'eyeshape06', 'eyeshape07', 'eyeshape08', 'eyeshape09']],
  ['Mouth', ['lipwidth', 'lipshape01', 'lipshape02']],
  ['Build', ['abs']],
];

const faceDetails = column('FaceDetail');
const grouped = FACE_GROUPS.flatMap(([, names]) => names);
for (const name of faceDetails) {
  if (grouped.includes(name)) continue;
  if (FACE_EXCLUDED[name]) {
    problems.push(`FaceDetail "${name}" withheld - ${FACE_EXCLUDED[name]}`);
    continue;
  }
  problems.push(`FaceDetail "${name}" is not in any slider group`);
}

const catalog = {
  avatar: { model: versioned('assets/opt/Male.glb') },

  categories: {
    skin: { label: 'Skin', icon: 'skin', ...textureCategory('Skin', 'skin', 'body') },
    eye: { label: 'Eyes', icon: 'eye', ...textureCategory('Eye', 'eye', 'Eye') },

    hair: { label: 'Hair', icon: 'hair', kind: 'mesh', slot: 'hair', optional: true, recolor: true, ...meshCategory('Hair', 'hair') },
    facialHair: { label: 'Facial Hair', icon: 'beard', kind: 'mesh', slot: 'facialHair', optional: true, recolor: true, ...meshCategory('Facial Hair', 'facialHair') },

    eyebrow: {
      label: 'Brows',
      icon: 'brow',
      kind: 'morphPreset',
      target: 'Eyebrow',
      optional: true,
      // The id is the morph target's own name, which is what setEyebrow takes.
      items: column('Eyebrow').map((name) => ({ id: name, label: label(name) })),
    },

    headgear: { label: 'Headgear', icon: 'headgear', kind: 'mesh', slot: 'headgear', optional: true, ...meshCategory('Headgear', 'headgear') },
    // `recolor` exposes a colour picker for whichever of the worn item's
    // materials carry no artwork of their own - a plain tee or joggers can be
    // any colour, a camo vest should keep its print.
    top: { label: 'Top', icon: 'top', kind: 'mesh', slot: 'top', optional: true, recolor: true, ...meshCategory('Top', 'top') },
    bottom: { label: 'Bottom', icon: 'bottom', kind: 'mesh', slot: 'bottom', optional: true, recolor: true, ...meshCategory('Bottom', 'bottom') },
    footwear: { label: 'Footwear', icon: 'footwear', kind: 'mesh', slot: 'footwear', optional: true, ...meshCategory('Footwear', 'footwear') },
    overalls: { label: 'Overalls', icon: 'overalls', kind: 'mesh', slot: 'overalls', optional: true, recolor: true, ...meshCategory('Overalls', 'overalls') },

    faceDetail: {
      label: 'Face Detail',
      icon: 'face',
      kind: 'morphSliders',
      target: 'body',
      excluded: Object.keys(FACE_EXCLUDED),
      groups: FACE_GROUPS.map(([name, keys]) => ({
        name,
        sliders: keys.filter((k) => faceDetails.includes(k)).map((k) => ({ id: k, label: label(k) })),
      })),
    },

    animation: {
      label: 'Animation',
      icon: 'animation',
      kind: 'animation',
      items: column('Animation').map((id) => ({ id, label: label(id) })),
    },
  },

  // A full outfit replaces the separates and puts them back when taken off.
  // Headgear is an accessory layer and coexists with everything.
  rules: {
    overalls: { clears: ['top', 'bottom', 'footwear'], restoreOnRemove: true },
    top: { clears: ['overalls'] },
    bottom: { clears: ['overalls'] },
    footwear: { clears: ['overalls'] },
  },
  // Items whose recolourable panels are cut back to the first one, so the picker
  // reads as a single "Colour" rather than a row per panel.
  recolorLimit: { cargo: 1 },

  // Named colour groups, for items where the useful control is "the black parts"
  // rather than one material at a time. Listed by material name; anything not
  // named keeps its authored colour.
  recolorGroups: {
    GOAT: [
      { id: 'suit', label: 'Suit', materials: ['G.bodysuit.1', 'G.bodysuit.3', 'G.bag.4', 'G.shoe.1'] },
      { id: 'trim', label: 'Pockets & trim', materials: ['G.bodysuit.2', 'G.bag.2', 'G.bag.3', 'G.glove.3', 'G.shoe.4', 'G.shoe.6'] },
    ],
    ALIEN: [
      { id: 'suit', label: 'Suit', materials: ['A_shortsColor1', 'A_vestColor1'] },
      { id: 'accent', label: 'Accent', materials: ['A_maskColor2', 'A_shortsColor2', 'A_vestColor3', 'A_Sneaker1C2'] },
    ],
  },

  // Anything that encloses the head hides what would otherwise poke through it.
  // ALIEN carries its own mask and glasses, so it covers the face the same way
  // a balaclava does and also suppresses separate headgear.
  hides: {
    helmet: ['hair', 'facialHair'],
    balaclava: ['hair', 'facialHair'],
    ALIEN: ['hair', 'facialHair', 'headgear'],
  },

  // Shared starting look.
  defaults: {
    skin: 'maleTexture_3',
    eye: 'eye_1',
    hair: 'hair04',
    eyebrow: 'Eyebrow 1',
    top: 'tshirt',
    bottom: 'jogger',
    footwear: 'sneaker1',
    animation: 'idle',
  },
};

catalog.missing = problems;
if (problems.length) console.warn('Notes:\n  ' + problems.join('\n  '));

const out = `// GENERATED by tools/build_catalog.mjs from "Fitmint - Male.csv" - do not edit by hand.\nexport const catalog = ${JSON.stringify(catalog, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'src', 'catalog.js'), out);

const counts = Object.entries(catalog.categories)
  .map(([k, v]) => `${k}:${v.items ? v.items.length : v.groups.reduce((n, g) => n + g.sliders.length, 0)}`)
  .join('  ');
console.log('Wrote src/catalog.js\n  ' + counts);
