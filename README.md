# Govind — portfolio

Intro (3s) → a radial "pizza wheel" selector that swaps the entire 3D
environment as you hover each slice → a real page per sector.

Vanilla HTML/CSS + three.js (module build via CDN import map). No build step,
no bundler, no assets required.

**Live:** [govindbmohan.com](https://www.govindbmohan.com) — GitHub Pages, built from
`main` in [gbmworks/portfolio](https://github.com/gbmworks/portfolio).

## Deployment

Pages serves the repo root; `CNAME` holds the domain and `.nojekyll` stops
Jekyll swallowing paths. GoDaddy DNS points the apex at GitHub's four
addresses (185.199.108–111.153) and `www` at `gbmworks.github.io`.

HTTPS is enforced, so `http://` and the bare apex both answer `301` to
`https://www.govindbmohan.com/…` keeping the path. It is a repository
setting rather than anything in the repo:
`gh api -X PUT repos/gbmworks/portfolio/pages -F https_enforced=true`
— note `-F`, not `-f`, or it sends the string `"true"` and 422s.

What ships and what does not:

| | in the repo | why |
|---|---|---|
| `assets/web/` | yes, 52 MB | the re-encoded clips the site loads |
| `assets/covers/` | yes, 2.9 MB | Instagram thumbnails, saved locally |
| `assets/3d/` | glb + 4 maps only | the character and its textures |
| `assets/media/` | no, 328 MB | the original footage, local only |
| `assets/3d/*.blend` | no, 257 MB each | over GitHub's 100 MB file limit |
| `assets/1x/` | no | unused working files |
| `game/unicorn/` | yes, 16 MB | the playable game — models, sound, bundle |
| `content/Unicorn/` | source only | its 59 MB working folder stays local |

To re-encode after adding footage:

```bash
ffmpeg -i in.webm -c:v libvpx-vp9 -crf 34 -b:v 0 -an   -vf "scale=w='min(1080,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease"   assets/web/out.webm
```

## Run it

ES modules need a real server — opening `index.html` from disk will fail.

```bash
cd D:/Resources/Portfolio
node tools/serve.mjs              # http://127.0.0.1:8123
```

**Use this one, not `python -m http.server`.** Python's server sends no
`Cache-Control` header at all, so Chrome falls back to heuristic caching and
holds ES modules and stylesheets hard: you edit `js/env/themes.js`, reload,
and keep running the version from ten minutes ago — which looks exactly like
the edit not having worked. Hours disappear into this.

`tools/serve.mjs` has no dependencies and fixes two things:

- **`Cache-Control: no-store` on everything.** Every reload is honest, and
  there is no hard-reload dance.
- **Range requests.** A `<video>` always asks for `bytes=…`; Python answers
  `200` with the whole file instead of `206`, and a clip can sit at
  `readyState 0` and never paint a poster frame. This answers `206`.

It also serves `404.html` for a missing path, the way GitHub Pages does, so
that page can be tested locally.

## Files

Every HTML file is now a shell: a head that crawlers read, a mount point,
and one line that starts the page. Nothing shared is written twice.

```
index.html                 the wheel
industrial-design.html     ┐
technical-art.html         ├ section pages — thin shells, content from projects.js
visualization.html         ┘
project.html               one shell for every case study — project.html?p=<slug>
404.html                   hand-written, root-absolute paths — see "Resilience"
game/unicorn/              a game, not a page about one — see "The game"

css/                       one cascade cut into six readable files, loaded in order
  base.css                 tokens, reset, the canvas, the fallback page
  landing.css              intro, scrim, top bar, wheel labels, lede, hub, hint
  sections.css             the panel and index, per-sector layouts, preview stage
  about.css                the About window, the veil, shared responsive rules
  tiles.css                masonry, tile states, the lightbox
  project.css              the project page, the strips, touch and small screens

js/
  projects.js              >>> ALL THE WORK LIVES HERE <<<  PROJECTS + ARCHIVE + POSTS
  pages.js                 what is on each page and in what order — GENERATED
  sectors.js               the three sectors — the shape of the site
  site.js                  the person's card: name, role line, links, the accent
  links.js                 every outbound URL, built from a reference
  cv.js                    the person's history: work, education, awards, skills
  boot.js                  icons, conditional module preloads, the boot guard —
                           what markup cannot express; after the import map
  shell.js                 the top bar, built from site.js, plus the About window
  nav.js                   leaving a page: the shared veil transition
  stage.js                 renderer, camera, lights, post chain, frame loop
  wheel.js                 slice geometry, projected labels, hover animation
  main.js                  landing page logic
  page.js                  section page logic (sheet index / mosaic)
  project.js               case study logic, and what a retired slug says instead
  tiles.js                 every tile wall + the lazy playback engine
  preview.js               the hover preview stage on a section index
  overlays.js              the About window, built from cv.js and site.js
  env/
    themes.js              per-sector lighting mood (sky brightness, IBL, fog, light tints)
    procedural.js          the GLSL skies + PMREM + cross-fading sky dome
    props.js               themed backdrop geometry per sector
    hdri.js                optional real-.hdr override
tools/allocate.mjs         content/allocation_new.csv -> js/pages.js
tools/media.mjs            posters for every clip; clip re-encode; a size report
tools/serve.mjs            the dev server (no-store, Range) — see "Run it"
tools/sitemap.mjs          regenerates sitemap.xml from the content
assets/
  posters/                 one ~40 KB JPEG per clip — what the tiles show
  hdri/manifest.json       empty by default — see "Real HDRIs" below
content/Unicorn/           the game's source — its own README, its own build
content/NOTES.md           how to work on this repo: commands, traps, what is next
content/WORKLOG.md         why it is the way it is — the history
```

### What is still copied into every HTML file, and why

Four things, all of them load-bearing:

- **The `<head>` block** — title, description, canonical link and the
  Open Graph / Twitter card. Crawlers and social scrapers do not run
  scripts, so this cannot move into `boot.js`. It is per-page content
  rather than duplication.
- **The import map.** Eight lines. It could be injected from `boot.js`,
  but then one network hiccup on that one file takes the whole site down
  instead of just the stylesheet.
- **The `<noscript>` fallback.** It has to be static to work at all —
  and it now does double duty: `boot.js` copies its markup into `#boot`
  if the app has not signalled ready in seven seconds, so the "no
  JavaScript" page and the "3D never came up" page are the same page,
  written once per file instead of twice.
- **The stylesheet and font `<link>` tags, and the preconnects.** These
  were created by `boot.js`, and that was a mistake: the browser's
  preload scanner only reads *markup*, so nothing was requested until
  `boot.js` had been fetched, parsed and run. Measured cold, the HTML
  was done at 5 ms and the first stylesheet was not requested until
  32 ms — and the Google Fonts hop then stacked in series behind that.
  Static, the gap is 2 ms. See "Why it loads when it loads" below.

The top bar and the boot fallback markup used to be pasted into each
file; they are in `shell.js` and `boot.js` now. What is left in the
markup is there because it must be: metadata for crawlers, the import
map, the fallback, and the links the preload scanner has to see.

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
`tuneTransmission()` *would* drop the refraction buffer to half resolution,
but the property it sets arrived in three.js r171 and the import map pins
r169 — see "A dead optimisation" under Performance. If it ever feels heavy,
lower `transmission` towards 0 on the wheel slices in `wheel.js`.

Each theme's `sat` in `js/env/themes.js` desaturates its baked sky. They sit
at 0.06–0.10 (near-grey); push one back towards 1 to bring that world's
original colour back.

Backdrop props are positioned by **where they land on screen**, not in raw
world units — `place(sx, sy, z)` in `props.js` takes screen fractions at a
given depth, and `KEEP_OUT` (0.60) is the radius around the centre that stays
clear of the wheel and the page copy.

## The About window

One floating panel, on every page, built from `js/cv.js` — transcribed from
*Govind B Mohan - CV 2026-new.pdf* — plus the contact line from
`js/site.js`:

- the summary line and contact
- **8 roles**, Primetrace Labs back to DesignFlyOver, with the 2024 freelance
  clients broken out
- education, awards
- skills in four groups, languages, interests

`js/overlays.js` renders it and `js/shell.js` mounts it with the top bar,
which carries the single **About** link. The separate About panel that used
to hold hand-written copy is gone — everything here is from the CV, so there
is one place to edit and nothing invented.

The bar itself is built by `js/shell.js`, not typed into the HTML. On the
`sheet` layouts the identity is hidden because the drawing sheet occupies
the top-left, which used to push the nav to the *left* under a panel two
stacking levels above it — About and Contact were unreachable on Industrial
Design and Technical Art. `body[data-layout="sheet"] .topbar` now sets
`justify-content:flex-end`.

The phone number was deliberately left off a public page; it is one line in
`cv.js` if you want it.

## The work, and what is on each page

Two files decide this, and they answer different questions.

- **`js/projects.js`** — *what the work is.* Every record: title, client,
  year, write-up, media, where it is published. Nothing here says which
  page it lands on.
- **`js/pages.js`** — *what is on each page, and in what order.* One flat
  list per sector. **Generated** by `tools/allocate.mjs` from
  `content/allocation_new.csv`.

### One list, no sub-headings

A page is the sequence its list says it is. There is no "Projects" block
followed by an "Archive" grid followed by an "Also on Instagram" strip —
a project, a published Behance gallery and an Instagram post sit next to
each other in one running order, drawn identically. What an entry
happens to be only decides where clicking it goes:

```js
'muse-watch'        // a project with a page here  -> project.html?p=muse-watch
'aloka'             // a published gallery         -> opens on Behance
'ig:Cy75XuoSpS8'    // an Instagram post           -> opens there
```

`resolveEntry()` in `projects.js` turns any of those three into the same
shape — `{ title, meta, still, clip, href, external }` — so `page.js` and
`tiles.js` never branch on type. `pageEntries(sectorId)` is the whole
public interface.

| page | entries | with a page here | link out |
|---|---|---|---|
| Industrial Design | 18 | 7 | 11 |
| Technical Art | 10 | 0 | 9, and one that plays |
| Visualization | 26 | 2 | 24 |

The tenth Technical Art entry is the game, first in the running order.
It is neither a page here nor a link out: clicking it plays the thing
itself. See "The game".

### Editing it

1. Open `content/allocation_new.csv` — three columns, `ID`, `VIZ`, `TD`,
   one entry per cell, top to bottom in display order.
2. Move cells around. Delete a row to take something off the site.
   Instagram entries are written `IG · <title>`; the `(in <project>)`
   suffix is only there to make the sheet readable and is ignored.
3. `node tools/allocate.mjs` — rewrites `js/pages.js`. It refuses to
   write anything if a cell does not match a record, and says which.
4. `node tools/sitemap.mjs`.

### Nothing is deleted by being unlisted

A record that appears in no list is simply not shown. It stays in
`projects.js`, so `project.html?p=<slug>` still resolves for anyone
holding an old link, and putting it back is one line in the sheet. Ten
records are currently unlisted this way, including Fitmint, Youforia and
Loops & Studies — they are in git and in the file, just not on a page.

Ten Instagram posts that used to hang off those projects are now listed
directly on a page instead, which is why they still appear.

### Every entry has a picture

All 54 have a thumbnail and a destination — checked against the files on
disk and the Behance CDN. The four projects that still have no artwork
(Primetrace, Metabrix, Hecoll, Freelance 2024) are not listed on any
page, so nothing renders as a bare typographic plate any more. The fifth
was the Lenskart game, and its cover is now one of the story illustrations
from the game — `gemUI/3.jpg`, the floating island under the rainbow. Give one of them a `cover:` and add it back to the sheet and it
returns everywhere at once.

### Project records

```js
{
  slug: 'muse-watch',
  sectors: ['industrial-design'],   // the world it is lit by, not where it is listed
  title: 'Muse — Personalised Watch System',
  client, role, year, tools,
  summary, body: ['…'],             // the page copy
  cover, preview,                   // still and clip
  media: [{ src, title }],
  behance: { id, slug },
  posts: [{ code, kind, title, cover }]
}
```

`sectors[0]` still themes the 3D backdrop behind a project page, and
`homeSector()` prefers the page a project is actually listed on. Prev /
next walks the page's running order, so it matches what the visitor
clicked through.

## The game

`game/unicorn/` is *Unicorn and the Crystalverse* — a browser game made
for Lenskart, and the first entry on Technical Art. It is the one thing
on the site that is neither a page here nor a link out: clicking the row
plays it.

**The site pays nothing for it until then.** The game is a separate page
with its own bundle, so a visit to Technical Art fetches none of it —
measured: zero requests under `game/` on load, and the one 55 KB cover
only when a row is hovered. Clicking it wipes to `/game/unicorn/` the
same way any internal link does, and the splash screen paints while the
island loads behind it.

| | |
|---|---|
| what it is | tap the ground, the unicorn walks a navmesh route, seven crystals go back in the pot |
| built with | three.js, `three-pathfinding`, Draco-compressed glTF, Lottie for the onboarding |
| deployed | `game/unicorn/` — 16 MB, of which 11.6 is models |
| source | `content/Unicorn/`, which has its own README |

`live: 'game/unicorn/'` on the record in `projects.js` is what does it —
`resolveEntry()` hands that back as the entry's `href`, so every place
the game is listed opens the game. `project.html?p=lenskart-ar-game`
still renders a real page with the write-up and a *Play the game* link
at the top, because an old or shared URL should not dead-end.

### Building it

```bash
cd content/Unicorn
npm install
npm run deploy      # webpack --mode production, then deploy.mjs
```

`deploy.mjs` is the interesting half. `content/Unicorn/dist/` is a 59 MB
working folder, and **40 MB of it is never loaded** — an uncompressed
`Crystalverse.gltf`, a `mapTrees.glb`, the navmesh example's own demo
level. So the deploy is a manifest, not a recursive copy: `MODELS` in
that file lists the twenty models `src/index.ts` actually asks for, and
it refuses to write anything if one of them is missing rather than
shipping a folder that 404s halfway through the first level.

The bundle was also a development build — 3.8 MB, nearly all of it an
inline source map. Production, it is 573 KB.

Two things that will bite anyone editing it: the Draco decoder path has
to stay relative (`draco/`, not `/`, or every compressed model fails
silently once the game is not at the site root), and the game's own
`README.md` explains the rest.

## Three layouts, one system

`layout` in `sectors.js` picks the arrangement, and `page.js` sets
`body[data-layout]` so the CSS follows:

| sector | `layout` | arrangement |
|---|---|---|
| Industrial Design | `sheet` | a drawing sheet down the **left** — drafting grid, an orange rule under the title, and the project index as a two-column register with corner ticks. The framed preview stage fills the space to its right. |
| Technical Art | `sheet` | the same. A full-bleed stage was tried here and dropped: stretching a portrait clip across the whole viewport read as a distorted background rather than a preview. |
| Visualization | `gallery` | a **mosaic** of project covers under a slim title bar; no hero. |
| a project | `project` | a reading column over the sector's own world — hero, facts rail, copy, then its media in the same tile grid used everywhere else. |

`body[data-layout]` and the page shell have to agree: a `sheet` page needs
`#panel` and `#stagePreview` in its HTML, a `gallery` page needs `#page`, and
`project.html` needs `#work`. Every page also needs `#ui` for the top bar to
mount into, and `#boot` plus a `noscript.fallback` for the boot guard.
Change one without the other and the page has nothing to render into.

One tile engine (`js/tiles.js`) draws every wall on the site — the mosaic,
the archive grid, a project's own media, and the Instagram strips. Grey at rest, colour and play
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

- **Same work, listed twice.** A page is an explicit ordered list, so a
  thing appears exactly as often as it is written down. Listing one entry
  on two pages is allowed and sometimes wanted — the John Jacobs line is
  on Industrial Design and Visualization — and listing it twice on the
  *same* page would be visible immediately in the sheet.

The old `linkTiles()` de-duplication pass — which compared clip paths and
destination URLs to hide copies — was deleted along with the copies.

## The preview stage

There is **no wheel on a section page** — that space is the stage.
`js/preview.js`, mounted on `#stagePreview`, reuses one `<video>` and one
`<img>` for the whole page, so running down a long index never spawns more
than one decoder.

**It is centred in the space the sheet leaves, not pinned to the right
edge.** `left` resolves to the same `clamp(420px, 38.2vw, 660px)` the panel
does, `right` is 0, and the frame centres itself in between at
`min(100%, 1360px, 131vh)` — 1360×850 on a 2560-wide window, where it used
to be 940 px hard against the right margin.

A row shows its clip if it has one, otherwise its still. That order is what
this file always claimed and the opposite of what it did: the old code
tested the still first, so an entry with both showed a static cover and its
clip never played. The still is now the layer
*underneath*: it paints instantly while the clip decodes, and the video
cross-fades over it on `loadeddata`, so sweeping a long index never flashes
black between rows.

A row with neither gets a **typographic plate**: the name set large on the
dark card, client and year beneath, and one line saying so — the same
treatment the tile wall uses. Nothing currently on a page hits that state;
it is there for the moment something is added before its artwork is.

Since the wheel no longer navigates, each section page carries a **sector
switcher** (01 / 02 / 03) under its header, and the prev/next pair still sits
at the foot. A project page has its own prev/next, which walks that sector's
list rather than the sectors.

On the mosaic and on a project's media grid the tiles preview themselves —
grey and still at rest, colour and playing on hover — so the stage is only
needed where the work is a list.

## Resilience and reach

- **Boot guard.** If the app has not signalled `data-ready` within seven
  seconds — blocked CDN, no WebGL, a very slow first load — `js/boot.js`
  copies the page's own `<noscript>` markup into `#boot` and reveals it. The
  no-JavaScript page and the stalled page are the same page, styled by one
  `.fallback` ruleset, written once per file instead of twice.
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
  step and nineteen more copies of the boilerplate — the trade was made
  deliberately, and the boilerplate is now about half what it was.
- **A retired slug still works.** Twenty-two records became archive entries
  and four became one, so `js/project.js` resolves `MOVED[slug]` first, then
  `archiveBySlug(slug)` — which renders a real page naming the work and
  linking to its Behance gallery — and only then falls back to a 404 listing
  every sector and its project count.
- **`404.html` uses root-absolute paths, and that is deliberate.** GitHub
  Pages serves it for *any* missing path, and a relative `href` resolves
  against the URL that was requested — so on `/some/deep/path` the old
  `./css/style.css` asked for `/some/deep/css/style.css` and the page
  rendered unstyled. It is the one file that does not share `js/boot.js`:
  it carries the single stylesheet it needs and no scripts at all.
- **Keyboard.** Gallery tiles are focusable, carry `role` and `aria-label`,
  activate on Enter or Space, and light up on focus exactly as on hover.
  Focus rings are visible throughout.

## Why it loads when it loads

Measured cold on localhost, so every number here is a **floor** — on a real
connection each hop costs a round trip instead of a millisecond.

### What was actually wrong: nothing could start

```
   0ms  ┌ HTML requested
   5ms  ├ HTML fully received — the parser now knows everything static
  19ms  ├ boot.js requested
  27ms  ├ boot.js received and run
  32ms  ├ ...only NOW are the 6 stylesheets and the font CSS requested
 127ms  └ fonts.googleapis.com answers (95ms for 1 KB), and the .woff2
          files are a further hop behind that
```

The browser's single best defence against latency is the **preload
scanner**: while the HTML is still parsing it races ahead, finds every
`<link>` and `<script>`, and starts fetching them. It only reads markup. It
cannot see a `<link>` that JavaScript has not created yet.

Every stylesheet, the font CSS and all three preconnects were created by
`js/boot.js`. So the scanner looked at the page, found one script, and
stopped. Twenty-seven milliseconds of dead air on localhost; a full round
trip on a phone, with the two Google Fonts hops stacked in series behind
it — four sequential trips before text could render in the right face.

Those links are back in the markup now, in all five shells:

| | before | after |
|---|---|---|
| HTML finished | 5 ms | 6 ms |
| first stylesheet requested | 32 ms | **8 ms** |
| gap waiting on `boot.js` | **27 ms** | **2 ms** |
| discovered by | `boot.js`, at runtime | the preload scanner |

`boot.js` keeps only what markup cannot express: the icons, the *conditional*
postprocessing preload, the module-graph warming that has to follow the
import map, and the seven-second fallback.

### Where the bytes go

351 KB over 39 requests on the landing page.

| origin | requests | KB | note |
|---|---|---|---|
| `cdn.jsdelivr.net` | 14 | 209 | three.js core, minified; the postprocessing addons are **not** — `examples/jsm` ships raw ES modules |
| local | 24 | 142 | the six sheets, the module graph, the favicon |
| `fonts.googleapis.com` | 1 | 1 | one kilobyte, on its own origin, on the critical path |

Two-thirds of the bytes are three.js. Section and project pages no longer
fetch the postprocessing half of it at all — see "Bloom is opt-in" under
Performance — which takes seven requests off every page that is not the
landing page.

### The three seconds that are not loading

`INTRO_MS` in `js/main.js` holds the name on screen for **3 s** before the
wheel appears. Nothing is loading during most of that; the stage is up at
about 100 ms. A first-time visitor cannot tell the difference between a
deliberate three-second title card and a slow site.

It runs once per visit (`sessionStorage.introSeen`), so walking back from a
section page skips it — which is also why it is easy to forget it is there
while working on the site. If the site feels slow to *other people* and fast
to you, this is the first thing to try: set `INTRO_MS` to 1200.

### What is left, in order of what it would buy

1. **Self-host the two fonts.** One kilobyte of CSS on `fonts.googleapis.com`
   plus the `.woff2` files on `fonts.gstatic.com` is two extra origins, two
   DNS lookups and two TLS handshakes for four font files. Dropping them in
   `assets/fonts/` and declaring `@font-face` locally removes both hops.
2. **Self-host three.js.** 209 KB from a third-party CDN. `npm i three`,
   repoint the import map, and it comes from the same origin and connection
   as everything else — no extra handshake, and it stops being a
   single-point-of-failure the boot guard has to defend against.
3. **Poster stills for the clips.** A tile near the viewport currently
   fetches `preload=metadata` from a multi-megabyte `.webm` just to paint a
   thumbnail. A ~40 KB JPEG per clip would replace that entirely, and
   `assets/web/` is 53 MB of clips fronting a wall that mostly wants
   seventeen small stills.

## Performance

Page weight was never the problem. This scene is **cheap in geometry and
expensive in pixels**: 28 draw calls and 28k triangles on the landing
page, every one of them through a physically-based shader, and then the
whole frame through a twelve-pass bloom. Measured on a 2560×1271 window,
the three costs that mattered were all fill rate:

| | was | now |
|---|---|---|
| landing canvas | 3840×1907 — **7.30 MP** | 2538×1260 — **3.20 MP** |
| section / project canvas | 3225×1601 — **5.16 MP** | 2007×996 — **2.00 MP** |
| bloom on a backdrop page | 13 fullscreen passes | none |
| `backdrop-filter` on the panel | blur(20px), re-blurred every frame | none |

### The pixel budget

`PIXEL_BUDGET` in `js/stage.js` caps a frame by **total pixels**, not by
device pixel ratio. Capping the ratio alone does not bound anything: the
old `min(devicePixelRatio, 1.5)` is 1.5 whether the window is 1280 or
3840 wide, so a big monitor quietly asked for 7.3 megapixels of PBR
shading — and a 4K window at ratio 2 would have asked for 33.

    hero      3.2 MP   the landing page, where the wheel is the subject
    backdrop  2.0 MP   behind a panel and a scrim

`budgetedRatio()` solves for the ratio that fits, floored at 0.75, and
`resize()` re-solves it. On a 2560-wide window the landing page settles
at 0.99 and a section page at 0.78.

### Bloom is opt-in

`UnrealBloomPass` is a luminosity pass, five blur mips taken twice, and a
composite — thirteen fullscreen draws with `OutputPass`. The landing page
pays it because the wheel's glow *is* the image. A backdrop behind an
opaque reading column does not, and `createStage(..., { bloom: false })`
means the four postprocessing modules are **dynamically imported, so a
backdrop page never fetches them at all** — seven fewer requests once
their transitive deps are counted. `<html data-stage="hero">` is what
tells `js/boot.js` to preload them.

Without a composer the renderer draws straight to the canvas; tone
mapping and colour-space conversion still apply, so only the glow is
gone.

### Two blurs that were costing a frame each

`.panel` (660 px wide, full height) and `.proj` (the reading column) both
carried `backdrop-filter: blur(20px)`. A backdrop filter over content
that changes every frame has to be recomputed every frame, across a fifth
of the screen. Both are now opaque gradients instead — which is the one
job the blur was doing. The blurs that remain are on `.win` and
`.lightbox`, which only exist while they are open.

### Still deferred until needed

- **Skies**: only the neutral sky is baked at startup; each sector's sky
  and its PMREM are baked the first time that world is asked for
  (`EnvManager._ensure`).
- **Backdrop worlds**: gear extrusions, exploded assemblies and terrain
  are built on first show (`createProps.ensure`). Two of the three are
  never looked at on a given visit.
- **The character** and its four maps (~3 MB) are only fetched when the
  visualization world is actually shown.
- **Gallery clips**: a poster frame is fetched within 400 px of the
  viewport and released five seconds after leaving.

### A dead optimisation, left in place and labelled

`tuneTransmission()` sets `renderer.transmissionResolutionScale = 0.5`.
**That property landed in three.js r171 and the import map pins r169**,
so the guard is false and the function does nothing — it has never done
anything on this site, and the claim that it "drops the refraction buffer
to half resolution on HiDPI screens" was wrong. It is kept because it
starts working the moment the pin moves.

Until then, refraction is a second full render of the scene every frame,
shared by the three wheel slices. The lever that actually removes it is
`transmission: 0` on those slices in `wheel.js` — which is exactly what
`LOW_POWER` already does on phones and coarse pointers.

### Frame rate

The landing page runs uncapped. Section and project pages run at 24fps
(`fps: 24`), which is plenty for a drift that takes twenty seconds to
cross the screen.

There is deliberately **no `document.hidden` guard** around the render.
Chrome already stops calling `requestAnimationFrame` for a hidden tab, so
skipping the draw buys nothing — and anything that reports hidden while
still painting (a screenshot tool, a tab-hover preview, an embedded
webview) would get a canvas that never receives a frame. An earlier
version of this guard also skipped the `afterMatrix` pass, which is what
projects the slice labels, and left them stacked in the top-left corner.

`scene.updateMatrixWorld()` is no longer forced, and only runs at all if
a listener registered an `afterMatrix` callback — three.js keeps the
dirty flags honest, and forcing it walked the whole graph a second time
every frame for the benefit of one page.

`window.__stage.bootMs` reports how long the stage took to come up — 27 ms
on a section page, 119 ms cold on the landing page.

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

**One sky.** There used to be four — a dark hall, a brass workshop, a neon
horizon and a neutral studio — and hovering a slice cross-faded the whole
sky and its image-based lighting from one to the next. That meant four
equirect bakes, four PMREM chains, a dome shader sampling *two* skies per
pixel and mixing them, and a PMREM swap at the half-way point hidden under
a dip in `environmentIntensity`.

The sky is now baked once, from `SKY` in `js/env/themes.js`, and never
changes. What changes on hover is the **backdrop geometry** — which is what
actually told the three worlds apart — plus the light colours, fog tint and
two intensity scalars, all of which are just numbers being lerped and cost
nothing.

| sector | backdrop, faded in on hover |
|---|---|
| Industrial Design | exploded assemblies breathing apart over a blueprint floor, floating dimension frames |
| Technical Art | a meshed gear train (radius ∝ tooth count, so the pitch lines actually touch), piping, a driven piston |
| Visualization | scrolling wireframe terrain, drifting metal solids, and `assets/3d/PORTFOLIO.glb` — the rigged character, running |
| *(nothing hovered)* | the room, empty |

Because there is only one bake left, it can afford to be a good one: `SIZE`
went back up from 512×256 to **1024×512**, which costs a single extra render
at boot and gives the PMREM — and therefore every reflection in the glass —
more to work with than it had when there were four.

### The one sky

```js
// js/env/themes.js
export const SKY = {
  key: 'sky',   // the filename a real .hdr override would use
  shader: 0,    // 0 studio · 1 foundry · 2 workshop · 3 neon
  sat: 0.06     // 0 = greyscale, 1 = the shader's own colour
};
```

Those two numbers re-light the whole site. `shader` picks a branch of the
procedural equirect shader in `js/env/procedural.js` — the `studio()`,
`foundry()`, `workshop()` and `neon()` functions are all still there, so
switching the whole site to the brass workshop is a one-character edit.

How it works:

1. The chosen branch paints a full 360° equirectangular sky into a
   half-float render target (1024×512).
2. That target goes through `PMREMGenerator` → `scene.environment`. This is
   the lighting that reflects in the slices — it keeps the full HDR range,
   so skylights and bulbs read as real light sources.
3. A big inside-out sphere samples it for the visible sky. Its highlights
   are rolled off (`c / (1 + c*0.85)`) so a blazing skylight becomes a glow
   instead of a white wall, and the bottom is darkened so UI text stays
   readable.

### What is still per-sector

`THEMES` in `js/env/themes.js` — `bgI` (how bright the dome is drawn),
`envI` (how hard the IBL lights the glass), `fog`, and the `key` / `rim` /
`bounce` light colours and intensities. These are lerped over 0.85s on
hover, exactly as before. They are scalars and hex colours, so keeping them
costs nothing and each world keeps its own mood without being lit from a
different map.

If you want hovering to change *nothing* but the geometry, give every entry
in `THEMES` the same values as `neutral`.

### The character

`assets/3d/PORTFOLIO.glb` carries the rig and two baked clips (`Running_M`
and `Action`) but no materials, so `js/env/props.js` builds the PBR material
by hand from the loose maps beside it — `diffuse_new.jpg`, `normal_new.jpg`,
`rough_new.png`, `metal_new.png`. glTF UVs need `flipY = false`, which is why
the textures are loaded there rather than dropped straight in.

**The GLB has two clips, and only one is an animation.** `Running_M` is a
7.03s locomotion cycle. `Action` — Blender's default name for an unnamed
action — is 0.07s with zero joint travel: a single held pose, the figure
crouched with its arms folded over its knees. Playing it simply holds
that pose.

So the character has two framings, set by `props: { hero: { closeUp } }`
through `createStage`:

| | where | clip | framing |
|---|---|---|---|
| far | landing page, on hover | `Running_M` | small, off to one side, running on the deck |
| close-up | `visualization.html` | `Action` | brought forward, turned to camera, held in the folded pose |

On its own page the visualization world is not just a backdrop, so the
model is the thing you look at. `HERO` in `buildVisualization()` holds
both framings; `y` is set outright rather than by screen fraction because
the figure has to stand at a known height to clear the tile wall.

**The wall had to move for this.** `.gal` is 93% opaque across the full
width, so the character was invisible from the first tile down. A mosaic
page now leaves a clear band above the wall
(`body[data-layout="gallery"] .gal:first-of-type`), about 30vh, dropping
to 80px on a phone where a full screen of scrolling before any work is a
bad trade. Delete that rule and the character goes back to being hidden;
nothing else changes.

The model and its maps (~3 MB) are only fetched the first time the
visualization world is actually shown — the other two sectors never pay for
it.

### A real HDRI

One sky means one override. Drop an equirectangular `.hdr` in
`assets/hdri/` named after `SKY.key` and list that name in
`assets/hdri/manifest.json`:

```json
["sky"]
```

That loads `assets/hdri/sky.hdr` and uses it for both the visible dome and
the image-based lighting, replacing the procedural bake. With the manifest
empty — the default — nothing is requested at all.

`loadHdriOverride()` still takes a key rather than hardcoding one, so
per-sector `.hdr` files would work again the moment the manager asked for
them.

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

## Media

`tools/media.mjs` — `posters`, `encode`, `report`.

### Posters are the whole trick

Every clip in `assets/web/` has a poster beside it in `assets/posters/`,
about 40 KB each, 0.6 MB for all seventeen. A tile paints the poster and
layers the video *over* it with no `src`; the src is only set in `wake()`,
on hover. Scrolling the whole 26-tile Visualization mosaic now fetches
**zero video bytes** — measured, not assumed.

Before this, a tile within 400 px of the viewport set `preload=metadata`
on a multi-megabyte clip purely to paint a still frame. On a wall of
twenty-six that is tens of megabytes to show what 0.6 MB of JPEG shows.

```bash
node tools/media.mjs posters     # after adding or re-encoding any clip
```

The frame is taken a fifth of the way in — past a fade-up, before an
outro — scaled to 900 px on the long edge at `-q:v 4`.

### The clips are already well encoded — do not re-encode them

`encode` exists and works, and running it was a dead end. It re-encodes
from `assets/media` (the originals) at CRF 34, and **six of the seven
clips it tried came back bigger than what is already deployed**; the
seventh improved by 2%.

The bitrate spread across `assets/web` looks alarming — 418 kbps to
5175 kbps — and it is tempting to read that as sloppy encoding. It is
not. It is content: `drip_2` is seven seconds of high-motion material and
genuinely needs 5 Mbps at that quality; `clubs_F` is twelve seconds of
something nearly static. They were already encoded above CRF 34.

The guard in `encode` keeps the existing file whenever the new one is
bigger, so running it cannot make things worse — but at CRF 34 it will
mostly print "kept" and waste ten minutes of VP9. If you ever do want
them smaller, the lever is a *higher* CRF (36–38) and accepting the
quality cost, not a re-encode at 34.

A first attempt also capped the long edge at 1280 from the *original's*
dimensions, which silently upscaled the clips that had been downscaled to
608×1080 — that is why the first run produced bigger files across the
board. It now encodes to the dimensions the deployed clip already has.

### The character is the heaviest thing on the site

`assets/3d/PORTFOLIO.glb` is 2.0 MB and its maps were 1.0 MB, so the
Visualization page paid **3.2 MB for a decorative backdrop** — 72% of the
page. The maps were 2048×2048 for a character drawn about 570 px tall.

At 1024×1024 they are 348 KB, down 66%, with no visible difference at the
size it is actually rendered:

| | was | now |
|---|---|---|
| `diffuse_new.jpg` | 599 KB, 2048² | **185 KB, 1024²** |
| `normal_new.jpg` | 413 KB, 2048² | **164 KB, 1024²** |
| character total | 3165 KB | **2502 KB** |

The remaining 2.0 MB is the GLB itself. Draco would take it to roughly
400 KB, but it costs a `DRACOLoader` plus a wasm decoder — more requests
on every page for a saving on one. It is still only fetched the first
time the visualization world is shown, so the other two sectors never pay
for it.

### Re-encoding after adding footage

```bash
ffmpeg -i in.webm -c:v libvpx-vp9 -crf 34 -b:v 0 -an \
  -vf "scale=w='min(1080,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease" \
  assets/web/out.webm
node tools/media.mjs posters
```

## Editing content

Four files, split by what they describe. Nothing about the work or the
person is written in an HTML file any more.

- **`js/projects.js`** — the work: `PROJECTS`, `ARCHIVE`, `POSTS`. See
  "The work, in two tiers" above.

- **`js/site.js`** — the person's card, and the only place that names
  them. The role line, the contact link, the Instagram handle, the origin
  and the accent all come from here; the top bar in `js/shell.js` is built
  from it. Before this file existed the same facts were in three places and
  disagreed with each other.

- **`js/cv.js`** — the person's history: work, education, awards, skills,
  languages, interests, transcribed from the 2026 CV. The About window is
  built from this plus the contact line in `site.js`.

- **`js/sectors.js`** — the shape of the site. Each entry in `SECTIONS`
  generates a slice, its label, its page and its navigation:

```js
{
  id,           // must match the .html filename AND the theme key in env/themes.js
  layout,       // 'sheet' or 'gallery'
  index, title, subtitle,
  blurb,        // paragraph at the top of the section page
  note,         // optional line above the index
  icon          // inline stroke SVG — it draws itself on hover
}
```

There is **no per-sector colour**. All three used to declare the same
`#ff5a12` / `#ff9048` as the global accent — three copies of one constant.
The system is monochrome; the accent lives in `site.js` and everything
reads it from there.

`js/links.js` builds every outbound URL — Behance galleries and covers,
Instagram posts, a project page, a sector page. It is the only file that
knows the shape of an external address, so nothing is re-hosted and no
URL is typed twice.

**Adding a 4th sector**: add the entry to `SECTIONS`, add a matching theme
to `js/env/themes.js` (and a shader branch + backdrop builder if you want
it to have its own world), copy one of the section `.html` files — about
forty lines now — and tag projects with the new `id`. Wheel angles, gaps,
raycasting and labels all derive from `SECTIONS.length`.

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

`IG_HIGHLIGHTS` in `sectors.js` names the story highlights he curates himself;
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
| hover a slice | slice pulls out along its bisector and tilts, icon lights and redraws, title pops in, and **that sector's backdrop fades in** — the sky stays the same sky |
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
  visible sky is drawn, `envI` how hard it lights the slices. These are
  independent on purpose: a dark backdrop can still throw strong reflections.
- **The sky itself**: `SKY` in `js/env/themes.js` picks which branch of the
  procedural shader is baked — `studio()`, `foundry()`, `workshop()` and
  `neon()` all still live in `js/env/procedural.js`, so switching the whole
  site to a different room is a one-character edit to `SKY.shader`.
- **Bloom**: the `UnrealBloomPass` line in `js/stage.js`.
- `window.__stage` is exposed in the console for live tweaking, e.g.
  `__stage.scene.environmentIntensity = 2` or `__stage.env.set('visualization')`
  — which now changes the mood and the backdrop, not the sky.

## Notes

- three.js `0.169.0` from jsDelivr via the import map in each HTML file — needs
  a network connection. To go offline, `npm i three` and repoint the import map
  at `node_modules/three/…`.
- Fonts come from Google Fonts; the CSS falls back to system faces.
- Section pages are real URLs and degrade to a `<noscript>` title + link,
  which doubles as the boot fallback.
- `prefers-reduced-motion` shortens the intro and flattens transitions.
- **Two unresolved facts about the person**, both now in one place rather
  than contradicting each other across files. `js/site.js` has `based:
  'Bangalore, India · from Kerala'` (the 2026 CV, and what the About panel
  already showed) — the old `data.js` said Thiruvananthapuram, which the
  Behance profile still says and nothing rendered. And `links:` is the
  linktr.ee URL, because that is what the live Contact link points at; the
  CV gives `beacons.ai/govindbmohan` instead, kept alongside as
  `SITE.beacons`. Pick one and delete the other.
- The stylesheet is six files loaded in order by `js/boot.js`, and that
  order is load-bearing: the concatenation is byte for byte the single
  `style.css` it was cut from, so no rule sees a different rule before it.
  Moving a rule between sheets can change which one wins.
- While editing, browsers cache ES modules **and stylesheets** hard — which
  is what `tools/serve.mjs` exists to prevent. If you are on some other
  server and a change doesn't show up (a CSS edit with no effect, "does not
  provide an export named …", or an old version of a module still running),
  it is the cache, not your edit. Hard reload with Ctrl+Shift+R, or switch
  to `node tools/serve.mjs`.
- Backgrounded tabs throttle `requestAnimationFrame`, so animations pause and
  resume rather than jumping — deltas are clamped to 50ms.
