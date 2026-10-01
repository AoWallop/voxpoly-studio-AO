// ===== Play "channels" (from npm run motion -- channels) on your own model =====
// import { CLIPS } from '../workspace/motion/Hero_channels.js';
// const ch = sampleClip(CLIPS.Walk, t, { loop:true });   // → { turn, travel_z, height, pitch, head_lift, jaw, foot_L_lift, ... }
// then ADD them to your own idle pose:  body.rotation.y = idle.turn + ch.turn;  neck.rotation.x = idle.neck - ch.head_lift; ...
//
// Edit timing without re-animating: cut ranges out and speed ranges up, in ORIGINAL clip seconds.
//   const plan = timePlan(CLIPS.Attack.len, { cut:[[0.9, 2.0]], fast:[[3.0, 4.6, 2]] });
//   sampleClip(CLIPS.Attack, plan.toSource(tPlayed));   plan.len = new length · plan.toPlayed(tSource) = shift sound cues the same way

export function sampleClip(clip, t, { loop = false } = {}){
  const L = clip.len, f = clip.fps;
  let tt = loop ? ((t % L) + L) % L : Math.max(0, Math.min(L, t));
  const x = tt * f, i = Math.floor(x), u = x - i, out = {};
  for(const [k, v] of Object.entries(clip.ch)){ const a = v[Math.min(i, v.length - 1)], b = v[Math.min(i + 1, v.length - 1)]; out[k] = a + (b - a) * u; }
  return out;
}

// cut / fast plan: piecewise-linear map between played time and source time
export function timePlan(len, { cut = [], fast = [] } = {}){
  const segs = [];                                     // [srcFrom, srcTo, speed]
  const marks = new Set([0, len]); for(const [a, b] of cut) { marks.add(a); marks.add(b); } for(const [a, b] of fast) { marks.add(a); marks.add(b); }
  const m = [...marks].filter(x => x >= 0 && x <= len).sort((p, q) => p - q);
  for(let i = 0; i < m.length - 1; i++){
    const a = m[i], b = m[i + 1], mid = (a + b) / 2;
    if(cut.some(([x, y]) => mid > x && mid < y)) continue;
    const fs = fast.find(([x, y]) => mid > x && mid < y);
    segs.push([a, b, fs ? fs[2] : 1]);
  }
  const played = segs.map(([a, b, s]) => (b - a) / s), total = played.reduce((p, q) => p + q, 0);
  return {
    len: total,
    toSource(tp){ let acc = 0; for(let i = 0; i < segs.length; i++){ const [a, b, s] = segs[i]; if(tp <= acc + played[i]) return a + (tp - acc) * s; acc += played[i]; } return len; },
    toPlayed(ts){ let acc = 0; for(let i = 0; i < segs.length; i++){ const [a, b, s] = segs[i]; if(ts >= a && ts <= b) return acc + (ts - a) / s; acc += played[i]; } return null; },   // null = this moment was cut
  };
}
