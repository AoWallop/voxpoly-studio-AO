# ===== GLB → FBX for Unity (Blender, headless) =====
# usage: blender -b --factory-startup -P tools/blender/glb_to_fbx.py -- <in.glb> <out.fbx>
# Locked settings: meters (Unity scale 1) · Y-up · no leftover object rotation (transform applied)
#                  normals exactly as the studio set them (soft/hard edges) · textures are NOT embedded (PNG files ship separately)
# At the end the FBX is re-imported to compare triangle count / size / pivot — catches silent conversion problems.
import bpy, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = os.path.abspath(argv[0]), os.path.abspath(argv[1])

def stats(tag):
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tris, lo, hi = 0, Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        me = o.data; me.calc_loop_triangles(); tris += len(me.loop_triangles)
        for v in me.vertices:
            w = o.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    size = hi - lo
    print(f'[{tag}] objects={len(objs)} tris={tris} size(m) X={size.x:.3f} Y={size.y:.3f} Z={size.z:.3f} '
          f'min=({lo.x:.3f},{lo.y:.3f},{lo.z:.3f}) rot={[tuple(round(a, 3) for a in o.rotation_euler) for o in objs]} '
          f'scale={[tuple(round(a, 3) for a in o.scale) for o in objs]} mats={[m.name for o in objs for m in o.data.materials]}')
    return tris

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=False)
t0 = stats('GLB')

bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type == 'MESH': o.select_set(True)
bpy.ops.export_scene.fbx(
    filepath=dst, use_selection=True, object_types={'MESH'},
    apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS',   # 1 unit = 1 m in Unity
    axis_forward='-Z', axis_up='Y', bake_space_transform=True,      # Unity Y-up, no -90° rotation left on the object
    mesh_smooth_type='OFF', use_mesh_modifiers=True,                # keep the existing normals (soft/hard from the studio)
    add_leaf_bones=False, bake_anim=False,
    path_mode='STRIP', embed_textures=False)
print(f'[FBX] wrote {dst} ({os.path.getsize(dst)} bytes)')

# verify: open the FBX we just wrote
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=dst)
t1 = stats('FBX-reimport')
print('[CHECK] tris', 'OK' if t0 == t1 else f'MISMATCH {t0} vs {t1}')
