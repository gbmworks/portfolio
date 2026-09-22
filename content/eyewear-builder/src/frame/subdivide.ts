/**
 * Loop subdivision, applied at load.
 *
 * The glTF carries the base cage -- 326 vertices for a frame front, where the
 * FBX of the same object had 13,464 -- so it renders visibly faceted. three
 * ships no subdivision modifier (`TessellateModifier` splits triangles without
 * smoothing anything), so this is the surface.
 *
 * **Morph targets go through the same mill.** That is the whole reason this is
 * written by hand rather than pulled off the shelf: every rule below is an
 * *affine* combination -- the weights in each one sum to exactly 1 -- so
 * subdividing is a linear map, and
 *
 *     subdivide(base + delta) === subdivide(base) + subdivide(delta)
 *
 * exactly. Running the identical weights over each target's deltas keeps the
 * eight shapes aligned with the surface they deform. Subdividing the base
 * alone would leave targets a few hundred vertices long against a mesh of
 * several thousand, and every vertex past the end would bake to NaN.
 *
 * Loop rather than Catmull-Clark because glTF delivers triangles: Catmull-
 * Clark is defined on quads and would need the original quad topology, which
 * the export has already thrown away.
 *
 * **UVs ride along, but under different rules.** Positions are welded by
 * position and smoothed by Loop's masks. Doing either to a UV would be wrong:
 * welding collapses the two sides of a seam onto one coordinate and smears
 * the texture across it, and Loop's masks would pull the parameterisation
 * inward and distort what the artist unwrapped. So UVs are carried as
 * *face-corner* data and subdivided linearly -- each new corner is the
 * midpoint of the two it sits between -- which reproduces the base cage's
 * mapping exactly at any level. Seams look after themselves: the two faces
 * either side of one hold different coordinates, so their midpoints differ
 * and they stay apart.
 */

import * as THREE from 'three';

/** Vertex data as parallel channels, all sharing one topology. */
interface Mesh {
  /** `channels[0]` is position; the rest are morph target deltas. */
  channels: Float32Array[];
  count: number;
  faces: Uint32Array;
}

