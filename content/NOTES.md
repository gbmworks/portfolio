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

For the game:

```bash
cd content/Unicorn && npm run deploy  # webpack production -> ../../game/unicorn
```

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

Generators are idempotent: run `allocate` and `sitemap` twice and the
files should not change.

## Traps, in the order they will bite

1. **The heavy source is not in git.** `assets/media/` (328 MB),
   `assets/3d/*.blend`, and `content/Unicorn/dist/` (59 MB of models) are
   local only. A fresh clone builds and serves fine but cannot re-deploy
   the game or re-encode a clip. **Back that folder up somewhere that is
   not this repo.**
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
- ID 18 · TD 10 · VIZ 26, all 54 with a picture and a destination.
- Four records still have no artwork (Primetrace, Metabrix, Hecoll,
  Freelance 2024) and are unlisted, so nothing renders as a bare plate.

## Next, in the order I would do it

1. **`SITE.links` vs `SITE.beacons`** — linktr.ee is live, the CV says
   beacons.ai. Pick one, delete the other.
2. **Enforce HTTPS** on the Pages site:
   `gh api -X PUT repos/gbmworks/portfolio/pages -f https_enforced=true`
3. **The Instagram post "Crystalverse — web-based 3D game"** still sits four
   rows below the game itself on Technical Art. Both are real, but it
   reads as a duplicate — one cell to delete if it does.
4. **Artwork for the four bare records**, which is the only thing keeping
   them off the site.
5. **Self-host the fonts and three.js** — two extra origins and 209 KB from
   a CDN on every page, and the CDN is a single point of failure the boot
   guard exists to defend against.
