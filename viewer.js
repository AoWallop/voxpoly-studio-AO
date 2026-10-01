// ===== FBX Viewer — look at animated FBX files from workspace/fbx/: play clips, inspect bones, graph motion, see sound cues =====
// Files: put FBX (and their textures) in workspace/fbx/ · Unity-style sets (Name.fbx + Name@clip.fbx) are grouped into one character.
// Cues: npm run cues -- <rig.json> writes workspace/cues/<Name>.json — markers show up on the graph automatically.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
const DIR = 'workspace/fbx/';
const renderer = new THREE.WebGLRenderer({ canvas:$('c'), antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24222c);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3440, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(2, 4, 3); scene.add(sun);
const grid = new THREE.GridHelper(10, 20, 0x6a6678, 0x3a3747); scene.add(grid);
const cam = new THREE.PerspectiveCamera(35, 1, .01, 500);
let yaw = .6, pitch = .2, radius = 4; const target = new THREE.Vector3(0, 1, 0);

let root = null, skel = null, mixer = null, clips = [], clip = null, action = null, playing = false, speed = 1, bones = [], bone = null, marker = null;
let graphData = null, cues = null, charName = '';

// ---------- files ----------
async function listFiles(){
  const html = await fetch(DIR).then(r => r.ok ? r.text() : '').catch(() => '');
  const files = [...html.matchAll(/href="([^"?]+)"/g)].map(m => decodeURIComponent(m[1])).filter(n => /\.fbx$/i.test(n));
  const groups = {};
  for(const f of files){ const n = f.replace(/\.fbx$/i, '').split('@')[0]; (groups[n] ||= []).push(f); }
  $('files').innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([n, fs]) => `<button data-g="${n}">${n}<small>${fs.length} file${fs.length > 1 ? 's' : ''}</small></button>`).join('')
    : `<div class="note">${t('vw.none')}</div>`;
  document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => openGroup(b.dataset.g, groups[b.dataset.g]));
  const q = new URLSearchParams(location.search), g = q.get('open');            // link straight to a file: viewer.html?open=Name&clip=run&bone=LeftFoot
  if(g && groups[g] && charName !== g){
    await openGroup(g, groups[g]);
    const ci = clips.findIndex(c => c.clip.name === q.get('clip')); if(ci > 0) selectClip(ci);
    if(q.get('bone')) selectBone(q.get('bone'));
  }
}

