import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT } from './environments.js';

/**
 * Studio stage: renderer, camera rig, lighting and the render loop.
 *
 * The loop is on-demand. It only draws when something asked it to (a camera
 * move, an equip, a slider) or while an animation clip is actually running, so
 * a posed avatar sitting still costs nothing.
 */

/**
 * Camera framings. `fit` is the world-space height the shot should contain and
 * `pitch` the elevation in degrees; the distance is solved from the field of
 * view so a framing holds at any viewport size. The avatar stands 1.81 m tall
 * with its feet on y = 0.
 */
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Half-extent of the key light's shadow frustum, in metres.
 *
 * It has to cover the avatar *and* the ground its shadow falls on. A 1.85 m
 * figure lit from the preset's minimum 18 degrees throws a shadow roughly 5 m
 * long, so a box hugging the body clips it off mid-stride - which is exactly
 * what a tight +/-1.3 did. This is the compromise: wide enough that the shadow
 * runs off the contact pad rather than ending in a straight cut, tight enough
 * that a 1k map still gives ~5 mm per texel.
 */
const SHADOW_RADIUS = 2.75;

// How much of the measured environment to keep once the point rig does the
// modelling. The sun still sets the shadow's direction and the overall cast.
//
// There is deliberately no hemisphere light here. One used to sit under all of
// this as ambient fill, but scene.environment is a pre-filtered probe of the
// real HDRI - it already supplies ambient from every direction, measured rather
// than approximated. Switching the hemisphere off moved the render by at most
// 2/255 on the face and not at all anywhere else, so it was doing nothing but
// adding a light to every shader permutation.
const SUN_SHARE = 0.35;
/** How much of the measured image-based lighting to use. */
const ENV_SHARE = 1.5;

/**
 * The character's own three-point rig, in point lights.
 *
 * Placed relative to the camera rather than the world, so the key is always on
 * the face and the rim always separates the silhouette from the backdrop,
 * whichever way you orbit. Azimuth is degrees from the camera's own bearing;
 * elevation is above the horizon; distance is metres from the chest.
 *
 * Point lights obey inverse-square falloff, so the intensities are candela and
 * scale with distance squared - they look absurd next to a directional light's
 * 1-3 range, but that is the unit.
 */
const CHARACTER_RIG = {
  key: { azimuth: 34, elevation: 26, distance: 2.8, intensity: 18, color: 0xfff2e2 },
  fill: { azimuth: -66, elevation: 4, distance: 3.4, intensity: 6.3, color: 0xd6e6ff },
  // High and well behind, and far weaker than a rim usually wants to be.
  // These garments are mostly rough fabric, which takes a back light as broad
  // fill rather than a crisp edge - crank it and a black suit turns grey. At
  // this level it reads where it should, on the metal fittings and the
  // shoulders, and leaves the blacks black.
  rim: { azimuth: 162, elevation: 38, distance: 2.7, intensity: 4.2, color: 0xcfe0ff },
};

/**
 * Softer than the physical inverse square.
 *
 * A standing figure is nearly two metres of subject, so true falloff leaves the
 * shoes several stops under the shoulders. Easing the exponent lights the whole
 * body evenly while keeping the directionality that makes the rig worth having.
 */
const RIG_DECAY = 1.6;

const _offset = new THREE.Vector3();
const _place = new THREE.Vector3();

/* How far the viewer may orbit out by hand. `frame()` raises it when a shot
   genuinely needs more room — the limit is there to stop somebody flying away
   from the avatar, not to decide how wide a framing is allowed to be. */
const ORBIT_MAX = 6;

