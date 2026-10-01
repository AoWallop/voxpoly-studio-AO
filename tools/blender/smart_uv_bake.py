# ===== Smart UV + bake (Blender, headless) =====
# usage: blender -b --factory-startup -P tools/blender/smart_uv_bake.py -- <in.glb> <palettePrefix[,prefix2,...]> <outDir> <Name> [size]
#   palettePrefix = palette textures of a theme to bake (several themes separated by "," all share ONE new UV set),
#                   without the "_Albedo.png" suffix, e.g. export/Samples/Sample_Sword_Steel
# Output: <outDir>/<Name>.fbx (single new UV set) + Textures/<Name>_<Theme>_Albedo|MetallicSmoothness|Emission.png + <Name>_AO.png
#         + <Name>_uv.json (UV edges for tools/uv_layout.py) + <Name>_preview.png (check render)
# How: Smart UV Project lays out a new UV → bake colors from the palette (old UV points at color cells) onto it with EMIT
#      (pure color, no lighting) → bake AO separately.
import bpy, sys, os, math, json
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, name = os.path.abspath(argv[0]), os.path.abspath(argv[2]), argv[3]
pals = [os.path.abspath(p) for p in argv[1].split(',')]            # several themes → unwrap once, bake every theme onto the same UV (one FBX for all colors)
S = int(argv[4]) if len(argv) > 4 else 1024
themeOf = lambda pal: os.path.basename(pal).split('_')[-1]           # e.g. Steel
theme = themeOf(pals[0])                                             # first theme is used for the preview render
os.makedirs(os.path.join(out, 'Textures'), exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=False)
ob = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
me = ob.data
old_uv = me.uv_layers[0].name                                        # palette UV (points at the center of a color cell)

# ---------- Smart UV Project onto a new UV layer ----------
new_uv = me.uv_layers.new(name='UVSmart'); me.uv_layers.active = new_uv
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
# The studio writes every triangle with its own vertices (to control soft/hard edges) → merge doubles first, otherwise Smart UV makes one island per triangle
# use_sharp_edge_from_normals = where normals were split (hard edges) gets marked sharp · original normals are kept
nv0 = len(me.vertices); bpy.ops.mesh.remove_doubles(threshold=1e-5, use_sharp_edge_from_normals=True)
bpy.ops.object.mode_set(mode='OBJECT'); print(f'[MERGE] verts {nv0} -> {len(me.vertices)}'); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- bake material: read the palette through the old UV → Emission ----------
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.view_settings.view_transform = 'Standard'
mat = bpy.data.materials.new('M_' + name); mat.use_nodes = True
me.materials.clear(); me.materials.append(mat)
nt = mat.node_tree; N = nt.nodes; Lk = nt.links; N.clear()
outN = N.new('ShaderNodeOutputMaterial'); emi = N.new('ShaderNodeEmission'); Lk.new(emi.outputs[0], outN.inputs['Surface'])
uvN = N.new('ShaderNodeUVMap'); uvN.uv_map = old_uv
tex = N.new('ShaderNodeTexImage'); tex.interpolation = 'Closest'; Lk.new(uvN.outputs[0], tex.inputs['Vector'])
sep = N.new('ShaderNodeSeparateColor')                               # used to pull alpha (smoothness)
target = N.new('ShaderNodeTexImage')                                 # bake target image (must be the active node)

def load(path, noncolor):
    im = bpy.data.images.load(path); im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'; return im

def bake(kind, img_name, noncolor, samples=1):
    im = bpy.data.images.new(img_name, S, S, alpha=False); im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    target.image = im
    for n in N: n.select = False
    target.select = True; N.active = target
    me.uv_layers.active = me.uv_layers['UVSmart']                    # bake writes into the active UV layer (look it up by name — references go stale after edit mode)
    sc.cycles.samples = samples
    bpy.ops.object.bake(type=kind, margin=8, margin_type='EXTEND', use_clear=True)
    return im

def pixels(im): return list(im.pixels)

def save(im, fname):
    im.filepath_raw = os.path.join(out, 'Textures', fname); im.file_format = 'PNG'; im.save(); print(f'[TEX] {fname}')

