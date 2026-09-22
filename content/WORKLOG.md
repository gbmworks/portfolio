# Work log

A record of the restructuring, in the order it happened.

| sections | what |
|---|---|
| 1-8 | the first session: content, structure, bugs, performance, deployment |
| 9 | the game, deployed |
| 10-18 | the mosaic's reading order, the avatar studio deployed, a way back out of both, fifteen files of footage and the reel under the wheel — then repairing what the first of those quietly broke, then a detector across three device classes |
| 19-21 | the phone stopped being a smaller desktop; the studio's chrome |
| 22-25 | the two runnable things land on their own record; row thumbnails, the resume, the footer, the wheel's inward collision, the mosaic's barrier tiles; the bar down to one door |
| 26-27 | a display face for the headings; three.js and the fonts off the CDN, reverted, then put back; two bugs in a strip that had never moved |

Sections 21 and 25 are reproduction records — the *what*, for rebuilding
from — and the numbered sections around them are the *why*.

Kept beside `allocation_new.csv` because that spreadsheet is the thing
most of it now hangs off.

The README is the reference for *how the site works today*. This file is
the reference for *why it is like that*, and for the things that were
tried and did not work — so nobody spends an afternoon rediscovering
them. `NOTES.md` is how to work on it.

**Live at www.govindbmohan.com**, built from `gbmworks/portfolio`. The
most recent commit here is `29dec04` (2026-09-14); each reproduction
record names the commits for its own range.

---

## The files in this folder

| file | what it is |
|---|---|
| `allocation_new.csv` | **The source of truth for what is on each page.** Three columns — ID, VIZ, TD — one entry per cell, top to bottom in display order. `node tools/allocate.mjs` turns it into `js/pages.js`. |
| `allocation.csv` | The full list as it stood *before* trimming — all 40 projects and 49 Instagram posts. Kept as a menu of everything available to put back. |
| `WORKLOG.md` | This file. |
| `NOTES.md` | How to work on the repo — commands, the checks worth re-running, the traps, and what is next. |

Editing loop:

```bash
# edit content/allocation_new.csv
node tools/allocate.mjs      # -> js/pages.js  (refuses to write on a typo)
node tools/sitemap.mjs
node tools/serve.mjs         # check it
```

---

## 1. Content: two tiers, then one flat list

**The problem.** The site claimed 40 case studies and had about 8.
Twenty-two records were a slug, a title, a hotlinked Behance cover and a
link out — and each got a full page whose entire body read *"this one
lives as a published gallery rather than a write-up"*, plus a sitemap
entry. Meanwhile the newest and strongest work — Primetrace, Metabrix,
the Lenskart AR game, the 2024 freelance run — had no artwork at all and
rendered as typographic plates. The site was inverted.

**First pass** split `PROJECTS` (19 case studies) from `ARCHIVE` (18
published galleries), with `POSTS` for Instagram. Sitemap went 44 URLs to
23, all of them real pages.

**Second pass** replaced that with what the allocation sheet actually
said. Each page is now **one flat list, no sub-headings** — a project, a
Behance gallery and an Instagram post sit in the same running order and
are drawn identically. `resolveEntry()` in `projects.js` turns all three
into one shape so nothing in the renderer branches on type.

Final: **ID 18, VIZ 26, TD 9.** All 53 entries verified to have a
thumbnail and a destination. (TD is 11 now — see sections 9 and 10.)

**The 2024 freelance run became one record.** Suta, The Eyewear Project,
Soul Jams and Besodetres were four records with a one-line summary, no
artwork and nothing to link to — four pages that said nothing. The CV
lists them as one role, so they are one project. `MOVED` in `projects.js`
keeps the four old slugs resolving.

**Nothing is deleted by being unlisted.** Ten records are in
`projects.js` but on no page, including Fitmint, Youforia and Loops &
Studies. `project.html?p=<slug>` still resolves for anyone holding an old
link. Putting one back is one line in the sheet.

---

## 2. Structure

- `data.js` split into `site.js` (identity — one source), `sectors.js`
  (the three sectors), `links.js` (every outbound URL).
- `head.js` + `preload.js` + the 5× duplicated boot block collapsed into
  `boot.js`. The top bar moved to `shell.js`, built from `site.js`.
- `style.css` (1,048 lines) split into six sheets. **The concatenation is
  byte-identical to the original**, so the cascade did not change.
- Per-sector `color`/`glow` deleted — all three declared the same
  `#ff5a12` as the global accent.

### Identity was in three places and disagreed

`data.js` said Thiruvananthapuram, `cv.js` said Bangalore. `data.js`
linked to linktr.ee, `cv.js` to beacons.ai. Now all in `site.js`. **Still
unresolved:** `SITE.links` points at linktr.ee because that is what is
live; the CV says `beacons.ai/govindbmohan`, kept alongside as
`SITE.beacons`. Pick one and delete the other.

---

## 3. Bugs found and fixed

**`404.html` used relative paths.** GitHub Pages serves it for *any*
missing path, and a relative `href` resolves against the requested URL —
so on `/some/deep/path` the stylesheet was fetched from
`/some/deep/css/style.css` and the page rendered unstyled. Now
root-absolute, and it is the one file that does not share `boot.js`.

**About and Contact were unreachable on two pages.** On the `sheet`
layouts `.topbar__id` is hidden, which left the bar with one child, and
`space-between` put it at the *start* — underneath `.panel`, which is
z-index 30 to the bar's 20. Live, and the About window is the only way to
see the CV. Fixed with `justify-content:flex-end`.

**The preview stage tested the still before the clip** — the opposite of
what the README claimed. Fitmint, which has both, showed a static cover
and its clip never played.

---

## 4. Performance

The scene is cheap in geometry and expensive in pixels: 28 draw calls,
28k triangles, every one through a physically-based shader.

| | was | now |
|---|---|---|
| landing canvas | 3840×1907 — **7.30 MP** | 2538×1260 — **3.20 MP** |
| section canvas | 3225×1601 — **5.16 MP** | 2007×996 — **2.00 MP** |
| bloom on a backdrop page | 13 fullscreen passes | none |
| postprocessing modules there | 7 requests | **0** |
| `backdrop-filter` on the panel | blur(20px) every frame | none |

- **`PIXEL_BUDGET`** caps a frame by *total pixels*. Capping
  `devicePixelRatio` bounds nothing — 1.5 is 1.5 whether the window is
  1280 or 3840 wide.
- **Bloom is opt-in.** Off means the four modules are never fetched.
- **Two `backdrop-filter`s** over an animating canvas were being
  recomputed every frame across a fifth of the screen.

### Why it *loaded* slowly

Every stylesheet, the font CSS and all three preconnects were created by
`boot.js`. The preload scanner only reads markup, so it found one script
and stopped. HTML done at 5ms; first stylesheet requested at **32ms** —
a full round trip on a real connection, with the Google Fonts hop in
series behind it. Moving the links back into static HTML: **32ms → 8ms**,
gap 27ms → 2ms.

### One sky instead of four

Hovering a slice used to cross-fade the whole sky and its IBL. That meant
four equirect bakes, four PMREM chains, a dome shader sampling *two*
skies per pixel, and a PMREM swap hidden under an exposure dip. Now one
sky, baked once from `SKY` in `themes.js`, and hovering changes only the
backdrop geometry and the light colours. The single remaining bake went
*up* to 1024×512 since it can afford to.

---

## 5. Media

**Posters are the whole trick.** Every clip has a ~40 KB poster in
`assets/posters/` — 0.6 MB for all seventeen. A tile paints the poster
and layers the video over it with **no `src`**; the src is set in
`wake()`, on hover. Scrolling the full 26-tile mosaic now fetches **zero
video bytes**, measured. Before, every tile within 400px of the viewport
set `preload=metadata` on a multi-megabyte clip to paint one still.

**Character textures halved.** `PORTFOLIO.glb` plus maps was 3.2 MB —
72% of the Visualization page — for a decorative backdrop, and the maps
were 2048² for something drawn about 570px tall. At 1024²: 1011 KB → 348
KB, no visible difference.

---

## 6. Things that did not work

**Re-encoding the clips.** The 12× bitrate spread across `assets/web`
(418 → 5175 kbps) looks like sloppy encoding. It is not — it is content.
At CRF 34, **six of seven clips came back bigger** than what is deployed;
the seventh improved 2%. They are already encoded above CRF 34. Reverted.
If they ever must be smaller the lever is a *higher* CRF and accepting
the quality cost.

**Capping the long edge at 1280 from the original.** The originals are
1080×1920; the deployed clips had been downscaled to 608×1080. Capping
the *original* upscaled them, which is why the first encode run produced
bigger files across the board. `media.mjs` now encodes at the deployed
file's own dimensions.

**A `document.hidden` guard around the render.** Chrome already stops
calling rAF for a hidden tab, so it bought nothing — and it skipped the
`afterMatrix` pass that projects the slice labels, leaving them stacked
in the top-left. Anything that reports hidden while still painting (a
screenshot tool, a tab-hover preview, a webview) got a blank canvas.
Removed.

**`tuneTransmission()` has never done anything.** It sets
`renderer.transmissionResolutionScale`, which arrived in three.js **r171**
— the import map pins **r169**, so the guard is false. The README used to
claim it halved the refraction buffer. Left in place and labelled; it
starts working the moment the pin moves.

---

## 7. Deployment

`origin` points at **`gbmPrimetrace/portfolio`**, which has no Pages site.
The live domain is served by **`gbmworks/portfolio`** — the `upstream`
remote — which was a commit behind. That is why the site looked stale.
**Push to `upstream`.**

`tools/serve.mjs` replaces `python -m http.server` for development.
Python sends no `Cache-Control` at all, so Chrome caches ES modules hard
and you keep running the version from ten minutes ago — which looks
exactly like an edit not working. Hours went into this before it was
diagnosed. The dev server sends `no-store` and answers **206** to Range
requests, which Python does not.

**Vercel was considered and declined.** The only real gain would be cache
headers: GitHub Pages hardcodes `max-age=600` on everything including a
3.4 MB video, and cannot be configured. But revalidation returns `304`,
so bytes are not re-downloaded, and everything Vercel is good at —
framework builds, functions, ISR — this site uses none of. `git push` is
the whole deploy. Not worth the migration.

---

## 9. The game, deployed (second session)

*Unicorn and the Crystalverse* — the Lenskart game — was sitting in
`content/Unicorn` as a working folder: an npm project built on the
`tamani-coding/threejs-navmesh-example` scaffold, with the game grafted
onto it. It is now the **first entry on Technical Art**, and clicking
that row plays it.

**How it hangs off the site.** One new field: `live: 'game/unicorn/'` on
the record in `projects.js`. `resolveEntry()` returns it as the entry's
`href`, so every place the game is listed — the sector index, another
project's prev/next — opens the game rather than a page about it. The
sitemap emits that URL too. `project.html?p=lenskart-ar-game` still
renders, with the write-up and a *Play the game* link first, so an old
or shared link does not dead-end.

**It costs the site nothing until clicked.** Measured on a cold load of
Technical Art: zero requests under `game/`. The row's 53 KB cover — the
island illustration from the game's own story screens — is fetched on
hover like every other still.

### What shipped, and what did not

`dist/` is 59 MB and the game loads 12 of it. `Crystalverse.gltf`
(16 MB), `mapTrees.glb` (11 MB), `Unicorn4.gltf`, `mushroom1.glb` and
the navmesh example's demo level have never been requested by a browser.
So `content/Unicorn/deploy.mjs` copies a **manifest**, not a folder:
`MODELS` lists the twenty models `src/index.ts` actually asks for, and it
refuses to write if one is missing rather than shipping something that
404s mid-level. Deployed: **16.2 MB**, of which 11.6 is models.

The bundle was a *development* build — 3.8 MB, almost all of it an inline
source map. `webpack.config.js` now takes its mode from `--mode` and
writes production straight into `game/unicorn/`: **573 KB**.

The originals stay in `content/Unicorn/dist`, untracked, the same split
as `assets/media` → `assets/web`. **Keep that folder backed up somewhere
that is not the repo.**

### Four things fixed on the way

