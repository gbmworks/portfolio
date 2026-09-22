/**
 * The editor's 3D stage.
 *
 * Separate from `ARScene` on purpose. They share the frame geometry and the
 * material table, but nothing else: this one owns cameras, an environment, a
 * picker and an orbit rig, and it never sees a face. Folding both into one
 * class would mean a scene that is half-disabled in either mode.
 *
 * Plain three.js, no R3F -- the sibling project's notes record that R3F mounts
 * the canvas and then never commits the children of `<Canvas>` in this
 * dependency set, silently and with no error.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import { baseBounds, type LoadedFrame, type PartKey } from '../frame/loadFrame';
import { applyColour, programKey } from './acetate';
import {
  PART_PIECE,
  applySpec,
  loadMaterialTable,
  materialTable,
  onTextureLoad,
} from './materialTable';
import {
  LENS_TYPES,
  METALS,
  frameColour,
  lensColour,
  templeColourSpec,
  type ComponentId,
  type Configuration,
} from './options';

/**
 * Which finish drives each metal part.
 *
 * Two groups rather than one, because they are separated by the whole width
 * of the frame: the bridge sits between the lenses and the wire and hinges run
 * down the arms, so they are never seen edge to edge and a customer can pair
 * them deliberately. Anything not listed here follows the bridge.
 */
const METAL_SOURCE: Partial<Record<PartKey, 'temple'>> = {
  templeWireLeft: 'temple',
  templeWireRight: 'temple',
  hinge: 'temple',
};

/** Which component owns each piece of geometry, for picking and highlighting. */
const PART_COMPONENT: Record<PartKey, ComponentId> = {
  front: 'frame',
  lens: 'lens',
  bridge: 'bridge',
  templeLeft: 'temple',
  templeRight: 'temple',
  templeWireLeft: 'temple',
  templeWireRight: 'temple',
  hinge: 'temple',
  core: 'frame',
};

export type CameraViewId = 'three-quarter' | 'front' | 'side' | 'top';

/**
 * View directions, as a unit vector from the product toward the camera.
 *
 * Only the three-quarter view is perspective. The orthogonal views are
 * measurement views -- you look at them to judge a lens shape or a temple
 * curve -- and perspective is exactly the thing that makes those judgements
 * wrong, tapering the far arm and bowing a straight top rim.
 */
interface View {
  dir: THREE.Vector3;
  label: string;
  ortho: boolean;
  /** Overrides `PADDING` where one view needs more air than the rest. */
  padding?: number;
  /**
   * Nudge the product up the screen, as a fraction of the framed half-height.
   *
   * Implemented by aiming *below* the centre, so the product renders above it.
   */
  lift?: number;
  /** Frame to the bounding sphere, so no rotation can clip. See the 3/4 view. */
  sphereFit?: boolean;
}

const VIEWS: Record<CameraViewId, View> = {
  // Round to the wearer's right and a little above the frame. An earlier
  // version sat well below it, looking up: dramatic, and wrong for the one
  // job this view has, which is showing how the piece actually sits. Slightly
  // high still reads the top of the rim and the sweep of both arms without
  // pretending the customer is lying on the floor.
  //
  // Fitted to the bounding *sphere* rather than the box, because this is the
  // view the turntable turns: a box fit is snug at the angle it was measured
  // at and clips the temples the moment they swing broadside. The sphere is
  // the only fit no rotation can escape.
  'three-quarter': {
    dir: new THREE.Vector3(-0.35, 0.22, 0.91).normalize(),
    // "3D" rather than "3/4": the fraction names a photographic convention
    // that means nothing to someone buying glasses, and this is the only view
    // that can actually be turned.
    label: '3D',
    ortho: false,
    sphereFit: true,
    // More air than the flat views, because this one turns and is framed for
    // the product at its widest. The panels are no longer part of this number
    // -- `usableWidth` handles them for every view.
    padding: 1.2,
  },
  // The elevations are measurement views, and a measurement crammed to the
  // edges is hard to read: the eye needs somewhere to put the product before
  // it can judge the shape. More air than the default, and the same amount on
  // both so front and side stay comparable to each other.
  front: { dir: new THREE.Vector3(0, 0, 1), label: 'Front', ortho: true, padding: 1.5 },
  side: { dir: new THREE.Vector3(1, 0, 0), label: 'Side', ortho: true, padding: 1.5 },
  // Looking down, the frame is nearly as deep as it is wide and fills the
  // viewport corner to corner, which leaves it crowding the bottom edge where
  // the view buttons sit. A little more air, and lifted clear of them.
  top: {
    dir: new THREE.Vector3(0, 1, 0.001).normalize(),
    label: 'Top',
    ortho: true,
    padding: 1.35,
    lift: 0.12,
  },
};

