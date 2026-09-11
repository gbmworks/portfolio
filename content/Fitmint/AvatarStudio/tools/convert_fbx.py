"""
Fitmint Avatar Studio - FBX -> GLB conversion.

Run headless:
  blender.exe -b -P convert_fbx.py -- <SRC_MALE_DIR> <OUT_ITEMS_DIR> [only_substring]

Every wardrobe FBX carries a full duplicate of the 275-bone rig; we keep the
armature (glTF needs joints for the skin) but the runtime re-binds each mesh
onto the skeleton that ships inside Male.glb, so the copy costs ~20 KB and is
thrown away after load.

Materials are rebuilt from scratch instead of trusting the Phong import: the
source FBX wire their maps through ShininessExponent / NormalMap / DiffuseColor
and several reference textures that no longer exist on disk.
"""

import bpy
import os
import sys
import json

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1])
ONLY = argv[2] if len(argv) > 2 else None

MAX_TEX = 1024

# ---------------------------------------------------------------- texture index

IMAGES = {}
for root, _dirs, files in os.walk(SRC):
    for f in files:
        if f.lower().endswith(('.jpg', '.jpeg', '.png')):
            IMAGES.setdefault(f.lower(), os.path.join(root, f))

# Beard01 ships as beard08_Normal.jpg in the FBX; the file on disk is Beard01_Normal.jpg.
ALIAS = {'beard08_normal.jpg': 'beard01_normal.jpg'}


def find_image(name):
    base = os.path.basename(str(name).replace('\\', '/')).lower()
    base = ALIAS.get(base, base)
    return IMAGES.get(base)


# ------------------------------------------------------------------- overrides
# (fbx path relative to SRC, material name) -> patch
OVERRIDES = {
    ('Outfit/Top/militaryVest.fbx', 'military_camo'): {
        'base': 'militaryVest_Diffuse.png', 'alpha_from_base': True,
    },
    # White decal art on transparency. Driving the material's alpha from it
    # turns the sleeve into a near-invisible shell, so flatten the art onto a
    # dark sleeve instead and use the result as a plain colour map.
    ('Outfit/Top/tshirt_sleeve.fbx', 'Doctor sleeves'): {
        'base': 'alpha_sleeve.png', 'flatten': (0.016, 0.016, 0.021),
        'base_color': (1.0, 1.0, 1.0, 1.0), 'roughness': 0.5,
    },
    ('Outfit/Top/vest.fbx', 'vest'): {'roughness_map': 'vestBump&Roughness.jpg'},
    ('Outfit/Bottom/cargoShorts.fbx', 'cargoShorts'): {'roughness_map': 'cargoShortsBump.jpg'},
    ('Outfit/Headgear/helmet.fbx', 'helmet'): {'base': 'helmet_Diffuse.png'},
}


def classify(basename):
    b = basename.lower()
    if 'normal' in b:
        return 'normal'
    if 'roughness' in b or 'bump' in b:
        return 'roughness'
    return 'base'


def load_image(path, non_color):
    key = os.path.normpath(path)
    img = bpy.data.images.get(os.path.basename(key))
    if img is None or not img.has_data:
        img = bpy.data.images.load(key, check_existing=True)
    img.colorspace_settings.name = 'Non-Color' if non_color else 'sRGB'
    if max(img.size) > MAX_TEX and img.size[0] and img.size[1]:
        scale = MAX_TEX / max(img.size)
        img.scale(max(1, int(img.size[0] * scale)), max(1, int(img.size[1] * scale)))
    return img


def flatten_image(img, background):
    """Composite a decal over a solid colour and drop its alpha channel."""
    import numpy as np

    px = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    alpha = px[:, 3:4]
    px[:, :3] = px[:, :3] * alpha + np.array(background, dtype=np.float32) * (1.0 - alpha)
    px[:, 3] = 1.0
    img.pixels.foreach_set(px.reshape(-1))
    img.update()


def read_existing(mat):
    """Pull whatever the FBX importer managed to set, before we flatten the tree."""
    out = {'base_color': (0.8, 0.8, 0.8, 1.0), 'roughness': 0.5, 'metallic': 0.0, 'maps': {}}
    if not mat.use_nodes:
        return out
    bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        out['base_color'] = tuple(bsdf.inputs['Base Color'].default_value)
        out['roughness'] = float(bsdf.inputs['Roughness'].default_value)
        out['metallic'] = float(bsdf.inputs['Metallic'].default_value)
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            src = node.image.filepath_from_user() or node.image.filepath or node.image.name
            resolved = find_image(src)
            if resolved:
                out['maps'][classify(os.path.basename(resolved))] = resolved
    return out


