// ===== Rig roles: which bone is the hips, head, upper arm, shin… — works with any naming =====
// Plain JS (no three.js) so both the browser pages and the Node tools can use it.
//   guessRoles(bones)   bones = [{ name, parent }] (parent = index, -1 = root)  →  { hips: 'Hips', 'upperArm.L': 'LeftArm', … }
// Handles common styles: Mixamo (mixamorig:LeftForeArm) · Unity/Unreal (upperarm_l, calf_r, spine_01) ·
// Blender (upper_arm.L, thigh.R) · plain (left_elbow, right_knee).
// A guess is only a guess: `npm run clone` prints the result — check it, and fix it in workspace/clones/index.json ("roles").
//
// Limb roles mean JOINTS, counted from the body outwards:
//   upperArm = shoulder joint · lowerArm = elbow · hand = wrist
//   upperLeg = hip joint      · lowerLeg = knee  · foot = ankle · toe = ball of the foot
// The proportion sliders (models/clone.js → PROPORTIONS) are written against these roles, not against bone names.

export const SIDES = ['L', 'R'];
export const LIMB_ROLES = ['shoulder', 'upperArm', 'lowerArm', 'hand', 'upperLeg', 'lowerLeg', 'foot', 'toe'];
export const CENTER_ROLES = ['hips', 'spine', 'chest', 'neck', 'head'];

const strip = n => n.replace(/^.*[:|]/, '');                         // drop "mixamorig:" / "Armature|" prefixes
function sideOf(n) {
  const s = strip(n).toLowerCase();
  if (/left/.test(s) || /(^|[_.\s-])l($|[_.\s-])/.test(s) || /[a-z]L$/.test(strip(n))) return 'L';
  if (/right/.test(s) || /(^|[_.\s-])r($|[_.\s-])/.test(s) || /[a-z]R$/.test(strip(n))) return 'R';
  return null;
}
// "mixamorig:LeftForeArm" → "forearm" · "upper_arm.L" → "upperarm" · "spine_01" → "spine01"
function baseOf(n) {
  let s = strip(n);
  s = s.replace(/[_.\s-][LRlr]$/, '').replace(/^[LRlr][_.\s-]/, '').replace(/([a-z])[LR]$/, '$1');
  return s.toLowerCase().replace(/left|right/g, '').replace(/[_.\s-]+/g, '');
}

export function guessRoles(bones) {
  const info = bones.map((b, i) => ({ i, name: b.name, parent: b.parent, side: sideOf(b.name), base: baseOf(b.name) }));
  const kids = i => info.filter(x => x.parent === i);
  const R = {};
  const first = (re, side = null) => info.find(x => re.test(x.base) && (side ? x.side === side : !x.side));
  const firstOf = (...res) => res.reduce((hit, re) => hit || first(re), null);   // try patterns in order of preference

  // --- centre line ---
  const hips = firstOf(/^(hips?|pelvis)$/, /^cog$/, /^root$/) || info.find(x => x.parent < 0 && kids(x.i).length > 1) || info.find(x => x.parent < 0);
  if (hips) R.hips = hips.name;
  const spines = info.filter(x => !x.side && /^(spine\d*|torso|waist|abdomen|chest|upperchest|ribcage|thorax)$/.test(x.base));
  const spine = spines.find(x => /^(spine0?1?|torso|waist|abdomen)$/.test(x.base)) || spines[0];
  const chest = spines.find(x => /^(chest|upperchest|ribcage|thorax)$/.test(x.base)) || spines[spines.length - 1];
  if (spine) R.spine = spine.name;
  if (chest) R.chest = chest.name;
  const neck = first(/^neck\d*$/); if (neck) R.neck = neck.name;
  const head = firstOf(/^head$/, /head/); if (head) R.head = head.name;

  // --- limbs, per side: names first, then follow the chain for joints a name did not give ---
  for (const s of SIDES) {
    const f = re => first(re, s);
    const set = (role, x) => { if (x) R[role + '.' + s] = x.name; return x; };
    const child = x => x && kids(x.i)[0];
    set('shoulder', f(/^(shoulder|clavicle|collar(bone)?)$/));
    const ua = set('upperArm', f(/^(upperarm|uparm|arm)$/));
    const la = set('lowerArm', f(/^(forearm|lowerarm|lowarm|elbow)$/) || child(ua));
    set('hand', f(/^(hand|wrist)$/) || child(la));
    // "Leg" is the thigh in plain rigs (left_leg) but the shin in Mixamo (LeftUpLeg + LeftLeg)
    const hasUp = !!f(/^(upleg|upperleg|thigh)$/);
    const ul = set('upperLeg', f(/^(upleg|upperleg|thigh)$/) || (!hasUp && f(/^(leg|hipjoint)$/)));
    const ll = set('lowerLeg', f(/^(lowerleg|lowleg|shin|calf|knee)$/) || (hasUp && f(/^leg$/)) || child(ul));
    const ft = set('foot', child(ll) || f(/^(foot|ankle)$/));            // the joint right after the knee = ankle
    set('toe', child(ft) || f(/^(toe\w*|ball)$/));
  }
  return R;
}

/** List bone names for a set of roles (missing roles are skipped). Limb roles without a side mean both sides. */
export function bonesFor(roles, list) {
  const out = [];
  for (const r of list) {
    if (LIMB_ROLES.includes(r)) { for (const s of SIDES) if (roles[r + '.' + s]) out.push(roles[r + '.' + s]); }
    else if (roles[r]) out.push(roles[r]);
  }
  return [...new Set(out)];
}
