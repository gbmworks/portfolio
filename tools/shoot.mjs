/* ------------------------------------------------------------------
   Capture a still from a page that draws with WebGL.

     node tools/serve.mjs                        # in another shell
     node tools/shoot.mjs out.png <url> [opts]

     --size WxH        viewport, default 1600x1000
     --phone           emulate a device at that size (Chrome will not
                       make a real window narrower than ~500px)
     --wait ms         after load, before anything else — default 9000
     --click "text"    click the first .tab / button whose text matches
     --drag dx,dy      orbit: a press, 24 moves, a release, from centre
     --zoom n          wheel ticks at centre; negative is closer
     --probe "expr"    print the value of one expression before shooting

   Why this exists rather than a screenshot from the automated tab: an
   automated or backgrounded tab reports `visibilityState: hidden`, and
   a hidden tab **never runs requestAnimationFrame**. For a DOM
   animation that means frame counts of zero (see tools/reel-test.mjs).
   For a WebGL canvas it is worse — three.js renders inside a rAF loop,
   so nothing is ever painted and the capture is an empty rectangle with
   the page's UI on top of it.

   So this launches a real Chrome and attaches over the DevTools
   protocol. Two flags matter and are easy to get wrong:

     --use-angle=swiftshader --enable-unsafe-swiftshader

   `--disable-gpu` on its own — which reel-test.mjs uses, correctly, for
   a CSS animation — leaves a WebGL page with no context at all.

   Node 24 has a native WebSocket, so this needs no packages.

   It produced assets/covers/eyewear-builder.jpg with the command below.
   That reproduces the *shot*, not the bytes: SwiftShader's render and the
   24-step drag both carry a little timing jitter, so a re-run lands on
   the same composition about 60 bytes away from the last one. Re-run it
   to replace the cover, not to verify it.

     node tools/shoot.mjs eyewear.png http://127.0.0.1:8123/studio/eyewear/ \
       --click Design --drag -150,-40 \
       --probe "document.querySelector('.viewbar__hint').textContent"
     ffmpeg -i eyewear.png -vf "scale=1400:-2:flags=lanczos" -q:v 4 \
       assets/covers/eyewear-builder.jpg
   ------------------------------------------------------------------ */

import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!CHROME) throw new Error('no Chrome found — add its path to the list at the top of this file');

/* --- arguments ----------------------------------------------------- */

const argv = process.argv.slice(2);
const OUT = argv[0];
const URL_ = argv[1];
if (!OUT || !URL_ || OUT.startsWith('--')) {
  console.error('usage: node tools/shoot.mjs out.png <url> [--size WxH] [--phone]');
  console.error('       [--wait ms] [--click "text"] [--drag dx,dy] [--zoom n] [--probe expr]');
  process.exit(1);
}
const flag = (name, fallback = null) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? fallback : (argv[i + 1] ?? true);
};
const has = (name) => argv.includes('--' + name);

const [W, H] = String(flag('size', '1600x1000')).split('x').map(Number);
const WAIT = Number(flag('wait', 9000));
const CLICK = flag('click');
const [DX, DY] = String(flag('drag', '0,0')).split(',').map(Number);
const ZOOM = Number(flag('zoom', 0));
const PROBE = flag('probe');
const PHONE = has('phone');
const PORT = 9336;

/* --- launch and attach --------------------------------------------- */

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shoot-'))}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  `--window-size=${W},${H}`, '--hide-scrollbars',
  /* SwiftShader, not --disable-gpu — see the header. */
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  URL_,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();

for (let i = 0; i < 60 && !ws; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) continue;
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
  } catch { ws = null; }
}
if (!ws) { chrome.kill(); throw new Error('could not attach to Chrome'); }

const send = (method, params = {}) => new Promise((res) => {
  const n = ++id; pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.error('  eval threw:', r.result.exceptionDetails.text);
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');

if (PHONE) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 2, mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.reload');
}

await sleep(2500);

/* The two answers that explain an empty canvas, before anything else. */
console.log('visibility :', await evaluate('document.visibilityState'), '(must be visible)');
console.log('webgl2     :', await evaluate(`!!document.createElement('canvas').getContext('webgl2')`));

/* --- drive --------------------------------------------------------- */

if (CLICK) {
  console.log('click      :', await evaluate(`
    (() => {
      const re = ${JSON.stringify(String(CLICK))};
      const el = [...document.querySelectorAll('button, a, .tab')]
        .find(b => b.textContent.trim().includes(re));
      if (!el) return 'no match for ' + re;
      el.click();
      return 'clicked ' + (el.className || el.tagName);
    })()`));
}

await sleep(WAIT);

const cx = Math.round(W / 2), cy = Math.round(H / 2);

if (DX || DY) {
  /* A real drag, so the scene's own controls do the framing and an idle
     turntable stands down the way it does for a hand on a mouse. */
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1, buttons: 1 });
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', button: 'left', buttons: 1,
      x: cx + Math.round((DX * i) / steps), y: cy + Math.round((DY * i) / steps),
    });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + DX, y: cy + DY, button: 'left', buttons: 0 });
}

if (ZOOM) {
  for (let i = 0; i < Math.abs(ZOOM); i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cx, y: cy, deltaX: 0, deltaY: ZOOM < 0 ? -100 : 100 });
    await sleep(90);
  }
}

if (DX || DY || ZOOM) {
  /* Park the cursor in a corner: no hover chrome in the shot, and no
     idle animation restarted under it. */
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: H - 4 });
  await sleep(1400);
}

if (PROBE) console.log('probe      :', await evaluate(String(PROBE)));

/* --- capture ------------------------------------------------------- */

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
if (!shot.result?.data) {
  console.error('no screenshot data came back');
  ws.close(); chrome.kill(); process.exit(1);
}
const png = Buffer.from(shot.result.data, 'base64');
writeFileSync(OUT, png);
console.log('wrote      :', OUT, (png.length / 1024).toFixed(0) + ' KB');

ws.close(); chrome.kill(); process.exit(0);