export function subdivide(geometry: THREE.BufferGeometry, levels: number): THREE.BufferGeometry {
  if (levels < 1) return geometry;

  const source = geometry.index ? geometry : toIndexed(geometry);
  const uvAttribute = source.getAttribute('uv') as THREE.BufferAttribute | undefined;

  let mesh = weld(source);
  let faceUv = uvAttribute ? cornerUvs(source.index!, uvAttribute) : null;

  for (let i = 0; i < levels; i++) {
    if (faceUv) faceUv = subdivideUvOnce(faceUv, mesh.faces.length / 3);
    mesh = subdivideOnce(mesh);
  }

  const targets = geometry.morphAttributes.position;
  const targetCount = targets ? targets.length : 0;

  // Smooth normals are computed on the *welded* mesh, before any seam split
  // below. Computing them afterwards would average only the faces on one side
  // of each seam and draw a hard shading edge down every one of them -- a
  // texture seam is not a crease.
  const normals = weldedNormals(mesh);

  const out = new THREE.BufferGeometry();
  out.morphTargetsRelative = geometry.morphTargetsRelative;

  if (!faceUv) {
    out.setAttribute('position', new THREE.BufferAttribute(mesh.channels[0], 3));
    out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    out.setIndex(new THREE.BufferAttribute(mesh.faces, 1));
    if (targetCount > 0) {
      out.morphAttributes.position = Array.from(
        { length: targetCount },
        (_, i) => new THREE.BufferAttribute(mesh.channels[i + 1], 3),
      );
    }
  } else {
    const split = splitBySeam(mesh, normals, faceUv, targetCount);
    out.setAttribute('position', new THREE.BufferAttribute(split.position, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(split.normal, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(split.uv, 2));
    out.setIndex(new THREE.BufferAttribute(split.index, 1));
    if (targetCount > 0) {
      out.morphAttributes.position = split.targets.map(
        (data) => new THREE.BufferAttribute(data, 3),
      );
    }
  }

  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** UV per face corner, read through the index so seams stay distinct. */
function cornerUvs(index: THREE.BufferAttribute, uv: THREE.BufferAttribute): Float32Array {
  const out = new Float32Array(index.count * 2);
  for (let i = 0; i < index.count; i++) {
    const v = index.getX(i);
    out[i * 2] = uv.getX(v);
    out[i * 2 + 1] = uv.getY(v);
  }
  return out;
}

/**
 * One level of linear UV subdivision, in the corner order `subdivideOnce`
 * emits its four faces in.
 */
function subdivideUvOnce(faceUv: Float32Array, faceCount: number): Float32Array {
  const out = new Float32Array(faceCount * 4 * 3 * 2);
  for (let f = 0; f < faceCount; f++) {
    const a = f * 6;
    const au = faceUv[a];
    const av = faceUv[a + 1];
    const bu = faceUv[a + 2];
    const bv = faceUv[a + 3];
    const cu = faceUv[a + 4];
    const cv = faceUv[a + 5];

    const abu = (au + bu) / 2;
    const abv = (av + bv) / 2;
    const bcu = (bu + cu) / 2;
    const bcv = (bv + cv) / 2;
    const cau = (cu + au) / 2;
    const cav = (cv + av) / 2;

    // (a, ab, ca) (b, bc, ab) (c, ca, bc) (ab, bc, ca)
    out.set(
      [
        au, av, abu, abv, cau, cav,
        bu, bv, bcu, bcv, abu, abv,
        cu, cv, cau, cav, bcu, bcv,
        abu, abv, bcu, bcv, cau, cav,
      ],
      f * 24,
    );
  }
  return out;
}

/** Smooth normals over the welded topology, before any seam split. */
function weldedNormals(mesh: Mesh): Float32Array {
  const temporary = new THREE.BufferGeometry();
  temporary.setAttribute('position', new THREE.BufferAttribute(mesh.channels[0], 3));
  temporary.setIndex(new THREE.BufferAttribute(mesh.faces, 1));
  temporary.computeVertexNormals();
  return (temporary.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array;
}

/**
 * Re-split the welded mesh wherever one vertex carries two texture
 * coordinates, which is what a UV seam is.
 *
 * Everything but the UV is copied from the welded vertex, the smooth normal
 * included, so the split is invisible in the shading and shows up only in the
 * texture -- exactly where the artist put it.
 */
function splitBySeam(
  mesh: Mesh,
  normals: Float32Array,
  faceUv: Float32Array,
  targetCount: number,
): {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  index: Uint32Array;
  targets: Float32Array[];
} {
  const corners = mesh.faces.length;
  const index = new Uint32Array(corners);
  const seen = new Map<string, number>();
  const sourceVertex: number[] = [];
  const uvs: number[] = [];

  for (let c = 0; c < corners; c++) {
    const v = mesh.faces[c];
    const u = faceUv[c * 2];
    const w = faceUv[c * 2 + 1];
    // Quantised, so coordinates that differ only in float noise do not split.
    const key = `${v}|${Math.round(u * 1e5)}|${Math.round(w * 1e5)}`;
    let id = seen.get(key);
    if (id === undefined) {
      id = sourceVertex.length;
      seen.set(key, id);
      sourceVertex.push(v);
      uvs.push(u, w);
    }
    index[c] = id;
  }

  const count = sourceVertex.length;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const targets = Array.from({ length: targetCount }, () => new Float32Array(count * 3));

  for (let id = 0; id < count; id++) {
    const v = sourceVertex[id];
    for (let k = 0; k < 3; k++) {
      position[id * 3 + k] = mesh.channels[0][v * 3 + k];
      normal[id * 3 + k] = normals[v * 3 + k];
      for (let t = 0; t < targetCount; t++) {
        targets[t][id * 3 + k] = mesh.channels[t + 1][v * 3 + k];
      }
    }
  }

  return { position, normal, uv: Float32Array.from(uvs), index, targets };
}

/**
 * Merge vertices that share a position.
 *
 * Subdivision needs real topology, and an exported mesh is split at every
 * material, UV and normal seam. Left welded-apart, each island subdivides on
 * its own and the surface tears along every seam.
 */
function weld(source: THREE.BufferGeometry): Mesh {
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const targets = (source.morphAttributes.position ?? []) as THREE.BufferAttribute[];
  const index = source.index!;

  const remap = new Uint32Array(position.count);
  const lookup = new Map<string, number>();
  const unique: number[] = [];

  for (let i = 0; i < position.count; i++) {
    const key =
      `${Math.round(position.getX(i) * 1e5)},` +
      `${Math.round(position.getY(i) * 1e5)},` +
      `${Math.round(position.getZ(i) * 1e5)}`;
    const hit = lookup.get(key);
    if (hit === undefined) {
      const id = unique.length;
      lookup.set(key, id);
      unique.push(i);
      remap[i] = id;
    } else {
      remap[i] = hit;
    }
  }

  const count = unique.length;
  const channels: Float32Array[] = [];
  for (const attribute of [position, ...targets]) {
    const data = new Float32Array(count * 3);
    for (let id = 0; id < count; id++) {
      const src = unique[id];
      data[id * 3] = attribute.getX(src);
      data[id * 3 + 1] = attribute.getY(src);
      data[id * 3 + 2] = attribute.getZ(src);
    }
    channels.push(data);
  }

  const faces = new Uint32Array(index.count);
  for (let i = 0; i < index.count; i++) faces[i] = remap[index.getX(i)];

  return { channels, count, faces };
}

function subdivideOnce(mesh: Mesh): Mesh {
  const { channels, count, faces } = mesh;
  const faceCount = faces.length / 3;

  // --- edges, and which faces meet along them -----------------------------
  const edgeId = new Map<number, number>();
  const edgeV0: number[] = [];
  const edgeV1: number[] = [];
  const edgeOpposite: number[][] = [];

  const key = (a: number, b: number) => (a < b ? a * count + b : b * count + a);

  const findOrAddEdge = (a: number, b: number, opposite: number): number => {
    const k = key(a, b);
    let id = edgeId.get(k);
    if (id === undefined) {
      id = edgeV0.length;
      edgeId.set(k, id);
      edgeV0.push(a);
      edgeV1.push(b);
      edgeOpposite.push([]);
    }
    edgeOpposite[id].push(opposite);
    return id;
  };

  const faceEdges = new Uint32Array(faceCount * 3);
  for (let f = 0; f < faceCount; f++) {
    const a = faces[f * 3];
    const b = faces[f * 3 + 1];
    const c = faces[f * 3 + 2];
    faceEdges[f * 3] = findOrAddEdge(a, b, c);
    faceEdges[f * 3 + 1] = findOrAddEdge(b, c, a);
    faceEdges[f * 3 + 2] = findOrAddEdge(c, a, b);
  }

  const edgeCount = edgeV0.length;

  // --- neighbours, and which vertices sit on a boundary --------------------
  const neighbours: number[][] = Array.from({ length: count }, () => []);
  const boundaryNeighbours: number[][] = Array.from({ length: count }, () => []);

  for (let e = 0; e < edgeCount; e++) {
    const v0 = edgeV0[e];
    const v1 = edgeV1[e];
    neighbours[v0].push(v1);
    neighbours[v1].push(v0);
    // One adjacent face means an open edge.
    if (edgeOpposite[e].length === 1) {
      boundaryNeighbours[v0].push(v1);
      boundaryNeighbours[v1].push(v0);
    }
  }

  const newCount = count + edgeCount;
  const newChannels = channels.map(() => new Float32Array(newCount * 3));

  // --- edge points ---------------------------------------------------------
  for (let e = 0; e < edgeCount; e++) {
    const v0 = edgeV0[e];
    const v1 = edgeV1[e];
    const opposite = edgeOpposite[e];
    const target = (count + e) * 3;

    for (let c = 0; c < channels.length; c++) {
      const src = channels[c];
      const dst = newChannels[c];
      if (opposite.length >= 2) {
        const o0 = opposite[0] * 3;
        const o1 = opposite[1] * 3;
        for (let k = 0; k < 3; k++) {
          dst[target + k] =
            0.375 * (src[v0 * 3 + k] + src[v1 * 3 + k]) + 0.125 * (src[o0 + k] + src[o1 + k]);
        }
      } else {
        // Boundary: the midpoint, so the outline does not creep inward.
        for (let k = 0; k < 3; k++) {
          dst[target + k] = 0.5 * (src[v0 * 3 + k] + src[v1 * 3 + k]);
        }
      }
    }
  }

  // --- repositioned original vertices --------------------------------------
  for (let v = 0; v < count; v++) {
    const onBoundary = boundaryNeighbours[v].length >= 2;
    const ring = neighbours[v];
    const valence = ring.length;

    for (let c = 0; c < channels.length; c++) {
      const src = channels[c];
      const dst = newChannels[c];

      if (onBoundary) {
        const a = boundaryNeighbours[v][0] * 3;
        const b = boundaryNeighbours[v][1] * 3;
        for (let k = 0; k < 3; k++) {
          dst[v * 3 + k] = 0.75 * src[v * 3 + k] + 0.125 * (src[a + k] + src[b + k]);
        }
        continue;
      }

      if (valence === 0) {
        for (let k = 0; k < 3; k++) dst[v * 3 + k] = src[v * 3 + k];
        continue;
      }

      // Loop's weight for an interior vertex of this valence.
      const t = 0.375 + 0.25 * Math.cos((2 * Math.PI) / valence);
      const beta = (1 / valence) * (0.625 - t * t);

      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const n of ring) sum += src[n * 3 + k];
        dst[v * 3 + k] = src[v * 3 + k] * (1 - valence * beta) + beta * sum;
      }
    }
  }

  // --- four faces from each one --------------------------------------------
  const newFaces = new Uint32Array(faceCount * 12);
  for (let f = 0; f < faceCount; f++) {
    const a = faces[f * 3];
    const b = faces[f * 3 + 1];
    const c = faces[f * 3 + 2];
    const ab = count + faceEdges[f * 3];
    const bc = count + faceEdges[f * 3 + 1];
    const ca = count + faceEdges[f * 3 + 2];
    const o = f * 12;
    newFaces.set([a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca], o);
  }

  return { channels: newChannels, count: newCount, faces: newFaces };
}

/** Give a non-indexed geometry a trivial index so `weld` has one to remap. */
function toIndexed(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const clone = geometry.clone();
  const count = clone.getAttribute('position').count;
  const index = new Uint32Array(count);
  for (let i = 0; i < count; i++) index[i] = i;
  clone.setIndex(new THREE.BufferAttribute(index, 1));
  return clone;
}