1. **`setDecoderPath("/")`.** Ten of the twenty models are
   Draco-compressed, and an absolute path asked for the decoder at the
   site root — fine when the game was served at `/`, silently fatal at
   `/game/unicorn/`. Now `"draco/"`, with the three decoder files in a
   folder of their own.
2. **A duplicate `<div id="unicornSelection">`.** `createScreen()` was
   called a third time with the story screen's elements, appending a
   second element with that id holding a copy of the six story images.
   Hidden, never shown, never needed — the story button already reveals
   the real one.
3. **A Firebase SDK** was initialised in `index.html` and used for
   nothing: no analytics, no database, no auth. Removed, along with the
   config block and the extra origin it loaded from.
4. **Seven leftover `console.log`s**, a stale `mobile-preview.html`
   harness describing a mobile gate the game no longer has, and the
   example's own README and screenshot.

### Verified in a browser, not assumed

Splash → story → character select → play, on the deployed copy at
`/game/unicorn/`: the island renders, every Draco model decodes, and a
click on the ground paths the unicorn across the navmesh. No console
errors.

The character-select videos show blank **in the automated browser only**
— the tab reports `document.visibilityState: "hidden"`, and Chrome will
not decode video in a tab it thinks nobody is looking at. `networkState`
is 2 (loading) and the files are h264 400×400, served with the right
type. This is the same false negative recorded in open item 6 below;
worth one look by hand.

### Still open on the game

- The story screen is a long scroll on a desktop window — authored for a
  phone, and centred rather than re-laid-out.
- `src/` still holds `ver1.ts`, `jsonver.ts` and `messy.ts` — earlier
  passes, none of them imported. Kept as history.
- The Instagram post *"Crystalverse — web-based 3D game"* is still listed
  separately on Technical Art, four rows below the game itself. Both are
  real published things, but it reads as a duplicate; delete that cell
  from the sheet if it does.

---

## 10. The mosaic reads across (third session)

The Visualization page is the one wall driven straight by the allocation
sheet's running order, and it was throwing that order away.

`.gal-grid` was `columns:5` — CSS multi-column, which fills a column top
to bottom before it starts the next. So on a five-column wall the first
six entries ran down the **left edge**, the sixth sat level with the
first, and the twelfth was still in the second column. Somebody had put
those twenty-six pieces in a deliberate order and the page displayed it
in an order nobody reads.

It is now a grid — `body[data-layout="gallery"] .gal-grid`, five columns
down to one at the same four breakpoints — which places in source order,
left to right. Row one is entries one to five. Verified in the browser by
reading every tile's `getBoundingClientRect().top` and grouping: rows came
back 1-5, 6-10, 11-15, 16-20.

**What it costs.** Multi-column interlocks: a short tile lets the next one
slide up under it. A grid row is a row, so tiles hang from its top and a
row of mixed shapes has a ragged foot. Since a tile is only ever 3:4 or
4:3 (`--ar`, set from the real dimensions once metadata lands) the raggedness
is bounded and reads as a deliberate baseline rather than a hole.

Keeping *both* — masonry that also reads across — needs a measuring pass
in JS plus a `ResizeObserver`, on a site that has spent two sessions
deleting machinery. Not worth it for a stagger nothing in the docs ever
defended.

**Scoped on purpose.** A project's media wall and the Instagram strips
have no running order to honour, so they keep the masonry. One selector,
one extra rule zeroing the tile margin the column flow used for spacing.

### And then 16:9 / 9:16

With the order fixed, the shapes were next. Every tile on the site was
cropped to `4/3` or `3/4` — squarish, chosen so a mixed wall stayed even.
That is the right call for an index sitting next to a reading column. It
is the wrong call for the mosaic, which *is* the page, and whose work was
overwhelmingly made for a phone or a screen: twenty of the twenty-six are
portrait.

The mosaic now crops to **16:9 and 9:16**. `object-fit:cover` has less to
throw away, and a vertical piece reads as a vertical piece.

Which meant moving the decision. `tiles.js` used to write the ratio itself
(`--ar: 3 / 4`), so the one function that learns a file's dimensions also
decided how every wall on the site framed it. It now records the *fact* —
`data-orient="portrait"` / `"landscape"` — and the stylesheet picks the
ratio per wall. `--ar` is gone; it had one writer and one reader.

Two things had to give for the ratio to actually hold:

- **`max-height:62vh`** would have clipped a 536px tile to 522px on an
  842px-tall window — a 9:16 tile that is not 9:16. Lifted for the mosaic
  only.
- **`contain-intrinsic-size: auto 340px`** is the height `content-visibility`
  guesses for a tile it has not rendered yet. Against a 4:3 wall that was
  close; against 9:16 it is short by two thirds, and the page grew 232px
  under the scrollbar on the way down. At `580px` the measured growth over a
  full scroll is **0**.

**What it costs.** A landscape tile is now 170px where its neighbours are
536px, so a row of mixed shapes has a much deeper ragged foot than it did
at 4:3. On the dark ground it reads as space rather than as a hole, but it
is a real change in the wall's rhythm and it is the first thing to revisit
if the page ever feels gappy — the ratios are two lines.

### A post on two pages

*Projection mapping exercise* (`DY1ZLdrzDMn`) was already in
`POSTS['visualization']` and already listed on Visualization. It is now
listed on Technical Art as well, at `C6` in the sheet — fifth in the
running order, next to the TouchDesigner hand-tracking reel it belongs
beside. Nothing was added to `projects.js`: `igByTitle` in `allocate.mjs`
resolves a title wherever it lives, and there is no duplicate guard
because listing one entry on two pages is a thing the sheet is allowed to
say. Technical Art is 11 entries now; the site is 55.

Its URL comes out as `instagram.com/reel/DY1ZLdrzDMn/` because the record
says `kind: 'reel'`. Instagram answers `/p/` and `/reel/` for the same
reel, so both work — worth knowing before someone "fixes" it.

---

## 11. The avatar studio, deployed

*Fitmint Avatar Studio* — the character customiser behind the Fitmint
avatar system — arrived as `content/Fitmint`: a finished three.js app
with its own seven-stage Blender build, 92 MB of source art, and a
README that already described how to ship it. It is now the **second
entry on Technical Art**, at `studio/fitmint/`, and clicking that row
opens it.

The game was the precedent and this follows it exactly: `live` on the
record, a deploy script that copies a checked subset rather than a
folder, heavy source left on this machine.

### What it cost the site to add: one field and one label

`live: 'studio/fitmint/'` on the **existing** `fitmint-avatars` record —
the one that already carried the reels and the four Instagram posts. The
avatar system and the thing itself are one entry, not two.

The only code that had to change was a hardcoded string. `project.js`
read:

```js
if (p.live) links.push(['Play the game', p.live]);
```

which was fine while `live` meant one game. A second runnable thing that
is a *tool* makes that label wrong, so the record carries its own:
`liveLabel`, defaulting to `'Open it'`, with the game keeping *Play the
game* and the studio getting *Open the Avatar Studio*. One line.

### It needed no path fixes

The game's expensive lesson was `setDecoderPath("/")` — an absolute path
that worked at the site root and failed silently one folder down. The
first thing checked here was the same class of bug, and there is none:
every reference in the studio is relative, three.js is vendored into
`vendor/` rather than pulled from a CDN, the meshopt decoder is an ES
import rather than a fetched wasm path, and there is no `url()` in its
stylesheet. It ran at `/studio/fitmint/` unchanged, first try.

### The deploy guard is derived, not hand-written

`content/Unicorn/deploy.mjs` carries `MODELS`, a hand-maintained list of
the twenty models the game loads — necessary there, because `dist/` mixed
shipped and unshipped models in one folder, but it has to be edited by
hand every time the game gains a model.

Here the split is already clean at the folder level, so the interesting
guard is a different one: `deploy.mjs` reads every `assets/...` path out
of the generated `catalog.js`, `environments.js` and the preload in
`index.html` — **96 of them** — checks each against the disk before it
copies anything, and checks the copy afterwards too. A catalog row whose
asset was never built now fails at deploy rather than under somebody's
click. Nothing to maintain: the manifest is the app's own generated
output.

That matters for this project specifically, because its build already
reports two CSV rows (`Beard07`, `Beard08`) that were never delivered as
meshes. They carry no asset path, so they never reach the guard — but the
next one might.

**Deployed: 19.1 MB**, of which 15.8 is models, 2.3 is three.js and 0.4 is
one 512×256 HDRI. Left behind: `assets/items/` (59 MB, the stage-1
intermediate), `Male/` (92 MB of FBX and textures), `hdri/` (the source
`.exr`) and `tools/node_modules/` (102 MB).

### Verified in a browser, not assumed

Loaded at `/studio/fitmint/`: the avatar renders with its measured
lighting and cast shadow, the wardrobe thumbnails paint, and equipping
G.O.A.T. streams a 2.5 MB overall on demand, re-binds it to the avatar's
skeleton and brings up the named HSB colour groups. No console errors.

And the cost when nobody clicks: a cold Technical Art load makes **zero
requests under `studio/` or `game/`** and weighs 200 KB total. Two
runnable projects at the top of the page, neither of them on the bill.

### Still open on the studio

- Only the male avatar exists; the CSV and the build are written around
  `Fitmint - Male.csv`.
- `Beard07` / `Beard08` are in the CSV with no source mesh, and the build
  says so on every run.
- The Olympian glasses fall back to their FBX diffuse colour — their
  `olympianDiffuse.jpg` was never delivered.
- A clone cannot rebuild the studio's assets: the art is not in git. Same
  trade as the game, and the same warning applies — **back that folder
  up**.

---

## 12. Two doors, and two ways back

Section 11 gave the studio the game's exact treatment: `live` on the
record, row opens the thing. A day of looking at it says the game and the
studio are not the same shape of project, and should not be reached the
same way.

**The game is the whole project.** There is nothing to read first;
standing a write-up between a visitor and it would be perverse. Its row
plays it.

**The studio is one output of a larger job.** Fitmint was two years of
avatar system, reels, UI overlays and NFT work — the customiser is the
best part of it, not the whole of it. Sending the row straight into a
full-screen editor skipped the case study, the four Instagram posts and
the ten pieces of media attached to the record.

So `live` split in two:

| field | |
|---|---|
| `live` | where the running thing is |
| `liveLabel` | what the button to it says |
| `liveFromRow` | whether the row skips the page and runs it directly |

The game sets `liveFromRow`. The studio does not, so its row opens
`project.html?p=fitmint-avatars`, and the page opens the studio.

### One function decides where a click goes

Three places were independently answering "where does this record go" —
`resolveEntry()` with `project.live || projectUrl(project)`, the prev/next
arrows with `prev.live || projectUrl(prev)`, and `sitemap.mjs` with a
third copy of the same expression. Three copies of one rule is three
chances to change it in two places.

They now all call `entryHref(p)`, which is four lines in `projects.js` and
the only thing that knows about `liveFromRow`. The sitemap got better for
free: a record that runs *and* keeps its page is now worth both URLs, so
`/project.html?p=fitmint-avatars` and `/studio/fitmint/` are both listed.

### The button

`liveCta()` puts it in the header, under the lede, above the hero — not
down in `.proj__links` with the Behance and Instagram lines, which is
where the old *Open the Avatar Studio* text link sat. On a page whose job
is to hand you over to a running editor, burying the door under the fold
would be absurd.

It is the **only solid accent surface on the site**. Everything else here
is an outline or a hairline, which is exactly why it reads as the one
thing to press. The game's page gets it too, saying *Play the game* —
reached from an old URL or a prev/next arrow, since its own row skips the
page.

The row's preview clip changed with it, `AvatarF.webm` to `male.webm`:
the character the studio actually edits, full-body and arms folded on the
opening frame.

Which surfaced something the stage had always done quietly. It is 966×604
against a 720×1280 clip, so `cover` keeps **35% of the height** and
centres it — and the centre of a standing figure is his waist. Every
portrait clip on the site has been cropped that way; nobody had looked.
`previewFocus` on the record is an `object-position` for that clip alone,
and `male.webm` runs at `50% 5%` — head and chest.

