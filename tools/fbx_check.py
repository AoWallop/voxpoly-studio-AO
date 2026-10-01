# ===== Check FBX files without any 3D app (reads the binary directly) — run after exporting rigged models =====
# usage: python tools/fbx_check.py <avatar.fbx> [<Name>@<clip>.fbx ...]
# Checks: (1) every clip file has AnimationCurves with real keys  (2) bone paths as Unity sees them (Preserve Hierarchy off =
#         the single top node is stripped) match the avatar
# Why: a clip can contain all its keys and still do nothing in Unity when the avatar has 2 top nodes and the clip file has 1 → paths differ.
# All good = one line "[FBXCHECK] OK" · otherwise lists the files/bones that are wrong and exits with code 1
import struct, zlib, sys
try: sys.stdout.reconfigure(encoding='utf-8')   # print non-ASCII safely on any console
except Exception: pass

def parse(path):
    data = open(path, 'rb').read()
    ver = struct.unpack_from('<I', data, 23)[0]; W = 8 if ver >= 7500 else 4
    def prop(o):
        t = chr(data[o]); o += 1
        if t in 'YCIFDL':
            f = {'Y':'<h','C':'<?','I':'<i','F':'<f','D':'<d','L':'<q'}[t]; return struct.unpack_from(f, data, o)[0], o + struct.calcsize(f)
        if t in 'SR':
            n = struct.unpack_from('<I', data, o)[0]; o += 4; return data[o:o+n], o + n
        n, enc, cl = struct.unpack_from('<III', data, o); o += 12; raw = data[o:o+cl]; o += cl
        if enc: raw = zlib.decompress(raw)
        f = {'f':'f','d':'d','l':'q','i':'i','b':'?'}[t]; return list(struct.unpack('<%d%s' % (n, f), raw)), o
    def node(o):
        if W == 8: end, np_, _ = struct.unpack_from('<QQQ', data, o); o += 24
        else: end, np_, _ = struct.unpack_from('<III', data, o); o += 12
        nl = data[o]; o += 1
        if end == 0: return None, o
        name = data[o:o+nl].decode(); o += nl; props = []
        for _ in range(np_): v, o = prop(o); props.append(v)
        kids = []
        while o < end - (13 if W == 4 else 25):
            k, o = node(o)
            if k is None: break
            kids.append(k)
        return (name, props, kids), end
    o = 27; top = []
    while o < len(data) - 200:
        n, o = node(o)
        if n is None: break
        top.append(n)
    objs = next(n for n in top if n[0] == 'Objects')[2]
    conns = next(n for n in top if n[0] == 'Connections')[2]
    models = {n[1][0]: n[1][1].split(b'\x00')[0].decode() for n in objs if n[0] == 'Model'}
    types = {n[1][0]: n[1][2].decode() for n in objs if n[0] == 'Model'}
    par = {}
    for c in conns:
        if c[1][0] == b'OO' and c[1][1] in models and (c[1][2] in models or c[1][2] == 0): par[c[1][1]] = c[1][2]
    tops = [i for i in models if par.get(i) == 0]
    def chain(i):
        out = []
        while i in models: out.append(models[i]); i = par.get(i)
        return out[::-1]
    upath = {models[i]: '/'.join(chain(i)[1:] if len(tops) == 1 else chain(i)) for i in models}
    bones = [models[i] for i in models if types[i] == 'LimbNode']
    curves = [n for n in objs if n[0] == 'AnimationCurve']
    keys = sum(len(next((k[1][0] for k in n[2] if k[0] == 'KeyTime'), [])) for n in curves)
    stacks = [n[1][1].split(b'\x00')[0].decode() for n in objs if n[0] == 'AnimationStack']
    return dict(tops=len(tops), upath=upath, bones=bones, curves=len(curves), keys=keys, stacks=stacks)

av_path, anims = sys.argv[1], sys.argv[2:]
av = parse(av_path); bad = []
if not av['bones']: bad.append(f'{av_path}: no bones (LimbNode)')
for f in anims:
    a = parse(f)
    if a['curves'] == 0 or a['keys'] == 0: bad.append(f'{f}: no keys (curves={a["curves"]} keys={a["keys"]})')
    for b in av['bones']:
        if a['upath'].get(b) != av['upath'].get(b): bad.append(f'{f}: path {b} = {a["upath"].get(b)} ≠ avatar {av["upath"].get(b)}')
if bad:
    print('[FBXCHECK] FAIL'); [print('  ' + x) for x in bad[:20]]; sys.exit(1)
print(f'[FBXCHECK] OK · bones={len(av["bones"])} · anim files={len(anims)} · bone paths match the avatar in every file (e.g. {av["upath"][av["bones"][-1]]})')
