/* ------------------------------------------------------------------
   Shared WebGL stage — renderer, camera, lights, environment, props,
   post chain and the frame loop.  Both the wheel page and the section
   pages sit on top of this.

   This scene is cheap in geometry and expensive in pixels: 36 draw
   calls and 16k triangles, but every one of those pixels goes through
   a physically-based shader, and then the whole frame went through a
   twelve-pass bloom.  So everything below is about *fill rate*, not
   about drawing less.

   Two levers, in order of how much they buy:

     PIXEL_BUDGET   the canvas is capped by total pixels, not by device
                    pixel ratio alone.  On a 2560-wide monitor the old
                    "min(dpr, 1.5)" gave the landing page a 3840x1907
                    canvas — 7.3 megapixels, shaded every frame.
     bloom          twelve fullscreen passes.  Worth it on the landing
                    page, where the wheel is the subject; not worth it
                    behind a panel and a scrim, where the difference is
                    invisible.  Off means the four postprocessing
                    modules are never even fetched.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { EnvManager } from './env/procedural.js';
import { createProps } from './env/props.js';
import { DEFAULT_THEME } from './env/themes.js';
import { tuneTransmission, PALETTE, LOW_POWER } from './env/materials.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* How many pixels a frame is allowed to be, whatever the monitor.  A
   4K window at devicePixelRatio 2 would otherwise ask for 33 megapixels
   of physically-based shading; nobody's GPU is doing that at 60fps and
   nobody can see the difference through a scrim. */
const PIXEL_BUDGET = { hero: 3_200_000, backdrop: 2_000_000 };

function budgetedRatio(maxDpr, budget) {
  const want = Math.min(devicePixelRatio, maxDpr);
  const area = Math.max(1, innerWidth * innerHeight);
  /* pixels scale with the square of the ratio */
  return Math.min(want, Math.max(0.75, Math.sqrt(budget / area)));
}

/* The landing page is the hero: it renders as well as the machine allows.
   On a section or project page the same scene is only a backdrop behind
   a scrolling wall of media, so it runs at a lower frame rate, a smaller
   pixel budget and no bloom — the drift is slow enough that nobody can
   tell, and it leaves the main thread to the content. */
export async function createStage(canvas, themeKeys,
    { fps = 0, quality = 1, bloom = true, budget = bloom ? 'hero' : 'backdrop' } = {}) {
  const t0 = performance.now();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const maxDpr = (LOW_POWER ? 1.25 : 1.5) * quality;
  const pixelBudget = PIXEL_BUDGET[budget] || PIXEL_BUDGET.backdrop;
  renderer.setPixelRatio(budgetedRatio(maxDpr, pixelBudget));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  tuneTransmission(renderer);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07070b, 0.030);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 8);

  /* lights are tinted per theme by the EnvManager */
  const ambient = new THREE.AmbientLight(0x50505c, 0.22);
  const key = new THREE.DirectionalLight(0xffffff, 1.25);
  key.position.set(3, 5, 6);
  const rim = new THREE.DirectionalLight(0x6f7bff, 0.8);
  rim.position.set(-5, -2, 3);
  const bounce = new THREE.PointLight(PALETTE.accent, 16, 16, 2);
  bounce.position.set(0, -3.2, 2.4);
  bounce.userData.base = 16;
  scene.add(ambient, key, rim, bounce);

  const env = new EnvManager(renderer, scene, { key, rim, bounce });
  await env.build([DEFAULT_THEME, ...themeKeys]);

  const props = createProps(scene, themeKeys);

  /* drifting dust, always on */
  const N = LOW_POWER ? 220 : 420;
  const dpos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 7 + Math.random() * 16;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    dpos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    dpos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
    dpos[i * 3 + 2] = r * Math.cos(ph) * 0.5 - 6;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.035, color: 0xd0d0d8, transparent: true, opacity: 0.45,
    sizeAttenuation: true, depthWrite: false
  }));
  scene.add(dust);

  /* ---------------- the post chain, if this page earns one ----------------
     UnrealBloomPass is a luminosity pass, five blur mips taken twice
     (horizontal and vertical) and a composite — thirteen fullscreen
     draws counting OutputPass, on top of the scene itself.  The landing
     page pays that because the wheel's glow is the whole image.  A
     backdrop behind a panel does not, and because the import is dynamic
     it does not even download the four modules. */
  let composer = null;
  let bloomPass = null;

  if (bloom) {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
      await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js')
      ]);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    /* bloom is a blur — running it at half resolution is free quality */
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.40, 0.85, 0.68);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  const listeners = [];
  const clock = new THREE.Clock();
  /* only pay for a full matrix walk if somebody is going to read the
     matrices — that is the landing page projecting labels onto slices */
  let needsMatrixPass = false;

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(budgetedRatio(maxDpr, pixelBudget));
    renderer.setSize(innerWidth, innerHeight);
    if (composer) {
      composer.setSize(innerWidth, innerHeight);
      bloomPass.setSize(innerWidth / 2, innerHeight / 2);
    }
    listeners.forEach(l => l.resize && l.resize());
  }
  addEventListener('resize', resize);

  const minFrameMs = fps > 0 ? 1000 / fps - 1 : 0;
  let lastTick = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    /* a capped stage still gets every rAF, it just skips the work —
       cheaper than rendering, and the clock keeps the motion honest */
    if (minFrameMs) {
      if (now - lastTick < minFrameMs) return;
      lastTick = now;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    env.update(dt);
    props.update(dt, t, env.activeKey());
    bounce.intensity = (bounce.userData.base || 16) * (0.85 + Math.sin(t * 0.8) * 0.15);
    dust.rotation.y += dt * 0.012;
    dust.rotation.x += dt * 0.004;

    listeners.forEach(l => l.frame && l.frame(dt, t));
    if (needsMatrixPass) {
      /* not forced: three.js keeps the dirty flags honest, and forcing
         it walked every node in the graph a second time per frame */
      scene.updateMatrixWorld();
      listeners.forEach(l => l.afterMatrix && l.afterMatrix(dt, t));
    }

    /* No document.hidden guard here, deliberately.  Chrome already stops
       calling rAF for a hidden tab, so skipping the draw buys nothing —
       and anything that reports hidden while still painting (a screenshot
       tool, a tab-hover preview, some embedded webviews) would get a
       canvas that never receives a frame. */
    if (composer) composer.render();
    else renderer.render(scene, camera);   // tone mapping and colour space still apply
  }

  const stage = {
    renderer, scene, camera, composer, bloom: bloomPass, env, props,
    _weights: props.weights,
    lights: { ambient, key, rim, bounce },
    on(l) { listeners.push(l); if (l.afterMatrix) needsMatrixPass = true; },
    resize,
    start() { resize(); frame(performance.now()); }
  };
  stage.bootMs = Math.round(performance.now() - t0);
  window.__stage = stage;
  return stage;
}
