import { catalog } from './catalog.js';
import { Viewer } from './viewer.js';
import { Avatar } from './avatar.js';
import { UI } from './ui.js';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT } from './environments.js';

const STORAGE_KEY = 'fitmint.avatar.look.v1';

const MESH_SLOTS = Object.entries(catalog.categories)
  .filter(([, c]) => c.kind === 'mesh')
  .map(([key]) => key);

const app = {
  state: null,
  viewer: null,
  avatar: null,
  ui: null,
};

boot();

async function boot() {
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('loader');
  const bar = document.getElementById('loader-bar');

  app.viewer = new Viewer(stage);
  app.avatar = new Avatar(app.viewer);

  await app.avatar.load(catalog.avatar.model, (p) => {
    bar.style.transform = `scaleX(${p})`;
  });
  bar.style.transform = 'scaleX(1)';

  app.state = loadState();

  app.ui = new UI({
    catalog,
    onChange: handleChange,
    onAction: handleAction,
    onFraming: (name) => app.viewer.frame(name),
    getRecolorTargets,
    onEnvironmentRotation: (degrees) => {
      app.state.environmentRotation = degrees;
      app.viewer.setEnvironmentRotation(degrees);
      saveState();
    },
  }).mount(document.getElementById('app'));

  applyEnvironment(app.state.environment);
  app.ui.setEnvironmentRotation(app.state.environmentRotation);
  app.viewer.setEnvironmentRotation(app.state.environmentRotation);

  trackDockObstruction();

  // Open the first category before the wardrobe finishes loading: the panel is
  // built from the catalog, so it is usable immediately, and a later select()
  // would yank the user off a tab they had already opened.
  app.ui.sync(app.state);
  app.ui.select('skin');
  app.viewer.start();

  await applyAll(app.state);
  app.ui.sync(app.state);

  overlay.classList.add('is-done');
  setTimeout(() => overlay.remove(), 650);

  if (catalog.missing?.length) console.info('Catalog notes:', catalog.missing);
  window.fitmint = app; // handy from the console
}

/**
 * Tell the viewer how much of the canvas the dock covers so the avatar is
 * centred in the space that is actually visible. The dock is a right-hand
 * column on desktop and a bottom sheet on narrow screens.
 */
function trackDockObstruction() {
  const dock = document.querySelector('.dock');
  const update = () => {
    const box = dock.getBoundingClientRect();
    const side = box.width < innerWidth * 0.7;
    const hiddenX = side ? innerWidth - box.left : 0;
    const hiddenY = side ? 0 : innerHeight - box.top;
    app.viewer.setObstruction(hiddenX, hiddenY);
    // Centre the stage bars over the free half too, not over the whole window.
    document.documentElement.style.setProperty('--dock-half', `${hiddenX / 2}px`);
    /* Publish the measured height so the CSS can stop guessing it. The dock
       sizes to its content on a phone — six skin tones need far less of the
       screen than a wardrobe with a colour picker under it — and the camera
       rail and the two floating bars all sit against the preview it leaves.
       A fixed 42vh made them right for the tallest category and wrong for
       every other one. */
    document.documentElement.style.setProperty('--dock-h', `${Math.round(hiddenY)}px`);
  };
  new ResizeObserver(update).observe(dock);
  addEventListener('resize', update);
  update();
}

/**
 * What the colour picker should offer for the item worn in `key`.
 *
 * Some items are best controlled as named groups - "the black parts of the
 * G.O.A.T. suit" spans the bodysuit, bag and shoe - and the catalog lists those
 * by material name. Everything else falls back to one target per material that
 * has neither its own artwork nor metal, trimmed by `recolorLimit`.
 *
 * @returns {{id: string, label: string|null, indices: number[]}[]}
 */
