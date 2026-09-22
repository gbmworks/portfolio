/**
 * A hue / saturation / brightness picker, on the front, the arms and the lens.
 *
 * It started as a tool for *building* the palettes -- choosing against the
 * real lighting and the real material beats guessing hex and reloading -- and
 * stayed as a feature, because the reason it was useful to build with is the
 * reason it is useful to buy with. A swatch grid answers "which of these
 * five"; this answers "not quite that one".
 *
 * Everything it drives hangs off `customColour` on a config group. Nothing
 * else reads that field, so the picker can still be removed by deleting this
 * file and those three fields.
 *
 * HSB rather than RGB because the three axes match how the decisions are
 * actually made here: pick the hue, decide how saturated an acetate is, then
 * set how dark. Doing that with three RGB channels means moving all three to
 * change any one of them.
 */

import { useMemo } from 'react';

interface Props {
  label: string;
  /** Current hex, or null when the palette swatch is in charge. */
  value: string | null;
  /** The palette colour, shown as the starting point when nothing is set. */
  fallback: string;
  onChange: (hex: string | null) => void;
}

export function ColourStudio({ label, value, fallback, onChange }: Props) {
  const hsb = useMemo(() => hexToHsb(value ?? fallback), [value, fallback]);

  const set = (patch: Partial<typeof hsb>) => onChange(hsbToHex({ ...hsb, ...patch }));

  return (
    <div className="studio">
      <div className="studio__head">
        <span className="studio__title">{label}</span>
        <span className="studio__hex">{(value ?? fallback).toUpperCase()}</span>
        {value && (
          <button className="studio__reset" onClick={() => onChange(null)}>
            Reset
          </button>
        )}
      </div>

      <div className="studio__preview" style={{ background: value ?? fallback }} />

      <Row label="Hue" value={hsb.h} max={360} unit="°" onChange={(h) => set({ h })}
        track="linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" />
      <Row label="Saturation" value={hsb.s} max={100} unit="%" onChange={(s) => set({ s })}
        track={`linear-gradient(90deg,${hsbToHex({ ...hsb, s: 0 })},${hsbToHex({ ...hsb, s: 100 })})`} />
      <Row label="Brightness" value={hsb.b} max={100} unit="%" onChange={(b) => set({ b })}
        track={`linear-gradient(90deg,#000,${hsbToHex({ ...hsb, b: 100 })})`} />
    </div>
  );
}

function Row({
  label,
  value,
  max,
  unit,
  track,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  track: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="studio__row">
      <span>
        {label}
        <b>
          {Math.round(value)}
          {unit}
        </b>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        style={{ background: track }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/* ------------------------------------------------------------ colour ---- */

interface Hsb {
  h: number;
  s: number;
  b: number;
}

export function hexToHsb(hex: string): Hsb {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const bl = (value & 255) / 255;

  const max = Math.max(r, g, bl);
  const min = Math.min(r, g, bl);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - bl) / delta) % 6;
    else if (max === g) h = (bl - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : (delta / max) * 100, b: max * 100 };
}

export function hsbToHex({ h, s, b }: Hsb): string {
  const sat = s / 100;
  const val = b / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;

  const sector = Math.floor(h / 60) % 6;
  const [r, g, bl] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[sector < 0 ? 0 : sector];

  const byte = (v: number) => Math.round((v + m) * 255);
  return `#${((byte(r) << 16) | (byte(g) << 8) | byte(bl)).toString(16).padStart(6, '0')}`;
}
