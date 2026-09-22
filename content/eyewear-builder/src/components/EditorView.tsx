/**
 * The editor: the main screen.
 *
 * Three columns. Left is the design's identity -- name, running total, and the
 * numbered steps. Centre is the product. Right is the choices for the step you
 * are on, and the way forward.
 *
 * A stepper rather than a pile of panels, because the decisions have a real
 * order: the shape settles what you are buying, the colour dresses it, the
 * lens and the fit follow. Every step stays clickable, so it guides without
 * trapping anyone, and clicking a part in the viewer jumps to its step.
 *
 * The try-on sits with the view controls rather than being a destination of
 * its own: it answers a question you ask *about* a design, and you come
 * straight back to keep editing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CAMERA_VIEWS, EditorScene, type CameraViewId } from '../editor/EditorScene';
import { STEPS, computePrice, formatPrice, type StepId } from '../editor/options';
import { BRIDGE_OPTIONS, dominantShape } from '../frame/shapes';
import { useFrame, useResolvedFrame, useShapeIcons } from '../frame/useFrame';
import { useStore } from '../state/store';
import { sound } from '../ui/sound';
import { EditorPanels } from './EditorPanels';
import { ViewportHint } from './ViewportHint';

/** Cursor stillness before the turntable picks up again, ms. */
const TURNTABLE_DELAY = 5000;

