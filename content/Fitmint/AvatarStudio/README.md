# Fitmint Avatar Studio

A browser character customiser for the Fitmint male avatar, built on three.js.
Everything in `Fitmint - Male.csv` is wired up: 6 skin tones, 6 irises, 8 hair
meshes, 6 beards, 4 eyebrow presets, 5 headgear, 5 tops, 5 bottoms, 4 footwear,
2 full overalls, 23 face-shape sliders and 7 animations.

```bash
npm start          # http://localhost:5173
```

The page needs a real HTTP origin (ES modules + GLB fetches), so open it through
the server rather than from the filesystem.

## How it works

`Male.glb` owns **the only skeleton in the scene**. Each wardrobe FBX was
exported with its own copy of the same 275-bone rig, so every item GLB arrives
with a matching-but-separate skeleton. On equip, `Avatar#rebind` swaps the item's
bone list for the avatar's bones — matched by name, keeping the item's own
inverse bind matrices — and throws its armature away. One skeleton drives
everything, so a single `AnimationMixer` animates the body and whatever it is
wearing, and re-binding costs nothing per frame.

Two details make that work:

- The rest poses agree to 3.5e-6, verified before any of this was built.
- `Male.glb` keeps the 199 joints that are actually skinned and drops the
  unweighted `<bone>_end` leaf tips, which the FBX still list. Those resolve to
  the bone they cap rather than being left as orphans whose world matrix would
  never update again.

Face detail is 23 of the 24 morph targets on `maleBody`, driven live by the
sliders and mirrored onto anything worn that shares a target name — the beards
carry `faceshape01` / `faceshape02`, so they reshape with the face. The 24th,
`facewidth`, is withheld: it widens the head past the hair and headgear, which
then clip, and a saved look still carrying it is zeroed on load.

Eyebrows are four exclusive morph presets on the `maleEyebrow` mesh. Skin and
iris are base-colour map swaps on materials already in `Male.glb`.

## Layout

| Where | What |
| --- | --- |
| Top centre | Lighting rotation dial |
| Left edge | Camera snaps — Fit, Torso, Face, Feet |
| Bottom | Animation bar with play/pause |
| Right dock | Category rail + wardrobe grid, HSB colour pickers, face sliders |

Opening a category also moves the camera to the framing that suits it (hair and
face snap to the head, footwear to the feet), and stops doing so once you have
orbited by hand. Randomise snaps back to Fit, since a fresh look is worth seeing
whole. The dock's width is fed to the camera as a view offset, so the
avatar sits in the middle of the space the panel leaves free.

**Lighting.** A real HDRI drives the lighting — image-based reflections, bounce
colour, the lot — but it is never shown. The stage behind the avatar is a flat
white-to-grey studio sweep instead: a 1K equirect stretched across the viewport
is soft however it is sampled, and a clean backdrop reads better for a wardrobe
anyway. Since it is lighting-only it ships at 512x256 (~420 KB) rather than full
size.

The build **measures** the HDRI rather than having anyone dial it in by hand. It
finds the dominant light and puts the key light there, so the cast shadow agrees
with it, and normalises exposure so any environment lights the avatar to the same
level. Fill and rim are not measured — the character carries its own rig for
those. Drop another `.exr` or `.hdr` into `../hdri`, re-run `npm run env`, and it
is measured the same way.

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

**Rotation.** The dial spins the environment on its vertical axis. The probe and
the environment lights turn together, so the direction the light comes from and
the shadow it casts stay locked — verified by sweeping the camera and reading
back pixels at 0°, 90° and 180°, where measured sun and key light agreed to
within a degree each time. Double-click the dial's icon to snap back to the
HDRI's own orientation.

**Colour.** Hair, Facial Hair, Top, Bottom and Overalls carry an HSB picker —
hue, saturation and brightness sliders with a live chip, a hex readout and a
reset to the authored colour. Each track is painted with the colours that slider
travels through, so it reads as a picker rather than three grey bars.

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

