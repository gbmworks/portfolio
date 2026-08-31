/* ------------------------------------------------------------------
   Procedural environments.

   Each theme is a fragment shader that paints a full 360° equirect
   sky into a half-float render target.  That target is then:

     1. run through PMREMGenerator  ->  scene.environment (the IBL that
        actually lights and reflects in the slices)
     2. sampled directly by a big inside-out sphere -> the visible sky

   Because the dome samples two maps at once we can cross-fade between
   themes; the PMREM swaps at the half-way point, hidden under a dip in
   environmentIntensity.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { THEMES, DEFAULT_THEME } from './themes.js';
import { loadHdriOverride } from './hdri.js';

const SIZE = { w: 512, h: 256 };   // PMREM downsamples anyway
const FADE = 0.85;           // seconds

/* ---------------------------------------------------------------- */
/* the sky shader                                                     */
/* ---------------------------------------------------------------- */

const SKY_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uSat;          // 0 = greyscale, 1 = the shader's own colour

  #define PI  3.14159265359
  #define TAU 6.28318530718

  /* three.js equirect convention, inverted:
     u = atan(z,x)/TAU + .5   v = asin(y)/PI + .5 */
  vec3 dirFromUv(vec2 uv){
    float phi   = (uv.x - 0.5) * TAU;
    float theta = (uv.y - 0.5) * PI;
    float cy    = cos(theta);
    return vec3(cy * cos(phi), sin(theta), cy * sin(phi));
  }

  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float hash31(vec3 p){
    p = fract(p * 0.3183099 + vec3(0.11, 0.27, 0.43));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x){
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  /* a hard-ish light source: 1 inside the cone, soft edge */
  float disc(vec3 d, vec3 l, float r, float soft){
    float a = acos(clamp(dot(d, normalize(l)), -1.0, 1.0));
    return 1.0 - smoothstep(r, r + soft, a);
  }
  /* a wide falloff glow */
  float glow(vec3 d, vec3 l, float p){
    return pow(max(dot(d, normalize(l)), 0.0), p);
  }

  /* ---------------- 0 · neutral studio ---------------- */
  vec3 studio(vec3 d){
    vec3 c = mix(vec3(0.016, 0.017, 0.028), vec3(0.048, 0.052, 0.072),
                 smoothstep(-0.35, 0.95, d.y));
    c += disc(d, vec3(0.45, 0.85, 0.35), 0.30, 0.42) * vec3(1.0, 0.99, 0.97) * 3.2;
    c += glow(d, vec3(-0.75, 0.30, -0.55), 2.2) * vec3(0.30, 0.38, 0.68) * 0.55;
    c += glow(d, vec3(0.85, 0.05, 0.45), 3.5) * vec3(0.55, 0.30, 0.18) * 0.45;
    c  = mix(c, vec3(0.016, 0.016, 0.022), smoothstep(0.0, -0.5, d.y));
    return c;
  }

  /* ---------------- 1 · industrial / manufacturing ---------------- */
  vec3 foundry(vec3 d){
    float u = atan(d.z, d.x) / TAU + 0.5;

    vec3 c = mix(vec3(0.026, 0.029, 0.038), vec3(0.055, 0.062, 0.080),
                 smoothstep(-0.30, 1.0, d.y));

    /* overhead skylight strips */
    float band  = smoothstep(0.30, 0.52, d.y) * (1.0 - smoothstep(0.88, 1.0, d.y));
    float strip = pow(max(sin(u * TAU * 3.0), 0.0), 14.0);
    c += band * strip * vec3(1.0, 0.975, 0.930) * 9.0;

    /* soft spill from the same strips */
    c += band * pow(max(sin(u * TAU * 3.0), 0.0), 3.0) * vec3(0.55, 0.56, 0.60) * 0.30;

    /* furnace / pour-off, low and to one side */
    c += disc(d, vec3(0.92, -0.02, 0.36), 0.16, 0.30) * vec3(1.0, 0.44, 0.13) * 5.5;
    c += glow(d, vec3(0.92, 0.02, 0.36), 3.0) * vec3(0.95, 0.38, 0.11) * 0.85;

    /* cool bounce off the far wall */
    c += glow(d, vec3(-0.65, 0.25, -0.70), 2.4) * vec3(0.26, 0.36, 0.62) * 0.38;

    /* faint blueprint gridding across the upper hall */
    vec2 g = abs(fract(vec2(u * 34.0, (d.y * 0.5 + 0.5) * 20.0)) - 0.5);
    float lines = (1.0 - smoothstep(0.0, 0.045, min(g.x, g.y)));
    c += lines * smoothstep(-0.1, 0.6, d.y) * vec3(0.18, 0.42, 0.62) * 0.055;

    /* concrete floor + amber bounce */
    c  = mix(c, vec3(0.024, 0.023, 0.022), smoothstep(0.0, -0.42, d.y));
    c += smoothstep(-0.05, -0.65, d.y) * vec3(0.30, 0.13, 0.05) * 0.42;
    return c;
  }

  /* ---------------- 2 · brass workshop ---------------- */
  vec3 workshop(vec3 d){
    vec3 c = mix(vec3(0.048, 0.033, 0.020), vec3(0.088, 0.062, 0.038),
                 smoothstep(-0.45, 0.85, d.y));

    /* tungsten bulbs */
    c += disc(d, vec3( 0.40, 0.55,  0.62), 0.045, 0.055) * vec3(1.0, 0.74, 0.40) * 16.0;
    c += disc(d, vec3(-0.72, 0.34,  0.28), 0.038, 0.050) * vec3(1.0, 0.68, 0.32) * 11.0;
    c += disc(d, vec3( 0.08, 0.22, -0.92), 0.032, 0.045) * vec3(1.0, 0.62, 0.26) *  8.0;

    /* their halos */
    c += glow(d, vec3( 0.40, 0.55,  0.62), 6.0) * vec3(1.0, 0.62, 0.30) * 1.35;
    c += glow(d, vec3(-0.72, 0.34,  0.28), 7.0) * vec3(1.0, 0.56, 0.24) * 0.90;

    /* steam drifting through the light */
    float s = fbm(d * 3.1 + vec3(0.0, 1.7, 0.0));
    c += smoothstep(0.42, 0.92, s) * smoothstep(-0.30, 0.55, d.y)
         * vec3(0.58, 0.44, 0.31) * 0.70;

    /* a cool sliver so brass does not read flat */
    c += glow(d, vec3(-0.25, 0.65, -0.72), 3.0) * vec3(0.16, 0.30, 0.34) * 0.45;

    /* oily floor with embers */
    c  = mix(c, vec3(0.026, 0.016, 0.010), smoothstep(0.0, -0.48, d.y));
    c += smoothstep(-0.08, -0.72, d.y) * vec3(0.38, 0.13, 0.03) * 0.55;
    return c;
  }

  /* ---------------- 3 · neon game world ---------------- */
  vec3 neon(vec3 d){
    vec3 c = mix(vec3(0.018, 0.014, 0.052), vec3(0.045, 0.020, 0.098),
                 smoothstep(-0.25, 1.0, d.y));

    /* magenta horizon band */
    c += exp(-abs(d.y) * 8.5) * vec3(0.95, 0.16, 0.62) * 0.95;

    /* cyan sun sitting on the horizon */
    c += disc(d, vec3(-0.52, 0.10, 0.85), 0.085, 0.10) * vec3(0.35, 1.0, 1.0) * 11.0;
    c += glow(d, vec3(-0.52, 0.10, 0.85), 4.0) * vec3(0.16, 0.72, 1.0) * 1.6;

    /* violet counter-glow */
    c += glow(d, vec3(0.80, 0.42, -0.42), 3.0) * vec3(0.62, 0.26, 1.0) * 1.0;

    /* stars, upper hemisphere only */
    vec2 sp = vec2(atan(d.z, d.x) * 5.5, d.y * 9.0);
    float st = step(0.9955, hash21(floor(sp * 42.0)));
    c += st * smoothstep(0.02, 0.45, d.y) * vec3(0.85, 0.93, 1.0) * 2.2;

    /* scanline haze */
    c += smoothstep(0.75, 1.0, sin(d.y * 220.0) * 0.5 + 0.5)
         * smoothstep(0.0, 0.5, d.y) * vec3(0.10, 0.30, 0.45) * 0.05;

    /* glowing ground plane */
    c  = mix(c, vec3(0.028, 0.010, 0.062), smoothstep(0.0, -0.38, d.y));
    c += smoothstep(-0.02, -0.55, d.y) * vec3(0.28, 0.06, 0.55) * 0.60;
    return c;
  }

  void main(){
    vec3 d = dirFromUv(vUv);
    vec3 c;
    #if THEME == 1
      c = foundry(d);
    #elif THEME == 2
      c = workshop(d);
    #elif THEME == 3
      c = neon(d);
    #else
      c = studio(d);
    #endif
    c = max(c, 0.0);
    /* the whole system is monochrome — drop to luminance, keep a whisper
       of the original hue so the worlds are not perfectly flat */
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(lum), c, uSat);
    gl_FragColor = vec4(c, 1.0);
  }