The first attempt was `15%`, and it shaved the top of people's hair. The
second was not eyeballed: the clip was drawn to a canvas every 0.25s and
scanned top-down for the first pixel above a low luminance threshold, so
the highest thing in it is a measured **4.69%** from the top of frame —
the tip of a Santa hat at t=8, not any of the frames anybody had been
looking at. At `5%` the window opens at 3.24% and clears all 40 sampled
frames with 1.45% to spare.

It applies to the **video only**. The still underneath keeps the centre,
because a cover and a clip are rarely framed alike: in `coverf.jpg` the
figure sits far lower, and the same 15% would have shown mostly sky.

### The way back

Both of these are full-screen. A visitor who lands in one and wants out
had, until now, the browser's back button and nothing else — and in the
game's case not even that was obvious, because it had a *← Portfolio*
pill that `index.ts` **deleted** the moment play started:

```js
document.getElementById("exit")?.remove();
```

It now takes a `.is-playing` class instead: 35% opacity, full on hover.
Available, not floating over the island. That lives in `src/index.ts`, so
it needed a webpack rebuild — 573 KB production bundle, redeployed at
16.2 MB.

The studio got the same thing as an arrow in its wordmark, and it needed
one line that was not obvious: `.brand` is `pointer-events: none`, so a
drag that starts on the wordmark still orbits the avatar behind it. The
back button inherits that and was completely dead — the canvas was
receiving the click. `pointer-events: auto` on the button alone.

Both links are **relative** (`../../`). The game's was root-absolute
(`/technical-art.html`), the one documented exception to a file whose own
header comment says every path in it is relative. It is not an exception
any more, and both now resolve to the site root from one folder down
while still making sense served standalone.

---

## 13. Fifteen files of footage, and a reel under the wheel

`assets/media/VIZ` and `assets/media/TD` arrived with fifteen source
files and no titles — 349 MB and 540 MB of `.mp4`, several of them
`20250710_161953.mp4`. Nothing about a filename says what a clip is, so
the first move was a frame out of each at a third of the way in, looked
at one by one. That is how the two 4K files turned out to be the same
project from two angles, and why they are **one record with two media
items** rather than two entries.

### What went where

Four already existed (`Halo_bg`, `shroomF`, `Burj Khalifa`, and a long
cut of the Lenskart shell reel), so they were skipped rather than
deployed twice.

| | |
|---|---|
| `Mount Fuji` | media on **Fitmint**, beside `Burj Khalifa` — same campaign |
| `Arcadia`, `char`, `f1`, `t20001-0600`, `11642-1880` | media on **Loops & Studies**, which grew from 8 to 13 and is listed for the first time |
| `Cradlewise` | a new record — product visualisation of the smart crib |
| `TIGC` | a new record — apparel, cloth sim in a concrete set |
| the two 4K captures | a new record: **Facial Capture Pipeline**, ARKit over Live Link onto a character rig |
| `VID_20260222…` | a new record: **Projection Mapping**, room-scale |

Six records, five of them new. ID 18 · TD 14 · VIZ 29 — 61 entries, all
with a picture and a destination.

**The titles are mine, not the artist's.** `t20001-0600.mp4` is called
*Golden Bull* here because that is what is in the frame. Five of these
names were read off a single still and should be treated as placeholders
until somebody who made them says otherwise.

### Grain is the expensive thing

The Technical Art clips are handheld phone video **of a screen**, two of
them 4K at 60fps. Straight into the house CRF 34 recipe, `facecap-setup`
came out at **12 MB** — three times the heaviest thing already on the
site, for 55 seconds of a laptop on a desk.

The recipe was not wrong; the footage is. A phone sensor under office
fluorescents lays noise over every frame, and noise is the worst thing
VP9 can be handed: it is detail, it is different every frame, and none of
it is the subject. `hqdn3d=3:3:6:6` in front of the scaler, CRF 40, long
edge 720:

| | as encoded first | denoised |
|---|---|---|
| `facecap-setup` (55s) | 12.0 MB | **1.8 MB** |
| `facecap-closeup` (17s) | 3.1 MB | **1.5 MB** |
| `projection-room` (14s) | 3.5 MB | **1.8 MB** |

85% off the worst one, invisible at the size a tile draws. The same
higher-CRF pass on the *rendered* `t20001-0600` bought 4.9 → 3.6 MB and
nothing more — which is section 6 of this file all over again, and is
exactly why the two cases now have separate advice in the README.

Eleven new clips, **17.4 MB** deployed against 949 MB of source.

### The reel

The landing page was one screen: the wheel, or nothing. A visitor had to
pick a sector before seeing a single piece of work. There is a strip of
ten under it now, mixed across all three sectors, Fitmint first and the
game second.

**It reuses the tile engine rather than growing a second one.** A card
*is* a `.tile` from `entryTile()`, so hover-to-play, the lazy poster and
the where-does-a-click-go rules are not written twice. `js/reel.js` is
only the strip: a horizontal track, arrows, a staggered reveal, the
drift.

Three things worth knowing:

1. **`.ui` is `position:fixed`**, which is why this works at all — the
   strip scrolls up over a world that stays put, and the wheel is still
   there when you scroll back.
2. **The one override needs an id.** `#reel .tile__media` pins every card
   at 4:5. A row cannot let each tile take its own 3:4 or 4:3 the way a
   wall can, and `landing.css` loads *before* `tiles.css`, so a class
   selector of equal weight loses the tie. First attempt did exactly
   that and produced one tall card and nine short ones.
3. **The drift stops for good** on the first pointer, wheel, touch, key
   or hover. A carousel still moving under a pointer is a carousel that
   loses a click.

`FEATURED` in `projects.js` is what is in it — the one list on the site
that is not generated from the allocation sheet, because "what should
somebody see first" is a judgement and the sheet has no column for it.

---

## 14. The wall was ragged, and three other things

Run `impeccable` over the stylesheets and it returns three findings.
Two were real and both were mine. The third is a false positive worth
recording so nobody "fixes" it later.

### The gallery: 379px of hole

Sections 10 and 12 each did what was asked and together produced
something neither asked for. Row-major order (10) put a 16:9 cell and a
9:16 cell in the same row; true ratios (12) made one of them 207px tall
and the other 586. `align-items:start` left the difference open, and
because only six of twenty-six pieces are landscape the holes fell
irregularly — which is why it read as random raggedness rather than as a
pattern. Measured before the fix: **379px worst hole, 744px across the
wall**, and the rows that happened to be all-portrait were flush.

**True ratios cannot tile flush.** Set portrait height at one column
equal to landscape height at two and solve for a shared unit: the answer
is negative. So order, ratio and flushness are three constraints on two
degrees of freedom, and one had to go. Presented as a choice rather than
decided here — the options were a uniform cover-cropped frame (loses the
ratios), packed masonry (loses strict order), or wide cells for wide
work (keeps both, leaves some variation). **Wide cells was the call.**

`.tile[data-orient="landscape"]` now spans two columns at exactly 16:9,
with `grid-auto-flow: row dense` backfilling what remains. Worst hole
**379px → 201px**, most rows flush to within 14px, and a wide render now
reads wide instead of reading like a stub with a hole under it. At one
column the span stands down.

### The top bar was interleaving with the work

`.topbar` is `position:fixed` with no background — correct over a
single-screen wheel, wrong on every page that scrolls under it. On the
mosaic a tile caption arrives at the wordmark's baseline and the two
strings cross. It carries a gradient scrim on the three scrolling
layouts now, in `.scrim`'s language. A gradient and not a
`backdrop-filter`: this sits over an animating canvas, and section 4 of
this file is about the two blurs that cost a frame each.

### Twenty-nine rows relaid out on every pointer move

`.plink` hovered with `transition: padding-left .35s`. Padding is a
layout property, so a 14px nudge relaid out the row and everything below
it — on Visualization that is twenty-nine rows re-measured per pointer
move, for an effect a composited `translateX` does for free. One word
changed in the transition and one in the hover rule.

### The name was wearing the effect

`.intro__name` painted GOVIND with a metal gradient through
`background-clip: text`. The chrome in this world is on the glass behind
the type, where it is lit and moving and means something; painting it
onto the letterforms as well was the effect standing in for the thing,
and it cost the single most important word on the site its contrast.
Solid `var(--ink)`.

### The finding that is not a finding

The detector also flags `sections.css:144` — a two-axis hairline grid
background — as a generated-UI signature. Its own rule exempts "actual
canvas, map, blueprint, or measurement surfaces", and this is the
drafting sheet the Industrial Design and Technical Art layouts are built
on. Left alone, deliberately.

---

## 15. A detector run across three device classes

Section 14 ran the detector over the stylesheets and got three findings.
Run it over the **rendered pages** instead — `detect <url>`, which drives
a real Chrome — and the same site returns **863** across six surfaces at
390, 820 and 1440. A file scan sees the CSS; a URL scan sees computed
type size, composited contrast and hero structure. Those are where the
problems were.

**863 → 431.** Six rule classes cleared completely.

| | before | after |
|---|---|---|
| `undersized-ui-text` | 380 | **0** |
| `skipped-heading` | 15 | **0** |
| `hero-eyebrow-chip` | 5 | **0** |
| `layout-transition` | 3 | **0** |
| `pulsing-dot` | 3 | **0** |
| `kicker-above-heading` | 2 | **0** |
| `low-contrast` | 69 | 45 |

### The type floor

The largest finding by a distance, and it had been invisible because it
was consistent: **every** functional label ran 8.5–10.5px. Years,
clients, counters, register numbers, the sector switcher, the CV's dates
and scores. At desk distance that reads as precision. On a phone it is
unreadable, and it was 380 instances.

The mono scale starts at **11px** now and steps 11 / 11.5 / 12 — 39
declarations across the five sheets plus 8 in the avatar studio. The
look survived; the risk was overflow, and the drawing-sheet register,
the tile captions and the CV were all checked by hand afterwards. One
casualty: the landing hint wrapped to an orphaned "it", so the line is
shorter now.

### The contrast token

`--ink-faint` was `#55535f` — **2.7:1** on the page ground, under the
floor on every caption it touches, which is most of them. `#7d7b88`,
4.9:1. In the avatar studio the same problem twice: `--ink-3` at 2.9:1,
and an accent-on-tint pairing at 3.9:1 that my first attempt made
*worse* (3.6:1) by darkening the tint instead of the text. Fixed by
darkening the accent.

### Four small ones

- **`transition: width` for three seconds.** The intro progress bar
  relaid out on every frame of the title card. `scaleX` with a left
  origin — identical on screen, free.
- **Two hero eyebrows, then a third.** "Hello — I'm" above GOVIND and
  "Portfolio" above the lede went in this pass; the project page's
  "02 · Technical Art" above the title turned up in the confirm round and
  went too. It was duplicating the back link one line above it anyway.
- **The About window skipped a heading level** and then nested backwards:
  `h2` → `h4` → `h3`. Now `h2` → `h3` → `h4`.
- **The CV had no measure.** The only unconstrained prose on the site, at
  109–114 characters a line. Capped at 72ch.

### The avatar studio had no typeface

It declared no `font-family` at all and took whatever the OS handed it,
which the detector reported as "Primary font: inter (100% of text)".
That is the definition of undesigned. It is set in Space Grotesk now —
the portfolio's face, already cached for anyone who arrived from there.

### What is left standing, and why

`all-caps-body` and `wide-tracking` are the mono label system, which is
the identity. `dark-glow` is the one accent, on one button.
`em-dash-overuse` is the writing voice. And a `1.1:1` reading on the
sector titles is a false positive — the detector composites `.panel`'s
semi-transparent gradient against the animating canvas and gets a
nonsense number; the real pairing is white on near-black at about 15:1,
visible in every screenshot ever taken of this site.

Three of those are now registered in `.impeccable/config.json` with
reasons attached, so the next run reports signal rather than taste.

---

## 16. A face, and a way out

**The About window opened on a paragraph.** It is built from a CV and
read by people deciding whether to work with him, and there was no
photograph anywhere on the site. There is one now, first in the header
with the summary beside it, stacking below 760px so the picture never
takes a whole phone screen before a word of the text.