A picker is offered only for materials with neither artwork of their own nor
metal — a plain tee or joggers can be any colour, while the camo vest and the
printed hoodie keep their print and a buckle keeps being brass. Items with
several plain panels get one picker each; `recolorLimit` trims that back, and the
cargo pants use it to show a single colour. The overalls instead use **named
groups** (`Suit`, `Pockets & trim`), because the useful control there is "the
black parts of the G.O.A.T. suit", which spans the bodysuit, the bag and the
shoe. Colours are keyed by category, item and material, so recolouring the tee
does not silently recolour the joggers when you swap.

Layering rules live in the catalog as data:

- An overall replaces top/bottom/footwear, and **puts them back** when removed -
  including when you leave it by picking a separate. Choose a top while wearing
  one and the last bottom and footwear come back with it, rather than leaving the
  avatar bare from the waist down. Slots deliberately set to None stay None,
  since only slots that held something are ever stashed.
- Helmet, balaclava and the ALIEN overall enclose the head, so they hide hair and
  facial hair; ALIEN also suppresses separate headgear, since it ships its own
  mask and glasses.

The look is kept in `localStorage`, so a reload brings it back.

## Performance

93 MB of source art becomes a **19.1 MB** browser payload, and only 1.6 MB of
that (`Male.glb`, with all 7 animations and 24 morph targets) is needed for first
paint — wardrobe items stream in on demand and are cached for the session.

- Geometry, animation and morph data: `EXT_meshopt_compression`
- Textures: WebP, capped at 1024 px, via `EXT_texture_webp`
- Lighting: one 512x256 Radiance `.hdr` (~420 KB), fetched off the critical
  path; a procedural neutral probe lights the very first frame so nothing waits
  on it
- Rendering is on-demand — the loop draws only when something asked it to or
  while a clip is running, so a posed avatar sitting still costs nothing
- Four lights over the image-based probe: the measured sun (the only shadow
  caster) and a camera-relative three-point rig in point lights; one 1k shadow
  map on a tight ortho frustum, and a blurred ground pad for contact; no ambient
  light and no post-processing
- Every avatar and garment material is `MeshStandardMaterial` — full PBR, and
  cheaper than `MeshPhysicalMaterial` since none of these assets need clearcoat,
  transmission or sheen

A full outfit is 100-175k triangles in 24-56 draw calls, depending on how many
materials the pieces carry.

## Rebuilding the assets

```bash
npm run build        # everything (needs Blender)
npm run build:fast   # skip the three Blender stages
npm run catalog      # regenerate src/catalog.js only
npm run env          # re-measure the lighting presets only
```

Source HDRIs are read from `../hdri` (any `.exr` or `.hdr`). Every file found is
measured; add a friendly name to `LABELS` at the top of `tools/build_env.mjs` if
you want one.

| Stage | Tool | Output |
| --- | --- | --- |
| 1. convert | Blender | `assets/items/*.glb` — FBX with rebuilt PBR materials |
| 2. optimize | sharp + gltf-transform | `assets/opt/*.glb` — WebP + meshopt |
| 3. textures | sharp | `assets/tex/` — skin tone chips, iris thumbs |
| 4. thumbs | Blender | `assets/thumbs/` — a 320px product shot per item |
| 5. hdri | Blender | `assets/env/*.hdr` — 512x256, plus an analysis probe |
| 6. env | node | `src/environments.js`, measured from each HDRI |
| 7. catalog | node | `src/catalog.js`, generated from the CSV |

Set `BLENDER=/path/to/blender` if it is not in a default location.

Thumbnails are shot like product photography: the stand-in body is posed on the
idle clip — the same relaxed stance the app opens on, rather than the splayed
rest pose — under a plain white studio dome with the same three-point rig, and
the camera auto-frames the item's *deformed* bounds, so every category crops
itself with no per-item tuning.

