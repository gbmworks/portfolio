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
technical-art.html         ├ section pages — thin shells, content from data.js
visualization.html         ┘
css/style.css              all styling
js/
  data.js                  >>> ALL CONTENT LIVES HERE <<<
  stage.js                 renderer, camera, lights, post chain, frame loop
  wheel.js                 slice geometry, projected labels, hover animation
  main.js                  landing page logic
  page.js                  section page logic (panel layout / gallery layout)
  gallery.js               the media wall + scroll-speed playback engine
  env/
    themes.js              per-sector lighting mood (sky brightness, IBL, fog, light tints)
    procedural.js          the GLSL skies + PMREM + cross-fading sky dome
    props.js               themed backdrop geometry per sector
    hdri.js                optional real-.hdr override
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

## Three layouts, one system

`layout` in `data.js` picks the arrangement, and `page.js` sets
`body[data-layout]` so the CSS and the wheel placement follow. Each class
gets its own shape rather than the same panel three times:

| sector | `layout` | arrangement |
|---|---|---|
| Industrial Design | `sheet` | a drawing sheet down the **left** — drafting grid, an orange rule under the title, and the index as a two-column register with corner ticks. The stage fills the space to its right. |
| Technical Art | `stack` | one **centred column** floating over the world, everything centre-aligned, and the index chained to a spine with node dots and connectors. The stage plays **full-bleed behind the column**. |
| Visualization | `gallery` | a **mosaic** — the page opens straight onto the wall under a slim title bar; no hero. |

The Visualization page keeps nothing as a list: the media wall, and the
Behance/Instagram index below it, are all tiles in the same mosaic
(`linkTiles()`), so the whole page scrolls as one wall. Published entries
with a matching local clip get a real moving tile; the rest render as flat
marked tiles. Hover behaviour is identical everywhere — grey at rest, colour
and play on hover.

## Duplicates

Three kinds were removed, and one guard keeps them from coming back:

- **Same piece, several posts.** The John Jacobs × Masaba campaign had four
  Instagram entries and the Mushroom Fiend two; the debut-gig announcement and
  the set from the same night were both listed. One row each now.
- **Same footage, two files.** `Lenskart/reel.webm` (35 MB) is the long cut of
  `ReelFinal.webm`, so it is out of the gallery. The file is still on disk.
- **Same work, twice on one page.** `linkTiles()` now skips any published row
  whose clip already stands in the mosaic above, or whose destination a media
  tile already links to — on Visualization that collapses 26 index rows into
  19 tiles, with no link lost, because the media tile carries it.

## The preview stage

There is **no wheel on a section page** — that space is the stage. Hovering a
row plays that piece of work there, large: framed to the right of the sheet on
Industrial Design, full-bleed behind the column on Technical Art.
`js/preview.js`, mounted on `#stagePreview`.

Rows carry `preview:` for a clip or `still:` for an image, and any row falls
back to its own cover — the saved Instagram thumbnail or the Behance project
cover — so **every row on Industrial Design and Technical Art shows real
artwork on hover**. Nothing is ever illustrated with a piece from a different
project.

Since the wheel no longer navigates, each section page carries a **sector
switcher** (01 / 02 / 03) under its header, and the prev/next pair still sits
at the foot.

Most Industrial Design and Technical Art rows have no local file yet, so their
stage sits empty. Drop a clip or a frame into `assets/media/` and add
`preview:` / `still:` to that row and it plays immediately.

## Hover previews

Any element carrying `data-preview` pops its clip beside the cursor while
hovered — one shared `<video>` for the whole page, so running down a long
list never spawns more than a single decoder. `js/preview.js`, styled as
`.hoverprev`. Rows and headings that have one show a small `▸`.

On the mosaic, tiles preview themselves: grey and still at rest, full colour
and playing on hover. On the section pages the same job is done by the stage
above.

## Resilience and reach

- **Boot guard.** If the app has not signalled `data-ready` within seven
  seconds — blocked CDN, no WebGL, a very slow first load — `#boot` reveals a
  plain linked page instead of a black screen.
