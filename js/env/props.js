/* ------------------------------------------------------------------
   Themed backdrop geometry.

   The sky sets the light; these sit inside it and set the scene.
   Each builder returns { group, update(dt), setWeight(w) } and every
   material fades on `weight` so themes can cross-dissolve.
   ------------------------------------------------------------------ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  PALETTE, clearGlass, translucentGlass, frostedGlass,
  chrome, brushedChrome, graphite, iridescent, dichroic
} from './materials.js';

const TAU = Math.PI * 2;

/* ----------------------------------------------------------------
   Screen-aware placement.

   Backdrop props sit behind live UI, so they are positioned by where
   they land on screen rather than by raw world units.  (sx, sy) are
   fractions of the visible frame at that depth: the wheel and the
   page copy occupy roughly |sx| < 0.46, so KEEP_OUT is the radius
   nothing solid should be placed inside.
   ---------------------------------------------------------------- */
const CAM_Z = 8;
const FOV = 42;
const REF_ASPECT = 16 / 9;
const KEEP_OUT = 0.60;

function frameHalf(z) {
  return Math.tan((FOV * Math.PI / 180) / 2) * (CAM_Z - z);
}
/* screen fraction -> world position at depth z */
function place(sx, sy, z) {
  const halfH = frameHalf(z);
  return new THREE.Vector3(sx * halfH * REF_ASPECT, sy * halfH, z);
}
/* a random spot outside the keep-out zone */
function scatter(z, minX = KEEP_OUT, maxX = 1.05, spreadY = 0.75) {
  const sx = (minX + Math.random() * (maxX - minX)) * (Math.random() < 0.5 ? -1 : 1);
  return place(sx, (Math.random() - 0.5) * 2 * spreadY, z);
}

