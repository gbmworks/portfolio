/**
 * The per-component option panels.
 *
 * One component's controls at a time. The alternative -- everything on one
 * long scroll -- was how the old configurator started and it buries the four
 * or five choices that matter under twenty that do not.
 */

import {
  BRIDGE_HEIGHT,
  COLOUR_GROUPS,
  FRAME_COLOURS,
  LENS_COLOURS,
  LENS_TYPES,
  METALS,
  PRESCRIPTIONS,
  templeColourSpec,
  type Configuration,
  type FrameColourId,
  type LensColourId,
  type LensTypeId,
  type MetalId,
  type PrescriptionId,
  type StepId,
  type TempleColourId,
} from '../editor/options';
import type { ShapeIconSet } from '../frame/shapeIcons';
import { BRIDGE_OPTIONS, TEMPLE_DESIGNS } from '../frame/shapes';
import { sound } from '../ui/sound';
import { ColourStudio } from './ColourStudio';
import { Slider } from './FitControls';
import { ShapeWheel } from './ShapeWheel';

interface Props {
  step: StepId;
  config: Configuration;
  icons?: ShapeIconSet | null;
  shapeKeysAvailable: boolean;
  onChange: (patch: DeepPartial<Configuration>) => void;
}

/** One level deep is all the configuration nests. */
type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> };

