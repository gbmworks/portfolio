# Govind — portfolio

Intro (3s) → a radial "pizza wheel" selector that swaps the entire 3D
environment as you hover each slice → a real page per sector.

Vanilla HTML/CSS + three.js (module build via CDN import map). No build step,
no bundler, no assets required.

**Live:** [govindbmohan.com](http://govindbmohan.com) — GitHub Pages, built from
`main` in [gbmworks/portfolio](https://github.com/gbmworks/portfolio).

## Deployment

Pages serves the repo root; `CNAME` holds the domain and `.nojekyll` stops
Jekyll swallowing paths. GoDaddy DNS points the apex at GitHub's four
addresses (185.199.108–111.153) and `www` at `gbmworks.github.io`.

What ships and what does not:

| | in the repo | why |
|---|---|---|
| `assets/web/` | yes, 52 MB | the re-encoded clips the site loads |
| `assets/covers/` | yes, 2.9 MB | Instagram thumbnails, saved locally |
| `assets/3d/` | glb + 4 maps only | the character and its textures |
| `assets/media/` | no, 328 MB | the original footage, local only |
| `assets/3d/*.blend` | no, 257 MB each | over GitHub's 100 MB file limit |
| `assets/1x/` | no | unused working files |

To re-encode after adding footage:

```bash
ffmpeg -i in.webm -c:v libvpx-vp9 -crf 34 -b:v 0 -an   -vf "scale=w='min(1080,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease"   assets/web/out.webm
```

## Run it

ES modules need a real server — opening `index.html` from disk will fail.

```bash
cd D:/Resources/Portfolio
python -m http.server 8123        # or: npx serve .
```

Then open http://127.0.0.1:8123

## Files

```
index.html                 the wheel
industrial-design.html     ┐
technical-art.html         ├ section pages — thin shells, content from projects.js
visualization.html         ┘
project.html               one shell for every project — project.html?p=<slug>
css/style.css              all styling
js/
  projects.js              >>> ALL THE WORK LIVES HERE <<<
  data.js                  sectors and identity — the shape of the site
  cv.js                    the person: work history, education, awards, skills
  head.js                  the invariant half of every <head>, in one place
  nav.js                   leaving a page: the shared veil transition
  stage.js                 renderer, camera, lights, post chain, frame loop
  wheel.js                 slice geometry, projected labels, hover animation
  main.js                  landing page logic
  page.js                  section page logic (sheet index / mosaic)
  project.js               project page logic
  tiles.js                 every tile wall + the lazy playback engine
  preview.js               the hover preview stage on a section index
  overlays.js              the About window, built from cv.js
  env/
    themes.js              per-sector lighting mood (sky brightness, IBL, fog, light tints)
    procedural.js          the GLSL skies + PMREM + cross-fading sky dome
    props.js               themed backdrop geometry per sector
    hdri.js                optional real-.hdr override
tools/sitemap.mjs          regenerates sitemap.xml from the content
assets/
  hdri/manifest.json       empty by default — see "Real HDRIs" below
```

## Art direction

The system is **monochrome** — every surface is glass, chrome or smoke, and the
only colour in it is one fluorescent orange (`#ff5a12`) that appears on hover,
on the live slice, in the page wipe and as a faint uplight under all three
worlds. Sectors are told apart by the *shape* of their light and their
contents, not by hue.

`js/env/materials.js` is the material library: `clearGlass`, `translucentGlass`,
`frostedGlass`, `chrome`, `brushedChrome`, `graphite`, `iridescent` (thin-film
metal) and `dichroic` (refraction + thin film). The wheel is smoked frosted
glass with chrome furniture; the backdrops mix all of them.

Refraction is real (`transmission`), which costs one extra scene render per
frame shared by every transmissive surface, so it is spent on a handful of
hero surfaces — the slices, a few assembly parts, one gear, the dichroic
solids — while everything else uses chrome and iridescence, which are free.
`tuneTransmission()` drops the refraction buffer to half resolution on HiDPI
screens. If it ever feels heavy, lower `transmission` towards 0 on the wheel
slices in `wheel.js` first.

Each theme's `sat` in `js/env/themes.js` desaturates its baked sky. They sit
at 0.06–0.10 (near-grey); push one back towards 1 to bring that world's
original colour back.

Backdrop props are positioned by **where they land on screen**, not in raw
world units — `place(sx, sy, z)` in `props.js` takes screen fractions at a
given depth, and `KEEP_OUT` (0.60) is the radius around the centre that stays
clear of the wheel and the page copy.

## The About window

One floating panel, on every page, built entirely from `js/cv.js` — which is
transcribed from *Govind B Mohan - CV 2026-new.pdf*:

- the summary line and contact
- **8 roles**, Primetrace Labs back to DesignFlyOver, with the 2024 freelance
  clients broken out
- education, awards
- skills in four groups, languages, interests

`js/overlays.js` renders it; the top bar carries a single **About** link. The
separate About panel that used to hold hand-written copy is gone — everything
here is from the CV, so there is one place to edit and nothing invented.

The phone number was deliberately left off a public page; it is one line in
`cv.js` if you want it.

## Projects, and where they live

A **project** is a thing you made. It has a slug, one or more sectors, a
client, a role, a year, a summary, its own media, and links out to wherever it
is published. It lives in `js/projects.js` and it owns a page:
`project.html?p=<slug>`.

That file is the single source for the work. `js/data.js` holds only the
*shape* of the site — the three sectors that drive the wheel, the labels and
the navigation — because a project can belong to more than one sector and a
sector should not own it. Fitmint is technical art **and** visualization; the
John Jacobs line is industrial design **and** visualization. Each is written
once and appears in both.

Anything with no page worth building stays a **post**: a one-off on Instagram,
listed under `POSTS` per sector, linked straight out, never pretending to be a
case study.

```js
// js/projects.js
{
  slug: 'fitmint-avatars',
  sectors: ['technical-art', 'visualization'],   // first is where it lives
  title: 'Fitmint',
  client: 'Fitmint',
  role: 'Character Technical Artist & 3D Generalist',
  year: '2023 — 24',
  tools: ['Blender', 'three.js'],
  summary: 'The 3D avatar system for a crypto-based fitness app…',
  body: ['…', '…'],                              // extra paragraphs
  cover: 'assets/web/fitmint/coverf.jpg',        // or a Behance CDN path
  preview: 'assets/web/fitmint/AvatarF.webm',
  media: [{ src: '…', title: '…' }],
  behance: { id: '199186729', slug: 'JohnJacobs-X-MasabaGupta' },
  posts: [{ code: 'C3xN8HcSitr', kind: 'reel', title: '…', cover: '…' }],
  feature: true                                  // top of its sector's index
}
```

Every field except `slug`, `sectors` and `title` is optional, and the page
degrades honestly. The still that represents a project is picked by
`projectStill()`: its own `cover`, or failing that the thumbnail of the first
post attached to it. With none of those it falls back to `preview`, and with
nothing at all the tile becomes a **typographic plate** — the project's name
set large on a dark card — rather than a broken frame. Same for the copy: no
summary and no body prints a line saying the work lives as a published gallery
instead.

Eight projects currently have no artwork in the repo at all — the three
Technical Art client systems (`primetrace-companion`, `metabrix-avatar-bodies`,
`lenskart-ar-game`), the four 2024 freelance jobs (`suta-bombay`,
`the-eyewear-project`, `soul-jams`, `besodetres`) and
`hecoll-protective-range`. Drop a file into `assets/web/<slug>/` and set
`cover:` on the record and it appears everywhere at once: the sector index, its
row's preview stage, the mosaic tile, the project hero and the social card.

### Adding a project

1. Add the record to `PROJECTS` in `js/projects.js`.
2. Drop any local media into `assets/web/…` and reference it in `media`.
3. Run `node tools/sitemap.mjs`.

No new HTML file, ever — `project.html` renders all of them.

## Three layouts, one system

`layout` in `data.js` picks the arrangement, and `page.js` sets
`body[data-layout]` so the CSS follows:

| sector | `layout` | arrangement |
|---|---|---|
| Industrial Design | `sheet` | a drawing sheet down the **left** — drafting grid, an orange rule under the title, and the project index as a two-column register with corner ticks. The framed preview stage fills the space to its right. |
| Technical Art | `sheet` | the same. A full-bleed stage was tried here and dropped: stretching a portrait clip across the whole viewport read as a distorted background rather than a preview. |
| Visualization | `gallery` | a **mosaic** of project covers under a slim title bar; no hero. |
| a project | `project` | a reading column over the sector's own world — hero, facts rail, copy, then its media in the same tile grid used everywhere else. |

`body[data-layout]` and the page shell have to agree: a `sheet` page needs
`#panel` and `#stagePreview` in its HTML, a `gallery` page needs `#page`, and
`project.html` needs `#work`. Change one without the other and the page has
nothing to render into.

One tile engine (`js/tiles.js`) draws every wall on the site — the mosaic, a
project's own media, and the Instagram strips. Grey at rest, colour and play
on hover, lazy everywhere: nothing decodes until it is near the viewport, and
video is released again five seconds after it leaves.

## Duplicates

They are gone structurally rather than by a guard. A piece of work is one
record in `PROJECTS`, tagged with every sector it belongs to, so there is
nothing to de-duplicate:

- **Same work, several sectors.** The John Jacobs × Masaba line used to be a
  Behance row under Industrial Design, a gallery group under Visualization and
  a loose Instagram post. It is now one record with
  `sectors: ['industrial-design', 'visualization']` and its posts attached.
- **Same piece, several posts.** Instagram entries hang off the project they
  belong to (`posts:`), so a campaign's four posts sit on its page instead of
  competing with it in an index.
- **Same footage, two files.** `Lenskart/reel.webm` (35 MB) is the long cut of
  `ReelFinal.webm`, so it is not referenced. The file is still on disk.

The old `linkTiles()` de-duplication pass — which compared clip paths and
destination URLs to hide copies — was deleted along with the copies.

## The preview stage

There is **no wheel on a section page** — that space is the stage. Hovering a
project row plays that project there, large, framed to the right of the sheet.
`js/preview.js`, mounted on `#stagePreview`, reusing one `<video>` for the
whole page so running down a long index never spawns more than one decoder.

A row shows its `preview:` clip if it has one, otherwise its `cover:` — the
Behance project cover or a saved Instagram thumbnail — so **most rows show
real artwork on hover**, and never a piece from a different project. A row
with neither says "Open the project" instead of guessing.

Since the wheel no longer navigates, each section page carries a **sector
switcher** (01 / 02 / 03) under its header, and the prev/next pair still sits
at the foot. A project page has its own prev/next, which walks that sector's
list rather than the sectors.

On the mosaic and on a project's media grid the tiles preview themselves —
grey and still at rest, colour and playing on hover — so the stage is only
needed where the work is a list.

## Resilience and reach

- **Boot guard.** If the app has not signalled `data-ready` within seven
  seconds — blocked CDN, no WebGL, a very slow first load — `#boot` reveals a
  plain linked page instead of a black screen.
- **Metadata.** Canonical URLs, Open Graph and Twitter cards on every page,
  an SVG favicon drawn from the wheel, `robots.txt`, `sitemap.xml` and a
  styled `404.html`. The social card at `assets/og.jpg` is a 1200×630 frame
  of the landing page itself — re-shoot it if the art direction changes.
- **One caveat on project pages.** `project.html` is a single shell shared by
  every project, so its static `<head>` is generic and `js/project.js` corrects
  the title, description, canonical link and OG image once it knows the slug.
  Google runs scripts and will see the corrected tags; the social scrapers do
  not, so a link to a specific project pasted into Slack or X shows the generic
  card. The alternative is a real HTML file per project, which means a build
  step and 40 more copies of the boilerplate — the trade was made deliberately.
- **An unknown slug** renders a real page listing every sector and its project
  count, rather than an empty shell.
- **Keyboard.** Gallery tiles are focusable, carry `role` and `aria-label`,
  activate on Enter or Space, and light up on focus exactly as on hover.
  Focus rings are visible throughout.

## Performance

The page weight was never the problem — the landing page is 325 KB over 27
requests and loads in well under a second on localhost. The cost was all in
the 3D boot and per-frame fill rate, so that is what got cut.

**Deferred until actually needed**

- **Skies**: only the neutral sky is baked at startup. Each sector's sky and
  its PMREM are baked the first time that world is asked for — one render at
  boot instead of four (`EnvManager._ensure`).
- **Backdrop worlds**: the gear extrusions, exploded assemblies and terrain
  are built on first show, not up front. Two of the three are never looked at
  on a given visit (`createProps.ensure`).
- **Gallery clips**: a poster frame is fetched within 400 px of the viewport
  (was 1200 px) and released a few seconds after leaving.

**Cheaper per frame**

- Device pixel ratio capped at 1.5 (was 2) — about 44% fewer pixels shaded.
- Bloom runs at half resolution; it is a blur, so nothing is lost.
- Refraction (`transmission`) now exists only on the three wheel slices.
  Every backdrop material uses iridescence, chrome or plain opacity instead,
  which cost nothing — the film carries the look.
- Terrain 84×84 → 56×56 segments; dust 700 → 420 points; sky bakes
  1024×512 → 512×256 (PMREM downsamples them anyway).

**Smaller over the wire**

- three.js loads the minified build; font weights trimmed from six to four;
  `preconnect` to the CDN.

`window.__stage.bootMs` reports how long the stage took to come up — 29 ms
warm, 92 ms cold on this machine.

Nothing that was asked for was removed. If it still feels heavy on a weaker
GPU, the next thing to drop is `transmission` on the wheel slices in
`wheel.js` (set it to 0) — that removes the refraction pass entirely.

## Composition

Nothing is centred by accident.

- The wheel's on-screen size is set by `CFG.screenFrac` (0.578) in
  `wheel.js` — the fraction of the viewport half-height its radius takes up.
  `fitCamera()` derives the camera distance from it, so changing that one
  number resizes the wheel everywhere it appears.
- The donut is golden: `innerR = outerR / φ²`, which makes
  outer : band = φ.
- **Landing page** — the wheel's centre is on the vertical golden section
  (61.8% across), the type column runs down the first third, and the lede
  block hangs off the upper-third line. The hub label is projected onto the
  wheel's centre each frame rather than pinned to the middle of the screen.
- **Section pages** — the reading panel is the golden minor (`38.2vw`), the
  wheel is centred in the major.
- **Gallery hero** — copy on the first third, wheel at 65.5%, title mass on
  the upper third.
- The accent uplight follows the wheel, so the glass is never lit from
  somewhere the composition does not justify.

Backdrop props are placed by screen fraction (`place(sx, sy, z)`), with
`KEEP_OUT = 0.60` holding the middle clear.

## The environment system

Each sector owns a world. Hovering its slice cross-fades **all** of it over
0.85s — sky, image-based lighting, light colours, fog tint and the backdrop
geometry:

| sector | sky | backdrop |
|---|---|---|
| Industrial Design | dark hall, overhead skylight strips, a furnace burning off to one side, faint blueprint gridding | exploded assemblies breathing apart over a blueprint floor, floating dimension frames |
| Technical Art | brass workshop — tungsten bulbs, steam drifting through the light, oily floor with embers | a meshed gear train (radius ∝ tooth count, so the pitch lines actually touch), piping, a driven piston |
| Visualization | neon game world — magenta horizon, cyan sun on the deck, star field, glowing ground | scrolling wireframe terrain, drifting metal solids, and `assets/3d/PORTFOLIO.glb` — your rigged character, running |
| *(nothing hovered)* | neutral studio | — |

How it works, in `js/env/procedural.js`:

1. Each theme is a branch of one fragment shader that paints a full 360°
   equirectangular sky into a half-float render target (1024×512).
2. That target goes through `PMREMGenerator` → `scene.environment`. This is
   the lighting that reflects in the slices — it keeps the full HDR range, so
   skylights and bulbs read as real light sources.
3. A big inside-out sphere samples **two** skies at once and mixes between
   them, which is what you actually see. Its highlights are rolled off
   (`c / (1 + c*0.85)`) so a blazing skylight becomes a glow instead of a
   white wall, and the bottom is darkened so UI text stays readable.
4. The PMREM swaps at the half-way point of the fade, hidden under a dip in
   `scene.environmentIntensity`.

### The character

`assets/3d/PORTFOLIO.glb` carries the rig and two baked clips (`Running_M`
and `Action`) but no materials, so `js/env/props.js` builds the PBR material
by hand from the loose maps beside it — `diffuse_new.jpg`, `normal_new.jpg`,
`rough_new.png`, `metal_new.png`. glTF UVs need `flipY = false`, which is why
the textures are loaded there rather than dropped straight in.

It plays whichever clip matches `/run/i`, falling back to the first. To use
`Action` instead, change that test in `loadCharacter()`. Position, scale and
facing are the `hero` group in `buildVisualization()`.

The model and its maps (~3 MB) are only fetched the first time the
visualization world is actually shown — the other two sectors never pay for it.

### Real HDRIs

The procedural skies are the default and need no files. To use a real
equirectangular `.hdr` — your own Blender render, or a CC0 capture — drop it
in `assets/hdri/` named after the theme key and list that key in
`assets/hdri/manifest.json`:

```json
["technical-art", "visualization"]
```

That loads `assets/hdri/technical-art.hdr` and `visualization.hdr` and uses
them for both the sky and the lighting. Anything unlisted stays procedural,
and nothing is requested at all while the manifest is empty.

## The tile wall

`js/tiles.js` draws every grid on the site and runs one playback engine for
all of them — the Visualization mosaic, a project page's media, and the
Instagram strips.

- **Masonry**, five CSS columns down to one, so a portrait clip and a
  landscape still can sit side by side without letterboxing.
- **Grey at rest.** `filter: saturate(.14)` on every tile; hover restores
  colour and plays the clip. The wall reads as one surface until you look at
  something.
- **Lazy both ways.** An IntersectionObserver attaches a poster frame 400px
  before a tile enters the viewport (`preload=metadata` plus a `#t=0.1` media
  fragment paints a still without playing) and releases the video five seconds
  after it leaves. A long wall never holds more than what you have looked at.
- **Aspect from the file.** Once metadata lands, the tile takes `3/4` or `4/3`
  from the real dimensions — the wall stays even instead of following a 9:16
  clip all the way down the page.
- **No hover on touch.** Whatever is more than 60% on screen plays, two at a
  time.
- **Where a tile goes.** A project tile navigates here, an Instagram tile
  opens the post, and a tile with nowhere to go opens in the lightbox.

### A note on file sizes

`assets/media` is ~328 MB as it stands — `2hrutul.webm` alone is 58 MB and
`Lenskart/reel.webm` is 35 MB (and looks like a longer cut of `ReelFinal`).
Lazy loading means a visitor only pays for what they scroll past, but it is
still worth re-encoding the wall down to roughly 2–5 MB a clip, e.g.

```bash
ffmpeg -i in.webm -c:v libvpx-vp9 -crf 34 -b:v 0 -vf "scale=-2:1080" -an out.webm
```

`-an` drops audio, which the tiles never play anyway.

## Editing content

Two files, split by what they describe:

- **`js/projects.js`** — the work. See "Projects, and where they live" above.
- **`js/data.js`** — the sectors and the identity. Each entry in `SECTIONS`
  generates a slice, its label, its page and its navigation:

```js
{
  id,           // must match the .html filename AND the theme key in env/themes.js
  layout,       // 'sheet' or 'gallery'
  index, title, subtitle,
  color, glow,  // slice colour + lighter tint for outline/icon
  blurb,        // paragraph at the top of the section page
  note,         // optional line above the index
  icon          // inline stroke SVG — it draws itself on hover
}
```

- **Adding a 4th sector**: add the entry to `SECTIONS`, add a matching theme to
  `js/env/themes.js` (and a shader branch + backdrop builder if you want it to
  have its own world), copy one of the section `.html` files, and tag projects
  with the new `id`. Wheel angles, gaps, raycasting and labels all derive from
  `SECTIONS.length`.
- **`js/cv.js`** is the person — work history, education, awards, skills. The
  About window is built entirely from it, and several project summaries were
  written from it.

## Published work

Nothing published is re-hosted. A project carries a reference and the URL is
built from it:

- **Behance** — `behance: { id, slug }` becomes
  `behance.net/gallery/<id>/<slug>`. Covers come straight from Behance's
  unsigned, stable CDN path (`mir-s3-cdn-cf.behance.net/...`), so a project
  tile shows the real cover without a copy living in this repo.
- **Instagram** — `{ code, kind }` becomes `instagram.com/<kind>/<code>/`,
  where `kind` is `p` for a post or `reel` for a Reel. Thumbnails *are* saved
  locally, in `assets/covers/instagram/<code>.jpg`, because Instagram's CDN
  URLs are signed and expire.

Posts attached to a project (`posts:`) appear on that project's page. Posts
that belong to no project sit in `POSTS[sectorId]` and appear as the "Also on
Instagram" strip under a sector index.

`IG_HIGHLIGHTS` in `data.js` names the story highlights he curates himself;
they show as tags above a sector's project list.

### Classification

The sector a project sits in is a judgement call, and a few are deliberate:

- The John Jacobs × Masaba line is **industrial design** first — it is eyewear
  design — and visualization second, because the launch reels are his too.
- Fitmint is **technical art** first: the avatar system is the work, the hype
  reels are its output.
- The Titan watch is industrial design, not visualization, even though the
  Behance gallery is mostly renders — the project is the parametric system.

## Interaction

| input | result |
|---|---|
| hover a slice | slice pulls out along its bisector and tilts, icon lights and redraws, title pops in, **the world changes** |
| click a slice | colour wipe + camera dive, then the section page |
| `1` `2` `3` | enter that section directly, from anywhere |
| on a section page | the sector switcher under the header moves between sectors; the wheel is gone — that space is the preview stage |
| hover a project row | it plays in the stage beside the sheet |
| click a project row | its project page |
| `Esc` | close the About window or the lightbox |
| returning to the wheel | the 3s intro runs **once a visit** — `sessionStorage.introSeen`. A new tab or a fresh visit plays it again; walking back from a section page does not |
| touch | first tap previews, second tap enters |
| hover a tile | it comes to colour and plays at normal speed |
| click a tile | a project page, the published post, or the lightbox — in that order of preference |

The wheel idles with a slow spin that stops the moment a slice is engaged.

## Tuning

- **Wheel geometry / pull-out**: `CFG` at the top of `js/wheel.js`.
- **Lighting mood per sector**: `js/env/themes.js` — `bgI` is how bright the
  visible sky is, `envI` how hard it lights the slices. These are independent
  on purpose: a dark backdrop can still throw strong reflections.
- **The skies themselves**: the `foundry()`, `workshop()`, `neon()` and
  `studio()` functions in `js/env/procedural.js`.
- **Bloom**: the `UnrealBloomPass` line in `js/stage.js`.
- `window.__stage` is exposed in the console for live tweaking, e.g.
  `__stage.scene.environmentIntensity = 2` or `__stage.env.set('visualization')`.

## Notes

- three.js `0.169.0` from jsDelivr via the import map in each HTML file — needs
  a network connection. To go offline, `npm i three` and repoint the import map
  at `node_modules/three/…`.
- Fonts come from Google Fonts; the CSS falls back to system faces.
- Section pages are real URLs and degrade to a `<noscript>` title + link.
- `prefers-reduced-motion` shortens the intro and flattens transitions.
- Instagram bio says Bangalore; the Behance profile says Thiruvananthapuram.
  The About panel currently uses the Behance one — change it in `index.html`.
- While editing, browsers cache ES modules hard. If a change doesn't show up
  — or you get "does not provide an export named …" — hard reload
  (Ctrl+Shift+R) rather than hunting for a bug.
- Backgrounded tabs throttle `requestAnimationFrame`, so animations pause and
  resume rather than jumping — deltas are clamped to 50ms.
