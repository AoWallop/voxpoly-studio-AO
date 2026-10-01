# ===== Draw a 3-view wireframe sheet (front / side / top) + UV layout over a texture, from tools/topo/dump.py JSON =====
# usage: python tools/topo/sheet.py <dump.json> <out_prefix> [--part <name contains>] [--tex <basecolor>]
# output: <out_prefix>_wire.png (far lines dimmer) · <out_prefix>_uv.png (with --tex)
import json, sys
from PIL import Image, ImageDraw

a = sys.argv[1:]
dump, prefix = a[0], a[1]
part = a[a.index('--part') + 1] if '--part' in a else None
tex = a[a.index('--tex') + 1] if '--tex' in a else None
parts = [p for p in json.load(open(dump)) if not part or part in p['name']]
COLS = [(230, 90, 60), (60, 160, 230), (90, 200, 90), (220, 180, 40), (200, 90, 220)]

# Blender axes: X right · Y depth · Z up (FBX import already makes Z up)
VIEWS = [('front', lambda v: (v[0], v[2]), lambda v: -v[1]),
         ('side', lambda v: (v[1], v[2]), lambda v: v[0]),
         ('top', lambda v: (v[0], -v[1]), lambda v: v[2])]
S = 900
allv = [v for p in parts for v in p['v']]
sheet = Image.new('RGB', (S * 3, S), (24, 26, 32))
for vi, (name, proj, depth) in enumerate(VIEWS):
    pts = [proj(v) for v in allv]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    sc = (S * 0.9) / max(max(xs) - min(xs), max(ys) - min(ys))
    img = Image.new('RGB', (S, S), (24, 26, 32)); d = ImageDraw.Draw(img)
    ds = [depth(v) for v in allv]; dmin, dmax = min(ds), max(ds)
    for pi, p in enumerate(parts):
        col = COLS[pi % len(COLS)]
        V = p['v']
        # draw far faces first, near faces last · far lines dimmer
        faces = sorted(p['f'], key=lambda f: sum(depth(V[i]) for i in f) / len(f))
        for f in faces:
            dz = (sum(depth(V[i]) for i in f) / len(f) - dmin) / max(dmax - dmin, 1e-9)
            k = 0.25 + 0.75 * dz
            c = tuple(int(x * k) for x in col)
            poly = [((proj(V[i])[0] - cx) * sc + S / 2, S / 2 - (proj(V[i])[1] - cy) * sc) for i in f]
            d.polygon(poly, fill=tuple(int(x * k * 0.25) for x in col), outline=c)
    d.text((10, 10), name, fill=(220, 220, 220))
    sheet.paste(img, (vi * S, 0))
sheet.save(prefix + '_wire.png'); print('[SHEET]', prefix + '_wire.png')

if tex:
    im = Image.open(tex).convert('RGB').resize((1024, 1024))
    d = ImageDraw.Draw(im)
    for pi, p in enumerate(parts):
        if not p['uv']: continue
        for poly in p['uv']:
            d.polygon([(u * 1024, (1 - v) * 1024) for u, v in poly], outline=(255, 255, 0))
    im.save(prefix + '_uv.png'); print('[SHEET]', prefix + '_uv.png')
