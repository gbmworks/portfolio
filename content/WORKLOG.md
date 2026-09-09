# Work log

A record of the restructuring, in the order it happened. Sections 1-8
are the first session; section 9 is the second, which deployed the game. Kept beside `allocation_new.csv` because that spreadsheet is
the thing most of it now hangs off.

The README is the reference for *how the site works today*. This file is
the reference for *why it is like that*, and for the four things that
were tried and did not work — so nobody spends an afternoon rediscovering
them.

**Shipped as** `9839bbb` and `555763e` on `gbmworks/portfolio`, live at
www.govindbmohan.com.

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
thumbnail and a destination. (TD is 10 now — see section 9.)

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

## 8. Open items

1. **Five projects still have no artwork** — Primetrace, Metabrix,
   Lenskart AR, Hecoll, Freelance 2024. All are unlisted, so nothing
   renders as a bare plate. Drop a file into `assets/web/<slug>/`, set
   `cover:`, add a line to the sheet, and it returns everywhere at once.
2. **Technical Art has 0 project pages** — 10 entries now: nine link out
   and one, the game, plays. Adding Fitmint back is one line in the
   sheet.
3. **`SITE.links` vs `SITE.beacons`** — pick one.
4. **HTTPS is not enforced.** `http://` returns 200 rather than
   redirecting. One command:
   `gh api -X PUT repos/gbmworks/portfolio/pages -f https_enforced=true`
5. **`PORTFOLIO.glb` is still 2.0 MB.** Draco would take it to ~400 KB
   but costs a loader plus a wasm decoder on every page to save weight on
   one. It is already lazy — the other two sectors never fetch it.
6. **Video playback was never verified end to end.** The automated
   browser could not decode VP9 in a backgrounded tab, and the old Python
   server did not answer Range requests. Worth hovering a Fitmint row and
   confirming the clip plays.