export function EditorView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<EditorScene | null>(null);

  const config = useStore((s) => s.config);
  const patchConfig = useStore((s) => s.patchConfig);
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const go = useStore((s) => s.go);
  const scan = useStore((s) => s.scan);

  const { frame, loading, error } = useFrame();
  const resolved = useResolvedFrame(frame);
  const icons = useShapeIcons(frame);
  const [view, setView] = useState<CameraViewId>('three-quarter');
  const [saved, setSaved] = useState(false);

  const index = Math.max(0, STEPS.findIndex((s) => s.id === step));
  const current = STEPS[index];
  const next = STEPS[index + 1];

  // --- scene lifecycle ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new EditorScene(canvas);
    sceneRef.current = scene;

    const resize = () => {
      const stage = stageRef.current;
      if (!stage) return;
      scene.setSize(stage.clientWidth, stage.clientHeight);
      // Measured, not assumed: the panels float over the stage, so how much
      // of the canvas is actually visible depends on their rendered width.
      const box = stage.getBoundingClientRect();
      const cover = (node: HTMLElement | null, side: 'left' | 'right') => {
        if (!node) return 0;
        const r = node.getBoundingClientRect();
        return Math.max(0, side === 'left' ? r.right - box.left : box.right - r.left);
      };
      scene.setInsets(cover(railRef.current, 'left'), cover(panelRef.current, 'right'));
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (stageRef.current) observer.observe(stageRef.current);

    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (frame && sceneRef.current) {
      sceneRef.current.setFrame(frame, resolved?.parts ?? frame.parts);
    }
  }, [frame, resolved]);

  useEffect(() => {
    sceneRef.current?.applyConfig(config);
  }, [config]);

  /*
   * The turntable: once on arrival, then again whenever the cursor rests.
   *
   * Five seconds, so it never interrupts someone mid-decision -- the hint
   * offers itself at three, which puts the words first and the demonstration
   * after. Any pointer activity over the stage stops it and restarts the
   * count; taking the camera by hand ends the current sweep through the
   * controls' own `start` event.
   */
  useEffect(() => {
    if (!frame) return;
    const node = stageRef.current;
    if (!node) return;

    let idle = window.setTimeout(() => sceneRef.current?.startIntro(), TURNTABLE_DELAY);
    const rest = () => {
      window.clearTimeout(idle);
      sceneRef.current?.endIntro();
      idle = window.setTimeout(() => sceneRef.current?.startIntro(), TURNTABLE_DELAY);
    };

    sceneRef.current?.startIntro();
    node.addEventListener('pointermove', rest, { passive: true });
    node.addEventListener('pointerdown', rest);
    node.addEventListener('wheel', rest, { passive: true });
    return () => {
      window.clearTimeout(idle);
      node.removeEventListener('pointermove', rest);
      node.removeEventListener('pointerdown', rest);
      node.removeEventListener('wheel', rest);
    };
  }, [frame]);

  useEffect(() => {
    sceneRef.current?.setView(view);
  }, [view]);

  /**
   * Where the pointer went down, so a drag is not mistaken for a click.
   *
   * Orbiting ends with a `pointerup` over some part of the model, and the
   * browser follows it with a `click`. Treated as a pick, that quietly jumps
   * the panel to whatever the pointer happened to land on -- so rotating to
   * look at the temples would fling you out of the step you were editing.
   */
  const pressRef = useRef<{ x: number; y: number } | null>(null);

  const onCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    pressRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const scene = sceneRef.current;
      const canvas = canvasRef.current;
      const press = pressRef.current;
      pressRef.current = null;
      if (!scene || !canvas) return;

      // A few pixels of slop: a deliberate click still moves the mouse a
      // little, and demanding an exact match makes parts feel unclickable.
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) return;

      const component = scene.pick(event.clientX, event.clientY, canvas.getBoundingClientRect());
      if (!component) return;
      // Jump to the first step that edits the part that was clicked.
      const target = STEPS.find((s) => s.component === component);
      if (target) setStep(target.id);
    },
    [setStep],
  );

  const price = useMemo(() => {
    const shapeLabel = dominantShape(config.frame.shapeAngle).label;
    const bridgeLabel =
      BRIDGE_OPTIONS.find((b) => b.id === config.bridge.option)?.label ?? config.bridge.option;
    return computePrice(config, shapeLabel, bridgeLabel);
  }, [config]);

  const designName = dominantShape(config.frame.shapeAngle).label;

  return (
    <div className="editor">
      {/* The viewport fills the screen and the panels float over it. The
          product is the subject, so it gets the room; the controls are
          instruments laid on the glass rather than columns competing with it
          for width. */}
      <section className="editor__stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className="editor__canvas"
          onPointerDown={onCanvasPointerDown}
          onClick={onCanvasClick}
        />
        {loading && <div className="editor__notice">Loading model…</div>}
        {error && <div className="editor__notice editor__notice--error">{error}</div>}
        {!loading && !error && <ViewportHint stage={stageRef} />}

        <div className="viewbar">
          {CAMERA_VIEWS.map((v) => (
            <button
              key={v.id}
              className={v.id === view ? 'viewbtn viewbtn--on' : 'viewbtn'}
              // Re-aims the scene directly as well as setting the state.
              // Picking the view you are already on has to re-frame, because
              // by then you have almost certainly orbited away from it --
              // through React state alone the value never changes, the effect
              // never fires, and the only button that looks like "put it
              // back" does nothing.
              onClick={() => {
                sound.tap();
                // Only when it is *already* the active view. Otherwise the
                // state change below drives the effect, and calling the scene
                // here as well would run `setView` twice -- the second call
                // seeing a view it is already on, treating that as "reset",
                // and throwing away the position it had just restored.
                if (v.id === view) sceneRef.current?.setView(v.id);
                setView(v.id);
              }}
              title={
                v.id === view
                  ? 'Reset this view'
                  : v.id === 'three-quarter'
                    ? 'Perspective'
                    : 'Orthographic'
              }
            >
              <ViewIcon id={v.id} />
              <span>{v.label}</span>
            </button>
          ))}
          <span className="viewbar__hint">
            {frame ? `${frame.frontWidth.toFixed(0)} mm front` : ''}
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------ left rail */}
      <nav className="editor__steps panel" aria-label="Design steps" ref={railRef}>
        <button className="editor__back" onClick={() => go('landing')}>
          ← Back
        </button>

        <div className="editor__modes">
            <button className="modebtn modebtn--on">3D view</button>
            <button
              className="modebtn"
              onClick={() => {
                sound.tap();
                go('tryon');
              }}
            >
              Try on
            </button>
            {scan && (
              <button className="modebtn" onClick={() => go('result')}>
                Measurements
              </button>
            )}
          </div>

        <div className="editor__identity">
          <h1>{designName}</h1>
          <p>{formatPrice(price.total)}</p>
        </div>

        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                className={s.id === step ? 'stepper__item is-on' : 'stepper__item'}
                onClick={() => {
                  sound.tap();
                  setStep(s.id);
                }}
                aria-current={s.id === step ? 'step' : undefined}
              >
                <span className="stepper__num">{i + 1}</span>
                <span className="stepper__label">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="editor__foot">
          <p className="editor__tagline">
            Your face.
            <br />
            Your frame.
          </p>
          <p className="muted small">
            Every design is drawn at true size against your own measurements.
          </p>
        </div>
      </nav>

      {/* ---------------------------------------------------- right panel */}
      <aside className="editor__panel panel" ref={panelRef}>
        <header className="panel__head">
          <h3>
            {index + 1}. {current.label}
          </h3>
          <p>{current.blurb}</p>
        </header>

        {/* Keyed on the step so the entrance re-runs: the panel reads as
            a change of subject, not a redrawn list. */}
        <div className="panel__body" key={step}>
          <EditorPanels
            step={step}
            config={config}
            icons={icons}
            shapeKeysAvailable={frame?.hasShapeKeys ?? false}
            onChange={patchConfig}
          />
        </div>

        <div className="panel__foot">
          {next ? (
            <button
              className="button button--block"
              onClick={() => {
                sound.advance();
                setStep(next.id);
              }}
            >
              Next: {next.label} →
            </button>
          ) : (
            <button
              className="button button--block"
              onClick={() => {
                sound.advance();
                go('tryon');
              }}
            >
              Try it on →
            </button>
          )}
          <button
            className="button button--ghost button--block"
            onClick={() => {
              sound.advance();
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1800);
            }}
          >
            {saved ? 'Design saved' : 'Save design'}
          </button>

          <details className="breakdown">
            <summary>
              <span>Total</span>
              <strong>{formatPrice(price.total)}</strong>
            </summary>
            <dl>
              {price.lines.map((line) => (
                <div key={line.id}>
                  <dt>
                    {line.label}
                    <span>{line.detail}</span>
                  </dt>
                  <dd>{line.amount === 0 ? 'Included' : formatPrice(line.amount)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </aside>
    </div>
  );
}

export type { StepId };

/** Tiny glyphs for the camera bar: a box seen from each direction. */
function ViewIcon({ id }: { id: CameraViewId }) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    case 'three-quarter':
      // A solid, plus the arc it turns on -- the other three are flat
      // elevations and this is the only one with an orbit to offer.
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M8 2.4 13 5.2v5.6L8 13.6 3 10.8V5.2Z" {...stroke} />
          <path d="M3 5.2 8 8l5-2.8M8 8v5.6" {...stroke} />
          <path d="M2.1 11.4a6.6 6.6 0 0 0 11.8 0" {...stroke} strokeDasharray="1.6 1.9" />
        </svg>
      );
    case 'front':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <rect x="3" y="3" width="10" height="10" rx="1" {...stroke} />
        </svg>
      );
    case 'side':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M5.5 3h5v10h-5Z" {...stroke} />
          <path d="M10.5 3 13 5v6l-2.5 2" {...stroke} />
        </svg>
      );
    case 'top':
      return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M3 6.5 8 4l5 2.5L8 9Z" {...stroke} />
          <path d="M3 6.5v3L8 12l5-2.5v-3" {...stroke} />
        </svg>
      );
  }
}
