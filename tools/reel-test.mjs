/* ------------------------------------------------------------------
   Check the reel's drift in a browser that will actually run it.

   Why this exists rather than a line of console in devtools: an
   automated or backgrounded tab reports `visibilityState: hidden`, and
   a hidden tab **never runs requestAnimationFrame**.  Screenshots still
   render, the page still looks right, and every frame count and scroll
   measurement silently comes back zero.  Two real bugs in `js/reel.js`
   hid behind that for as long as the drift existed.

   So this launches a real Chrome, attaches over the DevTools protocol,
   and asks the two questions worth asking:

     1. with the strip off screen, does its loop stay stopped?
     2. scrolled into view, does the strip actually move?

   Node 24 has a native WebSocket, so this needs no packages and no
   install step — which is the whole reason it is 90 lines and not a
   Playwright dependency.

       node tools/serve.mjs                       # in another shell
       node tools/reel-test.mjs                   # local
       node tools/reel-test.mjs https://www.govindbmohan.com/

   Run it against the live site as a control when you change anything in
   `reel.js`: a number on its own proves very little, and "the same as
   production" or "different from production" is the useful answer.

   Expected with both fixes in place, on a machine that manages ~25fps
   headless: ~14 rAF/s off screen against ~26 with a second loop alive,
   and 20-30px of drift in three seconds against 0.0px when snap is
   holding it still.
   ------------------------------------------------------------------ */

import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!CHROME) throw new Error('no Chrome found — add its path to the list at the top of this file');

const URL_ = process.argv[2] ?? 'http://127.0.0.1:8123/index.html';
const PORT = 9334;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'reel-'))}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,900', '--disable-gpu', URL_,
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();

for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) continue;
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
  } catch { ws = null; }
}
if (!ws) { chrome.kill(); throw new Error('could not attach to Chrome'); }

const send = (method, params = {}) => new Promise(res => {
  const n = ++id; pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await sleep(6500);   // the intro holds for 3s, then the stage comes up

/* Count every frame scheduled, whoever schedules it.  The stage's own
   loop runs regardless and is not the subject; what matters is whether a
   *second* loop is alive while the strip is nowhere near the screen. */
await evaluate(`
  window.__n = 0;
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (cb) { window.__n++; return raf.call(window, cb); };
  window.__mark = () => { const n = window.__n; window.__n = 0; return n; };
  window.__mark(); 'ok'`);

await sleep(2500);
const off = await evaluate(`({
  fps: Math.round(window.__mark() / 2.5),
  scrollLeft: document.querySelector('.reel__track').scrollLeft
})`);

await evaluate(`document.querySelector('#reel').scrollIntoView({behavior:'instant', block:'center'}); 'ok'`);
await sleep(1200);
const before = await evaluate(`document.querySelector('.reel__track').scrollLeft`);
const snapDuring = await evaluate(`document.querySelector('.reel__track').style.scrollSnapType || '(unset)'`);
await evaluate(`window.__mark(); 'ok'`);
await sleep(3000);
const on = await evaluate(`({
  fps: Math.round(window.__mark() / 3),
  scrollLeft: document.querySelector('.reel__track').scrollLeft,
  isIn: document.querySelector('#reel').classList.contains('is-in')
})`);

/* and that it hands the strip back the moment a pointer arrives */
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 450 });
await sleep(800);
const after = await evaluate(`({
  computed: getComputedStyle(document.querySelector('.reel__track')).scrollSnapType,
  inline: document.querySelector('.reel__track').style.scrollSnapType || '(cleared)'
})`);

console.log(URL_);
console.log('  OFF screen   rAF/s', String(off.fps).padStart(3), ' scrollLeft', off.scrollLeft);
console.log('  ON  screen   rAF/s', String(on.fps).padStart(3), ' is-in', on.isIn);
console.log('               snap while drifting :', snapDuring);
console.log('               drifted', (on.scrollLeft - before).toFixed(1) + 'px in 3s',
            `(${before} -> ${on.scrollLeft}, nominal 14px/s)`);
console.log('  AFTER mouse  snap back to        :', after.computed, '/ inline', after.inline);

ws.close(); chrome.kill(); process.exit(0);
