# ===== Find sound moments in animation (motion dumps + rig file) → cue JSON + a timeline page =====
# usage: python tools/sound/cues.py <rig.json> <out_prefix> <dump1.json> [dump2.json ...]
# output: <out_prefix>.json  { clips: { name: { len, cues:[{t, end?, kind, sfx, note}], curves:{...} } } }
#         <out_prefix>.html  timeline per clip (curves + markers + table) — open it through `npm run serve`
# Moments (only for roles present in the rig file; sound names come from rig["sounds"]):
#   step   foot moved, then stopped close to the floor          swing  peak speed of a hand
#   roar   jaw open ≥ 0.5 s (with end time → sustained sound)   snap   short jaw open
#   tail   peak speed of the tail tip                           head   head thrust (peak speed)
#   drop   body falls fast then stops (hits the ground)
# Speeds are measured relative to body size (rest height of the root), so the same thresholds work for small and huge rigs.
import json, sys, math, os
import numpy as np

a = sys.argv[1:]
rig, prefix, dumps = json.load(open(a[0])), a[1], a[2:]
SND = {'step': 'step', 'swing': 'whoosh', 'roar': 'roar', 'snap': 'snap', 'tail': 'whoosh_heavy', 'drop': 'body_fall', 'head': 'head', **rig.get('sounds', {})}

def speed(p, fps):
    v = np.linalg.norm(np.diff(p, axis=0), axis=1) * fps; v = np.append(v, v[-1])
    k = np.array([1, 2, 3, 2, 1], float); k /= k.sum(); return np.convolve(v, k, 'same')
def peaks(x, thr, gap):
    out = []
    for i in range(1, len(x) - 1):
        if x[i] >= thr and x[i] >= x[i - 1] and x[i] >= x[i + 1] and (not out or i - out[-1] >= gap): out.append(i)
        elif x[i] >= thr and out and i - out[-1] < gap and x[i] > x[out[-1]]: out[-1] = i
    return out

