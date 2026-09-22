/**
 * Camera plumbing and the per-frame tracking loop.
 *
 * One webcam stream and one landmarker are shared across the scan and the
 * try-on. Both views mount and unmount as the customer moves between them, and
 * tearing the camera down and back up each time costs a second of black screen
 * and a fresh permission flicker in some browsers, so the stream is reference
 * counted and kept alive for a short grace period instead.
 *
 * The reference counting is the delicate part. Every `acquire` must be matched
 * by exactly one `release`, including on the paths where the effect is torn
 * down while `getUserMedia` is still in flight -- and React's StrictMode runs
 * mount / unmount / mount in development precisely to shake those paths out.
 * Getting it wrong is not a leak but the opposite: a double release drops the
 * count to zero while a live view still holds the stream, and the grace timer
 * then stops the tracks underneath it. The symptom is a picture that works for
 * a few seconds and then goes black with the face reported lost.
 */

import { useEffect, useRef, useState } from 'react';

import { getLandmarker, toSample, type FaceSample } from './landmarker';

let shared: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;
let refCount = 0;
let releaseTimer: number | null = null;

/** How long the stream survives with no holders, so navigation does not flicker. */
const GRACE_MS = 4000;

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    // 720p is the sweet spot: the landmarker downsamples to 256 px internally,
    // so a 1080p feed costs bandwidth and decode time without improving a
    // single landmark, while 480p visibly softens the preview.
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
    frameRate: { ideal: 30 },
  },
};

