import { useRef } from 'react';

import { SHAPE_GLYPHS } from '../drawing/shapeGlyphs';
import { SHAPES, type FaceShapeId } from '../face/faceShape';
import { useStore } from '../state/store';
import { sound } from '../ui/sound';
import { useScrollNudge } from '../ui/useScrollNudge';

const ORDER: FaceShapeId[] = [
  'oval',
  'round',
  'square',
  'rectangle',
  'heart',
  'diamond',
  'triangle',
  'invertedTriangle',
];

export function Landing() {
  const go = useStore((s) => s.go);
  const pageRef = useRef<HTMLDivElement | null>(null);
  useScrollNudge(pageRef);

  return (
    <div className="landing" ref={pageRef}>
      <div className="landing__copy">
        <h1 className="landing__title">
          Design your glasses.
          <br />
          Built to fit your face.
        </h1>
        <p className="landing__lede">
          Build a frame shape by shape, then see it on your own face. A short
          webcam scan measures you in millimetres — pupillary distance, head
          width, ear depth — so every design is sized against your real
          proportions rather than a stock head.
        </p>

        <div className="landing__actions">
          <button
            className="button button--large"
            onClick={() => {
              sound.advance();
              go('editor');
            }}
          >
            Start designing
          </button>
          {/* One door to the camera. Scanning is not a separate errand -- it
              is how the try-on learns your measurements -- so it lives inside
              the try-on rather than competing with it here. */}
          <button
            className="button button--large button--ghost"
            onClick={() => {
              sound.tap();
              go('tryon');
            }}
          >
            3D try-on
          </button>
        </div>

        <ul className="landing__notes">
          <li>Runs entirely on your machine. No frame is uploaded anywhere.</li>
          <li>Takes about twenty seconds. Good, even lighting helps most.</li>
        </ul>
      </div>

      <div className="landing__shapes">
        {ORDER.map((id) => (
          <div className="shapetile" key={id}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <path d={SHAPE_GLYPHS[id]} fill="#f2542d" />
            </svg>
            <span>{SHAPES[id].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
