/**
 * Front-view silhouette of the eyewear, as an SVG path in millimetres.
 *
 * This is what gets laid over the portrait while the customer edits the frame,
 * so it has to update at interactive rates and it has to be in the same
 * millimetre space the drawing uses.
 *
 * Approach: render the geometry once through an orthographic camera into a
 * small offscreen target, then trace the resulting mask with marching squares.
 * The alternative -- projecting the mesh and computing a true outline from
 * silhouette edges -- is exact but costs a pass over every triangle and needs
 * adjacency data, and at the line weight this is drawn at the difference is
 * invisible. A 512 px mask traces in about two milliseconds.
 *
 * The renderer is shared and created lazily, so opening the app without ever
 * looking at a frame costs no WebGL context.
 */

import * as THREE from 'three';

const RESOLUTION = 512;
/** Mask cells below this coverage are outside the shape. */
const THRESHOLD = 0.5;

let renderer: THREE.WebGLRenderer | null = null;
let target: THREE.WebGLRenderTarget | null = null;

function getRenderer(): { renderer: THREE.WebGLRenderer; target: THREE.WebGLRenderTarget } {
  if (!renderer || !target) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(RESOLUTION, RESOLUTION, false);
    target = new THREE.WebGLRenderTarget(RESOLUTION, RESOLUTION, {
      // The mask is read back on the CPU, so there is no point paying for a
      // depth buffer or mipmaps.
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
  }
  return { renderer, target };
}

export interface Silhouette {
  /** Outer contours, as SVG path data in mm, origin at the bridge centre. */
  outline: string;
  /** Overall width and height of the rendered parts, mm. */
  width: number;
  height: number;
}

/**
 * Trace the front-on silhouette of any set of geometries.
 *
 * Shared by the eyewear overlay and the face portrait, which is the point: a
 * silhouette is a silhouette, and the face has exactly the same problem the
 * frame does -- a dense mesh whose *outline* is wanted, not its surface.
 *
 * Coordinates pass straight through, so whatever space the geometries are in
 * is the space the path comes back in, with y flipped for SVG. Build the
 * geometry in the destination space and no mapping is needed afterwards.
 */
export function traceSilhouette(geometries: THREE.BufferGeometry[]): Silhouette {
  const { renderer: gl, target: rt } = getRenderer();

  const scene = new THREE.Scene();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const box = new THREE.Box3();

  for (const geometry of geometries) {
    scene.add(new THREE.Mesh(geometry, material));
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
  }
  if (box.isEmpty()) return { outline: '', width: 0, height: 0 };

  // Pad so the shape never touches the mask edge: marching squares needs a
  // ring of empty cells around the contour to close it.
  const size = new THREE.Vector3();
  box.getSize(size);
  const extent = Math.max(size.x, size.y) * 0.56;
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  const camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.1, 100000);
  camera.position.set(centre.x, centre.y, box.max.z + 1000);
  camera.lookAt(centre.x, centre.y, centre.z);

  const previousTarget = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  gl.setClearColor(0x000000, 0);
  gl.clear(true, true, false);
  gl.render(scene, camera);

  const pixels = new Uint8Array(RESOLUTION * RESOLUTION * 4);
  gl.readRenderTargetPixels(rt, 0, 0, RESOLUTION, RESOLUTION, pixels);
  gl.setRenderTarget(previousTarget);
  material.dispose();

  // Alpha channel into a scalar field. readRenderTargetPixels returns rows
  // bottom-up, and the mm space here is y-up too, so no flip is needed until
  // the path is emitted.
  const field = new Float32Array(RESOLUTION * RESOLUTION);
  for (let i = 0; i < field.length; i++) field[i] = pixels[i * 4 + 3] / 255;

  const mmPerCell = (extent * 2) / RESOLUTION;
  const contours = marchingSquares(field, RESOLUTION, RESOLUTION, THRESHOLD);

  let outline = '';
  for (const contour of contours) {
    if (contour.length < 12) continue; // speckle
    let d = '';
    for (let i = 0; i < contour.length; i++) {
      const [cx, cy] = contour[i];
      // Cell space -> mm, then y down for SVG.
      const x = centre.x - extent + cx * mmPerCell;
      const y = -(centre.y - extent + cy * mmPerCell);
      d += `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)} `;
    }
    outline += `${d}Z `;
  }

  return { outline: outline.trim(), width: size.x, height: size.y };
}

/**
 * Marching squares over a scalar field, returning closed contours in cell
 * coordinates.
 *
 * Implemented as edge-segment extraction plus a stitching pass rather than the
 * usual "walk the boundary" march, because an eyewear front is multiply
 * connected -- there are two lens apertures inside the outer rim -- and a
 * single walk only ever finds one loop.
 */
