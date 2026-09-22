/**
 * Shape icons, traced from the real front mesh.
 *
 * Each icon is the actual silhouette of that shape's geometry, through the
 * same offscreen-render-plus-marching-squares path the portrait overlay used.
 * Hand-drawn glyphs were the first attempt and they were guesses: they had to
 * be redrawn whenever a shape key changed, and they never quite agreed with
 * what selecting them produced.
 *
 * Tracing costs about eight renders and readbacks, once per frame file. That
 * is a few hundred milliseconds on load, paid once and cached, against an icon
 * that is correct by construction.
 *
 * All eight share one viewBox, computed across the whole set, so the relative
 * proportions survive -- an Aviator really does read as deeper than a
 * Rectangle, because it is.
 */

import type { LoadedFrame } from './loadFrame';
import { resolveShape } from './resolveShape';
import {
  DEFAULT_TEMPLE_DESIGN,
  FRONT_SHAPES,
  angleOf,
  type FrontShapeId,
} from './shapes';
import { traceSilhouette } from './silhouette';

export interface ShapeIconSet {
  viewBox: string;
  /** SVG path data, in the shared viewBox's coordinates. */
  paths: Record<FrontShapeId, string>;
}

const cache = new Map<LoadedFrame, ShapeIconSet | null>();

export function buildShapeIcons(frame: LoadedFrame, bridge: string): ShapeIconSet | null {
  const hit = cache.get(frame);
  if (hit !== undefined) return hit;

  try {
    const paths = {} as Record<FrontShapeId, string>;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const shape of FRONT_SHAPES) {
      // The icons trace the front only, so the arm design is irrelevant to
      // them -- pinned to the default so a temple change cannot invalidate
      // the icon cache and re-trace all eight silhouettes for no visible
      // difference.
      const resolved = resolveShape(frame, {
        frontAngle: angleOf(shape.id),
        bridge,
        temple: DEFAULT_TEMPLE_DESIGN,
      });
      const front = resolved.parts.front;
      if (!front) continue;

      // The front alone. Including the lens fills the apertures in, and the
      // apertures are most of what tells the shapes apart.
      const traced = traceSilhouette([front]);
      paths[shape.id] = traced.outline;

      for (const [x, y] of pairs(traced.outline)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (!Number.isFinite(minX) || Object.keys(paths).length === 0) {
      cache.set(frame, null);
      return null;
    }

    const pad = (maxX - minX) * 0.04;
    const set: ShapeIconSet = {
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
      paths,
    };
    cache.set(frame, set);
    return set;
  } catch (error) {
    console.warn('[icons] could not trace the shape set', error);
    cache.set(frame, null);
    return null;
  }
}

/** Coordinate pairs out of path data, for measuring the shared box. */
function* pairs(path: string): Generator<[number, number]> {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers) return;
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    yield [Number(numbers[i]), Number(numbers[i + 1])];
  }
}
