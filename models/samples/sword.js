// ===== Sample: Basic Sword — loft (blade), boxes (guard), cylinder (grip), soft edges, emissive gem =====
// pivot (0,0,0) = middle of the grip · blade points +Y · meters
import * as THREE from 'three';
import { createKit, SECTION } from '../kit.js';
import { themed } from '../themes.js';

export const info = { id:'sample_sword', name:'Sample · Basic Sword', note:'loft · soft edges · emissive gem', exportName:'Sample_Sword', set:'Samples' };
// color slot → theme role
export const ROLE = { blade:'steel', edge:'edge', guard:'trim', guardDk:'trimDk', grip:'grip', gem:'gem' };

export function build(theme){
  const K = createKit(themed({
    blade:  { c:'#c9d1dc', metal:.85, smooth:.72 },
    edge:   { c:'#f4f7fb', metal:.7,  smooth:.86 },
    guard:  { c:'#d9b25a', metal:1,   smooth:.7 },
    guardDk:{ c:'#a9823a', metal:1,   smooth:.55 },
    grip:   { c:'#3b2a20', metal:0,   smooth:.3 },
    gem:    { c:'#5fd0ff', metal:0,   smooth:.95, emit:.9 },
  }, ROLE, theme));

  // blade: diamond cross-section that tapers to a point · the last ring collapses to one point = tip
  const blade = [
    { y:.085, w:.026, t:.006 }, { y:.30, w:.024, t:.0055 }, { y:.62, w:.021, t:.005 }, { y:.74, w:.012, t:.004 }, { y:.80, w:0, t:0 },
  ];
  K.soft(30);                                                          // gentle shading along the blade, the ridge stays sharp (90°+)
  K.loft(blade.map(r => ({ y:r.y, pts:r.w ? SECTION.diamond(r.w, r.t) : SECTION.point(4) })), 'blade');
  K.soft(0);

  // cross guard: a slightly bent bar made of 3 boxes + darker end caps
  K.add(new THREE.BoxGeometry(.11, .022, .026), 'guard', K.at(0, .072));
  for(const s of [-1, 1]){
    K.add(new THREE.BoxGeometry(.04, .02, .024), 'guard', K.at(s * .07, .078, 0, 0, 0, s * .25));
    K.add(new THREE.OctahedronGeometry(.016, 0), 'guardDk', K.at(s * .093, .086, 0));
  }

  // grip: 8-sided cylinder with soft edges · pommel + gem
  K.soft(50);
  K.add(new THREE.CylinderGeometry(.013, .015, .13, 8, 1, true), 'grip', K.at(0, 0));
  K.soft(0);
  K.add(new THREE.CylinderGeometry(.02, .016, .02, 8), 'guardDk', K.at(0, -.072));
  K.add(new THREE.OctahedronGeometry(.017, 0), 'gem', K.at(0, -.09, 0, 0, Math.PI / 4));
  return K.build();
}