def rebuild_material(mat, fbx_rel):
    info = read_existing(mat)
    patch = OVERRIDES.get((fbx_rel, mat.name), {})
    lname = mat.name.lower()

    base_color = patch.get('base_color', info['base_color'])
    roughness = patch.get('roughness', min(0.95, max(0.12, info['roughness'])))
    metallic = info['metallic']
    alpha = 1.0

    if 'metal' in lname or 'buckle' in lname:
        metallic, roughness = 1.0, min(roughness, 0.38)
    if 'glass' in lname:
        roughness, metallic, alpha = 0.06, 0.0, 0.30

    base_path = patch.get('base') and find_image(patch['base']) or info['maps'].get('base')
    rough_path = patch.get('roughness_map') and find_image(patch['roughness_map']) or info['maps'].get('roughness')
    normal_path = info['maps'].get('normal')
    alpha_from_base = patch.get('alpha_from_base', False)

    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (500, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (180, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Alpha' in bsdf.inputs:
        bsdf.inputs['Alpha'].default_value = alpha
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = 1.45

    y = 300
    if base_path:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = load_image(base_path, non_color=False)
        if patch.get('flatten'):
            flatten_image(tex.image, patch['flatten'])
        tex.location = (-360, y)
        y -= 320
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha_from_base:
            nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])

    if rough_path:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = load_image(rough_path, non_color=True)
        tex.location = (-360, y)
        y -= 320
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Roughness'])

    if normal_path:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = load_image(normal_path, non_color=True)
        tex.location = (-560, y)
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.location = (-240, y)
        nmap.inputs['Strength'].default_value = 1.0
        nt.links.new(tex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])

    transparent = alpha < 1.0 or alpha_from_base
    try:
        mat.surface_render_method = 'BLENDED' if transparent else 'DITHERED'
    except AttributeError:
        mat.blend_method = 'BLEND' if transparent else 'OPAQUE'
    mat.use_backface_culling = False
    return {
        'name': mat.name,
        'baseColor': [round(c, 4) for c in base_color[:3]],
        'roughness': round(roughness, 3),
        'metallic': round(metallic, 3),
        'transparent': transparent,
        'maps': {k: os.path.basename(v) for k, v in
                 (('base', base_path), ('roughness', rough_path), ('normal', normal_path)) if v},
    }


def export_one(fbx_abs, out_glb, fbx_rel):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(
        filepath=fbx_abs,
        use_custom_normals=True,
        ignore_leaf_bones=False,
        automatic_bone_orientation=False,
        global_scale=1.0,
    )

    report = {'meshes': [], 'materials': [], 'tris': 0, 'shapeKeys': [], 'bones': 0}
    for obj in list(bpy.data.objects):
        if obj.type == 'ARMATURE':
            report['bones'] = max(report['bones'], len(obj.data.bones))
        if obj.type != 'MESH':
            continue
        me = obj.data
        report['meshes'].append(obj.name)
        report['tris'] += sum(max(0, len(p.vertices) - 2) for p in me.polygons)
        if me.shape_keys:
            for kb in me.shape_keys.key_blocks[1:]:
                if kb.name not in report['shapeKeys']:
                    report['shapeKeys'].append(kb.name)

    seen = set()
    for mat in bpy.data.materials:
        if mat.name in seen:
            continue
        seen.add(mat.name)
        report['materials'].append(rebuild_material(mat, fbx_rel))

    os.makedirs(os.path.dirname(out_glb), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_image_quality=80,
        export_skins=True,
        export_morph=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_def_bones=False,
    )
    report['bytes'] = os.path.getsize(out_glb)
    return report


CATEGORY = {
    'FacialHair': 'facialHair',
    'Hair': 'hair',
    'Outfit/Headgear': 'headgear',
    'Outfit/Footwear': 'footwear',
    'Outfit/Top': 'top',
    'Outfit/Bottom': 'bottom',
    'Outfit/Overalls': 'overalls',
}

jobs = []
for root, _dirs, files in os.walk(SRC):
    rel_dir = os.path.relpath(root, SRC).replace('\\', '/')
    cat = CATEGORY.get(rel_dir)
    if not cat:
        continue
    for f in sorted(files):
        if not f.lower().endswith('.fbx'):
            continue
        rel = rel_dir + '/' + f
        if ONLY and ONLY.lower() not in rel.lower():
            continue
        # If the artist shipped a GLB beside the FBX, that one wins - it carries
        # real PBR values and its own textures. build_overalls.mjs handles those.
        if os.path.exists(os.path.join(root, os.path.splitext(f)[0] + '.glb')):
            print('[SKIP] %s - a .glb ships beside it' % rel)
            continue
        item_id = os.path.splitext(f)[0]
        jobs.append((rel, os.path.join(root, f), cat, item_id))

results = {}
for rel, fbx_abs, cat, item_id in jobs:
    out_glb = os.path.join(OUT, cat, item_id + '.glb')
    try:
        rep = export_one(fbx_abs, out_glb, rel)
        rep['category'] = cat
        rep['id'] = item_id
        rep['source'] = rel
        results[cat + '/' + item_id] = rep
        print('[OK]  %-34s %7.1f KB  tris=%-7d meshes=%d mats=%d' %
              (rel, rep['bytes'] / 1024, rep['tris'], len(rep['meshes']), len(rep['materials'])))
    except Exception as exc:  # keep going; one bad asset should not stop the batch
        print('[FAIL] %s -> %s' % (rel, exc))
        results[cat + '/' + item_id] = {'error': str(exc), 'category': cat, 'id': item_id, 'source': rel}

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, '_report.json'), 'w', encoding='utf-8') as fh:
    json.dump(results, fh, indent=2)
print('\nWrote %d items to %s' % (len(results), OUT))