export const CAMERA_VIEWS = Object.entries(VIEWS).map(([id, v]) => ({
  id: id as CameraViewId,
  label: v.label,
}));

/** Equirectangular environment, used for both lighting and the backdrop. */
const HDRI = 'empty_warehouse_01.hdr';

/**
 * The backdrop, top of frame to bottom.
 *
 * Written as sRGB triples the shader emits directly. The quad is not lit and
 * not tone mapped, so what is written is what lands on screen -- the point of
 * a neutral backdrop being that its value is known.
 *
 * Narrow range on purpose: enough fall-off that the field reads as space
 * rather than as a flat fill, little enough that it stays a reference to judge
 * an acetate colour against.
 */
const BACKDROP = {
  high: new THREE.Vector3(0.855, 0.855, 0.847),
  low: new THREE.Vector3(0.694, 0.694, 0.686),
  /** How far the corners fall below the ramp. */
  vignette: 0.055,
};

/**
 * How much room to leave around the product when framing a view.
 *
 * The panels float over the left and right edges rather than over the middle,
 * so the vertical fit is what matters. This was 1.12 -- near enough to fill
 * the height -- which read as cropped rather than as confident: a product
 * shot needs the air around it to show that nothing is being hidden.
 */
const PADDING = 1.38;

/**
 * The arrival turntable.
 *
 * Slow enough to read as a considered presentation rather than a spin: about
 * 26 seconds for a full revolution, of which this shows a fifth.
 */
const INTRO = {
  /** Radians per second. */
  speed: 0.24,
  /** Seconds before it gives up on its own. */
  duration: 9,
  /** Seconds of ease-out at the end. */
  settle: 3,
  /** Polar wave amplitudes, radians. Under two degrees combined. */
  waveA: 0.019,
  waveB: 0.008,
};

/**
 * The 3/4 view's lens, in millimetres on a full-frame gauge.
 *
 * 60 mm: still long enough that the near temple does not balloon toward the
 * camera, but with more depth than 80 gave -- at 80 the arms ran so close to
 * parallel that the view read as flat. Set as a focal length rather than an
 * angle so it stays a lens rather than a number that has to be re-derived
 * whenever the viewport changes shape.
 */
const FOCAL_LENGTH = 60;
const FILM_GAUGE = 36;

