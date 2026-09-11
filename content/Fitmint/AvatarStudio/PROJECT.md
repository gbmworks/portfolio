# Fitmint Avatar Studio

**A browser-based 3D character customiser — 81 wardrobe and morph options on a
single shared skeleton, running at 60 fps off a 1.6 MB first paint.**

Built by Govind Mohan. Rendering with three.js; asset pipeline in Blender, Node
and Python.

---

## The short version

A folder of archived game art — 35 FBX garments, a rigged GLB body, a CSV index
and four HDRIs — turned into a working product configurator you can open in a
browser. Pick a skin tone, grow a beard, reshape the face with 23 morph sliders,
dress the avatar, recolour what it is wearing, play any of 7 animations, and spin
the lighting around it.

The interesting work was not the UI. It was getting 35 separately-exported
garments to deform correctly on one skeleton, and getting 93 MB of source art
down to a payload that loads before you notice.

---

## The core problem: 36 skeletons, one body

Every wardrobe FBX had been exported from the same Blender scene with the **full
275-bone rig baked into it**. Loading a t-shirt meant loading an entire second
skeleton; loading a full outfit meant six. None of them were connected to the
body, so nothing would animate together.

The fix is the heart of the project:

> `Male.glb` owns the only skeleton in the scene. On equip, each garment's bone
> list is swapped for the avatar's bones — matched by name, keeping the garment's
> own inverse bind matrices — and its armature is discarded. One skeleton drives
> everything, so a single `AnimationMixer` animates the body and whatever it is
> wearing.

```js
#rebind(mesh) {
  const source = mesh.skeleton;
  const bones = source.bones.map((bone) => this.#resolveBone(bone.name) || bone);
  mesh.bind(new THREE.Skeleton(bones, source.boneInverses), mesh.matrixWorld);
}
```

Two things had to be verified before any of it could work:

**Do the rest poses actually agree?** I wrote a GLB parser to walk both node
hierarchies and compare world-space bone matrices before writing a line of app
code. They matched to **3.5 × 10⁻⁶**. Without that check the whole approach was a
guess.

**What about bones that do not exist on both?** `Male.glb` keeps the 199 joints
that are actually skinned and drops the unweighted `<bone>_end` leaf tips, which
the FBX still list. Those resolve to the bone they cap, so every joint stays
attached to a live skeleton instead of leaving orphans whose world matrix would
never update again.

The payoff: re-binding costs nothing per frame, garments follow the animation
exactly, and a full outfit is 100-175k triangles in 24-56 draw calls, depending
on how many materials the pieces carry.

---

## Pipeline: 93 MB of source art → 19 MB payload

Seven stages, driven by `npm run build`. Blender runs headless for the parts that
need a 3D DCC; everything else is Node.

| Stage | Tool | What it does |
| --- | --- | --- |
| 1. convert | Blender | 35 FBX → GLB, materials rebuilt from scratch |
| 2. optimize | sharp + gltf-transform | textures → WebP, geometry/animation → meshopt |
| 3. textures | sharp | skin tone chips, iris thumbnails |
| 4. thumbs | Blender | a posed product shot per item |
| 5. hdri | Blender | source `.exr` → 512×256 `.hdr` + an analysis probe |
| 6. env | Node | **measures** the HDRI → lighting preset |
| 7. catalog | Node | CSV → `src/catalog.js` |

### Materials had to be rebuilt, not imported

The source FBX route their maps through `ShininessExponent` / `NormalMap` /
`DiffuseColor`, and several reference textures under an `…/Avatar/Male/textures/`
path that no longer exists. Trusting the Phong import gave garbage. The converter
resolves every map by basename against what is actually on disk and rebuilds each
material as a clean Principled BSDF.

It also carries a small table of per-material fixes. The best example: the tattoo
sleeve ships as white artwork on transparency. Driving the material's alpha from
it turns the sleeve into a near-invisible shell — so the build composites the art
onto a dark sleeve and uses the result as a plain colour map.

### The overalls skip conversion entirely

G.O.A.T. and ALIEN ship as finished GLBs beside their FBX: one skin on the same
rig, correct PBR values, and most of their maps embedded. `convert_fbx.py` skips
any FBX with a sibling GLB and `build_overalls.mjs` picks those up instead.

Each part's grayscale map then serves twice — packed into the **green channel
only** of a metallic-roughness texture, and Sobel-derived into a normal map. The
green-channel detail matters: glTF reads roughness from G and metalness from B of
the same texture, so a plain grayscale map there would drive metalness from the
same pixels and flatten every metal fitting on the suit.

Both are applied in "fill" mode, keeping artist-authored maps and adding only the
missing ones — which took G.O.A.T. from 13 to 17 materials carrying both. The
remaining 5 are metal fittings, left flat on purpose: the maps are woven fabric,
and draping that over a buckle or an armour plate reads as a dent rather than a
surface.