function getRecolorTargets(key) {
  const slot = catalog.categories[key]?.slot;
  const itemId = app.state[key];
  if (!slot || !itemId) return [];

  const withColor = (t) => ({
    ...t,
    color: app.avatar.materialColor(slot, t.indices[0]),
    original: app.avatar.materialOriginalColor(slot, t.indices[0]),
  });

  const groups = catalog.recolorGroups?.[itemId];
  if (groups) {
    return groups
      .map((g) => ({ id: g.id, label: g.label, indices: app.avatar.materialIndices(slot, g.materials) }))
      .filter((t) => t.indices.length)
      .map(withColor);
  }

  const auto = app.avatar.recolorable(slot);
  const limit = catalog.recolorLimit?.[itemId] ?? auto.length;
  return auto.slice(0, limit).map((m, n) => withColor({
    id: String(m.index),
    label: limit > 1 ? `Panel ${n + 1}` : null,
    indices: [m.index],
  }));
}

/** Load the lighting environment. Nothing waits on it - see Viewer. */
function applyEnvironment(id) {
  const preset = ENVIRONMENTS.find((e) => e.id === id) || ENVIRONMENTS[0];
  app.state.environment = preset.id;
  app.viewer.setEnvironment(preset.id);
  saveState();
}

// ----------------------------------------------------------------- state

function defaultState() {
  return {
    ...catalog.defaults,
    environment: DEFAULT_ENVIRONMENT,
    environmentRotation: 0,
    morphs: {},
    colors: {},
    paused: false,
    stashed: null,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') return { ...defaultState(), ...saved };
  } catch {
    /* corrupt or unavailable storage just falls back to defaults */
  }
  return defaultState();
}

function saveState() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
  } catch {
    /* private mode - the look simply will not persist */
  }
}

/**
 * Save after things settle.
 *
 * Sliders fire on every pointer move; serialising the whole look to
 * localStorage at that rate is wasted work on the main thread.
 */
let saveTimer = null;
function saveStateSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 250);
}

const itemIn = (key, id) =>
  id == null ? null : catalog.categories[key]?.items.find((i) => i.id === id) || null;

// ----------------------------------------------------------------- applying

/** Rebuild the whole look from scratch. Used on boot, reset and randomise. */
async function applyAll(state) {
  const jobs = [];
  for (const [key, category] of Object.entries(catalog.categories)) {
    switch (category.kind) {
      case 'texture':
        if (state[key]) jobs.push(app.avatar.setTexture(category.target, itemIn(key, state[key]).texture));
        break;
      case 'mesh':
        jobs.push(app.avatar.equip(category.slot, itemIn(key, state[key])));
        break;
      case 'morphPreset':
        app.avatar.setEyebrow(state[key]);
        break;
      default:
        break;
    }
  }
  await Promise.all(jobs);

  // A saved look may still carry a morph that has since been withheld; zero it
  // rather than leaving a shape nobody can reach the slider for.
  const withheld = catalog.categories.faceDetail.excluded || [];
  for (const name of withheld) {
    if (state.morphs?.[name]) delete state.morphs[name];
    app.avatar.setMorph(name, 0);
  }
  for (const [name, value] of Object.entries(state.morphs || {})) app.avatar.setMorph(name, value);
  for (const key of MESH_SLOTS) applyGarmentColors(key, state[key]);

  applyCoverage();
  if (state.animation) app.avatar.playAnimation(state.animation, 0);
  app.avatar.setPaused(Boolean(state.paused));
  app.ui?.setPaused(Boolean(state.paused));
}

/**
 * Re-apply saved panel colours for a garment.
 *
 * Colours are keyed by category, item and material index, so a red tee does not
 * silently turn the joggers red when you swap one for the other.
 */
function applyGarmentColors(key, itemId) {
  const slot = catalog.categories[key]?.slot;
  if (!slot || !itemId) return;
  const targets = getRecolorTargets(key);
  for (const target of targets) {
    const hex = app.state.colors?.[`${key}:${itemId}:${target.id}`];
    if (hex) app.avatar.setMaterialColor(slot, target.indices, hex);
  }
}

/**
 * Put back the separates an overall displaced, except `except`.
 *
 * Uses the outfit stashed when the overall went on, so you get the last thing
 * you actually wore. A look restored from an older session may have no stash;
 * the catalog defaults stand in there rather than leaving the avatar bare.
 * Slots deliberately set to None were never stashed, so they stay None.
 */
