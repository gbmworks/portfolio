/**
 * Loads the eyewear out of its source FBX.
 *
 * Conventions confirmed by measuring the file rather than assumed: **X across
 * the face, Y up, +Z out of the face toward the camera** -- three.js's own
 * convention, so nothing is rotated on load. (The sibling configurator's notes
 * describe the *Rhino* convention for a different set of files; rotating to
 * match it lays the frame on its side.)
 *
 * Geometry comes back in **millimetres** with the origin at the point the
 * frame rests on -- the underside of the bridge, at its rear face -- which is
 * the same space the portrait draws in.
 *
 * Shape keys arrive as morph targets and are kept unbaked here. `bakeShape`
 * resolves a selection into plain geometry, so the AR scene and the silhouette
 * tracer both consume the same finished mesh and cannot disagree about which
 * shape is currently selected.
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { mirrorX, needsMirror } from './mirrorX';
import { subdivide } from './subdivide';
import { smoothNormals, weldNormals } from './smoothNormals';

export type PartKey =
  | 'front'
  | 'lens'
  | 'bridge'
  | 'templeLeft'
  | 'templeRight'
  | 'templeWireLeft'
  | 'templeWireRight'
  | 'hinge'
  | 'core';

/** Every part driven by the temple design keys, acetate and wire together. */
export const TEMPLE_PARTS = [
  'templeLeft',
  'templeRight',
  'templeWireLeft',
  'templeWireRight',
] as const satisfies readonly PartKey[];

/**
 * Object-name prefixes, matched case-insensitively.
 *
 * `TEMPLE` is deliberately absent: a single mesh holding both arms is split
 * into left and right below, because the fit needs to splay them independently.
 */
const PART_NAMES: Record<string, PartKey> = {
  FRONT: 'front',
  FRAME: 'front',
  BASIC: 'front',
  GLASS: 'lens',
  LENS: 'lens',
  BRIDGE: 'bridge',
  HINGE: 'hinge',
  METAL: 'core',
};

/** Prefixes that identify a combined two-arm temple mesh. */
const TEMPLE_NAMES = ['TEMPLE', 'ARM'];

/**
 * The temple object holds two materials, and they are two different products.
 *
 * In the source the arm is one object called `temple` carrying an acetate
 * material and a `metal` one -- the wire running through the arm. glTF splits
 * a node into one mesh per material, so both arrive under the same node name
 * and the name alone cannot tell them apart. Routing on the name put them both
 * in the same slot and the second silently overwrote the first, which is why
 * the wire was missing from the product entirely rather than failing loudly.
 *
 * The material name is the discriminator, because it is the thing that
 * actually differs. Both halves carry the same design shape keys, so they are
 * split and morphed in step; see `TEMPLE_PARTS`.
 */
const METAL_MATERIAL = /metal/i;

function materialNameOf(mesh: THREE.Mesh): string {
  const material = mesh.material;
  if (Array.isArray(material)) return material[0]?.name ?? '';
  return (material as THREE.Material | undefined)?.name ?? '';
}
/** Prefixes for arms already separated in the source. */
const TEMPLE_LEFT_NAMES = ['L_ARM', 'LEFT_ARM', 'L.ARM'];
const TEMPLE_RIGHT_NAMES = ['R_ARM', 'RIGHT_ARM', 'R.ARM'];

/**
 * Subdivision levels per part.
 *
 * The glTF is a base cage throughout, so everything reads faceted without
 * this. Every part is subdivided, and that is not just for looks: Loop
 * subdivision pulls a surface *inside* its cage, so subdividing only some
 * parts moves them relative to the rest. Smoothing the front alone shrank it
 * about 1.6 mm and left the bridge -- untouched, still on its cage --
 * standing proud of the frame's front face, looking stuck on rather than
 * built in.
 *
 * The hinge gets one level rather than two: it is already the densest part in
 * the file and each level quadruples both triangles and load time.
 */
