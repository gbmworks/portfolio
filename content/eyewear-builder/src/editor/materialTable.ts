/**
 * Material properties, driven by an editable CSV.
 *
 * `public/materials.csv` is the source of truth for how every piece of the
 * product is shaded. Edit it and reload -- no rebuild, no digging through
 * TypeScript to find a roughness value. The columns are the ones actually
 * worth tuning on eyewear: roughness, metalness, a diffuse map, and how hard
 * the environment hits.
 *
 * Colour is a special case. For the pieces the customer can colour -- the
 * front, the bridge and the temples -- the configuration wins and the CSV's
 * `color` column is left blank; it is there for the pieces that have no
 * customer-facing colour, like the hinges. A value in the column for a
 * colourable piece acts as a fallback only.
 *
 * `MeshStandardMaterial`, not `MeshPhysicalMaterial`. Physical adds clearcoat,
 * transmission, sheen and iridescence, and of those only clearcoat is useful
 * here -- so the extra two are applied on top where the CSV asks for them and
 * the base stays standard, which is cheaper and much easier to reason about.
 */

import * as THREE from 'three';

import type { PartKey } from '../frame/loadFrame';

/** Logical pieces the CSV addresses. Both temples share one row. */
export type MaterialPiece = 'front' | 'bridge' | 'temple' | 'lens' | 'hinge' | 'wire'
  | 'core';

export const PART_PIECE: Record<PartKey, MaterialPiece> = {
  front: 'front',
  bridge: 'bridge',
  templeLeft: 'temple',
  templeRight: 'temple',
  templeWireLeft: 'wire',
  templeWireRight: 'wire',
  lens: 'lens',
  hinge: 'hinge',
  core: 'core',
};

export interface MaterialSpec {
  piece: MaterialPiece;
  label: string;
  color: string | null;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  envMapIntensity: number;
  map: string | null;
  mapRepeat: number;
  normalMap: string | null;
  normalScale: number;
  clearcoat: number;
  clearcoatRoughness: number;
  flatShading: boolean;
}

/**
 * Used when the CSV is missing or a row is absent.
 *
 * Keeping a complete set in code means a typo in the spreadsheet degrades one
 * row rather than rendering the whole product black.
 */
const FALLBACK: Record<MaterialPiece, MaterialSpec> = {
  front: spec('front', 'Frame front', { roughness: 0.32, clearcoat: 0.55 }),
  bridge: spec('bridge', 'Bridge', { roughness: 0.32, clearcoat: 0.55 }),
  // Identical to the front on purpose: the arms are cut from the same sheet
  // of acetate, and a matched temple that shades even slightly differently
  // reads as a colour mismatch rather than as a different finish.
  temple: spec('temple', 'Temples', { roughness: 0.32, clearcoat: 0.55 }),
  lens: spec('lens', 'Lenses', {
    color: '#dfe7ef',
    roughness: 0.04,
    opacity: 0.1,
    transparent: true,
    envMapIntensity: 1.6,
    clearcoat: 0.8,
  }),
  wire: spec('wire', 'Temple wire', { color: '#cfd2d6', roughness: 0.22, metalness: 0.96 }),
  hinge: spec('hinge', 'Hinges', { color: '#c3c6cb', roughness: 0.24, metalness: 0.95 }),
  core: spec('core', 'Metal core', { color: '#b9bcc2', roughness: 0.28, metalness: 0.92 }),
};

function spec(
  piece: MaterialPiece,
  label: string,
  over: Partial<MaterialSpec> = {},
): MaterialSpec {
  return {
    piece,
    label,
    color: null,
    roughness: 0.35,
    metalness: 0,
    opacity: 1,
    transparent: false,
    envMapIntensity: 1.1,
    map: null,
    mapRepeat: 4,
    normalMap: null,
    normalScale: 1,
    clearcoat: 0,
    clearcoatRoughness: 0.1,
    flatShading: false,
    ...over,
  };
}

let table: Record<MaterialPiece, MaterialSpec> = { ...FALLBACK };
let loaded: Promise<Record<MaterialPiece, MaterialSpec>> | null = null;

export function materialTable(): Record<MaterialPiece, MaterialSpec> {
  return table;
}

export function loadMaterialTable(): Promise<Record<MaterialPiece, MaterialSpec>> {
  if (loaded) return loaded;
  loaded = fetch(`${import.meta.env.BASE_URL}materials.csv`)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
    .then((text) => {
      table = parseCsv(text);
      return table;
    })
    .catch((error: unknown) => {
      console.warn('[materials] falling back to built-in table:', error);
      return table;
    });
  return loaded;
}