export function EditorPanels({ step, config, icons, shapeKeysAvailable, onChange }: Props) {
  if (step === 'shape') {
    return (
      <>
        <ShapeWheel
          angle={config.frame.shapeAngle}
          onChange={(shapeAngle) => onChange({ frame: { shapeAngle } })}
          icons={icons}
          unavailable={!shapeKeysAvailable}
        />
      </>
    );
  }

  if (step === 'colour') {
    return (
      <>
        {COLOUR_GROUPS.map((group) => (
          <Field key={group.label} label={group.label}>
            <NamedSwatches
              value={config.frame.customColour ? '' : config.frame.colour}
              ids={group.ids}
              onChange={(colour) =>
                onChange({ frame: { colour: colour as FrameColourId, customColour: null } })
              }
            />
          </Field>
        ))}

        <ColourStudio
          label="Pick a colour"
          value={config.frame.customColour ?? null}
          fallback={FRAME_COLOURS[config.frame.colour].hex}
          onChange={(customColour) => onChange({ frame: { customColour } })}
        />
      </>
    );
  }

  if (step === 'lens') {
    const tinted = LENS_TYPES[config.lens.type].tinted;
    return (
      <>
        <Field label="Type">
          <Pills
            value={config.lens.type}
            options={Object.entries(LENS_TYPES).map(([id, l]) => ({ id, label: l.label }))}
            onChange={(type) => onChange({ lens: { type: type as LensTypeId } })}
          />
        </Field>

        {/* Only offered where it does something: a clear lens has no tint to
            colour, and showing the control anyway teaches people that the
            controls lie. */}
        {tinted && (
          <>
            <Field label="Tint colour">
              <Swatches
                value={config.lens.customColour ? '' : config.lens.colour}
                options={LENS_COLOURS}
                onChange={(colour) =>
                  onChange({ lens: { colour: colour as LensColourId, customColour: null } })
                }
              />
            </Field>

            <ColourStudio
              label="Pick a tint"
              value={config.lens.customColour ?? null}
              fallback={LENS_COLOURS[config.lens.colour].hex}
              onChange={(customColour) => onChange({ lens: { customColour } })}
            />
          </>
        )}

        <Field label="Prescription">
          <div className="optionlist">
            {Object.entries(PRESCRIPTIONS).map(([id, rx]) => (
              <button
                key={id}
                className={
                  id === config.lens.prescription ? 'optionlist__item is-on' : 'optionlist__item'
                }
                onClick={() => {
                  sound.tap();
                  onChange({ lens: { prescription: id as PrescriptionId } });
                }}
              >
                <span className="optionlist__label">{rx.label}</span>
                <span className="optionlist__detail">{rx.detail}</span>
              </button>
            ))}
          </div>
        </Field>
      </>
    );
  }

  if (step === 'temple') {
    // Shape, then material, then hardware -- the same order the five steps
    // run in, and the order the decisions actually depend on each other:
    // which arm it is changes how much of it you see, so it is worth settling
    // before choosing what it is made of.
    return (
      <>
        <Field label="Design">
          <div className="bridgegrid">
            {TEMPLE_DESIGNS.map((design) => (
              <button
                key={design.id}
                className={
                  design.id === config.temple.design
                    ? 'bridgegrid__item bridgegrid__item--on'
                    : 'bridgegrid__item'
                }
                onClick={() => {
                  sound.shape(TEMPLE_DESIGNS.indexOf(design));
                  onChange({ temple: { design: design.id } });
                }}
              >
                {design.label}
              </button>
            ))}
          </div>
          {!shapeKeysAvailable && (
            <p className="hint hint--warn">
              This export carries no shape keys, so these will not change the
              geometry yet.
            </p>
          )}
        </Field>

        {COLOUR_GROUPS.map((group, i) => (
          <Field key={group.label} label={group.label}>
            <NamedSwatches
              // A mixed colour deselects the palette, the same as the front:
              // leaving a swatch ringed while the arms render something else
              // would be a lie about what is on screen.
              value={config.temple.customColour ? '' : config.temple.colour}
              ids={group.ids}
              // The arms can follow the front instead of choosing, and that
              // is the most common answer -- so it leads the first group
              // rather than hiding under the palettes.
              matchOption={i === 0}
              onChange={(colour) =>
                onChange({ temple: { colour: colour as TempleColourId, customColour: null } })
              }
            />
          </Field>
        ))}

        <ColourStudio
          label="Pick a colour"
          value={config.temple.customColour ?? null}
          // Starts from whatever the arms are actually showing, which may be
          // a custom colour inherited from a matched front.
          fallback={templeColourSpec(config).hex}
          onChange={(customColour) => onChange({ temple: { customColour } })}
        />

        <Field label="Metal">
          <NamedSwatches
            value={config.temple.metal}
            ids={Object.keys(METALS) as MetalId[]}
            colours={METALS}
            onChange={(metal) => onChange({ temple: { metal: metal as MetalId } })}
          />
        </Field>
      </>
    );
  }

  return (
    <>
      <Field label="Profile & shape">
        <div className="bridgegrid">
          {BRIDGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={
                option.id === config.bridge.option
                  ? 'bridgegrid__item bridgegrid__item--on'
                  : 'bridgegrid__item'
              }
              onClick={() => {
                sound.shape(BRIDGE_OPTIONS.indexOf(option));
                onChange({ bridge: { option: option.id } });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {!shapeKeysAvailable && (
          <p className="hint hint--warn">
            This export carries no shape keys, so these will not change the
            geometry yet.
          </p>
        )}
      </Field>

      <Field label="Metal">
        <NamedSwatches
          value={config.bridge.metal}
          ids={Object.keys(METALS) as MetalId[]}
          colours={METALS}
          onChange={(metal) => onChange({ bridge: { metal: metal as MetalId } })}
        />
      </Field>

      <Field label="Height">
        <Slider
          label="Bridge position"
          unit=" mm"
          value={config.bridge.height}
          min={BRIDGE_HEIGHT.min}
          max={BRIDGE_HEIGHT.max}
          step={BRIDGE_HEIGHT.step}
          hint="Raises or lowers where the frame rests on your nose"
          onChange={(height) => onChange({ bridge: { height } })}
        />
      </Field>
    </>
  );
}

/* ------------------------------------------------------------ controls -- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="field__label">{label}</div>
      {children}
    </div>
  );
}

function Swatches({
  value,
  options,
  onChange,
  matchOption,
}: {
  value: string;
  options: Record<string, { label: string; hex: string; swatch?: string }>;
  onChange: (id: string) => void;
  /** Adds a "match the front" choice at the head of the row. */
  matchOption?: boolean;
}) {
  return (
    <div className="swatches">
      {matchOption && (
        <button
          className={value === 'match' ? 'swatch swatch--text is-on' : 'swatch swatch--text'}
          onClick={() => {
            sound.colour();
            onChange('match');
          }}
          title="Match the front"
        >
          Match
        </button>
      )}
      {Object.entries(options).map(([id, option]) => (
        <button
          key={id}
          className={id === value ? 'swatch is-on' : 'swatch'}
          style={{ background: option.swatch ?? option.hex }}
          onClick={() => {
            sound.colour();
            onChange(id);
          }}
          title={option.label}
          aria-label={option.label}
        />
      ))}
    </div>
  );
}

/**
 * A labelled swatch grid.
 *
 * Names under the colours, not just tooltips: "olive" and "smoke" are not
 * guessable from a 32-pixel circle, and a customer choosing a finish is
 * choosing a word as much as a colour.
 */
function NamedSwatches<T extends string>({
  value,
  ids,
  colours,
  matchOption,
  onChange,
}: {
  value: string;
  ids: T[];
  /** Defaults to the frame palette; metals pass their own. */
  colours?: Record<string, { label: string; hex: string; swatch?: string }>;
  /** Adds a "follow the front" choice at the head of the grid. */
  matchOption?: boolean;
  onChange: (id: string) => void;
}) {
  // Widened deliberately: the two palettes share only the fields this
  // component reads, and the frame's `Colour` carries map and transmission
  // fields a metal has no use for.
  const palette: Record<string, { label: string; hex: string; swatch?: string }> =
    colours ?? FRAME_COLOURS;
  // The match chip is a sixth item in a five-wide grid, which would otherwise
  // orphan the last colour onto a row of its own.
  const className = matchOption ? 'namedswatches namedswatches--six' : 'namedswatches';
  return (
    <div className={className}>
      {matchOption && (
        <button
          className={value === 'match' ? 'namedswatch is-on' : 'namedswatch'}
          onClick={() => {
            sound.colour();
            onChange('match');
          }}
        >
          <span className="namedswatch__dot namedswatch__dot--match">=</span>
          <span className="namedswatch__label">Match</span>
        </button>
      )}
      {ids.map((id) => {
        const colour = palette[id];
        return (
          <button
            key={id}
            className={id === value ? 'namedswatch is-on' : 'namedswatch'}
            onClick={() => {
            sound.colour();
            onChange(id);
          }}
          >
            <span className="namedswatch__dot" style={{ background: colour.swatch ?? colour.hex }} />
            <span className="namedswatch__label">{colour.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Pills({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="pills">
      {options.map((option) => (
        <button
          key={option.id}
          className={option.id === value ? 'pill pill--on' : 'pill'}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