Metal fittings are deliberately left flat. The detail maps are woven fabric, and
draping that over a buckle or an armour plate reads as a dent rather than a
surface — none of these metals were authored with a normal map either.

### Compression

- Geometry, animation and morph data: `EXT_meshopt_compression`
- Textures: WebP at ≤1024 px, via `EXT_texture_webp`
- Result: **58 MB of converted GLB → 15.8 MB**, and the whole deployable tree to
  **19.1 MB**

Only **1.6 MB** of that is needed for first paint (`Male.glb`, carrying all 7
animations and 24 morph targets). Wardrobe items stream in on demand and cache
for the session.

---

## Lighting is measured, not eyeballed

A real HDRI drives the lighting — image-based reflections, bounce colour, the lot
— but it is never shown. The stage is a flat white-to-grey studio sweep: a 1K
equirect stretched across the viewport is soft however it is sampled, and a clean
backdrop reads better for a wardrobe.

The build **measures** the HDRI rather than having anyone dial it in:

```
Alley   sun az=74°  el=65°   contrast=11.4   env=0.542   key=2.19
```

It finds the dominant light by taking a luminance-weighted centroid of the
brightest patch above the horizon, and puts the key light there — so the cast
shadow agrees with the light in the image. Fill and rim are placed relative to
that key, and exposure is normalised so any environment lights the avatar to the
same level.

I verified the derived sun direction two ways: by marking the computed position
on the equirect (it lands exactly on the sun behind the treeline), and by
**sweeping the camera in the live renderer and reading back pixels**. Measured
and computed agreed to within 5°.

Alongside it the character carries its own **three-point rig, in point lights** —
key in front, fill opposite and lower, rim high and behind. They are placed
relative to the camera rather than the world, so the key is always on the face
and the rim always works the silhouette, whichever way you orbit. None of them
casts a shadow; the sun owns that, and a second caster would give the avatar two.

Two things that took iterating on screenshots to get right:

- **Falloff is eased to 1.6, not the physical 2.** A standing figure is nearly
  two metres of subject, and true inverse-square leaves the shoes several stops
  under the shoulders.
- **The rim is far weaker than a rim usually wants to be.** These garments are
  mostly rough fabric, which takes a back light as broad fill rather than a crisp
  edge — at rim-light strength the black G.O.A.T. suit turned grey. Dialled down,
  it reads where it should, on the metal fittings and the shoulders, and leaves
  the blacks black.

**There is no ambient light.** A hemisphere light used to sit under all of this
as fill, but `scene.environment` is a pre-filtered probe of the real HDRI — it
already supplies ambient from every direction, measured rather than approximated.
Switching the hemisphere off moved the render by at most 2/255 on the face and
not at all anywhere else, so it came out: four lights, none of them redundant.

Because the image-based lighting carries most of the illumination, the rig sits on
top as shaping rather than driving the scene. The three numbers that set the
balance all live at the top of `src/viewer.js`:

| Constant | Value | What it drives |
| --- | --- | --- |
| `ENV_SHARE` | `1.5` | image-based lighting — `environmentIntensity` 0.813 |
| `SUN_SHARE` | `0.35` | the measured sun — directional 0.77, the only shadow caster |
| `CHARACTER_RIG` | `18 / 6.3 / 4.2` | point key / fill / rim |

`ENV_SHARE` above 1 pushes the probe past the exposure-normalised level the build
measured. That is a look rather than a bug — every environment still lands at the
same level relative to the others, just scaled up together.

The rotation dial spins the probe and the environment lights together, so the
light direction and the shadow it casts stay locked. Verified at 0°, 90° and
180°, where measured sun and key light agreed to within a degree each time.

---

## Interface

Modelled on Ready Player Me's builder: a right-hand dock with a category rail and
a thumbnail grid, the stage free of chrome except for what you need on it.

| Where | What |
| --- | --- |
| Top centre | Lighting rotation dial |
| Left edge | Camera snaps — Fit, Torso, Face, Feet |
| Bottom | Animation bar with play/pause |
| Right dock | Category rail + wardrobe grid, HSB colour pickers, face sliders |

Details that took the most thought:

**The camera knows what you are editing.** Opening a category moves to the
framing that suits it — hair and face snap to the head, footwear to the feet —
and stops doing so once you have orbited by hand. The dock's width is fed to the
camera as a `setViewOffset`, so the avatar sits in the middle of the space the
panel leaves free rather than the middle of the canvas.

**Layering rules live in the catalog as data, not in branches.** An overall
replaces top/bottom/footwear and puts them back when removed — including when you
leave it by picking a separate, so choosing a top does not leave the avatar bare
from the waist down. Helmet, balaclava and the ALIEN mask hide the hair and beard
that would otherwise clip through them.

