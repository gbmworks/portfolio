/**
 * The front-shape selector: a ring you drag, with the eight shapes around it.
 *
 * Dragging is the point. The angle round the ring is a continuous value, so a
 * position between two shapes is a real blend of the two rather than a
 * rounding error -- which turns eight presets into a space you can explore,
 * the useful thing about morph targets in the first place.
 *
 * **The track and the icons are separate rings.** They used to be the same
 * one, and that was the bug: a pointer-down on an icon meant both "choose this
 * shape" and "start dragging from here", so every attempt to drag began by
 * jumping to whatever was under the cursor. Split apart, the track is
 * unambiguously the thing you drag and the icons are unambiguously buttons.
 *
 * The angle is the state. `shapeBlend` turns it back into a pair of shapes and
 * a mix.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ShapeIconSet } from '../frame/shapeIcons';
import { FRONT_SHAPES, shapeBlend } from '../frame/shapes';
import { sound } from '../ui/sound';

interface Props {
  /** Position round the wheel, degrees clockwise from the top. */
  angle: number;
  onChange: (angle: number) => void;
  /** Traced silhouettes, once they are ready. */
  icons?: ShapeIconSet | null;
  /** Marks shapes whose key is missing from the loaded file. */
  unavailable?: boolean;
}

/** Radii in the svg's own 0..100 box. */
const TRACK = 24;
const ICON_RING = 40;
const ICON = 8.5;
/** How far either side of the track a pointer-down still starts a drag. */
const GRAB = 11;

/**
 * Which shape a wheel angle is nearest, circularly.
 *
 * Measured against each shape's own angle rather than assuming an even 45
 * degrees, so adding a ninth shape does not silently detune the wheel.
 */
function nearestShape(angle: number): number {
  const a = ((angle % 360) + 360) % 360;
  let best = 0;
  let closest = Infinity;
  for (let i = 0; i < FRONT_SHAPES.length; i++) {
    const delta = Math.abs((((FRONT_SHAPES[i].angle - a) % 360) + 540) % 360 - 180);
    if (delta < closest) {
      closest = delta;
      best = i;
    }
  }
  return best;
}

