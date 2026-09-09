# Unicorn and the Crystalverse

A 3D game for children, made for Lenskart: seven crystals are scattered
across a floating island and the unicorn has to carry them back to the
magic pot. It opens from a QR scan with no install, so it had to be a
browser game — three.js and WebGL, with `three-pathfinding` walking the
unicorn over a navmesh.

It is the first entry on **Technical Art**, and clicking that row plays
it. Deployed at [`/game/unicorn/`](https://www.govindbmohan.com/game/unicorn/).

Built on [tamani-coding/threejs-navmesh-example](https://github.com/tamani-coding/threejs-navmesh-example)
— that is where the webpack/TypeScript scaffold, `dist/glb/` and the
UPBGE Blender file came from.

## Working on it

```bash
cd content/Unicorn
npm install
npm start                 # webpack-dev-server on dist/
```

To publish a change to the site:

```bash
npm run deploy            # webpack --mode production, then deploy.mjs
```

That writes the minified bundle and the shipped assets into
`../../game/unicorn/`, which is what the portfolio serves. Then commit
and push from the repo root as usual — there is no build step on the
host, the folder is the deploy.

## What is here

```
src/index.ts          the game — everything, in one file
src/ver1.ts           earlier passes, kept as history
src/jsonver.ts        none of them are imported; the entry is index.ts
src/messy.ts
dist/index.html       authored; copied to game/unicorn as it is
dist/style.css        authored; copied to game/unicorn as it is
dist/models/ …        the working copy: every model the project ever had
deploy.mjs            decides what ships — see the note at the top of it
webpack.config.js     dev builds into dist/, production into game/unicorn/
```

**The heavy files here are not in git.** `dist/` is 59 MB, and 40 MB of
that — `Crystalverse.gltf`, `mapTrees.glb`, `Unicorn4.gltf`,
`mushroom1.glb` and the navmesh example's own demo level — is never
loaded by the game. `deploy.mjs` copies only what `src/index.ts` asks
for, which comes to 16 MB, and that copy is what is tracked. Same split
as `assets/media` (local) and `assets/web` (deployed) for the rest of
the site.

So a fresh clone has the source and the deployed game, but not this
working folder. Keep it backed up somewhere that is not the repo.

## Two things worth knowing before editing

**The Draco decoder path is relative.** `setDecoderPath("draco/")` in
`src/index.ts` — it used to be `"/"`, which asked for the decoder at the
site root and broke every compressed model the moment the game moved
into `/game/unicorn/`. Ten of the twenty models are Draco-compressed;
the symptom is a silent, empty island.

**Every other path is relative too**, which is what lets the same build
run under `/game/unicorn/` on the site and at `/` under
webpack-dev-server. The one exception is the "← Portfolio" link in
`dist/index.html`, which is root-absolute because it points outside this
folder — under the dev server it 404s, and that is expected.

## Platform

Phones and tablets play portrait; laptops and desktops play landscape.
`isHandheldDevice()` keys off `pointer: coarse` rather than window
width, because a laptop and a sideways tablet are both "wide". A
handheld turned sideways gets a "turn your device upright" overlay
instead of the game letterboxed into a frame it was never composed for.
