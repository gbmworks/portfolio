# Eyewear builder — engineering log

Working notes for me, not the README. Every numbered trap below cost real time
once; the point of writing them down is to not pay twice.

Desktop-browser configurator: design a frame from its shape keys, then try it
on through the webcam at true measured size.

```bash
npm install
npm run dev       # http://localhost:5180
npm run build
```

`?demo` in dev loads MediaPipe's canonical face and completes a scan with it,
so the measurements and the shape read-out can be reviewed without a camera:
<http://localhost:5180/?demo>. The fixture is `public/tools/canonical_face_model.obj`.

A few notes below compare against a sibling project (`random/configurator`)
that this repo does not contain. Those references are kept because the *fact*
is still the reason a decision was made here — the R3F warning in particular.

---

## Where this was left

Working, verified, and ready to move. 42 source modules, all reachable; no dead
CSS; `tsc -b`, `vite build` and the design detector all clean. About 6.4 MB
without `node_modules`, `dist` or the generated `public/wasm/`.

**Verified by measurement, not by eye:** the price ceiling (all 14,400
configurations under ₹4,000), the morph pipeline through mirror, subdivision
and the left/right split, the UV unwrap arriving byte-identical to the source
accessor, every text colour against the 4.5:1 floor, the camera framing and
per-view memory, and the sound intervals.

**Not verified, and worth your eye first:**

- **The try-on has never been seen on a real face.** Every fix there — the
  temple wire following splay, the metal groups, the tortoise map, the lens
  alpha — was checked by reading material and scene-graph state, because this
  machine could not drive a webcam. The values are provably right; how the
  whole thing reads on camera is not something I could judge.
- **Licences are unconfirmed.** MediaPipe is normally Apache-2.0, Poly Haven
  CC0, Google Fonts OFL — none of it checked against these specific files, and
  there is no `LICENSE` for the project's own code yet. The README says so.

**Open decisions, deliberately left alone:**

- The camera view button reads **"3D"**, not "3D view", because the left rail
  already has a "3D view" mode button and two identical labels on one screen is
  a real problem. Change it if you disagree.
- The **turntable runs on arrival** as well as after five seconds of stillness.
  Because it moves the camera, letting it run and *then* pressing "3D" snaps
  back — that is the reset working, not a framing bug. Dropping the arrival
  pass is a one-line change if it annoys.
- `ColourStudio` stayed in after being built as a tool for choosing the
  palettes. It is removable by deleting that file and the three `customColour`
  fields; nothing else reads them.

---

## Repository layout

```
public/           only assets the app actually references
  frames/         final.glb — the one source model
  hdri/           empty_warehouse_01.hdr — lighting only, never a backdrop
  textures/       tortoise.png
  models/         face_landmarker.task
  tools/          canonical_face_model.obj — the ?demo fixture
  materials.csv   the material table, editable without a rebuild
  wasm/           GENERATED, gitignored — see below
scripts/
  sync-wasm.mjs   copies MediaPipe's runtime out of node_modules
src/              39 modules, all reachable from main.tsx
```

**`public/wasm/` is generated, not committed.** It has to be served from our
own origin — the scan runs on the customer's machine, and pulling the tracker
off a CDN would quietly undo that — but it is 34 MB and a byte-for-byte copy of
a published npm package. Checked in, it silently goes stale the moment the
dependency is bumped. `predev`/`prebuild` regenerate it. If the scan dies with
a missing-file error, that script has not run: `npm run sync:wasm`.

Purged when this repo was cut: three superseded frame models (`1.fbx`,
`hooper.fbx`, `hooper.glb`), a second unused HDRI, two unused acetate textures,
and the vendored wasm — about 45 MB. The repo is ~6 MB without `node_modules`.

### Dropping this into another project

Portable as it stands -- **every runtime asset path goes through
`import.meta.env.BASE_URL`**, and there is not one absolute or machine-specific
path in `src/`. Checked, not assumed.

**What has to travel together**

| | |
| --- | --- |
| `src/` | 42 modules, all reachable from `main.tsx` |
| `src/fonts/` | Boldonse and Schibsted Grotesk, imported by `styles.css` |
| `public/` | frame, HDRI, texture, `materials.csv`, landmarker model, demo fixture |
| `scripts/sync-wasm.mjs` | regenerates `public/wasm/`, wired to `predev`/`prebuild` |

Deps: `three`, `react`, `react-dom`, `zustand`, `@mediapipe/tasks-vision`.
Nothing else -- no UI kit, no animation library, no audio files.

**Five things that will bite**

- **Serving under a sub-path** (`/eyewear/` rather than `/`) needs only Vite's
  `base` set. Everything downstream follows from `BASE_URL` -- the model, the
  HDRI, the textures, `materials.csv`, the landmarker model and the wasm
  directory. Hardcoding a leading `/` anywhere is the way to break this.
- **`public/` has to travel with `src/`.** Those assets are fetched at runtime,
  not bundled, and nothing warns when one is missing until the feature that
  needs it is opened. The **fonts are the exception** -- they live in `src/` so
  the bundler hashes them and rewrites the URLs, which is what keeps a
  sub-path deployment working.
- **`scripts/sync-wasm.mjs` resolves `node_modules` as `../node_modules`
  relative to itself.** Under a monorepo that hoists dependencies to the
  workspace root there is no local `node_modules`; the script exits with a
  message rather than half-copying. Point it at the hoisted path. If the scan
  dies with a missing-file error, this is why.
- **`styles.css` sets global rules** -- `:root` custom properties, a `*` reset,
  `html`/`body`, and the browser surfaces (selection, caret, scrollbars, focus
  ring). Fine standalone, a collision inside a host that has its own reset.
  Scope the file under a wrapper class, or accept that it restyles the host.
  `main.tsx` imports it and does nothing else but mount `<App />`.
- **`src/ui/sound.ts` builds an `AudioContext` on first use.** It is created
  lazily inside a click for a reason: one made before a user gesture starts
  suspended under every browser's autoplay policy. If the host wraps controls
  in something that calls handlers outside a real gesture, the first cue is
  silent. Nothing in that module may ever throw into the UI.

**Where the seams are**

- `state/store.ts` holds one `Configuration`; the editor and the try-on are two
  renderers of it. That is the integration point -- a host that wants to drive
  the design programmatically does it there, not through the components.
- `editor/options.ts` is all the product truth: palettes, lens types, metals,
  pricing. No three.js in it, so it can be imported by a server or a cart.
- `editor/acetate.ts` is the one place a colour becomes a material, shared by
  both scenes deliberately (trap 53).
- `public/materials.csv` is editable without a rebuild and is the intended
  place to retune the look.

**Unused exports that are deliberate.** A dead-export scan flags 14. All are
intentional: the `face/landmarks.ts` index tables are a reference set and are
worse half-complete; `buildMirrorMap` is the offline generator that produced
`mirrorPairs.ts` (see trap 19) and documents where that table came from; and
`disposeLandmarker` / `disposeSilhouette` / `clearShapeCache` are real resource
ownership. Nothing else is unreachable — checked from `main.tsx`.

---

## What it does

1. **Landing** → **Editor** is the main route, with **3D try-on** beside it.
   The scanner has no entry of its own: it lives inside the try-on, because
   scanning is not an errand, it is how the try-on learns your proportions.
   The **Measurements** tab appears only once a scan exists.