const FRAMINGS = {
  full: { target: [0, 0.94, 0], fit: 2.2, pitch: 4 },
  upper: { target: [0, 1.34, 0], fit: 1.15, pitch: 3 },
  head: { target: [0, 1.63, 0], fit: 0.62, pitch: 2 },
  feet: { target: [0, 0.16, 0], fit: 0.6, pitch: 14 },
};

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.lastTime = 0;
    this.mixers = []; // { mixer, isActive }
    this.dirty = true;
    this.running = true;
    this.obstruction = { x: 0, y: 0 };
    this.framing = null;
    this.userMoved = false;
    this.environmentRotation = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
    this.camera.position.set(1.25, 1.35, 2.6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.45;
    this.controls.maxDistance = ORBIT_MAX;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.addEventListener('change', () => this.requestRender());
    // Once someone orbits or zooms by hand, stop re-framing under them.
    this.controls.addEventListener('start', () => { this.userMoved = true; });

    this.#buildLights();
    this.#buildGround();
    this.#pmrem = new THREE.PMREMGenerator(this.renderer);
    this.#pmrem.compileEquirectangularShader();
    this.#neutralProbe();
    this.setEnvironment(DEFAULT_ENVIRONMENT);

    this.frame('full', true);

    this.#observeSize();
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) {
        this.lastTime = 0; // drop the time spent hidden
        this.requestRender();
      }
    });
  }

  /**
   * Swap the lighting environment.
   *
   * The rig, exposure and chrome are applied immediately from the preset's
   * measured values; the HDRI itself streams in behind that and replaces the
   * probe when it lands, so switching never leaves the stage unlit. Each
   * environment is fetched and pre-filtered once per session.
   */
  async setEnvironment(id) {
    const preset = ENVIRONMENTS.find((e) => e.id === id) || ENVIRONMENTS[0];
    if (!preset) return;
    this.environment = preset.id;
    this.#applyPresetLook(preset);

    let loaded;
    try {
      loaded = await this.#probe(preset);
    } catch (err) {
      console.warn(`Could not load ${preset.label} HDRI; keeping the neutral probe.`, err);
      return;
    }
    if (this.environment !== preset.id) return; // a later switch already won

    // Lighting only. The stage behind the avatar is a flat white-to-grey
    // gradient in CSS, not the HDRI: a 1K equirect stretched across the
    // viewport is soft however it is sampled, and a clean backdrop reads better
    // for a wardrobe anyway.
    this.scene.environment = loaded.probe;
    this.requestRender();
  }

  /**
   * Spin the environment on its vertical axis.
   *
   * The backdrop, the image-based probe and the three-point rig all turn by the
   * same angle, so the sun you can see and the shadow it casts stay locked
   * together however far round you spin it.
   *
   * @param {number} degrees
   */
  setEnvironmentRotation(degrees) {
    this.environmentRotation = degrees;
    this.#applyRotation();
    this.requestRender();
  }

  /** Swing the character rig around to stay put relative to the camera. */
  #updateRig() {
    const bearing = _offset.subVectors(this.camera.position, this.aim.position).setY(0);
    if (bearing.lengthSq() < 1e-8) bearing.set(0, 0, 1);
    bearing.normalize();

    for (const [name, spec] of Object.entries(CHARACTER_RIG)) {
      const elevation = THREE.MathUtils.degToRad(spec.elevation);
      const place = _place
        .copy(bearing)
        .applyAxisAngle(UP, THREE.MathUtils.degToRad(spec.azimuth))
        .setLength(Math.cos(elevation) * spec.distance);
      place.y = Math.sin(elevation) * spec.distance;
      this.rig[name].position.copy(this.aim.position).add(place);
    }
  }

  #applyRotation() {
    const radians = THREE.MathUtils.degToRad(this.environmentRotation);
    this.scene.backgroundRotation.y = radians;
    this.scene.environmentRotation.y = radians;
    const base = this.key.userData.basePosition;
    if (base) this.key.position.copy(base).applyAxisAngle(UP, radians);
  }

  /** Lights, exposure and page chrome - everything that needs no download. */
  #applyPresetLook(preset) {
    this.scene.environmentIntensity = preset.envIntensity * ENV_SHARE;
    this.renderer.toneMappingExposure = preset.exposure;

    this.key.color.setHex(preset.key.color);
    this.key.intensity = preset.key.intensity * SUN_SHARE;
    this.key.userData.basePosition = new THREE.Vector3(...preset.key.position);
    this.#applyRotation();
    this.shadowPlane.material.opacity = preset.shadow;
    this.requestRender();
  }

  #probe(preset) {
    let pending = this.#probes.get(preset.id);
    if (!pending) {
      pending = new HDRLoader()
        .loadAsync(preset.hdr)
        .then((texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const probe = this.#pmrem.fromEquirectangular(texture).texture;
          texture.dispose(); // PMREM has taken what it needs
          return { probe };
        })
        .catch((err) => {
          this.#probes.delete(preset.id); // let a later attempt retry
          throw err;
        });
      this.#probes.set(preset.id, pending);
    }
    return pending;
  }

  /**
   * A neutral sky, filtered synchronously, so the very first frame is lit
   * before any HDRI has finished downloading.
   */
  #neutralProbe() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#d7dbe4');
    grad.addColorStop(1, '#8d9099');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    const probe = this.#pmrem.fromEquirectangular(texture).texture;
    texture.dispose();
    this.scene.environment = probe;
  }

  #pmrem = null;
  #probes = new Map();

  /**
   * Classic three-point rig aimed at the chest, plus a low hemisphere for the
   * ambient the image-based probe does not cover.
   *
   * Key carries the shadow and the form; fill sits opposite and lower at about
   * a third of the key so the shadow side stays readable without going flat;
   * rim comes from behind to separate hair and shoulders from the backdrop.
   * Every preset supplies its own colours and intensities.
   */
  #buildLights() {
    const aim = new THREE.Object3D();
    aim.position.set(0, 1.1, 0);
    this.scene.add(aim);

    // The environment's own sun. It still casts the shadow and keeps the
    // avatar sitting in the same light as the HDRI, but the modelling is the
    // point rig's job now, so it runs well under the preset's full strength.
    const sun = new THREE.DirectionalLight(0xfff4e8, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.018;
    // The ortho box has to hold the caster AND the ground its shadow lands on.
    const cam = sun.shadow.camera;
    cam.left = -SHADOW_RADIUS;
    cam.right = SHADOW_RADIUS;
    cam.top = SHADOW_RADIUS;
    cam.bottom = -SHADOW_RADIUS;
    cam.near = 0.1;
    cam.far = 14;
    cam.updateProjectionMatrix();
    sun.target = aim;
    this.scene.add(sun);
    this.key = sun;

    // Key in front, fill opposite and lower, rim behind for the edge.
    this.rig = {};
    for (const [name, spec] of Object.entries(CHARACTER_RIG)) {
      const light = new THREE.PointLight(spec.color, spec.intensity);
      light.decay = RIG_DECAY;
      light.castShadow = false; // the sun owns the shadow; two would double it
      this.scene.add(light);
      this.rig[name] = light;
    }

    this.aim = aim;
  }

  #buildGround() {
    const group = new THREE.Group();

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.receiveShadow = true;
    group.add(shadow);
    this.shadowPlane = shadow;

    // A soft radial pad under the feet: cheap ambient-occlusion contact.
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.38)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.15)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.002;
    group.add(pad);

    this.scene.add(group);
  }

  #observeSize() {
    const resize = () => {
      const w = this.canvas.clientWidth || 1;
      const h = this.canvas.clientHeight || 1;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.#applyFocusOffset(w, h);
      if (this.framing && !this.userMoved) this.frame(this.framing, true);
      this.requestRender();
    };
    new ResizeObserver(resize).observe(this.canvas);
    resize();
  }

  /**
   * The wardrobe panel covers part of the viewport, so shift the projection to
   * put the avatar in the middle of what is still visible rather than the
   * middle of the canvas.
   */
  #applyFocusOffset(w, h) {
    const { x, y } = this.obstruction;
    if (!x && !y) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, x / 2, y / 2, w, h);
    this.camera.updateProjectionMatrix();
  }

  /** Pixels of the viewport hidden behind UI, on the right (x) and bottom (y). */
  setObstruction(x = 0, y = 0) {
    this.obstruction = { x, y };
    this.#applyFocusOffset(this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    if (this.framing && !this.userMoved) this.frame(this.framing, true);
    this.requestRender();
  }

  addMixer(mixer, isActive = () => true) {
    this.mixers.push({ mixer, isActive });
  }

  requestRender() {
    this.dirty = true;
  }

  /** Move the camera to a named framing. Animated unless `immediate`. */
  frame(name, immediate = false) {
    const preset = FRAMINGS[name] || FRAMINGS.full;
    this.framing = name;
    this.userMoved = false;
    const target = new THREE.Vector3(...preset.target);

    /* Solve the distance that makes `fit` fill the shorter *visible* axis.

       The dock covers part of the canvas and #applyFocusOffset slides the
       picture into what is left — but sliding is not scaling. Solving against
       the whole canvas sizes the avatar for room the dock is standing on, and
       on a phone that is a third of the height. */
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    const visX = Math.max(0.3, (cw - this.obstruction.x) / cw);
    const visY = Math.max(0.3, (ch - this.obstruction.y) / ch);

    const fovY = THREE.MathUtils.degToRad(this.camera.fov);
    const vertical = preset.fit / 2 / (Math.tan(fovY / 2) * visY);
    const horizontal = preset.fit / 2 / (Math.tan(fovY / 2) * this.camera.aspect * visX);
    const wanted = Math.max(vertical, horizontal);

    /* The orbit limit must not cap the framing. On a phone `full` asked for
       6.9 and was clamped to 6, so Fit quietly delivered a shot 13% too close
       and stood the avatar's feet under the light bar. Let the shot have the
       room it asked for and lift the hand-orbit ceiling to match. */
    this.controls.maxDistance = Math.max(ORBIT_MAX, wanted);
    const distance = THREE.MathUtils.clamp(
      wanted,
      this.controls.minDistance,
      this.controls.maxDistance
    );

    // Keep the viewer's current orbit heading; only re-aim, pitch and distance.
    const heading = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .setY(0);
    if (heading.lengthSq() < 1e-6) heading.set(0.42, 0, 1);
    heading.normalize();

    const pitch = THREE.MathUtils.degToRad(preset.pitch);
    const to = target
      .clone()
      .addScaledVector(heading, Math.cos(pitch) * distance)
      .addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(pitch) * distance);

    if (immediate) {
      this.#tween = null; // drop any glide still in flight
      this.camera.position.copy(to);
      this.controls.target.copy(target);
      this.controls.update();
      this.requestRender();
      return;
    }

    this.#tween = {
      fromPos: this.camera.position.clone(),
      toPos: to,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      t: 0,
    };
    this.requestRender();
  }

  #stepTween(dt) {
    const tw = this.#tween;
    if (!tw) return false;
    tw.t = Math.min(1, tw.t + dt / 0.55);
    const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2; // easeInOutCubic
    this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
    this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
    if (tw.t >= 1) this.#tween = null;
    return true;
  }

  #tween = null;
  #raf = null;

  start() {
    const loop = () => {
      this.#raf = requestAnimationFrame(loop);
      if (!this.running) return;

      const now = performance.now() / 1000;
      const dt = this.lastTime ? Math.min(now - this.lastTime, 0.1) : 0;
      this.lastTime = now;
      let animating = this.#stepTween(dt);

      for (const { mixer, isActive } of this.mixers) {
        if (mixer.timeScale === 0 || !isActive()) continue;
        mixer.update(dt);
        animating = true;
      }

      // Damping keeps nudging the camera for a few frames after a drag ends.
      if (this.controls.enableDamping) {
        const moved = this.controls.update();
        animating ||= moved;
      }

      if (animating || this.dirty) {
        this.dirty = false;
        this.#updateRig();
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }

  /** PNG data URL of the current view, captured without a persistent buffer. */
  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL('image/png');
  }

  get maxAnisotropy() {
    return this.renderer.capabilities.getMaxAnisotropy();
  }
}
