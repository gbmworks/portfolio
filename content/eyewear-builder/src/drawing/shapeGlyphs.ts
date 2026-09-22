/**
 * The geometric badge that sits beside each portrait, as in the reference art:
 * an oval, a square, a heart and so on, one per face shape.
 *
 * Each is a path on a 0..100 box so they can be dropped into any size of svg.
 */

import type { FaceShapeId } from '../face/faceShape';

export const SHAPE_GLYPHS: Record<FaceShapeId, string> = {
  oval: 'M 50 4 C 74 4 88 24 88 50 C 88 76 74 96 50 96 C 26 96 12 76 12 50 C 12 24 26 4 50 4 Z',
  round: 'M 50 6 A 44 44 0 1 1 49.9 6 Z',
  square: 'M 14 14 H 86 V 86 H 14 Z',
  rectangle: 'M 24 6 H 76 V 94 H 24 Z',
  heart:
    'M 50 92 C 22 72 8 55 8 36 C 8 21 19 10 33 10 C 41 10 47 14 50 20 ' +
    'C 53 14 59 10 67 10 C 81 10 92 21 92 36 C 92 55 78 72 50 92 Z',
  diamond: 'M 50 5 L 92 50 L 50 95 L 8 50 Z',
  triangle: 'M 50 10 L 93 88 H 7 Z',
  invertedTriangle: 'M 7 12 H 93 L 50 90 Z',
};
