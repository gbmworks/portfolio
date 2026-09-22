/**
 * A development fixture: MediaPipe's own canonical face model, fed through the
 * real pipeline.
 *
 * The scan path needs a camera and a face in front of it, which makes it
 * awkward to check that the portrait, the measurements and the classifier are
 * behaving. The canonical model is the average face the landmarker itself is
 * fitted against, in centimetres, with vertices in landmark order -- so
 * running it through `headFrameFrom` -> `rectify` -> everything else exercises
 * the whole chain on known-good input.
 *
 * Only the 468 mesh points are in the file; the 10 iris points the refined
 * model adds are synthesised here from the eye contours, at the real iris
 * size, so the millimetre scale comes out on the same footing as a live scan.
 *
 * Dev only. Nothing in the app imports this.
 */

import { headFrameFrom, rectify, IRIS_DIAMETER_MM } from '../face/headFrame';
import { LEFT_EYE, RIGHT_EYE } from '../face/landmarks';

/** The model file is in centimetres. */
const CM_TO_MM = 10;

export async function canonicalRectified(
  url = `${import.meta.env.BASE_URL}tools/canonical_face_model.obj`,
): Promise<Float32Array> {
  const text = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.text();
  });

  const verts: number[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('v ')) continue;
    const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
    verts.push(x, y, z);
  }
  if (verts.length !== 468 * 3) {
    throw new Error(`expected 468 vertices, got ${verts.length / 3}`);
  }

  const points = new Float32Array(478 * 3);
  points.set(verts);
  addIris(points, RIGHT_EYE, 468);
  addIris(points, LEFT_EYE, 473);

  return rectify(points, headFrameFrom(points));
}

/**
 * Place one iris: centre on the eye contour's centroid, ring at the real iris
 * radius. Index order matches the refined model -- centre, then right, top,
 * left, bottom -- because `millimetresPerUnit` reads the horizontal pair.
 */
function addIris(points: Float32Array, contour: readonly number[], base: number): void {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const i of contour) {
    cx += points[i * 3];
    cy += points[i * 3 + 1];
    cz += points[i * 3 + 2];
  }
  cx /= contour.length;
  cy /= contour.length;
  cz /= contour.length;

  const r = IRIS_DIAMETER_MM / 2 / CM_TO_MM;
  const ring: Array<[number, number]> = [
    [r, 0],
    [0, r],
    [-r, 0],
    [0, -r],
  ];

  points[base * 3] = cx;
  points[base * 3 + 1] = cy;
  points[base * 3 + 2] = cz;
  ring.forEach(([dx, dy], k) => {
    const i = base + 1 + k;
    points[i * 3] = cx + dx;
    points[i * 3 + 1] = cy + dy;
    points[i * 3 + 2] = cz;
  });
}
