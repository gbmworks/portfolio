"""
Prepares the source HDRIs for the web.

For each .exr:
  * a 1024x512 Radiance .hdr for the browser (RGBELoader + PMREM)
  * a 256x128 raw float32 RGB dump the Node side analyses without needing an
    EXR/RGBE decoder of its own

  blender.exe -b --factory-startup -P build_hdri.py -- <HDRI_DIR> <OUT_DIR>
"""

import bpy
import os
import sys
import json
import array

argv = sys.argv[sys.argv.index('--') + 1:]
SRC = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1])

WEB_W, WEB_H = 512, 256  # lighting only now - never shown as a backdrop
PROBE_W, PROBE_H = 256, 128

os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, 'probe'), exist_ok=True)

manifest = []

for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith(('.exr', '.hdr')):
        continue
    stem = os.path.splitext(name)[0]
    src = os.path.join(SRC, name)

    # The web copy: PMREM blurs this hard for lighting and the backdrop is shown
    # blurred, so 1K equirect is already more than the probe needs.
    img = bpy.data.images.load(src)
    source_size = tuple(img.size)
    img.scale(WEB_W, WEB_H)
    img.file_format = 'HDR'
    web = os.path.join(OUT, stem + '.hdr')
    img.filepath_raw = web
    img.save()

    # The analysis copy: plain float32 RGB, bottom row first (Blender order).
    img.scale(PROBE_W, PROBE_H)
    buf = array.array('f', [0.0]) * (PROBE_W * PROBE_H * 4)
    img.pixels.foreach_get(buf)
    rgb = array.array('f', [0.0]) * (PROBE_W * PROBE_H * 3)
    for i in range(PROBE_W * PROBE_H):
        rgb[i * 3] = buf[i * 4]
        rgb[i * 3 + 1] = buf[i * 4 + 1]
        rgb[i * 3 + 2] = buf[i * 4 + 2]
    probe = os.path.join(OUT, 'probe', stem + '.bin')
    with open(probe, 'wb') as fh:
        rgb.tofile(fh)

    bpy.data.images.remove(img)

    manifest.append({
        'id': stem,
        'source': name,
        'sourceSize': source_size,
        'hdr': os.path.basename(web),
        'hdrBytes': os.path.getsize(web),
        'probe': os.path.basename(probe),
        'probeSize': [PROBE_W, PROBE_H],
    })
    print('[HDRI] %-52s %5d x %-5d -> %6.0f KB' %
          (name, source_size[0], source_size[1], os.path.getsize(web) / 1024))

with open(os.path.join(OUT, '_hdri.json'), 'w', encoding='utf-8') as fh:
    json.dump(manifest, fh, indent=2)

print('Prepared %d HDRIs' % len(manifest))