/**
 * A deliberately small CSV reader.
 *
 * No quoting, no escapes, no embedded commas -- the file is a table of numbers
 * and hex codes maintained by hand, and a full parser would be more code than
 * the thing it reads. Unknown columns are ignored and missing ones fall back,
 * so adding a column later cannot break an older file.
 */
function parseCsv(text: string): Record<MaterialPiece, MaterialSpec> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length < 2) return { ...FALLBACK };

  const headers = lines[0].split(',').map((h) => h.trim());
  const out: Record<string, MaterialSpec> = { ...FALLBACK };

  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));

    const piece = row.piece as MaterialPiece;
    if (!(piece in FALLBACK)) {
      console.warn(`[materials] unknown piece "${row.piece}", ignored`);
      continue;
    }

    const base = FALLBACK[piece];
    out[piece] = {
      piece,
      label: row.label || base.label,
      color: row.color || null,
      roughness: num(row.roughness, base.roughness),
      metalness: num(row.metalness, base.metalness),
      opacity: num(row.opacity, base.opacity),
      transparent: bool(row.transparent, base.transparent),
      envMapIntensity: num(row.envMapIntensity, base.envMapIntensity),
      map: row.map || null,
      mapRepeat: num(row.mapRepeat, base.mapRepeat),
      normalMap: row.normalMap || null,
      normalScale: num(row.normalScale, base.normalScale),
      clearcoat: num(row.clearcoat, base.clearcoat),
      clearcoatRoughness: num(row.clearcoatRoughness, base.clearcoatRoughness),
      flatShading: bool(row.flatShading, base.flatShading),
    };
  }

  return out as Record<MaterialPiece, MaterialSpec>;
}

const num = (value: string, fallback: number): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value: string, fallback: boolean): boolean => {
  if (value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
};

/* ------------------------------------------------------------ textures -- */

const textures = new Map<string, THREE.Texture>();

/** Load and cache a texture from `public/textures/`, set up for colour data. */
/**
 * Callers who need to know a texture has arrived.
 *
 * The editor draws on demand, not on a loop, so a map that resolves *after*
 * the frame it was assigned in is simply never shown -- the acetate keeps the
 * last drawn appearance until some unrelated interaction happens to trigger a
 * redraw. Picking tortoise and seeing the previous colour until you click
 * something else is this, and it reads as the material flickering between
 * choices rather than as a missing repaint.
 */
const textureListeners = new Set<() => void>();

export function onTextureLoad(listener: () => void): () => void {
  textureListeners.add(listener);
  return () => textureListeners.delete(listener);
}

export function texture(name: string, repeat: number): THREE.Texture {
  const key = `${name}|${repeat}`;
  const hit = textures.get(key);
  if (hit) return hit;

  const loaded = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}textures/${name}`,
    () => {
      for (const listener of textureListeners) listener();
    },
  );
  // A diffuse map carries colour, so it has to be tagged sRGB or everything
  // it touches renders washed out and pale.
  loaded.colorSpace = THREE.SRGBColorSpace;
  loaded.wrapS = THREE.RepeatWrapping;
  loaded.wrapT = THREE.RepeatWrapping;
  loaded.repeat.set(repeat, repeat);
  loaded.anisotropy = 8;
  textures.set(key, loaded);
  return loaded;
}

/** Apply a spec to a material, leaving colour to the caller. */
export function applySpec(material: THREE.MeshStandardMaterial, spec: MaterialSpec): void {
  material.roughness = spec.roughness;
  material.metalness = spec.metalness;
  material.opacity = spec.opacity;
  material.transparent = spec.transparent;
  material.envMapIntensity = spec.envMapIntensity;
  material.flatShading = spec.flatShading;
  material.depthWrite = !spec.transparent;
  material.map = spec.map ? texture(spec.map, spec.mapRepeat) : null;
  if (spec.normalMap) {
    material.normalMap = texture(spec.normalMap, spec.mapRepeat);
    material.normalScale.set(spec.normalScale, spec.normalScale);
  } else {
    material.normalMap = null;
  }
  // Deliberately does **not** set `needsUpdate`.
  //
  // It is the first half of a paint -- the caller applies the design over the
  // top and then decides, once, whether the compiled program actually changed
  // (`programKey` in EditorScene). Raising the flag here made that decision
  // unreachable and recompiled every material on every click, the lens's
  // transmission shader included, which is the most expensive in the scene.
}
