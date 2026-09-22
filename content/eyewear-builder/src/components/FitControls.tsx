/**
 * The fit controls, shared by the portrait view and the try-on.
 *
 * Deliberately one component used in both places. The placeholder frame's real
 * size is not known -- the source models were drawn at two different scales
 * and the sibling project's notes say outright that absolute size in those
 * files is not trustworthy -- so size and height have to be dialled in by eye,
 * and it would be no help at all if the two screens offered different controls
 * or different ranges to do it with.
 */

import { FIT_RANGES, drawnScale, type FitSettings } from '../ar/fit';

export function Slider({
  label,
  unit,
  value,
  min,
  max,
  step,
  hint,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (
    <label className="slider">
      <span className="slider__label">
        {label}
        <b>
          {value.toFixed(decimals)}
          {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="slider__hint">{hint}</span>}
    </label>
  );
}

/**
 * Size and vertical position -- the two that place the frame on the face.
 *
 * The size slider is a raw multiplier rather than a millimetre width, because
 * until the placeholder's true scale is pinned down a millimetre readout would
 * be a number that looks authoritative and is not. The measured width is shown
 * underneath as a consequence, not as the control.
 */
export function PlacementControls({
  fit,
  frontWidth,
  suggestedWidth,
  onChange,
}: {
  fit: FitSettings;
  frontWidth: number | null;
  suggestedWidth?: number;
  onChange: (patch: Partial<FitSettings>) => void;
}) {
  // The drawn size, not the slider's number: the slider reads 1.00x at the
  // reference, and the customer is being told a width in millimetres.
  const actualWidth = frontWidth !== null ? frontWidth * drawnScale(fit) : null;

  return (
    <>
      <Slider
        label="Frame size"
        unit="×"
        value={fit.scale}
        {...FIT_RANGES.scale}
        hint={
          actualWidth !== null
            ? `${actualWidth.toFixed(0)} mm across` +
              (suggestedWidth ? ` · your face suggests ${suggestedWidth.toFixed(0)} mm` : '')
            : undefined
        }
        onChange={(scale) => onChange({ scale })}
      />
      <Slider
        label="Vertical position"
        unit="mm"
        value={fit.height}
        {...FIT_RANGES.height}
        hint="Positive lifts the frame up the nose"
        onChange={(height) => onChange({ height })}
      />
    </>
  );
}