`;

/* dome that shows two skies at once so we can cross-fade */
const DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main(){
    vDir = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uMix;
  uniform float uIntensity;
  varying vec3 vDir;

  #define PI  3.14159265359
  #define TAU 6.28318530718

  vec2 equirectUv(vec3 d){
    return vec2(atan(d.z, d.x) / TAU + 0.5,
                asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  }

  void main(){
    vec3 d  = normalize(vDir);
    vec2 uv = equirectUv(d);
    vec3 c  = mix(texture2D(uA, uv).rgb, texture2D(uB, uv).rgb, uMix);

    /* the IBL keeps the full HDR range; the *visible* sky gets rolled
       off so blazing skylights read as glow instead of a white wall */
    c = c / (1.0 + c * 0.85);

    /* quiet the floor and the top corners so UI text stays legible */
    c *= mix(0.30, 1.0, smoothstep(-0.60, 0.00, d.y));
    c *= mix(1.0, 0.55, smoothstep(0.25, 0.95, d.y));
    gl_FragColor = vec4(c * uIntensity, 1.0);
  }
`;

/* ---------------------------------------------------------------- */
/* manager                                                            */
/* ---------------------------------------------------------------- */

export class EnvManager {
  constructor(renderer, scene, lights = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.lights = lights;
    this.maps = new Map();          // key -> { rt, env, theme }
    this.current = null;
    this.next = null;
    this.t = 1;
    this.swapped = true;

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(60, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: DOME_VERT,
        fragmentShader: DOME_FRAG,
        uniforms: {
          uA: { value: null }, uB: { value: null },
          uMix: { value: 0 }, uIntensity: { value: 0.5 }
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: true
      })
    );
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this._fogA = new THREE.Color();
    this._fogB = new THREE.Color();
    this._tmp = new THREE.Color();
    this._tmp2 = new THREE.Color();
  }

  /* renders one equirect sky and derives its PMREM */
  _bake(key) {
    const theme = THEMES[key];
    const rt = new THREE.WebGLRenderTarget(SIZE.w, SIZE.h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false
    });
    rt.texture.mapping = THREE.EquirectangularReflectionMapping;

    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      defines: { THEME: theme.shader },
      uniforms: { uSat: { value: theme.sat ?? 1 } },
      depthTest: false,
      depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const s = new THREE.Scene();
    s.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt);
    this.renderer.render(s, cam);
    this.renderer.setRenderTarget(prevTarget);

    quad.geometry.dispose();
    mat.dispose();

    const env = this.pmrem.fromEquirectangular(rt.texture).texture;
    return { rt, env, theme, sky: rt.texture };
  }

  /* Only the sky you can actually see is baked at boot; the others are
     baked the first time they are asked for, which keeps the cold start
     to a single render + PMREM instead of four. */
  async build(keys) {
    this.keys = keys.filter(k => THEMES[k]);
    this._ensure(DEFAULT_THEME);
    this.set(DEFAULT_THEME, true);
  }

  _ensure(key) {
    if (this.maps.has(key)) return this.maps.get(key);
    if (!THEMES[key]) return null;
    const baked = this._bake(key);
    this.maps.set(key, baked);
    /* a real .hdr, if one was dropped in, quietly replaces the bake */
    loadHdriOverride(key).then(over => {
      if (!over) return;
      baked.sky = over;
      baked.env = this.pmrem.fromEquirectangular(over).texture;
      if (this.activeKey() === key) this.set(key, true);
    });
    return baked;
  }

  set(key, instant = false) {
    if (!THEMES[key]) key = DEFAULT_THEME;
    this._ensure(key);
    if (key === (this.next ?? this.current) && !instant) return;

    const u = this.dome.material.uniforms;
    if (instant || !this.current) {
      this.current = key;
      this.next = null;
      this.t = 1;
      this.swapped = true;
      u.uA.value = this.maps.get(key).sky;
      u.uB.value = this.maps.get(key).sky;
      u.uMix.value = 0;
      this._apply(key, 1);
      return;
    }
    /* whatever is showing now becomes A, the target becomes B */
    u.uA.value = this.maps.get(this.t < 1 && this.next ? this.next : this.current).sky;
    if (this.t < 1 && this.next) this.current = this.next;
    u.uB.value = this.maps.get(key).sky;
    u.uMix.value = 0;
    this.next = key;
    this.t = 0;
    this.swapped = false;
  }

  /* light + fog + IBL settings for a theme, blended by `k` from neutral */
  _apply(key, k) {
    const th = THEMES[key];
    this.dome.material.uniforms.uIntensity.value = th.bgI;
    this.scene.environmentIntensity = th.envI * k;
    if (this.scene.fog) this.scene.fog.color.setHex(th.fog);
    const { key: kl, rim, bounce } = this.lights;
    if (kl) { kl.color.setHex(th.key); kl.intensity = th.keyI; }
    if (rim) { rim.color.setHex(th.rim); rim.intensity = th.rimI; }
    if (bounce) { bounce.color.setHex(th.bounce); bounce.userData.base = th.bounceI; }
    this.scene.environment = this.maps.get(key).env;
  }

  update(dt) {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / FADE);
    const e = this.t * this.t * (3 - 2 * this.t);           // smoothstep
    const u = this.dome.material.uniforms;
    u.uMix.value = e;

    const from = THEMES[this.current];
    const to = THEMES[this.next];

    /* dip the IBL through the middle so the PMREM swap is invisible */
    const dip = 0.55 + 0.45 * Math.abs(e * 2 - 1);
    if (!this.swapped && e >= 0.5) {
      this.scene.environment = this.maps.get(this.next).env;
      this.swapped = true;
    }
    this.scene.environmentIntensity = THREE.MathUtils.lerp(from.envI, to.envI, e) * dip;
    u.uIntensity.value = THREE.MathUtils.lerp(from.bgI, to.bgI, e);

    if (this.scene.fog) {
      this._fogA.setHex(from.fog);
      this._fogB.setHex(to.fog);
      this.scene.fog.color.copy(this._fogA).lerp(this._fogB, e);
    }
    const { key: kl, rim, bounce } = this.lights;
    const blend = (target, a, b) => {
      target.copy(this._tmp.setHex(a)).lerp(this._tmp2.setHex(b), e);
    };
    if (kl) {
      blend(kl.color, from.key, to.key);
      kl.intensity = THREE.MathUtils.lerp(from.keyI, to.keyI, e);
    }
    if (rim) {
      blend(rim.color, from.rim, to.rim);
      rim.intensity = THREE.MathUtils.lerp(from.rimI, to.rimI, e);
    }
    if (bounce) {
      blend(bounce.color, from.bounce, to.bounce);
      bounce.userData.base = THREE.MathUtils.lerp(from.bounceI, to.bounceI, e);
    }

    if (this.t >= 1) {
      this.current = this.next;
      this.next = null;
      this._apply(this.current, 1);
    }
  }

  activeKey() { return this.next ?? this.current; }
}