The source was 2609x2609 and **5.1 MB**. It ships at 760px and **51 KB**,
and `assets/PIC.png` joins the other heavy sources in `.gitignore`. It is
framed like the work — a hairline, the same 12px corner as a tile, no
crop — and darkened slightly so a bright print sits in the room rather
than on top of it. The grid it was shot against happens to be the
drafting sheet two of the section pages are built on.

**The landing page ended on a wall of work with nothing after it**, which
reads as a page that was cut off. `mountGround()` in `shell.js` closes it
with the same card the top bar opens with, plus the way out to where the
work is published.

The marks are authored SVG in a new `js/icons.js` — 24x24, stroke 1.4,
matching the sector icons — not a glyph font and not emoji. Each carries
its name beside it, because a bare icon row makes a visitor guess and
there is room here.

`SOCIALS` in `site.js` is the list, and it **drops any profile with no
URL**. LinkedIn is not in the repo anywhere and was not invented: the
field is empty, so the icon is absent rather than pointing at a stranger.
One line when the URL arrives.

### One number moved twice

`--ink-faint` went 2.7:1 → 4.9:1 in section 15, which cleared the floor
on flat ground and then measured **4.4:1** over the reel's gradient — a
tenth short, and only visible because the detector re-ran against the
rendered page rather than the token. At `#86848f` it is 5.5:1 and clears
every ground on the site.

---

## 17. The character comes off the section pages

The rigged figure was the site's one piece of real-time character work,
and section 5 of this file is about halving its textures to make it
affordable. It is off both section pages now, and the reasoning is the
same reasoning that put it there — just followed further.

**Behind a wall of work it was competing with the work.** On
Visualization it stood above twenty-nine pieces the visitor came to see,
and the page held a 30vh band open at the top so it would be visible at
all. That is a third of the first screen spent on decoration.

**And it is the heaviest asset on the site.** 2.0 MB of GLB plus 0.5 MB
of maps, paid on every load of that page.

`props: { hero: false }` in `page.js` does not hide it — the group is
never built, so `onFirstShow` never runs and the file is never requested.

| | before | after |
|---|---|---|
| `assets/3d` requests, Visualization | 5 | **0** |
| `assets/3d` requests, Technical Art | 0 | 0 |
| page weight, either section page | ~2.7 MB | **222 KB** |

Technical Art never loaded it — its world is the gear train — but it
takes the same flag, so a future world that wanted a figure cannot pick
one up by accident.

**The band came down with it**, from `clamp(180px, 30vh, 340px)` to
`clamp(96px, 14vh, 170px)`. Enough sky for the terrain and the drifting
solids to read as a room before the work starts, and no more.

**The landing page keeps it**, where the world is the subject and
hovering the slice is what summons it — verified by driving the wheel
rather than trusting the flag: `PORTFOLIO.glb` and all four maps still
fetch there.

One thing worth writing down, because it cost a few minutes: the first
check said the landing page had *also* stopped loading it. It had not.
`onFirstShow` fires from the render loop as a world's weight eases past
0.01, and a backgrounded tab throttles `requestAnimationFrame` — no
frames, no easing, no load. The same false negative as the video and the
lazy tiles, in a third costume.

### The session's detector total

863 findings at the start, **425** now, across six surfaces at 390, 820
and 1440. `undersized-ui-text` 380 → 0, `overused-font` 3 → 0,
`low-contrast` 69 → 36, and four more rule classes cleared outright.

---

## 18. The wall, from the content up — and a rule that beat it

Three passes at this wall each fixed the previous one's symptom without
asking what the content was. So: every piece measured.

| shape | count |
|---|---|
| 9:16 | 18 |
| 3:4 | 7 |
| 4:3 | 3 |
| 16:9 | 1 |

**A portrait wall with four exceptions.** Two buckets had been stretching
4:5 posts to 9:16 and squashing 1.28 covers to 16:9, then handing the odd
ones double width so they shouted. Everything since follows from the
table.

1. **Four ratios, nearest wins.** `nearestShape()` picks by log distance,
   so a square sits exactly equidistant from 3:4 and 4:3 and the tie goes
   to portrait — the wall's own rhythm rather than a landscape cell.
2. **Fine row tracks.** 8px tracks, per-tile spans from a
   `ResizeObserver`. A tile stops where its content stops instead of
   waiting for the tallest cell in its row, which is what left the
   200-380px holes. It has to be measured: the ratio comes from CSS, the
   caption height from how many lines a title wrapped to.
3. **`dense`** hands what is left to the next tile that fits.

Fill went to **82.4%** against a ~94% ceiling once gaps are counted.

### The mechanism was wired and overridden at the same time

A critique caught what the implementation check could not. An earlier
`[data-orient="landscape"]` rule forcing 16:9 had survived the rewrite —
later in the file, identical specificity — so it won every tie. **Six
tiles rendered 16:9 whatever `nearestShape()` decided**, three of them
squares losing 44% of their frame.

The verification pass had confirmed `data-shape` was being *written*. It
never confirmed the rule was *winning*, and the fill percentage and shape
histogram both looked correct while six tiles were being overridden.
`NOTES.md` now carries the one-liner that compares rendered ratio against
declared shape; that is the only check that catches this class.

### Two measures that were the wrong unit

`max-width: 72ch` on the CV did not fix the long lines it was added for.
`ch` is the width of the "0" glyph, and Space Grotesk's figures run about
1.6x its average lowercase — so 70ch still permitted **110-character**
lines. At 46ch the measure is ~72 characters. The last three offenders
were the skills lists, which had no cap at all. `line-length` 19 -> 0.

And `buried-raster` was registered as deliberate but scoped to
`**/tiles.js`; URL scans attribute findings to the page, not the file, so
the ignore never applied in the mode this site is actually scanned in.
Re-scoped to the rule. 20 -> 0.

Visualization's detector count: **43 -> 4** at 1440, 45 -> 3 at 820,
29 -> 3 at 390. What is left is the mono label system, the accent, and
the writing voice.

### Left open, deliberately

The critique's remaining findings are in `NOTES.md` under "Next" — the
dangling tile at the foot of the wall, tiles that are not real `<a href>`
elements, no signal for which 24 of 29 destinations leave the site, and
the alignment-versus-variety fork on the track size. They are recorded
rather than guessed at.

---

## 19. The phone was a smaller desktop

Three faults, one cause: there was no phone tier. `is-narrow` covered
everything from a 900px tablet to a 360px phone on one set of values,
and at the bottom of that range the page was not a smaller desktop any
more.

### The reel could not be reached at all

`#stage` is `position:fixed; inset:0; touch-action:none` — a drag on the
canvas orbits the world instead of moving the page, which is right. The
gallery and project layouts have always relaxed it to `pan-y`. The
landing page grew a scroll in section 13 and never got that line.

On a desktop the wheel scrolls the page and nothing looks wrong. On a
phone the first screen **is** the canvas, edge to edge, so every upward
swipe was swallowed by the compositor before the page saw it. The reel,
the ground, the whole second screen: unreachable by the only input the
device has. One rule: `body.has-reel #stage{ touch-action:pan-y; }`.

Worth naming the shape of it — the bug was introduced by a feature in a
file that had no reason to mention the feature, and it was invisible in
every environment except the one it broke.

### Three things drawn through each other

At 390x844 the landing page's bottom band held `.lede` ending at 802,
`.reel__cue` spanning 760-810 and `#hintText` at 787-802. The lede is
anchored to the viewport bottom and the cue to the top of `.reel` at
`100vh - 84px`; neither knew about the other, and on a screen this short
they landed on top of each other. `.lede` now stops at 104px, which
gives the cue its band back.

The hint also read **"Hover a slice · the world changes"** on a device
that cannot hover. `main.js` has always had the touch wording; it only
applied it on the first tap, so the wrong line was the one every touch
visitor read first.

### The wheel outgrew the screen before it clipped

`fitCamera` sizes the wheel as a fraction of the viewport **half-height**,
with a guard against overflowing the width. On a tall narrow screen the
guard is what binds, and the wheel came out at 85% of the width — but
the sector labels ride a radius, so they left the pie, crossed the tick
ring and ran off the side well before the wheel itself did.
"VISUALIZATION" showed it first, because it is the one name with no
space to wrap at.

So: a `phone` tier at 620px, scale `0.78`, and a seat computed rather
than nudged — `seatY()` measures the band between the bar and the
headline and centres the wheel in it, which is what keeps it composed on
a 667px phone as well as a 932px one.

The first pass took the labels to 9.5px to make room. The detector was
right to call that back: **11px is the floor**, and the correct move was
the other direction — hold the type and scale the wheel to fit around
it. 0.62 with 9.5px labels became 0.78 with 11px ones.

### A wall 19 screens long

Visualization at one column gave each piece the full 358px, which a 9:16
crop turned into 671px of tile. Twenty-nine of those is **15,882px of
document — 18.8 screens**, and a mosaic that could only ever be read one
piece at a time, which is the one thing a mosaic is for.

Two columns to the bottom of the range: **4,973px, 5.9 screens**, 174px
tiles, and a landscape piece keeping its two-column span because there
that is the full width. The rule that had forced landscape tiles to a
single column below 520px only existed to serve the single-column wall
and came out with it.

### The one page you could not leave

`sectorNav()` has always built the three-sector switcher, and
`buildPanel` has always rendered it. `buildMosaic` was given only the
prev/next `foot`. So the single page on the site laid out as a gallery
was also the single page with no way to another sector short of
scrolling past 29 tiles to the footer — on a desktop as much as on a
phone. It now takes `nav` the same way it takes `foot`.

### What the pass cost and what it did not touch

Seven files. The desktop composition is untouched: the wheel still sits
on the golden section at 1440, the wall is still four columns at 1600,
and the only desktop change anywhere is the switcher that Visualization
was missing.

Detector, three device classes, four pages: the only findings left are
the four standing on purpose, plus the `low-contrast` readings on the
sheet pages that were there before this pass and are the same
`.panel`-gradient artefact recorded in `NOTES.md`.

## 20. The studio's chrome, and the page with no picture

### The avatar studio was wearing too much

Four faults, all of them the same fault: the chrome was drawn at the size
it would be on a desktop and then carried down to a phone unchanged.

- The **camera snaps** were 54px buttons with 20px icons under a caption
  reading "Camera", over four buttons that already say Fit, Torso, Face
  and Feet. Below 900px the rail also turned into a row across the top —
  which put those four buttons **across the avatar's face**, the one part
  of the preview every framing exists to show. It is now 46px buttons,
  16px icons, no caption, and the left edge at every width.
- The **category rail** wrapped eleven categories onto two rows. That is
  a second band of chrome on every screen, and it reads as a grid of
  equals rather than as one list you move along. Now one line that
  scrolls, an arrow at each end that moves it by a page and greys out at
  the ends, and a tab that scrolls itself back into view when a category
  is opened by something other than a click on it.
- The **thumbnails** were a fixed three columns. They are laid on
  `minmax()` now, so the same rule fills a 316px desktop dock and a
  phone's full-width one without a second column count to keep in step.
- **The preview got all of it back.** `--dock-w` 372 -> 316, and on a
  phone `--dock-h` 52vh -> 42vh. The clear preview on a 390x844 screen
  went from **309px to 405px — about a third more**, and the avatar now
  stands head to feet inside it instead of being cut off at the shins.

`--dock-h` is the piece worth keeping in mind: the camera rail and both
floating bars used to repeat the literal `min(52vh, 430px)` in their own
`bottom` and `top` values. They are all positioned against the variable
now, so the dock's height is stated once and nothing can drift out of
step with it.

And the same lesson as section 19, learned again in a different app: the
first pass took the camera labels to 10px to make the buttons smaller,
and the detector called them back. **Functional text holds at 11px.**
What shrinks is the icon, the padding, and the label that was restating
what the buttons already said.

### A section page with no picture on it

The sheet layout's preview stage is a hover affordance, and below 900px
it has always been `display:none` — correctly, there is no cursor to
hover with. Nobody looked at what that left: Industrial Design and
Technical Art on a phone were a title, a paragraph and a numbered list of
names. **No image anywhere on the page.** For a portfolio that is the
wrong thing to be, and it had been true since the sheet layout existed.

