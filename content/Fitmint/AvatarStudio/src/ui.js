import { icon, glyph } from './icons.js';

/**
 * The studio chrome.
 *
 * Right dock: category rail plus the wardrobe grid, colour swatches and the
 * face-detail sliders. Over the preview: the lighting dial on top, camera snaps
 * down the left edge, and the animation bar along the bottom. Nothing here owns
 * avatar state - every choice is reported through `onChange`.
 */

// Where the camera should sit while a category is open.
const FRAMING = {
  skin: 'full',
  eye: 'head',
  eyebrow: 'head',
  faceDetail: 'head',
  hair: 'head',
  facialHair: 'head',
  headgear: 'head',
  top: 'upper',
  bottom: 'full',
  footwear: 'feet',
  overalls: 'full',
};

const CAMERA_SNAPS = [
  { id: 'full', label: 'Fit', title: 'Zoom to fit' },
  { id: 'upper', label: 'Torso', title: 'Frame the upper body' },
  { id: 'head', label: 'Face', title: 'Snap to the face' },
  { id: 'feet', label: 'Feet', title: 'Frame the footwear' },
];

/**
 * HSB <-> hex.
 *
 * three's Color speaks HSL, but a colour picker wants HSB: dragging brightness
 * to zero should reach black and saturation to zero should reach grey, which is
 * how people expect a swatch to behave. HSL's lightness axis goes to white at
 * the top instead, so the conversion is done here rather than leaning on
 * setHSL.
 */
function hsbToHex(h, s, b) {
  const sat = s / 100;
  const val = b / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;
  const [r, g, bl] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}

function hexToHsb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(max ? (d / max) * 100 : 0), b: Math.round(max * 100) };
}

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

const button = (className, html, onClick, { title, type = 'button' } = {}) => {
  const node = el('button', className, html);
  node.type = type;
  if (title) {
    node.title = title;
    node.setAttribute('aria-label', title);
  }
  node.addEventListener('click', onClick);
  return node;
};

export class UI {
  /**
   * @param {object} opts
   * @param {object} opts.catalog
   * @param {(key: string, value: any) => Promise<void>} opts.onChange
   * @param {(action: string) => void} opts.onAction
   * @param {(framing: string) => void} opts.onFraming
   * @param {(degrees: number) => void} opts.onEnvironmentRotation
   * @param {(key: string) => {index: number, name: string}[]} opts.getRecolorTargets
   */
  constructor({ catalog, onChange, onAction, onFraming, onEnvironmentRotation, getRecolorTargets }) {
    this.catalog = catalog;
    this.onChange = onChange;
    this.onAction = onAction;
    this.onFraming = onFraming;
    this.onEnvironmentRotation = onEnvironmentRotation;
    this.getRecolorTargets = getRecolorTargets || (() => []);
    this.state = {};
    this.active = null;
    this.busy = new Set();
    // Animation lives on the stage, not in the wardrobe dock.
    this.dockCategories = Object.entries(catalog.categories).filter(
      ([, category]) => category.kind !== 'animation'
    );
  }

  mount(root) {
    this.root = root;
    this.#mountDock(root);
    this.#mountEnvironments(root);
    this.#mountCameraRail(root);
    this.#mountToolbar(root);
    this.#mountAnimationBar(root);
    return this;
  }

  // --------------------------------------------------------------- wardrobe

  #mountDock(root) {
    this.rail = el('nav', 'rail');
    this.rail.setAttribute('role', 'tablist');
    this.rail.setAttribute('aria-label', 'Customisation categories');

    this.panelTitle = el('h2', 'panel-title');
    this.panelBody = el('div', 'panel-body');

    const panel = el('section', 'panel');
    panel.append(this.panelTitle, this.panelBody);

    const dock = el('aside', 'dock');
    dock.append(this.rail, panel);
    root.append(dock);

