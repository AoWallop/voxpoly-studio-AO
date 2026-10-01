# ===== Dump vertices / faces / UVs of a model to JSON (for tools/topo/sheet.py and tools/topo/dist.py) =====
# usage: blender -b --factory-startup -P tools/topo/dump.py -- <in.fbx|glb> <out.json>
import bpy, sys, json
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src)
else: bpy.ops.import_scene.gltf(filepath=src)
parts = []
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    me = o.data; mw = o.matrix_world
    uv = me.uv_layers.active
    parts.append(dict(
        name=o.name,
        v=[list(mw @ v.co) for v in me.vertices],
        f=[list(p.vertices) for p in me.polygons],
        uv=[[list(uv.data[i].uv) for i in p.loop_indices] for p in me.polygons] if uv else None))
json.dump(parts, open(out, 'w'))
print('[DUMP]', len(parts), 'parts ->', out)
