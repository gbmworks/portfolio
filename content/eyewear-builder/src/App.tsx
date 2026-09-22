import { useEffect, useState } from 'react';

import { EditorView } from './components/EditorView';
import { Landing } from './components/Landing';
import { ResultView } from './components/ResultView';
import { ScanView } from './components/ScanView';
import { TryOnView } from './components/TryOnView';
import { useStore } from './state/store';
import { sound } from './ui/sound';

export function App() {
  const route = useStore((s) => s.route);
  const scan = useStore((s) => s.scan);
  const go = useStore((s) => s.go);

  useDemoScan();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__id">
          <BackToPortfolio />
          <button
            className="topbar__brand"
            onClick={() => {
              sound.tap();
              go('landing');
            }}
          >
            {/* The second word is dropped on a narrow bar. The first is still
                the app's name, still routes to the landing screen, and costs
                half the width -- see the note in the stylesheet. */}
            Eyewear<span className="topbar__word">&nbsp;Builder</span>
          </button>
        </div>
        <nav className="topbar__nav">
          <button
            className={route === 'editor' ? 'tab tab--on' : 'tab'}
            onClick={() => {
              sound.tap();
              go('editor');
            }}
          >
            Design
          </button>
          <button
            className={route === 'tryon' || route === 'scan' ? 'tab tab--on' : 'tab'}
            onClick={() => {
              sound.tap();
              go('tryon');
            }}
          >
            <span className="topbar__word">3D&nbsp;try-on</span>
            <span className="topbar__short">Try-on</span>
          </button>
          {/* Only once there is something to show. A tab that is permanently
              greyed out is a promise the app keeps failing to keep. */}
          {scan && (
            <button
              className={route === 'result' ? 'tab tab--on' : 'tab'}
              onClick={() => {
                sound.tap();
                go('result');
              }}
            >
              <span className="topbar__word">Measurements</span>
              {/* The page it opens is headed "A parametric model of your
                  face", so the short form is the page's own word rather than
                  an abbreviation of this one. */}
              <span className="topbar__short">My&nbsp;face</span>
            </button>
          )}
          <SoundToggle />
        </nav>
      </header>

      <main className="main">
        {route === 'landing' && <Landing />}
        {route === 'editor' && <EditorView />}
        {route === 'scan' && <ScanView />}
        {route === 'result' && (scan ? <ResultView /> : <Landing />)}
        {route === 'tryon' && <TryOnView />}
      </main>
    </div>
  );
}

/**
 * The way out, first thing in the bar.
 *
 * This is a piece inside a portfolio before it is an app, and somebody who
 * opened it from the Technical Art page should not have to reach for the
 * browser's own back button -- especially on a phone, where the app fills the
 * viewport and there is no site chrome left around it.
 *
 * It lands on the Technical Art index rather than the site root: the root
 * throws away everything the visitor had just walked to, and the sector page
 * is where the rest of the work of this kind is.
 *
 * Relative, like every asset in here, so it resolves from /studio/eyewear/ on
 * the portfolio. Unlike a bare `../../` it is a deep link, so it only works
 * there -- a standalone dev server has no technical-art.html to reach, which
 * is why it renders only when one is a plausible two levels up.
 */
function BackToPortfolio() {
  if (!servedFromPortfolio()) return null;
  return (
    <a
      className="topbar__back"
      href="../../technical-art.html"
      title="Back to Technical Art"
      aria-label="Back to Technical Art"
      onClick={() => sound.tap()}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </a>
  );
}

/**
 * Is there a portfolio two levels up to go back to?
 *
 * The deploy lands this app at `<site>/studio/eyewear/`, so the test is that
 * the path has at least those two segments above the document. A dev server
 * at the root -- `/` or `/?demo` -- has nothing above it, and a dead arrow is
 * worse than no arrow: the link would 404 rather than do nothing visible.
 */
function servedFromPortfolio(): boolean {
  const depth = window.location.pathname.split('/').filter(Boolean).length;
  return window.location.pathname.endsWith('/') ? depth >= 2 : depth >= 3;
}

/**
 * The switch for the interface's voice.
 *
 * In the top bar rather than buried in a settings panel, because the only
 * person who wants it is someone who has just heard a sound they did not
 * expect, and they will look where the sound came from -- the chrome -- not
 * for a preferences screen.
 */
function SoundToggle() {
  const [on, setOn] = useState(sound.enabled);
  return (
    <button
      className={on ? 'soundbtn soundbtn--on' : 'soundbtn'}
      onClick={() => setOn(sound.toggle())}
      title={on ? 'Mute interface sounds' : 'Unmute interface sounds'}
      aria-pressed={on}
    >
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4z" />
        {on ? (
          <>
            <path d="M15.6 9.3a3.8 3.8 0 0 1 0 5.4" />
            <path d="M18.2 6.7a7.5 7.5 0 0 1 0 10.6" />
          </>
        ) : (
          <path d="M16.2 9.8 20.6 14.2M20.6 9.8 16.2 14.2" />
        )}
      </svg>
      <span className="sr-only">{on ? 'Interface sounds on' : 'Interface sounds off'}</span>
    </button>
  );
}

/**
 * `?demo` loads MediaPipe's canonical face and completes a scan with it.
 *
 * Without this the result screen can only be reached by standing in front of a
 * webcam, which makes reviewing the measurements or the shape read-out
 * impossible on a machine without a camera, in a screenshot, or for anyone who
 * just wants to see what the output looks like.
 * The canonical model is the average face the landmarker is fitted against, so
 * what comes out is a real run of the real pipeline, not a mock.
 *
 * Development only -- the import is dynamic so the fixture never reaches a
 * production bundle.
 */
function useDemoScan(): void {
  const completeScan = useStore((s) => s.completeScan);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!new URLSearchParams(window.location.search).has('demo')) return;
    if (useStore.getState().scan) return;

    let cancelled = false;
    void (async () => {
      const { canonicalRectified } = await import('./dev/canonicalFace');
      if (cancelled) return;
      const mesh = await canonicalRectified();
      completeScan(mesh, mesh, 21);
    })().catch((error: unknown) => {
      console.error('[demo] could not load the canonical face', error);
    });

    return () => {
      cancelled = true;
    };
  }, [completeScan]);
}