**The overalls skip that conversion entirely.** GOAT and ALIEN ship as finished
GLBs beside their FBX: one skin on the same 199-joint rig (rest poses match
exactly), correct PBR values, and their own roughness and normal maps embedded.
`convert_fbx.py` skips any FBX with a sibling GLB and `build_overalls.mjs` picks
those up instead, which is why both now read as real materials rather than flat
colour blocks. It also fills the gaps, verified by content hash against the loose maps in that
folder. Each part's grayscale map serves twice — packed into the green channel of
a metallic-roughness texture, and Sobel-derived into a normal map — and both are
applied in "fill" mode, so artist-authored maps are kept and only the missing
ones are added. That takes G.O.A.T. from 13 to 17 materials carrying
both: the shoe had no detail maps at all, and the bag, bodysuit and glove each
had materials with roughness but no bump. The one outright replacement is the
glove's roughness, which the source wires to its *bump* map while the dedicated
`G.glove.roughness.jpg` sits unused beside it.

The remaining 5 are metal fittings, deliberately left flat. The detail maps are
woven fabric, and draping that over a buckle or an armour plate reads as a dent
rather than a surface - none of these metals were authored with a normal map
either.

Normal-map strength is set per file in `NORMAL_SCALE`: G.O.A.T. runs at 1.0,
where the weave is meant to read, while ALIEN's is dialled back to 0.25 because
its authored bump is far too pronounced on the white panels.

Stage 1 rebuilds every material from scratch rather than trusting the Phong
import: the source FBX route their maps through `ShininessExponent` /
`NormalMap` / `DiffuseColor`, and several reference textures under a
`…/Avatar/Male/textures/` path that no longer exists. `convert_fbx.py` resolves
each map by basename against what is actually on disk and carries a small table
of per-material fixes (the camo vest's alpha, a couple of roughness maps the FBX
never referenced, and the tattoo sleeve — `alpha_sleeve.png` is white artwork on
transparency, and driving the material's alpha from it turns the sleeve into a
near-invisible shell, so the build composites the art onto a dark sleeve and uses
the result as a plain colour map).

The catalog is generated **from the CSV**, so a row with no matching asset is
reported rather than silently dropped — `Beard07` and `Beard08` are listed in the
CSV but were never delivered as FBX, and the build says so on every run.

## Deploying

Ship `index.html`, `src/`, `vendor/`, and `assets/{opt,tex,thumbs,env}`.
`assets/items/` is the 58 MB intermediate from stage 1 and is only an input to
stage 2 — nothing at runtime reads it. Asset URLs carry an `?v=<mtime>` query, so
a host can cache them hard and a rebuild still reaches the browser.

## Layout of the source

```
index.html          import map + canvas + loading overlay
serve.mjs           dev static server
src/
  main.js           state, layering rules, persistence, actions
  viewer.js         renderer, camera framings, lighting, render loop
  avatar.js         GLB loading, skeleton re-binding, morphs, animation
  ui.js             dock, stage chrome, sliders, HSB colour pickers
  environments.js   GENERATED - measured lighting presets
  icons.js          inline SVG set
  catalog.js        GENERATED - do not edit
tools/
  build.mjs         runs the seven stages above
  convert_fbx.py    Blender: FBX -> GLB, materials rebuilt
  render_thumbs.py  Blender: item thumbnails
  textures_webp.js  GLB textures -> WebP
  build_overalls.mjs GOAT/ALIEN from the artist's GLBs + their detail maps
  goat_textures.mjs  detail-map packing (own process; see its header)
  build_hdri.py     Blender: source .exr -> web .hdr + analysis probe
  build_env.mjs     measures the HDRIs -> src/environments.js
  build_catalog.mjs CSV -> src/catalog.js
```

## Known gaps

- `Beard07` / `Beard08` are in the CSV but have no source mesh.
- A few FBX still reference textures that were never delivered - most visibly
  `olympianDiffuse.jpg` for the Olympian glasses. Those materials fall back to
  their FBX diffuse colour. (The alien and G.O.A.T. maps used to be in this list;
  they now come from the artist's GLBs instead.)
- `facewidth` is present on the mesh but not offered as a slider; see above.
- Thumbnails for facial hair are rendered on their own rather than on the
  stand-in head: Blender re-derives each item's rest pose from its own armature,
  which sits a few millimetres proud of the one the runtime binds to, and the
  head swallows the beard. It does not affect the app, where beards sit
  correctly on the face.