/* collects every material in a subtree so weight can drive opacity */
function fadeable(group) {
  const mats = [];
  group.traverse(o => {
    if (!o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    list.forEach(m => {
      m.transparent = true;
      /* remember the *original* opacity once — refresh() must not
         capture a mid-fade value as the new baseline */
      if (m.userData.__baseOpacity === undefined) m.userData.__baseOpacity = m.opacity;
      mats.push({ m, base: m.userData.__baseOpacity });
    });
  });
  return mats;
}

function wrap(builder) {
  return () => {
    let mats;
    const api = {
      /* async additions (a loaded glTF) call this so they fade too */
      refresh: () => { mats = fadeable(built.group); }
    };
    const built = builder(api);
    mats = fadeable(built.group);
    let weight = 0;
    built.group.visible = false;

    let shown = false;
    api.group = built.group;
    api.update = (dt, t) => { if (built.group.visible) built.tick(dt, t, weight); };
    api.setWeight = (w) => {
      /* heavy assets only load the first time this world is actually shown */
      if (!shown && w > 0.01) { shown = true; if (built.onFirstShow) built.onFirstShow(); }
      weight = w;
      built.group.visible = w > 0.015;
      mats.forEach(({ m, base }) => { m.opacity = base * w; });
      built.group.scale.setScalar(0.92 + 0.08 * w);
    };
    return api;
  };
}

/* ----------------------------------------------------------------
   PORTFOLIO.glb — a rigged character with two baked clips.  The file
   carries no materials, so the PBR set in assets/3d/ is wired up by
   hand (glTF UVs need flipY = false).
   ---------------------------------------------------------------- */
function loadCharacter(onReady) {
  const texLoader = new THREE.TextureLoader().setPath('assets/3d/');
  const tex = (file, srgb = false) => {
    const t = texLoader.load(file);
    t.flipY = false;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const material = new THREE.MeshStandardMaterial({
    map: tex('diffuse_new.jpg', true),
    normalMap: tex('normal_new.jpg'),
    roughnessMap: tex('rough_new.png'),
    metalnessMap: tex('metal_new.png'),
    roughness: 1.0,
    metalness: 1.0,
    envMapIntensity: 1.15,
    transparent: true,
    opacity: 1
  });

  new GLTFLoader().load('assets/3d/PORTFOLIO.glb', (gltf) => {
    const root = gltf.scene;
    root.traverse(o => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.material = material;
      o.frustumCulled = false;          // skinned bounds go stale mid-run
    });

    let mixer = null;
    const clips = gltf.animations || [];
    if (clips.length) {
      mixer = new THREE.AnimationMixer(root);
      const clip = clips.find(c => /run/i.test(c.name)) || clips[0];
      mixer.clipAction(clip).play();
    }
    onReady(root, mixer, clips);
  }, undefined, (err) => {
    console.warn('[props] PORTFOLIO.glb failed to load', err);
  });
}

/* ================================================================
   01 · Industrial Design — exploded assemblies over a blueprint floor
   ================================================================ */
const buildIndustrial = wrap(() => {
  const group = new THREE.Group();

  /* blueprint floor */
  const grid = new THREE.GridHelper(90, 60, 0x9aa0aa, 0x3c3c44);
  grid.position.y = -5.2;
  grid.material.transparent = true;
  grid.material.opacity = 0.38;
  group.add(grid);


  /* one exploded stack: parts separated along Y with a leader line */
  function assembly(seed) {
    const g = new THREE.Group();
    const parts = [
      new THREE.CylinderGeometry(0.95, 0.95, 0.16, 48),
      new THREE.TorusGeometry(0.72, 0.11, 16, 48),
      new THREE.CylinderGeometry(0.42, 0.62, 0.42, 32),
      new THREE.BoxGeometry(1.15, 0.14, 1.15),
      new THREE.TorusGeometry(0.46, 0.07, 14, 40),
      new THREE.CylinderGeometry(0.2, 0.2, 1.05, 24)
    ];
    /* an exploded stack reads best when the materials alternate:
       mirror, glass, machined, mirror, frost, graphite */
    const mats = [
      chrome(),
      translucentGlass(0xdcdce2, { transmission: 0, opacity: 0.55 }),
      brushedChrome(),
      chrome(0xe4e4ea),
      frostedGlass(0xc8c8d0, { transmission: 0, opacity: 0.62 }),
      graphite()
    ];
    parts.forEach((geo, i) => {
      const m = new THREE.Mesh(geo, mats[i]);
      if (geo.type === 'TorusGeometry') m.rotation.x = Math.PI / 2;
      m.userData.rest = (i - (parts.length - 1) / 2) * 0.62;
      m.position.y = m.userData.rest;
      g.add(m);
    });

    /* centre axis + tick marks, the exploded-view leader */
    const axis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 5.4, 6),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.55 })
    );
    g.add(axis);

    g.userData.seed = seed;
    return g;
  }

  const a1 = assembly(0.0); a1.position.copy(place(-0.74,  0.02,  -9)); a1.scale.setScalar(1.10);
  const a2 = assembly(1.7); a2.position.copy(place( 0.76, -0.16, -11)); a2.scale.setScalar(1.00);
  const a3 = assembly(3.1); a3.position.copy(place(-0.88,  0.44, -15)); a3.scale.setScalar(0.80);
  const a4 = assembly(4.4); a4.position.copy(place( 0.92,  0.38, -16)); a4.scale.setScalar(0.72);
  group.add(a1, a2, a3, a4);

  /* floating dimension frames */
  const frameMat = new THREE.LineBasicMaterial({ color: 0xc0c4cc, transparent: true, opacity: 0.28 });
  for (let i = 0; i < 5; i++) {
    const w = 1.6 + Math.random() * 2.4;
    const h = 1.0 + Math.random() * 1.8;
    const pts = [
      new THREE.Vector3(-w, -h, 0), new THREE.Vector3(w, -h, 0),
      new THREE.Vector3(w, h, 0), new THREE.Vector3(-w, h, 0)
    ];
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), frameMat.clone());
    line.position.copy(scatter(-11 - Math.random() * 7, 0.66));
    line.userData.spin = (Math.random() - 0.5) * 0.06;
    group.add(line);
  }

  const stacks = [a1, a2, a3, a4];
  return {
    group,
    tick: (dt, t) => {
      stacks.forEach((g, i) => {
        g.rotation.y += dt * (0.12 + i * 0.03);
        const breathe = 0.55 + 0.45 * Math.sin(t * 0.5 + g.userData.seed);
        g.children.forEach(c => {
          if (c.userData.rest === undefined) return;
          c.position.y = c.userData.rest * (0.35 + breathe * 1.15);
          c.rotation.y += dt * 0.15;
        });
      });
      group.children.forEach(c => {
        if (c.userData.spin) c.rotation.z += dt * c.userData.spin;
      });
    }
  };
});

/* ================================================================
   02 · Technical Art — meshing chrome / glass / dichroic gearing
   ================================================================ */