const SUBDIVISION: Partial<Record<PartKey, number>> = {
  front: 2,
  lens: 2,
  bridge: 2,
  templeLeft: 2,
  templeRight: 2,
  // The wire sits inside the arm it runs through, so it has to be smoothed by
  // the same amount. Loop subdivision pulls a surface inside its cage; smooth
  // the acetate alone and the wire it contains pushes out through the side.
  templeWireLeft: 2,
  templeWireRight: 2,
  hinge: 1,
};

/** Fallback front width, mm, for files whose own scale is not believable. */
export const NOMINAL_FRONT_WIDTH = 138;
/** A frame front outside this range means the file is not in centimetres. */
const PLAUSIBLE_FRONT_WIDTH: [number, number] = [100, 165];

export interface LoadedFrame {
  parts: Partial<Record<PartKey, THREE.BufferGeometry>>;
  /** Shape-key name -> morph index, per part. Empty when the file has none. */
  morphs: Partial<Record<PartKey, Record<string, number>>>;
  /** True when any part carries shape keys at all. */
  hasShapeKeys: boolean;
  /** Measured front width, mm. */
  frontWidth: number;
  hingeLeft: THREE.Vector3;
  hingeRight: THREE.Vector3;
  tipLeft: THREE.Vector3;
  tipRight: THREE.Vector3;
  bounds: THREE.Box3;
  lensCentreY: number;
  lensHeight: number;
}

const cache = new Map<string, Promise<LoadedFrame>>();

export function loadFrame(url: string): Promise<LoadedFrame> {
  const hit = cache.get(url);
  if (hit) return hit;

  // glTF or FBX, by extension.
  //
  // glTF is the better carrier and the one to prefer: morph targets are part
  // of the format rather than an optional export flag, they arrive as
  // *relative* deltas with their names attached, and Blender's exporter does
  // not quietly drop them when modifiers are applied -- which is exactly what
  // cost the FBX its shape keys.
  const promise = new Promise<LoadedFrame>((resolve, reject) => {
    const fail = (error: unknown) =>
      reject(error instanceof Error ? error : new Error(`Failed to load ${url}`));
    const done = (root: THREE.Object3D) => {
      try {
        resolve(build(root));
      } catch (error) {
        fail(error);
      }
    };

    if (/\.gl(b|tf)$/i.test(url)) {
      new GLTFLoader().load(url, (gltf) => done(gltf.scene), undefined, fail);
    } else {
      new FBXLoader().load(url, done, undefined, fail);
    }
  });

  cache.set(url, promise);
  return promise;
}

interface Collected {
  geometry: THREE.BufferGeometry;
  morphNames: Record<string, number>;
}

/**
 * Bounds of the base shape, ignoring morph targets.
 *
 * `computeBoundingBox()` deliberately expands the box to cover every morph
 * target, so that frustum culling still works when a shape is driven to full
 * influence. That makes it the wrong tool for *measuring* the product: on this
 * model the union of all eight shapes is 224 mm across where the frame itself
 * is 140, which fooled the unit detection into thinking the file was not in
 * metres and squashed the whole frame to a nominal width.
 *
 * Every measurement that describes the thing being sold -- its width, its lens
 * aperture, its overall size -- has to come from here instead.
 */
export function baseBounds(geometry: THREE.BufferGeometry): THREE.Box3 {
  const box = new THREE.Box3();
  const position = geometry.getAttribute('position');
  if (!position) return box;
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    box.expandByPoint(point.fromBufferAttribute(position, i));
  }
  return box;
}

/** Number of morph targets on a geometry, for the merge warning below. */
const morphCount = (g: THREE.BufferGeometry): number =>
  g.morphAttributes.position ? g.morphAttributes.position.length : 0;

