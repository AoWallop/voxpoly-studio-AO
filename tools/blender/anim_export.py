# ===== Rigged model + animation clips → FBX for Unity (Blender, headless) =====
# usage: blender -b --factory-startup -P tools/blender/anim_export.py -- <in.glb> <outDir> <Name> <palettePrefix> [size] [clipNames]
# Output:
#   <outDir>/<Name>.fbx            = avatar: mesh + bones + skin (no animation) · Smart-UV
#   <outDir>/<Name>@<clip>.fbx     = one animation per file (bones + the same mesh · lower-case clip name) — Unity's "Name@clip" convention
#   ⚠ every clip file must have the SAME top node as the avatar (Blender always puts the skinned mesh at the top),
#     otherwise Unity strips the wrapper node of the clip file, bone paths stop matching and the keys do nothing
#   <outDir>/Textures/<Name>_Albedo|MetallicSmoothness|Emission.png + <Name>_AO.png (baked onto the Smart UV)
#   <outDir>/<Name>_uv.json (for tools/uv_layout.py) · <Name>_preview.png
# How: import GLB (30 fps) → delete importer extras (empties / bone shapes) → merge doubles PER BONE (never blend weights)
#      → Smart UV → bake EMIT from the palette + AO (rest pose)
import bpy, sys, os, math, json, bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, name, pal = os.path.abspath(argv[0]), os.path.abspath(argv[1]), argv[2], os.path.abspath(argv[3])
S = int(argv[4]) if len(argv) > 4 else 1024
KNOWN = sorted([c for c in argv[5].split(',') if c], key=len, reverse=True) if len(argv) > 5 else []   # clip names that contain underscores (e.g. attack_01) · omitted = cut at the first underscore
def clip_of(action_name):
    for c in KNOWN:
        if action_name == c or action_name.startswith(c + '_'): return c.lower()
    return action_name.split('_')[0].lower()                  # the importer may append the object name to the action name
os.makedirs(os.path.join(out, 'Textures'), exist_ok=True)
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=False)

# ---------- tidy up: armature + mesh ----------
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
me_ob = next(o for o in sc.objects if o.type == 'MESH' and o.vertex_groups)
for o in list(sc.objects):                                   # remove wrapper empties + extra meshes the importer adds (bone shapes)
    if o not in (arm, me_ob):
        if o.type == 'EMPTY':
            for c in o.children: mw = c.matrix_world.copy(); c.parent = None; c.matrix_world = mw
        bpy.data.objects.remove(o, do_unlink=True)
arm.name = name; arm.data.name = name + '_Armature'
me_ob.name = name + '_Mesh'; me = me_ob.data; me.name = name + '_Mesh'
# the mesh must sit under the armature node: avatar and clip files then share one top node → Unity strips (or keeps) it the same way → bone paths match (otherwise keys do not drive the bones)
_mw = me_ob.matrix_world.copy(); me_ob.parent = arm; me_ob.matrix_world = _mw   # (the FBX exporter still puts the skinned mesh at the top — guarded by also writing the mesh into every clip file)
old_uv = me.uv_layers[0].name
print(f'[RIG] bones={[b.name for b in arm.data.bones]} actions={[a.name for a in bpy.data.actions]}')

# ---------- merge doubles per bone (the studio writes separate vertices for every triangle) ----------
bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = me_ob; me_ob.select_set(True)
nv0 = len(me.vertices)
bpy.ops.object.mode_set(mode='EDIT')
for g in me_ob.vertex_groups:
    bpy.ops.mesh.select_all(action='DESELECT'); me_ob.vertex_groups.active_index = g.index; bpy.ops.object.vertex_group_select()
    bpy.ops.mesh.remove_doubles(threshold=1e-5, use_sharp_edge_from_normals=True)
bpy.ops.object.mode_set(mode='OBJECT'); print(f'[MERGE] verts {nv0} -> {len(me.vertices)} (per bone)')

