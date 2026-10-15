# -*- coding: utf-8 -*-
"""
fbx_clone.py — copy a rigged FBX EXACTLY into JSON that three.js rebuilds 1:1 (models/clone.js).

Kept as-is, nothing re-meshed:
  * vertices in their original order · faces as authored (tris AND quads = the topology you want to study)
  * UV of every face corner · skin weights (top 4 per vertex, normalised) · rest skeleton
  * every clip from <Name>@<clip>.fbx files (all frames, every bone)
  * check points: where Blender puts sample vertices in each clip, so the page can prove the copy is exact
Several meshes on one armature are merged into one mesh; each keeps its name as a face group (show / hide per part).

Axes: three.js (+Y up · front +Z) · meters · bones carry NO scale (an FBX in cm usually has a 0.01 scale — it is removed
and baked into positions, otherwise every bone length is 100x off after export).

usage:  blender -b --factory-startup -P tools/blender/fbx_clone.py -- <rig.fbx> <out.json> [clip=file.fbx ...]
        (normally run through:  npm run clone -- <Name>)
"""
import bpy, sys, os, json, math
from mathutils import Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
RIG, OUT, ANIMS = argv[0], argv[1], [a.split('=', 1) for a in argv[2:]]
C = Matrix.Rotation(-math.pi / 2, 4, 'X')             # Blender Z-up to three.js Y-up: (x, y, z) -> (x, z, -y)
r6 = lambda v: round(v, 6)


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path)
    sc = bpy.context.scene
    arms = [o for o in sc.objects if o.type == 'ARMATURE']
    if not arms: raise SystemExit('[CLONE] no armature in ' + path)
    arm = max(arms, key=lambda o: len(o.data.bones))
    skinned = lambda o: o.parent == arm or any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)
    meshes = sorted([o for o in sc.objects if o.type == 'MESH' and skinned(o)], key=lambda o: o.name)
    return sc, arm, meshes


def clean(M):                                          # axis change + drop scale (keep position / rotation)
    loc, rot, _ = (C @ M).decompose()
    return loc, rot


sc, arm, meshes = load(RIG)
if not meshes: raise SystemExit('[CLONE] no mesh skinned to the armature')
bones = list(arm.data.bones)
bidx = {b.name: i for i, b in enumerate(bones)}
arm.data.pose_position = 'REST'
bpy.context.view_layer.update()

# ---------- rest skeleton: world matrix -> local to the parent ----------
restW = {b.name: clean(arm.matrix_world @ b.matrix_local) for b in bones}


def local_of(name, parent, W):
    l, q = W[name]
    if not parent: return l, q
    pl, pq = W[parent]
    inv = pq.inverted()
    return inv @ (l - pl), inv @ q


B = []
for b in bones:
    l, q = local_of(b.name, b.parent.name if b.parent else None, restW)
    B.append({'name': b.name, 'parent': bidx[b.parent.name] if b.parent else -1,
              'pos': [r6(v) for v in l], 'quat': [r6(q.x), r6(q.y), r6(q.z), r6(q.w)],
              'wpos': [r6(v) for v in restW[b.name][0]]})