function build(group: THREE.Object3D): LoadedFrame {
  const collected = new Map<PartKey, Collected[]>();
  let combinedTemple: Collected | null = null;
  let combinedWire: Collected | null = null;

  group.updateWorldMatrix(true, true);
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const geometry = (mesh.geometry as THREE.BufferGeometry).clone();
    // Keep the authored unwrap. Vertex colours are never sampled and are most
    // of the remaining memory.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        geometry.deleteAttribute(name);
      }
    }
    applyMatrixWithMorphs(geometry, mesh.matrixWorld);

    const entry: Collected = {
      geometry,
      morphNames: mesh.morphTargetDictionary ? { ...mesh.morphTargetDictionary } : {},
    };

    const clean = partNameFor(mesh, group);
    if (TEMPLE_NAMES.some((p) => clean.startsWith(p))) {
      if (METAL_MATERIAL.test(materialNameOf(mesh))) combinedWire = entry;
      else combinedTemple = entry;
      return;
    }

    let key: PartKey | null = null;
    if (TEMPLE_LEFT_NAMES.some((p) => clean.startsWith(p))) key = 'templeLeft';
    else if (TEMPLE_RIGHT_NAMES.some((p) => clean.startsWith(p))) key = 'templeRight';
    else {
      for (const [prefix, mapped] of Object.entries(PART_NAMES)) {
        if (clean.startsWith(prefix)) {
          key = mapped;
          break;
        }
      }
    }
    if (!key) return;

    const list = collected.get(key);
    if (list) list.push(entry);
    else collected.set(key, [entry]);
  });

  // Mirror any half-model part before anything downstream looks at it.
  //
  // Has to happen here, ahead of the temple split and the measurements: the
  // split works on the sign of x, and the front width is meaningless while
  // only half the front exists.
  for (const list of collected.values()) {
    for (const entry of list) {
      if (needsMirror(entry.geometry)) entry.geometry = mirrorX(entry.geometry);
    }
  }
  for (const half of [combinedTemple, combinedWire]) {
    if (!half) continue;
    const entry = half as Collected;
    if (needsMirror(entry.geometry)) entry.geometry = mirrorX(entry.geometry);
  }

  // A single mesh holding both arms splits cleanly on the midline: after
  // mirroring no triangle crosses x = 0.
  const splits: [Collected | null, PartKey, PartKey][] = [
    [combinedTemple, 'templeLeft', 'templeRight'],
    [combinedWire, 'templeWireLeft', 'templeWireRight'],
  ];
  for (const [source, leftKey, rightKey] of splits) {
    if (!source) continue;
    const both = source as Collected;
    collected.set(rightKey, [
      { geometry: halfBySign(both.geometry, -1), morphNames: both.morphNames },
    ]);
    collected.set(leftKey, [
      { geometry: halfBySign(both.geometry, 1), morphNames: both.morphNames },
    ]);
  }

  if (collected.size === 0) throw new Error('No recognisable frame parts in the FBX');

  const parts: Partial<Record<PartKey, THREE.BufferGeometry>> = {};
  const morphs: Partial<Record<PartKey, Record<string, number>>> = {};
  for (const [key, list] of collected) {
    if (list.length > 1 && list.some((l) => morphCount(l.geometry) > 0)) {
      console.warn(
        `[frame] "${key}" is several meshes and at least one carries shape keys; ` +
          'merging drops them. Join the object in the source instead.',
      );
    }
    parts[key] = list.length === 1 ? list[0].geometry : mergePositions(list.map((l) => l.geometry));
    const names = list.find((l) => Object.keys(l.morphNames).length > 0)?.morphNames;
    if (names) morphs[key] = names;
  }

  // Subdivide before anything measures or recentres the model: the cage is
  // not the surface, and the limit surface is a little smaller than it.
  for (const [key, levels] of Object.entries(SUBDIVISION) as [PartKey, number][]) {
    const geometry = parts[key];
    if (geometry) parts[key] = subdivide(geometry, levels);
  }

  const front = parts.front;
  if (!front) throw new Error('model has no front part to measure');

  // Scale.
  //
  // Read the file as centimetres first and keep that if the front lands at a
  // believable width. Only fall back to forcing a nominal width when it does
  // not: the older reference set was drawn at two arbitrary scales and its
  // absolute size genuinely could not be trusted, but a file that says it is
  // 140 mm across almost certainly is, and squashing that to a nominal number
  // throws away the one real dimension the designer specified.
  const rawBox = baseBounds(front);
  const rawWidth = rawBox.max.x - rawBox.min.x;
  // Try the three unit systems a CAD export is ever in and keep the one that
  // puts the front at a believable width. glTF is metres by convention and
  // the FBX was centimetres, so guessing from the extension would be wrong
  // about as often as it was right.
  const candidates = [1000, 10, 1];
  const detected = candidates.find((factor) => {
    const mm = rawWidth * factor;
    return mm >= PLAUSIBLE_FRONT_WIDTH[0] && mm <= PLAUSIBLE_FRONT_WIDTH[1];
  });
  const scale = detected ?? (rawWidth > 1e-6 ? NOMINAL_FRONT_WIDTH / rawWidth : 1);

  const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);
  for (const geometry of Object.values(parts)) applyMatrixWithMorphs(geometry, scaleMatrix);

  // Origin at the saddle of the bridge: lowest and rearmost point on the
  // midline. Down the midline an acetate front runs from the top rim to the
  // bridge cut-out, so the lowest vertex in a narrow column at x = 0 is the
  // point that rests on the nose.
  const fb = baseBounds(front);
  const centreX = (fb.min.x + fb.max.x) / 2;
  const saddleSource = parts.bridge ?? front;
  const saddle = bridgeSaddle(saddleSource, centreX, (fb.max.x - fb.min.x) * 0.05);
  const recentre = new THREE.Matrix4().makeTranslation(-saddle.x, -saddle.y, -saddle.z);
  for (const geometry of Object.values(parts)) {
    applyMatrixWithMorphs(geometry, recentre);
    // Keep the normals the exporter authored.
    //
    // Both loaders supply per-vertex normals that already honour whatever
    // shade-smooth and auto-smooth settings the model was built with, so the
    // right move is to leave them alone -- transforms carry them correctly.
    // Recomputing was what made the frame render faceted, and on a mesh with
    // morph targets it is worse than cosmetic: `smoothNormals` de-indexes,
    // which grows the position count past the morph targets that have to stay
    // aligned with it, and every vertex beyond the old end bakes to NaN.
    if (!geometry.getAttribute('normal')) smoothNormals(geometry);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (!geometry.getAttribute('uv')) planarUvs(geometry);
  }

  const bounds = new THREE.Box3();
  for (const geometry of Object.values(parts)) bounds.union(baseBounds(geometry));

  const frontBox = baseBounds(front);
  const frontWidth = frontBox.max.x - frontBox.min.x;
  const left = templePoints(parts.templeLeft, 1);
  const right = templePoints(parts.templeRight, -1);
  const aperture = baseBounds(parts.lens ?? front);

  return {
    parts,
    morphs,
    hasShapeKeys: Object.values(morphs).some((m) => m && Object.keys(m).length > 0),
    frontWidth,
    hingeLeft: left.hinge,
    hingeRight: right.hinge,
    tipLeft: left.tip,
    tipRight: right.tip,
    bounds,
    lensCentreY: (aperture.min.y + aperture.max.y) / 2,
    lensHeight: aperture.max.y - aperture.min.y,
  };
}