2. **Guided scan.** Look straight ahead, turn left and right, tip up and down.
   Poses are binned by yaw and pitch; each bin counts once.
3. **Measurements.** The face as numbers in millimetres -- PD, head width,
   face width and length, ear depth -- plus its shape as one of eight types or
   a blend of two. This replaced a line-drawing portrait of the face, which
   looked uncanny however it was drawn; the numbers are what the fit actually
   uses, and they are honest about their own precision.
5. **3D try-on.** Live tracking, a depth-only head mask that hides the far
   temple, and fit controls: size, height, down-the-nose, vertex distance,
   pantoscopic tilt, temple splay, and an align-to-ears solve.

---

## There is no ARKit on the web — this is its counterpart

MediaPipe's `face_landmarker` returns the same three things ARKit's face anchor
does: a dense 3D mesh (478 points, irises included), a 4×4 head transform, and
the 52 ARKit-named blendshapes. On-device, no upload. The wasm runtime and the
`.task` model are both served from `public/`, so the first scan does not wait
on a CDN and the app works offline.

---

## The decisions worth knowing

**Why the scan asks you to move.** A single frontal frame is one viewpoint's
monocular depth guess, and it compresses exactly what eyewear depends on:
bridge depth, ear position, temple length. Samples are rectified into
head-local space and averaged across bins, which cancels most of that error
rather than baking one viewpoint's distortion into the result.

**Scale comes from the iris.** 11.7 mm across in almost every adult — the same
reference optical dispensing software uses. Everything downstream (PD, frame
width, the mm space the frame and the face are both measured in) hangs off it.

**Widths are sampled at anatomical heights, not at fixed landmark indices.**
The shape guides say "the widest point of the forehead", and no single
MediaPipe index sits there on every face — on a low hairline the index that
worked lands in hair. `measure.ts` interpolates the face contour at "halfway
from brow to hairline" instead, which measures the same anatomy on everyone.

**The classifier is soft-scored, and anchored to a measured average.** The
classic guides are decision trees of hard thresholds: a millimetre either side
of a cutoff flips the category, and no face is ever between two shapes — which
real faces usually are. Here each shape is a point in a five-dimensional ratio
space, scored by weighted distance and softmaxed, so "a mix of oval and heart,
roughly 45/30" is expressible. The `oval` archetype is not a guess copied from
a styling guide: it is MediaPipe's canonical face model run through this exact
measurement code. Every other shape is that average displaced along the axes
its name describes.

There is **no maintained npm package** for face-shape classification. The two
open implementations worth knowing about are
[MartinSaraka/face-metrics](https://github.com/MartinSaraka/face-metrics) (MIT,
MediaPipe-based, advertised as `@becometen/face-metrics` but never published to
the registry — `npm view` 404s) and
[edrfhhokmjun-cmd/face-shape-data](https://github.com/edrfhhokmjun-cmd/face-shape-data).
Both rest on the same four measurements, so this implements that directly
rather than vendoring an unpublished dependency.

**The face and the frame share one unit.** That is the whole trick: a 140 mm
frame front meets a face measured in the same millimetres, so what you see is
the fit you get — not a frame scaled to "look about right".

**The frame is anchored to unprojected landmarks, not to MediaPipe's transform
matrix.** The matrix is fitted in a camera space whose intrinsics we would have
to match exactly, and any mismatch shows up as glasses drifting off the nose as
you lean in and out. Unprojecting the landmarks through *our* camera makes the
anchor agree with the video by construction, and still gives true perspective
because each landmark is unprojected at its own depth. Verified: `worldPerMm`
is constant to four decimal places across ±35° of yaw.

**The video is not in the 3D scene.** A plain `<video>` behind a transparent
canvas, both mirrored by one CSS transform. No per-frame texture upload, and
the 3D layer never has to know the view is flipped.

---

## Traps already hit here — do not re-learn these

1. **The source FBX is already Y-up, with +Z out of the face.** The sibling
   configurator's notes describe the *Rhino* convention for the same files
   (X across, +Y into the head, Z up) and rotating to match it lays the frame
   on its side. Measured: `FRAME` spans 7.54 × 2.68 × 0.87 and the arms run
   from z +3.1 back to −3.8. No axis conversion is needed or wanted.

2. **Part names do not tell you which side a part is on.** `LEFT_ARM` sits at
   *negative* x. Anything that pairs an arm with an ear, or picks a rotation
   sign, must read the hinge's own x. Trusting the name made the splay solve
   silently no-op, because it was reaching for the opposite ear and giving up
   as out of range.

3. **Absolute scale in the source models is not trustworthy** (confirmed by the
   sibling project: two batches, ~75 mm and ~135 mm of front width in file
   units). The front is measured on load and rescaled. Shape is the data; size
   is not — which is why the size slider's range is deliberately wide.

4. **Anchoring a frame at the bridge saddle puts it over the eyebrows.** The
   saddle is most of the frame's depth below the top rim. What a dispenser
   actually sets is the pupil at or just above the lens centre; `initialFit`
   solves for that, and it is the difference between glasses and a mask.

5. **A frame front is narrower than the head, so arms with zero splay pass
   through the skull** — and the head mask then dutifully culls the *near* arm
   along with the far one. The initial fit solves splay onto the ears.

6. **The skull proxy's half-width is the sensitive number** (`SKULL` in
   `occluder.ts`). A temple runs only a few millimetres outside the skin it is
   meant to hide behind. 0.52 of head width ate the near arm; 0.44 leaves the
   far arm culled and the near arm intact. Occluder bugs are invisible by
   construction, which is why the try-on panel has an On / Show / Off toggle.

7. **Feeding the tracker repeated timestamps stalls the One Euro filter.** With
   `dt` pinned at the 1 ms floor, each update moves ~0.7% toward the new value.
   Real frames are fine; a test that reuses one timestamp will render a pose
   that never arrives and look like a scale bug.

8. **Marching squares on a rasterised mask must be smoothed before it is
   simplified.** Simplifying first locks the single-cell stair steps in as real
   corners, and the top rim of a frame is exactly the near-axis-aligned edge
   that produces them.

9. **Camera sharing must pair every acquire with exactly one release.** The
   stream is reference counted with a 4 s grace period so moving between Scan
   and Try-on does not restart the camera. A *double* release is the dangerous
   direction, not a leak: it drops the count to zero while a live view still
   holds the stream, and the grace timer then stops the tracks underneath it.
   The symptom is a picture that works for a few seconds and then goes black
   with the face reported lost. StrictMode's mount/unmount/mount is what
   exposes it -- the first mount's cleanup released, and so did its still
   pending `getUserMedia` continuation. Concurrent acquires must also share one
   in-flight promise, or two mounts in the same tick open two cameras and
   orphan one.

10. **rAF is fully suspended while the tab is hidden**, so the scan freezes
    with no error. The loop now runs on `requestVideoFrameCallback` (once per
    *decoded* frame rather than per display refresh -- on a 120 Hz screen rAF
    handed the landmarker the same image four times), and a `visibilitychange`
    listener reports the pause. The listener is also fired once on attach,
    because the event only reports a change and a scan can start in a
    background tab. Worth knowing when testing through automation: a driven
    tab is usually `hidden`, so detection legitimately never runs.

