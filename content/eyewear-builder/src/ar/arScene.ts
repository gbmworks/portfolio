/**
 * The try-on stage.
 *
 * Design decisions worth knowing before changing anything here:
 *
 * **The video is not in the scene.** It is a plain `<video>` element sitting
 * behind a transparent canvas, both mirrored by the same CSS transform. That
 * skips a full-resolution texture upload every frame and keeps the mirror in
 * one place; the 3D layer never has to know the view is flipped.
 *
 * **The frame is anchored to unprojected landmarks, not to MediaPipe's
 * transformation matrix.** The matrix is fitted in a camera space whose
 * intrinsics we would have to match exactly, and any mismatch shows up as
 * glasses drifting off the nose as the customer leans in and out. Unprojecting
 * the landmarks through *our* camera makes the anchor agree with the video by
 * construction, and it still gives true perspective, because each landmark is
 * unprojected at its own depth.
 *
 * **Scale comes from the scan, not from the frame.** The tracked head gives a
 * width in world units and the scan gives the same width in millimetres, so
 * the ratio converts the frame's millimetres into the scene. That is why the
 * glasses stay the right size when the customer moves toward the camera --
 * the head grows, the ratio changes, the frame follows.
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import type { FaceMeasurements } from '../face/measure';
import { headFrameFrom, type HeadFrame } from '../face/headFrame';
import type { FaceSample } from '../face/landmarker';
import { applyColour, programKey } from '../editor/acetate';
import type { Colour } from '../editor/options';
import type { LoadedFrame, PartKey } from '../frame/loadFrame';
import { HeadOccluder, type OccluderMode } from './occluder';
import { OneEuroVec } from './smoothing';
import { drawnDepth, drawnScale, type FitSettings } from './fit';

/** Vertical field of view of the virtual camera, degrees. */
const FOV = 45;
/** Nominal distance from camera to face, in scene units. */
const NOMINAL_DEPTH = 600;

export interface MetalFinish {
  hex: string;
  roughness: number;
}

export interface FrameAppearance {
  /**
   * The full colour spec for each acetate group, not just a hex.
   *
   * A hex cannot express a patterned acetate or a translucent one, and
   * flattening to one was the bug that rendered tortoise white here.
   */
  front: Colour;
  temple: Colour;
  /**
   * The two metal groups, matching the editor's split: the bridge and the
   * front's core on one, the temple wire and the hinges on the other.
   *
   * Roughness travels with the colour because a finish is both -- polished
   * silver and brushed gunmetal are not the same material in two tints.
   */
  bridgeMetal: MetalFinish;
  templeMetal: MetalFinish;
  lensTint: string;
  lensOpacity: number;
  /** How hard the lens surface reflects, 0-1. */
  lensReflectivity: number;
}

/** Same room the editor lights with; reflections only, never a background. */
const HDRI = 'empty_warehouse_01.hdr';

/**
 * How much of that room the acetate is allowed to show.
 *
 * Almost none. A frame worn in the customer's own room that reflects a studio
 * somewhere else is the fastest way to make it look pasted on; the lights do
 * the shading. The lens is the exception -- see `applyAppearance`.
 */
const ENV_INTENSITY = 0.25;

/** Which arm each part swings with, if any. */
const ARM_PIVOT: Partial<Record<PartKey, 'left' | 'right'>> = {
  templeLeft: 'left',
  templeWireLeft: 'left',
  templeRight: 'right',
  templeWireRight: 'right',
};

/**
 * Which finish each metal part takes, mirroring the editor's two groups.
 *
 * The bridge used to fall through to the acetate branch below and render as a
 * plastic bridge in the customer's colour -- it was never listed.
 */
const METAL_PART: Partial<Record<PartKey, 'bridge' | 'temple'>> = {
  bridge: 'bridge',
  core: 'bridge',
  hinge: 'temple',
  templeWireLeft: 'temple',
  templeWireRight: 'temple',
};
const LENS_ENV_INTENSITY = 1.35;

export const DEFAULT_APPEARANCE: FrameAppearance = {
  front: { label: 'Black', hex: '#1d1d20', swatch: '#1d1d20' },
  temple: { label: 'Black', hex: '#1d1d20', swatch: '#1d1d20' },
  bridgeMetal: { hex: '#cfd2d6', roughness: 0.18 },
  templeMetal: { hex: '#cfd2d6', roughness: 0.18 },
  lensTint: '#2b3a46',
  lensOpacity: 0.28,
  lensReflectivity: 0.75,
};

