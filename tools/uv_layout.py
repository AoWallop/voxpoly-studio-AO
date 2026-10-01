# ===== Draw a UV layout as a transparent PNG (artists lay it over the texture and paint) =====
# usage: python tools/uv_layout.py <Name>_uv.json <out.png>   (the json comes from smart_uv_bake.py / anim_export.py)
# 1-px black lines + faint grey island fill (shows where the mesh is) · drawn 4x larger then downscaled = smooth lines
import json, sys
from PIL import Image, ImageDraw

d = json.load(open(sys.argv[1])); S = d['size']; K = 4; W = S * K
im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
P = lambda uv: (uv[0] * W, (1 - uv[1]) * W)                          # UV counts V from the bottom, images from the top
for t in d['tris']: g.polygon([P(p) for p in t], fill=(255, 255, 255, 40))
for a, b in d['edges']: g.line([P(a), P(b)], fill=(0, 0, 0, 255), width=K)
im.resize((S, S), Image.LANCZOS).save(sys.argv[2]); print('[UVLAYOUT]', sys.argv[2])
