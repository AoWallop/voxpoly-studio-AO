// ===== Model Kit — build game-ready low-poly models in code =====
// Everything becomes ONE mesh · ONE material · colors come from a small palette texture
// (every triangle points its UV at the center of its color cell → crisp colors, no seams, recolor by swapping the image).
// Units = meters · origin (0,0,0) = the pivot you want in the engine (e.g. the grip of a weapon) · up = +Y · front = +Z
import * as THREE from 'three';

const CELLS = 8, TEX = 256, CELL = TEX / CELLS;          // palette: 8×8 cells on a 256 px image (max 64 colors)

// palette: { slot: { c:'#rrggbb', metal:0-1, smooth:0-1, emit:0-1 } }
// opts.weighted = angle-weighted vertex normals for soft edges (avoids diagonal shading stripes on big uneven curves)
export function createKit(palette, opts = {}){
  const slots = Object.keys(palette);
  if(slots.length > CELLS * CELLS) throw new Error('palette has more than 64 slots');
  const cellOf = s => { const i = slots.indexOf(s); if(i < 0) throw new Error('unknown color slot: ' + s); return i; };
  const uvOf = s => { const i = cellOf(s); return [((i % CELLS) + .5) / CELLS, 1 - (Math.floor(i / CELLS) + .5) / CELLS]; };

  const P = [], N = [], UV = [], tag = [];                // tag = color slot per triangle (for counting / checks)
  const triPart = [], triSoft = [];                        // part id per triangle · soft-edge angle (0 = hard)
  const triCN = [];                                        // optional custom normals per corner (from npm run retopo) · null = use soft/hard
  let part = 0, softDeg = 0;
  // soft edges: triangles created after soft(angle) get smoothed across edges bent less than that angle (like Maya "Soften Edge")
  const soft = deg => { softDeg = deg; };
  const newPart = () => { part++; };                       // normals never smooth across parts
  // bones (rigid skin): triangles created after bone(i) are 100% bound to bone i · default 0 = root · never called = no skin
  let boneIdx = 0, usesBones = false; const triBone = [];
  const bone = i => { boneIdx = i; usesBones = true; part++; };
  const _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _n = new THREE.Vector3();

  // one triangle (a, b, c counter-clockwise seen from outside) · degenerate (zero-area) triangles are skipped
  function tri(a, b, c, slot, cn = null){
    _ab.subVectors(b, a); _ac.subVectors(c, a); _n.crossVectors(_ab, _ac);
    const len = _n.length(); if(len < 1e-10) return false;
    _n.divideScalar(len);
    const [u, v] = uvOf(slot);
    for(const p of [a, b, c]){ P.push(p.x, p.y, p.z); N.push(_n.x, _n.y, _n.z); UV.push(u, v); }
    tag.push(slot); triPart.push(part); triSoft.push(softDeg); triBone.push(boneIdx); triCN.push(cn); return true;
  }

  // add any three.js geometry (Box / Cylinder / Lathe / Extrude ...) · matrix = position / rotation / scale
  function add(geo, slot, matrix){
    part++;
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute('position'), m = matrix || new THREE.Matrix4();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for(let i = 0; i < pos.count; i += 3){
      a.fromBufferAttribute(pos, i).applyMatrix4(m); b.fromBufferAttribute(pos, i + 1).applyMatrix4(m); c.fromBufferAttribute(pos, i + 2).applyMatrix4(m);
      if(m.determinant() < 0) tri(a, c, b, slot); else tri(a, b, c, slot);
    }
  }

  // loft along Y: rings = [{ y, pts:[[x,z], ...] }] — same point count on every ring · a ring of identical points = a sharp tip
  // opt.cap0 / opt.cap1 = close the first / last ring · faces are turned outward automatically (from each ring's center)
  function loft(rings, slot, matrix, opt = {}){
    part++;
    const m = matrix || new THREE.Matrix4(), flip = m.determinant() < 0;
    const V = rings.map(r => r.pts.map(([x, z]) => new THREE.Vector3(x, r.y, z)));
    const C = rings.map(r => { let x = 0, z = 0; r.pts.forEach(p => { x += p[0]; z += p[1]; }); return new THREE.Vector3(x / r.pts.length, r.y, z / r.pts.length); });
    const out = (a, b, c, center) => {
      _ab.subVectors(b, a); _ac.subVectors(c, a); _n.crossVectors(_ab, _ac);
      const o = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3).sub(center);
      return _n.dot(o) >= 0 ? [a, b, c] : [a, c, b];
    };
    const emit = (a, b, c, center) => { let t = out(a, b, c, center); t = t.map(p => p.clone().applyMatrix4(m)); if(flip) t = [t[0], t[2], t[1]]; tri(t[0], t[1], t[2], slot); };
    for(let i = 0; i < V.length - 1; i++){
      const r0 = V[i], r1 = V[i + 1], n = r0.length;
      for(let j = 0; j < n; j++){
        const k = (j + 1) % n, a = r0[j], b = r0[k], c = r1[k], d = r1[j];
        const mid = new THREE.Vector3().addVectors(C[i], C[i + 1]).multiplyScalar(.5);
        const ca = mid.clone(); ca.y = (a.y + b.y + c.y) / 3; emit(a, b, c, ca);
        const cb = mid.clone(); cb.y = (a.y + c.y + d.y) / 3; emit(a, c, d, cb);
      }
    }
    const cap = (ring, center, dir) => {                  // fan cap facing dir (±Y)
      const away = center.clone().addScaledVector(new THREE.Vector3(0, dir, 0), -1);
      for(let j = 1; j < ring.length - 1; j++) emit(ring[0], ring[j], ring[j + 1], away);
    };
    if(opt.cap0) cap(V[0], C[0], -1);
    if(opt.cap1) cap(V[V.length - 1], C[C.length - 1], 1);
  }

  // a triangle turned toward `hint` (Vector3) automatically — for hand-built surfaces
  function face(a, b, c, slot, hint){
    _ab.subVectors(b, a); _ac.subVectors(c, a); _n.crossVectors(_ab, _ac);
    return _n.dot(hint) >= 0 ? tri(a, b, c, slot) : tri(a, c, b, slot);
  }

  // thick plate from a 2D outline (x, y) · one bevel step · front faces +Z · depth = thickness
  function plate(pts, depth, slot, matrix, bevel = 0){
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth, curveSegments:1, bevelEnabled:bevel > 0, bevelThickness:bevel, bevelSize:bevel, bevelSegments:1 });
    add(g, slot, matrix);
  }

  // ---------- matrix helpers ----------
  const at = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const mirrorX = m => new THREE.Matrix4().makeScale(-1, 1, 1).multiply(m || new THREE.Matrix4());

  // ---------- normals ----------
  const _p = i => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  function cornerAngle(t, k){                              // interior angle of triangle t at the corner whose key = k
    for(let v = 0; v < 3; v++){ const a = _p(t * 3 + v);
      if(triPart[t] + '|' + [a.x, a.y, a.z].map(x => Math.round(x * 1e5)).join(',') !== k) continue;
      const b = _p(t * 3 + (v + 1) % 3).sub(a), c = _p(t * 3 + (v + 2) % 3).sub(a); return b.angleTo(c); }
    return 1;
  }
  // smooth the normals of corners that share a position inside the same part, if their faces bend less than the soft angle
  function smoothNormals(){
    const key = (t, v) => triPart[t] + '|' + P.slice((t * 3 + v) * 3, (t * 3 + v) * 3 + 3).map(x => Math.round(x * 1e5)).join(',');
    const map = new Map();
    for(let t = 0; t < tag.length; t++) if(triSoft[t] > 0) for(let v = 0; v < 3; v++){ const k = key(t, v); if(!map.has(k)) map.set(k, []); map.get(k).push(t); }
    const face = []; for(let t = 0; t < tag.length; t++) face.push(new THREE.Vector3(N[t * 9], N[t * 9 + 1], N[t * 9 + 2]));
    const out = N.slice();
    for(let t = 0; t < tag.length; t++){
      if(triCN[t]){ for(let v = 0; v < 3; v++){ const n = triCN[t][v], o = (t * 3 + v) * 3; out[o] = n[0]; out[o + 1] = n[1]; out[o + 2] = n[2]; } continue; }
      if(!(triSoft[t] > 0)) continue;
      const lim = Math.cos(THREE.MathUtils.degToRad(triSoft[t]));
      for(let v = 0; v < 3; v++){
        const acc = new THREE.Vector3();
        for(const t2 of map.get(key(t, v))) if(face[t].dot(face[t2]) >= lim) acc.addScaledVector(face[t2], opts.weighted ? cornerAngle(t2, key(t, v)) : 1);
        acc.normalize(); const o = (t * 3 + v) * 3; out[o] = acc.x; out[o + 1] = acc.y; out[o + 2] = acc.z;
      }
    }
    return out;
  }

  // ---------- build the mesh + textures ----------
  function build(){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const normalsSoft = smoothNormals(), normalsFlat = N.slice();
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalsSoft.slice(), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    if(usesBones){                                         // skinIndex / skinWeight per vertex (rigid)
      const si = new Uint16Array(tag.length * 12), sw = new Float32Array(tag.length * 12);
      triBone.forEach((b, t) => { for(let v = 0; v < 3; v++){ si[(t * 3 + v) * 4] = b; sw[(t * 3 + v) * 4] = 1; } });
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    }
    geo.computeBoundingBox();
    const tex = makeTextures();
    const mat = new THREE.MeshStandardMaterial({ map:tex.albedo, roughnessMap:tex.orm, metalnessMap:tex.orm, roughness:1, metalness:1,
      emissiveMap:tex.emission, emissive:0xffffff, emissiveIntensity:1.4 });
    const perSlot = {}; tag.forEach(s => perSlot[s] = (perSlot[s] || 0) + 1);
    return { geometry:geo, material:mat, textures:tex, tris:tag.length, perSlot, palette, tags:tag.slice(), slots, cells:CELLS, texSize:TEX, normalsSoft, normalsFlat, parts:triPart.slice() };
  }

  function canvas(fill){
    const cv = document.createElement('canvas'); cv.width = cv.height = TEX;
    const g = cv.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, TEX, TEX); return [cv, g];
  }
  function makeTextures(){
    const [alb, ga] = canvas('#808080');                 // base color
    const [orm, go] = canvas('rgb(255,200,0)');          // three.js: G = roughness · B = metalness
    const [emi, ge] = canvas('#000000');                 // emission
    const [uni, gu] = canvas('rgba(0,0,0,0)');           // Unity URP: R = metallic · A = smoothness (export only)
    slots.forEach((s, i) => {
      const p = palette[s], x = (i % CELLS) * CELL, y = Math.floor(i / CELLS) * CELL;
      const metal = p.metal ?? 0, smooth = p.smooth ?? .3, emit = p.emit ?? 0;
      ga.fillStyle = p.c; ga.fillRect(x, y, CELL, CELL);
      go.fillStyle = `rgb(255,${Math.round((1 - smooth) * 255)},${Math.round(metal * 255)})`; go.fillRect(x, y, CELL, CELL);
      const col = new THREE.Color(p.c);
      ge.fillStyle = `rgb(${Math.round(col.r * 255 * emit)},${Math.round(col.g * 255 * emit)},${Math.round(col.b * 255 * emit)})`; ge.fillRect(x, y, CELL, CELL);
      gu.clearRect(x, y, CELL, CELL); gu.fillStyle = `rgba(${Math.round(metal * 255)},0,0,${smooth})`; gu.fillRect(x, y, CELL, CELL);
    });
    const T = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; if(srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return { albedo:T(alb, true), orm:T(orm), emission:T(emi, true), canvases:{ albedo:alb, orm, emission:emi, unityMetal:uni } };
  }

  const triCount = () => tag.length;                        // count while building (see which part eats the budget)
  return { tri, face, add, loft, plate, soft, newPart, bone, triCount, build, at, mirrorX, slots, palette };
}

// ready-made cross sections (points around the axis) — w = half width (X) · t = half thickness (Z)
export const SECTION = {
  diamond: (w, t) => [[-w, 0], [0, -t], [w, 0], [0, t]],                              // blade with a center ridge
  hex:     (w, t) => [[-w, 0], [-w * .5, -t], [w * .5, -t], [w, 0], [w * .5, t], [-w * .5, t]], // thick blade with a flat ridge
  box:     (w, t) => [[-w, -t], [w, -t], [w, t], [-w, t]],
  ngon:    (r, n = 6, rot = 0) => Array.from({ length:n }, (_, i) => { const a = rot + i / n * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; }),
  point:   (n = 4) => Array.from({ length:n }, () => [0, 0]),
};

// build a model from triangle data produced by `npm run retopo` ([a, b, c, slot, normals?] per triangle)
export function fromTris(TRIS, palette, opts){
  const K = createKit(palette, opts), v = p => new THREE.Vector3(p[0], p[1], p[2]);
  for(const [a, b, c, s, cn] of TRIS) K.tri(v(a), v(b), v(c), s, cn || null);
  return K.build();
}
