# ===== Normals for a tri model (soft/hard edges + weighted normals), stored per triangle corner =====
# usage: blender -b --factory-startup -P tools/topo/normals.py -- <out_prefix> <mode> <angle> <tris1.json> [tris2.json ...]
#   mode: flat (every face flat) · soft (smooth across edges bent < angle°) · weighted (soft + Weighted Normal: big faces win, sharp kept)
#   always sharp: edges bent more than angle° · open edges · color borders bent more than 5° (a color line on a flat plane stays smooth)
#   output: <out_prefix>.json = {tris: [[a,b,c,slot,[na,nb,nc]], ...]} three.js coords · <out_prefix>.glb (to view)
import bpy, bmesh, sys, json, math
a = sys.argv[sys.argv.index('--') + 1:]
out, mode, ang, files = a[0], a[1], float(a[2]), a[3:]
b3 = lambda p: (p[0], -p[2], p[1]); t3 = lambda v: [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]
T = []
for f in files: T += json.load(open(f))['tris']
SL = sorted({t[3] for t in T})
bpy.ops.wm.read_factory_settings(use_empty=True)
me = bpy.data.meshes.new('m'); ob = bpy.data.objects.new('m', me); bpy.context.scene.collection.objects.link(ob)
# preview colors only (the real colors come from the studio palette / theme) — a fixed hue per slot index
import colorsys
COL = {s: (*colorsys.hsv_to_rgb((i * 0.37) % 1, 0 if i == 0 else .55, .82), 1) for i, s in enumerate(SL)}
for s in SL:
    m = bpy.data.materials.new(s); m.use_nodes = True
    bs = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED'); bs.inputs['Base Color'].default_value = COL.get(s, (.5, .5, .5, 1))
    m.diffuse_color = COL.get(s, (.5, .5, .5, 1)); me.materials.append(m)
bm = bmesh.new(); vid = {}
def V(p):
    k = tuple(round(x, 5) for x in p)
    if k not in vid: vid[k] = bm.verts.new(b3(p))
    return vid[k]
for t in T:
    try: f = bm.faces.new([V(t[0]), V(t[1]), V(t[2])]); f.material_index = SL.index(t[3])
    except ValueError: pass
bm.normal_update(); bm.edges.index_update(); bm.verts.index_update(); bm.faces.index_update()
sharp = set()
for e in bm.edges:
    fs = e.link_faces
    if len(fs) != 2: sharp.add(e.index); continue
    d = math.degrees(fs[0].normal.angle(fs[1].normal, 0))
    if d > ang or (fs[0].material_index != fs[1].material_index and d > 5): sharp.add(e.index)
bm.to_mesh(me); bm.free()
if mode != 'flat':
    for p in me.polygons: p.use_smooth = True
    att = me.attributes.get('sharp_edge') or me.attributes.new('sharp_edge', 'BOOLEAN', 'EDGE')
    for e in me.edges: att.data[e.index].value = e.index in sharp
    if mode == 'weighted':
        md = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); md.mode = 'FACE_AREA_WITH_ANGLE'; md.weight = 50; md.keep_sharp = True
        bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='wn')
cn = me.corner_normals
res = []
for p in me.polygons:
    vs = [me.vertices[i].co for i in p.vertices]
    if mode == 'flat': ns = [p.normal] * 3
    else: ns = [cn[li].vector for li in p.loop_indices]
    res.append([t3(vs[0]), t3(vs[1]), t3(vs[2]), SL[p.material_index], [t3(n) for n in ns]])
json.dump(dict(tris=res), open(out + '.json', 'w'))
bpy.ops.export_scene.gltf(filepath=out + '.glb', export_format='GLB')
print(f'[NRM] {mode} {ang}° -> {len(res)} tris · sharp edges {len(sharp)}')