export class EditorScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly perspective: THREE.PerspectiveCamera;
  private readonly orthographic: THREE.OrthographicCamera;
  private camera: THREE.Camera & { updateProjectionMatrix(): void };
  private controls: OrbitControls;

  private readonly product = new THREE.Group();
  /** The backdrop, as real geometry. See `loadEnvironment`. */
  private backdrop: THREE.Mesh | null = null;
  private readonly meshes = new Map<PartKey, THREE.Mesh>();
  private readonly materials = new Map<PartKey, THREE.MeshStandardMaterial>();

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private config: Configuration | null = null;
  private view: CameraViewId = 'three-quarter';

  /** The product's own bounds, for framing every view. */
  private centre = new THREE.Vector3();
  private radius = 90;
  private bounds = new THREE.Box3(new THREE.Vector3(-70, -35, -70), new THREE.Vector3(70, 35, 10));
  /**
   * Whether the camera has been placed yet.
   *
   * Changing a shape rebuilds the geometry, and re-framing on every rebuild
   * threw away whatever the customer had orbited to -- pick a new bridge from
   * the side view and the camera jumped back to the canonical angle. The
   * camera is placed once, and after that only an explicit view change moves
   * it.
   */
  /**
   * Canvas pixels hidden behind the floating panels, left and right.
   *
   * The panels sit *over* the stage, so the canvas is wider than the part of
   * it anyone can see, and the visible corridor is not centred -- the right
   * panel is 90px wider than the left. Framing to the canvas therefore put
   * the product under a panel and, worse, off-centre in the gap. Every view
   * fits the corridor instead, and aims at its middle.
   */
  private insetLeft = 0;
  private insetRight = 0;

  private framed = false;
  /**
   * Whether the camera has been framed against *real* geometry yet.
   *
   * Separate from `framed`, which only records that some framing happened.
   * The canvas is sized before the model finishes loading, so the first
   * `frame()` runs against the placeholder bounds this class starts with --
   * a box 80 mm deep where the real product is 152, centred 39 mm away from
   * where the real one sits. The editor therefore opened at a position no
   * view button would ever produce, and pressing "3D" jumped.
   */
  private framedGeometry = false;
  /** Timestamp the arrival turntable started, or null when it is not running. */
  private introStart: number | null = null;
  /** Where each view was last left, so returning to one is not a reset. */
  private readonly remembered = new Map<
    CameraViewId,
    { position: THREE.Vector3; target: THREE.Vector3; zoom: number }
  >();
  private introAzimuth = 0;
  private introPolar = 0;
  private readonly spherical = new THREE.Spherical();
  private readonly scratch = new THREE.Vector3();
  private stopWatchingTextures: (() => void) | null = null;

  private readonly canvas: HTMLCanvasElement;
  private width = 1;
  private height = 1;
  private running = true;
  private needsRender = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.perspective = new THREE.PerspectiveCamera(32, 1, 1, 8000);
    this.perspective.filmGauge = FILM_GAUGE;
    // Depth range is generous so a long lens can stand well back; the
    // backdrop is in screen space and needs no room of its own. A tight one clips it away and
    // leaves the same black screen the unit-cube background did.
    this.orthographic = new THREE.OrthographicCamera(-100, 100, 100, -100, -6000, 12000);
    this.camera = this.perspective;

    this.controls = this.makeControls();
    this.scene.add(this.product);
    this.addLights();
    this.loadEnvironment();

    // A texture that resolves after its frame was drawn is never shown --
    // this scene only redraws on demand. See `onTextureLoad`.
    this.stopWatchingTextures = onTextureLoad(() => {
      this.needsRender = true;
    });

    void loadMaterialTable().then(() => {
      if (this.config) this.applyConfig(this.config);
    });
    this.loop();
  }

  private makeControls(): OrbitControls {
    const controls = new OrbitControls(this.camera as THREE.Camera, this.canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.addEventListener('change', () => {
      this.needsRender = true;
    });
    // The moment the customer takes the camera, it is theirs.
    controls.addEventListener('start', () => this.endIntro());
    return controls;
  }

  /**
   * A little direct light on top of the environment.
   *
   * The HDRI does most of the work, but image-based lighting alone gives soft
   * shading with no crisp specular, and acetate and polished metal both read
   * as plastic without one hard source to catch.
   */
  private addLights(): void {
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1, 1.4, 1.6);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(0.4, 0.6, -1.4);
    this.scene.add(key, rim);
  }

  /**
   * The HDRI lights the scene; it is not what you see behind the product.
   *
   * Using the image itself as a backdrop put two artifacts on screen that no
   * amount of blurring fixed, because both are properties of mapping a
   * rectangular image onto a sphere: the equirectangular **seam** ran down one
   * side, visible in the side view, and the **poles** pinched the texture into
   * concentric rings, visible looking down from the top.
   *
   * A generated ramp in screen space has neither -- see `makeBackdrop`. It is
   * also what the editor actually wants: a clean grey field to judge colour
   * against, with the room living in the reflections where it belongs.
   */
  private loadEnvironment(): void {
    this.scene.add(this.makeBackdrop());

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    new RGBELoader().setPath(`${import.meta.env.BASE_URL}hdri/`).load(
      HDRI,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = pmrem.fromEquirectangular(texture).texture;
        texture.dispose();
        pmrem.dispose();
        this.needsRender = true;
      },
      undefined,
      (error) => {
        console.warn('[editor] HDRI failed to load; lighting will be flat', error);
        pmrem.dispose();
      },
    );
  }

  /**
   * A vertical grey ramp painted straight onto the viewport.
   *
   * The first attempt put the ramp on a large inward-facing sphere, which is
   * the usual way to give an orthographic camera something to look at. It
   * removed the seam and the poles but produced a new problem: how much of the
   * ramp a camera sees depends on how much *latitude* its frustum spans, and
   * these cameras span almost none. The 80 mm view covers about thirteen
   * degrees and the orthographic views barely one, so every view came out a
   * flat fill -- and a *different* flat fill each, the front reading around
   * #d0d0ce against the top's #9e9e9b, because they point at different parts
   * of the sphere.
   *
   * Painting in screen space instead makes the backdrop independent of where
   * the camera is and what kind of camera it is. The ramp is visible because
   * it is measured in screen height rather than in degrees of arc, it is
   * identical across all four views, and a flat quad has neither a seam nor a
   * pole to go wrong. It is also what a studio backdrop physically is: a
   * seamless behind the subject, not a room.
   *
   * The vertex shader writes clip space directly and ignores the camera
   * entirely; `z = w = 1` pins it to the far plane. Depth testing is off and
   * `renderOrder` puts it first, so it fills the viewport and then everything
   * else draws over it.
   */
  private makeBackdrop(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          high: { value: BACKDROP.high },
          low: { value: BACKDROP.low },
          vignette: { value: BACKDROP.vignette },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 1.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 high;
          uniform vec3 low;
          uniform float vignette;
          varying vec2 vUv;
          void main() {
            // Smoothstep rather than a straight mix: a linear ramp bands
            // visibly across a wide flat area at eight bits per channel.
            vec3 c = mix(low, high, smoothstep(0.0, 1.0, vUv.y));
            // A little corner fall-off, so the eye settles on the middle
            // where the product is.
            vec2 d = (vUv - 0.5) * 2.0;
            c -= vignette * smoothstep(0.35, 1.25, dot(d, d));
            gl_FragColor = vec4(c, 1.0);
          }
        `,
        depthTest: false,
        depthWrite: false,
      }),
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    this.backdrop = mesh;
    return mesh;
  }

  /** Report how much of the canvas the panels cover. See `insetLeft`. */
  setInsets(left: number, right: number): void {
    if (left === this.insetLeft && right === this.insetRight) return;
    this.insetLeft = left;
    this.insetRight = right;
    if (this.framed) this.refit();
    this.needsRender = true;
  }

  /** Width of the corridor between the panels, in pixels. */
  private get usableWidth(): number {
    return Math.max(this.width - this.insetLeft - this.insetRight, 120);
  }

  /**
   * How far the corridor's centre sits from the canvas's, as a fraction of
   * the canvas width. Negative when the right panel is the wider one.
   */
  private get corridorOffset(): number {
    if (this.width === 0) return 0;
    return (this.insetLeft + this.usableWidth / 2) / this.width - 0.5;
  }

  setSize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.perspective.aspect = width / height;
    // Re-derive the angle from the focal length: three works out the field of
    // view from the film height, which depends on the aspect ratio, so a
    // resize changes it.
    this.perspective.setFocalLength(FOCAL_LENGTH);
    // A resize re-fits the frustum but must not re-aim the camera either.
    if (this.framed) this.refit();
    else this.frame();
    this.needsRender = true;
  }

  /**
   * Switch views, keeping where each one was left.
   *
   * Two behaviours, and the difference is deliberate. Moving to a *different*
   * view restores however that view was last left -- you orbit the 3D view,
   * go and check the front, come back, and it is where you put it, because
   * losing that is losing the comparison you left it set up for. Pressing the
   * view you are **already** on re-frames: by then you have almost certainly
   * orbited away, and that button is the only thing that looks like "put it
   * back" (trap 51).
   */
  setView(view: CameraViewId): void {
    this.framed = true;
    const same = view === this.view;
    // An explicit camera command; the arrival animation has had its turn.
    this.endIntro();
    if (!same) this.remember();

    const wasOrtho = this.camera === this.orthographic;
    const nowOrtho = VIEWS[view].ortho;
    this.view = view;

    if (wasOrtho !== nowOrtho) {
      this.camera = nowOrtho ? this.orthographic : this.perspective;
      // OrbitControls binds its camera at construction, so swapping cameras
      // means a new rig rather than a reassignment.
      this.controls.dispose();
      this.controls = this.makeControls();
    }

    if (same || !this.restore(view)) this.frame();
    this.needsRender = true;
  }

  /** Stash where the current view is sitting, before leaving it. */
  private remember(): void {
    this.remembered.set(this.view, {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      zoom: this.camera === this.orthographic ? this.orthographic.zoom : 1,
    });
  }

  /** Put a view back where it was left. False when it has not been visited. */
  private restore(view: CameraViewId): boolean {
    const saved = this.remembered.get(view);
    if (!saved) return false;

    this.camera.position.copy(saved.position);
    this.controls.target.copy(saved.target);
    if (this.camera === this.orthographic) {
      // The frustum is rebuilt for the *current* aspect -- the window may
      // have been resized while this view was away -- and only the zoom the
      // customer set is carried over.
      this.fitOrtho(VIEWS[view].dir);
      this.orthographic.zoom = saved.zoom;
      this.orthographic.updateProjectionMatrix();
    }
    this.controls.update();
    // Re-seed the turntable so it picks up from here rather than snapping.
    this.introAzimuth = this.controls.getAzimuthalAngle();
    this.introPolar = this.controls.getPolarAngle();
    return true;
  }

  /**
   * Point and size the current camera at the product.
   *
   * Everything is framed on the product's own centre, not the world origin.
   * The model's origin is the bridge saddle -- the point that rests on the
   * nose -- which sits at the top of the frame and well forward of the
   * temples, so orbiting around it swings the whole product through the view.
   */
  /**
   * How large the product is on screen, from this direction.
   *
   * The bounding *sphere* is the easy answer and it is why every view opened
   * so far out: a frame is 140 mm wide, 45 mm tall and 5 mm thick, so its
   * sphere is nearly as tall as it is wide and fitting to it wastes most of
   * the height. Projecting the eight corners of the box onto the camera's own
   * right and up axes gives the real extent instead.
   */
  private screenExtent(dir: THREE.Vector3): { halfWidth: number; halfHeight: number } {
    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();

    let halfWidth = 0;
    let halfHeight = 0;
    const corner = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      corner.set(
        i & 1 ? this.bounds.max.x : this.bounds.min.x,
        i & 2 ? this.bounds.max.y : this.bounds.min.y,
        i & 4 ? this.bounds.max.z : this.bounds.min.z,
      );
      corner.sub(this.centre);
      halfWidth = Math.max(halfWidth, Math.abs(corner.dot(right)));
      halfHeight = Math.max(halfHeight, Math.abs(corner.dot(camUp)));
    }
    return { halfWidth: Math.max(halfWidth, 1), halfHeight: Math.max(halfHeight, 1) };
  }

  /** Re-fit the frustum to the current aspect without moving the camera. */
  private refit(): void {
    if (this.camera !== this.orthographic) return;
    this.fitOrtho(VIEWS[this.view].dir);
    this.orthographic.updateProjectionMatrix();
  }


  private fitOrtho(dir: THREE.Vector3): number {
    // The corridor's aspect, not the canvas's: the product has to fit between
    // the panels, not merely inside the element they float over.
    const aspect = this.usableWidth / this.height;
    const padding = VIEWS[this.view].padding ?? PADDING;
    const { halfWidth, halfHeight } = this.screenExtent(dir);
    // Whichever axis is the binding constraint decides the zoom.
    const half = Math.max(halfHeight * padding, (halfWidth * padding) / aspect);
    const canvasAspect = this.width / this.height;
    this.orthographic.left = -half * canvasAspect;
    this.orthographic.right = half * canvasAspect;
    this.orthographic.top = half;
    this.orthographic.bottom = -half;
    return half;
  }

  /**
   * The largest the product can appear while the turntable is turning.
   *
   * The bounding sphere is the obvious answer and it is far too generous: it
   * uses the full 3D diagonal for the *height* as well, and this frame is
   * 140 mm wide, 152 mm deep and only 49 mm tall -- so it framed for a
   * 200 mm-tall object and pushed the camera four times too far back.
   *
   * The turntable only sweeps azimuth, so height never changes; the width is
   * the diagonal of the footprint, which is what the box presents when it
   * swings broadside. Tight, and still impossible to clip.
   */
  private turntableExtent(): { halfWidth: number; halfHeight: number } {
    const size = this.bounds.getSize(new THREE.Vector3());
    return {
      halfWidth: Math.hypot(size.x, size.z) / 2,
      // A little over half, for the couple of degrees the polar wave adds.
      halfHeight: (size.y / 2) * 1.08,
    };
  }

  /**
   * What the camera aims at: the product's centre, optionally shifted so the
   * product sits off-centre on screen. See `View.lift`.
   */
  private aimPoint(dir: THREE.Vector3, half: number, halfWidth: number): THREE.Vector3 {
    const lift = VIEWS[this.view].lift ?? 0;
    const offset = this.corridorOffset;
    const point = this.centre.clone();
    if (lift === 0 && offset === 0) return point;

    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, dir).normalize();
    const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();

    // Aiming left puts the product right, so the sign is inverted: this moves
    // the product into the middle of the gap between the panels.
    point.addScaledVector(right, -offset * halfWidth * 2);
    point.addScaledVector(camUp, -lift * half);
    return point;
  }

  private frame(): void {
    this.framed = true;
    const { dir } = VIEWS[this.view];
    const aspect = this.width / this.height;

    let aim: THREE.Vector3;
    if (this.camera === this.orthographic) {
      const half = this.fitOrtho(dir);
      this.orthographic.updateProjectionMatrix();
      aim = this.aimPoint(dir, half, (half * this.width) / this.height);
      this.orthographic.position.copy(aim).addScaledVector(dir, this.radius * 4);
    } else {
      const view = VIEWS[this.view];
      const padding = view.padding ?? PADDING;
      const fov = (this.perspective.fov * Math.PI) / 180;
      const { halfWidth, halfHeight } = view.sphereFit
        ? this.turntableExtent()
        : this.screenExtent(dir);
      const forHeight = (halfHeight * padding) / Math.tan(fov / 2);
      // Corridor again, not canvas.
      const corridorAspect = this.usableWidth / this.height;
      const forWidth = (halfWidth * padding) / (Math.tan(fov / 2) * corridorAspect);
      const distance = Math.max(forHeight, forWidth);
      aim = this.aimPoint(dir, halfHeight * padding, distance * Math.tan(fov / 2) * aspect);
      this.perspective.position.copy(aim).addScaledVector(dir, distance);
      this.perspective.updateProjectionMatrix();
    }

    this.controls.target.copy(aim);
    this.controls.update();
    // Where the turntable picks up from, so it starts at the framed angle
    // rather than snapping to one of its own.
    this.introAzimuth = this.controls.getAzimuthalAngle();
    this.introPolar = this.controls.getPolarAngle();
  }


  setFrame(frame: LoadedFrame, parts: Partial<Record<PartKey, THREE.BufferGeometry>>): void {
    for (const mesh of this.meshes.values()) mesh.removeFromParent();
    this.meshes.clear();

    const bounds = new THREE.Box3();
    for (const [key, geometry] of Object.entries(parts) as [PartKey, THREE.BufferGeometry][]) {
      const mesh = new THREE.Mesh(geometry, this.materialFor(key));
      mesh.frustumCulled = false;
      mesh.userData.part = key;
      mesh.renderOrder = key === 'lens' ? 2 : 1;
      this.meshes.set(key, mesh);
      this.product.add(mesh);
      // `baseBounds`, not `geometry.boundingBox`.
      //
      // `computeBoundingBox` deliberately grows the box to cover every morph
      // target, so culling still works when one is driven to full influence.
      // That makes it the wrong ruler for framing: a part showing its *basis*
      // shape still carries its targets -- `resolveShape` hands back the
      // original geometry untouched when no morph applies -- while every
      // morphed part is a baked clone with its targets stripped. So the basis
      // measured 12 mm taller and longer than the shapes either side of it,
      // the centre moved, and `controls.target` followed: picking the first
      // design panned the camera while the others did not.
      bounds.union(baseBounds(geometry));
    }

    if (!bounds.isEmpty()) {
      this.bounds.copy(bounds);
      bounds.getCenter(this.centre);
      this.radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 1);
      // Measured, but the camera is *not* re-aimed here.
      //
      // Shapes differ in height by a few millimetres, so re-targeting on every
      // geometry swap slid the product a little on each one -- and dragging
      // the wheel, which resolves a new blend per pointer move, turned that
      // into a continuous drift. The one thing you are doing at that moment is
      // comparing silhouettes, which needs them to sit still and differ only
      // in shape. The new bounds are kept so the view buttons still frame
      // correctly; `frame()` owns aiming.
    }
    void frame;

    if (this.config) this.applyConfig(this.config);
    // Frame once, when the real bounds first arrive -- not on every swap,
    // which is what caused the drift described above.
    if (!this.framedGeometry && !bounds.isEmpty()) {
      this.framedGeometry = true;
      this.frame();
    } else if (!this.framed) {
      this.frame();
    }
    this.needsRender = true;
  }

  applyConfig(config: Configuration): void {
    this.config = config;
    for (const key of this.materials.keys()) this.paint(key, config);

    this.meshes.get('bridge')?.position.setY(config.bridge.height);

    this.needsRender = true;
  }

/*
 * `setHighlight` used to live here: hovering a step in the rail ghosted every
 * part that step did not own down to 22% opacity.
 *
 * Removed, and not only because it was distracting. It wrote `opacity` and
 * `transparent` straight onto the materials, and on hover-*out* restored them
 * from the **CSV row** rather than from the paint that actually applied. For
 * the clear lens the CSV says `0.10, transparent` while `paint` says
 * `opacity 1, transmission 0.96` -- so every pass of the cursor over the step
 * list left the lens rendering as a 10%-opaque ghost until some later config
 * change happened to repaint it. That is the flicker between "default", the
 * real lens, and the previous selection: it tracked the mouse, not the
 * choices.
 *
 * Anything that wants to show a part in a different state has to go through
 * `paint`, which is the single place that knows what a part should look like.
 * A second writer to the same properties is how the two disagree.
 */

  pick(clientX: number, clientY: number, rect: DOMRect): ComponentId | null {
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera as THREE.Camera);
    const hits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    if (hits.length === 0) return null;
    const part = hits[0].object.userData.part as PartKey | undefined;
    return part ? PART_COMPONENT[part] : null;
  }

  private materialFor(key: PartKey): THREE.MeshStandardMaterial {
    const existing = this.materials.get(key);
    if (existing) return existing;
    // Physical, but typed and configured as standard. `MeshPhysicalMaterial`
    // extends `MeshStandardMaterial`, so the CSV and `applySpec` are unchanged
    // -- it only adds the transmission and clearcoat that acetate needs.
    const material = new THREE.MeshPhysicalMaterial({ side: THREE.FrontSide });
    this.materials.set(key, material);
    if (this.config) this.paint(key, this.config);
    return material;
  }

  /**
   * Shade one part.
   *
   * Everything physical comes from the CSV; only the colour comes from the
   * design, and only for the pieces the customer can colour. Which pieces
   * those are is decided by the table too: a row with a high `metalness` is
   * metal and keeps its own colour, so moving the bridge from acetate to
   * metal is a spreadsheet edit rather than a code change.
   */
  private paint(key: PartKey, config: Configuration): void {
    const material = this.materials.get(key);
    if (!material) return;

    const spec = materialTable()[PART_PIECE[key]];
    const program = programKey(material as THREE.MeshPhysicalMaterial);
    applySpec(material, spec);

    if (key === 'lens') {
      const type = LENS_TYPES[config.lens.type];
      const physical = material as THREE.MeshPhysicalMaterial;
      material.color.set(lensColour(config));
      material.map = null;
      material.metalness = 0;
      material.roughness = spec.roughness;
      physical.clearcoat = type.reflectivity;
      physical.clearcoatRoughness = spec.clearcoatRoughness;

      if (type.glass) {
        // Refracting, not faded: opaque to the blender, transparent by
        // transmission. `depthWrite` stays on because the surface is still a
        // solid object as far as sorting is concerned.
        physical.transmission = type.transmission ?? 0.96;
        physical.thickness = 2;
        physical.ior = 1.52;
        material.opacity = 1;
        material.transparent = false;
        material.depthWrite = true;
      } else {
        physical.transmission = 0;
        physical.thickness = 0;
        material.opacity = type.opacity;
        material.transparent = true;
        material.depthWrite = false;
      }
    } else if (spec.metalness > 0.5) {
      // The CSV still owns metalness and the environment response; only the
      // tint and the roughness come from the chosen finish.
      const metal = METALS[METAL_SOURCE[key] === 'temple' ? config.temple.metal : config.bridge.metal];
      material.color.set(metal.hex);
      material.roughness = metal.roughness;
    } else {
      const colour =
        key === 'templeLeft' || key === 'templeRight'
          ? templeColourSpec(config)
          : frameColour(config);
      applyColour(material as THREE.MeshPhysicalMaterial, colour, { repeat: spec.mapRepeat });
    }

    // Recompile only when the *program* changed.
    //
    // `needsUpdate` throws away the compiled shader and builds a new one, and
    // this ran on every material on every click -- including the lens, whose
    // transmission shader is the most expensive in the scene. Colour,
    // roughness and opacity are uniforms; they need no recompile at all. Only
    // the keys below select a different program.
    if (programKey(material as THREE.MeshPhysicalMaterial) !== program) {
      material.needsUpdate = true;
    }
  }

  /**
   * A slow turntable on arrival.
   *
   * The product loads dead still, and a still render of a 3D object looks
   * like a photograph of it -- there is nothing to say the view can be moved,
   * and the arms and profile, which are most of the design, never get seen.
   * A quarter turn answers that before anyone has to read the hint.
   *
   * It yields immediately: the first drag, wheel or view button ends it, and
   * it eases out over its last seconds rather than stopping dead, so a
   * customer who simply waits is not left wondering whether something broke.
   */
  startIntro(): void {
    if (this.reducedMotion()) return;
    this.introStart = performance.now();
    this.needsRender = true;
  }

  endIntro(): void {
    this.introStart = null;
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /**
   * Advance the turntable. Returns true while it still owns the camera.
   *
   * The wave is two sine terms whose periods do not divide into each other,
   * so the drift never repeats on a beat the eye can catch and lock onto --
   * which is what makes a single sine read as machinery rather than as a hand
   * holding something up to the light. Amplitude is under two degrees; enough
   * to be alive, not enough to look like a fault.
   */
  private advanceIntro(): boolean {
    if (this.introStart === null || this.camera !== this.perspective) return false;

    const t = (performance.now() - this.introStart) / 1000;
    if (t >= INTRO.duration) {
      this.introStart = null;
      return false;
    }

    // Ease out over the tail so it comes to rest instead of cutting.
    const fade = Math.min(1, (INTRO.duration - t) / INTRO.settle);
    const eased = fade * fade * (3 - 2 * fade);

    this.introAzimuth += INTRO.speed * eased * (1 / 60);
    const polar =
      this.introPolar +
      eased * (Math.sin(t * 0.83) * INTRO.waveA + Math.sin(t * 1.97 + 1.1) * INTRO.waveB);

    // Positioned by hand rather than through the controls: this build of
    // OrbitControls exposes only the angle getters. Writing `camera.position`
    // is equivalent -- `update()` re-derives its own spherical state from the
    // offset between the camera and the target on every call.
    // About the centre of the product's own bounding box, which is what
    // `controls.target` holds -- so the whole frame stays in shot through the
    // sweep instead of the far end swinging out of it.
    const target = this.controls.target;
    this.spherical.setFromVector3(this.scratch.copy(this.camera.position).sub(target));
    this.spherical.theta = this.introAzimuth;
    this.spherical.phi = THREE.MathUtils.clamp(polar, 0.05, Math.PI - 0.05);
    this.camera.position.copy(target).add(this.scratch.setFromSpherical(this.spherical));
    this.camera.lookAt(target);
    return true;
  }

  /**
   * Render only when something changed.
   *
   * The product is static between interactions, so a plain rAF loop would
   * redraw an identical frame sixty times a second and keep a laptop fan
   * spinning while the customer reads the price.
   */
  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const moving = this.advanceIntro();
    const damping = this.controls.update();
    if (this.needsRender || damping || moving) {
      this.renderer.render(this.scene, this.camera as THREE.Camera);
      this.needsRender = false;
    }
  };

  dispose(): void {
    this.running = false;
    this.stopWatchingTextures?.();
    this.controls.dispose();
    if (this.backdrop) {
      this.backdrop.geometry.dispose();
      (this.backdrop.material as THREE.Material).dispose();
    }
    for (const material of this.materials.values()) material.dispose();
    this.scene.background = null;
    this.scene.environment = null;
    this.renderer.dispose();
  }
}
