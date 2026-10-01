// ===== Thick plates from a grid of points (shell + inner surface + closed rims) =====
// G[r][c] = outer surface point (Vector3, or null = no surface) · keep(r,c) = is there a face (r,c)→(r+1,c+1) · slotAt(r,c) = color slot · wrap = last column joins the first
// inner surface = pushed back along the vertex normal by T · every open edge is closed by a thick rim wall · normals face outward (vote against the center, or outRef)
import * as THREE from 'three';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function makeSlab(K, G, T, { wrap = false, keep = () => true, slotAt = () => 'steel', rimSlot = 'goldDk', rimAt = null, innerSlot = 'inner', outRef = null } = {}){
  const R = G.length, C = G[0].length, CC = wrap ? C : C - 1;
  const has = (r, c) => { if(r < 0 || r >= R - 1) return false; if(wrap) c = (c + C) % C; else if(c < 0 || c >= C - 1) return false;
    const c1 = wrap ? (c + 1) % C : c + 1; if(!G[r][c] || !G[r][c1] || !G[r + 1][c] || !G[r + 1][c1]) return false; return keep(r, c); };
  const P = (r, c) => G[r][wrap ? (c + C) % C : c];
  // vertex normal = average of the faces that actually exist around it
  const nrm = G.map(row => row.map(() => new THREE.Vector3()));
  for(let r = 0; r < R - 1; r++) for(let c = 0; c < CC; c++){ if(!has(r, c)) continue;
    const a = P(r, c), b = P(r, c + 1), d = P(r + 1, c), n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
    for(const [rr, cc] of [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]) nrm[rr][wrap ? (cc + C) % C : cc].add(n); }
  // always outward: a grid whose rows run the other way (top→bottom) would point inward → vote against the center and flip the whole plate
  { const cen = new THREE.Vector3(); let k = 0; G.forEach(row => row.forEach(p => { if(p){ cen.add(p); k++; } })); cen.multiplyScalar(1 / k);
    if(outRef) cen.copy(outRef);
    let vote = 0; G.forEach((row, r) => row.forEach((p, c) => { if(p) vote += Math.sign(nrm[r][c].dot(p.clone().sub(cen))); }));
    if(vote < 0) nrm.forEach(row => row.forEach(n => n.negate())); }
  nrm.forEach(row => row.forEach(n => n.normalize()));
  const N = (r, c) => nrm[r][wrap ? (c + C) % C : c];
  const IN = (r, c) => P(r, c).clone().addScaledVector(N(r, c), -T);
  const quad = (a, b, c, d, slot, hint) => { K.face(a, b, c, slot, hint); K.face(a, c, d, slot, hint); };
  K.newPart();
  for(let r = 0; r < R - 1; r++) for(let c = 0; c < CC; c++){ if(!has(r, c)) continue;
    const h = N(r, c).clone().add(N(r + 1, c + 1));
    quad(P(r, c), P(r, c + 1), P(r + 1, c + 1), P(r + 1, c), slotAt(r, c), h);
    quad(IN(r, c), IN(r, c + 1), IN(r + 1, c + 1), IN(r + 1, c), innerSlot, h.clone().negate()); }
  // rim walls: row edges (between columns) and column edges (between rows) with a face on one side only
  K.newPart();
  const wall = (r0, c0, r1, c1, away, slot) => { const a = P(r0, c0), b = P(r1, c1);
    quad(a, b, IN(r1, c1), IN(r0, c0), slot, away); };
  for(let r = 0; r < R; r++) for(let c = 0; c < CC; c++){            // edges along row r (between c, c+1)
    const up = has(r, c), dn = has(r - 1, c); if(up === dn) continue;
    const mid = P(r, c).clone().add(P(r, c + 1)).multiplyScalar(.5), o = up ? P(r + 1, c) : P(r - 1, c);
    wall(r, c, r, c + 1, mid.clone().sub(o), rimAt ? rimAt(r, c, 'row') : rimSlot); }
  for(let r = 0; r < R - 1; r++) for(let c = 0; c < (wrap ? C : C); c++){   // edges along column c (between r, r+1)
    const L = has(r, c - 1), Rt = has(r, c); if(L === Rt) continue;
    const mid = P(r, c).clone().add(P(r + 1, c)).multiplyScalar(.5), o = Rt ? P(r, c + 1) : P(r, c - 1);
    wall(r, c, r + 1, c, mid.clone().sub(o), rimAt ? rimAt(r, c, 'col') : rimSlot); }
  K.newPart();
  return { P, N };
}
