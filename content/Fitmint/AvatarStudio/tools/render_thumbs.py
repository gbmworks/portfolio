"""
Renders a 320x320 thumbnail for every wardrobe item.

The stand-in body is posed on the idle clip - the same relaxed stance the app
opens on, rather than the splayed rest pose - lit by a white studio world plus a
three-point rig, and the camera auto-frames the item's *deformed* bounds, so a
beard reads as a face crop and a sneaker reads as a foot crop with no per-
category tuning.

  blender.exe -b --factory-startup -P render_thumbs.py -- <ITEMS_DIR> <OUT_DIR> [only]
"""

import bpy
import os
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
ITEMS = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1])
ONLY = argv[2] if len(argv) > 2 else None

BODY = os.path.join(ITEMS, 'Male.glb')
RES = 320
SAMPLES = 32
POSE_CLIP = 'idle'
POSE_FRAME = 30  # a settled beat of the idle cycle

# Hair and beards ship pure black with only a normal map, which disappears
# against a grey stand-in at thumbnail size. Colour is a separate control in
# the app, so render the silhouette in a readable mid-brown instead.
TINTED = {'hair': (0.075, 0.038, 0.018, 1.0), 'facialHair': (0.075, 0.038, 0.018, 1.0)}

# Beards hug the skin so closely that the stand-in head swallows them here
# (Blender re-derives the rest pose from each item's own armature, which sits a
# few millimetres proud of the one the runtime binds them to). Shown on their
# own the silhouette is unambiguous, which is what a picker needs anyway.
SOLO = {'facialHair'}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    # Some user add-ons drop a helper Icosphere into the scene on import.
    for o in list(new):
        if o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o, do_unlink=True)
            new.remove(o)
    return new


def pose_idle(objs, frame=POSE_FRAME):
    """
    Drive every armature in the scene from the idle clip.

    The clip only ever comes in with Male.glb, but each item carries its own
    copy of the same rig; the action addresses bones by name, so assigning it to
    both keeps the garment locked to the body. The glTF importer parks each clip
    in its own NLA track, which has to be muted for a directly assigned action
    to win.
    """
    action = bpy.data.actions.get(POSE_CLIP)
    if not action:
        return
    for o in objs:
        if o.type != 'ARMATURE':
            continue
        if not o.animation_data:
            o.animation_data_create()
        for track in o.animation_data.nla_tracks:
            track.mute = True
        o.animation_data.action = action
        slots = getattr(action, 'slots', None)  # Blender 4.4+ slotted actions
        if slots:
            o.animation_data.action_slot = slots[0]
    bpy.context.scene.frame_set(frame)


def flat_grey(objs, value=0.2):
    mat = bpy.data.materials.new('__stand_in')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (value, value, value * 1.08, 1)
    bsdf.inputs['Roughness'].default_value = 0.72
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    for o in objs:
        if o.type == 'MESH':
            o.data.materials.clear()
            o.data.materials.append(mat)


def tint(objs, rgba):
    for o in objs:
        if o.type != 'MESH':
            continue
        for mat in o.data.materials:
            if not mat or not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    node.inputs['Base Color'].default_value = rgba


def world_bounds(objs):
    """Bounds of the posed geometry - object bound_box is the undeformed cage."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != 'MESH':
            continue
        evaluated = o.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        for v in mesh.vertices:
            p = evaluated.matrix_world @ v.co
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
        evaluated.to_mesh_clear()
    return lo, hi


def setup_scene(target):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    try:
        scene.eevee.taa_render_samples = SAMPLES
    except AttributeError:
        pass
    scene.render.resolution_x = RES
    scene.render.resolution_y = RES
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'

    # Plain white studio dome: even ambient, no colour cast on the garments.
    world = bpy.data.worlds.new('W')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.92, 0.93, 0.95, 1)
    bg.inputs[1].default_value = 0.85

    # Three-point rig, aimed at whatever the shot is framing.
    for name, offset, energy, size in (
        ('key', (1.9, -2.3, 1.7), 420, 2.0),
        ('fill', (-2.4, -1.7, 0.7), 150, 3.5),
        ('rim', (-0.7, 2.6, 1.9), 320, 1.4),
    ):
        light_data = bpy.data.lights.new(name, type='AREA')
        light_data.energy = energy
        light_data.size = size
        obj = bpy.data.objects.new(name, light_data)
        obj.location = target + Vector(offset)
        bpy.context.collection.objects.link(obj)
        obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('Cam')
    cam_data.lens = 85
    cam = bpy.data.objects.new('Cam', cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    return cam


def frame(cam, lo, hi, pad=1.45):
    center = (lo + hi) * 0.5
    radius = max((hi - lo).length * 0.5, 0.04) * pad
    # Slight 3/4 view reads better than a flat front-on shot.
    direction = Vector((0.42, -1.0, 0.16)).normalized()
    dist = radius / math.tan(cam.data.angle * 0.5)
    cam.location = center + direction * dist
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()


items = []
for category in sorted(os.listdir(ITEMS)):
    cdir = os.path.join(ITEMS, category)
    if not os.path.isdir(cdir):
        continue
    for f in sorted(os.listdir(cdir)):
        if not f.endswith('.glb'):
            continue
        item_id = os.path.splitext(f)[0]
        # Match on "category/item" so a whole category can be re-rendered.
        if ONLY and ONLY.lower() not in ('%s/%s' % (category, item_id)).lower():
            continue
        items.append((category, item_id, os.path.join(cdir, f)))

for category, item_id, path in items:
    dst = os.path.join(OUT, category, item_id + '.png')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    clear()

    body = import_glb(BODY)
    flat_grey(body)
    if category in SOLO:
        for o in body:
            if o.type == 'MESH':
                o.hide_render = True

    item = import_glb(path)
    # The item ships its own copy of the rig; only the meshes are rendered.
    for o in item:
        if o.type == 'ARMATURE':
            o.hide_render = True
    if category in TINTED:
        tint(item, TINTED[category])

    pose_idle(body + item)

    lo, hi = world_bounds(item)
    cam = setup_scene((lo + hi) * 0.5)
    frame(cam, lo, hi)
    bpy.context.scene.render.filepath = dst
    bpy.ops.render.render(write_still=True)
    print('[THUMB] %s/%s' % (category, item_id))

print('Rendered %d thumbnails' % len(items))