**Colour is an HSB picker, offered only where it makes sense.** Hue, saturation
and brightness sliders with a live chip, a hex readout and a reset to the
authored colour — each track painted with the colours that slider travels
through. A picker appears only for materials with neither artwork of their own
nor metal: a plain tee can be any colour, the camo vest keeps its print, and a
buckle keeps being brass. The overalls use *named groups* (`Suit`, `Pockets &
trim`), because the useful control there is "the black parts of the G.O.A.T.
suit", which spans the bodysuit, the bag and the shoe.

HSB rather than HSL, though three's `Color` offers `setHSL`: HSL's lightness axis
runs to white at the top, whereas a picker needs brightness-to-zero to reach
black and saturation-to-zero to reach grey.

Two things the pickers have to get right. The panel is **not** re-rendered while
a slider is live — replacing it on the first `input` event would destroy the
element under the pointer and kill the drag — so each picker keeps its own chip,
readout and track gradients in sync, and the reset button puts the sliders back
itself. And because plenty of these garments are authored pure black (H0 S0 B0),
where dragging hue or saturation correctly changes nothing on screen, a hue or
saturation drag lifts brightness into visible range first.

**Rendering is on demand.** The loop draws only when something asked it to or
while a clip is running, so a posed avatar sitting still costs nothing.

---

## Thumbnails are rendered, not screenshotted

Every wardrobe item gets a 320 px product shot from Blender: the stand-in body
**posed on the idle clip** — the same relaxed stance the app opens on, rather
than the splayed rest pose — under a white studio dome with a three-point rig,
and the camera auto-frames the item's *deformed* bounds. So a beard crops to the
face and a sneaker crops to the foot with no per-category tuning.

That last part is the trick: `bound_box` is the undeformed cage, so the framing
has to come from the evaluated depsgraph mesh, after the pose is applied.

---

## Problems worth remembering

**A 256 px skybox hiding in plain sight.** The HDRI backdrop looked blocky and I
assumed a resolution problem. It was `scene.backgroundBlurriness`: any value
above zero makes three route the background through PMREM, whose top mip is only
256 px per cube face. At zero it converts the equirect to a sharp cube instead.
My "trace of blur" of 0.04 was silently downgrading a 1K image to 256 px.

**Two copies of libvips.** `gltf-transform`'s texture step kept dying with
`colourspace: parameter space not set`, and so did my own sharp calls — but only
in scripts that imported `@gltf-transform/functions`. It pulls in `ndarray-pixels`,
which bundles its own sharp (0.35.x) alongside the top-level one (0.34.x); two
libvips copies in one process, mismatched `VipsInterpretation` enums. The fix is
process isolation: texture work runs in its own child process.

**A single-letter shortcut nearly cost a look.** I had bound `r` to Randomise.
One stray keypress wipes everything the user built. Removed — nothing destructive
is bound to a bare key now, and Space is guarded so it cannot double-fire with a
focused button.

**Shadows clipped by their own frustum.** I had sized the shadow camera tight
around the body on the theory that it keeps a 1k map crisp. But the box has to
hold the caster *and the ground its shadow lands on*, and an asymmetric bottom
edge sliced the shadow off mid-stride.

---

## Stack

- **three.js 0.186** — WebGLRenderer, skinned meshes, `AnimationMixer`,
  `PMREMGenerator`, `MeshStandardMaterial` throughout
- **Blender 4.5 LTS**, headless, scripted in Python — FBX/EXR ingest, material
  rebuild, thumbnail rendering
- **gltf-transform** — meshopt compression, document merging, material surgery
- **sharp** — WebP encoding, channel packing, Sobel normal-map derivation
- No framework, no bundler. ES modules and an import map; vendored three.js.

~4,900 lines across the app and the pipeline.

---

## Running it

```bash
npm start          # http://localhost:5173
npm run build      # full asset pipeline (needs Blender)
npm run build:fast # skip the three Blender stages
```

The page needs a real HTTP origin — ES modules and GLB fetches will not load off
the filesystem.

### What to deploy

`index.html`, `src/`, `vendor/`, and `assets/{opt,tex,thumbs,env}` — 19.1 MB.

`assets/items/` (59 MB) is the stage-1 intermediate and `tools/node_modules/`
(102 MB) is the build toolchain; neither is read at runtime. Both are in
`.gitignore`. Asset URLs carry a `?v=<mtime>` query, so a host can cache them
hard and a rebuild still reaches the browser.

---

## Known gaps

- `Beard07` / `Beard08` are listed in the source CSV but were never delivered as
  FBX. The catalog generator reports this on every build rather than silently
  dropping them.
- `facewidth` is present on the mesh but withheld from the sliders — it widens
  the head past the hair and headgear, which then clip.
- The Olympian glasses reference `olympianDiffuse.jpg`, which was never
  delivered; that material falls back to its FBX diffuse colour.
- Facial-hair thumbnails are rendered on their own rather than on the stand-in
  head. Blender re-derives each item's rest pose from its own armature, which
  sits a few millimetres proud of the one the runtime binds to, and the head
  swallows the beard. It does not affect the app.