export class ARScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;

  /** Head basis -> world. The frame hangs off this. */
  private readonly anchor = new THREE.Group();
  /** Fit transform, in millimetres, inside the anchor. */
  private readonly fitGroup = new THREE.Group();
  private readonly templeLeft = new THREE.Group();
  private readonly templeRight = new THREE.Group();

  private readonly occluder = new HeadOccluder();
  private readonly materials = new Map<PartKey, THREE.MeshPhysicalMaterial>();
  private readonly meshes = new Map<PartKey, THREE.Mesh>();

  private readonly worldPoints = new Float32Array(478 * 3);
  private readonly poseFilter = new OneEuroVec(7, 1.1, 0.02);
  private readonly poseBuffer: number[] = [];

  private loaded: LoadedFrame | null = null;
  private measurements: FaceMeasurements | null = null;
  private fit: FitSettings | null = null;

  /** Last head basis, kept so the align-to-ears solve has something to use. */
  private lastHead: HeadFrame | null = null;
  private lastWorldPerMm = 1;


  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 10, 5000);
    this.camera.position.set(0, 0, 0);

    this.anchor.matrixAutoUpdate = false;
    this.anchor.add(this.fitGroup);
    this.fitGroup.add(this.templeLeft, this.templeRight);
    this.scene.add(this.anchor, this.occluder.group);

    this.addLighting();
  }

  /**
   * Lighting.
   *
   * A key from the front-left and a much weaker fill opposite, plus a broad
   * hemisphere for ambient.
   *
   * The environment map is loaded too, but it is turned down to almost
   * nothing on the acetate (`ENV_INTENSITY`). The original note here argued
   * for no environment at all -- a studio HDRI reflected in a frame worn in a
   * real room is the fastest way to make it look pasted on -- and that is
   * still right for the *body*. It is wrong for the lens: a lens with nothing
   * to reflect has no highlights, and highlights are most of what makes glass
   * read as glass rather than as tinted film. So the room comes back, aimed
   * almost entirely at the lens.
   */
  private addLighting(): void {
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-260, 320, 520);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
    fill.position.set(340, 80, 300);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(0, 180, -420);
    this.scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x404048, 0.65));
    this.loadEnvironment();
  }

  /**
   * The same HDRI the editor lights with, for reflections only.
   *
   * Never set as a background -- the background here is the customer's room,
   * behind the canvas.
   */
  private loadEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    new RGBELoader().setPath(`${import.meta.env.BASE_URL}hdri/`).load(
      HDRI,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = pmrem.fromEquirectangular(texture).texture;
        texture.dispose();
        pmrem.dispose();
      },
      undefined,
      () => pmrem.dispose(),
    );
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setFrame(frame: LoadedFrame, appearance: FrameAppearance): void {
    for (const mesh of this.meshes.values()) mesh.removeFromParent();
    this.meshes.clear();
    this.loaded = frame;

    for (const [key, geometry] of Object.entries(frame.parts) as [PartKey, THREE.BufferGeometry][]) {
      const material = this.materialFor(key, appearance);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      // Everything must draw after the mask, whose renderOrder is -10.
      mesh.renderOrder = key === 'lens' ? 2 : 1;
      this.meshes.set(key, mesh);

      // Temples hang off their own pivot so splay can rotate them about the
      // hinge without moving the front. The pivot is cancelled on the *mesh*,
      // never by translating the geometry: geometries are cached and shared
      // across every ARScene, so mutating one offsets it again on each new
      // scene. A second mount then flings both arms away from the frame by
      // twice the hinge offset -- arms floating off at the edges of the video.
      //
      // *Everything* that belongs to an arm goes on that arm's pivot, which
      // is why this is a lookup rather than two named cases. The wire runs
      // inside the acetate, so an arm that swings while its wire stays put
      // leaves the wire hanging in the air beside it.
      const side = ARM_PIVOT[key];
      if (side) {
        const pivot = side === 'left' ? this.templeLeft : this.templeRight;
        const hinge = side === 'left' ? frame.hingeLeft : frame.hingeRight;
        pivot.position.copy(hinge);
        mesh.position.copy(hinge).negate();
        pivot.add(mesh);
      } else {
        this.fitGroup.add(mesh);
      }
    }
  }

  setAppearance(appearance: FrameAppearance): void {
    for (const [key, material] of this.materials) {
      applyAppearance(key, material, appearance);
    }
  }

  /** Feed the scan so the frame can be sized and the ear targets placed. */
  /**
   * Feed the scan.
   *
   * Only the measurements are kept. The scene no longer solves anything from
   * the mesh itself -- the frame's size, height and temple splay are all
   * settled in `initialFit` before they ever reach here, so that the portrait
   * overlay and the try-on cannot disagree about where the frame sits.
   */
  setScan(measurements: FaceMeasurements): void {
    this.measurements = measurements;
  }

  setFit(fit: FitSettings): void {
    this.fit = fit;
    this.applyFit();
  }

  private applyFit(): void {
    if (!this.fit) return;
    const f = this.fit;

    // `depth` and `scale` are departures from `FIT_REFERENCE`, not absolute
    // values -- so what the scene wants is the drawn figure, never the raw one.
    this.fitGroup.position.set(0, f.height, drawnDepth(f));
    this.fitGroup.rotation.set(THREE.MathUtils.degToRad(-f.pantoscopic), 0, 0);
    this.fitGroup.scale.setScalar(drawnScale(f));

    // The rotation sign comes from each hinge's own x, not from the part
    // name: the source FBX calls its arms LEFT and RIGHT but puts LEFT at
    // negative x, so a name-based sign splays one arm out and the other in.
    const splay = THREE.MathUtils.degToRad(f.splay);
    const sideLeft = Math.sign(this.loaded?.hingeLeft.x ?? -1) || -1;
    const sideRight = Math.sign(this.loaded?.hingeRight.x ?? 1) || 1;
    this.templeLeft.rotation.set(0, -sideLeft * splay, 0);
    this.templeRight.rotation.set(0, -sideRight * splay, 0);
  }

  /**
   * One tracked frame.
   *
   * Everything downstream of the unprojection works in scene units; only the
   * frame's own transform is in millimetres, scaled on the way in.
   */
  update(sample: FaceSample): void {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const points = sample.points;

    // Unproject: each landmark at its own depth, so the result has real
    // perspective rather than a flat billboard of a face.
    for (let i = 0; i < 478; i++) {
      const sx = points[i * 3];
      const sy = points[i * 3 + 1];
      const sz = points[i * 3 + 2];
      const depth = NOMINAL_DEPTH * (1 - 2 * tanHalf * sz);
      this.worldPoints[i * 3] = 2 * sx * depth * tanHalf;
      this.worldPoints[i * 3 + 1] = 2 * sy * depth * tanHalf;
      this.worldPoints[i * 3 + 2] = -depth;
    }

    const head = headFrameFrom(this.worldPoints);
    this.lastHead = head;

    // Scene units per millimetre, from the one distance measured both ways.
    const worldPerMm = this.measurements?.headWidth
      ? head.width / this.measurements.headWidth
      : head.width / 145;
    this.lastWorldPerMm = worldPerMm;

    // Smooth position and orientation together. Filtering the basis vectors
    // rather than a quaternion keeps it linear and avoids sign flips; they are
    // re-orthonormalised below, so small filter-induced skew cannot accumulate.
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(head.x.x, head.x.y, head.x.z),
        new THREE.Vector3(head.y.x, head.y.y, head.y.z),
        new THREE.Vector3(head.z.x, head.z.y, head.z.z),
      ),
    );
    const raw = [head.origin.x, head.origin.y, head.origin.z, q.x, q.y, q.z, q.w];
    // Quaternions double-cover rotations, so a sign flip between frames would
    // make the filter take the long way round. Keep it in the same hemisphere.
    if (this.poseBuffer.length === 7) {
      const dot = raw[3] * this.poseBuffer[3] + raw[4] * this.poseBuffer[4] +
        raw[5] * this.poseBuffer[5] + raw[6] * this.poseBuffer[6];
      if (dot < 0) for (let i = 3; i < 7; i++) raw[i] = -raw[i];
    }
    const smoothed = this.poseFilter.filter(raw, sample.timestamp, this.poseBuffer);

    const rotation = new THREE.Quaternion(smoothed[3], smoothed[4], smoothed[5], smoothed[6])
      .normalize();
    const position = new THREE.Vector3(smoothed[0], smoothed[1], smoothed[2]);

    this.anchor.matrix.compose(
      position,
      rotation,
      new THREE.Vector3(worldPerMm, worldPerMm, worldPerMm),
    );
    this.anchor.matrixWorldNeedsUpdate = true;

    const dims = {
      width: head.width,
      length: (this.measurements?.faceLength ?? 190) * worldPerMm,
      depth: (this.measurements?.earDepth ?? 80) * worldPerMm,
    };
    const headMatrix = new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1));
    this.occluder.update(this.worldPoints, headMatrix, dims, worldPerMm);
  }

  /** See `OccluderMode`. Exposed for the debug toggle in the try-on panel. */
  setOccluderMode(mode: OccluderMode): void {
    this.occluder.setMode(mode);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Drawing-buffer size, so a test can read pixels back at the right scale. */
  get bufferSize(): { width: number; height: number } {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return { width: size.x, height: size.y };
  }

  /** Millimetres per scene unit at the last tracked frame; for HUD readouts. */
  get scaleInfo(): { worldPerMm: number; head: HeadFrame | null } {
    return { worldPerMm: this.lastWorldPerMm, head: this.lastHead };
  }

  private materialFor(key: PartKey, appearance: FrameAppearance): THREE.MeshPhysicalMaterial {
    const existing = this.materials.get(key);
    if (existing) {
      applyAppearance(key, existing, appearance);
      return existing;
    }
    const material = new THREE.MeshPhysicalMaterial({ side: THREE.FrontSide });
    applyAppearance(key, material, appearance);
    this.materials.set(key, material);
    return material;
  }

  dispose(): void {
    this.occluder.dispose();
    for (const material of this.materials.values()) material.dispose();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
    // The same reason, and the same guard, as in `EditorScene.dispose` -- this
    // is the other half of the pair that was leaking a context per navigation.
    if (!this.renderer.domElement.isConnected) this.renderer.forceContextLoss();
  }
}