for pal in pals:
    th = themeOf(pal)
    # Albedo · Emission: straight palette colors
    for kind, noncolor in [('Albedo', False), ('Emission', False)]:
        tex.image = load(f'{pal}_{kind}.png', noncolor)
        Lk.new(tex.outputs['Color'], emi.inputs['Color'])
        save(bake('EMIT', kind, noncolor), f'{name}_{th}_{kind}.png')
    # Metallic (R) + Smoothness (A), Unity URP style: bake R and alpha separately, then combine into one RGBA image
    tex.image = load(f'{pal}_MetallicSmoothness.png', True)
    Lk.new(tex.outputs['Color'], emi.inputs['Color'])
    mR = pixels(bake('EMIT', 'metal', True))
    Lk.new(tex.outputs['Alpha'], emi.inputs['Color'])
    mA = pixels(bake('EMIT', 'smooth', True))
    comb = bpy.data.images.new('MS', S, S, alpha=True); comb.colorspace_settings.name = 'Non-Color'
    px = [0.0] * (S * S * 4)
    px[0::4] = mR[0::4]; px[3::4] = mA[0::4]
    comb.pixels = px; save(comb, f'{name}_{th}_MetallicSmoothness.png')

# AO (shared by all themes · URP/Lit Occlusion slot)
N.remove(emi); pr = N.new('ShaderNodeBsdfPrincipled'); Lk.new(pr.outputs[0], outN.inputs['Surface'])
save(bake('AO', 'AO', True, samples=64), f'{name}_AO.png')

# ---------- new UV edges → json (drawn as a transparent PNG by tools/uv_layout.py) ----------
uvd = me.uv_layers['UVSmart'].data; edges = set()
for poly in me.polygons:
    L = [tuple(round(c, 6) for c in uvd[li].uv) for li in poly.loop_indices]
    for i in range(len(L)): edges.add(tuple(sorted((L[i], L[(i + 1) % len(L)]))))
json.dump({'size': S, 'edges': [list(e) for e in edges], 'tris': [[list(uvd[li].uv) for li in p.loop_indices] for p in me.polygons]},
          open(os.path.join(out, f'{name}_uv.json'), 'w'))
print(f'[UV] islands edges={len(edges)} faces={len(me.polygons)}')

# ---------- FBX: only the new UV set remains (named UVMap) · same settings as glb_to_fbx.py ----------
me.uv_layers.remove(me.uv_layers[old_uv]); me.uv_layers['UVSmart'].name = 'UVMap'
fbx = os.path.join(out, name + '.fbx')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.fbx(filepath=fbx, use_selection=True, object_types={'MESH'}, apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS',
    axis_forward='-Z', axis_up='Y', bake_space_transform=True, mesh_smooth_type='OFF', use_mesh_modifiers=True,
    add_leaf_bones=False, bake_anim=False, path_mode='STRIP', embed_textures=False)
me.calc_loop_triangles(); print(f'[FBX] wrote {fbx} tris={len(me.loop_triangles)}')

# ---------- check render: real material (Albedo × AO · metal/smooth), 3/4 view ----------
N.clear(); outN = N.new('ShaderNodeOutputMaterial'); pr = N.new('ShaderNodeBsdfPrincipled'); Lk.new(pr.outputs[0], outN.inputs['Surface'])
def img(fname, noncolor): t = N.new('ShaderNodeTexImage'); t.image = load(os.path.join(out, 'Textures', fname), noncolor); return t
ta, tao, tms, te = img(f'{name}_{theme}_Albedo.png', False), img(f'{name}_AO.png', True), img(f'{name}_{theme}_MetallicSmoothness.png', True), img(f'{name}_{theme}_Emission.png', False)
mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
Lk.new(ta.outputs['Color'], mul.inputs[6]); Lk.new(tao.outputs['Color'], mul.inputs[7]); Lk.new(mul.outputs[2], pr.inputs['Base Color'])
sp = N.new('ShaderNodeSeparateColor'); Lk.new(tms.outputs['Color'], sp.inputs[0]); Lk.new(sp.outputs[0], pr.inputs['Metallic'])
inv = N.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1; Lk.new(tms.outputs['Alpha'], inv.inputs[1]); Lk.new(inv.outputs[0], pr.inputs['Roughness'])
Lk.new(te.outputs['Color'], pr.inputs['Emission Color']); pr.inputs['Emission Strength'].default_value = 1.4
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for v in me.vertices: w = ob.matrix_world @ v.co; lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
c = (lo + hi) / 2; r = (hi - lo).length
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50; d = r * 1.9
cam.location = c + Vector((d * .55, -d * .75, d * .25)); cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.35, .37, .45, 1)
sc.render.resolution_x = sc.render.resolution_y = 700; sc.cycles.samples = 48; sc.render.film_transparent = False
sc.render.filepath = os.path.join(out, f'{name}_preview.png'); bpy.ops.render.render(write_still=True)
print('[PREVIEW]', sc.render.filepath)
