/* ------------------------------------------------------------------
   Shared WebGL stage — renderer, camera, lights, environment, props,
   post chain and the frame loop.  Both the wheel page and the section
   pages sit on top of this.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { EnvManager } from './env/procedural.js';
import { createProps } from './env/props.js';
import { DEFAULT_THEME } from './env/themes.js';
import { tuneTransmission, PALETTE, LOW_POWER } from './env/materials.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function createStage(canvas, themeKeys) {
  const t0 = performance.now();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW_POWER ? 1.25 : 1.5));
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

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  /* bloom is a blur — running it at half resolution is free quality */
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.40, 0.85, 0.68);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const listeners = [];
  const clock = new THREE.Clock();

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth / 2, innerHeight / 2);
    listeners.forEach(l => l.resize && l.resize());
  }
  addEventListener('resize', resize);

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    env.update(dt);
    props.update(dt, t, env.activeKey());
    bounce.intensity = (bounce.userData.base || 16) * (0.85 + Math.sin(t * 0.8) * 0.15);
    dust.rotation.y += dt * 0.012;
    dust.rotation.x += dt * 0.004;

    listeners.forEach(l => l.frame && l.frame(dt, t));
    scene.updateMatrixWorld(true);
    listeners.forEach(l => l.afterMatrix && l.afterMatrix(dt, t));

    composer.render();
    requestAnimationFrame(frame);
  }

  const stage = {
    renderer, scene, camera, composer, bloom, env, props,
    _weights: props.weights,
    lights: { ambient, key, rim, bounce },
    on(l) { listeners.push(l); },
    resize,
    start() { resize(); frame(); }
  };
  stage.bootMs = Math.round(performance.now() - t0);
  window.__stage = stage;
  return stage;
}
