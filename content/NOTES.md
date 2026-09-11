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

Pages takes 30-90 seconds. Check with:

```bash
curl -sI https://www.govindbmohan.com/game/unicorn/ | head -1
```

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
reasons attached: **Space Grotesk** (the brand face — changing it is a
rebrand), **codex-grid-background** (the drafting sheet is a real
measurement surface, which the rule's own wording exempts), and
**buried-raster** in `tiles.js` (the lazy wall holds `.tile__el` at
opacity 0 until `is-ready`).

Four findings are left standing on purpose and should not be "fixed":

**Functional text holds at 11px.** This has now been learned twice — once
on the portfolio's phone tier and once on the studio's camera labels —
both times by shrinking labels to make something else fit, and both times
called back by `undersized-ui-text`. What shrinks instead is the icon, the
padding, and any label that restates what its buttons already say.

| finding | why it stays |
|---|---|
| `all-caps-body`, `wide-tracking` | the mono label system *is* the identity |
| `dark-glow` | the one accent, used only on the CTA |
| `em-dash-overuse` | the writing voice |
| `1.1:1` on a sector title | false positive — the detector composites `.panel`'s gradient against the canvas and gets a nonsense number; the real pairing is white on near-black |

## Traps, in the order they will bite

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
  - Both carry their own **way back to the portfolio** (`../../`) — the
    game's `#exit` pill, dimmed but never removed once play starts, and
    the arrow in the studio's wordmark. The studio's needed
    `pointer-events:auto`, because `.brand` is `none` so a drag on the
    wordmark still orbits the avatar.
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
  A landscape tile keeps `grid-column:span 2` there, which is the full
  width.
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
- Four records still have no artwork (Primetrace, Metabrix, Hecoll,
  Freelance 2024) and are unlisted, so nothing renders as a bare plate.

## Next, in the order I would do it

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
3. **Artwork for the four bare records**, which is the only thing keeping
   them off the site.
4. **Self-host the fonts and three.js** — two extra origins and 209 KB from
   a CDN on every page, and the CDN is a single point of failure the boot
   guard exists to defend against.
