/**
 * What the scan produced: a parametric face model, as numbers.
 *
 * This replaced a line-drawing illustration of the face. The drawing looked
 * like the point of the scan and was not: it was a reconstruction, and
 * everything in it that was not directly measured -- the cranium, the
 * hairline, the ears -- had to be invented from canon. That is a great deal of
 * invention to put in front of someone beside a claim that it is their face.
 *
 * What the scan is genuinely good for is the measurements, so that is what it
 * shows. Each one names where it came from, because a number with no
 * provenance cannot be checked.
 */

import { useRef } from 'react';

import { SHAPE_GLYPHS } from '../drawing/shapeGlyphs';
import { SHAPES, describe } from '../face/faceShape';
import { useStore } from '../state/store';
import { useScrollNudge } from '../ui/useScrollNudge';

interface Metric {
  label: string;
  value: number;
  detail: string;
  strong?: boolean;
}

export function ResultView() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  useScrollNudge(pageRef);

  const scan = useStore((s) => s.scan);
  const go = useStore((s) => s.go);

  if (!scan) return null;
  const { shape, measurements: m } = scan;

  const face: Metric[] = [
    { label: 'Pupillary distance', value: m.pd, detail: 'Between the iris centres' },
    { label: 'Head width', value: m.headWidth, detail: 'Across the face at ear level' },
    { label: 'Face width', value: m.faceWidth, detail: 'Widest point of the contour' },
    { label: 'Face length', value: m.faceLength, detail: 'Hairline to chin' },
    { label: 'Forehead', value: m.foreheadWidth, detail: 'Halfway from brow to hairline' },
    { label: 'Jaw', value: m.jawWidth, detail: 'Across the jaw corners' },
    { label: 'Ear depth', value: m.earDepth, detail: 'Nasion back to the ear plane' },
    { label: 'Bridge height', value: m.bridgeHeight, detail: 'Nasion above the pupil line' },
  ];

  const fit: Metric[] = [
    { label: 'Frame front', value: m.suggestedFrameWidth, detail: 'Sized from your PD', strong: true },
    {
      label: 'Temple length',
      value: m.suggestedTempleLength,
      detail: 'Ear depth plus the bend',
      strong: true,
    },
  ];

  return (
    <div className="result" ref={pageRef}>
      <div className="result__inner">
        <header className="result__head">
          <h1>A parametric model of your face</h1>
          <p className="result__lede">
            Averaged over {scan.samples} poses and scaled from your iris, which
            is 11.7 mm across in almost everyone — the same reference an
            optician&rsquo;s software uses. Every frame you design is checked
            against these numbers.
          </p>
        </header>

        <section className="result__shape">
          <div className="shapecard">
            <div className="shapecard__glyphs">
              <svg viewBox="0 0 100 100" className="shapecard__glyph">
                <path d={SHAPE_GLYPHS[shape.primary]} fill="#f2542d" />
              </svg>
              {shape.isBlend && (
                <svg viewBox="0 0 100 100" className="shapecard__glyph shapecard__glyph--second">
                  <path d={SHAPE_GLYPHS[shape.secondary]} fill="#f2542d" opacity={0.42} />
                </svg>
              )}
            </div>
            <div>
              <div className="shapecard__eyebrow">Face shape</div>
              <div className="shapecard__name">
                {SHAPES[shape.primary].label}
                {shape.isBlend && (
                  <span className="shapecard__plus"> + {SHAPES[shape.secondary].label}</span>
                )}
              </div>
            </div>
          </div>

          <p className="result__describe">{describe(shape)}</p>
          <p className="result__advice">{SHAPES[shape.primary].frameAdvice}</p>

          <div className="mix">
            {shape.scores.slice(0, 4).map((s) => (
              <div className="mix__row" key={s.id}>
                <span className="mix__name">{SHAPES[s.id].label}</span>
                <span className="mix__bar">
                  <i style={{ width: `${Math.round(s.weight * 100)}%` }} />
                </span>
                <span className="mix__value">{Math.round(s.weight * 100)}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="result__metrics">
          <h2 className="result__h2">Measurements</h2>
          <MetricGrid metrics={face} />

          <h2 className="result__h2">What this means for a frame</h2>
          <MetricGrid metrics={fit} />
        </section>

        <div className="result__actions">
          <button className="button" onClick={() => go('editor')}>
            Design a frame
          </button>
          <button className="button button--ghost" onClick={() => go('tryon')}>
            Back to the try-on
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="metricgrid">
      {metrics.map((metric) => (
        <div
          className={metric.strong ? 'metriccard metriccard--strong' : 'metriccard'}
          key={metric.label}
        >
          <dt>{metric.label}</dt>
          <dd>
            <b>{metric.value.toFixed(1)}</b>
            <span>mm</span>
          </dd>
          <p>{metric.detail}</p>
        </div>
      ))}
    </dl>
  );
}
