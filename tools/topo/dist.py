# ===== How far is our surface from the reference surface (cm)? — samples points on both and finds nearest =====
# usage: python tools/topo/dist.py <ref_dump.json> <ref_key> <our_dump.json> [--box x0,x1,y0,y1,z0,z1]
#   ref_key = part of the reference object name · both files from tools/topo/dump.py (Blender coords)
#   ours->ref = how far our surface sticks out of the reference · ref->ours = parts of the reference we do not cover
#   prints: mean · p90 · max + the 5 farthest points (three.js coords: x right, y up, z front)
import json, sys, numpy as np
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
a = sys.argv[1:]
ref_dump, key, our_dump = a[0], a[1], a[2]
box = [float(x) for x in a[a.index('--box') + 1].split(',')] if '--box' in a else None

def tris(parts):
    out = []
    for p in parts:
        V = np.array(p['v'], float); V = np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1)
        for f in p['f']:
            for k in range(1, len(f) - 1): out.append([V[f[0]], V[f[k]], V[f[k + 1]]])
    return np.array(out)

def sample(T, n):
    A = np.linalg.norm(np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]), axis=1) / 2
    i = np.random.default_rng(1).choice(len(T), n, p=A / A.sum()); r1, r2 = np.random.default_rng(2).random((2, n))
    s = np.sqrt(r1); return T[i, 0] * (1 - s)[:, None] + T[i, 1] * (s * (1 - r2))[:, None] + T[i, 2] * (s * r2)[:, None]

def nearest(P, Q):
    d = np.empty(len(P)); j = np.empty(len(P), int)
    for k in range(0, len(P), 500):
        D = ((P[k:k + 500, None, :] - Q[None]) ** 2).sum(2); j[k:k + 500] = D.argmin(1); d[k:k + 500] = np.sqrt(D.min(1))
    return d, j

R = tris([p for p in json.load(open(ref_dump)) if key in p['name']])
O = tris(json.load(open(our_dump)))
def inbox(P):
    if not box: return np.ones(len(P), bool)
    return (P[:, 0] >= box[0]) & (P[:, 0] <= box[1]) & (P[:, 1] >= box[2]) & (P[:, 1] <= box[3]) & (P[:, 2] >= box[4]) & (P[:, 2] <= box[5])
PR, PO = sample(R, 30000), sample(O, 30000)
PR, PO = PR[inbox(PR)], PO[inbox(PO)]
for name, P, Q in [('ours->ref', PO[:6000], PR), ('ref->ours', PR[:6000], PO)]:
    d, _ = nearest(P, Q); d *= 100
    print(f'[DIST] {name}: mean {d.mean():.2f} cm · p90 {np.percentile(d, 90):.2f} · max {d.max():.2f}')
    top = np.argsort(-d)[:5]
    print('        farthest:', ' | '.join(f'({P[i][0]:.2f},{P[i][1]:.2f},{P[i][2]:.2f}) {d[i]:.1f}' for i in top))
