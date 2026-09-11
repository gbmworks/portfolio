// 24x24 stroke icons for the category rail. Currentcolor, 1.6 stroke.
const P = {
  skin: 'M12 3c3.3 0 6 2.7 6 6 0 4.2-2.6 7.6-6 12-3.4-4.4-6-7.8-6-12 0-3.3 2.7-6 6-6Z M9.5 9h5',
  eye: 'M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  hair: 'M5 13a7 7 0 0 1 14 0 M4.6 13c-.6-5 3-9.5 7.4-9.5S20 8 19.4 13 M7 13v3.5a5 5 0 0 0 10 0V13',
  beard: 'M7 5v4a5 5 0 0 0 10 0V5 M6.5 9c0 5.5 2 10 5.5 10s5.5-4.5 5.5-10 M10 13h4',
  brow: 'M4 13.5c2.2-3 5-4.5 8-4.5s5.8 1.5 8 4.5 M5.5 10.5C7.6 8.4 9.8 7.3 12 7.3s4.4 1.1 6.5 3.2',
  face: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M9 10h.01 M15 10h.01 M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8',
  headgear: 'M3 15h18 M5.5 15c0-4.7 2.9-8 6.5-8s6.5 3.3 6.5 8 M2.5 15v1.8a1 1 0 0 0 1 1h17a1 1 0 0 0 1-1V15',
  top: 'M8.5 3 12 5.5 15.5 3 21 6.5l-2.5 4L17 9.5V21H7V9.5l-1.5 1L3 6.5 8.5 3Z',
  bottom: 'M7 3h10l1 18h-5l-1-9-1 9H6L7 3Z',
  footwear: 'M3 17.5v-7h3l2.5 2.5H12l4 2.5h3.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 17.5Z M6 10.5V7',
  overalls: 'M9 3v3.5a3 3 0 0 0 6 0V3 M6.5 3 5 8l2 1.5V21h10V9.5L19 8l-1.5-5 M12 12v5',
  animation: 'M13 3 5 13h5l-1 8 8-10h-5l1-8Z',

  // Camera snaps: a bracket framing the part of the body each one targets.
  'camera-full': 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8 M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8 M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16 M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16 M12 7.5a1.6 1.6 0 1 0 0-3.2 M12 8v5 M9.6 16.8 12 13l2.4 3.8 M9.5 9.6h5',
  'camera-upper': 'M4 9V6.5A1.5 1.5 0 0 1 5.5 5H8 M16 5h2.5A1.5 1.5 0 0 1 20 6.5V9 M12 10.4a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z M6.2 19c.6-3.4 3-5.3 5.8-5.3s5.2 1.9 5.8 5.3',
  'camera-head': 'M4 9V6.5A1.5 1.5 0 0 1 5.5 5H8 M16 5h2.5A1.5 1.5 0 0 1 20 6.5V9 M20 15v2.5a1.5 1.5 0 0 1-1.5 1.5H16 M8 19H5.5A1.5 1.5 0 0 1 4 17.5V15 M12 17.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z M10 11h.01 M14 11h.01',
  'camera-feet': 'M20 15v2.5a1.5 1.5 0 0 1-1.5 1.5H16 M8 19H5.5A1.5 1.5 0 0 1 4 17.5V15 M7 15.5V9 M7 15.5h6.5l3.5 2 M12 5v6.5',
};

export function icon(name) {
  const d = P[name] || P.face;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d
      .split(' M')
      .map((seg, i) => `<path d="${i ? 'M' + seg : seg}"/>`)
      .join('')}</svg>`;
}

export const glyph = {
  none: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 19 19 5"/><circle cx="12" cy="12" r="9"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z"/></svg>`,
  shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h4v4"/><path d="M4 20 20 4"/><path d="M16 20h4v-4"/><path d="m4 4 5.5 5.5"/><path d="m14.5 14.5 5.5 5.5"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11a9 9 0 1 1 2.6 6.4"/><path d="M3 17v-5h5"/></svg>`,
  rotate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9"/><path d="M18.5 3.2v3.4h-3.4"/><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9"/><path d="M5.5 20.8v-3.4h3.4"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.4-2h7.8l1.4 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="13" r="3.4"/></svg>`,
};