function gearGeometry(teeth, root, tip, thickness, hole) {
  const shape = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [root, a + step * 0.00], [root, a + step * 0.16],
      [tip,  a + step * 0.26], [tip,  a + step * 0.46],
      [root, a + step * 0.58], [root, a + step * 0.84]
    ];
    pts.forEach(([r, ang], k) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, TAU, true);
  shape.holes.push(h);

  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6
  }).translate(0, 0, -thickness / 2);
}

const buildTechnical = wrap(() => {
  const group = new THREE.Group();

  const mirror  = chrome();
  const satin   = brushedChrome();
  const film    = iridescent();
  const glass   = translucentGlass(0xd6d8de, { roughness: 0.10, transmission: 0, opacity: 0.55 });
  const frost   = frostedGlass(0xc8c8d0, { transmission: 0, opacity: 0.62 });

  /* a meshed train: radius ∝ teeth so the pitch lines actually touch */
  const M = 0.115;                                   // module (tooth size)
  /* both trains are anchored at the frame edges and grow outward, so
     the gearing never crawls in over the wheel */
  const train = [
    { teeth: 34, mat: mirror, at: [-0.74,  0.04,  -8.5], dir:  1 },
    { teeth: 18, mat: film,   at: null, dir: -1, from: 0, angle: -2.55 },
    { teeth: 26, mat: glass,  at: null, dir:  1, from: 1, angle:  2.55 },
    { teeth: 14, mat: satin,  at: null, dir: -1, from: 2, angle: -2.05 },
    { teeth: 30, mat: mirror, at: [ 0.78, -0.20, -10.5], dir:  1 },
    { teeth: 16, mat: film,   at: null, dir: -1, from: 4, angle:  0.55 },
    { teeth: 22, mat: frost,  at: [ 0.92,  0.46, -15.5], dir:  1 }
  ];

  const gears = [];
  train.forEach((spec, i) => {
    const r = spec.teeth * M / 2;
    const geo = gearGeometry(spec.teeth, r * 0.86, r, 0.20 + r * 0.06, r * 0.22);
    const mesh = new THREE.Mesh(geo, spec.mat.clone());

    if (spec.at) {
      mesh.position.copy(place(...spec.at));
    } else {
      const parent = gears[spec.from];
      const d = parent.userData.r + r;
      mesh.position.set(
        parent.position.x + Math.cos(spec.angle) * d,
        parent.position.y + Math.sin(spec.angle) * d,
        parent.position.z
      );
    }
    mesh.userData.r = r;
    mesh.userData.speed = spec.dir * (0.9 / spec.teeth) * 12;
    /* hub */
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.30, r * 0.30, 0.32 + r * 0.06, 20),
      graphite()
    );
    hub.rotation.x = Math.PI / 2;
    mesh.add(hub);
    gears.push(mesh);
    group.add(mesh);
  });

  /* piping */
  const pipeMat = satin.clone();
  for (let i = 0; i < 4; i++) {
    const len = 5 + Math.random() * 7;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, len, 14), pipeMat);
    pipe.position.copy(scatter(-12 - Math.random() * 6, 0.70));
    pipe.rotation.z = Math.random() * Math.PI;
    group.add(pipe);
  }

  /* a driven rod + piston, because steam */
  const rodGroup = new THREE.Group();
  rodGroup.position.copy(place(-0.66, -0.62, -10));
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 24),
                             clearGlass(0xffffff, { transmission: 0, opacity: 0.5 }));
  cyl.rotation.z = Math.PI / 2;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 16), chrome());
  rod.rotation.z = Math.PI / 2;
  rod.position.x = 1.6;
  rodGroup.add(cyl, rod);
  group.add(rodGroup);

  return {
    group,
    tick: (dt, t) => {
      gears.forEach(g => { g.rotation.z += g.userData.speed * dt; });
      rod.position.x = 1.6 + Math.sin(t * 1.6) * 0.45;
      group.rotation.y = Math.sin(t * 0.06) * 0.05;
    }
  };
});

/* ================================================================
   03 · Visualization — neon terrain and drifting solids
   ================================================================ */
