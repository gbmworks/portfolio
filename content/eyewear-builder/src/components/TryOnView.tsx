/**
 * Live 3D try-on.
 *
 * The render loop is driven by the tracking callback rather than its own
 * requestAnimationFrame: there is nothing to redraw between camera frames, and
 * a second loop would just re-render the same pose at 120 Hz on a fast display.
 *
 * Nothing about the scene goes through React state. The scene is built once in
 * a ref and poked imperatively, because a re-render per tracked frame would
 * cost more than the landmarker.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ARScene } from '../ar/arScene';
import type { OccluderMode } from '../ar/occluder';
import { FIT_RANGES } from '../ar/fit';
import { useFaceTracking } from '../face/useFaceTracking';
import { useFrame, useResolvedFrame } from '../frame/useFrame';
import { useStore } from '../state/store';
import { sound } from '../ui/sound';
import { PlacementControls, Slider } from './FitControls';

export function TryOnView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ARScene | null>(null);

  const scan = useStore((s) => s.scan);
  const fit = useStore((s) => s.fit);
  const setFit = useStore((s) => s.setFit);
  const resetFit = useStore((s) => s.resetFit);
  const appearance = useStore((s) => s.appearance);
  const go = useStore((s) => s.go);

  const { frame, loading, error } = useFrame();
  const resolved = useResolvedFrame(frame);
  const [ready, setReady] = useState(false);
  const [occluder, setOccluder] = useState<OccluderMode>('on');

  // --- scene lifecycle ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new ARScene(canvas);
    sceneRef.current = scene;

    const resize = () => {
      const stage = stageRef.current;
      if (!stage) return;
      scene.setSize(stage.clientWidth, stage.clientHeight);
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
      sceneRef.current.setFrame({ ...frame, parts: resolved?.parts ?? frame.parts }, appearance);
      setReady(true);
    }
    // `appearance` is handled by its own effect; re-running this one on a
    // colour change would rebuild every mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, resolved]);

  useEffect(() => {
    sceneRef.current?.setAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    if (scan) sceneRef.current?.setScan(scan.measurements);
  }, [scan]);

  useEffect(() => {
    sceneRef.current?.setFit(fit);
  }, [fit]);

  useEffect(() => {
    sceneRef.current?.setOccluderMode(occluder);
  }, [occluder]);

  const onFrame = useCallback(
    (sample: Parameters<Parameters<typeof useFaceTracking>[1]>[0]) => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.update(sample);
      scene.render();
    },
    [],
  );

  const { videoRef, state } = useFaceTracking(true, onFrame);

  return (
    <div className="tryon">
      <div className="tryon__stage" ref={stageRef}>
        {/* Video behind, canvas in front, one mirror transform on the pair.
            The 3D layer never learns the view is flipped. */}
        <video ref={videoRef} className="tryon__video" playsInline muted />
        <canvas ref={canvasRef} className="tryon__canvas" />

        {(loading || !ready) && <div className="tryon__notice">Loading frame…</div>}
        {error && <div className="tryon__notice tryon__notice--error">{error}</div>}
        {state.status !== 'running' && state.message && (
          <div className="tryon__notice">{state.message}</div>
        )}
        {state.faceLost && <div className="tryon__notice">Looking for your face…</div>}
      </div>

      {/* The same object as the editor's panel: a head that names the
          surface, a body that scrolls, a foot that holds the way onward.
          Floating over the feed rather than beside it, so the face keeps the
          whole window -- a mirror cropped to two thirds stops reading as one. */}
      <aside className="tryon__panel panel">
        <header className="panel__head">
          <h3>Fit on your face</h3>
          <p>
            {scan
              ? `Sized from your scan — ${scan.measurements.pd.toFixed(1)} mm PD, ${scan.measurements.headWidth.toFixed(0)} mm head width.`
              : 'Sized against an average head until you scan.'}
          </p>
        </header>

        <div className="panel__body">
          <PlacementControls
            fit={fit}
            frontWidth={frame?.frontWidth ?? null}
            suggestedWidth={scan?.measurements.suggestedFrameWidth}
            onChange={setFit}
          />

          <Slider
            label="Distance from eye"
            unit="mm"
            value={fit.depth}
            {...FIT_RANGES.depth}
            onChange={(v) => setFit({ depth: v })}
          />
          <Slider
            label="Pantoscopic tilt"
            unit="°"
            value={fit.pantoscopic}
            {...FIT_RANGES.pantoscopic}
            onChange={(v) => setFit({ pantoscopic: v })}
          />
          <Slider
            label="Temple splay"
            unit="°"
            value={fit.splay}
            {...FIT_RANGES.splay}
            onChange={(v) => setFit({ splay: v })}
          />

          <button className="button button--ghost button--block" onClick={resetFit}>
            Reset the fit
          </button>

          <h3 className="panel__heading">Head mask</h3>
          <div className="pills">
            {(['on', 'off', 'debug'] as OccluderMode[]).map((mode) => (
              <button
                key={mode}
                className={mode === occluder ? 'pill pill--on' : 'pill'}
                onClick={() => {
                  sound.tap();
                  setOccluder(mode);
                }}
              >
                {mode === 'on' ? 'On' : mode === 'off' ? 'Off' : 'Show'}
              </button>
            ))}
          </div>
          <p className="hint">
            The depth-only mask that hides the far arm behind your head. Turn it
            off to see what it is doing; &ldquo;Show&rdquo; draws it.
          </p>

          {!scan && (
            <>
              <h3 className="panel__heading">Your measurements</h3>
              <p className="hint hint--warn">
                No scan yet, so the frame is sized against an average head.
              </p>
            </>
          )}
        </div>

        <div className="panel__foot">
          {/* The only door to the scanner, and the primary action while there
              is no scan: everything above it is guesswork until there is one. */}
          {scan ? (
            <div className="tryon__actions">
              <button
                className="button button--ghost button--block"
                onClick={() => {
                  sound.tap();
                  go('result');
                }}
              >
                See all measurements
              </button>
              <button
                className="button button--ghost button--block"
                onClick={() => {
                  sound.tap();
                  go('scan');
                }}
              >
                Scan again
              </button>
            </div>
          ) : (
            <button
              className="button button--block"
              onClick={() => {
                sound.advance();
                go('scan');
              }}
            >
              Scan your face
            </button>
          )}
          <button
            className="button button--ghost button--block"
            onClick={() => {
              sound.tap();
              go('editor');
            }}
          >
            Back to the design
          </button>
        </div>
      </aside>
    </div>
  );
}