# ---------- Smart UV ----------
new_uv = me.uv_layers.new(name='UVSmart'); me.uv_layers.active = new_uv
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- bake (rest pose) ----------
arm.data.pose_position = 'REST'
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.view_settings.view_transform = 'Standard'
mat = bpy.data.materials.new('M_' + name); mat.use_nodes = True
me.materials.clear(); me.materials.append(mat)
nt = mat.node_tree; N = nt.nodes; Lk = nt.links; N.clear()
outN = N.new('ShaderNodeOutputMaterial'); emi = N.new('ShaderNodeEmission'); Lk.new(emi.outputs[0], outN.inputs['Surface'])
uvN = N.new('ShaderNodeUVMap'); uvN.uv_map = old_uv
tex = N.new('ShaderNodeTexImage'); tex.interpolation = 'Closest'; Lk.new(uvN.outputs[0], tex.inputs['Vector'])
target = N.new('ShaderNodeTexImage')
def load(path, noncolor):
    im = bpy.data.images.load(path); im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'; return im
def bake(kind, img_name, noncolor, samples=1):
    im = bpy.data.images.new(img_name, S, S, alpha=False); im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    target.image = im
    for n in N: n.select = False
    target.select = True; N.active = target
    me.uv_layers.active = me.uv_layers['UVSmart']
    sc.cycles.samples = samples
    bpy.ops.object.bake(type=kind, margin=8, margin_type='EXTEND', use_clear=True)
    return im
def save(im, fname):
    im.filepath_raw = os.path.join(out, 'Textures', fname); im.file_format = 'PNG'; im.save(); print(f'[TEX] {fname}')
for kind, noncolor in [('Albedo', False), ('Emission', False)]:
    tex.image = load(f'{pal}_{kind}.png', noncolor); Lk.new(tex.outputs['Color'], emi.inputs['Color'])
    save(bake('EMIT', kind, noncolor), f'{name}_{kind}.png')
tex.image = load(f'{pal}_MetallicSmoothness.png', True)
Lk.new(tex.outputs['Color'], emi.inputs['Color']); mR = list(bake('EMIT', 'metal', True).pixels)
Lk.new(tex.outputs['Alpha'], emi.inputs['Color']); mA = list(bake('EMIT', 'smooth', True).pixels)
comb = bpy.data.images.new('MS', S, S, alpha=True); comb.colorspace_settings.name = 'Non-Color'
px = [0.0] * (S * S * 4); px[0::4] = mR[0::4]; px[3::4] = mA[0::4]; comb.pixels = px
save(comb, f'{name}_MetallicSmoothness.png')
N.remove(emi); pr = N.new('ShaderNodeBsdfPrincipled'); Lk.new(pr.outputs[0], outN.inputs['Surface'])
save(bake('AO', 'AO', True, samples=64), f'{name}_AO.png')

# UV edges → json
uvd = me.uv_layers['UVSmart'].data; edges = set()
for poly in me.polygons:
    L = [tuple(round(c, 6) for c in uvd[li].uv) for li in poly.loop_indices]
    for i in range(len(L)): edges.add(tuple(sorted((L[i], L[(i + 1) % len(L)]))))
json.dump({'size': S, 'edges': [list(e) for e in edges], 'tris': [[list(uvd[li].uv) for li in p.loop_indices] for p in me.polygons]},
          open(os.path.join(out, f'{name}_uv.json'), 'w'))
