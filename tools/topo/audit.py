# ===== Measure topology + UV of models (FBX/GLB) — compare your model and a reference with the same yardstick =====
# usage: blender -b --factory-startup -P tools/topo/audit.py -- <out.json> <file1> [<file2> ...]
# measures: tri/quad/ngon · poles · skinny triangles · open / non-manifold edges · "wasted edges" (% removable by Limited Dissolve 1°/5°)
#           UV: island count · area used · texel-density spread
# Why: "too many edges" is easy to see but hard to argue about — this turns it into numbers.
import bpy, bmesh, sys, json, math, os
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
out_path, files = argv[0], argv[1:]

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load(p):
    clear()
    if p.lower().endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=p)
    else: bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']

def tri_area(a, b, c): return ((b - a).cross(c - a)).length * 0.5

def audit_obj(o):
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.transform(o.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)  # glTF splits vertices at UV seams — merge them so seams are not counted as open edges
    nf = len(bm.faces)
    tris = sum(1 for f in bm.faces if len(f.verts) == 3)
    quads = sum(1 for f in bm.faces if len(f.verts) == 4)
    ngons = nf - tris - quads
    tri_count = sum(len(f.verts) - 2 for f in bm.faces)
    # pole = interior vertex whose valence is not 4
    poles3 = poles5 = 0
    for v in bm.verts:
        if v.is_boundary or not v.link_edges: continue
        n = len(v.link_edges)
        if n == 3: poles3 += 1
        elif n >= 5: poles5 += 1
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    nonman = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary)
    # skinny triangle: longest edge^2 / (2 * area) > 10
    skinny = 0
    bm2 = bm.copy(); bmesh.ops.triangulate(bm2, faces=bm2.faces)
    areas = []
    for f in bm2.faces:
        a, b, c = [v.co for v in f.verts]
        ar = tri_area(a, b, c); areas.append(ar)
        L = max((a - b).length, (b - c).length, (c - a).length)
        if ar < 1e-12 or L * L / (2 * ar) > 10: skinny += 1
    total_area = sum(areas)
    # wasted edges: run Limited Dissolve, count what is left
    waste = {}
    for deg in (1, 5):
        b3 = bm.copy()
        bmesh.ops.dissolve_limit(b3, angle_limit=math.radians(deg), verts=b3.verts, edges=b3.edges)
        t3 = sum(max(len(f.verts) - 2, 0) for f in b3.faces)
        waste[f'{deg}deg'] = round(1 - t3 / max(tri_count, 1), 3)
        b3.free()
    # UV
    uv = None
    if bm.loops.layers.uv:
        lay = bm.loops.layers.uv.active
        uv_area = 0.0; dens = []
        for f in bm2.faces:
            pass
        lay2 = bm2.loops.layers.uv.active
        for f, ar in zip(bm2.faces, areas):
            p = [l[lay2].uv for l in f.loops]
            ua = abs((p[1] - p[0]).cross(p[2] - p[0])) * 0.5 if hasattr(p[0], 'cross') else abs((p[1].x-p[0].x)*(p[2].y-p[0].y)-(p[2].x-p[0].x)*(p[1].y-p[0].y)) * 0.5
            uv_area += ua
            if ar > 1e-10 and ua > 0: dens.append(math.sqrt(ua / ar))
        # UV island = faces connected through edges whose UVs match
        islands = 0; seen = set()
        for f in bm.faces:
            if f.index in seen: continue
            islands += 1; stack = [f]; seen.add(f.index)
            while stack:
                g = stack.pop()
                for l in g.loops:
                    e = l.edge
                    for l2 in e.link_loops:
                        h = l2.face
                        if h.index in seen: continue
                        # shared edge: both UV endpoints must match
                        a1, a2 = l[lay].uv, l.link_loop_next[lay].uv
                        b1, b2 = l2[lay].uv, l2.link_loop_next[lay].uv
                        if ((a1 - b2).length < 1e-5 and (a2 - b1).length < 1e-5) or ((a1 - b1).length < 1e-5 and (a2 - b2).length < 1e-5):
                            seen.add(h.index); stack.append(h)
        dens.sort()
        med = dens[len(dens) // 2] if dens else 0
        spread = (dens[int(len(dens) * .9)] / max(dens[int(len(dens) * .1)], 1e-9)) if dens else 0
        uv = dict(islands=islands, uv_area_sum=round(uv_area, 3),
                  texel_p90_over_p10=round(spread, 2))
    bm2.free(); bm.free()
    dims = o.dimensions
    return dict(name=o.name, faces=nf, tris_total=tri_count, tri=tris, quad=quads, ngon=ngons,
                pct_quad=round(quads / max(nf, 1), 3), poles3=poles3, poles5plus=poles5,
                boundary_edges=boundary, nonmanifold_edges=nonman,
                skinny_tris=skinny, pct_skinny=round(skinny / max(len(areas), 1), 3),
                waste=waste, area_m2=round(total_area, 4),
                tris_per_m2=round(tri_count / max(total_area, 1e-9), 1),
                dims=[round(d, 3) for d in dims], uv=uv,
                materials=[m.name for m in me.materials if m])

res = {}
for p in files:
    objs = load(p)
    rows = [audit_obj(o) for o in objs]
    T = sum(r['tris_total'] for r in rows)
    w1 = sum(r['waste']['1deg'] * r['tris_total'] for r in rows) / max(T, 1)
    w5 = sum(r['waste']['5deg'] * r['tris_total'] for r in rows) / max(T, 1)
    res[os.path.basename(p)] = dict(objects=len(rows), tris=T, waste1=round(w1, 3), waste5=round(w5, 3),
                                   pct_quad=round(sum(r['quad'] for r in rows) / max(sum(r['faces'] for r in rows), 1), 3),
                                   pct_skinny=round(sum(r['skinny_tris'] for r in rows) / max(T, 1), 3),
                                   parts=rows)
    print(f"[AUDIT] {os.path.basename(p)} objs={len(rows)} tris={T} waste1={w1:.0%} waste5={w5:.0%}")
json.dump(res, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('[AUDIT] wrote', out_path)
