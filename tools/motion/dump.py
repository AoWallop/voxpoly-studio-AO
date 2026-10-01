# ===== Read an animated FBX (Blender, headless) → JSON with the world position of every bone, every frame =====
# usage: blender -b --factory-startup -P tools/motion/dump.py -- <in.fbx> <out.json> [fps] [bones]
#   fps   = sampling rate (default 30)
#   bones = comma list to keep only some bones (big rigs) · "LIST" = print bone names and stop
# Output (Y-up meters, three.js axes: x right · y up · z front):
#   { file, bones:{name:parent}, rest:{name:{head,tail}}, actions:[{name, f0, f1, src_fps, fps, frames:[{bone:[head, tail]}]}] }
# Positions, not rotations: rotations depend on each rig's bone roll / rest pose, positions do not.
import bpy, sys, json, os
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
fps = int(argv[2]) if len(argv) > 2 else 30
ONLY = set(argv[3].split(',')) if len(argv) > 3 and argv[3] else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, automatic_bone_orientation=False)
sc = bpy.context.scene
src_fps = sc.render.fps / sc.render.fps_base                       # the importer sets the scene to the file's own frame rate
print('[DUMP] file frame rate', round(src_fps, 3))
arm = next((o for o in sc.objects if o.type == 'ARMATURE'), None)
if arm is None: print('[DUMP] no armature in', src); sys.exit(1)
if ONLY == {'LIST'}: print('[BONES]', ','.join(b.name for b in arm.data.bones)); sys.exit(0)
keep = lambda n: ONLY is None or n in ONLY
yup = lambda v: [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]          # Blender Z-up (front -Y) → Y-up (front +Z)
res = {'file': os.path.basename(src), 'bones': {}, 'rest': {}, 'actions': []}
w = arm.matrix_world
for b in arm.data.bones:
    if not keep(b.name): continue
    res['bones'][b.name] = b.parent.name if b.parent else None
    res['rest'][b.name] = {'head': yup(w @ b.head_local), 'tail': yup(w @ b.tail_local)}
act = arm.animation_data.action if arm.animation_data else None
acts = [act] if act and len(bpy.data.actions) <= 1 else list(bpy.data.actions)
for a in acts:
    arm.animation_data_create(); arm.animation_data.action = a
    f0, f1 = int(a.frame_range[0]), int(a.frame_range[1])
    frames, n = [], max(1, round((f1 - f0) / src_fps * fps))     # resample at `fps` (a 24 fps file still gives real seconds)
    for k in range(n + 1):
        f = f0 + k * src_fps / fps; sc.frame_set(int(f), subframe=f - int(f)); w = arm.matrix_world
        frames.append({pb.name: [yup(w @ pb.head), yup(w @ pb.tail)] for pb in arm.pose.bones if keep(pb.name)})
    name = a.name.split('|')[-1]                                    # "Armature|Walk" → "Walk"
    if len(acts) == 1:                                              # one clip per file: generic take names (BaseLayer, Take 001, mixamo.com) → use the file name
        base = os.path.splitext(os.path.basename(src))[0]
        name = base.split('@', 1)[1] if '@' in base else base       # Unity convention Name@clip.fbx
    res['actions'].append({'name': name, 'f0': f0, 'f1': f1, 'src_fps': round(src_fps, 3), 'fps': fps, 'frames': frames})
json.dump(res, open(out, 'w'))
print('[DUMP]', res['file'], 'bones', len(res['bones']), 'actions', [(a['name'], f"{(len(a['frames']) - 1) / fps:.2f}s") for a in res['actions']])