me.uv_layers.remove(me.uv_layers[old_uv]); me.uv_layers['UVSmart'].name = 'UVMap'
# ---------- preview render (rest pose · Albedo × AO · 3/4 view) → <Name>_preview.png (make-send puts it in Preview/) ----------
N.clear(); outN = N.new('ShaderNodeOutputMaterial'); pr = N.new('ShaderNodeBsdfPrincipled'); Lk.new(pr.outputs[0], outN.inputs['Surface'])
def img(fname, noncolor): t = N.new('ShaderNodeTexImage'); t.image = load(os.path.join(out, 'Textures', fname), noncolor); return t
ta, tao, tms = img(f'{name}_Albedo.png', False), img(f'{name}_AO.png', True), img(f'{name}_MetallicSmoothness.png', True)
mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
Lk.new(ta.outputs['Color'], mul.inputs[6]); Lk.new(tao.outputs['Color'], mul.inputs[7]); Lk.new(mul.outputs[2], pr.inputs['Base Color'])
sp = N.new('ShaderNodeSeparateColor'); Lk.new(tms.outputs['Color'], sp.inputs[0]); Lk.new(sp.outputs[0], pr.inputs['Metallic'])
inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1; Lk.new(tms.outputs['Alpha'], inv.inputs[1]); Lk.new(inv.outputs[0], pr.inputs['Roughness'])
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for v in me.vertices: w = me_ob.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
c = (lo + hi) / 2; r = (hi - lo).length
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50; d = r * 1.9
cam.location = c + Vector((d * .55, -d * .75, d * .25)); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.35, .37, .45, 1)
sc.render.resolution_x = sc.render.resolution_y = 700; sc.cycles.samples = 48
sc.render.filepath = os.path.join(out, f'{name}_preview.png'); bpy.ops.render.render(write_still=True); print('[PREVIEW]', os.path.basename(sc.render.filepath))
bpy.data.objects.remove(cam, do_unlink=True); bpy.data.objects.remove(sun, do_unlink=True)
arm.data.pose_position = 'POSE'

# ---------- export ----------
FBX = dict(apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS', axis_forward='-Z', axis_up='Y', bake_space_transform=True,
           mesh_smooth_type='OFF', use_mesh_modifiers=False, add_leaf_bones=False, primary_bone_axis='Y', secondary_bone_axis='X',
           armature_nodetype='NULL', path_mode='STRIP', embed_textures=False, use_selection=True)
actions = [a for a in bpy.data.actions]
ad = arm.animation_data or arm.animation_data_create()
for t in list(ad.nla_tracks): ad.nla_tracks.remove(t)
ad.action = None
for pb in arm.pose.bones: pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0); pb.scale = (1, 1, 1)

def select(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = arm

select([arm, me_ob])
dst = os.path.join(out, name + '.fbx')
bpy.ops.export_scene.fbx(filepath=dst, object_types={'ARMATURE', 'MESH'}, bake_anim=False, **FBX)
me.calc_loop_triangles(); print(f'[FBX] avatar {os.path.basename(dst)} tris={len(me.loop_triangles)}')

for act in actions:
    clip = clip_of(act.name)
    ad.action = act
    fs, fe = act.frame_range; sc.frame_start, sc.frame_end = int(math.floor(fs)), int(math.ceil(fe))
    select([arm, me_ob]); sc.name = clip                   # FBX take name = '<Name>|<clip>' · include the mesh so every file has the avatar's node layout → bone paths match in Unity
    dst = os.path.join(out, f'{name}@{clip}.fbx')
    bpy.ops.export_scene.fbx(filepath=dst, object_types={'ARMATURE', 'MESH'}, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
                             bake_anim_use_all_bones=True, bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0, **FBX)
    print(f'[FBX] anim {os.path.basename(dst)} frames {sc.frame_start}-{sc.frame_end} @ {FPS} fps')
clip_names = sorted({clip_of(a.name) for a in actions})
ad.action = None

# ---------- verify by re-import ----------
def check(path):
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.fbx(filepath=path)
    objs = list(bpy.context.scene.objects); tris = 0
    for o in objs:
        if o.type == 'MESH': o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    acts = [(a.name, tuple(round(x, 1) for x in a.frame_range)) for a in bpy.data.actions]
    arms = [o for o in objs if o.type == 'ARMATURE']
    print(f'[CHECK] {os.path.basename(path)} objs={[(o.name, o.type) for o in objs]} tris={tris} bones={len(arms[0].data.bones) if arms else 0} '
          f'rot={[tuple(round(a, 3) for a in o.rotation_euler) for o in arms]} actions={acts}')
check(os.path.join(out, name + '.fbx'))
for act_name in clip_names:
    check(os.path.join(out, f'{name}@{act_name}.fbx'))
