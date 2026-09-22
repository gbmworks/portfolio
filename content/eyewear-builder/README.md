# Eyewear Builder

A browser eyewear configurator. Design a frame — silhouette, colour, lens, arms,
bridge — then put it on your own face with a webcam, sized against your real
measurements rather than a stock head.

Everything runs on the machine it's opened on. No frame, image, or measurement
leaves the browser.

---

## What it does

**The editor.** Eight front silhouettes on a drag wheel that *blends* between
neighbours rather than snapping — the frame at 40% between Round and Square is
genuinely 40% of each, because the shapes are morph targets and the wheel drives
their weights. Four arm designs, four bridge profiles, ten frame colours across
solid and translucent, three lens types with ten tints, and four metal finishes
split across two groups. Front, arms and lens each get an HSB picker too, for
when the answer is "not quite that one".

Four camera views: a 60 mm 3D view that makes a slow turntable pass on arrival
and whenever the cursor rests, plus orthographic front, side and top for judging
proportion without perspective distorting it. Every control has a
voice: the shape wheel walks a pentatonic scale as you drag it, colour answers
in a fifth, and advancing a step rises. All synthesised, all mutable from the
top bar.

**The try-on.** A short webcam scan measures the face in millimetres — pupillary
distance, head width, ear depth — using MediaPipe's 478-point landmarker, scaled
against the one dimension on a face that is reliably constant (the iris, 11.7 mm
across). The frame is then placed on the live video with the far temple hidden
behind the head by a depth-only occluder, and fit controls for how it sits.

## Running it

```bash
npm install
npm run dev          # http://localhost:5180
```

`npm install` is enough — the MediaPipe wasm runtime is copied out of
`node_modules` into `public/wasm/` automatically before `dev` and `build`
(see `scripts/sync-wasm.mjs`). Everything else is committed.

```bash
npm run build        # tsc -b && vite build
npm run typecheck
```

The scan needs a camera and a secure context. `localhost` counts as one, so
plain http is fine locally; reaching the dev server from a phone on the LAN
needs https. To exercise the scan path *without* a camera, open
`http://localhost:5180/?demo` — it feeds MediaPipe's own canonical face through
the real pipeline.

## How it's built

React 19 + TypeScript + Vite, with zustand holding one `Configuration` object
that both the editor and the try-on render from — so the two can't disagree
about what's being built.

three.js is used directly, **not** react-three-fiber. That's deliberate and
documented: in this dependency set R3F never commits `<Canvas>` children, and it
fails silently.

```
src/
  frame/      loading, morph targets, subdivision, mirroring, silhouettes
  editor/     the 3D editor stage, material table, all configurable options
  face/       landmarker, head basis, measurements, face-shape classifier
  ar/         try-on scene, fit solving, occlusion, pose smoothing
  components/ the React surface
  state/      the single store
```

The source model is a 326-vertex base cage with morph targets, subdivided at
load (Loop, two levels → 8,960 vertices on the front). Every stage of that
pipeline carries the morph targets through the same arithmetic, so the shapes
stay aligned with the surface they deform.

Material properties live in **`public/materials.csv`**, not in code — roughness,
metalness, maps, clearcoat, per piece. Edit and reload; no rebuild.

## Worth a look

[`NOTES.md`](NOTES.md) is the engineering log: 67 numbered traps hit while
building this, each with the symptom, the cause and the fix. A few of the more
interesting ones:

- **#42** — a dropped morph target doesn't error, it *no-ops*. The design
  buttons light up and the geometry never moves.
- **#46/47** — UVs can't go through Loop subdivision the way positions do.
  Welding by position smears the texture across every seam; Loop's masks
  distort the unwrap. They ride as face-corner data on linear rules instead.
- **#41** — glTF splits a node into one mesh per material, so a two-material
  object arrives as two meshes with the same name. Route by name and one
  silently overwrites the other.
- **#31** — `scene.background` is drawn on a unit cube pinned to the camera,
  which is invisible under an orthographic camera.
- **#32** — alpha blending can't make glass. Opacity multiplies the specular
  highlight along with the body, which is the exact thing that reads as glass.
- **#13** — one `getUserMedia` acquire against two releases. StrictMode found
  it; the symptom was a blank screen.

## Assets

| File | Source |
| --- | --- |
| `public/frames/final.glb` | Authored for this project (Blender) |
| `public/textures/tortoise.png` | Authored for this project |
| `public/models/face_landmarker.task` | Google MediaPipe |
| `public/tools/canonical_face_model.obj` | Google MediaPipe |
| `public/hdri/empty_warehouse_01.hdr` | Poly Haven |
| `src/fonts/boldonse-latin.woff2` | Google Fonts — Boldonse |
| `src/fonts/schibsted-grotesk-latin.woff2` | Google Fonts — Schibsted Grotesk |
| `public/wasm/` | Generated from `@mediapipe/tasks-vision` (not committed) |

> **Before publishing:** confirm the licence terms for the third-party assets.
> MediaPipe ships under Apache-2.0, Poly Haven publishes under CC0, and Google
> Fonts families are normally OFL — but none of that has been verified against
> these specific files here. Check them, add the attribution each requires, and
> add a `LICENSE` for your own code. The two fonts are self-hosted rather than
> linked, so their licences travel with the repo.

## Status

A working prototype, desktop browsers. Known gaps are listed at the end of
`NOTES.md` — the largest is that the try-on lens can't refract what's behind it
until the camera feed is drawn as the scene background rather than as a video
element behind a transparent canvas.
