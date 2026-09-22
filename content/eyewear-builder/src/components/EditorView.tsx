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
 * The other screens -- the try-on and the measurements -- are reached from the
 * tabs in the top bar, and from nowhere else. The rail used to offer its own
 * row of them as well, which meant two sets of controls for the same three
 * destinations, disagreeing about their names ("Try on" against "3D try-on")
 * and about which of them was current. The bar is the one that is on every
 * screen, so the bar is the one that survived.
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

    /*
     * Measured, not assumed: the panels float over the stage, so how much of
     * the canvas is actually visible depends on where they rendered.
     *
     * Which edge they are on is a stylesheet decision -- two columns at the
     * sides on a desktop, one sheet along the bottom on a phone -- and this
     * reads it back off the boxes rather than duplicating the breakpoint in
     * JavaScript. A panel wider than most of the stage can only be the sheet;
     * anything narrower is a column, and it belongs to whichever edge it is
     * nearer. Add a tier to the stylesheet and this keeps working.
     */
    const resize = () => {
      const stage = stageRef.current;
      if (!stage) return;
      scene.setSize(stage.clientWidth, stage.clientHeight);

      const box = stage.getBoundingClientRect();
      let left = 0;
      let right = 0;
      let bottom = 0;
      for (const node of [railRef.current, panelRef.current]) {
        if (!node) continue;
        const r = node.getBoundingClientRect();
        // Zero in a tier that hides it -- the steps rail is not drawn at all
        // in the narrowest layout, and a zero box has no edge to be near.
        if (r.width === 0 || r.height === 0) continue;
        if (r.width > box.width * 0.7) bottom = Math.max(bottom, box.bottom - r.top);
        else if (r.left - box.left < box.right - r.right) left = Math.max(left, r.right - box.left);
        else right = Math.max(right, box.right - r.left);
      }
      scene.setInsets(Math.max(0, left), Math.max(0, right), Math.max(0, bottom));

      // Published so the camera bar can keep clear of the controls instead of
      // sliding under them: above the sheet when there is one along the
      // bottom, inside of it when a short window has put it back on the right.
      // Only the layout knows those numbers, and only after it has run.
      stage.style.setProperty('--dock-h', `${Math.round(Math.max(0, bottom))}px`);
      stage.style.setProperty('--dock-r', `${Math.round(Math.max(0, right))}px`);
    };
    resize();
    // The panels as well as the stage: on a phone the sheet's height is what
    // decides the framing, and it changes without the stage changing at all.
    const observer = new ResizeObserver(resize);
    if (stageRef.current) observer.observe(stageRef.current);
    if (railRef.current) observer.observe(railRef.current);
    if (panelRef.current) observer.observe(panelRef.current);

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

  /*
   * Point the camera at the thing being edited.
   *
   * Each of these is the angle the decision is actually made from, and it is
   * the angle a customer would otherwise have to find by hand: a silhouette
   * is judged square on, an arm is judged from the side, and a bridge is a
   * detail that has to be got close to -- 18 mm of it against a 140 mm frame,
   * which from the default distance is a decision made across the room.
   *
   * Only the three steps that have an obvious answer. Colour and lens stay
   * wherever they were left, because there is no single right angle to look
   * at a colour from and re-aiming on every step would turn the stepper into
   * something that keeps taking the camera away.
   */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const aim: CameraViewId | null =
      step === 'shape' ? 'front' : step === 'temple' ? 'side' : step === 'bridge' ? 'three-quarter' : null;

    /*
     * The scene is driven here rather than through `view` alone, and the
     * order is the reason.
     *
     * `setView` restores whatever pose that view was last left in, and going
     * through React state defers it to the next commit -- so setting the
     * focus first and the view second meant the restore landed *after* the
     * zoom and quietly undid it. The bridge step framed the bridge and then
     * snapped back to the whole frame, which looked like the zoom simply not
     * working.
     *
     * Aimed first, focused second, both in this tick. `setView` is still
     * called with the same value so the camera bar shows the right button; by
     * the time that effect runs, the view is already where it was put and it
     * re-frames through the focus rather than restoring past it.
     */
    if (aim) {
      scene.setView(aim);
      setView(aim);
    }
    scene.setFocus(step === 'bridge' ? 'bridge' : null);
  }, [step]);

  /*
   * Keep the step you are on in view.
   *
   * On a phone the stepper is a rail you push sideways rather than a column,
   * and five steps do not fit across a 390px screen. Without this, "Next"
   * advances to a step that is off the right edge: the panel below changes
   * and the rail appears not to have moved, which reads as the button having
   * done something other than what it said.
   *
   * Harmless on a desktop -- `nearest` scrolls nothing when the whole list is
   * already visible, which in the left-hand column it always is.
   */
  useEffect(() => {
    railRef.current
      ?.querySelector('.stepper__item.is-on')
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [step]);

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

      {/*
        The two instruments, and on a phone the one sheet they become.

        `display: contents` at desktop widths, so this element has no box of
        its own and the rail and the panel keep floating at their own corners
        exactly as they did. Below the breakpoint it becomes the card, docked
        along the bottom, and the two become its rail and its body -- which is
        the whole reason it exists: two separate floating panels on a 390px
        screen land on top of each other and bury the product under both.
      */}
      <div className="editor__dock">
        {/* ---------------------------------------------------- left rail */}
        <nav className="editor__steps panel" aria-label="Design steps" ref={railRef}>
          <button className="editor__back" onClick={() => go('landing')}>
            ← Back
          </button>

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