def analyse(A, rest):
    F, fps = A['frames'], A['fps']; N = len(F)
    P = lambda b: np.array([f[b][0] for f in F], float) if b and b in F[0] else None
    root = P(rig.get('root')); S = max(.2, rest[rig['root']]['head'][1]) if rig.get('root') in rest else 1.0   # body scale = rest hip height
    ev, curves = [], {}
    add = lambda t, kind, note, end=None: ev.append({'t': round(t, 3), **({'end': round(end, 3)} if end else {}), 'kind': kind, 'sfx': SND[kind], 'note': note})
    jaw = rig.get('jaw', [])
    if len(jaw) == 3 and all(b in F[0] for b in jaw):
        hinge, lo, up = P(jaw[0]), P(jaw[1]), P(jaw[2]); u, w = lo - hinge, up - hinge
        an = np.degrees(np.arccos(np.clip((u * w).sum(1) / (np.linalg.norm(u, axis=1) * np.linalg.norm(w, axis=1) + 1e-9), -1, 1)))
        j = an - np.percentile(an, 10); curves['jaw'] = j / max(1, j.max())
        op = j > max(12, j.max() * .45); i = 0
        while i < N:
            if op[i]:
                s = i
                while i < N and op[i]: i += 1
                dur = (i - s) / fps; pk = s + int(np.argmax(j[s:i]))
                if dur >= .5: add(s / fps, 'roar', f'jaw open {dur:.1f}s (max {j[pk]:.0f}°)', i / fps)
                elif dur >= .12: add(pk / fps, 'snap', f'short jaw open {dur:.2f}s')
            i += 1
    head = P(rig.get('head'))
    if head is not None and root is not None:
        hs = speed(head - root, fps); curves['head'] = hs / max(1e-6, hs.max())
        for k in peaks(hs, max(1.1 * S, np.percentile(hs, 97)), int(fps * .5)): add(k / fps, 'head', f'head thrust {hs[k] / S:.1f} body/s')
    for sd, b in rig.get('hands', {}).items():
        x = P(b)
        if x is None: continue
        hs = speed(x, fps); curves['hand_' + sd] = hs / max(1e-6, hs.max())
        for k in peaks(hs, max(1.6 * S, np.percentile(hs, 96)), int(fps * .4)): add(max(0, k / fps - .04), 'swing', f'hand {sd} peak {hs[k] / S:.1f} body/s')
    tail = rig.get('tail', [])
    if tail and tail[-1] in F[0]:
        tl = P(tail[-1]); ts = speed(tl, fps); curves['tail'] = ts / max(1e-6, ts.max())
        for k in peaks(ts, max(2.2 * S, np.percentile(ts, 96)), int(fps * .5)): add(k / fps, 'tail', f'tail tip peak {ts[k] / S:.1f} body/s')
    for sd, b in rig.get('feet', {}).items():
        f = P(b)
        if f is None: continue
        # contact = the foot comes DOWN into the floor band after being lifted (works for in-place clips where a planted foot slides back)
        y = np.convolve(np.pad(f[:, 1], 1, mode='edge'), np.ones(3) / 3, 'valid'); floor = np.percentile(y, 5); lift = y.max() - floor
        curves['foot_' + sd] = (y - floor) / max(1e-6, lift)
        if lift < .04 * S: continue                         # foot never leaves the ground in this clip
        band, up = floor + .2 * lift, False
        cyclic = abs(y[0] - y[-1]) < .35 * lift                # looping clip: read across the seam (a step right at frame 0 still counts)
        yy = np.concatenate([y, y]) if cyclic else y
        for k in range(len(yy)):
            if yy[k] > floor + .5 * lift: up = True
            elif up and yy[k] <= band:
                up = False
                if not cyclic: add(k / fps, 'step', f'foot {sd} down')
                elif k >= N: add((k - N) / fps, 'step', f'foot {sd} down')
    if root is not None:
        vy = np.gradient(root[:, 1]) * fps; vy = np.convolve(vy, np.ones(3) / 3, 'same'); curves['body'] = np.abs(vy) / max(1e-6, np.abs(vy).max())
        for k in range(2, N - 2):
            fell = root[max(0, k - int(fps * .4)):k + 1, 1].max() - root[k, 1]           # must really come down, not just bob
            if vy[k - 2] < -.7 * S and vy[k + 1] > vy[k - 2] * .3 and vy[k] < -.28 * S and fell > .25 * S: add(k / fps, 'drop', f'body drop {fell / S:.2f} body heights'); break
    ev.sort(key=lambda e: (e['kind'], e['t'])); m = []
    for e in ev:                                            # merge same kind < 0.12 s apart (both feet / both hands)
        if m and m[-1]['kind'] == e['kind'] and e['t'] - m[-1]['t'] < .12 and 'end' not in e: m[-1]['note'] += ' + ' + e['note']; continue
        m.append(e)
    m.sort(key=lambda e: e['t'])
    return {'len': round((N - 1) / fps, 3), 'fps': fps, 'cues': m, 'curves': {k: [round(float(x), 3) for x in v[::2]] for k, v in curves.items()}}

res = {'rig': rig.get('name', ''), 'clips': {}}
for path in dumps:
    d = json.load(open(path))
    for A in d['actions']:
        r = analyse(A, d['rest']); res['clips'][A['name']] = r
        print(f"[CUES] {A['name']:<20} {r['len']:5.2f}s  " + ' '.join(f"{c['kind']}@{c['t']}" for c in r['cues'][:16]))
os.makedirs(os.path.dirname(os.path.abspath(prefix)), exist_ok=True)
json.dump(res, open(prefix + '.json', 'w'), indent=1)

