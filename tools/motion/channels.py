# ===== Motion dump(s) + rig file → "channels": the overall pose of the body over time, ready to drive YOUR model in three.js =====
# usage: python tools/motion/channels.py <rig.json> <out.js> <dump1.json> [dump2.json ...] [--fps 30]
# Why channels and not bone angles: a different skeleton breaks copied angles. Channels describe the WHOLE body
# (turn, travel, height, lean, head, jaw, hands, feet, tail) relative to a rest pose and in the body's own facing,
# so any model can ADD them on top of its own idle pose. The timing stays the original animator's.
#
# Channels (only the ones whose bones are in the rig file):
#   turn            body facing change (rad, unwrapped)        travel_x / travel_z   root travel in the start facing (m)
#   height          root height change (m)                     pitch                 forward lean of root→chest (rad)
#   head_lift       elevation change of chest→head (rad)       head_yaw              sideways turn of chest→head (rad)
#   jaw             jaw opening (rad, 0 = most closed)
#   hand_L_x/y/z    hand offset in body frame (m), y measured from the GROUND (not from the hips)
#   foot_L_lift     foot height above its lowest point (m)
#   tail0_lift/yaw  per tail segment (root → mid → tip): elevation / sideways angle, body pitch removed
import json, sys, math
import numpy as np

a = sys.argv[1:]
fps_out = int(a[a.index('--fps') + 1]) if '--fps' in a else 30
if '--fps' in a: i = a.index('--fps'); del a[i:i + 2]
rig, out, dumps = json.load(open(a[0])), a[1], a[2:]

def ang_wrap(x): return (x + math.pi) % (2 * math.pi) - math.pi
def horiz(v): return np.array([v[0], 0, v[2]])

clips = {}
for path in dumps:
    d = json.load(open(path))
    for A in d['actions']:
        F, fps = A['frames'], A['fps']
        P = lambda b: np.array([f[b][0] for f in F], float) if b and b in F[0] else None
        n = len(F); t = np.arange(n) / fps
        root, chest, head = P(rig.get('root')), P(rig.get('chest')), P(rig.get('head'))
        if root is None: print('[CHANNELS] skip', A['name'], '(no root bone)'); continue
        feet = {s: P(b) for s, b in rig.get('feet', {}).items()}; hands = {s: P(b) for s, b in rig.get('hands', {}).items()}
        floor = min(float(x[:, 1].min()) for x in [root, *[f for f in feet.values() if f is not None]])
        # facing: perpendicular to the left→right axis of the feet (or hands); fallback root→chest/head horizontal
        side = None
        for pair in (feet, hands):
            if pair.get('L') is not None and pair.get('R') is not None: side = pair['L'] - pair['R']; break
        if side is not None:
            fwd = np.stack([-side[:, 2], np.zeros(n), side[:, 0]], 1)        # up × side
        else:
            fwd = np.stack([horiz(v) for v in ((head if head is not None else chest) - root)])
        k = np.ones(9) / 9
        h = np.unwrap(np.arctan2(fwd[:, 0], fwd[:, 2])); h = np.convolve(np.pad(h, 4, mode='edge'), k, 'valid')   # smoothed heading (0 = +z)
        c, s = np.cos(-h), np.sin(-h)
        def local(v):                                                    # world vector → body frame (x right, y up, z forward)
            return np.stack([v[:, 0] * c + v[:, 2] * s, v[:, 1], -v[:, 0] * s + v[:, 2] * c], 1)
        ch = {}
        ch['turn'] = h - h[0]
        trav = root - root[0]; c0, s0 = math.cos(-h[0]), math.sin(-h[0])
        ch['travel_x'] = trav[:, 0] * c0 + trav[:, 2] * s0; ch['travel_z'] = -trav[:, 0] * s0 + trav[:, 2] * c0
        ch['height'] = root[:, 1] - root[0, 1]
        if chest is not None:
            v = local(chest - root); pitch = np.arctan2(v[:, 2], v[:, 1]); ch['pitch'] = pitch - pitch[0]
        else: pitch = np.zeros(n)
        if chest is not None and head is not None:
            v = local(head - chest)
            lift = np.arctan2(v[:, 1], np.hypot(v[:, 0], v[:, 2])); yaw = np.arctan2(v[:, 0], v[:, 2])
            ch['head_lift'] = lift - lift[0]; ch['head_yaw'] = np.array([ang_wrap(x) for x in yaw - yaw[0]])
        jaw = rig.get('jaw', [])
        if len(jaw) == 3 and all(b in F[0] for b in jaw):
            hinge, low_tip, up_tip = P(jaw[0]), P(jaw[1]), P(jaw[2]); u, w = low_tip - hinge, up_tip - hinge
            an = np.arccos(np.clip((u * w).sum(1) / (np.linalg.norm(u, axis=1) * np.linalg.norm(w, axis=1) + 1e-9), -1, 1))
            ch['jaw'] = an - np.percentile(an, 10)
        for sd, x in hands.items():
            if x is None: continue
            v = local(x - root); v0 = v[0]
            ch[f'hand_{sd}_x'] = v[:, 0] - v0[0]; ch[f'hand_{sd}_y'] = (x[:, 1] - floor) - (x[0, 1] - floor); ch[f'hand_{sd}_z'] = v[:, 2] - v0[2]
        for sd, x in feet.items():
            if x is None: continue
            ch[f'foot_{sd}_lift'] = x[:, 1] - x[:, 1].min()
        tail = [b for b in rig.get('tail', []) if b in F[0]]
        for i in range(len(tail) - 1):
            v = local(P(tail[i + 1]) - P(tail[i]))
            lift = np.arctan2(v[:, 1], np.hypot(v[:, 0], v[:, 2])) + pitch       # remove body pitch or the tail sinks when the body rears up
            yaw = np.arctan2(v[:, 0], -v[:, 2])
            ch[f'tail{i}_lift'] = lift - lift[0]; ch[f'tail{i}_yaw'] = np.array([ang_wrap(x) for x in yaw - yaw[0]])
        # resample to fps_out
        ln = (n - 1) / fps; to = np.arange(0, ln + 1e-9, 1 / fps_out)
        clips[A['name']] = {'fps': fps_out, 'len': round(ln, 3), 'source': d['file'],
                            'ch': {k_: [round(float(x), 4) for x in np.interp(to, t, v_)] for k_, v_ in ch.items()}}
        print(f"[CHANNELS] {A['name']:<20} {ln:5.2f}s  {', '.join(ch.keys())}")
open(out, 'w', encoding='utf-8').write('// generated by tools/motion/channels.py — do not edit by hand · use with models/motion.js\n'
                                     f'export const RIG = {json.dumps({k: rig[k] for k in rig if k != "sounds"})};\n'
                                     f'export const CLIPS = {json.dumps(clips)};\n')
print('[CHANNELS] wrote', out)