`sheetReel()` is the stage's job in a touch idiom — the same entries as a
strip under the header, each a tap from its page. Like the reel under the
wheel it is a `.tile` from the same engine, so the lazy poster and the
rules about where a click goes are not written a second time.

The one thing a strip needs that a wall does not is uniform cards, and
the reason is worth recording. The first build left a **160px hole**
under the strip. The cards on screen were 197-214px tall; the ones still
off screen were reporting 340px, because `contain-intrinsic-size` on
`.tile` guesses that height until a tile has rendered once. A flex track
takes the height of its tallest child, so the track was being sized by
cards nobody had seen yet. Fixed 4:3 crop, title clamped to two lines,
and the intrinsic size told the real answer: every card 179x197, track
361 -> 203.

### The dock stopped being a fixed slab

The first pass shrank the dock from 52vh to 42vh, which was the wrong
kind of fix: it still gave every category the same slab of screen. Six
skin tones and a wardrobe with a colour picker under it do not need the
same room, and setting one height for both means the preview pays for
the tallest category on every one of them.

Two changes finished it.

**The thumbnails became a line.** The wardrobe grid was the last thing in
the dock still spending the screen vertically, so below 900px it runs as
one row you push along — the same idiom as the categories above it and
the animations above those. The colour block cannot be a row (three HSB
tracks *are* the control) so it was tightened instead: the chip, the hex
and the reset share a line, and the tracks lost the padding between them.

The trade is real and worth recording rather than glossing: a row shows
four items where a grid showed a dozen, so a long category costs more
scrolling. It buys about 100px of preview on every screen, which on a
phone is the difference between seeing the avatar and seeing part of it.

**`--dock-h` stopped being a guess.** `trackDockObstruction()` in
`main.js` has always measured the dock to feed the camera its view
offset; it now writes that measured height to the root as well. So the
dock is `height:auto` with a cap, and the camera rail and both floating
bars follow whatever it actually is. The stylesheet value is only what
holds before the first measurement.

On a 390x844 screen, the clear preview by category:

| | dock | preview |
|---|---|---|
| before this session | 430px | 309px |
| after the first pass | 342px | 405px |
| Skin — no colour picker | **234px** | **537px** |
| Top — with colour picker | **367px** | **404px** |

The simple categories are where most of the time goes, and they are now
almost three-quarters preview.

Desktop is untouched: the dock there is a tall column with room to
spare, the grid stays a grid, and `--dock-h` measures 0 because a side
dock obstructs nothing vertically. A carousel is what a bottom sheet
wants, not what a side panel wants.

### The switcher was wrapping 2 + 1

Three pills wanted **386px of a 336px row**, so they wrapped — Industrial
Design and Technical Art on one line, Visualization alone on the next.
That reads as two groups rather than as one set of three, and the odd
one out is the page most likely to be the one you want.

Trimming padding and gaps recovers about 45px, which is not enough and
leaves nothing for a 360px phone. The **register numeral** is what
actually costs it: 13px of glyph plus the 8px gap after it, 63px across
three pills — and it is the one thing in that row that is said twice,
because the header directly above already carries `01 / 03` for the
sector you are on. Dropping it on phone and trimming the padding to 10px
brings the row to **301px**, which fits a 375px SE as well as a 390px
screen. `nowrap` with a scroll is the valve below that, so the row bends
before it breaks rather than silently wrapping again.

The numerals stay everywhere wider — verified still rendering at 820 and
1440, where the row has always fitted on one line.

### Fit was not fitting

The avatar still stood with its feet under the light bar on a phone, and
the cause was not the dock at all.

`frame()` solves the distance that makes a preset's `fit` fill the
shorter viewport axis, then clamps it between `controls.minDistance` and
`controls.maxDistance`. **`maxDistance` is 6, and on a 390x844 screen
`full` asks for 6.91.** So Fit quietly delivered a shot 13% closer than
the one it had computed, every time, and nothing said so. The orbit
ceiling exists to stop somebody flying away from the avatar; it had been
silently deciding how wide a framing was allowed to be.

Two changes. `frame()` now lifts `maxDistance` to whatever the shot needs
and lets it fall back for the close framings — measured returning to 6
for Torso, Face and Feet. And the solve runs against the **visible** axes
rather than the canvas: the dock hides part of the viewport and
`#applyFocusOffset` slides the picture into what is left, but sliding is
not scaling, so a shot solved for the whole canvas is sized for room the
dock is standing on.

Which viewports that actually moves, worked out from the two formulas
rather than guessed:

| | before | after | |
|---|---|---|---|
| Desktop 1440x820 | 3.195 | 3.195 | unchanged |
| Tablet 820x1180 | 4.597 | 4.597 | unchanged |
| iPhone SE 375x667 | 5.682 | 5.682 | unchanged |
| **iPhone 14 390x844** | **6** (clamped) | **6.914** | fixed |
| **Pro Max 430x932** | **6** (clamped) | **6.926** | fixed |

Only the screens tall enough to have been hitting the clamp change,
which is the whole of the bug. The SE never clipped because its shorter
aspect asked for 5.68 and got it.

A note on how this was checked, because the obvious method failed:
swapping the committed `viewer.js` back in to measure the before state
did not work — the browser served the module from cache and reported the
new numbers under the old file. The table above is the two formulas
evaluated side by side, which is exact; the measured desktop and tablet
figures agree with it to three decimals.

### The preview took 70%

Asked for directly, and it turns the dock's ceiling into the one number
that decides the split: `calc(30dvh - 10px)`. The 10px the dock floats
above the bottom edge counts against the 30% — leave it out and the
preview comes to 68.8%, which is the kind of miss that looks like a
rounding error and is not one. `dvh` over `vh` because on a phone `vh`
is the tall viewport and ignores the browser's own chrome, so 30vh is
30% of a screen the visitor cannot entirely see.

| | dock | preview |
|---|---|---|
| iPhone SE 375x667 | 190px | 70.0% |
| iPhone 14, no colour picker | 234px | 71.1% |
| iPhone 14, with colour picker | 243px | 70.0% |
| Pro Max, no colour picker | 234px | 73.8% |
| Pro Max, with colour picker | 270px | 70.0% |

Never below 70%, and more when the category is short, because the dock
is still auto-height under the cap.

**The cost is real and is recorded rather than buried.** A category with
a colour picker now has about 126px of visible panel. The thumbnail row
fills it, so the H/S/B block sits below the fold — 123px of scrolling to
reach the colour of the thing you just put on. Whether that is the right
trade depends on how often colour gets used against how much the
character being large matters, which is a judgement for whoever owns the
work, not for the person who moved the number. The lever is that single
ceiling: `calc(35dvh - 10px)` puts the colour block back on screen and
the preview at 65%.

### Checked

Detector at 390, 820 and 1440 across four pages and the studio: nothing new.
The studio's remaining `low-contrast` readings were verified against the
committed build before this pass — same rule, same count — and are the
app's own accent-on-accent-soft selection pairing sampled through a
translucent bar over a moving 3D canvas. Raising the bar's opacity was
tried and moved the number not at all, so it was reverted rather than
left in the diff doing nothing.

## 21. Reproduction record — sections 19 to 20

Sections 19 and 20 say *why*. This is the *what*, tight enough to rebuild
from if the tree is ever lost, and honest about where the work actually
lives.

**It lives on `upstream` only.** `gbmworks/portfolio` has both commits;
`gbmPrimetrace/portfolio` has neither and cannot be pushed from this
machine — see "Where to push" in `NOTES.md` for the checked reason. A
clone of the fork is well behind and none of what follows is in it;
`git log --oneline main..upstream/main` says by how much.

```
351c580  Make the phone its own tier, not a narrower desktop   (20 files, +1165 -155)
10f5913  Give the character 70% of a phone screen              ( 5 files,   +89  -10)
```

### The portfolio site

| file | change |
|---|---|
| `css/landing.css` | `body.has-reel #stage{ touch-action:pan-y }` — without it a phone cannot scroll the landing page at all |
| `css/project.css` | the whole `@media (max-width:620px)` phone tier; `.sreel` strip; sector pills to one line (`.sectors a span{display:none}`, `flex-wrap:nowrap`, padding 13→10) |
| `css/tiles.css` | mosaic stays 2 columns to the bottom of the range — the ≤520 single-column rule and its landscape span-1 partner both deleted |
| `css/sections.css` | `.galbar .sectors{flex:1 0 100%}`; `--sheet-pad` named on `.panel__scroll` so `.sreel` can bleed to exactly it |
| `js/main.js` | `phone` tier at 620px, `is-phone` class, `wheel.view.scale = 0.78`, `seatY()` measuring the band between bar and headline; touch wording for the hint |
| `js/page.js` | `sheetReel()`; `nav: sectorNav(index)` passed to `buildMosaic` |
| `js/tiles.js` | `buildMosaic` accepts `nav` and renders it in `.galbar` |

### The avatar studio

Source of truth is `content/Fitmint/AvatarStudio/src/`; `studio/fitmint/`
is its build output and both appear in every diff. **Never edit the
output** — `node deploy.mjs` overwrites it.

| file | change |
|---|---|
| `src/ui.js` | `.rail-wrap` with two arrows around a single-line `.rail`; `#scrollRail()`, `#railEnds()`; active tab `scrollIntoView`; the visible "Camera" caption removed (the `aria-label` stays) |
| `src/main.js` | `trackDockObstruction()` also writes the measured dock height to `--dock-h` |
| `src/viewer.js` | `ORBIT_MAX` constant; `frame()` solves against the **visible** axes and raises `controls.maxDistance` to whatever the shot needs instead of being capped by it |
| `src/styles.css` | `--dock-w` 372→316; camera snaps 54→46px with 16px icons, left-vertical at every width; thumbnails on `minmax()`; on phone the grid becomes a scrolling row; dock `height:auto` capped at `calc(30dvh - 10px)` |

### The numbers that matter

| | before | after |
|---|---|---|
| Visualization on a phone | 15,882px · 18.8 screens | 4,973px · 5.9 screens |
| Studio preview, 390x844, skin | 309px | 537px (71%) |
| Studio preview, with colour picker | — | 591px (70%) |
| `Fit` camera distance, 390x844 | 6 (clamped) | 6.914 |
| Sector switcher | 386px into a 336px row, wrapped | 301px, one line |

### Two rules this cost something to learn

1. **Functional text holds at 11px.** Two separate passes shrank labels to
   make something else fit; the detector called both back. What shrinks is
   the icon, the padding, and any label restating what its buttons say.
2. **Measure the rendered result, not the attribute** — and on a phone,
   measure it in a screenshot. A backgrounded tab runs no `requestAnimation-
   Frame`, so anything damped never arrives and the DOM reports a position
   the eye never sees. Traps 7 and 8 in `NOTES.md`.

## 22. Two doors that opened onto the street

Both runnable things had a way out and both used it wrong.

The game's `#exit` pill and the studio's wordmark arrow were `../../` —
one folder up from `/game/unicorn/` or `/studio/fitmint/`, which is the
site root. That was chosen in section 12 for a good reason: it is the
one path that resolves to something sensible wherever the folder is
served. But "sensible" was doing a lot of work. Leaving a full-screen
game put you on the landing page, in front of the 3 s intro and a wheel
with three sectors on it, with no trace of where you had just been.

**For the game it is worse than a nuisance.** Its Technical Art row
carries `liveFromRow`, so a click plays it — the record's own page is
the single thing on the site a player has never seen, and it is where
the write-up, the prev/next arrows and the route to another sector are.
The back link is the only route to it that exists.

**For the studio the page is most of the project.** The tool is one
piece of Fitmint; the reels, the posts and the write-up are the rest,
and the page is exactly what `liveFromRow: false` was set to make people
arrive at in the first place. Sending them past it on the way out undid
that.

Both now point at `project.html?p=…`, which closes the loop: each page
carries the button back into the thing you just left — *Play the game*,
*Edit an avatar*.