/**
 * An acetate part, through the same painter the editor uses.
 *
 * The surface numbers stay local -- they are tuned for a frame lit by three
 * lights against a live room, not for the editor's studio -- but the *colour*
 * is applied by shared code, so a patterned or translucent acetate cannot
 * work in one scene and not the other. Set the surface first: `applyColour`
 * deliberately overrides roughness and clearcoat for a translucent colour,
 * which needs a glassier finish than an acetate.
 */
function paintAcetate(
  material: THREE.MeshPhysicalMaterial,
  colour: Colour,
  roughness: number,
  clearcoat: number,
  clearcoatRoughness: number,
): void {
  material.metalness = 0;
  material.roughness = roughness;
  material.clearcoat = clearcoat;
  material.clearcoatRoughness = clearcoatRoughness;
  material.envMapIntensity = ENV_INTENSITY;
  // `transmission: false` -- there is nothing behind the frame in this scene
  // for it to refract. See the option's own note.
  applyColour(material, colour, { transmission: false });
}

function applyAppearance(
  key: PartKey,
  material: THREE.MeshPhysicalMaterial,
  appearance: FrameAppearance,
): void {
  const program = programKey(material);

  switch (key) {
    case 'lens': {
      // Alpha, not transmission -- and not for want of trying.
      //
      // Transmission refracts whatever is in the transmission buffer, and
      // that buffer holds the *scene*. Here the scene is the frame alone: the
      // camera feed is a video element behind a transparent canvas, so a
      // transmissive lens samples nothing and goes dark. three's volume
      // shader also scales `thickness` by world scale, and this group is
      // scaled by a few thousandths, which collapses the optical path. Both
      // would have to change together -- the feed drawn as scene background
      // first -- before transmission is worth turning on here.
      //
      // What does carry over from the transmission example is everything
      // *around* the refraction: a physical surface with a real IOR, a
      // clearcoat, full specular, and an environment to reflect. That is what
      // makes glass look like glass. The alpha only opens the body up.
      material.color.set(appearance.lensTint);
      material.transparent = true;
      material.opacity = appearance.lensOpacity;
      material.roughness = 0.02;
      material.metalness = 0;
      material.ior = 1.52;
      material.specularIntensity = 1;
      material.clearcoat = appearance.lensReflectivity;
      material.clearcoatRoughness = 0.02;
      // The one surface that wants the room: see `addLighting`.
      material.envMapIntensity = LENS_ENV_INTENSITY;
      material.depthWrite = false;
      break;
    }
    case 'bridge':
    case 'core':
    case 'hinge':
    case 'templeWireLeft':
    case 'templeWireRight': {
      const finish =
        METAL_PART[key] === 'temple' ? appearance.templeMetal : appearance.bridgeMetal;
      material.color.set(finish.hex);
      material.roughness = finish.roughness;
      material.metalness = 0.95;
      // Metal is the one body part that needs the room: with no environment
      // it has nothing to be shiny with and reads as grey plastic.
      material.envMapIntensity = 1;
      material.clearcoat = 0;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      break;
    }
    case 'templeLeft':
    case 'templeRight':
      paintAcetate(material, appearance.temple, 0.32, 0.6, 0.2);
      break;
    default:
      paintAcetate(material, appearance.front, 0.3, 0.7, 0.18);
  }

  // Recompile only when the program actually changed -- see `programKey`.
  if (programKey(material) !== program) material.needsUpdate = true;
}
