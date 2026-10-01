// ===== Sample: Lever Switch — bones (rigid skin) + animation clips → exports as avatar FBX + one FBX per clip =====
// bone(i) binds every triangle created after it to bone i (100%) · clips = [time (s), angle (rad)] per bone, rotation around the bone axis
// pivot (0,0,0) = bottom center of the base · meters
import * as THREE from 'three';
import { createKit } from '../kit.js';
import { themed } from '../themes.js';

export const info = { id:'sample_lever', name:'Sample · Lever Switch', note:'2 bones · clips idle / pull', exportName:'Sample_Lever', set:'Samples' };
export const ROLE = { base:'steel', plate:'panel', arm:'steel', knob:'trim', lamp:'gem' };

// bones: joint = pivot position (name in JOINTS) · axis = the rotation axis used by the clips
export const JOINTS = { HINGE:[0, .07, 0] };
export const BONES = [
  { name:'root', axis:'y' },
  { name:'arm', parent:'root', joint:'HINGE', axis:'x' },
];
// clips: lower-case names → exported as <Name>@<clip>.fbx · every clip needs at least one track
export const ANIMS = {
  idle: { len:1, loop:true, note:'rest', tracks:{ arm:[[0, -.5], [1, -.5]] } },
  pull: { len:.8, note:'pull down, small bounce, back', tracks:{ arm:[[0, -.5], [.25, .55], [.33, .45], [.4, .5], [.8, -.5]] } },
};

export function build(theme){
  const K = createKit(themed({
    base: { c:'#c9d1dc', metal:.85, smooth:.6 },
    plate:{ c:'#2c4a7a', metal:.4,  smooth:.6 },
    arm:  { c:'#c9d1dc', metal:.85, smooth:.72 },
    knob: { c:'#d9b25a', metal:1,   smooth:.7 },
    lamp: { c:'#5fd0ff', metal:0,   smooth:.95, emit:1 },
  }, ROLE, theme));

  K.bone(0);                                                          // --- root: housing
  K.add(new THREE.BoxGeometry(.16, .05, .12), 'base', K.at(0, .025));
  K.add(new THREE.BoxGeometry(.12, .012, .08), 'plate', K.at(0, .056));
  K.add(new THREE.CylinderGeometry(.012, .012, .02, 8), 'lamp', K.at(.06, .06, .04));

  K.bone(1);                                                          // --- arm: rotates around HINGE (x axis)
  K.soft(45);
  K.add(new THREE.CylinderGeometry(.009, .009, .14, 8), 'arm', K.at(0, .07 + .07, 0));
  K.add(new THREE.SphereGeometry(.022, 8, 6), 'knob', K.at(0, .07 + .145, 0));
  K.soft(0);
  K.add(new THREE.CylinderGeometry(.016, .016, .04, 8), 'base', K.at(0, .07, 0, 0, 0, Math.PI / 2));

  const out = K.build();
  out.joints = JOINTS; out.bones = BONES; out.anims = ANIMS;
  return out;
}