- **Metadata.** Canonical URLs, Open Graph and Twitter cards on every page,
  an SVG favicon drawn from the wheel, `robots.txt`, `sitemap.xml` and a
  styled `404.html`. The social card at `assets/og.jpg` is a 1200×630 frame
  of the landing page itself — re-shoot it if the art direction changes.
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

## The gallery

`visualization.html` uses the full-page gallery layout instead of the reading
panel, switched on by `layout: 'gallery'` in its `data.js` entry. The hero
holds the wheel and the title; scroll and the wheel fades out and hands the
screen to the media wall, with the neon world still running behind it.

**One flat wall.** No group headings: every clip, still and published entry
sits in a single masonry, with the group name (Fitmint, Lenskart, Loops &
Studies) riding on the tile caption so the context survives.

**The marks.** The wheel labels are the per-class marks, white by default and
black on the lit slice (which is fluorescent orange). Titles wrap rather than
clip: the label box is centred on its projected point with a transform instead
of fixed margins, so it can grow.

**Every tile is 3:4 or 4:3.** The ratio is chosen from the media's own
orientation once metadata loads and the image is cropped to fit, so a 9:16
clip no longer runs a third of the page tall. Five columns above 1600 px, down
to one on a phone.

**The wall rests grey and still.** Every tile sits desaturated
(`saturate(.14)`) on a paused first frame. Hover one and it comes to full
colour and plays at normal speed; move away and it settles back. Only the
tile under the cursor decodes, so a hundred clips cost about as much as one.
Touch screens have no hover, so there the two tiles squarely on screen play
by themselves.

**Tiles link to where the piece is published.** Give an item (or a whole
group) an `href` and a `source` in `data.js` and clicking the tile opens that
Behance project or Instagram post, with a small `INSTAGRAM ↗` / `BEHANCE ↗`
badge in the caption. Anything unpublished opens in the lightbox instead.

Nothing is eager: a poster frame is fetched only within 1200px of the
viewport and released a few seconds after leaving. Tile aspect ratios are
read from the media itself, so the masonry fits whatever you drop in.

Knobs at the top of `js/gallery.js`:

```js
const ATTACH_PX = 1200;   // load a poster frame this close to the viewport
const RELEASE_MS = 5000;  // ...and release it this long after leaving
const MAX_AUTO = 2;       // tiles that play unattended on touch screens
```

The resting look is one line in `style.css` — the `filter` on `.tile__el`.

Adding the gallery to another sector: add `layout: 'gallery'` and a `gallery`
array to its entry in `data.js`, then swap `<main id="panel" class="panel">`
for `<main id="page" class="page">` in that sector's HTML file.

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

Everything you'd normally change is in `js/data.js`. Each entry in `SECTIONS`
generates a slice, its label, its page and its navigation:

```js
{
  id,           // must match the .html filename AND the theme key in env/themes.js
  index, title, subtitle,
  color, glow,  // slice colour + lighter tint for outline/icon
  blurb,        // paragraph at the top of the section page
  icon,         // inline stroke SVG — it draws itself on hover
  behance: [ { title, year, id, slug } ],   // published index, links out to Behance
  behanceNote,  // optional line above the index
  layout, gallery               // only on sectors using the media wall
}
```

- **Adding a 4th sector**: add the entry to `SECTIONS`, add a matching theme to
  `js/env/themes.js` (and a shader branch + backdrop builder if you want it to
  have its own world), and copy one of the section `.html` files. Wheel
  angles, gaps, raycasting and labels all derive from `SECTIONS.length`.

## The published indexes

Two of them, both classified into the three sectors and rendered by
`linkList()` in `js/gallery.js`.

### Instagram

