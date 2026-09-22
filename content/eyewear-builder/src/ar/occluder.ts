/**
 * The depth-only head mask that hides the far side of the glasses.
 *
 * When you turn your head in a mirror, the far temple disappears behind your
 * cheek. Without this, a try-on renders both arms floating over the face and
 * the illusion collapses immediately -- it is the single cheapest thing that
 * makes a try-on look real.
 *
 * The mask is two surfaces, because one is not enough:
 *
 *  - **The tracked face mesh.** The 478 landmarks, triangulated with
 *    MediaPipe's own tessellation, deform to the actual face every frame. This
 *    covers the front and the cheeks out as far as the ears.
 *
 *  - **A skull proxy.** The landmark mesh stops at the ears, but a temple runs
 *    another 100 mm past them, so on a turned head the far arm would reappear
 *    behind the ear with nothing to hide it. The proxy is an ellipsoid fitted
 *    to the measured head, with everything forward of the ear plane discarded
 *    so it can never cover the front of the frame or the nose.
 *
 * Both render with `colorWrite: false` before anything else, so they write
 * depth and nothing else: the video shows through, and the depth test does the
 * culling for free.
 */

import * as THREE from 'three';
import { FaceLandmarker } from '@mediapipe/tasks-vision';

/**
 * Triangle list for the 468-point mesh, derived from the tessellation.
 *
 * `FACE_LANDMARKS_TESSELATION` is published as an edge list, but it was
 * generated from a triangle list and never reordered, so consecutive triples
 * of edges still close a triangle. That is checked rather than assumed: if the
 * triples ever stop closing, the assumption has broken and we would rather
 * know than silently render a shredded mask.
 */
let triangles: Uint16Array | null = null;

export function faceTriangles(): Uint16Array {
  if (triangles) return triangles;

  const edges = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const out = new Uint16Array(edges.length);
  let count = 0;
  let broken = 0;

  for (let i = 0; i + 2 < edges.length; i += 3) {
    const a = edges[i];
    const b = edges[i + 1];
    const c = edges[i + 2];
    if (a.end === b.start && b.end === c.start && c.end === a.start) {
      out[count++] = a.start;
      out[count++] = b.start;
      out[count++] = c.start;
    } else {
      broken++;
    }
  }

  if (broken > 0) {
    console.warn(
      `[occluder] ${broken} tessellation triples did not close; mask may have holes.`,
    );
  }
  triangles = out.slice(0, count);
  return triangles;
}

/** How far to push the mask out along its normals, in world units per mm. */
const INFLATE_MM = 1.5;

/**
 * Skull proxy, as fractions of the measured head.
 *
 * These are the numbers the whole mask lives or dies by, so they are named
 * rather than buried in the matrix. Too big and the *near* arm is culled along
 * with the far one, which is far more obviously wrong than a sliver of the far
 * arm showing; too small and the far arm reappears behind the ear.
 */
export const SKULL = {
  /**
   * Radius as a fraction of the measured head width.
   *
   * A true sphere, not an ellipsoid. The scaled version was three different
   * numbers that had to be tuned against each other, and getting any one wrong
   * showed up as the mask reaching through the brow or the chin. A head is
   * close enough to spherical above the jaw that one radius fitted to the
   * width does the job, and there is only one number to be wrong about.
   *
   * 0.46 keeps it just inside the skin, which is what leaves a temple resting
   * against the head on the visible side of the mask.
   */
  radius: 0.52,
  /** Centre offset from the nasion, as fractions of head width and ear depth. */
  centreY: 0.18,
  centreZ: -0.72,
};

/**
 * How the mask is drawn.
 *
 * `on` is the real thing: depth only. `debug` paints it so its shape and
 * placement can actually be seen -- getting an occluder wrong is invisible by
 * construction, which makes it very easy to ship a mask that is subtly the
 * wrong size and never notice. `off` removes it, which is the only way to
 * confirm the culling is doing anything at all.
 */
export type OccluderMode = 'on' | 'off' | 'debug';

export class HeadOccluder {
  readonly group = new THREE.Group();

  private readonly faceGeometry = new THREE.BufferGeometry();
  private readonly facePositions: Float32Array;
  private readonly skull: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;