# ---------- vertices / faces / UV / weights (all meshes, one after another) ----------
verts, faces, uvs, skin, groups, parts, textures = [], [], [], [], [], [], {}
for mesh in meshes:
    me, off = mesh.data, len(verts) // 3
    MW = C @ mesh.matrix_world
    for v in me.vertices: p = MW @ v.co; verts += [r6(p.x), r6(p.y), r6(p.z)]
    uvl = me.uv_layers.active.data if me.uv_layers.active else None
    for p in me.polygons:
        faces.append([off + i for i in p.vertices])
        uvs.append([[r6(uvl[li].uv.x), r6(uvl[li].uv.y)] if uvl else [0, 0] for li in p.loop_indices])
        groups.append(mesh.name)
    gname = {g.index: g.name for g in mesh.vertex_groups}
    for v in me.vertices:
        ws = sorted(((g.weight, bidx[gname[g.group]]) for g in v.groups if gname.get(g.group) in bidx and g.weight > 0), reverse=True)[:4]
        if not ws and mesh.parent == arm and mesh.parent_type == 'BONE' and mesh.parent_bone in bidx: ws = [(1.0, bidx[mesh.parent_bone])]
        s = sum(w for w, _ in ws) or 1
        skin.append([[b, r6(w / s)] for w, b in ws] or [[0, 1.0]])
    img = next((n.image for m in me.materials if m and m.node_tree for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    if img: textures[mesh.name] = os.path.basename(img.filepath or img.name)
    parts.append({'name': mesh.name, 'verts': [off, len(me.vertices)], 'uv': bool(uvl)})
    if not uvl: print('[WARN] mesh', mesh.name, 'has no UV map')

nV = len(verts) // 3
SIG = [(m.name, len(m.data.vertices)) for m in meshes]      # loading a clip file frees these objects — keep names / counts only
SAMPLE = list(range(0, nV, max(1, nV // 32)))[:32]           # spread over the whole body


def pose_sample(meshes):
    dg, out, off = bpy.context.evaluated_depsgraph_get(), {}, 0
    for mesh in meshes:
        ev = mesh.evaluated_get(dg); em = ev.to_mesh(); M = C @ ev.matrix_world; n = len(mesh.data.vertices)
        for i in SAMPLE:
            if off <= i < off + n: out[str(i)] = [r6(c) for c in (M @ em.vertices[i - off].co)]
        ev.to_mesh_clear(); off += n
    return out


data = {'source': os.path.basename(RIG), 'unit': 'm', 'up': 'Y', 'fps': sc.render.fps,
        'counts': {'verts': nV, 'faces': len(faces), 'tris': sum(len(f) - 2 for f in faces),
                   'quads': sum(1 for f in faces if len(f) == 4), 'ngons': sum(1 for f in faces if len(f) > 4), 'bones': len(bones)},
        'texture': next(iter(textures.values()), None), 'textures': textures, 'parts': parts,
        'bones': B, 'verts': verts, 'faces': faces, 'uvs': uvs, 'skin': skin, 'clips': {}, 'check': {}}
if len(meshes) > 1: data['groups'] = groups
print('[CLONE]', json.dumps(data['counts']), '· meshes', [m.name for m in meshes], '· texture', data['texture'])

# ---------- clips: every frame, local to parent without scale + check points at start / middle / end ----------
for name, path in ANIMS:
    sc, arm, ms = load(path)
    act = arm.animation_data.action if arm.animation_data else None
    if not act: print('[ANIM] no animation in', path); continue
    missing = [b['name'] for b in B if b['name'] not in arm.pose.bones]
    if missing: print('[WARN]', name, 'is missing bones:', ', '.join(missing[:8]))
    same = [(m.name, len(m.data.vertices)) for m in ms] == SIG
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1]); fps = sc.render.fps
    arm.data.pose_position = 'POSE'
    T, tracks, checks = [], {b['name']: {'p': [], 'q': []} for b in B}, {}
    for f in range(f0, f1 + 1):
        sc.frame_set(f); bpy.context.view_layer.update()
        W = {pb.name: clean(arm.matrix_world @ pb.matrix) for pb in arm.pose.bones}
        T.append(r6((f - f0) / fps))
        for b in B:
            if b['name'] not in W: W[b['name']] = restW[b['name']]
            l, q = local_of(b['name'], B[b['parent']]['name'] if b['parent'] >= 0 else None, W)
            tracks[b['name']]['p'] += [r6(v) for v in l]
            tracks[b['name']]['q'] += [r6(q.x), r6(q.y), r6(q.z), r6(q.w)]
        if same and f in (f0, (f0 + f1) // 2, f1): checks[str(r6((f - f0) / fps))] = pose_sample(ms)
    data['clips'][name] = {'frames': [f0, f1], 'fps': fps, 'duration': r6((f1 - f0) / fps), 'times': T, 'tracks': tracks}
    if checks: data['check'][name] = checks
    else: print('[ANIM]', name, '— file has no matching mesh, exactness check skipped for this clip')
    print('[ANIM]', name, 'frames', f0, '-', f1, '@', fps, 'fps')

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
json.dump(data, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'))
print('[OUT]', OUT, os.path.getsize(OUT) // 1024, 'KB')