**What it costs.** The links are deep now, so they only resolve on the
portfolio; a standalone dev server has no `project.html`. That is the
whole of the trade and it is worth naming, because the old comment in
both files advertised the opposite property.

Both edits are in a **build source**, not the output:
`content/Unicorn/dist/index.html` (tracked — one of the two exceptions
to the `content/Unicorn/dist/*` ignore) and
`content/Fitmint/AvatarStudio/index.html`. Each needs its own
`node deploy.mjs`, and both appear twice in the diff.

### The cover that lost its head

Fitmint's `coverf.jpg` is a 788x1400 figure standing full height. Every
tile frame on the site is wider than 9:16, so a centred `object-fit:
cover` keeps the middle band — which on a standing figure is waist to
knee. The 4:3 card in the phone strip is the worst of them: 42% of the
height, centred, is **403 to 996 of 1400**, and the top of his head is
at 370.

Section 12 already solved this once for the clip and recorded why one
value could not solve it for both: `previewFocus` is `50% 5%`, tuned for
`male.webm` in a 16:10 stage, and the README notes that the same shift
on the cover "would show mostly sky". So the cover needed its own field,
not a shared one.

`coverFocus`, `object-position` for the still in `entryTile()`, Fitmint
at `50% 25%`. It was picked against the frames that actually crop:

| frame | band of the 1400px cover | head 370-450 | boots end ~1040 |
|---|---|---|---|
| phone strip, 4:3 | 202 - 793 | upper third | out, deliberately |
| landing reel, 4:5 | 104 - 1089 | in | in |
| Visualization mosaic, 9:16 | whole image | n/a | n/a |

The strip was the point of the change and the reel was the constraint on
it — anything past 25% starts cutting the boots there for no gain in the
strip. The desktop sheet page never enters into it: at that width the
strip is hidden and the cover is shown by the preview stage, centred,
which is unchanged.

`resolveEntry` already carried `focus` for the clip, so this is
`stillFocus` beside it and one more field on `tile()`. Like its
neighbour it touches one layer: the clip laid over the still on hover is
a different file and takes neither value.

### Checked

Both destinations `200` and render their record, with the button back
into the thing just left. The entry-integrity and `live:`-target checks
from `NOTES.md` both pass. `allocate` is idempotent; `sitemap` rewrites
only `lastmod`, which is what it is for.

---

## 23. The card, the wheel, and four things that were saying nothing

### The resume is a file now, and Contact is not on the bar

The bar was About and Contact, where Contact was the link hub. It is
About and Resume: About is the CV as HTML and Resume opens the PDF, so
the pair reads "read it here / take it with you". Everything Contact was
for — the profiles, the address, the hub — is in the footer, which is
where a visitor looks for it.

`assets/cv/govind-b-mohan-cv-2026.pdf`, renamed on the way in because the
source has spaces and every tool that touches such a URL escapes them.
`SITE.cv` is the path; `SITE.cvName` is what a download is saved as,
which is why it is a person's name and not the slug.

**Two actions in the About window, because one link cannot do both
jobs.** Opening a PDF and saving one are different intents. *Resume
(PDF)* opens in a new tab; *Download* beside it carries the `download`
attribute. A phone will happily open a PDF in a viewer and give no
obvious way to keep it, which is the case the attribute exists for. The
pair is in the window and not the bar because a bar has room for a
destination, not for a choice — and the window is on every page at both
sizes, which is what "for both phone and pc" needed.

`tools/serve.mjs` had no `.pdf` in its type table, so locally the file
came back `application/octet-stream` and the browser *saved* it. Both
buttons did the same thing on the dev server and different things in
production. One line.

### The footer was three things in three corners

`space-between` across a name card, a pill row and an address. At the one
width the row was full it read as three unrelated items pushed into the
corners; below that it wrapped, and the three social pills went to two
lines because each carried its name beside its mark.

It is a centred stack at every width, and the pills are marks alone. The
names came off on the observation that LinkedIn, Behance and Instagram
are three of the most recognisable glyphs a portfolio can put in a
footer — and the name is still on each of them in `aria-label` and
`title`. Three 42px circles at `nowrap` come to 146px, which fits the
narrowest phone the site is built for with room to spare, so there is no
width at which wrapping is the right answer any more.

On a phone the two mono lines under the name went to **9.5px**. They are
supporting text under a closing card; at 11px the role line wrapped to
two and competed with the name above it. **The email did not go with
them** — it is the one thing down there somebody reads character by
character and may have to copy, so it holds the floor.

### "Bangalore, India · from Kerala" was a bio line

It is `Kerala ⇄ Bangalore, India` now — two places with a back-to-back
arrow, which is the actual arrangement rather than a place with a
footnote. `site.js` holds it as `from` / `to`, so the fact stays a fact,
and `BASED_LINE` in `icons.js` draws it.

**The arrow is drawn and not typed, and that was measured rather than
assumed.** None of the candidates is in JetBrains Mono: U+21C4, U+21C6,
U+2194, U+27F7 and U+21CC all fall through to a system face. The mono
cell is 6.6px at 11px; every one of them came back at 9.2 or more — 40%
over the cell, which inside a line of tracked monospace reads as a
mistake. So it is an authored SVG at the site's own stroke weight, like
every other mark here. `inlineSvg()` in `icons.js` is the 12px frame for
marks that sit in a line of type rather than in a button.

### The wheel: the band is not the screen

Section 19 fixed the names running off the *side* of a phone, and fixed
it the right way — hold the type, scale the wheel. What it did not fix,
because it was not looking there, is that the names also collide
*inward*.

A label is centred on its anchor and the anchor sat at the middle of the
donut's band — about 64px of it at 390px. "VISUALIZATION" is one word
with nothing to wrap at, so at 11px it was wider than the band it was
centred in: its inner half crossed the hub disc and landed on the words
"A SECTOR" printed there. Measured on the rendered page, 390x844: the
name ran 97-172px and the hub disc began at 163.

Two levers, and **the seat did most of the work**:

| | |
|---|---|
| `wheel.view.labelSeat` | 0 at the hub, 1 at the rim; `0.5` everywhere, `0.63` on a phone. `projectLabels()` rebuilds the anchor from it each frame, so `labelLocal` is no longer fixed at construction and a tier can set the seat like it sets the scale |
| the type | names 11 -> 10px, `SELECT` 11 -> 9.5, `A SECTOR` 12 -> 10.5, tracking pulled in |

Seating outward moves the collision to the rim, where there is a tick
ring and no type. The type step is below the floor and is meant to be:
three words on one screen, each also a 44px tap target with its own
icon, against the alternative of a sector name printed through the hub.
Five `undersized-ui-text` findings, recorded in `NOTES.md`, not
suppressed.

**This one gets worse on a shorter phone, not a narrower one.** The
wheel is sized off the viewport and a name is 10px whatever the viewport
is, so 375x667 is the case to check — and it is clear there too.

### A tile that spans every column is a barrier

Gaps on the Viz wall on a phone, worst towards the end. The cause is
structural and it is not `dense`'s fault: the grid cannot place a
full-width tile until *both* columns are free, so the shorter one stops
where it is and waits. With three columns a span-2 tile still leaves one
open and dense fills around it. At two it leaves none.

Measured on the 29-piece wall at 390px — two real holes, **191px** and
**279px**, each sitting directly above a 4:3, and the second near the
bottom where there is no later tile left to backfill with, so it simply
stood there.

In the two-column range nothing spans both now. The wall went from
**5,824px to 4,696px** — 19% less scroll — with **no hole anywhere**.
The span survives at 3+ columns, which is what it was written for: the
"postage stamp" argument is about a narrow column in a wide wall, and at
two columns the column is half the screen. The bottom edge is ragged by
one tile, which is what masonry does rather than a defect.

### A link that promised more and led nowhere

`links.push(['More on Instagram', SITE.instagram])` was unconditional and
pointed at the *profile*, not at anything about the project. On the eight
records with neither a Behance case study nor a post of their own —
Primetrace, Metabrix, the 2024 freelance run, the facial-capture
pipeline, the game, Hecoll, Cradlewise, TIGC — the page ended on an
invitation to see more of something there was none of. One of them is
the game's page, which is now where its back button lands.

`p.posts` is the test, because it is the same list the Posts grid below
is built from: if that section is on the page there is something to go
and see. With both links gone the `<ul>` is not rendered at all rather
than left empty.

### The rows had names and nothing else

Below 900px the preview stage is `display:none` — there is no cursor to
hover with — and what was left of a section page's index was thirty
numbered titles. Section 19 answered that with the `.sreel` strip; this
adds the other half, a 64px 4:3 thumbnail on each row, in a third column
spanning both of the row's lines. It honours `coverFocus`, so Fitmint
shows a face here too. The chevron comes off at this width: it is a
hover affordance, and all it was doing was holding 16px open next to a
picture.

`loading="lazy"` rather than the tiles.js observer — these are the files
the strip above already asked for, so they are in cache by the time a row
scrolls up, and a row has no poster swap, no clip and no hover state to
drive.

**This leaves the same entry pictured twice on a phone**, once in the
strip and once on its row. Both exist for the same reason and one of
them is enough. It is in `NOTES.md` under "Next" as the question to
settle, together with the two "All work" affordances, rather than being
settled quietly here.

### A bug worth naming

The first version of the About window's PDF block put backticks around
the word *download* inside an HTML comment — inside a JS template
literal, where a pair of them ends the string. `js/overlays.js` threw
`SyntaxError: Unexpected identifier 'download'`, `data-ready` never got
set, and every page fell through to the boot guard's plain-links
fallback. It looked exactly like the known WebGL-in-an-automated-browser
trap and cost twenty minutes of chasing that instead. **The console said
it in one line.** Read it first.

### Checked

Impeccable across 390x844, 820x1180 and 1440x900 on all four page types.
What it reports is the four findings standing on purpose from before,
the `low-contrast` `.panel`-gradient artefact from before, plus exactly
the seven undersized ones listed above — no new class of finding. Entry
integrity, `live:` targets and the CV path all resolve; `allocate` is
idempotent; `sitemap` rewrites only `lastmod`.

A note on the detector itself: `--json` emits a **bare array**, not an
object with a `findings` key. A parser that reaches for `.findings` gets
`undefined`, prints "none" for every page, and tells you the site is
clean when it is not. It did, for one run.

---

## 24. One door, and the two ways it did not open

### Resume came off the bar

It had been on it for about an hour. Contact -> Resume was the right
move; Resume -> nothing is the better one, because the About window it
sits beside grew the pair of PDF actions in the same pass. The bar was
offering a second door to the first room inside the first door.

So: identity left, one About pill right, on all four page types.
Everything the bar used to reach is one level in — in the About window,
or in the footer under the work.

**About is drawn as a button now.** It shared a treatment with "All
work" when the bar had three items, and an underline was enough to tell
those from the wordmark. Alone, a bare mono label reads as a caption
rather than as the way in to everything about the person. The outline is
the sector switcher's, which is already this site's word for "tappable".

### The name and the button were 14px apart

`.topbar` was `align-items:flex-start`, which was right when both sides
were plain lines of type. It stopped being right in section 19, when the
nav links grew a 44px touch box: a box that tall centres its own label,
so the wordmark sat at the top of the bar and "About" sat in the middle
of a box below it. Two things that read as one row, on different lines.

Centred against each other now, and `.topbar__id` carries the same 44px
so the two sides are the same height rather than merely sharing a centre
line. Measured after: the wordmark's centre and the pill's centre are
both at y=30 on every one of the four layouts.

### Then the door turned out not to open

Making About the only way in meant checking that it works, and on two
counts it did not — both of them old, both of them invisible until now.

**On the sheet pages, below 900px, the bar was behind the panel.**
`.panel` is z-index 30 to the bar's 20. On a desktop that never
mattered: the sheet is a column on the left, the nav is flush right, and
they do not meet — which is exactly what `justify-content:flex-end`
bought when section 3 first found this. At phone and tablet widths the
panel is the full width, so there is no right-hand side to move to. The
links were visible through a translucent panel and dead to the touch;
`elementFromPoint` on the About pill returned `.panel__scroll`.

**About and All work have been unreachable on Industrial Design and
Technical Art on every phone since the sheet layout existed.**