COL = {'jaw': '#ff8a5c', 'head': '#ffffff', 'hand_L': '#7fd0ff', 'hand_R': '#5fa8ff', 'tail': '#b58cff', 'foot_L': '#9fe0a8', 'foot_R': '#6fcf7f', 'body': '#f0c874'}
KCOL = {'roar': '#ff8a5c', 'snap': '#ff8a5c', 'head': '#ffffff', 'swing': '#7fd0ff', 'tail': '#b58cff', 'step': '#9fe0a8', 'drop': '#f0c874'}
def svg(r):
    W, H, L = 820, 150, max(r['len'], .01); x = lambda t: 10 + t / L * (W - 20); o = [f'<svg viewBox="0 0 {W} {H + 26}" class="tl">']
    for s in range(int(L) + 1): o.append(f'<line x1="{x(s):.1f}" y1="0" x2="{x(s):.1f}" y2="{H}" stroke="#ffffff14"/><text x="{x(s):.1f}" y="{H + 16}" fill="#9a94a8" font-size="11" text-anchor="middle">{s}s</text>')
    for k, v in r['curves'].items():
        pts = ' '.join(f'{x(i * 2 / r["fps"]):.1f},{H - 6 - y * (H - 16):.1f}' for i, y in enumerate(v)); o.append(f'<polyline points="{pts}" fill="none" stroke="{COL.get(k, "#aaa")}" stroke-width="1.6" opacity=".85"/>')
    for e in r['cues']:
        c = KCOL[e['kind']]
        if 'end' in e: o.append(f'<rect x="{x(e["t"]):.1f}" y="2" width="{x(e["end"]) - x(e["t"]):.1f}" height="{H - 4}" fill="{c}" opacity=".12"/>')
        o.append(f'<line x1="{x(e["t"]):.1f}" y1="2" x2="{x(e["t"]):.1f}" y2="{H}" stroke="{c}" stroke-width="2" stroke-dasharray="4 3"/>')
    return ''.join(o) + '</svg>'
cards = ''.join(f'<section><h2>{n} <small>{r["len"]} s · {len(r["cues"])} cues</small></h2>{svg(r)}<table><tr><th>time (s)</th><th>moment</th><th>sound</th><th>detail</th></tr>'
                + ''.join(f'<tr><td>{c["t"]:.2f}' + (f'–{c["end"]:.2f}' if 'end' in c else '') + f'</td><td>{c["kind"]}</td><td>{c["sfx"]}</td><td>{c["note"]}</td></tr>' for c in r['cues']) + '</table></section>'
                for n, r in res['clips'].items())
legend = ' '.join(f'<span style="color:{c}">■ {k}</span>' for k, c in COL.items())
open(prefix + '.html', 'w', encoding='utf-8').write(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sound cues · {res["rig"]}</title>
<style>:root{{color-scheme:dark}}body{{margin:0;padding:20px 16px;background:#16141c;color:#e9e4dc;font-family:system-ui,Tahoma,sans-serif;max-width:900px}}h1{{font-size:18px;color:#f0c874;margin:0 0 4px}}
.lead{{color:#bdb6ad;font-size:13px;line-height:1.7}}section{{background:#211e29;border:1px solid #ffffff1c;border-radius:10px;padding:12px 14px;margin:14px 0}}h2{{font-size:16px;margin:0 0 8px}}h2 small{{color:#bdb6ad;font-weight:400;font-size:12px}}
.tl{{width:100%;height:auto;background:#141219;border-radius:6px}}table{{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}}th,td{{text-align:left;padding:5px 6px;border-bottom:1px solid #ffffff12}}th{{color:#bdb6ad;font-weight:400}}td:first-child{{white-space:nowrap;color:#f0c874}}</style></head><body>
<h1>Sound cues · {res["rig"]}</h1><p class="lead">Curves = how strongly each part moves (each scaled to its own max) · dashed lines = detected moments · shaded = sustained (jaw open)<br>{legend}</p>{cards}</body></html>''')
print('[CUES] wrote', prefix + '.json', '+ .html')