    for (const [key, category] of this.dockCategories) {
      const tab = button(
        'rail-tab',
        `${icon(category.icon)}<span>${category.label}</span>`,
        () => this.select(key)
      );
      tab.dataset.key = key;
      tab.setAttribute('role', 'tab');
      this.rail.append(tab);
    }
    this.rail.style.setProperty('--rail-cols', String(Math.ceil(this.dockCategories.length / 2)));
  }

  // ------------------------------------------------------------ stage chrome

  /**
   * Lighting controls.
   *
   * There is one environment and it is never shown, so there is nothing to pick
   * between - only the angle it lights the avatar from.
   */
  #mountEnvironments(root) {
    const bar = el('div', 'env-bar');
    bar.append(el('span', 'bar-label', 'Light'));

    const spin = el('label', 'env-spin');
    spin.title = 'Rotate the lighting';
    spin.innerHTML = `${glyph.rotate}
      <input type="range" min="0" max="360" step="1" value="0" aria-label="Rotate the lighting">
      <output>0°</output>`;
    this.spinInput = spin.querySelector('input');
    this.spinOutput = spin.querySelector('output');
    this.spinInput.addEventListener('input', () => {
      const degrees = Number(this.spinInput.value);
      this.spinOutput.textContent = `${degrees}°`;
      this.onEnvironmentRotation(degrees);
    });
    // Double-click the dial to snap back to the HDRI's own orientation.
    spin.querySelector('svg').addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.setEnvironmentRotation(0);
      this.onEnvironmentRotation(0);
    });

    bar.append(spin);
    root.append(bar);
  }

  setEnvironmentRotation(degrees) {
    this.spinInput.value = String(degrees);
    this.spinOutput.textContent = `${Math.round(degrees)}°`;
  }

  #mountCameraRail(root) {
    const rail = el('div', 'camera-rail');
    rail.setAttribute('aria-label', 'Camera');
    rail.append(el('span', 'bar-label', 'Camera'));
    for (const snap of CAMERA_SNAPS) {
      const node = button(
        'camera-snap',
        `${icon('camera-' + snap.id)}<span>${snap.label}</span>`,
        () => {
          this.onFraming(snap.id);
          this.setFraming(snap.id);
        },
        { title: snap.title }
      );
      node.dataset.snap = snap.id;
      rail.append(node);
    }
    root.append(rail);
    this.cameraRail = rail;
  }

  setFraming(id) {
    for (const node of this.cameraRail.querySelectorAll('.camera-snap')) {
      node.classList.toggle('is-selected', node.dataset.snap === id);
    }
  }

  #mountToolbar(root) {
    const bar = el('div', 'toolbar');
    for (const [g, label, action] of [
      ['shuffle', 'Randomise', 'randomise'],
      ['reset', 'Reset', 'reset'],
      ['camera', 'Save PNG', 'snapshot'],
    ]) {
      bar.append(button('tool', `${glyph[g]}<span>${label}</span>`, () => this.onAction(action), { title: label }));
    }
    root.append(bar);
  }

  #mountAnimationBar(root) {
    const bar = el('div', 'anim-bar');
    bar.append(el('span', 'bar-label', 'Animation'));

    this.playButton = button('playback', glyph.pause, () => this.onAction('togglePlay'), {
      title: 'Pause animation',
    });
    bar.append(this.playButton);

    const list = el('div', 'anim-list');
    for (const item of this.catalog.categories.animation.items) {
      const node = button('anim', item.label, () => this.onChange('animation', item.id));
      node.dataset.key = 'animation';
      node.dataset.id = item.id;
      list.append(node);
    }
    bar.append(list);
    root.append(bar);
    this.animList = list;
  }

  setPaused(paused) {
    this.playButton.innerHTML = paused ? glyph.play : glyph.pause;
    this.playButton.title = paused ? 'Play animation' : 'Pause animation';
    this.playButton.classList.toggle('is-paused', paused);
  }

  // ------------------------------------------------------------------- state

  /** Mirror the app state into the chrome without firing change events. */
  sync(state) {
    this.state = state;
    this.#refreshSelection();
  }

  select(key) {
    if (!this.catalog.categories[key]) return;
    this.active = key;
    for (const tab of this.rail.children) {
      const on = tab.dataset.key === key;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    this.#renderPanel();
    const framing = FRAMING[key];
    if (framing) {
      this.onFraming(framing);
      this.setFraming(framing);
    }
  }

  #renderPanel() {
    const key = this.active;
    const category = this.catalog.categories[key];
    this.panelTitle.textContent = category.label;
    this.panelBody.replaceChildren();

    if (category.kind === 'morphSliders') return this.#renderSliders(category);

    this.panelBody.append(this.#grid(key, category));
    if (category.recolor) this.#appendRecolor(key);
  }

  /**
   * Colour rows for the worn item's untextured materials.
   *
   * Which materials those are depends on what is actually equipped, so this is
   * queried from the avatar rather than baked into the catalog.
   */
  /**
   * Colour controls for whatever the worn item exposes.
   *
   * Which materials those are depends on what is equipped, so the targets are
   * queried from the app rather than baked into the catalog.
   */
  #appendRecolor(key) {
    const itemId = this.state[key];
    const targets = itemId ? this.getRecolorTargets(key) : [];
    if (!targets.length) return;

    const wrap = el('div', 'swatches');
    wrap.append(el('h3', 'swatches-title', targets.length > 1 ? 'Colours' : 'Colour'));
    for (const target of targets) wrap.append(this.#colorPicker(key, itemId, target));
    this.panelBody.append(wrap);
  }

  /** Hue / saturation / brightness, with a live chip and a reset to original. */
  #colorPicker(key, itemId, target) {
    const id = `${key}:${itemId}:${target.id}`;
    const current = this.state.colors?.[id] ?? target.color ?? '#ffffff';

    const node = el('div', 'picker');
    node.innerHTML = `
      <div class="picker-head">
        <span class="picker-chip"></span>
        ${target.label ? `<span class="picker-label">${target.label}</span>` : ''}
        <output class="picker-hex"></output>
      </div>
      <label class="hsb"><span>H</span>
        <input type="range" min="0" max="360" aria-label="${target.label || 'Colour'} hue"></label>
      <label class="hsb"><span>S</span>
        <input type="range" min="0" max="100" aria-label="${target.label || 'Colour'} saturation"></label>
      <label class="hsb"><span>B</span>
        <input type="range" min="0" max="100" aria-label="${target.label || 'Colour'} brightness"></label>`;

    const [hue, sat, bri] = node.querySelectorAll('input');
    const chip = node.querySelector('.picker-chip');
    const hex = node.querySelector('.picker-hex');

    /** Reflect a colour in the chip, the readout and the track gradients. */
    const show = (h, s, b) => {
      const value = hsbToHex(h, s, b);
      chip.style.setProperty('--chip', value);
      hex.textContent = value.toUpperCase();
      // Paint each track with the colours that slider actually travels
      // through, so the control reads as a picker rather than three grey bars.
      sat.style.setProperty('--from', hsbToHex(h, 0, b));
      sat.style.setProperty('--to', hsbToHex(h, 100, b));
      bri.style.setProperty('--from', '#000000');
      bri.style.setProperty('--to', hsbToHex(h, s, 100));
      return value;
    };

    /** Move the sliders to a colour. Used on first paint and on reset. */
    const load = (value) => {
      const { h, s, b } = hexToHsb(value);
      hue.value = String(h);
      sat.value = String(s);
      bri.value = String(b);
      show(h, s, b);
    };

    /**
     * Apply the sliders, lifting the ones that would make the move invisible.
     *
     * Plenty of these garments are authored pure black, which is H0 S0 B0 -
     * and from there dragging hue or saturation changes nothing on screen,
     * because black stays black whatever its hue. Correct HSB, but it reads as
     * a dead control. So a hue or saturation drag brings brightness (and for
     * hue, saturation) up to somewhere visible first.
     */
    const push = (source) => {
      let h = Number(hue.value);
      let s = Number(sat.value);
      let b = Number(bri.value);

      if (source !== bri && b === 0) b = 60;
      if (source === hue && s === 0) s = 70;

      hue.value = String(h);
      sat.value = String(s);
      bri.value = String(b);

      this.onChange(`color:${key}:${target.id}`, show(h, s, b));
    };
    for (const input of [hue, sat, bri]) {
      input.addEventListener('input', () => push(input));
    }

    // The panel is not re-rendered while a picker is live, so reset has to put
    // the sliders back itself.
    const reset = button('picker-reset', glyph.reset, () => {
      this.onChange(`color:${key}:${target.id}`, null);
      load(target.original ?? target.color ?? '#ffffff');
    }, { title: 'Restore the original colour' });
    node.querySelector('.picker-head').append(reset);

    load(current);
    return node;
  }

  /** Re-draw the open panel in place, without moving the camera. */
  refresh() {
    if (this.active) this.#renderPanel();
  }

  #grid(key, category) {
    const grid = el('div', 'grid');
    if (category.optional) {
      grid.append(this.#tile(key, null, { id: null, label: 'None' }, glyph.none));
    }
    for (const item of category.items) {
      const src = item.thumb || item.texture;
      const art = src
        ? `<img src="${src}" alt="" loading="lazy" decoding="async" width="256" height="256">`
        : `<span class="tile-initial">${item.label.slice(0, 2)}</span>`;
      grid.append(this.#tile(key, item.id, item, art));
    }
    return grid;
  }

  #tile(key, id, item, art) {
    const tile = button(
      'tile',
      `<span class="tile-art">${art}</span><span class="tile-label">${item.label}</span>`,
      async () => {
        if (this.busy.has(key)) return;
        this.busy.add(key);
        tile.classList.add('is-loading');
        try {
          await this.onChange(key, id);
        } finally {
          this.busy.delete(key);
          tile.classList.remove('is-loading');
        }
      }
    );
    tile.dataset.key = key;
    tile.dataset.id = id ?? '';
    tile.setAttribute('aria-pressed', String(this.state[key] === id));
    tile.classList.toggle('is-selected', this.state[key] === id);
    return tile;
  }

  #renderSliders(category) {
    this.panelBody.append(
      el('p', 'panel-note', 'Blend any combination - every shape is a live morph target.')
    );
    for (const group of category.groups) {
      const section = el('div', 'slider-group');
      section.append(el('h3', 'slider-group-title', group.name));
      for (const slider of group.sliders) section.append(this.#slider(slider));
      this.panelBody.append(section);
    }
    this.panelBody.append(
      button('ghost-button', 'Reset face shape', () => this.onAction('resetMorphs'))
    );
  }

  #slider({ id, label }) {
    const value = this.state.morphs?.[id] ?? 0;
    const row = el('label', 'slider');
    row.innerHTML = `
      <span class="slider-head"><span class="slider-name">${label}</span><output>${value.toFixed(2)}</output></span>
      <input type="range" min="0" max="1" step="0.01" value="${value}" aria-label="${label}">`;
    const input = row.querySelector('input');
    const output = row.querySelector('output');
    const push = () => {
      const v = Number(input.value);
      output.textContent = v.toFixed(2);
      this.onChange(`morph:${id}`, v);
    };
    input.addEventListener('input', push);
    // Double-click the label to zero a single shape.
    row.querySelector('.slider-name').addEventListener('dblclick', (e) => {
      e.preventDefault();
      input.value = '0';
      push();
    });
    return row;
  }

  /** Re-paint selected states after the app state changes. */
  #refreshSelection() {
    const nodes = [...this.panelBody.querySelectorAll('[data-key]'), ...this.animList.children];
    for (const node of nodes) {
      const { key, id } = node.dataset;
      const on = (this.state[key] ?? null) === (id === '' ? null : id);
      node.classList.toggle('is-selected', on);
      if (node.hasAttribute('aria-pressed')) node.setAttribute('aria-pressed', String(on));
    }
  }
}