11. **Never mutate a cached geometry to position a part.** `setFrame` used
    `geometry.translate(-hinge)` to move a temple onto its pivot. Geometries
    are cached per frame file and shared by every `ARScene`, so a second scene
    -- StrictMode's remount, or simply revisiting the try-on -- translated the
    same buffer again and both arms flew off by twice the hinge offset. They
    appear as two detached temples floating at the edges of the video. Position
    the *mesh*, not the geometry.

12. **Solve the mirror pairing offline, not against the measured mesh.** The
    measured mesh is symmetrised by averaging each point with its mirror
    partner. A
    greedy nearest-reflection search over the measured mesh lets an early index
    claim a partner a later one needed; the loser is then treated as a midline
    point and has its x crushed toward zero. With both iris centres losing, the
    eyes were drawn on the bridge of the nose. `mirrorPairs.ts` is now a
    constant derived from the canonical model: 440 pairs, 28 midline, none
    ambiguous.

13. **Width measurements must come from the frontal frames only.** Turning the
    head is what makes the *depth* numbers real, but it makes widths worse --
    at yaw the far tragion is partly self-occluded and its estimate creeps
    inward. A real scan returned a 125 mm head width against a 63 mm PD, a
    ratio no adult head has. `aggregate()` returns a frontal-only average
    alongside the pose-averaged one; lateral spans come from the former,
    depths from the latter.

14. **Size the frame from the PD, not the head width.** Same reason: the PD
    comes off the irises, the best-conditioned measurement in the set, while
    the head width comes off the worst. 2.2 x PD spans the stock range.

15. **The head outline is traced, not drawn from landmark indices.** It goes
    through the same offscreen-render-plus-marching-squares path as the eyewear
    silhouette (`traceSilhouette`), over the face mesh unioned with a cranium
    ellipsoid. Two things to know if you touch it: MediaPipe's tessellation
    leaves the **mouth open**, so the trace returns a second contour that an
    even-odd fill renders as a hole in the chin -- keep the largest contour
    only; and the cranium's widest point must sit above the brow (the parietal
    bulge), because centring the ellipsoid on the brow line puts the widest
    point at the base of the dome and the whole head reads as an egg.

16. **Do not derive the hairline from MediaPipe's brow landmark.** The canon
    says hairline-to-brow is half of brow-to-chin, but landmark 105 sits on the
    eyebrow *hair*, about a centimetre above the glabella the rule is measured
    from. Using it put the hairline 25 mm below the crown and the hair filled
    as a skullcap. Measure down from the crown instead: vertex to trichion is
    about a fifth of head height, and it only uses the irises and the menton.

17. **`applyMatrix4` does not transform morph targets.** `BufferGeometry`
    transforms `position` and `normal` and leaves `morphAttributes` alone, so
    a frame loaded, rescaled and recentred keeps shape keys still expressed in
    the original file's space -- and selecting one flings the geometry back to
    it. `applyMatrixWithMorphs` handles both, taking rotation and scale only
    for relative (delta) targets and the full matrix for absolute ones.

18. **Shape selection is baked, not driven by influences.** The choice is
    discrete -- one of eight, never a blend -- so there is nothing to
    interpolate, and baking means the try-on and the silhouette tracer that
    draws the wheel icons consume the identical mesh. Driving
    `morphTargetInfluences` would leave the tracer, which renders geometry
    with no mesh around it, showing a different shape from the one on the
    customer's face.

19. **Never finish a loaded part with `computeVertexNormals()`.** FBXLoader
    returns non-indexed geometry, so it computes one normal per triangle
    corner from that triangle alone: every face gets a constant normal and the
    whole frame renders faceted. It also discards the normals the exporter
    authored. `smoothNormals` welds by position and averages face normals
    across pairs below an angle threshold, so the rim curves while the bevels
    and the lens groove stay crisp.

20. **A weighted morph bake is a lerp, not a scale.** Relative targets are
    deltas and scale linearly, but *absolute* targets are positions -- so a
    weight has to be applied as `base + (target - base) * w`. Multiplying an
    absolute target by its weight collapses the mesh toward the origin at any
    influence under one.

21. **`computeBoundingBox()` includes the morph targets.** It deliberately
    expands the box to cover every target so frustum culling still works at
    full influence -- which makes it the wrong tool for *measuring* a product.
    The union of all eight shapes here is 224 mm across where the frame is
    140, which fooled the unit detection into deciding the file was not in
    metres and squashed the whole frame to a nominal width. Anything that
    describes the thing being sold reads `baseBounds()` instead.

22. **glTF splits a node into one mesh per material.** The temple is one
    object in Blender and arrives as a Group named `temple` holding meshes
    called `Front002` and `Front002_1`. Matching on `mesh.name` routes both to
    the *front* -- they start with it -- and the front ends up 300 mm deep
    with the arms fused in. Match on the top-level node, which is the name the
    designer actually gave the object.

23. **Mirroring has to carry winding, normals and morph targets.** Positions
    alone leaves every mirrored face pointing inward and lit from the wrong
    side; forgetting the targets leaves them shorter than the positions they
    drive, and every vertex past the old end bakes to NaN -- which renders as
    nothing at all, with no error.

24. **Subdividing a morph-target mesh means subdividing the targets too.**
    Every Loop rule is an affine combination -- its weights sum to exactly 1 --
    so subdivision is a linear map and
    `subdivide(base + delta) === subdivide(base) + subdivide(delta)`. Running
    the same weights over each target's deltas keeps the shapes aligned.
    Subdividing the base alone leaves targets a few hundred vertices long
    against a mesh of several thousand, and everything past the end bakes to
    NaN. Also weld first: an exported mesh is split at every material and UV
    seam, and unwelded islands subdivide separately and tear.

25. **The head mask is a sphere, not an ellipsoid.** Three separately tuned
    radii had to agree with each other, and any one of them being wrong showed
    as the mask reaching through the brow or the chin. A head is close enough
    to spherical above the jaw that one radius fitted to the measured width
    does the job, and there is one number to be wrong about instead of three.

26. **A drag ring and its buttons cannot be the same ring.** The shape wheel
    had the icons sitting on the track, so a pointer-down was both "choose
    this shape" and "start dragging here" -- every drag began by jumping to
    whatever icon was under the cursor. The icons now sit on a larger ring and
    stop propagation; the track is the only draggable thing.

27. **Never re-frame the camera on a geometry rebuild.** Changing a shape
    rebuilds the mesh, and re-running the framing logic there threw away
    whatever the customer had orbited to: pick a bridge from the side view and
    the camera snapped back to the canonical angle. The camera is placed once
    and moved only by an explicit view change; `setFrame` updates the orbit
    target and nothing else.

28. **A texture needs UVs that survive the whole pipeline.** The loader strips
    them to save memory, and neither the mirror nor the subdivision carries
    them, so a map sampled one texel and the frame rendered flat. Rather than
    thread UVs through both and weld across UV seams, the front gets a planar
    projection generated after subdivision -- which is also physically right,
    since acetate is milled from a flat sheet and the pattern on a finished
    frame *is* the pattern that was in the sheet.

29. **The shape icons are traced, not drawn.** Each one is the real front
    silhouette for that shape, through the same `traceSilhouette` path the
    frame overlay uses. Hand-drawn glyphs were guesses that had to be redrawn
    whenever a shape key changed and never quite matched what selecting them
    produced. All eight share one viewBox computed across the set, so an
    Aviator reads as deeper than a Rectangle because it is. Fill them rather
    than stroke: a contour in millimetres shrunk to thirteen units either
    loses its stroke entirely or, with `non-scaling-stroke`, is swamped by it
    -- and an even-odd fill gets the lens apertures for free, which is most of
    what tells the shapes apart.

