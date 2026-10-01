# ===== Rebuild a textured reference mesh as clean low-poly "studio tris" (Blender, headless) =====
# usage (normally through: npm run retopo -- ...):
#   blender -b --factory-startup -P tools/topo/retopo.py -- <ref.fbx|glb> <objectNameContains> <basecolor.png> <out_prefix> [options]
# options:
#   --classes gold:25-65,blue:185-260   color classes by HUE range (degrees) · everything else = "base"
#   --sat 0.22                          minimum saturation for a pixel to count as a class color
#   --subdiv 1                          uniform subdivisions of the reference before coloring (geometry is NOT smoothed)
#   --refine 1                          extra subdivisions only where a color edge crosses a face
#   --blur 3                            mask blur radius in pixels (contour cutting)
#   --snap gold                         classes painted per WHOLE reference face when ≥ --snap-share of it has that color
#   --snap-share 0.8                    (crisp raised details such as emblems: the color edge follows the geometric edge)
#   --smooth 6                          in-plane smoothing passes on color borders (never changes the shape)
#   --corner 110                        border corners sharper than this (degrees) are locked (keeps star tips sharp)
#   --target 0                          optional triangle budget: collapse inner surface area (color borders locked) · 0 = off
# output: <out_prefix>.json  {"tris": [[a, b, c, slot], ...]} in three.js coords (x right, y up, z front), meters
#         <out_prefix>.glb   for viewing / measuring (tools/topo/dist.py, audit.py)
#
# Pipeline (why each step exists — see docs/en/topology.md):
#   1. subdivide the reference flat (keeps every plane; gives the color cut enough vertices)
#   2. read color per point from the texture: hue-based masks (baked shading cannot fool hue), blurred ONLY inside UV islands
#      (the dark background around islands would otherwise bleed in), averaged across UV seams
#   3. cut faces exactly where a color mask crosses 0.5 (contour) — vertices are never moved, so the shape is untouched
#   4. classes in --snap are painted per whole reference face (raised details stay crisp)
#   5. tiny color islands are merged into their neighbour
#   6. color borders are smoothed only inside their own plane / along their crease, sharp corners locked
#   7. dissolve coplanar same-color faces → big flat polygons where flat, detail where curved → triangulate (beauty)
import bpy, bmesh, sys, json, math, colorsys
import numpy as np
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

a = sys.argv[sys.argv.index('--') + 1:]
src, key, tex, out = a[0], a[1], a[2], a[3]
def opt(k, d, f=str):
    return f(a[a.index(k) + 1]) if k in a else d
CLASSES = []
for item in opt('--classes', 'accent:25-65').split(','):
    n, rng = item.split(':'); lo, hi = rng.split('-'); CLASSES.append((n, float(lo), float(hi)))
SLOTS = ['base'] + [c[0] for c in CLASSES]
SAT = opt('--sat', .22, float); SUBDIV = opt('--subdiv', 1, int); REFINE = opt('--refine', 1, int); BLUR = opt('--blur', 3, int)
SNAP = set(filter(None, opt('--snap', '').split(','))); SNAP_SHARE = opt('--snap-share', .8, float)
SMOOTH = opt('--smooth', 6, int); CORNER = opt('--corner', 110, float); TARGET = opt('--target', 0, int)
t3 = lambda v: [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]              # Blender (Z-up) → three (Y-up)

# ---------- 1. load reference + texture ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
(bpy.ops.import_scene.fbx if src.lower().endswith('.fbx') else bpy.ops.import_scene.gltf)(filepath=src)
ref = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and key in o.name)
for o in list(bpy.context.scene.objects):
    if o is not ref: bpy.data.objects.remove(o, do_unlink=True)
ref.data.transform(ref.matrix_world); ref.matrix_world.identity()
rb = bmesh.new(); rb.from_mesh(ref.data); bmesh.ops.triangulate(rb, faces=rb.faces); rb.faces.ensure_lookup_table()
uvl = rb.loops.layers.uv.active; RB = BVHTree.FromBMesh(rb)
img = bpy.data.images.load(tex); W, H = img.size; px = np.array(img.pixels[:]).reshape(H, W, 4)

