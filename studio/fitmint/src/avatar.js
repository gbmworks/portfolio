import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * The avatar and its wardrobe.
 *
 * Male.glb owns the only skeleton in the scene. Every wardrobe FBX was exported
 * with its own copy of the same 275-bone rig, so each item GLB arrives with a
 * matching-but-separate skeleton; on equip we swap the item's bone list for the
 * avatar's bones (matched by name, keeping the item's own inverse bind
 * matrices) and drop its armature. One skeleton drives everything, so a single
 * AnimationMixer animates the body and whatever it is wearing.
 */

const BODY_NODE = 'body';
const BROW_NODE = 'Eyebrow';

export class Avatar {
  constructor(viewer) {
    this.viewer = viewer;
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.textures = new THREE.TextureLoader();

    this.meshes = new Map(); // node name -> SkinnedMesh on the base body
    this.bones = new Map(); // bone name -> Bone in the master skeleton
    this.equipped = new Map(); // slot -> { id, objects[], materials[] }
    this.modelCache = new Map(); // url -> Promise<GLTF>
    this.textureCache = new Map();
    this.morphs = new Map(); // morph name -> current value
    this.hidden = new Set(); // slots suppressed by another item (helmet over hair)
  }

  async load(url, onProgress) {
    const gltf = await this.loader.loadAsync(url, (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
    });

    this.root = gltf.scene;
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds do not track the animation
      this.meshes.set(o.name, o);
    });

    const body = this.meshes.get(BODY_NODE);
    if (!body) throw new Error(`${url} has no "${BODY_NODE}" mesh`);
    this.attachPoint = body.parent; // the "rig" node; items become its children
    for (const bone of body.skeleton.bones) this.bones.set(bone.name, bone);

    const own = [];
    for (const mesh of this.meshes.values()) own.push(...toArray(mesh.material));
    tuneEnvironmentResponse(own);

    this.mixer = new THREE.AnimationMixer(this.root);
    this.viewer.addMixer(this.mixer, () => Boolean(this.current));
    this.clips = new Map(gltf.animations.map((c) => [c.name, c]));

    this.viewer.scene.add(this.root);
    this.viewer.requestRender();
    return this;
  }

  // ------------------------------------------------------------------ textures

  async #texture(url, { srgb = true } = {}) {
    let entry = this.textureCache.get(url);
    if (!entry) {
      entry = this.textures.loadAsync(url).then((tex) => {
        // glTF geometry expects unflipped UVs; TextureLoader flips by default.
        tex.flipY = false;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = this.viewer.maxAnisotropy;
        tex.needsUpdate = true;
        return tex;
      });
      this.textureCache.set(url, entry);
    }
    return entry;
  }

  /** Swap the base-colour map on one of the body's own materials. */
  async setTexture(nodeName, url) {
    const mesh = this.meshes.get(nodeName);
    if (!mesh) return;
    const tex = await this.#texture(url);
    for (const mat of toArray(mesh.material)) {
      mat.map = tex;
      mat.needsUpdate = true;
    }
    this.viewer.requestRender();
  }

  // -------------------------------------------------------------------- morphs

  /** Drive a morph target everywhere it appears - body, beard, anything worn. */
  setMorph(name, value) {
    this.morphs.set(name, value);
    let touched = false;
    this.#eachMorphTarget(name, (mesh, index) => {
      mesh.morphTargetInfluences[index] = value;
      touched = true;
    });
    if (touched) this.viewer.requestRender();
  }

  #eachMorphTarget(name, fn) {
    const visit = (mesh) => {
      const index = mesh.morphTargetDictionary?.[name];
      if (index !== undefined) fn(mesh, index);
    };
    for (const mesh of this.meshes.values()) visit(mesh);
    for (const entry of this.equipped.values()) {
      for (const o of entry.objects) if (o.isMesh) visit(o);
    }
  }

  /** Re-apply every stored morph to a freshly equipped item. */
  #syncMorphs(objects) {
    for (const [name, value] of this.morphs) {
      for (const o of objects) {
        const index = o.isMesh ? o.morphTargetDictionary?.[name] : undefined;
        if (index !== undefined) o.morphTargetInfluences[index] = value;
      }
    }
  }

  /** Eyebrow shapes are exclusive presets on a single mesh, not blendable. */
  setEyebrow(name) {
    const brow = this.meshes.get(BROW_NODE);
    if (!brow?.morphTargetInfluences) return;
    brow.morphTargetInfluences.fill(0);
    if (name) {
      const index = brow.morphTargetDictionary?.[name];
      if (index !== undefined) brow.morphTargetInfluences[index] = 1;
    }
    this.viewer.requestRender();
  }

  // ----------------------------------------------------------------- animation

  playAnimation(name, fade = 0.35) {
    const clip = this.clips.get(name);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
    this.mixer.timeScale = this.timeScale ?? 1;
    this.viewer.requestRender();
  }

  setPaused(paused) {
    this.timeScale = paused ? 0 : 1;
    if (this.mixer) this.mixer.timeScale = this.timeScale;
    this.viewer.requestRender();
  }

  // ------------------------------------------------------------------ wardrobe

  #model(url) {
    let promise = this.modelCache.get(url);
    if (!promise) {
      promise = this.loader.loadAsync(url);
      this.modelCache.set(url, promise);
    }
    return promise;
  }

  async equip(slot, item) {
    this.unequip(slot);
    if (!item) return null;

    const gltf = await this.#model(item.model);
    // Cached GLTFs are re-used across equips, so always work on a clone. The
    // clone shares geometry with the cache but gets its own materials, so a
    // tint applied now cannot leak into the next equip of the same item.
    const scene = cloneSkinned(gltf.scene);

    const objects = [];
    const materials = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      objects.push(o);
      for (const mat of toArray(o.material)) {
        // Remember the authored colour so a recolour can always be undone.
        mat.userData.originalColor = mat.color.clone();
        materials.push(mat);
      }
    });

    for (const mesh of objects) {
      this.attachPoint.add(mesh); // re-parent out of the item's own armature
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
    }
    this.attachPoint.updateMatrixWorld(true);
    for (const mesh of objects) if (mesh.isSkinnedMesh) this.#rebind(mesh);

    tuneEnvironmentResponse(materials);
    this.#syncMorphs(objects);

    const entry = { id: item.id, item, objects, materials };
    this.equipped.set(slot, entry);
    this.#applyVisibility();
    this.viewer.requestRender();
    return entry;
  }

  /**
   * Resolve an item's bone name against the avatar rig.
   *
   * The FBX exports carry 275 bones; Male.glb keeps the 199 that are actually
   * skinned and drops the unweighted "<bone>_end" leaf tips. Those tips still
   * appear in an item's joint list, so fall back to the bone they cap - that
   * keeps every joint attached to the live skeleton instead of leaving orphans
   * whose world matrix would never update again.
   */
  #resolveBone(name) {
    const direct = this.bones.get(name);
    if (direct) return direct;
    const stem = name.replace(/_end$/, '');
    return stem === name ? null : this.bones.get(stem) || null;
  }

  /** Point the item's skin at the avatar's bones, keeping its bind matrices. */
  #rebind(mesh) {
    const source = mesh.skeleton;
    const unresolved = [];
    const bones = source.bones.map((bone) => {
      const match = this.#resolveBone(bone.name);
      if (!match) unresolved.push(bone.name);
      return match || bone;
    });
    if (unresolved.length) {
      console.warn(`${mesh.name}: ${unresolved.length} bone(s) absent from the avatar rig`, unresolved);
    }
    mesh.bind(new THREE.Skeleton(bones, source.boneInverses), mesh.matrixWorld);
  }

  unequip(slot) {
    const entry = this.equipped.get(slot);
    if (!entry) return;
    for (const o of entry.objects) o.removeFromParent();
    // Geometry and textures belong to the cached source GLTF; only the
    // per-equip material clones are ours to release.
    for (const mat of entry.materials) mat.dispose();
    this.equipped.delete(slot);
    this.#applyVisibility();
    this.viewer.requestRender();
  }

  get(slot) {
    return this.equipped.get(slot) || null;
  }

  /** Slots a worn item covers, e.g. a helmet swallowing the hair. */
  setHiddenSlots(slots) {
    this.hidden = new Set(slots);
    this.#applyVisibility();
    this.viewer.requestRender();
  }

  #applyVisibility() {
    for (const [slot, entry] of this.equipped) {
      const visible = !this.hidden.has(slot);
      for (const o of entry.objects) o.visible = visible;
    }
  }

  /**
   * Materials of a worn item that carry no base-colour texture.
   *
   * Those are the ones worth exposing a colour picker for - a garment that
   * ships its own artwork would just have it tinted muddy.
   */
  recolorable(slot) {
    const entry = this.equipped.get(slot);
    if (!entry) return [];
    return entry.materials
      .map((mat, index) => ({
        index,
        name: mat.name,
        textured: Boolean(mat.map),
        metal: mat.metalness > 0.5,
      }))
      // Skip anything with its own artwork, and anything metal - a buckle's
      // colour is a property of the metal, not a palette choice.
      .filter((m) => !m.textured && !m.metal);
  }

  /** A material's colour right now, as a hex string. */
  materialColor(slot, index) {
    const mat = this.equipped.get(slot)?.materials[index];
    return mat ? '#' + mat.color.getHexString() : null;
  }

  /** The colour a material shipped with, before any recolour. */
  materialOriginalColor(slot, index) {
    const mat = this.equipped.get(slot)?.materials[index];
    return mat?.userData.originalColor ? '#' + mat.userData.originalColor.getHexString() : null;
  }

  /** Indices of a worn item's materials, looked up by name. */
  materialIndices(slot, names) {
    const materials = this.equipped.get(slot)?.materials ?? [];
    const wanted = new Set(names);
    return materials.reduce((out, mat, index) => {
      if (wanted.has(mat.name)) out.push(index);
      return out;
    }, []);
  }

  /** Set materials' colour, or pass null to restore the authored one. */
  setMaterialColor(slot, indices, hex) {
    const materials = this.equipped.get(slot)?.materials;
    if (!materials) return;
    for (const index of [].concat(indices)) {
      const mat = materials[index];
      if (!mat) continue;
      if (hex) mat.color.set(hex);
      else if (mat.userData.originalColor) mat.color.copy(mat.userData.originalColor);
      mat.needsUpdate = true;
    }
    this.viewer.requestRender();
  }
}