  constructor(pointCount = 478) {
    this.facePositions = new Float32Array(pointCount * 3);
    this.faceGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.facePositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.faceGeometry.setIndex(new THREE.BufferAttribute(faceTriangles(), 1));

    // Depth-only. `colorWrite: false` is what makes this a mask rather than a
    // grey blob; without it you get a bust of the customer's head.
    this.material = new THREE.MeshBasicMaterial({ colorWrite: false });

    const faceMesh = new THREE.Mesh(this.faceGeometry, this.material);
    // Render before everything else so the depth buffer is primed. Frustum
    // culling is off because the bounding volume is rewritten every frame and
    // a stale one pops the mask out at the edge of the view.
    faceMesh.renderOrder = -10;
    faceMesh.frustumCulled = false;

    this.skull = new THREE.Mesh(backShell(), this.material);
    this.skull.renderOrder = -10;
    this.skull.frustumCulled = false;

    this.group.add(faceMesh, this.skull);
  }

  setMode(mode: OccluderMode): void {
    this.group.visible = mode !== 'off';
    this.material.colorWrite = mode === 'debug';
    this.material.wireframe = mode === 'debug';
    this.material.color.set(mode === 'debug' ? 0x35d07f : 0xffffff);
    this.material.needsUpdate = true;
  }

  /**
   * @param worldPoints landmarks already unprojected into camera space.
   * @param headMatrix head basis -> world, for placing the skull proxy.
   * @param dims measured head size in world units.
   */
  update(
    worldPoints: Float32Array,
    headMatrix: THREE.Matrix4,
    dims: { width: number; length: number; depth: number },
    worldPerMm: number,
  ): void {
    this.facePositions.set(worldPoints);
    inflate(this.facePositions, this.faceGeometry.getIndex()!.array, INFLATE_MM * worldPerMm);
    this.faceGeometry.getAttribute('position').needsUpdate = true;
    this.faceGeometry.computeVertexNormals();
    this.faceGeometry.computeBoundingSphere();

    // Uniform scale, so it stays a sphere however the head is proportioned.
    const radius = dims.width * SKULL.radius;
    this.skull.matrixAutoUpdate = false;
    const local = new THREE.Matrix4()
      .makeTranslation(0, dims.width * SKULL.centreY, dims.depth * SKULL.centreZ)
      .multiply(new THREE.Matrix4().makeScale(radius, radius, radius));
    this.skull.matrix.copy(headMatrix).multiply(local);
  }

  dispose(): void {
    this.faceGeometry.dispose();
    this.skull.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * A unit sphere with everything in front of the ear plane removed.
 *
 * Keeping the front would be actively wrong: the proxy would sit between the
 * camera and the frame's own bridge and erase the front of the glasses. The
 * cut is at z = +0.15 rather than 0 so there is a little overlap with the
 * tracked face mesh and no seam for a temple to show through.
 */
function backShell(): THREE.BufferGeometry {
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const nonIndexed = sphere.toNonIndexed();
  sphere.dispose();

  const pos = nonIndexed.getAttribute('position');
  const kept: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    const z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    if (z > 0.15) continue;
    for (let k = 0; k < 3; k++) {
      kept.push(pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k));
    }
  }
  nonIndexed.dispose();

  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  shell.computeVertexNormals();
  return shell;
}

/**
 * Push every vertex out along its area-weighted normal.
 *
 * The landmark mesh traces a surface a millimetre or two inside the skin, and
 * a temple resting against the cheek sits close enough that the difference
 * decides whether it is culled. Inflating is cheaper and steadier than trying
 * to bias the depth test.
 */
function inflate(positions: Float32Array, index: ArrayLike<number>, amount: number): void {
  if (amount <= 0) return;
  const count = positions.length / 3;
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3;
    const b = index[i + 1] * 3;
    const c = index[i + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) {
      normals[o] += nx;
      normals[o + 1] += ny;
      normals[o + 2] += nz;
    }
  }

  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const l = Math.hypot(normals[o], normals[o + 1], normals[o + 2]);
    if (l < 1e-9) continue;
    positions[o] += (normals[o] / l) * amount;
    positions[o + 1] += (normals[o + 1] / l) * amount;
    positions[o + 2] += (normals[o + 2] / l) * amount;
  }
}