const buildVisualization = wrap((api) => {
  const group = new THREE.Group();

  const W = 8 * Math.PI;                 // the z period the terrain wraps on
  const seg = 56;
  const geo = new THREE.PlaneGeometry(90, W * 2, seg, seg);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const h = 1.15 * Math.sin(x * 0.31) * Math.cos(y * 0.5)
            + 0.70 * Math.cos(x * 0.17 + y * 0.25);
    pos.setZ(i, h * (0.35 + Math.min(1, Math.abs(x) / 22)));   // valley down the middle
  }
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xcfd2da, wireframe: true, transparent: true, opacity: 0.40,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(0, -4.4, -10);
  group.add(terrain);

  /* horizon bar */
  const bar = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 0.05),
    new THREE.MeshBasicMaterial({
      color: PALETTE.accent, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  bar.position.set(0, -4.3, -34);
  group.add(bar);

  /* drifting solids */
  const solids = [];
  /* faceted solids only — no knots */
  const shapes = [
    new THREE.IcosahedronGeometry(0.9, 0),
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.DodecahedronGeometry(0.95, 0)
  ];
  for (let i = 0; i < 7; i++) {
    const g = shapes[i % shapes.length];
    const solid = new THREE.Group();

    /* dichroic and iridescent, alternating — the film does the colour */
    /* iridescence is free; refraction is not — the film carries the look */
    const solidMat = i % 2 === 0 ? iridescent()
                   : dichroic(0xffffff, { transmission: 0, opacity: 0.62 });
    const body = new THREE.Mesh(g, solidMat);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(g, 20),
      new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    solid.add(body, edges);
    solid.position.copy(scatter(-9 - Math.random() * 10, 0.64, 1.0, 0.62));
    solid.userData.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3
    );
    solid.userData.bob = Math.random() * TAU;
    solid.userData.y = solid.position.y;
    solids.push(solid);
    group.add(solid);
  }

  /* the rigged character, running on the neon deck */
  const hero = new THREE.Group();
  hero.position.copy(place(-0.70, 0, -5.2));
  hero.position.y = -4.35;                    // feet stay on the deck
  hero.rotation.y = 0.42;
  hero.scale.setScalar(3.0);
  group.add(hero);

  let mixer = null;

  /* a pool of light under the runner */
  const spot = new THREE.PointLight(PALETTE.accent, 14, 12, 2);
  spot.position.copy(place(-0.70, 0, -5.2));
  spot.position.y = -1.4;
  spot.position.z = -3.6;
  group.add(spot);

  let scroll = 0;
  return {
    group,
    /* the 3 MB character + its maps are fetched the first time the
       visualization world is hovered, not on every page load */
    onFirstShow: () => loadCharacter((root, m) => {
      hero.add(root);
      mixer = m;
      api.refresh();                  // pick up the glTF materials for fading
    }),
    tick: (dt, t) => {
      if (mixer) mixer.update(dt);
      hero.position.y = -4.35 + Math.sin(t * 0.4) * 0.05;
      spot.intensity = 14 + Math.sin(t * 2.2) * 5;
      scroll = (scroll + dt * 3.2) % W;
      terrain.position.z = -10 + scroll;
      solids.forEach(s => {
        s.rotation.x += s.userData.spin.x * dt;
        s.rotation.y += s.userData.spin.y * dt;
        s.rotation.z += s.userData.spin.z * dt;
        s.position.y = s.userData.y + Math.sin(t * 0.6 + s.userData.bob) * 0.5;
      });
      bar.material.opacity = 0.55 + Math.sin(t * 1.2) * 0.2;
    }
  };
});

/* ---------------------------------------------------------------- */

const BUILDERS = {
  'industrial-design': buildIndustrial,
  'technical-art': buildTechnical,
  'visualization': buildVisualization
};

export function createProps(scene, keys) {
  const props = new Map();
  const weights = new Map(keys.filter(k => BUILDERS[k]).map(k => [k, 0]));

  /* A world's geometry is only built the first time it is shown — the
     gear extrusions and the terrain are not cheap, and two of the three
     are never looked at on any given visit. */
  const ensure = (k) => {
    if (props.has(k) || !BUILDERS[k]) return props.get(k);
    const p = BUILDERS[k]();
    scene.add(p.group);
    props.set(k, p);
    return p;
  };

  return {
    weights,
    /* weights ease towards 1 for the active theme, 0 for the rest */
    update(dt, t, activeKey) {
      if (activeKey) ensure(activeKey);
      props.forEach((p, k) => {
        const target = k === activeKey ? 1 : 0;
        const w = weights.get(k) + (target - weights.get(k)) * (1 - Math.exp(-3.4 * dt));
        weights.set(k, w);
        p.setWeight(w);
        p.update(dt, t);
      });
    }
  };
}