function marchingSquares(
  field: Float32Array,
  width: number,
  height: number,
  threshold: number,
): Array<Array<[number, number]>> {
  type Seg = [number, number, number, number];
  const segments: Seg[] = [];

  const value = (x: number, y: number) => field[y * width + x];
  // Linear interpolation along a cell edge puts the vertex where the field
  // actually crosses the threshold, which is what keeps the traced outline
  // smooth instead of stair-stepped at this resolution.
  const lerp = (a: number, b: number) => {
    const d = b - a;
    return Math.abs(d) < 1e-6 ? 0.5 : (threshold - a) / d;
  };

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = value(x, y + 1);
      const tr = value(x + 1, y + 1);
      const br = value(x + 1, y);
      const bl = value(x, y);

      let code = 0;
      if (tl > threshold) code |= 8;
      if (tr > threshold) code |= 4;
      if (br > threshold) code |= 2;
      if (bl > threshold) code |= 1;
      if (code === 0 || code === 15) continue;

      const top: [number, number] = [x + lerp(tl, tr), y + 1];
      const right: [number, number] = [x + 1, y + lerp(br, tr)];
      const bottom: [number, number] = [x + lerp(bl, br), y];
      const left: [number, number] = [x, y + lerp(bl, tl)];

      const push = (a: [number, number], b: [number, number]) =>
        segments.push([a[0], a[1], b[0], b[1]]);

      switch (code) {
        case 1: push(left, bottom); break;
        case 2: push(bottom, right); break;
        case 3: push(left, right); break;
        case 4: push(right, top); break;
        case 5: push(left, top); push(bottom, right); break;
        case 6: push(bottom, top); break;
        case 7: push(left, top); break;
        case 8: push(top, left); break;
        case 9: push(top, bottom); break;
        case 10: push(top, right); push(bottom, left); break;
        case 11: push(top, right); break;
        case 12: push(right, left); break;
        case 13: push(right, bottom); break;
        case 14: push(bottom, left); break;
      }
    }
  }

  // Stitch segments end-to-end. Endpoints are snapped to a grid finer than a
  // cell so floating point does not break a join that is geometrically exact.
  const key = (x: number, y: number) => `${Math.round(x * 64)},${Math.round(y * 64)}`;
  const starts = new Map<string, Seg[]>();
  for (const s of segments) {
    const k = key(s[0], s[1]);
    const list = starts.get(k);
    if (list) list.push(s);
    else starts.set(k, [s]);
  }

  const used = new Set<Seg>();
  const contours: Array<Array<[number, number]>> = [];

  for (const seed of segments) {
    if (used.has(seed)) continue;
    const contour: Array<[number, number]> = [[seed[0], seed[1]]];
    let current = seed;
    used.add(current);

    for (let guard = 0; guard < segments.length; guard++) {
      contour.push([current[2], current[3]]);
      const candidates = starts.get(key(current[2], current[3]));
      const next = candidates?.find((s) => !used.has(s));
      if (!next) break;
      used.add(next);
      current = next;
      if (key(current[0], current[1]) === key(seed[0], seed[1])) break;
    }
    // Smooth before simplifying, not after. Marching squares on a rasterised
    // mask leaves single-cell stair steps on any edge that is nearly axis
    // aligned -- and the top rim of a frame is exactly that. Simplifying first
    // just locks the steps in as real corners.
    if (contour.length > 3) contours.push(simplify(chaikin(contour, 2), 0.18));
  }

  return contours;
}

/**
 * Chaikin corner cutting on a closed contour.
 *
 * Each pass replaces every vertex with two points a quarter and three
 * quarters along its edges, which halves the amplitude of a one-cell step per
 * pass while leaving genuine corners -- which span many cells -- essentially
 * where they were. Two passes is enough to clear the raster steps.
 */
function chaikin(points: Array<[number, number]>, passes: number): Array<[number, number]> {
  let current = points;
  for (let p = 0; p < passes; p++) {
    const next: Array<[number, number]> = [];
    const n = current.length;
    for (let i = 0; i < n; i++) {
      const a = current[i];
      const b = current[(i + 1) % n];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    current = next;
  }
  return current;
}

/** Ramer-Douglas-Peucker, iterative. Cuts the point count by roughly 20x. */
function simplify(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let index = -1;
    let maxDist = epsilon;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicular(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function perpendicular(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / l;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Release the offscreen context, e.g. when the tab is hidden for good. */
export function disposeSilhouette(): void {
  target?.dispose();
  renderer?.dispose();
  target = null;
  renderer = null;
}
