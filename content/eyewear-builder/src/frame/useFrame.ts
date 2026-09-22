/**
 * Loads the placeholder frame once and keeps its silhouette in step with the
 * customisation.
 *
 * The silhouette is recomputed only when something that changes the *shape*
 * changes. Fit and colour do not: fit is an SVG transform applied to the path
 * that already exists, and colour never touched the mask. Re-tracing on every
 * slider tick would be the obvious way to write this and would burn a
 * render-target readback per frame for no visible difference.
 */

import { useEffect, useMemo, useState } from 'react';

import { useStore } from '../state/store';
import { loadFrame, type LoadedFrame } from './loadFrame';
import { resolveShape, type ResolvedFrame } from './resolveShape';
import { buildShapeIcons, type ShapeIconSet } from './shapeIcons';

const FRAME_URL = `${import.meta.env.BASE_URL}frames/final.glb`;

interface FrameState {
  frame: LoadedFrame | null;
  error: string | null;
  loading: boolean;
}

let cached: FrameState | null = null;
const listeners = new Set<(s: FrameState) => void>();

function publish(next: FrameState): void {
  cached = next;
  for (const listener of listeners) listener(next);
}

export function useFrame(): FrameState {
  const [state, setState] = useState<FrameState>(
    cached ?? { frame: null, error: null, loading: true },
  );

  useEffect(() => {
    listeners.add(setState);
    if (!cached) {
      publish({ frame: null, error: null, loading: true });
      loadFrame(FRAME_URL)
        .then((frame) => {
          publish({ frame, error: null, loading: false });
          // Hand the geometry to the store so the fit defaults can be solved
          // against the real lens height rather than a nominal guess.
          useStore.getState().adoptFrame(frame);
        })
        .catch((error: Error) =>
          publish({ frame: null, error: error.message, loading: false }),
        );
    } else if (cached.frame) {
      useStore.getState().adoptFrame(cached.frame);
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

/**
 * The frame with the current shape selection baked in.
 *
 * Returned as its own object rather than mutating the loaded frame, so the
 * original morph targets stay available for the next selection.
 */
export function useResolvedFrame(frame: LoadedFrame | null): ResolvedFrame | null {
  const frontAngle = useStore((s) => s.config.frame.shapeAngle);
  const bridge = useStore((s) => s.config.bridge.option);
  const temple = useStore((s) => s.config.temple.design);

  return useMemo(() => {
    if (!frame) return null;
    return resolveShape(frame, { frontAngle, bridge, temple });
  }, [frame, frontAngle, bridge, temple]);
}


/**
 * Silhouettes of all eight shapes, for the selection wheel.
 *
 * Traced once per frame file and cached there, so switching shapes -- which
 * is exactly what the wheel is for -- never re-runs it.
 */
export function useShapeIcons(frame: LoadedFrame | null): ShapeIconSet | null {
  const bridge = useStore((s) => s.config.bridge.option);
  return useMemo(() => (frame ? buildShapeIcons(frame, bridge) : null), [frame, bridge]);
}
