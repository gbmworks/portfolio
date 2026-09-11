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
host and no CI — the repo root *is* the site. Push `origin` too so the
fork does not drift; it was four commits behind for a while and the site
looked stale because of it.

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

## Current state

- Technical Art leads with the game (`live: 'game/unicorn/'` on the record
  in `projects.js`); clicking the row plays it. Nothing of the game loads
  until then — measured, zero requests under `game/` on a section load.
- ID 18 · TD 14 · VIZ 29, all 61 with a picture and a destination.
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
  Landscape cells **span two columns** with `grid-auto-flow: row dense`,
  which is what stops a 16:9 tile leaving a 379px hole beside a 9:16 one.
  All of it is scoped to `body[data-layout="gallery"]` in `css/tiles.css`;
  `js/tiles.js` only reports `data-orient`, it no longer picks a ratio.
- Four records still have no artwork (Primetrace, Metabrix, Hecoll,
  Freelance 2024) and are unlisted, so nothing renders as a bare plate.

## Next, in the order I would do it

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