me = ref.data.copy(); ob = bpy.data.objects.new('retopo', me); bpy.context.scene.collection.objects.link(ob)
me.materials.clear()
for n in SLOTS: me.materials.append(bpy.data.materials.new(n))
bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
for _ in range(SUBDIV): bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
bmesh.ops.triangulate(bm, faces=bm.faces)

# ---------- 2. color masks (hue) blurred inside UV islands ----------
rgb = px[..., :3]; mx = rgb.max(-1); mn = rgb.min(-1); dd = np.maximum(mx - mn, 1e-6)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0); r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
hue = np.where(mx == r_, ((g_ - b_) / dd) % 6, np.where(mx == g_, (b_ - r_) / dd + 2, (r_ - g_) / dd + 4)) * 60
colored = (sat > SAT) & (mx > .08)
def blur(m, R):
    if R <= 0: return m
    for ax in (0, 1):
        c = np.cumsum(np.pad(m, [(R + 1, R) if q == ax else (0, 0) for q in (0, 1)], mode='edge'), axis=ax)
        m = (np.take(c, range(2 * R + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * R - 1), axis=ax)) / (2 * R + 1)
    return m
valid = (mx > .06).astype(float); vb = np.maximum(blur(valid, BLUR), 1e-6)
MASK = {i + 1: blur((colored & (hue >= lo) & (hue <= hi)).astype(float) * valid, BLUR) / vb for i, (n, lo, hi) in enumerate(CLASSES)}

def uv_at(p):
    co, n, fi, d = RB.find_nearest(p)
    tf = rb.faces[fi]; A, B, C = [l.vert.co for l in tf.loops]; uvs = [l[uvl].uv for l in tf.loops]
    return barycentric_transform(co, A, B, C, uvs[0].to_3d(), uvs[1].to_3d(), uvs[2].to_3d()), fi
def field(p):
    uv, _ = uv_at(p); x = int((uv.x % 1) * (W - 1)); y = int((uv.y % 1) * (H - 1))
    return {k: m[y, x] for k, m in MASK.items()}
def vfield(v):                                   # a vertex on a UV seam has several texture positions → average them
    ss = [field(v.co.lerp(f.calc_center_median(), .2)) for f in v.link_faces] or [field(v.co)]
    return {k: sum(q[k] for q in ss) / len(ss) for k in MASK}
F = {v: vfield(v) for v in bm.verts}

# extra subdivision only where a color edge crosses a face
for _ in range(REFINE):
    sel = set()
    for f in bm.faces:
        fc = field(f.calc_center_median())
        for k in MASK:
            vals = [F[v][k] for v in f.verts] + [fc[k]]
            if max(vals) - min(vals) > .15: sel.update(f.edges); break
    if not sel: break
    bmesh.ops.subdivide_edges(bm, edges=list(sel), cuts=1, use_grid_fill=False); bmesh.ops.triangulate(bm, faces=bm.faces)
    for v in bm.verts:
        if v not in F: F[v] = vfield(v)
print('[RETOPO] dense faces', len(bm.faces))

# ---------- 3. contour cut at mask = 0.5 (vertices never move) ----------
for k in MASK:
    cuts = set()
    for e in list(bm.edges):
        v0, v1 = e.verts; f0, f1 = F[v0][k] - .5, F[v1][k] - .5
        if f0 * f1 < 0:
            t = f0 / (f0 - f1); ne, nv = bmesh.utils.edge_split(e, v0, t)
            F[nv] = {kk: F[v0][kk] + (F[v1][kk] - F[v0][kk]) * t for kk in MASK}; F[nv][k] = .5; cuts.add(nv)
    for f in list(bm.faces):
        cv = [v for v in f.verts if v in cuts]
        if len(cv) == 2:
            try: bmesh.utils.face_split(f, cv[0], cv[1])
            except Exception: pass
bmesh.ops.triangulate(bm, faces=bm.faces)

# ---------- 4. assign slots (+ snap whole reference faces) ----------
parent = {}
for f in bm.faces:
    fv = [F[v] for v in f.verts]; best, val = 0, .5
    for k in MASK:
        m = sum(q[k] for q in fv) / len(fv)
        if m > val: best, val = k, m
    f.material_index = best; parent[f] = uv_at(f.calc_center_median())[1]