30. **De-indexing must move every attribute, not just positions.**
    `smoothNormals` swapped in the non-indexed positions and left the old UV
    array behind, so a morphed front had 53,760 positions against 8,960 UVs
    and the tortoise map sampled nonsense. The basis shape looked fine because
    it never goes through the bake. `bakeShape` now uses `computeVertexNormals`
    instead -- on indexed geometry that already averages across shared faces,
    which is the smooth normal wanted, and it keeps the index so the UVs stay
    aligned.

31. **`scene.background` does not work under an orthographic camera.** three
    draws an equirectangular background on a *unit* cube pinned to the camera.
    Under perspective that surrounds the eye and fills the view; under an
    ortho camera whose frustum is hundreds of units wide it covers almost
    nothing and the rest renders black. The backdrop is drawn as geometry
    instead, which both camera types can see -- first as a large inward-facing
    sphere, now as a screen-space quad; see traps 37 and 38 for why the sphere
    did not survive either.

32. **Alpha blending cannot make glass.** Opacity multiplies the *whole*
    shaded result -- the specular highlight along with the body -- so a lens
    faded that way loses exactly the thing that reads as glass and ends up
    looking like cellophane. `transmission` keeps the surface fully lit and
    lets light through the volume instead. The clear lens is opaque to the
    blender (`transparent: false`, `opacity: 1`) with `transmission: 0.98`;
    the tinted ones still use opacity, which is right for them because a sun
    lens really is a filter rather than clear glass.

33. **A click after an orbit drag is not a pick.** Releasing a rotate fires a
    `click` on the canvas, and treating it as a part selection jumps the panel
    to whatever the pointer happened to land on -- so turning the model to
    look at the temples throws you out of the step you were editing. The
    handler now compares the pointer against where it went down and ignores
    anything that moved more than a few pixels.

34. **The bridge has to follow the front it is attached to.** It carries its
    own four shape keys and knows nothing about the front's eight, so it sat
    at one fixed height while the nose cut-out moved underneath it -- the top
    edge of that cut-out runs from 4.2 mm on the cat-eye to 8.3 mm on the
    oval. `alignBridge` re-anchors it: whatever relationship it has to the
    cut-out on the basis shape is the one it keeps on all of them, and the
    1.6 mm by which the authored bridge stands proud of the front's face is
    taken out at the same time. Clone before translating -- `parts.bridge` is
    the *shared* original whenever no bridge morph applies, and moving that
    walks the bridge off the frame one shape change at a time.

35. **Frame a view with the bounding box, not the bounding sphere.** A frame
    is 140 mm wide, 45 mm tall and 5 mm thick, so its sphere is nearly as tall
    as it is wide; fitting to it wastes most of the height and every view
    opened far too wide. `screenExtent` projects the box's eight corners onto
    the camera's own right and up axes instead.

