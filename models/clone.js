// ===== Rebuild a model copied from FBX (tools/blender/fbx_clone.py) in three.js — every vertex exact — and reshape it =====
// Works with any rigged character or prop. Full explanation: docs/en/fbx-clone.md
//
//   const C = await loadClone(url, { texture, roles })
//     → { root, mesh, skeleton, clips, data, roles, reshape(mods), quadLines(), verify(clip), setVisible(group, on) }
//   C.reshape({ size: { Head: 1.2 }, length: { LeftForeArm: 1.1 } })   non-destructive: always computed from the original
//     size     = scale the part around a bone (its children grow with it)
//     length   = move the bone further from its parent (= longer parent segment)
//     sizeOnly = scale only the part around this bone; children keep their size (e.g. a thicker wrist, same hand)
//     girth    = push skin away from the bone axis (thicker, same length) · belly = push only the front (+Z)
//   Clips keep playing on the new body: positions are stored as "offset from rest" and added back on the new skeleton.
//
//   PROPORTIONS + modsFromSliders(roles, { headSize: 1.2, legLength: 1.1 }) = the slider set of clone.html, usable in game code.
import * as THREE from 'three';
import { guessRoles, bonesFor } from './rigroles.js';

// Slider id · kind of change · roles it acts on. Written against roles (models/rigroles.js), so any rig naming works.
export const PROPORTIONS = [
  ['body',          'size',     ['@root']],
  ['headSize',      'size',     ['head']],
  ['neckLength',    'length',   ['head']],
  ['torsoLength',   'length',   ['@spineChain']],
  ['shoulderWidth', 'length',   ['upperArm']],
  ['armLength',     'length',   ['lowerArm', 'hand']],
  ['handSize',      'size',     ['hand']],
  ['wrist',         'sizeOnly', ['hand']],
  ['chest',         'girth',    ['chest']],
  ['waist',         'girth',    ['spine']],
  ['belly',         'belly',    ['spine', 'hips']],
  ['hips',          'girth',    ['hips']],
  ['armGirth',      'girth',    ['upperArm', 'lowerArm']],
  ['legGirth',      'girth',    ['upperLeg', 'lowerLeg']],
  ['hipWidth',      'length',   ['upperLeg']],
  ['legLength',     'length',   ['lowerLeg', 'foot']],
  ['footSize',      'size',     ['foot']],
];
const KINDS = ['size', 'length', 'sizeOnly', 'girth', 'belly'];

/** Bones each slider moves for this rig ([] = the rig lacks those roles, hide the slider). */
export function proportionBones(bones, roles) {
  const out = {};
  for (const [id, , list] of PROPORTIONS) out[id] = list.flatMap(r =>
    r === '@root' ? bones.filter(b => b.parent < 0).map(b => b.name)
    : r === '@spineChain' ? spineChain(bones, roles) : bonesFor(roles, [r]));
  for (const id in out) out[id] = [...new Set(out[id])];
  return out;
}
// every bone from the first spine bone up to the neck (or chest) — "longer torso" stretches all of them evenly
function spineChain(bones, roles) {
  const idx = n => bones.findIndex(b => b.name === n), top = idx(roles.neck || roles.chest), stop = idx(roles.spine);
  if (top < 0 || stop < 0) return [];
  const out = []; for (let i = top; i >= 0; i = bones[i].parent) { out.push(bones[i].name); if (i === stop) return out; }
  return [];
}
/** Slider values → mods for reshape(). Sliders acting on the same bone multiply. */
export function modsFromSliders(bones, roles, sliders) {
  const map = proportionBones(bones, roles), mods = Object.fromEntries(KINDS.map(k => [k, {}]));
  for (const [id, kind] of PROPORTIONS) { const v = sliders[id] ?? 1; if (v === 1) continue;
    for (const n of map[id]) mods[kind][n] = (mods[kind][n] ?? 1) * v; }
  return mods;
}

