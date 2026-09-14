# Working notes

For whoever picks this up next, me included. Three files, three jobs:

| file | answers |
|---|---|
| `README.md` (root) | **how the site works today** — the reference |
| `content/WORKLOG.md` | **why it is like that** — the history, and what was tried and failed |
| `content/NOTES.md` | **how to work on it** — this file: commands, traps, current state |

---

## Where to push

```
upstream  gbmworks/portfolio        ← THE LIVE SITE. Pages builds from main here.
origin    gbmPrimetrace/portfolio     a fork with no Pages site
```

**`git push upstream main` is the deploy.** There is no build step on the
host and no CI — the repo root *is* the site.

**`origin` cannot be pushed from this machine, and that is not a sandbox
problem.** This clone is authenticated as `gbmworks`, and that account has
no write access to the fork — checked, not guessed:

```bash
gh api repos/gbmPrimetrace/portfolio --jq .permissions   # push:false, admin:false
git push origin main                                     # remote rejected: permission denied
gh api repos/gbmPrimetrace/portfolio/collaborators/gbmworks -i | head -1   # 403
```

An earlier version of this file said to push `origin` too. Do not spend
time on it. It needs one of: `gbmworks` added as a collaborator on the
fork, `gh auth login` as `gbmPrimetrace`, or the remote dropped. Until
then the fork drifts and **nothing on the live site depends on it** —
Pages builds from `upstream`.

**So if you ever find yourself on a clone of the fork, you are behind.**
The work is on `upstream`, not on `origin`:

```bash
git remote add upstream https://github.com/gbmworks/portfolio.git   # if missing
git fetch upstream
git log --oneline main..upstream/main     # what you are missing
git merge --ff-only upstream/main         # or: git reset --hard upstream/main
```

Pages takes 30-90 seconds. **Ask Pages whether it built, rather than
polling the site** — a 404 on a new asset ten seconds after a push tells
you nothing, and a loop with no sleep in it tells you nothing twelve
times:

```bash
gh api repos/gbmworks/portfolio/pages/builds/latest --jq '.status + " " + .commit'
```

`building` → `built`, with your own SHA, is the signal. Then check the
bytes and not the status code:

```bash
curl -sI https://www.govindbmohan.com/assets/cv/govind-b-mohan-cv-2026.pdf | grep -i content-type
curl -s https://www.govindbmohan.com/js/shell.js | grep -c topbar__about   # a string only the new build has
```

A `200` proves a file is there; grepping the served module proves it is
*the one you just wrote*. Both are worth it before telling anyone it is
live.

### When the build never starts

Seen on 2026-09-13, and worth recognising rather than re-diagnosing. The
shape of it:

- the commit **is** on the remote — `git ls-remote upstream refs/heads/main`
  matches `git rev-parse main`
- `gh run list --repo gbmworks/portfolio` shows **no
  `pages-build-deployment` run for that SHA** — the newest run is for an
  older commit
- the build record exists but never moves: `status=building`,
  `duration=0`, `updated_at == created_at`, for tens of minutes against a
  normal 24-36s
- `gh api -X POST .../pages/builds` answers **500 or 502** — it cannot
  queue another while one is stuck in flight
- githubstatus.com says Pages is operational with no incidents

So a build record is created on push but nothing picks it up. Pushing
again does create a *new* record, and marks the previous one `errored`
at the same second — that `errored` is **supersession, not a content
failure**, and "Page build failed." with `duration: 0` carries no
detail. Don't go hunting your own markdown for it. It is worth ruling
out Liquid anyway, once, because it is the one thing that genuinely
breaks a Pages build from content: `grep -c '{{\|{%'` the changed
files, and confirm `.nojekyll` is still tracked.

**What not to do:** keep pushing. Each push supersedes the queued build
and adds noise for no gain. **What is left** is the repo owner toggling
the Pages source off and back on in Settings, or GitHub Support — both
of which touch a live site, so they are the owner's call and not
something to do unasked.