function toArray(material) {
  return Array.isArray(material) ? material : [material];
}

/**
 * Tune how each material answers the HDRI probe.
 *
 * Exposure is normalised per environment so the avatar is lit the same
 * everywhere, but that same scaling dulls metal, which should reflect the
 * environment at something close to its real brightness. Metals get the
 * difference back. Mirror-smooth finishes are also nudged off zero: the probe
 * is a 512 px HDRI, and a perfect mirror just shows its pixels.
 *
 * This is free at runtime - no extra textures, no extra passes. The reflections
 * come from the probe that is already bound to the scene.
 */
function tuneEnvironmentResponse(materials) {
  for (const mat of materials) {
    if (!mat.isMeshStandardMaterial) continue;
    const metal = mat.metalness > 0.5;
    mat.envMapIntensity = metal ? 1.75 : 1.0;
    if (metal) mat.roughness = Math.max(mat.roughness, 0.12);
    mat.needsUpdate = true;
  }
}

/**
 * SkeletonUtils.clone, inlined for the one case we need: the item scenes are a
 * flat armature + skinned meshes, and we only have to keep the mesh -> skeleton
 * wiring intact before re-binding.
 */
function cloneSkinned(source) {
  const clone = source.clone(true);

  const sourceLookup = new Map();
  const cloneLookup = new Map();
  parallelTraverse(source, clone, (a, b) => {
    sourceLookup.set(b, a);
    cloneLookup.set(a, b);
  });

  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const original = sourceLookup.get(node);
    const bones = original.skeleton.bones.map((bone) => cloneLookup.get(bone) || bone);
    node.bind(new THREE.Skeleton(bones, original.skeleton.boneInverses), node.matrixWorld);
  });

  return clone;
}

function parallelTraverse(a, b, callback) {
  callback(a, b);
  for (let i = 0; i < a.children.length; i++) parallelTraverse(a.children[i], b.children[i], callback);
}
