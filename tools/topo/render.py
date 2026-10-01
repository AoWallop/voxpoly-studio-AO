# ===== Render a model from several angles (Workbench · orthographic camera) to study its shape =====
# usage: blender -b --factory-startup -P tools/topo/render.py -- <in.fbx|glb> <out_prefix> [texdir] [res] [albedo.png] [mat]
# output: <out_prefix>_<view>.png (front · q34 · side · back · top) · custom views: VIEWS="a:120:40,b:60:60" (name:azimuth:elevation)
import bpy, sys, os, math, glob
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, prefix = a[0], a[1]
texdir = a[2] if len(a) > 2 else None
res = int(a[3]) if len(a) > 3 else 700
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src)
else: bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']

# relink missing base-color textures (FBX files often point to the author's disk)
if texdir:
    for o in objs:
        for m in o.data.materials:
            if not m or not m.use_nodes: continue
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image and not os.path.exists(bpy.path.abspath(n.image.filepath)):
                    base = os.path.basename(n.image.filepath)
                    hit = glob.glob(os.path.join(texdir, base))
                    if hit: n.image.filepath = hit[0]; n.image.reload()

# argv[4] = an albedo image to plug into every material (studio GLBs do not embed textures)
if len(a) > 4 and a[4]:
    img = bpy.data.images.load(a[4])
    for o in objs:
        for m in o.data.materials:
            if not m: continue
            m.use_nodes = True; nt = m.node_tree
            bs = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img; tx.interpolation = 'Closest'
            if bs: nt.links.new(tx.outputs['Color'], bs.inputs['Base Color'])

mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
ctr = (mn + mx) / 2; size = max(mx - mn) * 1.15

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.color_type = 'MATERIAL' if (len(a) > 5 and a[5] == 'mat') else 'TEXTURE'
sc.display.shading.light = 'STUDIO'
sc.display.shading.show_cavity = True
sc.display.shading.show_object_outline = True
sc.render.resolution_x = sc.render.resolution_y = res
sc.render.film_transparent = False
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.09, 0.1, 0.12)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = size
# camera: azimuth around Z (0 = looking from -Y = front) · elevation
import os
VIEWS_ENV = os.environ.get('VIEWS')   # e.g. VIEWS='a:120:40,b:60:60' (name:azimuth:elevation) · unset = 5 standard views
VW = [(n, float(x), float(y)) for n, x, y in (v.split(':') for v in VIEWS_ENV.split(','))] if VIEWS_ENV else [('front', 0, 0), ('q34', 35, 15), ('side', 90, 0), ('back', 180, 0), ('top', 0, 89)]
for name, az, el in VW:
    r = size * 3; t = math.radians(az); e = math.radians(el)
    d = Vector((math.sin(t) * math.cos(e), -math.cos(t) * math.cos(e), math.sin(e)))
    cam.location = ctr + d * r
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{prefix}_{name}.png'
    bpy.ops.render.render(write_still=True)
print('[RENDER] done', prefix)