**The site keeps serving the last good build throughout.** That is the
thing to check and to say first: `6817efa` stayed up and correct for the
whole incident. A wedged build is the *next* deploy not arriving, not
the current one breaking.

**How this one actually ended, 2026-09-14.** Nobody touched Settings and
nobody opened a ticket. `e73ab7c` sat at `building`, `duration=0`, for
**29 hours**. The next ordinary push — `970f171`, a day later — was
picked up in the normal way: a `pages-build-deployment` run appeared for
that SHA within a second, and it was `built` in 31s. The stuck record
flipped to `errored` at the same second, supersession as always.

So the honest version is: **it cleared itself, and the wait was the
cure.** "Keep pushing" is still the wrong move — what made this one work
was one push after a long gap, not six in ten minutes. If it happens
again, the order is: confirm the site is still serving, confirm the
commit is on the remote, then leave it alone and push the next real
change when you have one. Toggling the Pages source and Support are
still what is left after *that*, but they are further down the list than
this file used to imply.

HTTPS is enforced (since 2026-09-09), so `http://` and the bare apex both
`301` to `https://www.govindbmohan.com/…` with the path kept. That is a
repo setting, not a file:

```bash
gh api -X PUT repos/gbmworks/portfolio/pages -F https_enforced=true
```

`-F` sends a real boolean. `-f` sends the string `"true"` and 422s.

## The loop

```bash
node tools/serve.mjs                 # http://127.0.0.1:8123 — use THIS, not python
# edit content/allocation_new.csv to change what is on a page
node tools/allocate.mjs              # -> js/pages.js   (refuses to write on a typo)
node tools/sitemap.mjs               # -> sitemap.xml
```

`python -m http.server` sends no `Cache-Control` and answers `200` to a
Range request instead of `206`. That means stale modules that look like
edits not working, and videos stuck at `readyState 0`. Hours went into
this once already.

For the two things that run:

```bash
cd content/Unicorn && npm run deploy            # webpack   -> game/unicorn    (16 MB)
cd content/Fitmint/AvatarStudio && npm run deploy   #          -> studio/fitmint  (19 MB)
```

Neither needs its heavy build re-run to redeploy — both copy from what is
already on disk, and both refuse to write if something is missing.

## Checks worth re-running before a push

Every entry has a title, a picture, a destination, and the files exist:

```bash
node --input-type=module -e "
import { pageEntries } from './js/projects.js';
import { SECTIONS } from './js/sectors.js';
import { existsSync } from 'node:fs';
for (const s of SECTIONS) for (const e of pageEntries(s.id)) {
  const bad = !e.title || !e.href || (!e.still && !e.clip) ||
    (e.still?.startsWith('assets/') && !existsSync(e.still));
  if (bad) console.log('PROBLEM', s.id, e.title);
}
console.log('checked');"
```

Every page still boots — load them in hidden iframes from a page on the
dev server and read `data-ready`, which is only set after the stage comes
up. `404.html` and `game/unicorn/` never set it; everything else must.

Every `live:` target is actually on disk — a record whose row runs
something has to have been deployed:

```bash
node --input-type=module -e "
import { PROJECTS } from './js/projects.js';
import { existsSync } from 'node:fs';
for (const p of PROJECTS.filter(p => p.live))
  console.log(existsSync(p.live + 'index.html') ? 'ok  ' : 'GONE', p.live, '|', p.liveLabel);"
```

Generators are idempotent: run `allocate` and `sitemap` twice and the
files should not change.

## Adding footage

Rendered work: CRF 34, long edge 1080, and leave it alone afterwards —
see the README. **Handheld phone video of a screen is the exception**
and wants denoising first, which is worth 85% on a 4K 60fps capture:

```bash
ffmpeg -i in.mp4 -c:v libvpx-vp9 -crf 40 -b:v 0 -an -r 30   -vf "hqdn3d=3:3:6:6,scale=w='min(720,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease"   assets/web/TD/out.webm
node tools/media.mjs posters
```