async function restoreDisplacedOutfit(except) {
  const stash = app.state.stashed;
  app.state.stashed = null;

  // Only the slots an overall actually covers - not hair or headgear, which it
  // never displaced and which may be deliberately empty.
  const displaced = Object.values(catalog.rules).find((r) => r.restoreOnRemove)?.clears ?? [];

  const jobs = [];
  for (const key of displaced) {
    if (key === except || app.state[key]) continue;
    const id = stash ? stash[key] : catalog.defaults[key];
    if (!id || !itemIn(key, id)) continue;
    app.state[key] = id;
    jobs.push(app.avatar.equip(catalog.categories[key].slot, itemIn(key, id)));
  }
  await Promise.all(jobs);
  for (const key of displaced) if (key !== except) applyGarmentColors(key, app.state[key]);
}

/** Hide slots that a worn item swallows, e.g. a helmet over the hair. */
function applyCoverage() {
  const hidden = new Set();
  for (const key of MESH_SLOTS) {
    for (const slot of catalog.hides[app.state[key]] || []) hidden.add(slot);
  }
  app.avatar.setHiddenSlots(hidden);
}

async function handleChange(key, value) {
  if (key.startsWith('morph:')) {
    const name = key.slice(6);
    app.state.morphs[name] = value;
    app.avatar.setMorph(name, value);
    return saveStateSoon();
  }

  // color:<category>:<targetId> - a garment panel or named colour group.
  if (key.startsWith('color:')) {
    const [, category, targetId] = key.split(':');
    const slot = catalog.categories[category]?.slot;
    const itemId = app.state[category];
    if (!slot || !itemId) return;
    const target = getRecolorTargets(category).find((t) => t.id === targetId);
    if (!target) return;

    const id = `${category}:${itemId}:${targetId}`;
    if (value) app.state.colors[id] = value;
    else delete app.state.colors[id];
    app.avatar.setMaterialColor(slot, target.indices, value);
    // No panel re-render here: this fires continuously while a slider is being
    // dragged, and replacing the panel would destroy the input mid-drag. The
    // picker keeps its own chip, readout and track gradients in sync.
    return saveStateSoon();
  }

  const category = catalog.categories[key];
  if (!category) return;

  const rule = catalog.rules[key] || {};

  if (value != null) {
    // A full-body overall and its separates cannot both be worn. Remember what
    // we take off so removing the overall does not leave the avatar bare.
    const stash = {};
    for (const cleared of rule.clears || []) {
      if (!app.state[cleared]) continue;
      stash[cleared] = app.state[cleared];
      app.state[cleared] = null;
      const slot = catalog.categories[cleared]?.slot;
      if (slot) app.avatar.unequip(slot);
    }
    if (rule.restoreOnRemove && !app.state[key]) app.state.stashed = stash;

    // Picking a separate takes the overall off, which would otherwise leave
    // every other slot it displaced empty - choose a top and the avatar is bare
    // from the waist down. Put the rest of the previous outfit back, minus the
    // piece being chosen right now.
    if ((rule.clears || []).some((c) => catalog.rules[c]?.restoreOnRemove)) {
      await restoreDisplacedOutfit(key);
    }
  } else if (rule.restoreOnRemove && app.state.stashed) {
    const stash = app.state.stashed;
    app.state.stashed = null;
    app.state[key] = null;
    await Promise.all(
      Object.entries(stash).map(([slotKey, id]) => {
        app.state[slotKey] = id;
        return app.avatar.equip(catalog.categories[slotKey].slot, itemIn(slotKey, id));
      })
    );
  }

  app.state[key] = value;

  switch (category.kind) {
    case 'texture':
      if (value) await app.avatar.setTexture(category.target, itemIn(key, value).texture);
      break;
    case 'mesh': {
      await app.avatar.equip(category.slot, itemIn(key, value));
      applyGarmentColors(key, value);
      applyCoverage();
      break;
    }
    case 'morphPreset':
      app.avatar.setEyebrow(value);
      break;
    case 'animation':
      app.avatar.playAnimation(value);
      if (app.state.paused) {
        app.state.paused = false;
        app.avatar.setPaused(false);
        app.ui.setPaused(false);
      }
      break;
    default:
      break;
  }

  app.ui.sync(app.state);
  if (catalog.categories[key]?.recolor) app.ui.refresh();
  saveState();
}

