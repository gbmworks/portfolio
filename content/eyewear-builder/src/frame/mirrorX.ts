/**
 * The mirror modifier, applied at load: reflect a half-model across x = 0.
 *
 * The glTF export is authored as a right half only -- every part has zero
 * vertices on the negative side -- so without this the customer gets half a
 * pair of glasses. (The earlier FBX had the mirror baked in already, which is
 * why this is conditional rather than unconditional: applying it twice would
 * lay a second copy exactly on top of the first and z-fight.)
 *
 * Three things have to be reflected together, and missing any one of them is
 * a distinct and confusing bug:
 *
 *  - **Positions**, by negating x.
 *  - **Winding**, by reversing each mirrored triangle. A reflection flips
 *    handedness, so copying the index order leaves every mirrored face
 *    pointing inward -- invisible head-on with back-face culling, obvious the
 *    moment the frame turns.
 *  - **Normals**, by negating x. Reflecting the positions alone leaves the
 *    mirrored half lit from the wrong side.
 *  - **UVs**, copied unchanged. A texture coordinate has no handedness, so the
 *    mirrored half samples the same patch of the sheet as the half it came
 *    from -- which is what a mirror modifier does, and what an acetate front
 *    cut from one sheet looks like.
 *
 * And morph targets, which are per-vertex and must stay index-aligned with the
 * positions they deform. Appending vertices without appending their deltas is
 * what makes a morph read past the end of its target and produce NaN.
 */

import * as THREE from 'three';

/** A part with vertices on only one side of the midline needs mirroring. */
export function needsMirror(geometry: THREE.BufferGeometry, tolerance = 1e-5): boolean {
  const position = geometry.getAttribute('position');
  if (!position) return false;
  let left = 0;
  let right = 0;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    if (x < -tolerance) left++;
    else if (x > tolerance) right++;
  }
  return left === 0 || right === 0;
}

export function mirrorX(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const count = position.count;

  const out = new THREE.BufferGeometry();
  out.morphTargetsRelative = geometry.morphTargetsRelative;

  out.setAttribute('position', new THREE.BufferAttribute(reflect(position, count), 3));
  if (normal) out.setAttribute('normal', new THREE.BufferAttribute(reflect(normal, count), 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(duplicate(uv, count), 2));

  // Morph targets are deltas or positions in the same space, so they reflect
  // exactly like the attribute they drive.
  const targets = geometry.morphAttributes.position;
  if (targets && targets.length > 0) {
    out.morphAttributes.position = targets.map(
      (t) => new THREE.BufferAttribute(reflect(t as THREE.BufferAttribute, count), 3),
    );
  }

  const index = geometry.index;
  if (index) {
    const source = index.array;
    const merged = new Uint32Array(source.length * 2);
    merged.set(source, 0);
    for (let i = 0; i < source.length; i += 3) {
      // Reversed, and offset into the mirrored copy.
      merged[source.length + i] = source[i] + count;
      merged[source.length + i + 1] = source[i + 2] + count;
      merged[source.length + i + 2] = source[i + 1] + count;
    }
    out.setIndex(new THREE.BufferAttribute(merged, 1));
  } else {
    // Non-indexed: the winding lives in the vertex order, so build an index
    // rather than shuffling three parallel attribute arrays by hand.
    const merged = new Uint32Array(count * 2);
    for (let i = 0; i < count; i += 3) {
      merged[i] = i;
      merged[i + 1] = i + 1;
      merged[i + 2] = i + 2;
      merged[count + i] = count + i;
      merged[count + i + 1] = count + i + 2;
      merged[count + i + 2] = count + i + 1;
    }
    out.setIndex(new THREE.BufferAttribute(merged, 1));
  }

  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** `[original..., identical copy...]` for a 2-component attribute. */
function duplicate(attribute: THREE.BufferAttribute, count: number): Float32Array {
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const u = attribute.getX(i);
    const v = attribute.getY(i);
    out[i * 2] = u;
    out[i * 2 + 1] = v;
    out[(count + i) * 2] = u;
    out[(count + i) * 2 + 1] = v;
  }
  return out;
}

/** `[original..., x-negated copy...]` for a 3-component attribute. */
function reflect(attribute: THREE.BufferAttribute, count: number): Float32Array {
  const out = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const x = attribute.getX(i);
    const y = attribute.getY(i);
    const z = attribute.getZ(i);
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
    out[(count + i) * 3] = -x;
    out[(count + i) * 3 + 1] = y;
    out[(count + i) * 3 + 2] = z;
  }
  return out;
}