## The design detector

`impeccable` is installed globally and its hooks are registered in this
project's `.claude/settings.local.json`. Run it by hand over a **URL**,
not a file — a file scan sees the CSS, a URL scan sees the rendered
result, and that is where type size, contrast and hero structure live:

```bash
I="$HOME/.claude/skills/impeccable/scripts/impeccable.cmd"
"$I" detect --json --viewport 390x844 http://127.0.0.1:8123/visualization.html
"$I" ignores list
```

Sweep all three device classes before shipping a visual change —
390x844, 820x1180, 1440x900. Nothing on this site is currently worse on
a phone than on a desktop, and that is worth keeping true.

Three rules are deliberately ignored in `.impeccable/config.json`, with
reasons attached: **Space Grotesk** (the text face — it sets every
paragraph on the site, which is the rule's whole complaint), **codex-grid-background** (the drafting sheet is a real
measurement surface, which the rule's own wording exempts), and
**buried-raster** in `tiles.js` (the lazy wall holds `.tile__el` at
opacity 0 until `is-ready`).

Four findings are left standing on purpose and should not be "fixed":

**Functional text holds at 11px — with seven exceptions, all on a phone
and all deliberate.** The rule was learned twice by shrinking labels to
make something else fit, and called back both times by
`undersized-ui-text`. It still holds everywhere the detector is not
listed below. What shrinks first is the icon, the padding, and any label
that restates what its buttons already say.

These seven the detector reports on `index.html` at 390x844, and they
are meant to be there:

| what | size | why |
|---|---|---|
| the three sector names on the wheel | 10px | each is also a 44px tap target with its own icon, and the alternative was a name printed through the hub. Most of the clearance came from `view.labelSeat`, not from here |
| `SELECT` / `A SECTOR` in the hub | 9.5 / 10.5px | the one place on the wheel with no work behind it was the widest run of type on it |
| the role line and the place line in the footer | 9.5px | supporting text under a closing card; at 11px the role line wrapped to two and competed with the name above it |

**The footer's email address is not one of them.** It holds 11px, because
it is the one thing down there somebody reads character by character and
may have to copy. If a future pass shrinks it to make something fit, that
is the rule doing its job — put it back.

| finding | why it stays |
|---|---|
| `all-caps-body`, `wide-tracking` | the mono label system *is* the identity |
| `dark-glow` | the one accent, used only on the CTA |
| `em-dash-overuse` | the writing voice |
| `1.1:1` on a sector title | false positive — the detector composites `.panel`'s gradient against the canvas and gets a nonsense number; the real pairing is white on near-black |

## Traps, in the order they will bite

**A programmatic scroll smaller than a snap threshold does not move.**
`scroll-snap-type: x proximity` on `.reel__track` with
`scroll-snap-align: start` on the cells is what makes a swipe land on a
card. It also silently killed the reel's idle drift for its whole life:
14 px/s is about 0.23 px per frame, every write lands inside the
proximity threshold, and the browser pulls it back before the next
frame. `scrollLeft` sits at 2 forever — verified on the live site, not
just locally, by driving Chrome over CDP. **This is still true of the
shipped build.** If you animate `scrollLeft` on a snapping container,
suspend `scroll-snap-type` for the duration and restore it after.

**A rAF loop that returns early still costs a frame.** The same file
re-requests a frame unconditionally and bails at the top when there is
nothing to do. That is not idling — it is sixty wake-ups a second for
the life of the tab, and Lighthouse charges ~2,300 ms of blocking time
to it for 63 ms of script. **Also still true of the shipped build.**
Cancel the loop; do not skip the work.

**Lighthouse TBT and TTI get *worse* when this site gets faster, and
that is not a bug in the change.** TTI wants five seconds of
main-thread quiet, and a page with a WebGL render loop never gives it
one — so TTI runs to the end of the trace and TBT accumulates across
the whole window from first paint to that. Self-hosting moved first
paint 1.6s earlier, which *widened* the TBT window from 4.8s to 11.9s
and made the number look four times worse while every metric a visitor
can feel improved. Read FCP, LCP and Speed Index on this site. Treat
TBT as a signal about the render loop specifically, and compare it only
between runs with a similar FCP.

**A hidden tab never runs rAF, so you cannot test animation in one.**
The browser this session drives reports `visibilityState: hidden`
permanently: screenshots still render, but `requestAnimationFrame`
never fires, so any frame-counting or drift measurement silently
returns nothing. Drive a real Chrome over CDP instead — Node 24 has a
native WebSocket, so it needs no packages. That is how both reel bugs
were confirmed.


1. **The heavy source is not in git.** `assets/media/` (328 MB),
   `content/Unicorn/dist/` (59 MB of models), `content/Fitmint/Male/`
   (92 MB of FBX and textures), `content/Fitmint/hdri/` and
   `content/Fitmint/AvatarStudio/assets/` are all local only. A fresh
   clone builds and serves fine but cannot re-deploy the game or the
   studio, or re-encode a clip. **Back those folders up somewhere that
   is not this repo.** (The README claims `assets/3d/*.blend` is in this
   list too; there are no .blend files on this machine outside the
   game's demo level.)
2. **The game's Draco decoder path must stay relative.** `draco/`, not
   `/`. Ten of its twenty models are compressed and the failure is a
   silent, empty island.
3. **The six stylesheets are order-dependent.** Their concatenation is
   byte-identical to the `style.css` they were cut from. Moving a rule
   between sheets can change which rule wins.
4. **`tuneTransmission()` does nothing** — the property landed in three.js
   r171, the import map pins r169. Left in place deliberately.
5. **The landing intro is 3 s** (`INTRO_MS` in `js/main.js`) and runs once
   per session, so it is easy to forget while working and it is the first
   thing to blame if the site feels slow to other people.
6. **The automated browser reports `visibilityState: "hidden"`**, so Chrome
   will not decode video in it. A blank `<video>` there is not a bug — check
   `networkState` and the codec before chasing it.
7. **A hidden tab does not run `requestAnimationFrame`,** which is the same
   fact wearing a different hat and it costs an hour if you meet it cold.
   Everything the wheel positions — the hub, the three labels, the rig's
   scale and seat — is damped toward its target inside the frame loop, so
   in a backgrounded tab it never arrives. `getBoundingClientRect()` on
   `#hub` returns `0,0` and the labels carry five-digit transforms, **while
   a screenshot of the same tab looks correct**, because capturing it makes
   it visible for long enough to advance a few frames. Do not measure the
   wheel through the DOM in an automated browser. Screenshot it, and take
   several in a row to let the damping settle.
8. **Phone emulation via window resize does not work here** — the resize
   reports success and `innerWidth` does not move (`outerWidth` reads 0).
   What does work is an iframe at the device size, served from the dev
   server so it is same-origin: the iframe is a real viewport, so media
   queries, layout and scrolling all behave. Give the inner document
   `scrollbar-width:none`, or a classic scrollbar steals 15px and every
   measurement is off by that much.

   `_devphone.html` at the repo root is that harness — page and device
   pickers across the four pages, a project and the studio. It is
   gitignored: it has to sit in the root to be same-origin with the site,
   and it must never ship. Open it at
   `http://127.0.0.1:8123/_devphone.html`.

## Current state

- **Three faces, three jobs, and the list of which is which lives in
  `css/base.css`.** `--display` is **Stack Sans Notch** (Koto, variable
  400-700, one 32 KB latin file) and sets the headings *only*: the
  splash wordmark and the bar's 14px copy of it, the landing hero, page
  and section titles, the panel subtitle. `--font` is **Space Grotesk**
  and still sets every paragraph, lede, blurb and small label. `--mono`
  is **JetBrains Mono** for the uppercase eyebrows, counters and
  back-links. The heading list is one rule in `base.css` rather than a
  `font-family` scattered across five sheets, so the question "what
  counts as a heading here?" has one place to read the answer — and one
  place to change it. `--display` falls back to Space Grotesk, so a
  failed font hop costs the shape of the titles and nothing else.
  Deliberately *not* in the list: the mono voice (a title needs
  something to be set against), body copy, and the 10-12.8px labels —
  `.tile__title`, `.label__title`, `.stage__title` — which read as
  captions on a picture, and where a face cut for 40px has nothing to
  show. Verified: the detector reports the identical findings before and
  after, on three pages at 390x844 and 1440x900, and every character in
  all 23 project titles and 3 section titles is inside the two subsets
  Google serves for it.
- Technical Art leads with the game (`live: 'game/unicorn/'` on the record
  in `projects.js`); clicking the row plays it. Nothing of the game loads
  until then — measured, zero requests under `game/` on a section load.
- ID 18 · TD 14 · VIZ 29, all 61 with a picture and a destination.
- The footer under the reel is built from `SOCIALS` in `site.js`, which
  drops any profile with no URL — so an unset one is absent rather than a
  dead link. All of them are set now, LinkedIn included.
- **The character is landing-page only.** `props: { hero: false }` in
  `page.js` keeps `PORTFOLIO.glb` off both section pages entirely — not
  hidden, never requested. Each section page is 222 KB now. The close-up
  framing is still in `buildVisualization()` if it is ever wanted back.
- **The landing page scrolls now.** Under the wheel is the reel — ten
  hand-picked pieces from `FEATURED` in `projects.js`, built by
  `js/reel.js` out of the same `.tile` the walls use. `body.has-reel` is
  what unlocks the scroll, and `main.js` only sets it if the reel
  mounted.
- **Two entries run rather than link**: the game at `game/unicorn/` and
  the avatar studio at `studio/fitmint/`, first and second on Technical
  Art. `live` + `liveLabel` + `liveFromRow` on the record is the whole
  mechanism, and a cold Technical Art load still fetches zero bytes of
  either — measured.
  - The **game** sets `liveFromRow`, so its row plays it.
  - The **studio** does not: its row opens the project page, and the big
    orange *Edit an avatar* button there opens the studio. `entryHref()`
    is the one function that decides this; rows, prev/next and the
    sitemap all call it.
  - Both carry their own **way back, and it lands on their own record**
    (`../../project.html?p=…`) — the game's `#exit` pill, dimmed but
    never removed once play starts, and the arrow in the studio's
    wordmark. The studio's needed `pointer-events:auto`, because
    `.brand` is `none` so a drag on the wordmark still orbits the
    avatar.

    These were `../../` — the site root — until 2026-09-13. The root
    threw away everything the visitor had just walked to. For the game
    it is worse than that: `liveFromRow` means its page is the one
    thing a player never sees, so the back link is the *only* route to
    it.

    **They are deep links now, so they only work on the portfolio.**
    The old `../../` resolved to something harmless wherever either was
    served; `project.html?p=…` has to be there. Both live in a build
    source — `content/Unicorn/dist/index.html` (tracked, one of two
    exceptions to the `dist/*` ignore) and
    `content/Fitmint/AvatarStudio/index.html` — and each needs its
    `node deploy.mjs` before the change is on the site.
- The Visualization mosaic reads **across**, not down — it is a CSS grid
  rather than multi-column, so row one is the sheet's first five entries —
  and it crops to **16:9 / 9:16** where every other wall stays at 4:3 / 3:4.
  Each piece is cropped to the **nearest of four** ratios — 9:16 / 3:4 /
  4:3 / 16:9, `nearestShape()` in `js/tiles.js` — and the grid packs on
  8px row tracks with per-tile spans set by a `ResizeObserver`, plus
  `dense` flow. Landscape cells span two columns. All of it is scoped to
  `body[data-layout="gallery"]` in `css/tiles.css`.

  **Check this wall by rendered ratio, not by attribute.** A stale
  `[data-orient="landscape"]` rule once sat later in the file at equal
  specificity and silently beat every `data-shape` rule; the attribute
  was written correctly the whole time. One-liner:

  ```js
  [...document.querySelectorAll('.tile')].filter(t=>{
    const r=t.querySelector('.tile__media').getBoundingClientRect();
    const want={'9x16':9/16,'3x4':3/4,'4x3':4/3,'16x9':16/9}[t.dataset.shape];
    return want && Math.abs(r.width/r.height-want)/want > 0.04;
  }).map(t=>t.dataset.title)   // must be []
  ```
- **Below 620px is its own tier**, not a scaled desktop: `body.is-phone`
  from `compose()` in `js/main.js`, and every rule hanging off it in
  `css/project.css`. The wheel is scaled to its labels rather than the
  other way round — **labels hold at 11px**, the detector's floor for UI
  text, and the wheel takes `0.78` to fit around them. Its vertical seat
  is measured, not nudged: `seatY()` centres it in the band between the
  top bar and the headline, so it composes on a 667px phone as well as a
  932px one. Check a phone change by screenshot, not by the numbers —
  see the trap about the throttled tab below.
- **The mosaic is two columns on a phone, and that is deliberate.** One
  column made each 9:16 tile 671px tall on an 844px screen: 29 pieces,
  18.8 screens, readable only one at a time. Two columns is 5.9 screens.
- **Nothing spans both of them.** A tile that spans *every* column is a
  barrier — the grid waits for both to be free, so the shorter one stops
  and holds a rectangle of nothing above the landscape piece. That was
  two real holes on the Viz wall at 390px, 191px and 279px, the second
  near the bottom where `dense` has nothing left to backfill with.
  Dropping the span in the two-column range took the wall from 5,824px
  to 4,696px with no hole anywhere. It survives at 3+ columns, where a
  span-2 tile still leaves a column open. **If you ever put it back,
  re-measure the tail** — this is the check:

  ```js
  const g=document.querySelector('.gal-grid'), gr=g.getBoundingClientRect();
  const it=[...g.children].map(t=>{const r=t.getBoundingClientRect();
    return {l:Math.round(r.left-gr.left),top:Math.round(r.top-gr.top),bot:Math.round(r.bottom-gr.top)};});
  [...new Set(it.map(t=>t.l))].flatMap(x=>{const c=it.filter(t=>t.l===x).sort((a,b)=>a.top-b.top);
    return c.slice(1).map((t,k)=>t.top-c[k].bot-14).filter(v=>v>4);})   // must be []
  ```
  Scroll the whole page first — `content-visibility:auto` means a tile
  that has never been on screen reports its guess, not its height.
- **Both walls and both layouts now carry the sector switcher.**
  `buildMosaic` takes `nav` alongside `foot`; `sectorNav()` is the one
  function that builds it, for the sheet and the mosaic alike.
- **The sheet pages carry a strip on phone and tablet.** `sheetReel()` in
  `js/page.js`, shown only where the preview stage is hidden (<=900px),
  styled as `.sreel` in `css/project.css`. In a strip the cards must be
  uniform: the crop is pinned to 4:3, the title clamped to two lines, and
  `contain-intrinsic-size` overridden — the wall's 340px guess is made by
  cards still off screen, and a flex track sized by those leaves a hole
  under the ones you can see.
- **The avatar studio's chrome is sized off two variables.** `--dock-w`
  (316px) and `--dock-h`. The camera rail and both floating bars position
  against the preview those leave, not against the window, so changing the
  dock moves all of them together.

  **`--dock-h` is measured, not written.** `trackDockObstruction()` in
  `src/main.js` observes the dock and writes its real height to the root
  every time it resizes; the value in the stylesheet is only what holds
  before the first measurement. That is what lets the dock be
  `height:auto` on a phone — 234px for a category with no colour picker,
  367px for one with. **Do not hardcode a dock height in the CSS and
  expect the bars to follow**; they follow the measurement.

  On a phone everything in the dock is a line you push along: the
  category rail (with arrows — `#railEnds()` in `src/ui.js` greys them at
  the ends), and the wardrobe grid. On a desktop the grid stays a grid,
  because the dock there is a tall column with the room for it.

  **The preview holds 70% of a phone screen.** The dock's ceiling is
  `calc(30dvh - 10px)` — the 10px it floats above the bottom counts
  against the 30%. One lever, one number: raise it and the preview
  shrinks. The known cost is that a category with a colour picker has
  ~126px of panel, so the H/S/B block is ~123px below the fold;
  `calc(35dvh - 10px)` trades back to a 65% preview if that stops being
  worth it.

  **`controls.maxDistance` is the hand-orbit ceiling, not a framing
  limit.** `frame()` in `src/viewer.js` raises it to whatever a shot needs
  and lets it fall back afterwards. It used to clamp the solver instead,
  which is how Fit came out 13% too close on a phone — it asked for 6.91
  and got 6, with nothing to say it had been overruled. The solve also
  runs against the *visible* axes, since the dock hides part of the canvas
  and shifting the picture into what is left is not the same as scaling it.

  **Edit the source and run `node deploy.mjs`** — `studio/fitmint/` is a
  build output, and editing it directly is undone by the next deploy.
- **Five** records still have no artwork — Primetrace, Metabrix,
  Freelance 2024, Hecoll and Diaz Goa — and are unlisted, so nothing
  renders as a bare plate. This line said four, and named the wrong
  four, for two sessions. Don't trust it; derive it:

  ```bash
  node --input-type=module -e "import('./js/projects.js').then(m=>console.log(m.PROJECTS.filter(p=>!p.cover&&!p.preview).map(p=>p.slug)))"
  ```
- **The top bar is identity and one About pill** — on all four page
  types. Contact came off it, then Resume: the CV is inside About, and a
  second door to the first room inside the first door is not a door.
  The PDF is at `assets/cv/govind-b-mohan-cv-2026.pdf` (`SITE.cv`, saved
  as `SITE.cvName`), and the About window carries the pair — *Resume
  (PDF)* and *Download* — because one link cannot both open and save.
  **Replacing the CV is a file swap, not a code change**: keep the path,
  and `tools/serve.mjs` now sends `.pdf` as `application/pdf` so the
  local check matches Pages.
- **Everything in `.ui` that can be clicked has to say so.** `.ui` is
  `pointer-events:none`; `.topbar__nav` re-enables them and
  `.topbar__id a` now does too — it never did, so the wordmark's link
  home was inert on every page that rendered it. If you add anything to
  the bar, this is the line it will forget.
- **Below 900px the bar sits above the sheet, not behind it.**
  `body[data-layout="sheet"] .ui{ z-index:40 }` plus the falloff
  gradient. `.panel` is z-index 30 and the panel is full width here, so
  About and All work were visible-but-dead on both sheet pages on every
  phone — `elementFromPoint` returned `.panel__scroll`. **Raise `.ui`,
  not `.topbar`**: z-index 20 on `.ui` makes a stacking context, so a
  child's z-index cannot escape it. At that width the bar's own "All
  work" is dropped (the page carries one) and the sheet's wordmark comes
  back (nothing to hide from any more).

  Check it, on all four layouts, whenever the bar changes:

  ```js
  const a=document.querySelector('.topbar__about'), r=a.getBoundingClientRect();
  const h=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  h===a || a.contains(h)      // must be true
  ```
- **The footer is a centred stack at every width, icons only.** The role
  and place lines are 9.5px on a phone; the email holds 11px. The place
  is a pair in `site.js` (`from` / `to`) drawn by `BASED_LINE` in
  `icons.js` with an authored back-to-back arrow. **Do not type the
  arrow** — U+21C4, U+21C6, U+2194, U+27F7 and U+21CC are all absent
  from JetBrains Mono and fall through to a system face 40% wider than
  the mono cell. Measured: the cell is 6.6px at 11px, every candidate
  came back 9.2+.
- **Every section-page row carries a 64px thumbnail below 900px** —
  `.plink__thumb`, the same line the stage is hidden and the strip
  appears at. It honours `coverFocus`. The strip above it now says the
  same thing twice; that is the open question in "Next".
- **"More on Instagram" only shows where there are posts.** `p.posts` is
  the test, the same list the Posts grid is built from. Eight records had
  it pointing at the profile with nothing behind it.
- **A cover can say where to crop it.** `coverFocus` on a record is
  `object-position` for its still inside a tile, and it is a separate
  field from `previewFocus` for the reason preview.js already gives: a
  cover and a clip are rarely framed alike, and Fitmint's are 20 points
  apart. Only Fitmint sets it (`50% 25%`), because only a full-height
  9:16 figure loses its head to a centred crop. If a new cover looks
  wrong in the phone strip, this is the knob — and check it in the strip
  *and* in the landing reel, which are the two frames that crop at all.

## Next, in the order I would do it

-1. **The sheet pages now show every entry twice on a phone** — once in
   the "at a glance" strip under the header, once as a thumbnail on its
   own row. Both were added for the same reason (no preview stage at
   this width) and only one of them is needed. The row thumb is the
   better of the two: it is attached to the thing it illustrates, it
   costs no extra scroll, and it does not need a horizontal gesture. The
   strip's case is that it is browsable by eye in one flick. **Pick one.**
   This is the same "two affordances for one job" question as the two
   "All work" links in item 0. The phone half of *that* one is settled —
   below 900px the bar's copy is gone and the page keeps its own — so
   what is left there is the desktop half.
0. **The Visualization wall, from an Impeccable critique** — still open,
   in the order I would take them: the 29 tiles are `<figure role="link">`
   rather than `<a href>`, so no ⌘-click and nothing crawlable; 24 of 29
   leave the site and nothing on the wall says which (`tile()` already
   takes a `mark` badge, `entryTile` never passes one); the 8px tracks
   mean no two neighbours share a top edge while 18 tiles are identical,
   so it is neither aligned nor varied — coarsen to ~48px tracks or
   commit to masonry, not both; two "All work" affordances, which the
   sheet pages have too and which should be settled for both at once.
   ~~No way to another sector~~ — done, the switcher is in the bar.
   The `<a href>` one is the pick of these: it buys keyboard,
   middle-click and crawlability in a single change.
1. **`SITE.links` vs `SITE.beacons`** — linktr.ee is live, the CV says
   beacons.ai. Pick one, delete the other.
2. **The Instagram post "Crystalverse — web-based 3D game"** still sits three
   rows below the game itself on Technical Art. Both are real, but it
   reads as a duplicate — one cell to delete if it does.
3. **Artwork for the five bare records**, which is the only thing keeping
   them off the site — see "Current state" for the list and the one-liner
   that re-derives it.
4. ~~**Self-host the fonts and three.js**~~ **Done, 2026-09-14** —
   `node tools/vendor.mjs` and `node tools/fonts.mjs`, both idempotent,
   both with `--check`. The landing opens exactly one origin now. Mobile
   first paint 3,963ms to 2,408ms, median of three Lighthouse runs on
   either side of a revert. Do not hand-edit `vendor/`, `assets/fonts/`
   or `css/fonts.css` — re-run the generator.
5. **The reel drifts nowhere, on a loop that never stops** — two bugs in
   `js/reel.js`, both measured, both still live. See the two traps below.
   A fix exists at `ab6325b` and was reverted with a batch it was bundled
   into; reapplying it is a decision about how the strip should behave,
   because it makes a strip move that has never moved.