/**
 * The authored name a mesh belongs to.
 *
 * Not `mesh.name`. glTF splits a node into one mesh per material, so the
 * temple -- a single object called `temple` in Blender -- arrives as a Group
 * named `temple` holding meshes called `Front002` and `Front002_1`. Matching
 * on the mesh's own name then routes both of them to the *front*, because
 * they happen to start with it, and the front ends up 300 mm deep with the
 * arms fused into it.
 *
 * The node the designer named is the top-level child of the scene root, so
 * that is what is matched. The same rule is right for FBX, where meshes are
 * already direct children.
 */
function partNameFor(mesh: THREE.Object3D, root: THREE.Object3D): string {
  let node: THREE.Object3D = mesh;
  while (node.parent && node.parent !== root) node = node.parent;
  return (node.name || mesh.name || '').toUpperCase().split(':').pop() ?? '';
}

/**
 * Transform positions *and* every morph target.
 *
 * `BufferGeometry.applyMatrix4` leaves `morphAttributes` untouched, which is a
 * quiet way to end up with a frame whose shapes jump to the original scale the
 * moment one is selected. Relative targets are deltas, so they take the
 * rotation and scale but never the translation.
 */
function applyMatrixWithMorphs(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
  geometry.applyMatrix4(matrix);

  const targets = geometry.morphAttributes.position;
  if (!targets || targets.length === 0) return;

  const scale = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  const linear = new THREE.Matrix4().extractRotation(matrix).scale(scale);

  const vector = new THREE.Vector3();
  for (const target of targets) {
    const attribute = target as THREE.BufferAttribute;
    for (let i = 0; i < attribute.count; i++) {
      vector.fromBufferAttribute(attribute, i);
      vector.applyMatrix4(geometry.morphTargetsRelative ? linear : matrix);
      attribute.setXYZ(i, vector.x, vector.y, vector.z);
    }
    attribute.needsUpdate = true;
  }
}