`.ui` is what has to move, not `.topbar`. z-index 20 on a positioned
element makes a stacking context, so raising a child inside it cannot
escape it — a fact worth writing down, because the instinct is to put
the z-index on the thing you can see. `.ui` is `pointer-events:none` and
only the nav re-enables them, so lifting it takes the links out from
under the panel without taking the panel's scroll with them. In front,
it needs the falloff the other scrolling layouts already have, or the
sheet's own headline passes through the bar's type on the way up.

**The wordmark was inert everywhere.** The same cause wearing its other
half: everything inside `.ui` that can be clicked has to say
`pointer-events:auto`, `.topbar__nav` did, and `.topbar__id a` never
did. On the mosaic and on a project page the one-tap way home has done
nothing at all. The anchor only — the role line under it is not a
target.

### Two "All work", fifty pixels apart

Bringing the bar forward made visible something that was always there:
every page that puts "All work" in the bar also carries its own —
`.panel__back` on the sheet and the project page, the back link in
`.galbar` on the mosaic — and at this width the bar's copy sits directly
above the page's.

Below 900px the bar's copy goes. The page's is the larger target, it has
the chevron, and it sits in the same band as the sector switcher, which
is the rest of the navigation. Desktop keeps both: there the bar's is the
only one not inside a scrolling column, and nothing is crowded.

And with the bar in front, the sheet's wordmark comes back at that width
— it was hidden because the sheet occupies the top-left and the bar was
behind it, which is the same fact that made the nav unclickable. The bar
now reads the same on all four page types: identity left, About right.

This is half of open item 0's "two All work affordances, which should be
settled for both at once". The phone half is settled. Desktop is not,
and that is deliberate rather than forgotten.

### Checked

All four layouts at 390x844: the About pill and the wordmark both pass
`elementFromPoint`, exactly one "All work" is visible per page (none on
the landing page, which has nowhere to go back to, and none on a project
page, whose back link names its sector instead), and no page overflows
horizontally.

Detector across the three device classes: the standing findings, the
`.panel`-gradient `low-contrast` artefact, and the seven undersized ones
from section 23. Nothing new.

One finding moves around between runs and is worth not chasing:
`content-hidden-at-rest` on the landing page at 1440. What it is seeing
is the three `.label__title`s, which are `opacity:0` until a slice is
hovered, and the reel captions, which are `opacity:0` until `.reel.is-in`
fires on scroll. Both predate all of this. Whether it reports depends on
whether the reel had scrolled in when the detector measured, which is
why it appears in one run and not the next.

---

## 25. Reproduction record — sections 22 to 24

Sections 22 to 24 say *why*. This is the *what*, tight enough to rebuild
from, and honest about where the work lives.

**Shipped as one commit**, `6817efa` "Land on the work, not the front door
— and fix the phone", 25 files, +1253 -118. On `gbmworks/portfolio` only;
`gbmPrimetrace/portfolio` has none of it and cannot be pushed from this
machine — see "Where to push" in `NOTES.md`. Built and verified live on
2026-09-13.

One commit and not three, which is worth saying plainly: the three
sessions touched `README.md`, `content/NOTES.md`, `content/WORKLOG.md`,
`js/shell.js` and `css/project.css` in common, and splitting those by
theme would have meant staging hunks and inventing a history the working
tree never had. The sections below are the split.

### The portfolio site

| file | change |
|---|---|
| `js/shell.js` | Contact → Resume → nothing; the bar is identity plus one `.topbar__about` pill. `mountGround` drops the label span beside each social mark and renders `BASED_LINE(SITE)` |
| `js/site.js` | `cv` / `cvName`; `based` split into `from` / `to`, with `BASED_TEXT` as the plain-text form |
| `js/icons.js` | `inlineSvg()` — a 12px frame for marks inside a line of type; `ICONS.shuttle`, the back-to-back arrow; `BASED_LINE()` |
| `js/overlays.js` | the About window's `.win__cv` pair — *Resume (PDF)* and *Download* |
| `js/page.js` | `entryRow` renders `.plink__thumb` from `e.still`, honouring `e.stillFocus` |
| `js/projects.js` | `coverFocus` field; Fitmint at `50% 25%`; `resolveEntry` emits `stillFocus` |
| `js/tiles.js` | `tile()` takes `focus` and puts it on the still only; `entryTile` passes `entry.stillFocus` |
| `js/project.js` | the Instagram link is gated on `p.posts`; the `<ul>` is not rendered when both links are gone |
| `js/wheel.js` | `view.labelSeat`; `projectLabels()` rebuilds the anchor from it each frame instead of `labelLocal` being fixed at construction |
| `js/main.js` | `wheel.view.labelSeat = phone ? 0.63 : 0.5` |
| `css/landing.css` | `.topbar__id a{pointer-events:auto}` — the wordmark's link was inert everywhere; `.topbar__nav` centred; the `.topbar__about` pill |
| `css/project.css` | the row thumb at ≤900px and the grid that holds it; `body[data-layout="sheet"] .ui{z-index:40}` plus the bar's falloff; the bar's "All work" dropped and the sheet's wordmark restored at that width; `.topbar` centred and `.topbar__id` given the 44px; the wheel's 10px names and 9.5/10.5 hub |
| `css/sections.css` | `.plink__thumb` base rules |
| `css/tiles.css` | `grid-column:span 1` for 4:3 and 16:9 inside the two-column range |
| `css/about.css` | the ground as a centred column; 42px icon circles at `nowrap`; `.win__cv` / `.win__cta`; `.between` and its mark; the 9.5px phone lines, email excluded |
| `tools/serve.mjs` | `.pdf` → `application/pdf` |
| `assets/cv/…pdf` | new, 727 KB, the file `SITE.cv` points at |

### The two runnable things

Both are build sources whose output is also in the diff. **Never edit the
output** — `node deploy.mjs` in each folder overwrites it.

| file | change |
|---|---|
| `content/Unicorn/dist/index.html` | `#exit` → `../../project.html?p=lenskart-ar-game` |
| `content/Fitmint/AvatarStudio/index.html` | `.brand-back` → `../../project.html?p=fitmint-avatars`, and its `title` / `aria-label` renamed to match |

### The numbers that matter

| | before | after |
|---|---|---|
| Viz wall, 390px | 5,824px, two holes of 191 and 279px | 4,696px, none |
| Fitmint's cover in the phone strip | 403–996 of 1400 — head cut | 202–793 — head in the upper third |
| "VISUALIZATION" vs the hub disc | ran 97–172px, disc began at 163 | clear at 375x667 and 390x844 |
| Records offering "More on Instagram" with no posts | 8 | 0 |
| Social row on a phone | two lines of pills | one line of three 42px circles |
| Wordmark ↔ About centres | 14px apart | both at y=30, all four layouts |
| About reachable on a sheet page, ≤900px | no — `elementFromPoint` gave `.panel__scroll` | yes |

### Three rules this cost something to learn

1. **No backticks inside a template literal**, comments included. A pair
   of them ends the string; `js/overlays.js` threw and every page fell
   through to the boot guard. It looked exactly like the
   WebGL-in-an-automated-browser trap and was chased as one. The console
   had it in a single line.
2. **Read the tool's actual output shape.** The Impeccable detector's
   `--json` is a bare array. A parser reaching for `.findings` gets
   `undefined` and prints "clean" for every page — which it did, for nine
   pages, right after a pass that had introduced seven findings.
3. **z-index on a child cannot escape its parent's stacking context.**
   `.ui` is z-index 20; raising `.topbar` inside it does nothing. Raise
   `.ui`.

---

## 26. A face, an origin, and a strip that never moved

Three pieces of work on 2026-09-14, and one mistake in how they were
shipped that is worth more than any of them.

### The headings got their own face

`Stack Sans Notch` (Koto, variable 400-700, one 32 KB latin file) now
sets the headings and only the headings: the splash wordmark and the
bar's 14px copy of it, the landing hero, page and section titles, the
panel subtitle. Space Grotesk keeps every paragraph, lede and small
label; JetBrains Mono keeps the uppercase eyebrows and counters.

The list of what counts as a heading is **one rule in `base.css`**
rather than a `font-family` scattered across five sheets, so "what is a
heading on this site?" has one place to read the answer and one place to
change it. Three things are deliberately outside it: the mono voice,
because that is what a title is set *against* and a third face there
leaves nothing to contrast with; body copy; and the 10-12.8px labels —
`.tile__title`, `.label__title`, `.stage__title` — which read as
captions on a picture, and where a face cut for 40px has nothing to
show. The bar's 14px GOVIND is *in* despite its size for the one reason
that overrides it: it is the same word as the splash.

Checked before shipping: the detector reported identical findings before
and after on three pages at 390x844 and 1440x900, and every character in
all 23 project titles and 3 section titles is inside the two subsets
Google serves for that face — the same class of check the back-to-back
arrow needed, and for the same reason.

### One origin instead of three

The landing page opened this origin, `cdn.jsdelivr.net` for three.js,
and the Google Fonts pair. **The bytes were never the problem** — 305 KB
over 44 requests is a lean page. The problem was that two of those
origins cost a DNS lookup and a TLS handshake each, and neither could
begin until the import map or the font stylesheet had already come back.
No preload scanner can shortcut that.

Both are now in the repo, by generator and not by hand:

| | |
|---|---|
| `node tools/vendor.mjs` | `vendor/three/`, 14 files, pinned 0.169.0 |
| `node tools/fonts.mjs` | `assets/fonts/` + `css/fonts.css`, 17 files |

`vendor.mjs` follows imports from the six modules the site actually
opens rather than carrying a list of three's internals, because a
hand-kept list of a library's guts goes stale on the next bump. It
mirrors three's own directory layout, so an addon's relative imports of
its siblings resolve without rewriting upstream source. `fonts.mjs` asks
Google for the CSS with a Chrome user agent — it serves ttf to anything
it does not recognise — and keeps the unicode-range splits, so a page
with no latin-ext character still never fetches the latin-ext file. Both
take `--check`: they write nothing and exit 1 on drift.

Measured on the live site, mobile, median of three Lighthouse runs, on
either side of a revert and then again after reapplying:

| | on a CDN | self-hosted |
|---|---|---|
| First contentful paint | 3,963 ms | **2,410 ms** |
| Largest contentful paint | 4,998 ms | **3,500 ms** |
| Performance score | 37 | 52-56 |

First paint reproduced within 4 ms across two separate rounds. Desktop
went 941 ms to 542 ms. **Speed Index is deliberately absent** — it read
4,765 ms in one round and 7,037 ms in the next on identical bytes, and
has no business being quoted as a result on a page whose wheel is still
animating while it is sampled.

### The strip that had never moved

Two bugs in `js/reel.js`, one hiding the other.

**The idle drift could not move.** `scroll-snap-type: x proximity` on
the track and `scroll-snap-align: start` on the cells are what make a
swipe land on a card rather than between two. They are also why a
14 px/s drift could not exist: the strip begins *at* a snap point,
14 px/s is about 0.23 px per frame, and every one of those writes landed
inside the proximity threshold, so the browser pulled it back before the
next frame. `scrollLeft` sat at 2 on every build ever shipped.

**The loop ran anyway, for that nothing.** It re-requested a frame
unconditionally and returned early when there was nothing to do, so a
visitor who never scrolled that far still paid sixty wake-ups a second
for the life of the tab. Lighthouse charged ~2,300 ms of the landing
page's blocking time to the file for 63 ms of actual script — the
largest single entry on the page.

Both fixed. Snap is suspended for the duration of the drift and restored
the moment it ends; the loop starts on intersection and is cancelled
when the strip leaves the screen, when the drift finishes, when somebody
takes hold of it, and on `visibilitychange`. `reel.js` fell from
~2,300 ms of long-task time to ~140 ms.

### The mistake: those two were shipped as one commit

The self-hosting is invisible and the drift fix is not — it makes a
strip move that nobody has ever seen move. They went in as one batch,
the batch was reverted, and the speed went with it. It then had to be
reapplied separately. One extra round trip and two extra live deploys,
for a bundling decision.

