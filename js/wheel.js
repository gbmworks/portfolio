/* ------------------------------------------------------------------
   The wheel: extruded slices, projected HTML labels, hover/active
   animation.  Shared by the landing page and every section page, so
   the selector stays present as navigation throughout the site.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { damp } from './stage.js';
import { PALETTE, frostedGlass, chrome, brushedChrome } from './env/materials.js';

const TAU = Math.PI * 2;

/* the donut is golden: outer / band = phi, so inner = outer / phi^2 */
const PHI = 1.6180339887;

export const CFG = {
  outerR: 2.15,
  innerR: 2.15 / (PHI * PHI),          // 0.821
  /* how much of the viewport half-height the wheel's radius takes up */
  screenFrac: 0.578,
  depth: 0.20,
  gap: 0.075,
  pullOut: 0.30,
  pullLift: 0.16,
  pullTilt: 0.13
};

export function sliceShape(a0, a1, ri, ro) {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, ro, a0, a1, false);
  sh.absarc(0, 0, ri, a1, a0, true);
  sh.closePath();
  return sh;
}

export class Wheel {
  constructor({ sections, scene, camera, labelsEl }) {
    this.sections = sections;
    this.camera = camera;
    this.hover = -1;
    this.active = -1;
    this.spin = 0;
    this.entrance = 0;
    this.globalFade = 1;   // gallery pages fade the whole wheel out on scroll
    this.view = { rigX: 0, rigY: 0, scale: 1 };
    this.parallax = new THREE.Vector2();
    this.enableParallax = matchMedia('(hover: hover) and (pointer: fine)').matches;
    this._tmp = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();

    this.rig = new THREE.Group();
    this.rig.rotation.x = -0.30;
    scene.add(this.rig);

    this.wheel = new THREE.Group();
    this.rig.add(this.wheel);

    this.sectors = sections.map((def, i) => this._buildSector(def, i, sections.length));
    this.meshes = this.sectors.map(s => s.mesh);

    /* centre hub */
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(CFG.innerR - 0.12, CFG.innerR - 0.12, 0.07, 96),
      brushedChrome(0x4a4a52, { roughness: 0.36, envMapIntensity: 1.5 })
    );
    hub.rotation.x = Math.PI / 2;
    this.wheel.add(hub);

    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(CFG.innerR - 0.05, 0.006, 8, 120),
      chrome()
    );
    this.wheel.add(hubRing);
    this.hubMeshes = [hub, hubRing];

    this._buildHud();
    this.labels = labelsEl ? this._buildLabels(labelsEl) : [];
  }

  _buildSector(def, i, n) {
    const step = TAU / n;
    const mid = Math.PI / 2 - i * step;
    const a0 = mid - step / 2 + CFG.gap / 2;
    const a1 = mid + step / 2 - CFG.gap / 2;

    const shape = sliceShape(a0, a1, CFG.innerR, CFG.outerR);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: CFG.depth, bevelEnabled: true,
      bevelThickness: 0.028, bevelSize: 0.028, bevelOffset: 0,
      bevelSegments: 3, curveSegments: 72
    });
    geo.translate(0, 0, -CFG.depth / 2);

    /* smoked glass; the fluorescent accent only lights up on hover */
    const mat = frostedGlass(0x70747e, {
      roughness: 0.34,
      transmission: 0.55,
      thickness: 2.4,
      ior: 1.48,
      attenuationColor: new THREE.Color(0x22242c),
      attenuationDistance: 1.1,
      emissive: new THREE.Color(PALETTE.accent),
      emissiveIntensity: 0.0,
      envMapIntensity: 1.15
    });

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.index = i;
    group.add(mesh);

    const pts = shape.getPoints(120).map(v => new THREE.Vector3(v.x, v.y, CFG.depth / 2 + 0.031));
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })
    );
    group.add(outline);
    this.wheel.add(group);

    return {
      def, i, group, mesh, mat, outline, mid,
      dir: new THREE.Vector3(Math.cos(mid), Math.sin(mid), 0),
      axis: new THREE.Vector3(-Math.sin(mid), Math.cos(mid), 0),
      labelLocal: new THREE.Vector3(
        Math.cos(mid) * (CFG.innerR + CFG.outerR) * 0.5,
        Math.sin(mid) * (CFG.innerR + CFG.outerR) * 0.5,
        CFG.depth / 2
      ),
      out: 0, lift: 0, tilt: 0, glow: 0.06, fade: 1, line: 0.28
    };
  }

  _buildHud() {
    const hud = new THREE.Group();
    this.wheel.add(hud);
    hud.add(new THREE.Mesh(
      new THREE.TorusGeometry(CFG.outerR + 0.30, 0.005, 8, 220),
      chrome()
    ));
    hud.add(new THREE.Mesh(
      new THREE.TorusGeometry(CFG.outerR + 0.52, 0.003, 6, 220),
      new THREE.MeshBasicMaterial({ color: 0x8a8a94, transparent: true, opacity: 0.30 })
    ));

    const ticks = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.012, 0.075),
      new THREE.MeshBasicMaterial({ color: 0xb0b0ba, transparent: true, opacity: 0.55 }),
      72
    );
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const R = CFG.outerR + 0.40;
      p.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      q.setFromAxisAngle(zAxis, a - Math.PI / 2);
      s.setScalar(i % 6 === 0 ? 1.9 : 1);
      ticks.setMatrixAt(i, m.compose(p, q, s));
    }
    hud.add(ticks);
    this.hud = hud;
  }

  _buildLabels(container) {
    return this.sectors.map(s => {
      const el = document.createElement('a');
      el.className = 'label';
      el.href = s.def.id + '.html';
      el.style.setProperty('--lc', s.def.glow);
      el.innerHTML =
        '<div class="label__icon">' + s.def.icon + '</div>' +
        '<h2 class="label__title">' + s.def.title + '</h2>';
      container.appendChild(el);
      el.querySelectorAll('.label__icon path, .label__icon circle').forEach(p => {
        const len = p.getTotalLength ? p.getTotalLength() : 120;
        p.style.setProperty('--len', len.toFixed(1));
      });
      return el;
    });
  }

  /* ------------------------------------------------------------ */

  pick(clientX, clientY) {
    this._ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this._ray.intersectObjects(this.meshes, false)[0];
    return hit ? hit.object.userData.index : -1;
  }

  setHover(i) {
    if (i === this.hover) return false;
    this.hover = i;
    this.labels.forEach((el, k) => el.classList.toggle('is-active', k === i || k === this.active));
    return true;
  }

  setActive(i) {
    this.active = i;
    this.labels.forEach((el, k) => el.classList.toggle('is-active', k === i || k === this.hover));
  }

  frame(dt, t, { idleSpin = true, entering = false } = {}) {
    this.entrance = damp(this.entrance, entering ? 0 : 1, 2.6, dt);

    this.rig.visible = this.globalFade > 0.01;
    const engaged = this.hover !== -1 || this.active !== -1;
    this.spin += ((idleSpin && !engaged) ? 0.055 : 0.004) * dt;
    this.wheel.rotation.z = this.spin + (1 - this.entrance) * -0.9;

    const px = this.enableParallax ? this.parallax.x : 0;
    const py = this.enableParallax ? this.parallax.y : 0;
    this.rig.rotation.x = damp(this.rig.rotation.x, -0.30 + py * 0.10, 3, dt);
    this.rig.rotation.y = damp(this.rig.rotation.y, px * 0.16, 3, dt);
    this.rig.position.x = damp(this.rig.position.x, this.view.rigX, 4, dt);
    this.rig.position.y = damp(this.rig.position.y, this.view.rigY + (1 - this.entrance) * -0.6, 4, dt);
    const sc = this.view.scale * (0.86 + 0.14 * this.entrance);
    this.rig.scale.setScalar(damp(this.rig.scale.x, sc, 4, dt));

    for (const s of this.sectors) {
      const isActive = s.i === this.active;
      const isHot = isActive || s.i === this.hover;
      const dim = this.active !== -1 && !isActive;
      const boost = isActive ? 1.30 : 1;

      s.out = damp(s.out, isHot ? CFG.pullOut * boost : 0, 7, dt);
      s.lift = damp(s.lift, isHot ? CFG.pullLift * boost : 0, 7, dt);
      s.tilt = damp(s.tilt, isHot ? CFG.pullTilt : 0, 7, dt);
      s.glow = damp(s.glow, dim ? 0.0 : (isHot ? 1.15 : 0.0), 6, dt);
      s.fade = damp(s.fade, dim ? 0.58 : 1, 6, dt);
      s.line = damp(s.line, dim ? 0.05 : (isHot ? 0.95 : 0.22), 6, dt);

      const float = isHot ? Math.sin(t * 2.1) * 0.012 : 0;
      s.group.position.set(s.dir.x * s.out, s.dir.y * s.out, s.lift + float);
      s.group.quaternion.setFromAxisAngle(s.axis, s.tilt);
      s.mat.emissiveIntensity = s.glow * this.globalFade;
      s.mat.opacity = s.fade * this.globalFade;
      s.outline.material.opacity = s.line * this.globalFade;
    }
  }

  projectLabels(hidden = false) {
    for (let i = 0; i < this.sectors.length; i++) {
      const s = this.sectors[i];
      this._tmp.copy(s.labelLocal).applyMatrix4(s.group.matrixWorld).project(this.camera);
      const x = (this._tmp.x * 0.5 + 0.5) * innerWidth;
      const y = (-this._tmp.y * 0.5 + 0.5) * innerHeight;
      const behind = this._tmp.z > 1;
      const dim = this.active !== -1 && i !== this.active;
      const el = this.labels[i];
      if (!el) continue;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%)';
      const base = (behind || hidden) ? 0 : (dim ? (i === this.hover ? 0.85 : 0.18) : 1);
      el.style.opacity = base * this.globalFade;
    }
  }

  /* Camera distance is chosen so the wheel occupies a fixed *fraction of
     the screen* rather than filling the frame — that is what actually
     controls how big it reads. */
  fitCamera(camera, frac = CFG.screenFrac) {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const tan = Math.tan(vFov / 2);
    const radius = CFG.outerR + CFG.pullOut;
    const distH = (radius / frac) / tan;
    /* never let it overflow a narrow viewport */
    const distW = (radius / 0.92) / (tan * camera.aspect);
    camera.position.z = Math.min(22, Math.max(5.4, Math.max(distH, distW)));
    camera.updateProjectionMatrix();
  }

  /* world units per screen pixel at the wheel's plane */
  perPixel(camera) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    return (halfH * 2) / innerHeight;
  }

  /* keeps a DOM element pinned to the wheel's centre */
  projectHub(el) {
    if (!el) return;
    this._tmp.set(0, 0, 0).applyMatrix4(this.rig.matrixWorld).project(this.camera);
    const x = (this._tmp.x * 0.5 + 0.5) * innerWidth;
    const y = (-this._tmp.y * 0.5 + 0.5) * innerHeight;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
  }
}