/**
 * Resolve a morph selection into plain geometry.
 *
 * Baking rather than driving `morphTargetInfluences` at render time. The
 * selection is discrete -- one of eight shapes, not a blend -- so there is
 * nothing to interpolate, and baking means the try-on and the portrait
 * silhouette consume the identical mesh. Driving influences would leave the
 * silhouette tracer, which renders geometry with no mesh around it, showing a
 * different shape from the one on the customer's face.
 */
export interface MorphWeight {
  index: number;
  weight: number;
}

export function bakeShape(
  geometry: THREE.BufferGeometry,
  weights: MorphWeight[],
): THREE.BufferGeometry {
  const targets = geometry.morphAttributes.position;
  const active = weights.filter(
    (w) => w.index >= 0 && targets && w.index < targets.length && Math.abs(w.weight) > 1e-4,
  );
  if (!targets || active.length === 0) return geometry;

  // A target that does not line up with the positions it drives can only
  // produce NaN, and a frame full of NaN renders as nothing at all with no
  // error anywhere. Say so and hand back the base shape.
  const usable = active.filter((w) => (targets[w.index] as THREE.BufferAttribute).count >= geometry.getAttribute('position').count);
  if (usable.length !== active.length) {
    console.warn('[frame] morph target shorter than its geometry; shape not applied');
    if (usable.length === 0) return geometry;
  }

  const baked = geometry.clone();
  baked.morphAttributes = {};
  const position = baked.getAttribute('position') as THREE.BufferAttribute;
  const base = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < position.count; i++) {
    let x = base.getX(i);
    let y = base.getY(i);
    let z = base.getZ(i);
    for (const { index, weight } of usable) {
      const target = targets[index] as THREE.BufferAttribute;
      if (geometry.morphTargetsRelative) {
        x += target.getX(i) * weight;
        y += target.getY(i) * weight;
        z += target.getZ(i) * weight;
      } else {
        // Absolute targets are positions, so a weight is a lerp toward them
        // from the base -- not a scale, which would collapse the mesh to the
        // origin at anything under full influence.
        x += (target.getX(i) - base.getX(i)) * weight;
        y += (target.getY(i) - base.getY(i)) * weight;
        z += (target.getZ(i) - base.getZ(i)) * weight;
      }
    }
    position.setXYZ(i, x, y, z);
  }

  position.needsUpdate = true;
  // Recompute: the vertices have moved, so the inherited normals no longer
  // describe this surface.
  //
  // `computeVertexNormals` rather than `smoothNormals` because this geometry
  // is indexed, and on indexed geometry three already averages across every
  // face sharing a vertex -- which on a subdivided surface is the smooth
  // normal wanted. It also keeps the index, and so keeps the UVs aligned with
  // the positions; `smoothNormals` de-indexes, which is the wrong trade here.
  baked.computeVertexNormals();
  // ...then heal the UV seams it just carved. `computeVertexNormals` averages
  // per *index*, and the seam split gives each side of a seam its own index,
  // so a morphed shape came out with a hard shading edge along every seam.
  weldNormals(baked);
  baked.computeBoundingBox();
  baked.computeBoundingSphere();
  return baked;
}

