// ===== Sample: Round Shield — slab() turns a grid of points into a thick plate with closed rims =====
// The grid rows follow the trim line (rows = rings), so the color edge IS a mesh edge — no wasted loops.
// pivot (0,0,0) = the handle behind the shield · face points +Z · meters
import * as THREE from 'three';
import { createKit } from '../kit.js';
import { makeSlab } from '../slab.js';
import { themed } from '../themes.js';

export const info = { id:'sample_shield', name:'Sample · Round Shield', note:'slab() · rows follow the trim', exportName:'Sample_Shield', set:'Samples' };
export const ROLE = { field:'panel', rim:'trim', rimDk:'trimDk', boss:'steel', back:'inner', grip:'grip' };

export function build(theme){
  const K = createKit(themed({
    field:{ c:'#2c4a7a', metal:.4, smooth:.6 },
    rim:  { c:'#d9b25a', metal:1,  smooth:.7 },
    rimDk:{ c:'#a9823a', metal:1,  smooth:.55 },
    boss: { c:'#c9d1dc', metal:.85, smooth:.72 },
    back: { c:'#3a3f4c', metal:.6, smooth:.35 },
    grip: { c:'#3b2a20', metal:0,  smooth:.3 },
  }, ROLE, theme));

  // dome: radius → height profile · the two outer rows are the rim band
  const N = 20, R = .28, ring = [.07, .14, .20, .245, .255, .28];
  const z = r => .05 * (1 - (r / R) ** 2) + .045;                     // gentle dome, front at +Z
  const G = ring.map(r => Array.from({ length:N }, (_, i) => { const t = i / N * Math.PI * 2; return new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, z(r)); }));
  K.soft(25);
  makeSlab(K, G, .012, { wrap:true, slotAt:r => r >= 3 ? 'rim' : 'field', rimSlot:'rimDk', innerSlot:'back' });
  K.soft(0);

  // center boss: low cone (closes the hole in the middle) · a grip bar behind
  K.soft(40);
  K.add(new THREE.CylinderGeometry(.0, .075, .045, N, 1), 'boss', K.at(0, 0, z(.07) + .012, Math.PI / 2));
  K.soft(0);
  K.add(new THREE.BoxGeometry(.12, .026, .02), 'grip', K.at(0, 0, .01));
  return K.build();
}
