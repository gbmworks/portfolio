/**
 * Turns a shape selection into geometry.
 *
 * The front and the lens are driven from the *same* selection and the same
 * key name, always. They carry identical shape-key sets in the source file,
 * and a lens that does not follow its rim is not a design option.
 *
 * Results are cached per selection: switching back and forth round the wheel
 * is the most likely thing a customer will do, and re-baking a 13k-vertex
 * front every time would make the wheel feel sticky.
 */

import * as THREE from 'three';

import { TEMPLE_PARTS, type LoadedFrame, type PartKey } from './loadFrame';
import { bakeShape } from './loadFrame';
import type { MorphWeight } from './loadFrame';
import {
  BRIDGE_OPTIONS,
  TEMPLE_DESIGNS,
  resolveMorphName,
  shapeBlend,
  type BridgeOption,
  type TempleDesign,
} from './shapes';

export interface ShapeSelection {
  /** Position on the wheel, degrees. Continuous, so shapes can be blended. */
  frontAngle: number;
  bridge: string;
  temple: string;
}

export interface ResolvedFrame {
  parts: Partial<Record<PartKey, THREE.BufferGeometry>>;
  /** Which requested shape keys were actually found in the file. */
  applied: string[];
  /** Requested but absent -- the reason a shape can look like it did nothing. */
  missing: string[];
}

const cache = new Map<string, ResolvedFrame>();

export function resolveShape(frame: LoadedFrame, selection: ShapeSelection): ResolvedFrame {
  // Quantised to a quarter of a percent so a drag reuses bakes instead of
  // allocating a fresh geometry for every pointer event.
  const blend = shapeBlend(selection.frontAngle);
  const quantised = Math.round(blend.t * 400) / 400;
  const key = `${blend.from.id}>${blend.to.id}@${quantised}|${selection.bridge}|${selection.temple}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const bridge: BridgeOption =
    BRIDGE_OPTIONS.find((b) => b.id === selection.bridge) ?? BRIDGE_OPTIONS[0];

  const applied: string[] = [];
  const missing: string[] = [];
  const parts: Partial<Record<PartKey, THREE.BufferGeometry>> = { ...frame.parts };

  // Front and lens: the same blend, both parts, always.
  //
  // Two weights rather than one: at a position between nodes the frame really
  // is part one shape and part the other, and the basis (`morph: null`)
  // contributes by simply taking no weight.
  const pairs: { morph: string | null; weight: number }[] = [
    { morph: blend.from.morph, weight: 1 - quantised },
    { morph: blend.to.morph, weight: quantised },
  ];

  for (const part of ['front', 'lens'] as const) {
    const geometry = frame.parts[part];
    if (!geometry) continue;
    const weights: MorphWeight[] = [];
    for (const { morph, weight } of pairs) {
      if (!morph || weight <= 1e-4) continue;
      const index = resolveMorphName(frame.morphs[part], morph);
      if (index === null) {
        if (!missing.includes(morph)) missing.push(morph);
        continue;
      }
      weights.push({ index, weight });
      if (!applied.includes(morph)) applied.push(morph);
    }
    if (weights.length > 0) parts[part] = bakeShape(geometry, weights);
  }

  // Bridge: profile and shape are independent keys, applied together.
  const bridgeGeometry = frame.parts.bridge;
  if (bridgeGeometry) {
    const weights: MorphWeight[] = [];
    for (const name of bridge.morphs) {
      if (!name) continue;
      const index = resolveMorphName(frame.morphs.bridge, name);
      if (index === null) {
        if (!missing.includes(name)) missing.push(name);
        continue;
      }
      weights.push({ index, weight: 1 });
      if (!applied.includes(name)) applied.push(name);
    }
    if (weights.length > 0) parts.bridge = bakeShape(bridgeGeometry, weights);
  }

  // Temple: one key at full weight across all four arm pieces.
  //
  // Unlike the front there is nothing to blend -- these are four separate
  // designs, not positions on a wheel -- so a missing key is a real fault
  // rather than a weight rounding to zero, and it is recorded as such.
  const design: TempleDesign =
    TEMPLE_DESIGNS.find((d) => d.id === selection.temple) ?? TEMPLE_DESIGNS[0];
  if (design.morph) {
    for (const part of TEMPLE_PARTS) {
      const geometry = frame.parts[part];
      if (!geometry) continue;
      const index = resolveMorphName(frame.morphs[part], design.morph);
      if (index === null) {
        if (!missing.includes(design.morph)) missing.push(design.morph);
        continue;
      }
      parts[part] = bakeShape(geometry, [{ index, weight: 1 }]);
      if (!applied.includes(design.morph)) applied.push(design.morph);
    }
  }

  alignBridge(frame, parts);

  const resolved: ResolvedFrame = { parts, applied, missing };
  // Bounded: a single drag sweeps through hundreds of distinct blends, and
  // each one holds a full copy of the front and the lens.
  if (cache.size > 64) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, resolved);
  return resolved;
}

/** Drop cached bakes, e.g. when a different frame file is loaded. */
export function clearShapeCache(): void {
  cache.clear();
}


/** Half-width of the column sampled either side of the midline, mm. */
const NOSE_COLUMN = 14;

/**
 * Where the front's nose cut-out sits: its top edge and how far forward it
 * comes, measured down the midline.
 */
function noseColumn(geometry: THREE.BufferGeometry): { top: number; front: number } {
  const position = geometry.getAttribute('position');
  let top = -Infinity;
  let front = -Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getX(i)) > NOSE_COLUMN) continue;
    top = Math.max(top, position.getY(i));
    front = Math.max(front, position.getZ(i));
  }
  return { top, front };
}

/**
 * Move the bridge to follow the front it is attached to.
 *
 * The bridge carries its own four shape keys but knows nothing about the
 * eight the front has, so it sits at one fixed height while the nose cut-out
 * moves underneath it -- the top edge of that cut-out runs from 4.2 mm on the
 * cat-eye to 8.3 mm on the oval. Left alone the bridge floats clear of the
 * rims on one shape and buries itself in them on another.
 *
 * So it is re-anchored: whatever relationship it has to the cut-out on the
 * basis shape is the relationship it keeps on all of them. The depth is
 * corrected the same way -- the authored bridge stands about 1.6 mm proud of
 * the front's face, which reads as a part stuck on rather than built in.
 *
 * The geometry is cloned before moving. `parts.bridge` is the *shared*
 * original whenever no bridge morph is applied, and translating that would
 * shift the bridge again on every shape change until it left the frame
 * entirely.
 */
function alignBridge(
  frame: LoadedFrame,
  parts: Partial<Record<PartKey, THREE.BufferGeometry>>,
): void {
  const bridge = parts.bridge;
  const front = parts.front;
  const basisFront = frame.parts.front;
  if (!bridge || !front || !basisFront) return;

  const basis = noseColumn(basisFront);
  const shape = noseColumn(front);
  if (!Number.isFinite(basis.top) || !Number.isFinite(shape.top)) return;

  // Depth: measured on this shape, so a morph that changes the front's
  // curvature is followed too.
  const position = bridge.getAttribute('position');
  let bridgeFront = -Infinity;
  for (let i = 0; i < position.count; i++) bridgeFront = Math.max(bridgeFront, position.getZ(i));

  const dy = shape.top - basis.top;
  const dz = shape.front - bridgeFront;
  if (Math.abs(dy) < 1e-4 && Math.abs(dz) < 1e-4) return;

  const moved = bridge.clone();
  moved.translate(0, dy, dz);
  moved.computeBoundingBox();
  moved.computeBoundingSphere();
  parts.bridge = moved;
}