/**
 * The half of a mirrored mesh on one side of x = 0.
 *
 * Normals come along for the ride. Dropping them and recomputing afterwards
 * would re-flatten the arm, and computing them per half would disagree across
 * the seam even though the two halves never meet.
 */
function halfBySign(geometry: THREE.BufferGeometry, sign: 1 | -1): THREE.BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const normal = source.getAttribute('normal') as THREE.BufferAttribute | undefined;
  // The morph targets have to come through the same filter.
  //
  // This function builds a fresh geometry rather than masking the original, so
  // anything not copied here is simply gone -- and a dropped morph target does
  // not fail, it no-ops: `bakeShape` finds nothing to apply and hands back the
  // base shape, so the design buttons light up and the arm never moves. The
  // targets are per-vertex and parallel to the positions, so they survive by
  // being indexed with exactly the same triangle loop.
  const targets = (source.morphAttributes.position ?? []) as THREE.BufferAttribute[];
  const uv = source.getAttribute('uv') as THREE.BufferAttribute | undefined;

  const keptPositions: number[] = [];
  const keptNormals: number[] = [];
  const keptUvs: number[] = [];
  const keptTargets: number[][] = targets.map(() => []);

  for (let t = 0; t + 2 < position.count; t += 3) {
    const centre = (position.getX(t) + position.getX(t + 1) + position.getX(t + 2)) / 3;
    if (Math.sign(centre) !== sign) continue;
    for (let k = 0; k < 3; k++) {
      keptPositions.push(position.getX(t + k), position.getY(t + k), position.getZ(t + k));
      if (normal) keptNormals.push(normal.getX(t + k), normal.getY(t + k), normal.getZ(t + k));
      if (uv) keptUvs.push(uv.getX(t + k), uv.getY(t + k));
      for (let m = 0; m < targets.length; m++) {
        const target = targets[m];
        keptTargets[m].push(target.getX(t + k), target.getY(t + k), target.getZ(t + k));
      }
    }
  }

  const half = new THREE.BufferGeometry();
  half.setAttribute('position', new THREE.Float32BufferAttribute(keptPositions, 3));
  if (keptNormals.length > 0) {
    half.setAttribute('normal', new THREE.Float32BufferAttribute(keptNormals, 3));
  }
  if (keptUvs.length > 0) {
    half.setAttribute('uv', new THREE.Float32BufferAttribute(keptUvs, 2));
  }
  if (targets.length > 0) {
    half.morphAttributes.position = keptTargets.map(
      (values) => new THREE.Float32BufferAttribute(values, 3),
    );
    half.morphTargetsRelative = source.morphTargetsRelative;
  }
  half.computeBoundingBox();
  return half;
}

/**
 * The saddle of the bridge: lowest and rearmost point on the midline.
 *
 * `halfWidth` is sampled either side of x = 0 and has to miss the lens
 * apertures -- five per cent of the front width is about 7 mm, comfortably
 * inside the nasal area on every frame in the reference set.
 */