export function ShapeWheel({ angle, onChange, icons, unavailable }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const blend = shapeBlend(angle);

  /** Pointer position -> angle clockwise from the top, or null if off-track. */
  const angleAt = useCallback(
    (clientX: number, clientY: number, requireTrack: boolean): number | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      // Convert through the viewBox rather than assuming pixels: the panel
      // resizes, and the radii below are in svg units.
      const unit = rect.width / 106;
      const dx = (clientX - (rect.left + rect.width / 2)) / unit;
      const dy = (clientY - (rect.top + rect.height / 2)) / unit;
      const distance = Math.hypot(dx, dy);
      if (requireTrack && Math.abs(distance - TRACK) > GRAB) return null;
      if (distance < 4) return null;
      return (Math.atan2(dx, -dy) * 180) / Math.PI;
    },
    [],
  );

  /**
   * Sound the wheel, but only when it crosses into a new shape.
   *
   * A drag fires `onChange` on every pointer move -- dozens a second -- and a
   * cue on each one is a buzz, not feedback. Gated on the nearest shape
   * changing, the same drag instead plays one note per shape it passes
   * through, which is the thing actually worth hearing: the wheel becomes an
   * instrument whose scale is the range of frames.
   */
  const lastNote = useRef(nearestShape(angle));
  const voice = useCallback((next: number) => {
    const index = nearestShape(next);
    if (index === lastNote.current) return;
    lastNote.current = index;
    sound.shape(index);
  }, []);

  // Listeners on the window, not the svg: a drag that leaves the element --
  // most of them, since the ring sits near the panel edge -- would otherwise
  // stick, leaving the wheel following the cursor forever.
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      // Once a drag is under way the track no longer gates it, so the pointer
      // can wander off the ring without the value freezing.
      const next = angleAt(event.clientX, event.clientY, false);
      if (next === null) return;
      voice(next);
      onChange(next);
    };
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, angleAt, onChange, voice]);

  const handleRadians = ((angle - 90) * Math.PI) / 180;
  const handleX = 50 + Math.cos(handleRadians) * TRACK;
  const handleY = 50 + Math.sin(handleRadians) * TRACK;

  const mixLabel =
    blend.t < 0.06
      ? blend.from.label
      : blend.t > 0.94
        ? blend.to.label
        : `${blend.from.label} · ${blend.to.label}`;

  return (
    <div className="wheel">
      <svg
        ref={svgRef}
        viewBox="-3 -3 106 106"
        className={dragging ? 'wheel__svg is-dragging' : 'wheel__svg'}
        role="slider"
        aria-label="Frame shape"
        aria-valuetext={mixLabel}
        aria-valuenow={Math.round(angle)}
        aria-valuemin={0}
        aria-valuemax={360}
        tabIndex={0}
        onPointerDown={(e) => {
          const next = angleAt(e.clientX, e.clientY, true);
          if (next === null) return;
          setDragging(true);
          voice(next);
          onChange(next);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 45;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            voice(angle + step);
            onChange(angle + step);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            voice(angle - step);
            onChange(angle - step);
          } else return;
          e.preventDefault();
        }}
      >
        {/* Icons first, so the track and handle draw over them. */}
        {FRONT_SHAPES.map((shape) => {
          const radians = ((shape.angle - 90) * Math.PI) / 180;
          const cx = 50 + Math.cos(radians) * ICON_RING;
          const cy = 50 + Math.sin(radians) * ICON_RING;
          const weight =
            shape.id === blend.from.id ? 1 - blend.t : shape.id === blend.to.id ? blend.t : 0;

          return (
            <g
              key={shape.id}
              className={weight > 0.5 ? 'wheel__node wheel__node--on' : 'wheel__node'}
              onPointerDown={(e) => {
                // Stop the svg handler: this is a button, not a drag start.
                e.stopPropagation();
                voice(shape.angle);
                onChange(shape.angle);
              }}
            >
              <title>{shape.label}</title>
              <circle cx={cx} cy={cy} r={ICON} />
              {icons?.paths[shape.id] && (
                // A nested svg so the traced path keeps its own millimetre
                // coordinates and is fitted by the viewBox, rather than
                // needing a scale factor worked out per shape.
                <svg
                  x={cx - ICON * 0.78}
                  y={cy - ICON * 0.5}
                  width={ICON * 1.56}
                  height={ICON}
                  viewBox={icons.viewBox}
                  preserveAspectRatio="xMidYMid meet"
                  overflow="visible"
                >
                  <path d={icons.paths[shape.id]} className="wheel__icon" fillRule="evenodd" />
                </svg>
              )}
            </g>
          );
        })}

        {/* The draggable track. */}
        <circle cx="50" cy="50" r={TRACK} className="wheel__track" />
        <circle cx={handleX} cy={handleY} r={4} className="wheel__handle" />

        {/* Only the blended silhouette sits inside the ring. The name lives
            below the svg: set as text at this radius it runs wider than the
            track and collides with the icons the moment two shapes are
            named. */}
        {icons && (
          <svg
            x={50 - TRACK * 0.82}
            y={50 - TRACK * 0.34}
            width={TRACK * 1.64}
            height={TRACK * 0.68}
            viewBox={icons.viewBox}
            preserveAspectRatio="xMidYMid meet"
            overflow="visible"
          >
            <path
              d={icons.paths[blend.from.id]}
              className="wheel__preview"
              fillRule="evenodd"
              opacity={1 - blend.t}
            />
            <path
              d={icons.paths[blend.to.id]}
              className="wheel__preview"
              fillRule="evenodd"
              opacity={blend.t}
            />
          </svg>
        )}
      </svg>

      <p className="wheel__label">
        {mixLabel}
        {blend.t > 0.06 && blend.t < 0.94 && (
          <span>
            {Math.round((1 - blend.t) * 100)} / {Math.round(blend.t * 100)}
          </span>
        )}
      </p>

      <p className="hint">Click a shape, or drag the ring to blend between two.</p>

      {unavailable && (
        <p className="hint hint--warn">
          This export carries no shape keys, so the geometry will not change.
        </p>
      )}
    </div>
  );
}