36. **Heredocs with apostrophes break the Bash tool here.** Use the Write tool,
   or a Python script file, for any non-trivial edit. (Same trap as the sibling
   project's note 9.)

37. **An equirectangular backdrop always has a seam and two pinched poles.**
   They are properties of wrapping a rectangular image onto a sphere, not of
   the image, so no amount of blurring removes them: the seam showed up in the
   side view and the poles as concentric rings in the top view. A generated
   ramp has neither, because there is nothing to wrap.

38. **A backdrop sphere shows a camera only as much gradient as its frustum
   spans in *degrees of latitude*.** These cameras span almost none -- the
   80 mm view about thirteen degrees, the orthographic views barely one over a
   2600 mm sphere -- so a latitude ramp rendered as a flat fill in every view,
   and as a *different* flat fill in each, the front around #d0d0ce against the
   top's #9e9e9b. Backdrops that must look the same from several fixed camera
   angles belong in screen space: a `PlaneGeometry(2, 2)` whose vertex shader
   writes `gl_Position = vec4(position.xy, 1.0, 1.0)`, ignoring the camera,
   with `depthTest: false` and `renderOrder = -1`. Gradient measured in screen
   height, identical from every view, no geometry to go wrong.

39. **A raw `ShaderMaterial` writes to the framebuffer unconverted.** three
   injects the tone-mapping and output-colour-space chunks into its *built-in*
   shaders only, so a custom fragment shader's `gl_FragColor` lands as written.
   For the backdrop that is the desired behaviour -- sRGB values emitted
   literally, which is what makes it a usable neutral reference -- but it means
   a `ShaderMaterial` and a `MeshBasicMaterial` given the same colour will not
   match.

40. **`setFocalLength` depends on the aspect ratio, so it must be re-applied on
   resize.** three derives the field of view from `filmGauge / max(aspect, 1)`,
   so a plain `updateProjectionMatrix()` after changing `aspect` silently keeps
   the old angle and changes the lens. `setSize` calls `setFocalLength` instead.
   With `filmGauge = 36`, 80 mm gives the 25.4-degree horizontal field of a
   full-frame 80 mm lens.

41. **glTF splits a node into one mesh per material, so a two-material object
   arrives as two meshes with the same node name.** The arm is one object
   called `temple` carrying an acetate material and a `metal` one -- the wire
   through it -- and routing parts by name put both in the same slot, where
   the second silently overwrote the first. The wire was simply absent from
   the product, with nothing logged. The material name is the discriminator,
   because it is the thing that actually differs (`METAL_MATERIAL` in
   `loadFrame.ts`). Trap 26 is the same fact biting from the other side: match
   the *node* name, not the mesh name, but then expect several meshes under it.

42. **A dropped morph target does not fail, it no-ops.** `halfBySign` builds a
   fresh `BufferGeometry` rather than masking the original, so anything not
   explicitly copied is gone -- and it was dropping `morphAttributes`
   entirely. `bakeShape` then finds nothing to apply and hands back the base
   shape, so the design buttons light up and the arm never moves. Harmless
   while the temple had no keys; invisible the moment it had four designs.
   Anything that rebuilds geometry vertex-by-vertex has to carry the morph
   targets through the identical loop. (`toNonIndexed()` does handle them;
   hand-rolled filters are where they vanish.)

43. **A price ceiling is an invariant across every table, which no single edit
   looks like it breaks.** `maxConfiguredTotal()` derives the worst case from
   the price tables themselves and a DEV-only check compares it to
   `PRICE_CEILING`, so the guard still means something after someone bumps one
   number. Do not clamp the total instead: clamping prices two different
   configurations the same and makes an upgrade look free.

44. **A field that one renderer ignores is still read by the other.** Moving
   the editor's clear lens onto `transmission` left `LENS_TYPES.clear.opacity`
   as a placeholder `1`, because the editor's glass path sets opacity itself
   and never looks at it. The try-on does look at it -- it has no transmission
   path -- so it rendered the clear lens as a **fully opaque grey card**, and
   nothing failed. `opacity` is now the real alpha for the blended fallback
   (0.12) and the glass path keeps overriding it. Before parking a dummy value
   in shared data, grep for the other consumers.

45. **Transmission refracts the *scene*, and in the try-on the scene is the
   frame alone.** The camera feed is a video element behind a transparent
   canvas, so it is not in the transmission buffer: a transmissive lens there
   samples nothing and goes dark. three's volume shader also scales
   `thickness` by world scale, and the try-on group is scaled by thousandths,
   which collapses the optical path independently. Turning transmission on in
   the try-on means drawing the feed as the scene background first -- both
   have to change together.

   What *does* transfer from three's `webgl_loader_gltf_transmission` example
   without refraction is everything around it: a real `ior`, full
   `specularIntensity`, a tight clearcoat, and above all an **environment to
   reflect**. A lens with nothing to reflect has no highlights, and highlights
   are most of what reads as glass. The try-on now loads the editor's HDRI for
   reflections only -- turned down to `ENV_INTENSITY` 0.25 on the acetate, so
   the original reasoning against an environment (a frame worn in the
   customer's room reflecting a studio looks pasted on) still holds for the
   body, and up at 1.35 on the lens where it is wanted.

46. **UVs cannot go through Loop subdivision the way positions do.** Two rules
   that are right for geometry are wrong for a texture coordinate:

   - *Welding by position* merges the two sides of a UV seam onto one
     coordinate, smearing the texture across it. The front has 46 such
     positions out of 280.
   - *Loop's smoothing masks* pull the parameterisation inward, distorting
     what the artist unwrapped.

   So UVs ride as **face-corner** data and subdivide **linearly** -- each new
   corner is the midpoint of the two it lies between -- which reproduces the
   base cage's mapping exactly at any level. Seams need no special handling:
   the faces either side hold different coordinates, so their midpoints differ
   and they stay apart on their own. The welded mesh is then re-split by
   `(vertex, uv)` at the end.

47. **Split a vertex for the texture and you crease the shading.**
   `computeVertexNormals` averages per *index*, so after the seam split each
   side of a seam only sees its own faces and the surface picks up a hard edge
   that is not in the model. Normals are therefore computed on the **welded**
   mesh and copied out to the split vertices (`weldedNormals`), and
   `bakeShape` -- which recomputes normals after morphing -- heals them again
   with `weldNormals`. A texture seam is not a crease.

48. **`planarUvs` is now a fallback, not the plan.** It projected the frame
   flat and ignored how the piece is shaped, which is what made the tortoise
   read as a pattern sliding over the front rather than cut into it. `Final.glb`
   carries a real unwrap on every primitive, and that is what is used --
   threaded through the mirror, the subdivision and the left/right split, and
   verified end to end: the front arrives at `u[0.100,0.962] v[0.012,0.984]`,
   identical to the source accessor. With a real unwrap, **`mapRepeat` must be
   1**: the coordinates already lay the piece out across the whole square, so
   repeating is exactly the manipulation they exist to avoid.

49. **Adding a part means revisiting every `switch` and `if/else` that routes
   parts.** The temple wire was added to the loader and picked up by the
   editor automatically -- it reads metalness off the CSV -- but the try-on
   routes parts by hand in two places, and both had a trailing `else`/
   `default` that quietly swallowed the new key:

   - `setFrame` parented it to `fitGroup` instead of the arm pivot, so the
     splay slider swung the acetate and left the wire hanging beside it.
   - `applyAppearance` painted it in the *front's acetate colour*. The bridge
     was in the same state and had been all along -- it was never listed, so
     the try-on had been rendering a plastic bridge.

   Both are now lookup tables (`ARM_PIVOT`, `METAL_PART`) rather than cases, so
   a part that is missing from one is missing visibly rather than being
   absorbed by a fallback. Verified by swinging the pivots and measuring: all
   four arm parts move 14.67 mm together.

50. **The try-on ignored the metal choice entirely.** `appearanceFor` never
   set `metalColour`, so it kept the `#b8a06a` default from the appearance
   constant whatever the customer picked -- the one choice the editor could
   not show them on their own face. It now carries both groups as
   `{hex, roughness}`, because a finish is both: polished silver and brushed
   gunmetal are not one material in two tints.

54. **A display face's metrics can be nothing like a text face's, and the
   difference is measured, not guessed.** Boldonse draws ink **1.49em** tall
   where a normal grotesque draws 0.94em, and reports a natural line box of
   **1.92**. Two consequences, both of which bit on the first render:

   - `line-height: 0.96` -- a perfectly ordinary display value -- overlapped
     consecutive lines by a full line. It needs roughly **1.6**.
   - A "74px" heading renders as large as a 110px normal face. Every display
     size in the sheet looks small written down because it is scaled for ink,
     not for the number.

   Measure with `measureText().actualBoundingBoxAscent/Descent` before
   choosing either value. The same mismatch is why Boldonse loads
   `font-display: block` rather than `swap`: a fallback shown for 100ms is a
   headline at two thirds the size that reflows when the real face lands.

55. **On-demand rendering plus an async texture equals a stale frame.** The
   editor draws only when something changes, and `TextureLoader.load()` was
   called with no `onLoad`. A map that resolved *after* the frame it was
   assigned in was simply never shown: the acetate kept its previous
   appearance until an unrelated interaction happened to trigger a redraw.
   Picking tortoise, seeing the old colour, clicking elsewhere and *then*
   seeing tortoise reads exactly like the material flickering between
   choices. `onTextureLoad` now invalidates the frame. Anything that renders
   on demand must be told when an async asset lands.

56. **`needsUpdate` throws away the compiled shader.** It was being set on
   every material on every config change, so each click recompiled all eight
   -- the lens's transmission program included, which is the most expensive in
   the scene. Colour, roughness and opacity are *uniforms* and need no
   recompile; only map presence, `transparent`, `transmission > 0`, clearcoat
   and flat shading select a different program. `programKey()` compares before
   and after and sets the flag only when it actually changed.

57. **`tabular-nums` widens the separators too.** Every glyph gets one width,
   the comma and the point included, so a lone price renders as "2 , 350".
   It is the right trade only where numbers stack in a column -- the price
   breakdown, the measurement grid -- and wrong for any single figure.

58. **`overflow-y: auto` clips the other axis too.** The active-step marker sat
   at `left: -22px` to reach the rail's edge and was invisible, because a
   computed `overflow-y` of `auto` forces `overflow-x` to `auto` as well.
   Anything bleeding outside a scrolling container has to be positioned inside
   it, or hung off an ancestor that does not scroll.

59. **Two writers to one material property will disagree, and the second one
   wins at the worst time.** This was the real cause of the lens flicker;
   traps 55 and 56 were genuine defects found while hunting it, but neither
   was it.

   `setHighlight` ghosted every part a hovered step did not own, by writing
   `opacity` and `transparent` straight onto the materials. On hover-*out* it
   restored them from the **CSV row** -- the only state it knew about --
   rather than from `paint`, which is what actually decides how a part looks.
   For the clear lens the CSV says `0.10, transparent` while `paint` says
   `opacity 1, transmission 0.96`. So every pass of the cursor across the step
   list left the lens rendering as a 10%-opaque ghost until some later config
   change happened to repaint it.

   That is why it looked like the lens flickered between the default, the real
   material and the previous selection: it was tracking the **mouse**, not the
   choices, which is why clicking through customisations appeared to cause it.
   The feature is gone. Anything that wants a part shown differently goes
   through `paint` -- the one place that knows the answer -- and never writes
   the same properties alongside it.

60. **The basis shape still carries its morph targets, and that moved the
   camera.** `resolveShape` hands back the *original* geometry untouched when
   no morph applies, and bakes a clone with `morphAttributes = {}` when one
   does. So the basis -- Design 1 on the arms, Cat-eye on the front -- is the
   only option whose `computeBoundingBox()` is inflated to cover every target
   it could reach. Measured 12 mm taller and 12 mm longer than the designs
   either side of it, which moved the framing centre, which moved
   `controls.target`: picking the first design panned the camera and the
   others did not. This is trap 10 in a second place. Anything measuring a
   part for *framing* wants `baseBounds`, never `boundingBox`.

61. **Re-aiming the camera on every geometry swap turns real differences into
   drift.** Shapes differ in height by a few millimetres, so following the
   centre slid the product a little on each change -- and the wheel resolves a
   new blend per pointer move, which made it continuous. The one thing anybody
   is doing at that moment is comparing silhouettes, which needs them to sit
   still and differ only in shape. `setFrame` now measures without aiming;
   `frame()` owns aiming, and the view buttons still re-centre on demand.

62. **A turning view cannot be framed by what it looks like from one angle.**
   The bounding sphere is the reflex and it is far too generous: it uses the
   full 3D diagonal for the *height* as well, and this frame is 140 mm wide,
   152 mm deep and 49 mm tall -- so it framed for a 200 mm-tall object and
   pushed the camera four times too far back. A turntable only sweeps azimuth,
   so height never changes and the width is the **diagonal of the footprint**,
   which is what the box presents broadside. Tight, and impossible to clip.

   Second correction on the same view: the two panels float *over* the stage,
   so the corridor actually visible is about two thirds of the canvas. Framing
   to the canvas put the temples under the panels. Padding accounts for it.

63. **Every timeout needs one owner.** The viewport hint tracked its sequence
   timers but let the hide-after-fade timer escape the list. A mouse move
   queued one, the idle timer then showed a hint, and the stray timer pulled it
   straight back down 400 ms later -- while the rest of the sequence ran on
   invisibly and still marked itself seen. The hint was "shown" and could not
   possibly have been read, and because it depended on mouse history it worked
   perfectly on the run where nothing moved. One `after()` helper now schedules
   everything and `clear()` is the only way out.

64. **Two panels that look alike are two panels that will stop looking alike.**
   The try-on's controls were a column in a grid with their own headings and
   spacing; the editor's were a floating window. They were never *meant* to
   differ, but nothing held them together, so every change to one widened the
   gap. Both are now built from `panel__head` / `panel__body` / `panel__foot`
   -- one head that names the surface, one body that scrolls, one foot that
   holds the way onward -- and the editor's duplicated overrides were folded
   into them. The same reasoning as trap 53 applied to layout instead of
   materials: shared behaviour needs a shared implementation, not a shared
   intention.

65. **The first `frame()` ran against a placeholder.** The canvas is sized
   before the model finishes loading, so `setSize` framed the camera against
   the default bounds this class starts with -- a box 80 mm deep where the
   real product is 152, centred 39 mm from where the real one sits -- and
   `setFrame` then never re-aimed, because trap 61 had *correctly* stopped it
   re-aiming on every geometry swap. So the editor opened at a position no
   view button could reproduce, and pressing "3D" jumped. `framedGeometry`
   distinguishes "something framed this" from "the real thing framed this";
   the first real bounds get one frame, and nothing after.

66. **Two fixes can be individually right and jointly wrong.** Trap 51 made a
   view button re-aim the scene directly as well as setting React state, so
   pressing the view you were already on would reset it. Per-view position
   memory then made "the view you are already on" mean something new. The two
   together fired `setView` **twice** per click -- once from the handler, once
   from the effect watching the state -- and the second call saw a view it was
   already on, read that as "reset", and threw away the position it had just
   restored. The handler now calls the scene only when the view is unchanged,
   which is the one case the effect cannot cover.

67. **Panels that float over a stage make the canvas a liar.** The two panels
   cover 244px and 334px of a 1920px canvas, so only 70% of it is visible and
   that corridor is 2.3% off-centre. Every view was framed to the canvas, so
   the product was sized for space it did not have and centred on a point
   nobody could see -- which is why the side view kept sliding under the right
   panel however much padding it was given. The scene now takes the measured
   insets, fits to `usableWidth`, and aims at the corridor's middle. Padding
   went back to honest numbers once it stopped standing in for this.

   Floating matters more here than in the editor. The subject is the
   customer's own face, and a video feed cropped to two thirds of the window
   by a column of sliders stops reading as a mirror.

51. **A view button that does nothing is worse than no button.** The view
   presets set React state and let an effect re-aim the scene, so picking the
   view you were *already* on changed nothing and the effect never fired --
   and by then you had almost certainly orbited away from it, which is exactly
   when you reach for it. There was no way back to the default framing short
   of a reload. The handler now calls `setView` on the scene directly as well
   as setting the state.

52. **Two sources for one colour need a stated winner.** The arms can take a
   colour three ways: a palette swatch, `match` following the front, or their
   own mixed colour. `templeColourSpec` resolves them in a fixed order -- the
   arms' own custom colour wins outright and ends the match, because mixing
   one is deliberate and the most recent act, and leaving the match live would
   let a later change to the front silently throw it away. Picking a palette
   swatch clears the custom colour, and the swatch grid deselects while a
   custom colour is live: a ringed swatch next to arms rendering something
   else is a lie about what is on screen.

53. **A colour is not a hex, and flattening it to one loses the product.**
   `FrameAppearance` carried `frontColour: string`, so `appearanceFor` did
   `frameColour(config).hex` and threw away `map`, `mapRepeat`, `translucent`,
   `transmission` and `thickness`. The try-on then rendered **tortoise as a
   near-white frame** -- that hex *is* near-white on purpose, chosen so the
   texture carries the colour, and the texture never arrived. Every
   translucent acetate came out fully opaque for the same reason. Nothing
   failed; one palette entry just looked wrong, and only from one of the two
   scenes.

   The real cause is trap 49 again from a third angle: the try-on had its own
   hand-written copy of the editor's acetate branch. `applyColour` now lives
   in `editor/acetate.ts` and both scenes call it, and `FrameAppearance`
   carries whole `Colour` objects. Surface numbers stay per-scene -- the
   try-on's frame is lit by three lights against a live room, not by a studio
   HDRI -- but the *colour* is applied in one place.

   One genuine difference stays, as an explicit option rather than a
   divergence: `applyColour(..., { transmission: false })` in the try-on,
   because there is nothing in that scene's transmission buffer to refract
   (trap 45). A tortoise that is opaque but correctly textured beats one that
   is physically right and black.

---

## Layout

```
src/
  face/
    landmarker.ts      the shared FaceLandmarker; ARKit's counterpart
    landmarks.ts       named index groups + the mirror-pair solver
    headFrame.ts       head basis from the landmarks, rectification, iris scale
    scanSession.ts     the guided capture state machine and pose binning
    measure.ts         contour-sampled measurements in millimetres
    faceShape.ts       the eight-archetype soft classifier
    useFaceTracking.ts camera plumbing, reference-counted across views
  drawing/
    shapeGlyphs.ts     the face-shape badges on the landing page
  frame/
    loadFrame.ts       glTF/FBX -> parts, normalised to mm, origin at the bridge
    mirrorX.ts         the mirror modifier: positions, winding, normals, UVs
    subdivide.ts       Loop, carrying morph targets and UVs through
    resolveShape.ts    a selection -> baked geometry, cached
    shapes.ts          the eight fronts, four arms, four bridges
    shapeIcons.ts      per-shape silhouettes for the wheel
    silhouette.ts      ortho render -> marching squares -> svg path
    useFrame.ts        load once, resolve on selection
  editor/
    EditorScene.ts     the editor stage: cameras, backdrop, painting
    materialTable.ts   materials.csv -> material specs
    options.ts         everything the customer can choose, and the pricing
  ar/
    arScene.ts         the try-on stage
    occluder.ts        the depth-only head mask
    fit.ts             fit settings, the dispensing defaults, the ear solve
    smoothing.ts       One Euro filter
  dev/
    canonicalFace.ts   the ?demo fixture
public/tools/
  canonical_face_model.obj   MediaPipe's average face, used by the fixture
```

Coordinates: **millimetres**, +X the subject's left, +Y up, +Z out of the face
toward the camera, origin at the nasion. The try-on mirrors x so the video
reads like a mirror; that flip is a CSS transform on the video and the canvas
together, never a transform on the scene.

---

## The editor

Five numbered steps -- shape, colour, lens, temple, bridge -- over a studio
viewer with orbit, view presets and click-to-select. Left rail carries the
design's name, running total and the stepper; right panel the choices for the
current step and the way forward.

A stepper rather than a pile of panels because the decisions have a real
order, and because someone who does not know what a pantoscopic tilt is still
knows what "3 of 5" means. Every step stays clickable, so it guides without
trapping anyone.

Deliberately a trimmed cut of the flowchart. The full tree adds frame
material, hardware, engraving, accessories and a prescription form; an editor
whose controls mostly do nothing visible is worse than a smaller one that is
honest. Where a control would be inert it is hidden rather than shown -- the
lens tint colour only appears for tinted lens types.

`EditorScene` is separate from `ARScene` on purpose. They share the geometry
and the colour derivation and nothing else: one owns an orbit camera, a
ground, a shadow and a picker and never sees a face. It also renders on
demand rather than on a rAF loop, because the product is static between
interactions and a permanent loop keeps a laptop fan spinning while the
customer reads the price.

The try-on's materials are **derived** from the design rather than stored
beside it (`appearanceFor`). One design, two views; a separate appearance the
editor had to remember to push across is exactly how the two end up showing
different colours.

## The editor layout

One full-bleed viewport with the panels floating over it: steps and price top
left, the current step's choices top right, the camera bar bottom centre. The
product is the subject, so it gets the room; the controls are instruments laid
on the glass rather than columns dividing the width.

**The orthogonal views are orthographic**, and every view frames the product's
own centre rather than the world origin. Both matter: the model's origin is
the bridge saddle, which sits at the top of the frame and well forward of the
temples, so orbiting the origin swings the product through the view; and
front/side/top are measurement views, where perspective is exactly the thing
that makes the judgement wrong -- tapering the far arm, bowing a straight top
rim. Only the 3/4 view is perspective.

The 3/4 view is an **80 mm lens** (`setFocalLength(80)` on a 36 mm gauge --
about 25 degrees across). That is the short telephoto a product photographer
would reach for: long enough that the near temple does not balloon toward the
camera, short enough to keep some depth. It is set as a focal length rather
than as an angle, and re-applied on resize, because three derives the angle
from the aspect ratio (trap 40).

The backdrop is **not** the HDRI. `empty_warehouse_01.hdr` lights the scene
and fills the reflections, and that is all it does; what you see behind the
product is a generated grey ramp painted in screen space -- light at the top,
a little darker at the bottom, with a slight corner fall-off.

It went through the HDRI first (a photograph behind a 140 mm object reads as a
pasted-on composite, so it was blurred and desaturated) and then through a
sphere carrying a generated ramp. Both failed for reasons in traps 37 and 38.
Screen space is the version that works, and it is also the honest one: a
studio backdrop is a seamless behind the subject, not a room. It looks
identical from all four views, which is the point -- a colour judged in the
front view has to still be that colour from the side.

## The interface

**An optician's instrument, typeset like an editorial.** The original sheet was
quiet everywhere, for a reason that only ever applied to half of it: the thing
being judged is a product whose *colour* is the decision, so the viewport and
anything within a glance of a swatch stay neutral. A tinted surface beside an
acetate chip is a lie about the acetate. That still holds.

What changed is where the character lives -- the landing headline, the design's
name, the empty rail, all of which compete with nothing. Boldonse set large and
tight against Schibsted Grotesk, real depth instead of hairlines, and motion
that confirms rather than decorates.

Two typographic rules worth keeping:

- **Boldonse never below 20px, and never for numbers.** It ships one weight,
  so display hierarchy is size, tracking and measure -- `font-weight` does
  nothing. Millimetres and prices need tabular figures that align down a
  column, which is the body face's job (traps 54 and 57).
- **Schibsted Grotesk, not the usual suspects.** The detector flags Inter,
  Geist, Space Grotesk and their neighbours as the faces every generated UI
  converges on, and it was right to flag the first pick. This one is drawn for
  a newspaper group: legible at 11px, figures built to be read in a column.

### Arriving

The product loads dead still, and a still render of a 3D object reads as a
photograph of one -- nothing says the view can be moved, and the arms and the
profile, which are most of the design, never get seen. So the camera makes a
slow turntable pass on arrival and again after five seconds of a still cursor,
with a two-sine wave on the elevation whose periods do not divide into each
other, so the drift never settles onto a beat the eye can lock to. That is the
difference between machinery and a hand holding something up to the light.

The hint follows the same logic one beat earlier: at three seconds it offers
"Drag to orient", then "Scroll to zoom", one at a time -- two instructions side
by side is a legend to be read, one after another is someone showing you. Words
first, demonstration second. Any pointer activity postpones both; actually
taking the camera ends them for the visit.

### Sound

`src/ui/sound.ts` synthesises every cue -- no audio files. Three reasons:
nothing ships, nothing can be caught half-loaded, and the pitch can be derived
from what the customer just did. The shape wheel walks a **minor pentatonic**
scale, so dragging it plays a run rather than firing one click eight times;
pentatonic because the customer controls the order, and any subset of those
intervals sounds intentional in any sequence. Colour is a **perfect fifth** on
sine voices -- warmer and rounder than shape without being louder. Advancing a
step **rises** where everything else falls.

Peak gain is 6% and nothing rings longer than a fifth of a second: a
configurator is used for minutes at a time, and a cue that announces itself is
one the customer mutes. The toggle is in the top bar, because the only person
who wants it has just heard something unexpected and will look where it came
from. Nothing in that module may throw into the UI -- a cue that fails is
silence.

## Materials

`public/materials.csv` is the source of truth for how every piece is shaded.
Edit it and reload -- no rebuild. One row per logical piece (`front`, `bridge`,
`temple`, `lens`, `hinge`, `core`); both temples share a row.

Columns: `color`, `roughness`, `metalness`, `opacity`, `transparent`,
`envMapIntensity`, `map`, `mapRepeat`, `normalMap`, `normalScale`,
`clearcoat`, `clearcoatRoughness`, `flatShading`. Maps are filenames under
`public/textures/` (two acetate scans are already there). Unknown columns are
ignored and missing ones fall back, so adding a column cannot break an older
file, and a typo degrades one row rather than rendering the product black.

`mapRepeat` is 1 for the acetate rows and should stay there -- the model's own
unwrap already covers 0-1 (trap 48). It is still honoured for any part that
falls back to a planar projection.

The `temple` row is a deliberate duplicate of `front`: the arms are cut from
the same sheet, and a matched temple that shades even slightly differently
reads as a colour mismatch rather than as a different finish. `wire` is the
metal core inside the arm and shares the bridge's numbers.

Colour rows for acetate can also carry `map`, `mapRepeat`, `transmission` and
`thickness` -- see `FRAME_COLOURS` in `editor/options.ts`. Tortoise uses all
four: without transmission the shell reads as a printed pattern rather than as
depth. `thickness` is in millimetres because the product is unscaled mm; in a
scene that shrinks its product group this is the number that silently makes a
lens absorb nothing.

**Colour is the exception.** For the pieces the customer can colour -- front,
bridge, temples -- the configuration wins and the CSV's `color` column stays
blank. That split is what makes the table tunable without it fighting the
customer: editing `roughness` never overrides a chosen colour, and choosing a
colour never resets a material you spent an afternoon dialling in.

`MeshStandardMaterial`, not physical. Of physical's extras only clearcoat
earns its place here, so it is applied on top where the CSV asks and the base
stays standard.

Lighting is `RoomEnvironment` through a PMREM generator -- three's own
procedural studio, so it ships with the library and costs no request. A real
.hdr is an `RGBELoader` call feeding the same generator.

## The source model

`public/frames/final.glb` is the live model, and the only one in the repo.
Nodes: `Front`, `temple`, `Bridge`, `lens`, `hinge`. Three superseded exports
were dropped when this repo was cut -- see **Repository layout**.

**`temple` holds two materials and they are two different parts** -- see trap
41. The acetate arm and the `metal` wire running through it arrive as separate
primitives under one node, both carrying the same three design keys, and both
are split left/right and morphed in step (`TEMPLE_PARTS`). The wire's bounding
box is inside the acetate's on all three axes with 1-2 mm of clearance, so it
is a genuine embedded core: visible through a translucent frame colour, hidden
under a solid one, which is how a real acetate temple is built.

Measured on load, not assumed:

- **Already in centimetres at true size** -- the front is 140.3 mm across. The
  loader keeps that rather than forcing a nominal width, because a file that
  says it is 140 mm almost certainly is. It only falls back to normalising
  when the number is implausible, which is what the old reference set needed.
- **`temple` is one mesh holding both arms.** Split on the midline at load;
  verified that no triangle crosses x = 0, so the split is exact.
- **Every part is already mirrored.** 100% of vertices have an exact mirror
  counterpart about x = 0 and left/right counts match to the vertex. Adding a
  mirror step would duplicate coincident geometry and z-fight.

### Subdivision

The GLB carries the **base cage**, not the surface -- 326 vertices for a front
where the FBX of the same object had 13,464 -- so it renders faceted. Loop
subdivision is applied at load (`subdivide.ts`), two levels, taking the front
to 8,960 vertices. `SUBDIVISION` in `loadFrame.ts` sets the levels per part.

The lens is subdivided to match, not for its own sake: Loop pulls a surface
*inside* its cage, so a smoothed rim around an unsmoothed lens leaves the lens
protruding through it. The temples and hinges are already dense enough and are
left alone; each level quadruples triangles and load time. Whole load is about
480 ms.

Loop rather than Catmull-Clark because glTF delivers triangles -- Catmull-
Clark is defined on quads, and the export has already discarded them. If the
source ever ships a subdivided mesh instead, set the levels to 0.

### Use the GLB, not the FBX

`public/frames/final.glb` is the live model, and it is a GLB for a reason.
The FBX exported from the same scene has **no shape keys at all** -- verified by walking its binary node tree: zero
`Deformer` nodes, no `Shape` children on any `Geometry`, and none of the key
names anywhere in the file. Blender's FBX exporter drops shape keys when
"Apply Modifiers" is on, because a modifier cannot be applied to a mesh that
has them.

glTF is the better carrier regardless: morph targets are part of the format
rather than an optional export flag, they arrive as relative deltas with their
names attached, and they survive the export settings that cost the FBX its.

The GLB carries 7 targets on the front and the same 7 on the lens (`Aviator`,
`Square`, `Rectangle`, `Geometric`, `Oval`, `Round`, `Wayfarer` -- Cat is the
basis), 4 on the bridge (`Profile1`, `Profile2`, `Shape1`, `Shape2`), and 3 on
*both* halves of the temple (`Design1`, `Design2`, `Design3`).

Three temple keys give **four** arm designs, the same arithmetic as the front:
the arm as modelled is the first design. So the numbering does not line up --
the file's `Design1` is offered as Design 2 -- which reads as an off-by-one
until you remember the basis has no key of its own to be named by.

**It is authored as a right half.** Every part has zero vertices on the
negative side, so `mirrorX` applies the mirror at load. The FBX had it baked
in already, which is why the mirror is conditional.

### Superseded: the FBX had no shape keys

Verified three ways: zero `Deformer` / `BlendShape` / `SubDeformer` nodes in
the binary, none of the key names present anywhere in the file, and
`morphTargetDictionary` null on all five meshes after loading.

The most likely cause, and it explains both observations at once: **Blender's
FBX exporter silently drops shape keys when "Apply Modifiers" is ticked**,
because a modifier cannot be applied to a mesh that has them. The same
checkbox baked the mirror in and threw the shape keys away.

To fix, re-export with **Apply Modifiers off** and **Shape Keys on**. Apply
the Mirror modifier by hand first if the mirrored geometry is wanted -- but
note that applying Mirror to a mesh that has shape keys is itself blocked in
Blender, so the shapes have to be authored on the already-mirrored mesh.

Everything downstream is built and waiting: the wheel, the bridge grid, the
morph plumbing and the bake. `resolveMorphName` matches key names loosely
(case and punctuation insensitive), and anything unmatched leaves that part at
its basis shape rather than failing. The panel says so when the file carries
no keys.

## Known gaps

1. **The camera path has not been run against a real face.** Everything
   downstream of the landmarker is verified against the canonical model, and
   the AR maths is verified against synthetic poses, but the guided scan's
   pacing, the quality gates and the tracking jitter need a real session.
   Granting camera access is the first thing to do.

2. **The placeholder's true size is still unpinned.** `NOMINAL_FRONT_WIDTH` is
   138 mm by assumption. The size slider is wide enough to dial it in; once a
   real measurement exists, set the constant and narrow the range.

3. **Hair is a generic crop on a real head shape.** Landmark 10 and its
   neighbours are fixed points on the model's forehead, so the hairline is not
   the customer's.

4. **`align to ears` can return a negative pantoscopic tilt.** On a real frame
   the temple is *bent* to meet the ear and the front keeps its tilt; with a
   rigid placeholder the only way to raise the tips is to tip the front back.
   A negative answer means the arms are too straight for that face. Revisit
   when temples become parametric.

5. **Blendshapes are only used as a scan quality gate** (blink, jaw open). They
   are available for expression-aware fitting later.

6. **Bundle is 1.0 MB**, mostly three.js. Fine for a prototype.