function bridgeSaddle(
  geometry: THREE.BufferGeometry,
  centreX: number,
  halfWidth: number,
): THREE.Vector3 {
  const pos = geometry.getAttribute('position');
  let minY = Infinity;
  let minZ = Infinity;
  let found = false;

  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i) - centreX) > halfWidth) continue;
    found = true;
    minY = Math.min(minY, pos.getY(i));
    minZ = Math.min(minZ, pos.getZ(i));
  }

  if (!found) {
    // Nothing on the midline means a keyhole or split bridge. Fall back to the
    // bounding box rather than returning a NaN origin.
    const b = baseBounds(geometry);
    return new THREE.Vector3(centreX, b.min.y, b.min.z);
  }
  return new THREE.Vector3(centreX, minY, minZ);
}

/**
 * Hinge and tip of one temple.
 *
 * A temple is a long thin sweep, so its ends are its extremes along z: the
 * hinge is front-most, the tip rear-most. Taking the centroid of a thin slab
 * at each end keeps the result off whichever corner happens to stick out.
 */
function templePoints(
  geometry: THREE.BufferGeometry | undefined,
  side: 1 | -1,
): { hinge: THREE.Vector3; tip: THREE.Vector3 } {
  const fallback = {
    hinge: new THREE.Vector3(side * 65, -5, 0),
    tip: new THREE.Vector3(side * 62, -20, -140),
  };
  if (!geometry) return fallback;
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count === 0) return fallback;

  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const band = (maxZ - minZ) * 0.06;
  return {
    hinge: centroidInBand(pos, maxZ - band, maxZ),
    tip: centroidInBand(pos, minZ, minZ + band),
  };
}

function centroidInBand(
  pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  lo: number,
  hi: number,
): THREE.Vector3 {
  const sum = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < lo || z > hi) continue;
    sum.x += pos.getX(i);
    sum.y += pos.getY(i);
    sum.z += z;
    n++;
  }
  return n > 0 ? sum.divideScalar(n) : new THREE.Vector3();
}

/** Concatenate position/normal arrays; these parts are not indexed. */
function mergePositions(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of flat) total += g.getAttribute('position').count;

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  let offset = 0;
  for (const g of flat) {
    const p = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      position[(offset + i) * 3] = p.getX(i);
      position[(offset + i) * 3 + 1] = p.getY(i);
      position[(offset + i) * 3 + 2] = p.getZ(i);
      if (nrm) {
        normal[(offset + i) * 3] = nrm.getX(i);
        normal[(offset + i) * 3 + 1] = nrm.getY(i);
        normal[(offset + i) * 3 + 2] = nrm.getZ(i);
      }
    }
    offset += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return out;
}

/**
 * Planar UVs projected along the frame's own axis.
 *
 * Acetate is milled from a flat sheet, so a planar projection down the front
 * *is* the physically correct mapping -- the pattern on a finished frame is
 * the pattern that was in the sheet, seen through the cut. That makes this
 * both the simplest option and the right one.
 *
 * **This is now only a fallback.** `Final.glb` carries a real unwrap on every
 * primitive -- 326 distinct coordinates across 326 vertices on the front,
 * filling most of 0-1 -- and that is what gets used, threaded through the
 * mirror, the subdivision and the left/right split. A planar projection
 * ignores how the piece is actually shaped, which is what made the tortoise
 * read as a pattern sliding over the front rather than cut into it.
 *
 * Kept for any part that arrives without coordinates at all, where a wrong
 * texture beats an untextured one. One unit of UV is 140 mm -- about a frame
 * width -- so a `mapRepeat` of 3 puts three tiles across the front.
 */
function planarUvs(geometry: THREE.BufferGeometry, sheetMm = 140): void {
  const position = geometry.getAttribute('position');
  if (!position) return;
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = position.getX(i) / sheetMm;
    uv[i * 2 + 1] = position.getY(i) / sheetMm;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