groups = {}
for f, fi in parent.items(): groups.setdefault(fi, []).append(f)
for fs in groups.values():
    area = {}
    for f in fs: area[f.material_index] = area.get(f.material_index, 0) + f.calc_area()
    tot = sum(area.values()); k, v = max(area.items(), key=lambda kv: kv[1])
    if tot > 0 and v / tot >= SNAP_SHARE and SLOTS[k] in SNAP:
        for f in fs: f.material_index = k

# ---------- 5. merge tiny color islands ----------
seen = set()
for f in bm.faces:
    if f in seen: continue
    isl, st, nb = [], [f], {}; seen.add(f)
    while st:
        g = st.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.material_index == f.material_index and h not in seen: seen.add(h); st.append(h)
                elif h.material_index != f.material_index: nb[h.material_index] = nb.get(h.material_index, 0) + 1
    if len(isl) < 40 and nb:
        to = max(nb, key=nb.get)
        for g in isl: g.material_index = to

# ---------- 6. smooth color borders without changing the shape ----------
bm.normal_update()
adj = {}
for e in bm.edges:
    if len(e.link_faces) == 2 and e.link_faces[0].material_index != e.link_faces[1].material_index:
        v0, v1 = e.verts; adj.setdefault(v0, []).append(v1); adj.setdefault(v1, []).append(v0)
def planes(v):
    ns = []
    for f in v.link_faces:
        if not any(f.normal.angle(m, 0) < math.radians(2) for m in ns): ns.append(f.normal.copy())
    return ns
def walk(v, prev, n):
    for _ in range(n):
        nx = [w for w in adj.get(v, []) if w is not prev]
        if len(adj.get(v, [])) != 2 or not nx: break
        prev, v = v, nx[0]
    return v
lock = set()
for v, nb in adj.items():
    if len(nb) != 2: lock.add(v); continue
    p0, p1 = walk(nb[0], v, 2).co - v.co, walk(nb[1], v, 2).co - v.co
    if p0.length > 1e-9 and p1.length > 1e-9 and math.degrees(p0.angle(p1)) < CORNER: lock.add(v)
for _ in range(SMOOTH):
    new = {}
    for v, nb in adj.items():
        if v in lock or len(nb) != 2: continue
        d = (v.co * 2 + nb[0].co + nb[1].co) / 4 - v.co; ps = planes(v)
        if len(ps) == 1: d -= ps[0] * d.dot(ps[0])                    # stay in the plane
        elif len(ps) == 2:
            ax = ps[0].cross(ps[1])
            if ax.length < 1e-9: continue
            ax.normalize(); d = ax * d.dot(ax)                       # slide along the crease
        else: continue
        new[v] = v.co + d
    for v, c in new.items(): v.co = c

# ---------- 7. dissolve coplanar same-color faces, triangulate ----------
bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), verts=bm.verts, edges=bm.edges, delimit={'MATERIAL'})
bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
bm.to_mesh(me); bm.free(); rb.free()
n0 = len(me.polygons)

if TARGET and TARGET < n0:                       # optional budget: collapse only vertices that are not on a color/mesh border
    bm = bmesh.new(); bm.from_mesh(me); border = set()
    for e in bm.edges:
        if len(e.link_faces) < 2 or len({f.material_index for f in e.link_faces}) > 1: border.update(v.index for v in e.verts)
    bm.free()
    vg = ob.vertex_groups.new(name='free'); vg.add([i for i in range(len(me.vertices)) if i not in border], 1.0, 'REPLACE')
    md = ob.modifiers.new('dec', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = TARGET / n0
    md.vertex_group = 'free'; md.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='dec')
print(f'[RETOPO] {n0} -> {len(me.polygons)} tris · slots {SLOTS}')

tris = []
for p in me.polygons:
    v = [me.vertices[i].co for i in p.vertices]
    tris.append([t3(v[0]), t3(v[1]), t3(v[2]), SLOTS[p.material_index]])
json.dump({'slots': SLOTS, 'tris': tris}, open(out + '.json', 'w'))
bpy.ops.export_scene.gltf(filepath=out + '.glb', export_format='GLB', use_selection=False)
print('[RETOPO] wrote', out + '.json')
