// ===== Play sound cues in time with an animation (Web Audio) =====
// const player = new CuePlayer();
// await player.load({ step:['sounds/step1.wav', 'sounds/step2.wav'], whoosh:['sounds/whoosh.wav'],
//                     roar:{ start:'sounds/roar_in.wav', loop:'sounds/roar_loop.wav', end:'sounds/roar_out.wav' } });
// player.setCues(cueJson);                         // from npm run cues
// every frame:  player.update('Attack', prevTime, time, { plan });   // plan = timePlan(...) from models/motion.js when the clip is cut / sped up
// - a name with several files plays one at random (repeated identical samples sound mechanical)
// - a cue with an end time + a {start, loop, end} sound = sustained: start, loop while it lasts, release at the end
// - cue times stay in ORIGINAL clip seconds; plan.toPlayed() moves them with the cut / speed-up (cut moments are skipped)
// Browsers only allow audio after a user gesture: call player.unlock() from a click handler once.

export class CuePlayer {
  constructor(ctx){ this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); this.buf = {}; this.cues = {}; this.loops = []; this.volume = 1; }
  unlock(){ if(this.ctx.state === 'suspended') this.ctx.resume(); }
  async load(map){
    const get = async url => this.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    for(const [name, v] of Object.entries(map)){
      if(Array.isArray(v) || typeof v === 'string') this.buf[name] = { one:await Promise.all([].concat(v).map(get)) };
      else this.buf[name] = { start:v.start && await get(v.start), loop:v.loop && await get(v.loop), end:v.end && await get(v.end) };
    }
  }
  setCues(json){ this.cues = json.clips || json; }
  play(b, when = 0, loop = false){
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); g.gain.value = this.volume;
    s.buffer = b; s.loop = loop; s.connect(g).connect(this.ctx.destination); s.start(this.ctx.currentTime + when); return s;
  }
  fire(cue, playedLen){
    const b = this.buf[cue.sfx]; if(!b) return;
    if(b.one) return this.play(b.one[Math.floor(Math.random() * b.one.length)]);
    if(b.start) this.play(b.start);
    if(b.loop && playedLen > 0){
      const off = b.start ? b.start.duration * .85 : 0, s = this.play(b.loop, off, true);
      s.stop(this.ctx.currentTime + Math.max(off, playedLen)); this.loops.push(s);
      if(b.end) this.play(b.end, Math.max(off, playedLen));
    }
  }
  // call every frame with the previous and current PLAYED time of the clip
  update(clip, t0, t1, { plan = null } = {}){
    const c = this.cues[clip]; if(!c || t1 < t0) return;          // t1 < t0 = clip looped / restarted: call again with (0, t1)
    for(const cue of c.cues){
      const t = plan ? plan.toPlayed(cue.t) : cue.t; if(t === null) continue;
      if(t > t0 && t <= t1){
        const end = cue.end != null ? (plan ? plan.toPlayed(cue.end) ?? t : cue.end) : null;
        this.fire(cue, end != null ? end - t : 0);
      }
    }
  }
  stopAll(){ this.loops.forEach(s => { try{ s.stop(); }catch(e){} }); this.loops = []; }
}
