/**
 * The guided scan.
 *
 * The session object lives in a ref, not in state: it is fed thirty times a
 * second and re-rendering React that often to show a progress bar would cost
 * more than the tracking does. Only the derived progress goes into state, and
 * only when one of the values a human could notice has actually changed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ScanSession, type ScanProgress } from '../face/scanSession';
import { useFaceTracking } from '../face/useFaceTracking';
import { useStore } from '../state/store';

const STAGE_LABEL: Record<ScanProgress['stage'], string> = {
  centre: 'Finding your face',
  yaw: 'Turn left and right',
  pitch: 'Now up and down',
  done: 'Processing',
};

export function ScanView() {
  const completeScan = useStore((s) => s.completeScan);
  const go = useStore((s) => s.go);

  const sessionRef = useRef(new ScanSession());
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  const onFrame = useCallback(
    (sample: Parameters<Parameters<typeof useFaceTracking>[1]>[0]) => {
      if (processingRef.current) return;
      const next = sessionRef.current.push(sample);

      setProgress((prev) => {
        if (
          prev &&
          prev.stage === next.stage &&
          prev.warning === next.warning &&
          Math.abs(prev.overall - next.overall) < 0.005 &&
          Math.abs(prev.yawDeg - next.yawDeg) < 1 &&
          Math.abs(prev.pitchDeg - next.pitchDeg) < 1
        ) {
          return prev;
        }
        return next;
      });

      if (sessionRef.current.complete) {
        processingRef.current = true;
        setProcessing(true);
      }
    },
    [],
  );

  const { videoRef, state } = useFaceTracking(!processing, onFrame);

  // A deliberate beat before the result. The aggregation itself takes a few
  // milliseconds, but a scan that snaps to an answer instantly reads as if it
  // ignored everything the customer just did.
  useEffect(() => {
    if (!processing) return;
    const timer = window.setTimeout(() => {
      const { mean, frontalMean, samples } = sessionRef.current.aggregate();
      completeScan(mean, frontalMean, samples);
    }, 1400);
    return () => clearTimeout(timer);
  }, [processing, completeScan]);

  const stage = processing ? 'done' : (progress?.stage ?? 'centre');
  const overall = processing ? 1 : (progress?.overall ?? 0);

  return (
    <div className="scan">
      <div className="scan__stage">
        <video ref={videoRef} className="scan__video" playsInline muted />
        <GuideOverlay progress={progress} processing={processing} />

        {state.status !== 'running' && (
          <div className="scan__notice">
            {state.status === 'starting' && 'Starting the camera…'}
            {(state.status === 'denied' ||
              state.status === 'error' ||
              state.status === 'paused') &&
              state.message}
          </div>
        )}
        {state.faceLost && state.status === 'running' && !processing && (
          <div className="scan__notice">Move back into the frame</div>
        )}
      </div>

      <div className="scan__panel">
        <div className="scan__stagename">{STAGE_LABEL[stage]}</div>
        <p className="scan__hint">
          {processing ? 'Building your face model…' : (progress?.hint ?? 'Look straight ahead')}
        </p>

        <div className="progress">
          <div className="progress__fill" style={{ transform: `scaleX(${overall})` }} />
        </div>

        <div className="scan__bins">
          <BinRow label="Left / right" filled={progress?.filledYaw ?? []} />
          <BinRow label="Up / down" filled={progress?.filledPitch ?? []} />
        </div>

        {progress?.warning && !processing && (
          <div className="scan__warning">{progress.warning}</div>
        )}

        <p className="scan__why">
          Turning your head is what makes the measurements real — a single
          straight-on frame flattens exactly the parts that decide how glasses
          sit: bridge depth, temple length and where your ears are.
        </p>

        <button className="button button--ghost" onClick={() => go('landing')}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function BinRow({ label, filled }: { label: string; filled: boolean[] }) {
  return (
    <div className="bins">
      <span className="bins__label">{label}</span>
      <span className="bins__dots">
        {(filled.length ? filled : [false, false, false, false, false]).map((on, i) => (
          <i key={i} className={on ? 'bins__dot bins__dot--on' : 'bins__dot'} />
        ))}
      </span>
    </div>
  );
}

/**
 * The dial that tells the customer where their head is pointed.
 *
 * A crosshair moved by yaw and pitch, with the target zone for the current
 * stage drawn behind it. People turn their heads far too little when asked in
 * words and about right when given a dot to move.
 */
function GuideOverlay({
  progress,
  processing,
}: {
  progress: ScanProgress | null;
  processing: boolean;
}) {
  if (processing) {
    return (
      <div className="guide guide--processing">
        <div className="guide__spinner" />
      </div>
    );
  }
  if (!progress) return null;

  // Mirrored preview, so a turn to the subject's right moves the dot right.
  const x = 50 - clamp(progress.yawDeg / 40, -1, 1) * 42;
  const y = 50 - clamp(progress.pitchDeg / 26, -1, 1) * 42;

  return (
    <div className="guide">
      <svg viewBox="0 0 100 100" className="guide__svg" aria-hidden>
        <ellipse cx="50" cy="50" rx="28" ry="38" className="guide__oval" />
        {progress.stage === 'yaw' && <rect x="6" y="44" width="88" height="12" rx="6" className="guide__zone" />}
        {progress.stage === 'pitch' && <rect x="44" y="6" width="12" height="88" rx="6" className="guide__zone" />}
        <circle cx={x} cy={y} r="3.4" className="guide__dot" />
      </svg>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