The reel work was redone as **two commits on purpose**: `59522bf` stops
the loop (invisible, land it and move on) and `791fba7` suspends snap so
the drift moves (visible, a decision). Reverting the second leaves the
first standing. That is the rule now: **invisible wins and visible
changes never share a commit.**

### Three things that cost something to learn

1. **Lighthouse TBT and TTI get *worse* as this site gets faster.** TTI
   wants five seconds of main-thread quiet, and a page with a WebGL
   render loop never gives it one — so TTI runs to the end of the trace
   and TBT accumulates across the whole window from first paint to that.
   Self-hosting moved first paint 1.6 s earlier, which *widened* the TBT
   window from 4.8 s to 11.9 s and made the number look four times worse
   while every metric a visitor can feel improved. Read FCP and LCP here.
2. **A hidden tab never runs rAF**, so animation cannot be tested in
   one. The browser this session drives reports `visibilityState:
   hidden` permanently: screenshots still render, but frame counting and
   drift measurement silently return zero. `tools/reel-test.mjs` drives
   a real Chrome over CDP instead — Node 24 has a native WebSocket, so
   it needs no packages. Both reel bugs were confirmed that way, against
   the unfixed live site as a control.
3. **The Pages build record's `.commit` lags.** After pushing `406be02`
   the latest build still read `a56b120` while the new bytes were
   already being served; a wait loop keyed on the SHA hung for five
   minutes on a finished deploy. Grep the served file. `NOTES.md` said
   to check the bytes and not the status — it was right, and this is the
   sharper version of why.

---

## 27. Reproduction record — section 26

The *what*, tight enough to rebuild from.

| commit | what |
|---|---|
| `970f171` | the display face: `--display` token and one heading rule in `css/base.css`, the family added to the font link in six shells |
| `173723d` | `tools/vendor.mjs`, `tools/fonts.mjs`, `vendor/`, `assets/fonts/`, `css/fonts.css`; import map, modulepreload and font link repointed in six shells; `THREE_CDN` to `THREE_BASE` in `js/boot.js` |
| `be4e11b` | revert of the above plus the reel work — undone by reapplying `173723d` alone |
| `59522bf` | `js/reel.js` — the loop starts and cancels instead of idling |
| `791fba7` | `js/reel.js` — snap suspended while drifting |
| `29dec04` | README and NOTES say both are fixed |

**Do not hand-edit** `vendor/`, `assets/fonts/` or `css/fonts.css` —
`node tools/vendor.mjs` and `node tools/fonts.mjs` overwrite them, and
both refuse to differ silently under `--check`.

All on `gbmworks/portfolio`. `gbmPrimetrace/portfolio` has none of it and
still cannot be pushed from this machine — `push: false`, checked again
on 2026-09-14. Built and verified live the same day.

---

## 28. A third thing that runs

2026-09-22. `content/eyewear-builder` arrived as a finished app — a frame
configurator with a webcam try-on — and the job was to make it an entry
on Technical Art: a row, a page, a cover, and a way back out of it. Most
of it was decisions rather than code.

### Where it goes, and what it costs

`studio/eyewear/`, beside `studio/fitmint/`, because the pattern was
already set twice: heavy source in `content/`, a `deploy.mjs` that copies
the shipped subset into the repo, and the repo root *is* the site.

**It needed one line to relocate.** This was the pleasant surprise. Every
runtime asset the app loads already went through
`import.meta.env.BASE_URL` — models, the HDRI, `materials.csv`, the
MediaPipe wasm — so `base: './'` in `vite.config.ts` was the entire
change. Nothing was pinned to a host root, and the deployed folder can
now be moved without a rebuild. The studio needed no path fixes either;
the game did. Two out of three, and the reason both times was that the
app had been written to ask for its own base rather than assume one.

Because that one line is the whole of the relocation, it is also the
whole of the risk — so `deploy.mjs` reads the built `index.html` and
**refuses to write** if a `src` or `href` in it comes back
root-absolute. One grep standing in for the one mistake that would 404
the entire app under `/studio/eyewear/`.

### 12 MB dropped on evidence, not on feel

The app is 41 MB built, of which **33.8 MB is the MediaPipe runtime** —
six files that `scripts/sync-wasm.mjs` copies out of the installed
package. Committing 34 MB to serve a face tracker deserved a look before
it deserved a shrug.

`FilesetResolver.forVisionTasks(path)` builds its own filename, and the
line that does it is in the minified bundle: the name is assembled as
`vision_` + `wasm` + `_module` if a flag is set + `_nosimd` if SIMD is
unsupported + `_internal`. The `_module` half is only reached when the
function's **second argument** is true. `src/face/landmarker.ts` calls it
with one argument.

So the `vision_wasm_module_internal` pair — **12.1 MB** — can never be
requested, and the deploy drops it: 29.1 MB shipped instead of 41.
`nosimd` stays, because it is the real fallback for a browser without
WebAssembly SIMD and dropping it would trade 11 MB for older Safari.

The part worth keeping is not the saving, it is the guard. A trim
justified by a function's arguments is only true while those arguments
hold, so **the deploy re-reads that call on every run** and fails if it
ever gains a second one. The day somebody passes `true` for the
ES-module runtime, this turns into a 404 halfway through a face scan —
the worst possible place for it, because the scan is the half of the app
that needs a camera to test.

### The cover could not be screenshotted

The brief asked for the thumbnail to be a still of the builder's own 3D
view. That ran straight into the trap section 26 had already paid for:
**a hidden tab never runs `requestAnimationFrame`**, and the browser this
session drives reports `visibilityState: hidden` permanently. For the
reel that meant frame counts coming back zero. For a WebGL canvas it is
worse — three.js renders inside a rAF loop, so the canvas is never
painted at all and the screenshot is an empty grey rectangle with the UI
sitting on top of it.

`tools/reel-test.mjs` was kept in `239d07e` for exactly this, and it paid
for itself here: the same CDP shape — launch a real Chrome, attach over
the DevTools protocol, drive the page — with three differences.

- `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
  The reel harness passes `--disable-gpu`, which is fine for a CSS
  animation and useless here: this page *is* WebGL, and with no GPU and
  no SwiftShader there is no context to render into.
- The editor was entered by **clicking the Design tab** rather than by
  poking the store, so whatever the tab does on the way in happened too.
- The three-quarter was reached by a **synthetic drag** — 24 mouse-move
  events between a press and a release — rather than by setting the
  camera. The scene's own controls then did the framing, and the idle
  turntable stood down the way it does for a real hand instead of
  swinging through the shot.

`document.visibilityState` came back `visible` and `webgl2` came back
`true` on the first run, which is the pair worth printing: both are
cheap, and either one being wrong explains an empty canvas immediately.

Three orbit angles and three zoom levels were shot and compared. The
zoomed ones ran the temple into the right-hand panel; the un-orbited one
read as a flat front elevation with no depth. The keeper is a 16:9 frame
of the whole editor at a 3/4 that shows the frame is a solid — UI
included, deliberately, because a row about a configurator should show
the configurator and not a product render.

### The back button, and the one place it differs

The game's `#exit` pill and the studio's wordmark arrow both land on
**their own record**, and section 24 wrote down why the site root was the
wrong destination. The builder's arrow lands on
**`../../technical-art.html`** instead — the sector index.

That was asked for, and it also happens to be right for this one: it is a
tool with no reels and no posts, so the page it would otherwise land on
is thinner than the index, and the index is where the rest of the work of
its kind is. Its own record is one row up from there. The divergence is
written down in three places rather than left to be discovered, and
`BackToPortfolio` in `src/App.tsx` is the one line to change if it ever
grows a reason to land on its own page.

It renders **only when the path is two or more segments deep**. A
standalone dev server at `/` has no `technical-art.html` to reach, and an
arrow that 404s is worse than no arrow at all.

### The arrow cost 34px, and the bar did not have them

This is the one real defect the pass introduced, and it was found by
measuring rather than by looking at it.

At 390px the top bar — back arrow, wordmark, *Design*, *3D try-on*, a
sound toggle — has about **2px** of slack. Adding a 28px arrow and its
6px gap did not overflow the row; it did something quieter. `.tab` had no
`white-space`, so the row never gave way: **the label wrapped inside its
own pill.** *3D try-on* became two lines, the pills grew from 34px to
55px, and they overlapped the wordmark inside a bar still 56px tall.

Measured with and without the arrow in the same session, which is what
made it attributable rather than a guess:

| | tabs | *3D try-on* |
|---|---|---|
| arrow present, no fix | 55px tall | 71px wide, 2 lines |
| arrow removed | 34px tall | 85px wide, 1 line |
| arrow present, fixed | 34px tall | 85px wide, 1 line |

Two changes. `white-space: nowrap` on `.tab`, because a pill is one line
by definition and the failure mode of a full bar should be the row giving
way rather than the type folding. And the first width media query this
stylesheet has ever had, tightening the bar's own padding from 24px to
12px and its gap from 24px to 12px — 36px reclaimed, which is the
arrow's bill paid by the arrow. Verified at 375, 390 and 430.

**That rule is not a phone tier, and the comment on it says so.** Below
about 700px the editor's two floating panels still overlap each other and
cover the frame completely. That is the app's own known gap, listed in
its README before any of this, and it is now the top item in NOTES'
"Next" — to be shipped on its own, because it is a visible change to
something that currently works on a desktop.

### What went where

| file | why |
|---|---|
| `js/projects.js` | the `eyewear-builder` record — `live`, `liveLabel`, cover, summary, body |
| `content/allocation_new.csv` | third cell in the TD column; `js/pages.js` and `sitemap.xml` are generated from it |
| `assets/covers/eyewear-builder.jpg` | the CDP still, 1400x800, 66 KB |
| `content/eyewear-builder/vite.config.ts` | `base: './'` |
| `content/eyewear-builder/src/App.tsx` | `BackToPortfolio`, and the depth test |
| `content/eyewear-builder/src/styles.css` | `.topbar__id`, `.topbar__back`, `nowrap`, the 560px rule |
| `content/eyewear-builder/deploy.mjs` | new — the two guards and the wasm trim |
| `studio/eyewear/` | 29.1 MB of build output, which is what Pages serves |
| `.gitignore`, `README.md`, `content/NOTES.md` | the split, the reference, the traps |

The sitemap picked up `studio/eyewear/` on its own — `tools/sitemap.mjs`
already reads `live` off every record, so the third runnable needed no
change there. Worth noting as the thing that *didn't* cost anything:
three entries in, the mechanism is doing its job.

---

## 8. Open items

1. **Five records still have no artwork** — Primetrace, Metabrix,
   Freelance 2024, Hecoll and Diaz Goa. All are unlisted, so nothing
   renders as a bare plate. Drop a file into `assets/web/<slug>/`, set
   `cover:`, add a line to the sheet, and it returns everywhere at once.
   (This list said "Lenskart AR" and not "Diaz Goa" until 2026-09-13;
   the game has had artwork for a while. Re-derive it rather than
   trusting it — one line:
   `node --input-type=module -e "import('./js/projects.js').then(m=>console.log(m.PROJECTS.filter(p=>!p.cover&&!p.preview).map(p=>p.slug)))"`)
2. **Technical Art has 3 project pages of 14 entries** — the rest link
   out or are posts, and two of the three run rather than read. It was
   10 entries and 0 pages when this item was written.
3. **`SITE.links` vs `SITE.beacons`** — pick one.
4. ~~**HTTPS is not enforced.**~~ **Done, 2026-09-09** —
   `https_enforced: true` on the Pages site, verified: `http://`, the
   bare apex and deep paths all `301` to `https://www.govindbmohan.com/…`.
   The flag needs `gh api -F` (a typed boolean); `-f` sends the string
   `"true"` and returns 422.
5. **`PORTFOLIO.glb` is still 2.0 MB.** Draco would take it to ~400 KB
   but costs a loader plus a wasm decoder on every page to save weight on
   one. It is already lazy — the other two sectors never fetch it.
6. **Video playback was never verified end to end.** The automated
   browser could not decode VP9 in a backgrounded tab, and the old Python
   server did not answer Range requests. Worth hovering a Fitmint row and
   confirming the clip plays.