export async function loadClone(src, { texture, roles } = {}) {
  const D = typeof src === 'string' ? await (await fetch(src)).json() : src;
  roles = roles || guessRoles(D.bones);
  const boneI = n => D.bones.findIndex(b => b.name === n);

  // ---------- geometry: split vertices along UV seams (same vertex, different UV = new vertex) · quad → (0,1,2)(0,2,3) like Blender ----------
  const key = new Map(), orig = [], uv = [], gIdx = new Map([['body', []]]);
  D.faces.forEach((f, fi) => {
    const ids = f.map((vi, k) => { const [u, v] = D.uvs[fi][k], kk = vi + ':' + u + ':' + v;
      if (!key.has(kk)) { key.set(kk, orig.length); orig.push(vi); uv.push(u, v); } return key.get(kk); });
    const g = D.groups?.[fi] || 'body'; if (!gIdx.has(g)) gIdx.set(g, []); const out = gIdx.get(g);
    for (let k = 1; k < ids.length - 1; k++) out.push(ids[0], ids[k], ids[k + 1]);
  });
  // face groups = the source meshes (body / eyes / hair…) → show / hide each one
  const groupNames = [...gIdx.keys()].filter(g => gIdx.get(g).length), groupRange = {}, idx = [];
  for (const g of groupNames) { groupRange[g] = [idx.length, gIdx.get(g).length]; idx.push(...gIdx.get(g)); }
  // normals are averaged on the ORIGINAL vertices (not split by UV seams) → the surface stays smooth across seams, like the source
  const vn = new Float32Array(D.verts.length), P = D.verts, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const f of D.faces) for (let k = 1; k < f.length - 1; k++) {
    const i0 = f[0], i1 = f[k], i2 = f[k + 1];
    a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
    const n = b.sub(a).cross(c.sub(a));
    for (const i of [i0, i1, i2]) { vn[i * 3] += n.x; vn[i * 3 + 1] += n.y; vn[i * 3 + 2] += n.z; }
  }
  const N = orig.length, pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
  orig.forEach((vi, i) => {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = P[vi * 3 + k];
    const l = Math.hypot(vn[vi * 3], vn[vi * 3 + 1], vn[vi * 3 + 2]) || 1; for (let k = 0; k < 3; k++) nor[i * 3 + k] = vn[vi * 3 + k] / l;
    D.skin[vi].forEach(([bi, w], k) => { si[i * 4 + k] = bi; sw[i * 4 + k] = w; });
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(idx); groupNames.forEach((g, i) => geo.addGroup(groupRange[g][0], groupRange[g][1], i));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const restPos = pos.slice();

  // ---------- skeleton ----------
  const root = new THREE.Group(); root.name = D.source;
  const bones = D.bones.map(d => { const o = new THREE.Bone(); o.name = d.name; o.position.fromArray(d.pos); o.quaternion.fromArray(d.quat); return o; });
  D.bones.forEach((d, i) => (d.parent >= 0 ? bones[d.parent] : root).add(bones[i]));
  root.updateMatrixWorld(true);
  const restW = bones.map(o => o.matrixWorld.clone());
  const skeleton = new THREE.Skeleton(bones);

  let mat;
  if (texture) { const t = texture.isTexture ? texture : await new THREE.TextureLoader().loadAsync(texture); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    mat = new THREE.MeshStandardMaterial({ map: t, roughness: .8, metalness: 0 }); }
  else mat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: .7 });
  const INVIS = new THREE.MeshBasicMaterial({ visible: false }), hidden = new Set(D.hidden || []);
  let curMat = mat; const matArr = m => groupNames.map(g => hidden.has(g) ? INVIS : m);
  const mesh = new THREE.SkinnedMesh(geo, matArr(mat)); mesh.name = D.source.replace(/\.fbx$/i, '');
  root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());

  // ---------- clips: positions kept as "offset from rest" so they still fit after reshape() ----------
  const restLocal = D.bones.map(d => new THREE.Vector3().fromArray(d.pos));
  let curLocal = restLocal.map(v => v.clone());
  const legBones = ['lowerLeg.L', 'foot.L', 'toe.L'].map(r => boneI(roles[r])).filter(i => i >= 0);
  const legOf = L => legBones.reduce((t, i) => t + L[i].length(), 0);
  const legRatio = () => legOf(curLocal) / (legOf(restLocal) || 1);
  // feet on the ground (for clips made in code with ground: 'lock' | 'clamp'): pose the REAL reshaped body each frame,
  // find the lowest foot vertex, then raise / lower the hips so it touches the floor. 'lock' = always touching (walk) · 'clamp' = never below (run, jump)
  let footV = null; const hipI = boneI(roles.hips) >= 0 ? boneI(roles.hips) : D.bones.findIndex(b => b.parent < 0);
  function groundFix(c, P) {
    if (!footV) {
      const fb = new Set(['foot.L', 'foot.R', 'toe.L', 'toe.R'].map(r => boneI(roles[r])).filter(i => i >= 0));
      if (!fb.size) D.bones.forEach((b, i) => { if (/ankle|foot|toe/i.test(b.name)) fb.add(i); });
      footV = []; for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) if (sw[i * 4 + k] > .2 && fb.has(si[i * 4 + k])) { footV.push(i); break; } }
    let g0 = 1e9; for (let i = 1; i < N * 3; i += 3) g0 = Math.min(g0, pos[i]);
    const M = bones.map(() => new THREE.Matrix4()), v = new THREE.Vector3(), t = new THREE.Vector3(), hp = P[D.bones[hipI].name];
    for (let f = 0; f < c.times.length; f++) {
      bones.forEach((o, i) => { const tr = c.tracks[D.bones[i].name]; if (tr) { o.position.fromArray(P[D.bones[i].name], f * 3); o.quaternion.fromArray(tr.q, f * 4); } });
      root.updateMatrixWorld(true); bones.forEach((o, i) => M[i].multiplyMatrices(o.matrixWorld, skeleton.boneInverses[i]));
      let mn = 1e9; for (const i of footV) { v.fromArray(pos, i * 3); t.set(0, 0, 0); for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k]; if (w) t.add(v.clone().applyMatrix4(M[si[i * 4 + k]]).multiplyScalar(w)); } mn = Math.min(mn, t.y); }
      const d = g0 - mn; if (c.ground === 'lock' || d > 0) hp[f * 3 + 1] += d; }
    skeleton.pose(); root.updateMatrixWorld(true);
  }
  function makeClips() {
    const out = {};
    for (const [name, c] of Object.entries(D.clips)) {
      const tracks = [], P = {};
      D.bones.forEach((d, i) => { const tr = c.tracks[d.name]; if (!tr) return;
        // scaleWithLegs: lift / dip of the body scales with the new leg length → longer legs step higher, no sinking or floating
        const k0 = c.scaleWithLegs ? legRatio() : 1, p = tr.p.slice();
        for (let k = 0; k < p.length; k += 3) { p[k] = curLocal[i].x + (p[k] - restLocal[i].x) * k0; p[k + 1] = curLocal[i].y + (p[k + 1] - restLocal[i].y) * k0; p[k + 2] = curLocal[i].z + (p[k + 2] - restLocal[i].z) * k0; }
        P[d.name] = p; });
      if (c.ground) groundFix(c, P);
      D.bones.forEach(d => { const tr = c.tracks[d.name]; if (!tr) return;
        tracks.push(new THREE.VectorKeyframeTrack(d.name + '.position', c.times, P[d.name]), new THREE.QuaternionKeyframeTrack(d.name + '.quaternion', c.times, tr.q)); });
      out[name] = new THREE.AnimationClip(name, c.duration, tracks);
    }
    return out;
  }
  const api = { root, mesh, skeleton, data: D, roles, clips: makeClips(), orig, groups: groupNames };
  api.setMaterial = m => { curMat = m; mesh.material = matArr(m); };
  api.getMaterial = () => curMat;
  api.setVisible = (g, on) => { on ? hidden.delete(g) : hidden.add(g); mesh.material = matArr(curMat); };
  api.isVisible = g => !hidden.has(g);
  // index of the visible groups only (export without the hidden parts stacked inside)
  api.visibleIndex = () => groupNames.filter(g => !hidden.has(g)).flatMap(g => idx.slice(groupRange[g][0], groupRange[g][0] + groupRange[g][1]));

  // ---------- reshape: scale / stretch bones → move vertices by their weights → bake into a new skeleton WITHOUT scale ----------
  api.reshape = (mods = {}) => {
    const S = mods.size || {}, L = mods.length || {}, SO = mods.sizeOnly || {}, GI = mods.girth || {}, BE = mods.belly || {};
    // temporary skeleton = original rest + scale / stretch → new world matrix of every bone
    const tmpRoot = new THREE.Group(), tmp = D.bones.map((d, i) => { const o = new THREE.Object3D(); o.position.copy(restLocal[i]).multiplyScalar(L[d.name] ?? 1);
      o.quaternion.fromArray(d.quat); o.scale.setScalar((S[d.name] ?? 1) * (SO[d.name] ?? 1)); return o; });
    // sizeOnly: children are scaled back to their own size, but their joint still moves with the bigger parent
    D.bones.forEach((d, i) => { if (d.parent >= 0 && SO[D.bones[d.parent].name]) tmp[i].scale.multiplyScalar(1 / SO[D.bones[d.parent].name]); });
    D.bones.forEach((d, i) => (d.parent >= 0 ? tmp[d.parent] : tmpRoot).add(tmp[i]));
    tmpRoot.updateMatrixWorld(true);
    const Mx = tmp.map((o, i) => o.matrixWorld.clone().multiply(restW[i].clone().invert()));   // original rest → new
    const v = new THREE.Vector3(), acc = new THREE.Vector3(), t = new THREE.Vector3();
    // girth = push away from the bone segment (bone → its first child) along the radius · belly = only where the skin faces +Z
    const seg = D.bones.map((d, i) => { const a = new THREE.Vector3().setFromMatrixPosition(restW[i]); const ch = D.bones.findIndex(c => c.parent === i);
      const b = ch >= 0 ? new THREE.Vector3().setFromMatrixPosition(restW[ch]) : a.clone().add(a.clone().sub(new THREE.Vector3().setFromMatrixPosition(restW[d.parent >= 0 ? d.parent : i])).multiplyScalar(.5)); return [a, b]; });
    const gb = D.bones.map(d => [GI[d.name] ?? 1, BE[d.name] ?? 1]), anyG = gb.some(([g, b]) => g !== 1 || b !== 1);
    const cp = new THREE.Vector3(), rr = new THREE.Vector3(), ab = new THREE.Vector3(), tmpV = new THREE.Vector3();
    const girthed = anyG ? new Float32Array(N * 3) : restPos;
    if (anyG) for (let i = 0; i < N; i++) { tmpV.fromArray(restPos, i * 3); const o = tmpV.clone();
      for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k], bi = si[i * 4 + k]; if (!w) continue; const [g, be] = gb[bi]; if (g === 1 && be === 1) continue;
        const [A, B] = seg[bi]; ab.subVectors(B, A); const tt = THREE.MathUtils.clamp(rr.subVectors(o, A).dot(ab) / (ab.lengthSq() || 1), 0, 1);
        cp.copy(A).addScaledVector(ab, tt); rr.subVectors(o, cp);
        tmpV.addScaledVector(rr, w * (g - 1)); if (be !== 1 && rr.z > 0) tmpV.z += w * (be - 1) * rr.z; }
      girthed[i * 3] = tmpV.x; girthed[i * 3 + 1] = tmpV.y; girthed[i * 3 + 2] = tmpV.z; }
    for (let i = 0; i < N; i++) { v.fromArray(girthed, i * 3); acc.set(0, 0, 0);
      for (let k = 0; k < 4; k++) { const w = sw[i * 4 + k]; if (w) acc.addScaledVector(t.copy(v).applyMatrix4(Mx[si[i * 4 + k]]), w); }
      pos[i * 3] = acc.x; pos[i * 3 + 1] = acc.y; pos[i * 3 + 2] = acc.z; }
    // keep the feet on the same floor: shift the whole body so the lowest point stays where it was
    let dy = 0; if (mods.keepGround !== false) { let m0 = 1e9, m1 = 1e9; for (let i = 1; i < N * 3; i += 3) { m0 = Math.min(m0, restPos[i]); m1 = Math.min(m1, pos[i]); } dy = m0 - m1;
      for (let i = 1; i < N * 3; i += 3) pos[i] += dy; }
    geo.attributes.position.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere();
    // new skeleton: joints at the new world positions · original rest rotations · scale = 1 (the scale is now in the vertices)
    const wp = tmp.map(o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).add(new THREE.Vector3(0, dy, 0))), wq = restW.map(m => new THREE.Quaternion().setFromRotationMatrix(m));
    curLocal = D.bones.map((d, i) => d.parent < 0 ? wp[i].clone() : wp[i].clone().sub(wp[d.parent]).applyQuaternion(wq[d.parent].clone().invert()));
    bones.forEach((o, i) => { o.position.copy(curLocal[i]); o.quaternion.fromArray(D.bones[i].quat); o.scale.set(1, 1, 1); });
    root.updateMatrixWorld(true); skeleton.calculateInverses(); skeleton.pose();
    api.clips = makeClips();
    return api;
  };

  // ---------- the source's real edges (quads drawn without their diagonal) = the edge flow as the artist built it ----------
  api.quadLines = (color = 0x7fd0ff) => {
    const seen = new Set(), segIdx = [];
    D.faces.forEach((f, fi) => { if (hidden.has(D.groups?.[fi] || 'body')) return;
      for (let k = 0; k < f.length; k++) { const p = f[k], q = f[(k + 1) % f.length], kk = p < q ? p + '_' + q : q + '_' + p; if (!seen.has(kk)) { seen.add(kk); segIdx.push(p, q); } } });
    const first = new Int32Array(D.verts.length / 3).fill(-1); orig.forEach((vi, i) => { if (first[vi] < 0) first[vi] = i; });
    const lg = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) lg.setAttribute(k, geo.getAttribute(k));
    lg.setIndex(segIdx.map(i => first[i]));
    const lm = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55 });
    const lines = new THREE.LineSegments(lg, lm); lines.isSkinnedMesh = true; lines.skeleton = skeleton; lines.bindMatrix = mesh.bindMatrix; lines.bindMatrixInverse = mesh.bindMatrixInverse;
    return { lines, edges: seen.size };
  };

  // ---------- exactness: sample vertices after posing, compared with the positions Blender computed → worst error in mm ----------
  api.verify = (clipName) => {
    const first = new Int32Array(D.verts.length / 3).fill(-1); orig.forEach((vi, i) => { if (first[vi] < 0) first[vi] = i; });
    const mixer = new THREE.AnimationMixer(root), act = mixer.clipAction(api.clips[clipName]); act.play();
    let worst = 0; const v = new THREE.Vector3();
    for (const [t, pts] of Object.entries(D.check?.[clipName] || {})) { mixer.setTime(+t); root.updateMatrixWorld(true); skeleton.update();
      for (const [vi, p] of Object.entries(pts)) { if (first[+vi] < 0) continue;
        v.fromBufferAttribute(geo.attributes.position, first[+vi]); mesh.applyBoneTransform(first[+vi], v); worst = Math.max(worst, v.distanceTo(new THREE.Vector3(...p))); } }
    act.stop(); mixer.uncacheRoot(root); skeleton.pose();
    return D.check?.[clipName] ? worst * 1000 : null;
  };
  return api;
}