async function acquire(): Promise<MediaStream> {
  if (releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  refCount++;

  if (shared && shared.active) return shared;

  // Share the in-flight request. Two views mounting in the same tick -- which
  // StrictMode guarantees in development -- would otherwise each see `shared`
  // still null and open a second camera, and the first stream would be
  // orphaned with its light still on.
  if (!pending) {
    pending = navigator.mediaDevices
      .getUserMedia(CONSTRAINTS)
      .then((stream) => {
        shared = stream;
        return stream;
      })
      .finally(() => {
        pending = null;
      });
  }

  try {
    return await pending;
  } catch (error) {
    // The count was incremented optimistically so a concurrent release could
    // not stop a stream this call is about to use. Give it back on failure,
    // or the stream can never be torn down afterwards.
    refCount = Math.max(0, refCount - 1);
    throw error;
  }
}

function release(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  releaseTimer = window.setTimeout(() => {
    shared?.getTracks().forEach((t) => t.stop());
    shared = null;
    releaseTimer = null;
  }, GRACE_MS);
}

/**
 * Run the callback once per decoded video frame.
 *
 * `requestVideoFrameCallback` is the right driver for a video pipeline and
 * `requestAnimationFrame` is not. rAF fires on the *display's* refresh, so on
 * a 120 Hz screen it runs four times per 30 fps camera frame -- three of those
 * hand the landmarker an image it has already analysed. rVFC fires once per
 * frame that actually decoded, which is exactly the work that needs doing.
 *
 * The rAF fallback keeps the duplicate guard it needs; rVFC does not need one.
 */
function eachVideoFrame(video: HTMLVideoElement, run: () => void): () => void {
  let stopped = false;

  if ('requestVideoFrameCallback' in video) {
    let handle = 0;
    const step = () => {
      if (stopped) return;
      handle = video.requestVideoFrameCallback(step);
      run();
    };
    handle = video.requestVideoFrameCallback(step);
    return () => {
      stopped = true;
      video.cancelVideoFrameCallback?.(handle);
    };
  }

  let raf = 0;
  const step = () => {
    if (stopped) return;
    raf = requestAnimationFrame(step);
    run();
  };
  raf = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

export type TrackingStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'denied'
  | 'error';

export interface TrackingState {
  status: TrackingStatus;
  message: string | null;
  /** True between frames where no face was found, for the "step back" prompt. */
  faceLost: boolean;
}

/**
 * @param active whether to run. Set false to pause without unmounting.
 * @param onFrame called once per tracked frame. Kept in a ref internally, so
 *   passing an inline closure does not restart the camera.
 */
export function useFaceTracking(
  active: boolean,
  onFrame: (sample: FaceSample, video: HTMLVideoElement) => void,
): { videoRef: React.RefObject<HTMLVideoElement | null>; state: TrackingState } {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const callbackRef = useRef(onFrame);
  callbackRef.current = onFrame;

  const [state, setState] = useState<TrackingState>({
    status: 'idle',
    message: null,
    faceLost: false,
  });

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let lastTimestamp = -1;
    let missedFrames = 0;
    let stopLoop: (() => void) | null = null;

    // Exactly one release per successful acquire, whichever path gets there
    // first: the cleanup below, or the cancelled check inside `run`.
    let holdsStream = false;
    const releaseOnce = () => {
      if (!holdsStream) return;
      holdsStream = false;
      release();
    };

    let stopWatchdog: (() => void) | null = null;

    const run = async () => {
      setState({ status: 'starting', message: 'Waking up the camera', faceLost: false });
      try {
        // Acquired on its own rather than inside a Promise.all: if the
        // landmarker fails to load, a combined await would reject without ever
        // telling us the stream had been handed over, and it would be stranded.
        const stream = await acquire();
        holdsStream = true;

        const landmarker = await getLandmarker();
        if (cancelled) {
          releaseOnce();
          return;
        }

        const video = videoRef.current;
        if (!video) throw new Error('Video element went away');
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        // A play() interrupted by a re-render rejects with AbortError. That is
        // noise on a teardown path, not a failure worth showing anyone.
        await video.play().catch((error: unknown) => {
          if (!cancelled) throw error;
        });
        if (cancelled) {
          releaseOnce();
          return;
        }

        setState({ status: 'running', message: null, faceLost: false });

        // If the tracks ever stop while we are still using them -- the user
        // revoking permission, unplugging a webcam, another app seizing it, or
        // a reference-counting mistake in here -- say so. Silently showing
        // black and blaming the customer for leaving the frame is the worst
        // possible failure for a scanner.
        const onEnded = () => {
          if (cancelled) return;
          setState({
            status: 'error',
            message: 'The camera stopped. Check nothing else is using it, then reload.',
            faceLost: false,
          });
        };
        const tracks = stream.getVideoTracks();
        for (const track of tracks) track.addEventListener('ended', onEnded);

        // Both rVFC and rAF are suspended while the tab is hidden, so a scan
        // left in a background tab does not advance. Say that, rather than
        // leaving a frozen progress bar and a prompt the customer cannot
        // satisfy.
        const onVisibility = () => {
          if (cancelled) return;
          const hidden = document.visibilityState === 'hidden';
          setState((prev) =>
            prev.status === 'denied' || prev.status === 'error'
              ? prev
              : {
                  status: hidden ? 'paused' : 'running',
                  message: hidden ? 'Paused — come back to this tab to carry on' : null,
                  faceLost: false,
                },
          );
        };
        document.addEventListener('visibilitychange', onVisibility);
        // Fire once: the event only reports a *change*, so a scan opened in a
        // tab that is already in the background would otherwise sit there
        // claiming to be running while no frames are decoded at all.
        onVisibility();

        stopWatchdog = () => {
          for (const track of tracks) track.removeEventListener('ended', onEnded);
          document.removeEventListener('visibilitychange', onVisibility);
        };

        stopLoop = eachVideoFrame(video, () => {
          if (video.readyState < 2 || video.videoWidth === 0) return;

          // detectForVideo rejects a repeated or out-of-order timestamp, and a
          // rAF fallback can fire twice inside one camera frame on a 120 Hz
          // display. Monotonic by construction, so it is safe either way.
          const timestamp = performance.now();
          if (timestamp <= lastTimestamp) return;
          lastTimestamp = timestamp;

          const result = landmarker.detectForVideo(video, timestamp);
          const sample = toSample(result, video.videoWidth / video.videoHeight, timestamp);

          if (sample) {
            missedFrames = 0;
            callbackRef.current(sample, video);
          } else {
            missedFrames++;
          }

          // Hysteresis: a single dropped detection is normal during a blink or
          // a fast turn, and flashing "no face" at every one of them is worse
          // than useless.
          const lost = missedFrames > 12;
          setState((prev) => (prev.faceLost === lost ? prev : { ...prev, faceLost: lost }));
        });
      } catch (error) {
        releaseOnce();
        if (cancelled) return;
        const denied =
          error instanceof DOMException &&
          (error.name === 'NotAllowedError' || error.name === 'SecurityError');
        setState({
          status: denied ? 'denied' : 'error',
          message: denied
            ? 'Camera access was blocked. Allow it in the address bar and reload.'
            : error instanceof Error
              ? error.message
              : 'Could not start the camera',
          faceLost: false,
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
      stopLoop?.();
      stopWatchdog?.();
      const video = videoRef.current;
      // Detach without stopping: the stream may still be held by another view,
      // and calling stop() here is what would kill a shared camera.
      if (video) video.srcObject = null;
      releaseOnce();
    };
  }, [active]);

  return { videoRef, state };
}