// ----------------------------------------------------------------- actions

function handleAction(action) {
  switch (action) {
    case 'togglePlay': {
      app.state.paused = !app.state.paused;
      app.avatar.setPaused(app.state.paused);
      app.ui.setPaused(app.state.paused);
      saveState();
      break;
    }
    case 'resetMorphs': {
      for (const name of Object.keys(app.state.morphs)) app.avatar.setMorph(name, 0);
      app.state.morphs = {};
      app.ui.sync(app.state);
      app.ui.select(app.ui.active); // redraw the sliders at zero
      saveState();
      break;
    }
    case 'reset':
      app.state = defaultState();
      applyEnvironment(app.state.environment);
      app.ui.setEnvironmentRotation(0);
      app.viewer.setEnvironmentRotation(0);
      applyAll(app.state).then(() => {
        app.ui.sync(app.state);
        app.ui.refresh();
        saveState();
      });
      break;
    case 'randomise':
      app.state = randomLook();
      // Snap back to the full-body framing: a fresh look is worth seeing whole,
      // and the camera may be parked on a detail from the last edit.
      app.viewer.frame('full');
      app.ui.setFraming('full');
      applyAll(app.state).then(() => {
        app.ui.sync(app.state);
        app.ui.refresh();
        saveState();
      });
      break;
    case 'snapshot':
      downloadSnapshot();
      break;
    default:
      break;
  }
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function randomLook() {
  const state = defaultState();
  state.environment = app.state.environment;
  state.environmentRotation = app.state.environmentRotation;
  const ids = (key) => catalog.categories[key].items.map((i) => i.id);

  state.skin = pick(ids('skin'));
  state.eye = pick(ids('eye'));
  state.eyebrow = pick(ids('eyebrow'));
  state.hair = Math.random() < 0.9 ? pick(ids('hair')) : null;
  state.facialHair = Math.random() < 0.55 ? pick(ids('facialHair')) : null;
  state.headgear = Math.random() < 0.4 ? pick(ids('headgear')) : null;

  if (Math.random() < 0.2) {
    state.overalls = pick(ids('overalls'));
    state.top = state.bottom = state.footwear = state.headgear = null;
  } else {
    state.overalls = null;
    state.top = pick(ids('top'));
    state.bottom = pick(ids('bottom'));
    state.footwear = pick(ids('footwear'));
  }

  state.animation = pick(ids('animation'));
  // Hair and beard share one colour. Both are single-material items, so their
  // colour target is material index 0.
  const hairColor = pick(['#120f0e', '#2b1d15', '#4a2f1d', '#7b4a24', '#c9a227']);
  if (state.hair) state.colors[`hair:${state.hair}:0`] = hairColor;
  if (state.facialHair) state.colors[`facialHair:${state.facialHair}:0`] = hairColor;

  // A light scatter of face shapes rather than all 24 at once.
  const sliders = catalog.categories.faceDetail.groups.flatMap((g) => g.sliders.map((s) => s.id));
  for (const id of sliders) {
    if (Math.random() < 0.3) state.morphs[id] = Number(Math.random().toFixed(2));
  }
  return state;
}

function downloadSnapshot() {
  const url = app.viewer.snapshot();
  const a = document.createElement('a');
  a.href = url;
  a.download = `fitmint-avatar-${Date.now()}.png`;
  a.click();
}

// ----------------------------------------------------------------- shortcuts

// Space toggles playback, but only when no control has focus - otherwise it
// would double up with the browser activating the focused button. Nothing
// destructive is bound to a bare key: losing a look to a stray keypress is a
// far worse trade than saving one click.
addEventListener('keydown', (e) => {
  if (e.key !== ' ' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, textarea, button, [contenteditable]')) return;
  e.preventDefault();
  handleAction('togglePlay');
});
