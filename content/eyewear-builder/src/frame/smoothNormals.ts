/**
 * Angle-thresholded smooth shading.
 *
 * The loader used to end with `computeVertexNormals()` on every part. On a
 * non-indexed mesh -- which is what FBXLoader hands back -- that computes one
 * normal per triangle corner from that triangle alone, so every face gets a
 * constant normal and the whole frame renders faceted. It also threw away the
 * normals the exporter had authored.
 *
 * This welds vertices by position, then averages the face normals meeting at
 * each welded point, but only across pairs of faces whose angle is below a
 * threshold. That is the same rule as an "auto smooth" modifier: the rim reads
 * as a continuous curve while the bevels and the lens groove keep their crisp
 * edges. Smoothing everything unconditionally turns those into mush.
 */

import * as THREE from 'three';

/** Faces meeting at a shallower angle than this are blended. */
const DEFAULT_ANGLE_DEGREES = 52;

export function smoothNormals(
  geometry: THREE.BufferGeometry,
  angleDegrees = DEFAULT_ANGLE_DEGREES,
): void {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const count = position.count;
  if (count === 0 || count % 3 !== 0) return;

  const faces = count / 3;
  const faceNormals = new Float32Array(faces * 3);

  // Face normals, left unnormalised so their length weights the average by
  // triangle area -- a sliver should not pull a normal as hard as a big face.
  const ax = new THREE.Vector3();
  const bx = new THREE.Vector3();
  const cx = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let f = 0; f < faces; f++) {
    ax.fromBufferAttribute(position, f * 3);
    bx.fromBufferAttribute(position, f * 3 + 1);
    cx.fromBufferAttribute(position, f * 3 + 2);
    e1.subVectors(bx, ax);
    e2.subVectors(cx, ax);
    n.crossVectors(e1, e2);
    faceNormals[f * 3] = n.x;
    faceNormals[f * 3 + 1] = n.y;
    faceNormals[f * 3 + 2] = n.z;
  }

  // Weld by quantised position. The tolerance has to be tight enough not to
  // fuse the two sides of a thin rim: a thousandth of a millimetre is far
  // below any real feature and still absorbs float error from the transforms.
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const key =
      `${Math.round(position.getX(i) * 1000)},` +
      `${Math.round(position.getY(i) * 1000)},` +
      `${Math.round(position.getZ(i) * 1000)}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  const cosLimit = Math.cos((angleDegrees * Math.PI) / 180);
  const normals = new Float32Array(count * 3);
  const own = new THREE.Vector3();
  const other = new THREE.Vector3();
  const sum = new THREE.Vector3();

  for (const shared of buckets.values()) {
    for (const i of shared) {
      const face = Math.floor(i / 3);
      own.set(faceNormals[face * 3], faceNormals[face * 3 + 1], faceNormals[face * 3 + 2]);
      const ownLength = own.length() || 1;
      sum.set(0, 0, 0);

      for (const j of shared) {
        const otherFace = Math.floor(j / 3);
        other.set(
          faceNormals[otherFace * 3],
          faceNormals[otherFace * 3 + 1],
          faceNormals[otherFace * 3 + 2],
        );
        const otherLength = other.length() || 1;
        // Compare directions, add the area-weighted vector.
        if (own.dot(other) / (ownLength * otherLength) >= cosLimit) sum.add(other);
      }

      if (sum.lengthSq() < 1e-12) sum.copy(own);
      sum.normalize();
      normals[i * 3] = sum.x;
      normals[i * 3 + 1] = sum.y;
      normals[i * 3 + 2] = sum.z;
    }
  }

  if (source !== geometry) {
    // toNonIndexed() produced a copy, so move *all* of its attributes over,
    // not just the positions. Copying position alone leaves every other
    // attribute at the old indexed length -- and a UV array shorter than the
    // positions it belongs to samples a texture from nonsense, which is how
    // the tortoise map ended up scrambled on every morphed shape.
    geometry.setIndex(null);
    for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
    for (const [name, attribute] of Object.entries(source.attributes)) {
      geometry.setAttribute(name, attribute);
    }
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.attributes.normal.needsUpdate = true;
}

/**
 * Average normals across vertices that share a position.
 *
 * A UV seam splits one vertex into two so each side can hold its own texture
 * coordinate. That is right for the texture and wrong for the shading:
 * `computeVertexNormals` then averages only the faces on one side of the
 * seam, and the surface picks up a crease that is not in the model. This puts
 * the shading back together without touching the split.
 */
export function weldNormals(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (!position || !normal) return;

  const groups = new Map<string, number[]>();
  for (let i = 0; i < position.count; i++) {
    const key =
      `${Math.round(position.getX(i) * 1e4)},` +
      `${Math.round(position.getY(i) * 1e4)},` +
      `${Math.round(position.getZ(i) * 1e4)}`;
    const hit = groups.get(key);
    if (hit) hit.push(i);
    else groups.set(key, [i]);
  }

  for (const members of groups.values()) {
    if (members.length < 2) continue;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const i of members) {
      x += normal.getX(i);
      y += normal.getY(i);
      z += normal.getZ(i);
    }
    const length = Math.hypot(x, y, z);
    if (length < 1e-8) continue;
    x /= length;
    y /= length;
    z /= length;
    for (const i of members) normal.setXYZ(i, x, y, z);
  }
  normal.needsUpdate = true;
}