`PROFILE.instagram` plus a per-sector `instagram` array, walked from
[@vindgo.visual](https://www.instagram.com/vindgo.visual/) — 102 of the 103
posts were read, and the ones with usable evidence are indexed: **23**
Industrial Design / **8** Technical Art / **18** Visualization. `igUrl()`
builds the permalink from `kind` + `code`.

The older posts have no captions, but their tags carry the signal —
`@keyshot3d`, `@conceptkicks`, `@adidas`, `@sneakerfreakermag`,
`@daburvatikaofficial`, `@bikeexif`, `@titancompanyltd`, `@bbcleague.nid` are
all product and industrial work, which is where most of the new Industrial
Design rows came from. Posts with neither a caption nor a meaningful tag were
left out rather than guessed at.

`IG_HIGHLIGHTS` maps your own story highlights onto the sectors — they are the
most reliable signal, because you grouped them: *Nvisage 2020* → Industrial
Design, *Nodes* → Technical Art, *VJ · JJ | Masaba · Unicorn · Fitmint* →
Visualization. They render as chips above each list.

Several posts cross-reference the local media: *1stroke*, *Hrutul Patel*,
*Just floating around* (astronaut), *Fitmint* and the Lenskart / John Jacobs
campaign all appear in both `assets/media` and the feed.

## The Behance index

`PROFILE` and the per-sector `behance` arrays in `js/data.js` mirror
[behance.net/govindbm](https://www.behance.net/govindbm) — all 28 published
projects, sorted into the three sectors. Each row links straight out to its
project page in a new tab; `behanceUrl()` builds the URL from `id` + `slug`,
so a row is just four fields.

Current split: **19** Industrial Design, **1** Technical Art, **8**
Visualization. Reclassifying is a one-line move between arrays.

Judgment calls worth checking:

| project | filed under | why, and the alternative |
|---|---|---|
| JohnJacobs × Masaba Gupta | Visualization | read it as brand/product renders; it's an eyewear collab, so Industrial Design is just as defensible |
| Strandbeest — Theo Jansen Mechanism | Technical Art | the only published piece that's about mechanism and motion; it's also a physical NID build, i.e. Industrial Design |
| Mobius Ring — Exploration | Visualization | form/render study; could sit with the product work |
| Installation 2019 | Industrial Design | assumed a physical build rather than a visual installation |
| Photography | Visualization | not 3D, but it is image-making |

Technical Art is thin on Behance because that work isn't published there —
it lives inside the client reels on the Visualization page. `behanceNote` on
that section says so rather than padding the list.

**Covers.** The images on the profile grid are signed and expire, but every
project page exposes an unsigned, stable `og:image` on Behance's own CDN — all
28 are stored in `data.js` as `cover:` paths (switched to the `disp` size,
~600 px) and referenced through `coverUrl()`. Nothing is copied or re-hosted.
If Behance ever changes those paths, re-harvest them or save files into
`assets/covers/` instead.

**Instagram thumbnails are local.** Its CDN URLs are signed and expire, so
hotlinking would go blank in weeks. Instead each post's thumbnail was pulled
once from the public `instagram.com/p/<code>/media/?size=l` endpoint and saved
to `assets/covers/instagram/<code>.jpg` — 49 files, 2.9 MB, no signatures, no
expiry. `coverUrl()` returns a local path or a Behance CDN path depending on
which kind of row it is.

To refresh or extend them:

```bash
curl -L -o "assets/covers/instagram/<code>.jpg"   "https://www.instagram.com/p/<code>/media/?size=l"
```

Every one of the 77 indexed rows now has a thumbnail.

## Interaction

| input | result |
|---|---|
| hover a slice | slice pulls out along its bisector and tilts, icon lights and redraws, title pops in, **the world changes** |
| click a slice | colour wipe + camera dive, then the section page |
| `1` `2` `3` | enter that section directly |
| on a section page | the wheel stays as navigation — hover a neighbour to preview its world, click to go |
| `Esc` | close the About window |
| touch | first tap previews, second tap enters |
| hover a gallery tile | it comes to colour and plays at normal speed |
| click a tile | opens the published post, or the lightbox if there isn't one |

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
