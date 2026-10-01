# ===== Guess a rig file (which bone is the hips, chest, head, hands, feet, jaw, tail) from a motion dump =====
# usage: python tools/motion/rig.py <dump.json> <out.rig.json>
# Matches common naming (Mixamo "mixamorig:LeftHand", "Hips", "Spine2", "Head", "LeftToeBase", "Jaw", "Tail..." and L/R suffixes).
# ALWAYS open the result and fix it by hand — every rig is named differently. Unused roles can be deleted.
import json, sys, re
d = json.load(open(sys.argv[1])); names = list(d['bones'].keys())
low = {n: re.sub(r'^.*[:|]', '', n).lower() for n in names}
def is_side(s, side):
    word = 'left' if side == 'l' else 'right'
    return word in s or re.search(rf'[_.\s-]{side}$|^{side}[_.\s-]|[_.\s-]{side}[_.\s-]', s) is not None
def find(*pats, side=None):
    for p in pats:
        for n in names:
            s = low[n]
            if side and not is_side(s, side): continue
            if re.search(p, s): return n
    return None
def chain(pat):
    c = [n for n in names if re.search(pat, low[n])]
    return [c[0], c[len(c) // 2], c[-1]] if len(c) >= 3 else c
rest = d['rest']
rig = {
    'name': re.sub(r'\.[a-z]+$', '', d['file'], flags=re.I).split('@')[0],
    'root': find(r'^hips?$', r'pelvis', r'root', r'hip'),
    'chest': find(r'spine2$', r'chest', r'spine1$', r'spine'),
    'head': find(r'^head$', r'head'),
    'jaw': [x for x in [find(r'jaw'), find(r'jaw.*(end|tip)', r'chin'), find(r'(nose|muzzle|upper.?lip)')] if x],
    'hands': {'L': find(r'hand$', r'wrist', side='l'), 'R': find(r'hand$', r'wrist', side='r')},
    'feet': {'L': find(r'toe', r'foot', r'ankle', side='l'), 'R': find(r'toe', r'foot', r'ankle', side='r')},
    'tail': chain(r'tail'),
    'rest': None,
    'sounds': {'step': 'step', 'swing': 'whoosh', 'roar': 'roar', 'snap': 'snap', 'tail': 'whoosh_heavy', 'drop': 'body_fall', 'head': 'head'},
}
rig = {k: v for k, v in rig.items() if v not in (None, [], {})}
json.dump(rig, open(sys.argv[2], 'w'), indent=2)
print('[RIG] guessed →', sys.argv[2]); print(json.dumps(rig, indent=2))
print('[RIG] all bones:', ', '.join(names[:200]) + (' …' if len(names) > 200 else ''))