async function openGroup(name, files){
  document.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-pressed', b.dataset.g === name));
  const L = new FBXLoader(); L.setResourcePath(DIR);
  const avatarFile = files.find(f => !f.includes('@')) || files[0];
  const obj = await L.loadAsync(DIR + encodeURIComponent(avatarFile));
  if(root){ scene.remove(root, skel); }
  root = obj; charName = name; scene.add(root);
  root.traverse(o => { if(o.isMesh){ o.frustumCulled = false; o.castShadow = false; } });
  skel = new THREE.SkeletonHelper(root); skel.visible = $('skel').getAttribute('aria-pressed') === 'true'; scene.add(skel);
  clips = [];
  const addClips = (o, f) => {                                       // one clip per file: name it from Name@clip.fbx (takes are often "Take 001")
    const nm = f.replace(/\.fbx$/i, '').split('@')[1];
    o.animations.forEach(c => { if(nm && o.animations.length === 1) c.name = nm; clips.push({ clip:c, file:f, start:Math.min(...c.tracks.map(k => k.times[0])) }); });
  };
  addClips(obj, avatarFile);
  for(const f of files.filter(f => f !== avatarFile)) addClips(await L.loadAsync(DIR + encodeURIComponent(f)), f);
  setTimeout(() => root?.traverse(o => {                              // texture file missing → show the plain material color instead of black
    if(!o.isMesh) return;
    for(const m of [].concat(o.material)) if(m.map && !m.map.image){ m.map = null; m.needsUpdate = true; }
  }), 1500);
  mixer = new THREE.AnimationMixer(root);
  bones = []; root.traverse(o => { if(o.isBone) bones.push(o); });
  const bb = new THREE.Box3().setFromObject(root), size = bb.getSize(new THREE.Vector3());
  bb.getCenter(target); radius = Math.max(size.x, size.y, size.z) * 1.8 || 3; grid.scale.setScalar(Math.max(.2, size.y / 2));
  cues = await fetch(`workspace/cues/${encodeURIComponent(name)}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  renderClips(); renderBones();
  if(clips.length) selectClip(0);
}

function renderClips(){
  $('clips').innerHTML = clips.length ? clips.map((c, i) => `<button data-c="${i}">${c.clip.name}<small>${c.clip.duration.toFixed(2)} s · ${c.clip.tracks.length} tracks${cues?.clips?.[c.clip.name] ? ' · ' + cues.clips[c.clip.name].cues.length + ' cues' : ''}</small></button>`).join('')
    : `<div class="note">${t('vw.noclips')}</div>`;
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => selectClip(+b.dataset.c));
}
let clipStart = 0;                                                   // first key time · cue times count from here
function selectClip(i){
  clip = clips[i].clip; clipStart = clips[i].start || 0; mixer.stopAllAction(); action = mixer.clipAction(clip); action.play(); action.paused = !playing;
  setLoop(); document.querySelectorAll('[data-c]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.c === i));
  renderCues(); computeGraph();
}
const setLoop = () => { if(action){ const on = $('loop').getAttribute('aria-pressed') === 'true'; action.setLoop(on ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); action.clampWhenFinished = true; } };

// ---------- bones ----------
function renderBones(){
  const f = $('filter').value.toLowerCase();
  $('bones').innerHTML = bones.filter(b => b.name.toLowerCase().includes(f)).map(b => `<div data-b="${b.name}" class="${b === bone ? 'on' : ''}">${b.name}</div>`).join('');
  document.querySelectorAll('[data-b]').forEach(el => el.onclick = () => selectBone(el.dataset.b));
}
$('filter').oninput = renderBones;
function selectBone(name){
  bone = bones.find(b => b.name === name); renderBones();
  if(!marker){ marker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color:0xffd36e, depthTest:false })); marker.renderOrder = 9; scene.add(marker); }
  computeGraph();
}

// ---------- graph: height above the lowest point + speed of the selected bone over the clip ----------
function computeGraph(){
  graphData = null; if(!clip || !bone) { drawGraph(); return; }
  const was = mixer.time, N = Math.max(30, Math.round(clip.duration * 60)), p = new THREE.Vector3(), prev = new THREE.Vector3(), h = [], v = [];
  for(let i = 0; i <= N; i++){
    const tt = clip.duration * i / N; action.time = tt; mixer.update(0); root.updateMatrixWorld(true);
    bone.getWorldPosition(p); h.push(p.y); v.push(i ? p.distanceTo(prev) / (clip.duration / N) : 0); prev.copy(p);
  }
  v[0] = v[1] || 0; action.time = was; mixer.update(0);
  const lo = Math.min(...h);
  graphData = { h:h.map(x => x - lo), v, len:clip.duration };
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y || 1;
  $('boneInfo').innerHTML = `<b>${bone.name}</b><br>${t('vw.lift')} ${(Math.max(...graphData.h)).toFixed(3)} · ${t('vw.peak')} ${(Math.max(...v)).toFixed(2)}/s<br>${t('vw.units')}`;
  marker.scale.setScalar(size * .012);
  drawGraph();
}
function drawGraph(){
  const cv = $('graph'), r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, L = clip?.duration || 1, X = s => 6 + s / L * (W - 12), C = s => X(s + clipStart);
  g.clearRect(0, 0, W, H); g.font = `${11 * devicePixelRatio}px Chakra Petch, sans-serif`;
  for(let s = 0; s <= L; s += L > 6 ? 1 : .5){ g.strokeStyle = '#ffffff12'; g.beginPath(); g.moveTo(X(s), 0); g.lineTo(X(s), H); g.stroke(); g.fillStyle = '#7d778a'; g.fillText(s.toFixed(1) + 's', X(s) + 3, H - 4); }
  const c = cues?.clips?.[clip?.name];
  if(c) for(const cue of c.cues){
    const col = { step:'#9fe0a8', swing:'#7fd0ff', roar:'#ff8a5c', snap:'#ff8a5c', tail:'#b58cff', head:'#ffffff', drop:'#f0c874' }[cue.kind] || '#ccc';
    if(cue.end != null){ g.fillStyle = col + '22'; g.fillRect(C(cue.t), 0, C(cue.end) - C(cue.t), H); }
    g.strokeStyle = col; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(C(cue.t), 0); g.lineTo(C(cue.t), H); g.stroke(); g.setLineDash([]);
    g.fillStyle = col; g.fillText(cue.sfx, C(cue.t) + 3, 12 * devicePixelRatio);
  }
  if(graphData){
    for(const [arr, col] of [[graphData.h, '#f0c874'], [graphData.v, '#7fd0ff']]){
      const mx = Math.max(...arr) || 1; g.strokeStyle = col; g.lineWidth = 1.6 * devicePixelRatio; g.beginPath();
      arr.forEach((y, i) => { const x = X(i / (arr.length - 1) * L), yy = H - 18 * devicePixelRatio - y / mx * (H - 30 * devicePixelRatio); i ? g.lineTo(x, yy) : g.moveTo(x, yy); }); g.stroke();
    }
    g.fillStyle = '#f0c874'; g.fillText('■ ' + t('vw.height'), W - 210 * devicePixelRatio, 12 * devicePixelRatio); g.fillStyle = '#7fd0ff'; g.fillText('■ ' + t('vw.speed'), W - 110 * devicePixelRatio, 12 * devicePixelRatio);
  } else { g.fillStyle = '#7d778a'; g.fillText(t('vw.pickbone'), 10, H / 2); }
  if(action){ g.strokeStyle = '#ff3fd0'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(action.time), 0); g.lineTo(X(action.time), H); g.stroke(); }
}
function renderCues(){
  const c = cues?.clips?.[clip?.name];
  $('cueList').innerHTML = c ? (c.cues.length ? c.cues.map(q => `<div><b>${q.t.toFixed(2)}${q.end != null ? '–' + q.end.toFixed(2) : ''}</b>${q.sfx} <span>· ${q.note}</span></div>`).join('') : t('vw.nocues'))
    : `<span>${t('vw.cuehint')}</span>`;
}

// ---------- transport ----------
const audio = new (window.AudioContext || window.webkitAudioContext)();
function tick(kind){                                               // timing preview only — not a sound asset
  const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = { step:220, swing:660, roar:140, snap:440, tail:520, head:880, drop:110 }[kind] || 400;
  g.gain.setValueAtTime(.18, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .08); o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + .09);
}
$('play').onclick = () => { if(!action) return; audio.resume(); playing = !playing; action.paused = !playing; if(playing && action.time >= clip.duration - 1e-3) action.time = 0; $('play').textContent = playing ? '❚❚' : '▶'; };
$('slow').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); speed = on ? .25 : 1; };
$('loop').onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on); setLoop(); };
$('tick').onclick = e => { audio.resume(); e.currentTarget.setAttribute('aria-pressed', e.currentTarget.getAttribute('aria-pressed') !== 'true'); };
$('scrub').oninput = e => { if(!action) return; action.time = e.target.value / 1000 * clip.duration; mixer.update(0); };
for(const id of ['skel', 'mesh', 'ground']) $(id).onclick = e => { const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; e.currentTarget.setAttribute('aria-pressed', on);
  if(id === 'skel' && skel) skel.visible = on; if(id === 'ground') grid.visible = on; if(id === 'mesh' && root) root.traverse(o => { if(o.isMesh) o.visible = on; }); };

// ---------- camera ----------
let drag = null; const cv = $('c');
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { drag = { x:e.clientX, y:e.clientY, pan:e.button !== 0 }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if(!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if(drag.pan){ const r = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1); target.addScaledVector(r, -dx * radius * .0015).addScaledVector(u, dy * radius * .0015); }
  else { yaw -= dx * .006; pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * .006)); } });
cv.addEventListener('pointerup', () => drag = null);
cv.addEventListener('wheel', e => { e.preventDefault(); radius *= 1 + e.deltaY * .001; }, { passive:false });
function resize(){ const r = $('stage').getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); drawGraph(); }
addEventListener('resize', resize); resize();
addEventListener('keydown', e => { if(e.target.tagName === 'INPUT') return; if(e.code === 'Space'){ e.preventDefault(); $('play').click(); } });
addEventListener('langchange', () => { renderClips(); renderCues(); drawGraph(); listFiles(); });

let prev = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - prev) / 1000); prev = now;
  if(mixer && action){
    const t0 = action.time; if(playing) mixer.update(dt * speed); const t1 = action.time;
    const c = cues?.clips?.[clip.name];
    if(playing && c && $('tick').getAttribute('aria-pressed') === 'true') for(const q of c.cues){ const qt = q.t + clipStart; if((t1 >= t0 && qt > t0 && qt <= t1) || (t1 < t0 && (qt > t0 || qt <= t1))) tick(q.kind); }
    $('scrub').value = Math.round(action.time / clip.duration * 1000); $('time').textContent = `${action.time.toFixed(2)} / ${clip.duration.toFixed(2)} s`;
    if(playing) drawGraph();
  }
  if(bone && marker){ bone.getWorldPosition(marker.position); }
  cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * radius, target.y + Math.sin(pitch) * radius, target.z + Math.cos(yaw) * Math.cos(pitch) * radius); cam.lookAt(target);
  $('hud').innerHTML = root ? `<b>${charName}</b> · ${bones.length} ${t('bones')} · ${clips.length} ${t('vw.clipsN')}` : t('vw.none');
  renderer.render(scene, cam); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
listFiles();
