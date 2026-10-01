// ===== Model Studio — shape a low-poly model until it looks right, then export (GLB → Blender → FBX) =====
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MODELS, USER } from './models/index.js';
import { THEMES } from './models/themes.js';
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
const BUDGET = 2000;                                        // triangle budget shown in the HUD (a guide, not a hard limit)
const store = { get:k => { try{ return localStorage.getItem('vp-studio-' + k); }catch(e){ return null; } }, set:(k, v) => { try{ localStorage.setItem('vp-studio-' + k, v); }catch(e){} } };

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a2833);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;   // reflections for metals
scene.add(new THREE.HemisphereLight(0xe8eeff, 0x3a3440, .9));
const key = new THREE.DirectionalLight(0xfff2e0, 1.6); key.position.set(-1.5, 2.5, 2); scene.add(key);
const rim = new THREE.DirectionalLight(0xbfe0ff, 1.1); rim.position.set(2, 1, -2); scene.add(rim);

// ---------- size helpers ----------
const ruler = new THREE.Group(); scene.add(ruler);
const back = new THREE.GridHelper(2, 20, 0x8a8698, 0x4a4757); back.rotation.x = Math.PI / 2; back.position.z = -.35; ruler.add(back);   // back wall, 10 cm squares
const floor = new THREE.GridHelper(2, 20, 0x8a8698, 0x4a4757); floor.position.y = -.4; ruler.add(floor);
const pivot = new THREE.AxesHelper(.08); pivot.material.depthTest = false; pivot.renderOrder = 9; scene.add(pivot);
// ghost hand for scale (adult fist ~9 cm)
const hand = new THREE.Group(); scene.add(hand);
const ghost = new THREE.MeshBasicMaterial({ color:0xffd9b8, transparent:true, opacity:.18, depthWrite:false });
const fist = new THREE.Mesh(new THREE.BoxGeometry(.05, .09, .085), ghost); fist.position.set(.012, 0, .01); hand.add(fist);
const thumb = new THREE.Mesh(new THREE.BoxGeometry(.022, .05, .022), ghost); thumb.position.set(-.02, .04, .045); thumb.rotation.z = .5; hand.add(thumb);
hand.add(new THREE.LineSegments(new THREE.EdgesGeometry(fist.geometry), new THREE.LineBasicMaterial({ color:0xffd9b8, transparent:true, opacity:.5 })).translateX(.012).translateZ(.01));

// ---------- load a model ----------
let cur = null, mesh = null, wire = null, info = null;
let theme = store.get('theme') || Object.keys(THEMES)[0];
function themesOf(M){ return M.THEMES || THEMES; }          // a model may export its own THEMES
function load(id, keepView = false){
  const M = MODELS.find(m => m.info.id === id) || MODELS[0];
  const TH = themesOf(M); if(!TH[theme]) theme = Object.keys(TH)[0]; renderThemes(TH);
  if(mesh){ scene.remove(mesh, wire); mesh.geometry.dispose(); wire.geometry.dispose(); }
  const t0 = performance.now();
  cur = M; info = M.build(theme);
  mesh = info.bones ? makeSkinned(info) : new THREE.Mesh(info.geometry, info.material); scene.add(mesh);
  setupAnims();
  wire = new THREE.LineSegments(new THREE.WireframeGeometry(info.geometry), new THREE.LineBasicMaterial({ color:0x9ff0ff, transparent:true, opacity:.55 }));
  wire.visible = $('wire').getAttribute('aria-pressed') === 'true'; scene.add(wire);
  store.set('id', M.info.id);
  pressed('[data-m]', b => b.dataset.m === M.info.id);
  const bb = info.geometry.boundingBox, sz = bb.getSize(new THREE.Vector3()), over = info.tris > BUDGET;
  $('stats').innerHTML = `${t('st.tris')} <b style="${over ? 'color:var(--warn)' : ''}">${info.tris.toLocaleString()}</b> / ${BUDGET.toLocaleString()}${over ? ' · ' + t('st.over') : ''}<br>
    ${t('st.size')} <b>${cm(sz.x)} × ${cm(sz.y)} × ${cm(sz.z)}</b> ${t('st.sizeAxes')}<br>
    ${t('st.mat')} <b>1</b> · ${t('st.slots')} <b>${Object.keys(info.perSlot).length}</b> · ${t('st.build')} ${(performance.now() - t0).toFixed(0)} ms`;
  $('swatches').innerHTML = Object.entries(info.perSlot).map(([s, n]) => { const p = info.palette[s] || {};
    return `<div class="sw"><i style="background:${p.c};${p.emit ? 'box-shadow:0 0 8px ' + p.c : ''}"></i><b>${s}</b>${n} tri${p.metal ? ' · ' + t('sw.metal') : ''}${p.emit ? ' · ' + t('sw.emit') : ''}</div>`; }).join('');
  if(!keepView) frameTarget(bb);
  drawTex(); listSlots(); highlight(null); applySoft();
}
const cm = v => (v * 100).toFixed(1);

// ---------- camera: orbit + preset views + ortho ----------
const persp = new THREE.PerspectiveCamera(35, 1, .01, 50);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 50);
let useOrtho = false, yaw = .7, pitch = .25, radius = 2, spin = false;
const target = new THREE.Vector3();
const VIEWS = { front:[0, 0, true], side:[Math.PI / 2, 0, true], top:[0, Math.PI / 2 - .001, true], persp:[.7, .25, false] };
let viewName = store.get('view') || 'persp';
function setView(v){ viewName = v; const [y, p, o] = VIEWS[v]; yaw = y; pitch = p; useOrtho = o; pressed('[data-v]', b => b.dataset.v === v); pressed('#ortho', () => useOrtho); store.set('view', v); }
function frameTarget(bb){ bb.getCenter(target); const sz = bb.getSize(new THREE.Vector3()), big = Math.max(sz.x, sz.y, sz.z);
  radius = Math.max(big * 1.2 / (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))), .3); }
function placeCam(){
  const cam = useOrtho ? ortho : persp;
  cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * radius, target.y + Math.sin(pitch) * radius, target.z + Math.cos(yaw) * Math.cos(pitch) * radius);
  cam.up.set(0, 1, 0); cam.lookAt(target);
  if(useOrtho){ const r = $('stage').getBoundingClientRect(), h = radius * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)), a = r.width / r.height;
    Object.assign(ortho, { left:-h * a, right:h * a, top:h, bottom:-h }); ortho.updateProjectionMatrix(); }
  return cam;
}
let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { if(e.button === 1) e.preventDefault(); });   // stop the browser's middle-click scroll mode
canvas.addEventListener('pointerdown', e => { drag = { x:e.clientX, y:e.clientY, pan:e.button === 1 || e.button === 2 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if(!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  const cam = useOrtho ? ortho : persp;
  if(drag.pan){ const r = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), u = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1); target.addScaledVector(r, -dx * radius * .0015).addScaledVector(u, dy * radius * .0015); }
  else { yaw -= dx * .006; pitch = Math.max(-1.5, Math.min(1.5, pitch + dy * .006)); viewName = ''; pressed('[data-v]', () => false); } });
canvas.addEventListener('pointerup', () => drag = null);
canvas.addEventListener('wheel', e => { e.preventDefault(); radius = Math.max(.08, Math.min(8, radius * (1 + e.deltaY * .001))); }, { passive:false });
function resize(){ const r = $('stage').getBoundingClientRect(); renderer.setSize(r.width, r.height, false); persp.aspect = r.width / r.height; persp.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- animation (rigid skin): bones from info.bones · clips from info.anims (angle around each bone's axis) ----------
let mixer = null, animSpeed = 1, clips = {}, curAnim = null;
function makeSkinned(inf){
  const bones = inf.bones.map(b => { const o = new THREE.Bone(); o.name = b.name; return o; });
  const world = inf.bones.map(b => new THREE.Vector3(...(b.joint ? inf.joints[b.joint] : [0, 0, 0])));
  inf.bones.forEach((b, i) => { const pi = b.parent ? inf.bones.findIndex(x => x.name === b.parent) : -1;
    if(pi >= 0){ bones[pi].add(bones[i]); bones[i].position.copy(world[i]).sub(world[pi]); } else bones[i].position.copy(world[i]); });
  const m = new THREE.SkinnedMesh(inf.geometry, inf.material); m.add(bones[0]); m.updateMatrixWorld(true);
  m.bind(new THREE.Skeleton(bones)); m.frustumCulled = false; return m;
}
function clipOf(name, a, inf){
  const AX = { x:new THREE.Vector3(1, 0, 0), y:new THREE.Vector3(0, 1, 0), z:new THREE.Vector3(0, 0, 1) }, tracks = [];
  for(const [bn, keys] of Object.entries(a.tracks)){
    const b = inf.bones.find(x => x.name === bn), ax = AX[b.axis], times = [], vals = [];
    for(const [tm, ang] of keys){ times.push(tm); vals.push(...new THREE.Quaternion().setFromAxisAngle(ax, ang).toArray()); }
    tracks.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', times, vals, THREE.InterpolateLinear));
  }
  return new THREE.AnimationClip(name, a.len, tracks);
}
function setupAnims(){
  mixer = null; clips = {}; curAnim = null;
  if(!info.anims){ $('animBox').hidden = true; return; }
  mixer = new THREE.AnimationMixer(mesh);
  for(const [n, a] of Object.entries(info.anims)) clips[n] = clipOf(n, a, info);
  $('animBox').hidden = false;
  $('animList').innerHTML = Object.entries(info.anims).map(([n, a]) => `<button data-anim="${n}">▶ ${cur.info.exportName}@${n}<small>${a.note || ''} · ${a.len} ${t('sec')}</small></button>`).join('');
  document.querySelectorAll('[data-anim]').forEach(b => b.onclick = () => playAnim(b.dataset.anim));
  $('animInfo').textContent = `${t('bones')} ${info.bones.length}: ${info.bones.map(b => b.name).join(' · ')}`;
}
function playAnim(n){
  if(!mixer) return; mixer.stopAllAction(); curAnim = n;
  const act = mixer.clipAction(clips[n]), loop = $('animLoop').getAttribute('aria-pressed') === 'true' || info.anims[n].loop;
  act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); act.clampWhenFinished = true; act.reset().play();
  pressed('[data-anim]', b => b.dataset.anim === n);
}
$('animLoop').onclick = e => { const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); if(curAnim) playAnim(curAnim); };
$('animSlow').onclick = e => { const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); animSpeed = on ? .25 : 1; };

// ---------- buttons ----------
function pressed(sel, fn){ document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', fn(b) ? 'true' : 'false')); }
function toggle(id, fn){ const b = $(id); b.onclick = () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); fn(on); store.set(id, on ? 1 : 0); };
  const saved = store.get(id); if(saved !== null){ const on = saved === '1'; b.setAttribute('aria-pressed', on); fn(on); } }
// export folder: models with the same info.set share one folder
const exportDir = name => MODELS.find(m => m.info.exportName === name)?.info.set || name;
let shownTH = null;
function renderThemes(TH){
  if(shownTH === TH) return; shownTH = TH;
  const dots = th => Object.values(th.roles).slice(0, 4).map(r => `<i style="background:${r.c}"></i>`).join('');
  $('themes').innerHTML = Object.entries(TH).map(([id, th]) => `<button class="th" data-theme="${id}"><span>${th.name}<small>${th.note}</small></span><span class="dots">${dots(th)}</span></button>`).join('');
  document.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => setTheme(b.dataset.theme));
  pressed('[data-theme]', b => b.dataset.theme === theme);
}
const mBtn = m => `<button data-m="${m.info.id}">${m.info.name}<small>${m.info.note || ''}</small></button>`;
function renderList(){
  $('models').innerHTML = (USER.length ? `<div class="wgrp">${t('grp.user')}</div>` + USER.map(mBtn).join('') : '') +
    `<div class="wgrp">${t('grp.samples')}</div>` + MODELS.filter(m => !USER.includes(m)).map(mBtn).join('');
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { hideFBX(); load(b.dataset.m); });
  if(cur) pressed('[data-m]', b => b.dataset.m === cur.info.id);
}
renderList();
function setTheme(id){ theme = id; store.set('theme', id); pressed('[data-theme]', b => b.dataset.theme === id); load(cur.info.id, true); if(fbxName) showFBX(fbxName); }
document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => setView(b.dataset.v));
$('ortho').onclick = () => { useOrtho = !useOrtho; pressed('#ortho', () => useOrtho); };
toggle('wire', on => { if(wire) wire.visible = on; });
toggle('hand', on => hand.visible = on);
toggle('ruler', on => ruler.visible = on);
// compare soft edges vs all-hard (swaps the normal set · same triangles)
let softOn = true;
function applySoft(){ if(!info) return; const nm = info.geometry.getAttribute('normal'); nm.array.set(softOn ? info.normalsSoft : info.normalsFlat); nm.needsUpdate = true; }
toggle('softEdge', on => { softOn = on; applySoft(); });
// turntable: spin around the vertical axis through the model's center
$('spin').onclick = () => { spin = !spin; pressed('#spin', () => spin);
  if(spin){ const c = info.geometry.boundingBox.getCenter(new THREE.Vector3()); target.x = c.x; target.z = c.z;
    if(Math.abs(pitch) > 1) pitch = .25; useOrtho = false; pressed('#ortho', () => false); viewName = ''; pressed('[data-v]', () => false); } };
function resetView(){ spin = false; pressed('#spin', () => false); setView('persp'); frameTarget(info.geometry.boundingBox); }
$('resetView').onclick = resetView;
addEventListener('keydown', e => { if(e.target.tagName === 'INPUT') return;
  const v = { '1':'front', '2':'side', '3':'top', '4':'persp' }[e.key]; if(v) setView(v);
  if(e.key === 'w' || e.key === 'W') $('wire').click();
  if(e.key === 'r' || e.key === 'R' || e.key === 'f' || e.key === 'F') resetView();
  if(e.key === 's' || e.key === 'S') $('softEdge').click(); });
addEventListener('langchange', () => { renderList(); if(cur) load(cur.info.id, true); });

// ---------- reference images: read ref/ + drag & drop ----------
const IMG = /\.(png|jpe?g|webp|gif)$/i;
function addRef(src, name){ const f = document.createElement('figure'); f.innerHTML = `<img alt=""><figcaption></figcaption>`;
  f.querySelector('img').src = src; f.querySelector('img').alt = name; f.querySelector('figcaption').textContent = name;
  f.querySelector('img').onclick = () => { $('zoom').style.display = 'flex'; $('zoom').querySelector('img').src = src; }; $('refList').appendChild(f); }
function note(txt){ const p = document.createElement('div'); p.className = 'note'; p.textContent = txt; $('refList').appendChild(p); }
fetch('ref/').then(r => r.ok ? r.text() : '').then(html => {
  const files = [...html.matchAll(/href="([^"?]+)"/g)].map(m => decodeURIComponent(m[1])).filter(n => !n.endsWith('/') && IMG.test(n));
  files.forEach(n => addRef('ref/' + encodeURIComponent(n), n));
  if(!files.length) note(t('none.ref')); }).catch(() => note(t('none.ref')));
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
addEventListener('drop', e => { [...e.dataTransfer.files].filter(f => IMG.test(f.name)).forEach(f => addRef(URL.createObjectURL(f), f.name)); });
$('zoom').onclick = () => $('zoom').style.display = 'none';

// ---------- texture · UV panel ----------
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  pressed('[data-tab]', x => x === b); $('tab-ref').hidden = b.dataset.tab !== 'ref'; $('tab-tex').hidden = b.dataset.tab !== 'tex'; store.set('tab', b.dataset.tab); });
let texMode = 'albedo', hot = null;
document.querySelectorAll('[data-map]').forEach(b => b.onclick = () => { texMode = b.dataset.map; pressed('[data-map]', x => x === b); drawTex(); });
['uvDots', 'gridLines'].forEach(id => $(id).onclick = () => { $(id).setAttribute('aria-pressed', $(id).getAttribute('aria-pressed') !== 'true'); drawTex(); });
const isOn = id => $(id).getAttribute('aria-pressed') === 'true';
const grey = v => { const g = Math.round(v * 255); return `rgb(${g},${g},${g})`; };
function drawTex(){
  if(!info) return;
  const cv = $('tex'), g = cv.getContext('2d'), S = cv.width, n = info.cells, c = S / n;
  g.imageSmoothingEnabled = false; g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  if(texMode === 'albedo' || texMode === 'emission') g.drawImage(info.textures.canvases[texMode], 0, 0, S, S);
  else info.slots.forEach((sl, i) => { const p = info.palette[sl]; g.fillStyle = grey(texMode === 'metal' ? (p.metal ?? 0) : (p.smooth ?? .3)); g.fillRect((i % n) * c, Math.floor(i / n) * c, c, c); });
  if(isOn('gridLines')){ g.strokeStyle = '#ffffff30'; g.lineWidth = 1; for(let k = 1; k < n; k++){ g.beginPath(); g.moveTo(k * c + .5, 0); g.lineTo(k * c + .5, S); g.moveTo(0, k * c + .5); g.lineTo(S, k * c + .5); g.stroke(); } }
  info.slots.forEach((sl, i) => {
    const x = (i % n) * c, y = Math.floor(i / n) * c;
    if(sl === hot){ g.strokeStyle = '#f0c874'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, c - 4, c - 4); }
    g.font = '600 11px Chakra Petch, sans-serif'; g.fillStyle = '#000a'; g.fillRect(x + 2, y + 2, g.measureText(sl).width + 6, 15); g.fillStyle = '#fff'; g.fillText(sl, x + 5, y + 13);
  });
  if(isOn('uvDots')){
    const uv = info.geometry.getAttribute('uv'), seen = new Set();
    for(let k = 0; k < uv.count; k++){ const u = uv.getX(k), v = uv.getY(k), id = u.toFixed(4) + ',' + v.toFixed(4); if(seen.has(id)) continue; seen.add(id);
      g.beginPath(); g.arc(u * S, (1 - v) * S, 5, 0, Math.PI * 2); g.fillStyle = '#ff3fd0'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
  }
  $('texInfo').innerHTML = t('tex.info', info.texSize, info.texSize / n, new Set(info.tags).size, n * n);
}
function listSlots(){
  $('slotList').innerHTML = info.slots.map(sl => { const p = info.palette[sl];
    return `<div class="sl" data-slot="${sl}"><i style="background:${p.c}"></i><b>${sl}</b>M ${(p.metal ?? 0).toFixed(2)} · S ${(p.smooth ?? .3).toFixed(2)}${p.emit ? ' · E ' + p.emit : ''}<em>${info.perSlot[sl] || 0} tri</em></div>`; }).join('');
  document.querySelectorAll('.sl').forEach(el => { el.onmouseenter = () => highlight(el.dataset.slot); el.onmouseleave = () => highlight(null); });
}
// highlight the triangles of one color slot on the model
const hiMat = new THREE.MeshBasicMaterial({ color:0xff3fd0, transparent:true, opacity:.55, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
let hiMesh = null;
function highlight(slot){
  hot = slot; if(hiMesh){ scene.remove(hiMesh); hiMesh.geometry.dispose(); hiMesh = null; }
  document.querySelectorAll('.sl').forEach(el => el.classList.toggle('on', el.dataset.slot === slot));
  if(slot && info){
    const pos = info.geometry.getAttribute('position'), out = [];
    info.tags.forEach((tg, k) => { if(tg === slot) for(let v = 0; v < 3; v++) out.push(pos.getX(k * 3 + v), pos.getY(k * 3 + v), pos.getZ(k * 3 + v)); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    hiMesh = new THREE.Mesh(g, hiMat); scene.add(hiMesh);
  }
  drawTex();
}
$('tex').addEventListener('mousemove', e => { const r = $('tex').getBoundingClientRect(), n = info.cells;
  const i = Math.floor((e.clientY - r.top) / r.height * n) * n + Math.floor((e.clientX - r.left) / r.width * n);
  const sl = info.slots[i] || null; if(sl !== hot) highlight(sl); });
$('tex').addEventListener('mouseleave', () => highlight(null));
{ const tb = store.get('tab'); if(tb) document.querySelector(`[data-tab="${tb}"]`)?.click(); }

// ---------- view an exported FBX (export/<Set>/<Name>.fbx + the textures of the selected theme) ----------
// checks that "what the engine gets" looks the same as the studio: real FBX + real PNGs (URP MetallicSmoothness converted back for display)
let fbxName = null, fbxObj = null, fbxInfo = '';
const texLoader = new THREE.TextureLoader();
const loadTex = (url, srgb) => new Promise((ok, bad) => texLoader.load(url, tx => { tx.magFilter = tx.minFilter = THREE.NearestFilter; tx.generateMipmaps = false; if(srgb) tx.colorSpace = THREE.SRGBColorSpace; ok(tx); }, undefined, bad));
async function fbxTextures(name, themeId){
  const M = MODELS.find(m => m.info.exportName === name), TH = M ? themesOf(M) : THEMES, tid = TH[themeId] ? themeId : Object.keys(TH)[0];
  const tn = TH[tid].name.replace(/\s+/g, ''), base = `export/${exportDir(name)}/Textures/${name}${Object.keys(TH).length === 1 ? '' : '_' + tn}_`;
  const [albedo, emission] = await Promise.all([loadTex(base + 'Albedo.png', true), loadTex(base + 'Emission.png', true)]);
  // URP (R = metallic · A = smoothness) → three.js (G = roughness · B = metalness)
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = base + 'MetallicSmoothness.png'; });
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height);
  for(let i = 0; i < d.data.length; i += 4){ const metal = d.data[i], smooth = d.data[i + 3]; d.data[i] = 255; d.data[i + 1] = 255 - smooth; d.data[i + 2] = metal; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); const orm = new THREE.CanvasTexture(cv); orm.magFilter = orm.minFilter = THREE.NearestFilter; orm.generateMipmaps = false;
  return { albedo, emission, orm };
}
async function showFBX(name){
  const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
  const obj = await new FBXLoader().loadAsync(`export/${exportDir(name)}/${name}.fbx`);
  const tex = await fbxTextures(name, theme);
  let tris = 0;
  obj.traverse(o => { if(!o.isMesh) return;
    o.material = new THREE.MeshStandardMaterial({ map:tex.albedo, roughnessMap:tex.orm, metalnessMap:tex.orm, roughness:1, metalness:1, emissiveMap:tex.emission, emissive:0xffffff, emissiveIntensity:1.4 });
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3; });
  if(fbxObj) scene.remove(fbxObj);
  fbxObj = obj; fbxName = name; scene.add(obj);
  mesh.visible = false; wire.visible = false;
  const bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3());
  fbxInfo = `FBX ${name}.fbx · ${tris} tri · ${cm(sz.x)}×${cm(sz.y)}×${cm(sz.z)} cm · scale ${obj.scale.toArray().map(v => +v.toFixed(3)).join(',')}`;
  pressed('[data-fbx]', b => b.dataset.fbx === name);
  frameTarget(bb);
  return fbxInfo;
}
function hideFBX(){ if(fbxObj){ scene.remove(fbxObj); fbxObj = null; } fbxName = null; fbxInfo = ''; if(mesh){ mesh.visible = true; wire.visible = $('wire').getAttribute('aria-pressed') === 'true'; } pressed('[data-fbx]', () => false); }
Promise.all(MODELS.map(m => fetch(`export/${exportDir(m.info.exportName)}/${m.info.exportName}.fbx`, { method:'HEAD' }).then(r => r.ok ? m : null).catch(() => null)))
  .then(list => { list = list.filter(Boolean);
    $('fbxList').innerHTML = list.length ? list.map(m => `<button data-fbx="${m.info.exportName}">📦 ${m.info.exportName}.fbx<small>${t('fbx.hint')}</small></button>`).join('') : `<div class="note">${t('none.export')}</div>`;
    document.querySelectorAll('[data-fbx]').forEach(b => b.onclick = () => fbxName === b.dataset.fbx ? hideFBX() : showFBX(b.dataset.fbx)); });

// ---------- start ----------
load(store.get('id') || MODELS[0].info.id);
setView(VIEWS[viewName] ? viewName : 'persp');
let prev = performance.now();
function frame(now){
  const dt = Math.min(.05, (now - prev) / 1000); prev = now;
  if(mixer) mixer.update(dt * animSpeed);
  if(spin && !drag) yaw += dt * .6;
  const cam = placeCam();
  $('hud').innerHTML = fbxName ? `<b>📦 ${t('fbx.real')}</b><br>${fbxInfo}` : `<b>${cur.info.name}</b><br>${t('st.tris')} ${info.tris > BUDGET ? `<span class="over">${info.tris}</span>` : `<b>${info.tris}</b>`} / ${BUDGET}`;
  $('view').textContent = (viewName ? t('v.' + viewName) : t('view.free')) + (useOrtho ? ' · ' + t('v.ortho') : '');
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.studio = { load, setView, get info(){ return info; }, get mesh(){ return mesh; }, MODELS };   // handy in the browser console

// ---------- headless helpers (driven by tools/server.mjs + tools/headless.mjs) ----------
const Q = new URLSearchParams(location.search);
const log = m => fetch('/__log?m=' + encodeURIComponent(m));
const shot = n => fetch('/__frame?n=' + encodeURIComponent(n), { method:'POST', body:canvas.toDataURL('image/png') });

// QC: index.html?qc=1[&only=<id>] → 5 views + wireframe + texture per model (npm run qc)
if(Q.has('qc')) setTimeout(async () => {
  addEventListener('error', e => log('ERR ' + e.message));
  try{
    for(const M of MODELS.filter(m => !Q.get('only') || m.info.id === Q.get('only'))){
      load(M.info.id); hand.visible = false;
      const sz = info.geometry.boundingBox.getSize(new THREE.Vector3());
      log(`${M.info.id} tris=${info.tris} size=${cm(sz.x)}x${cm(sz.y)}x${cm(sz.z)}cm`);
      for(const [v, w, y] of [['persp', 0], ['front', 0], ['side', 0], ['top', 0], ['persp', 0, Math.PI + .7], ['persp', 1]]){
        setView(v); if(y !== undefined) yaw = y; frameTarget(info.geometry.boundingBox); wire.visible = !!w;
        renderer.render(scene, placeCam()); await shot(`${M.info.id}-${v}${y !== undefined ? '-back' : ''}${w ? '-wire' : ''}`);
      }
      wire.visible = false;
      await fetch('/__frame?n=' + M.info.id + '-texture', { method:'POST', body:$('tex').toDataURL('image/png') });
    }
    log('DONE');
  }catch(e){ log('ERR ' + e.message); }
}, 1500);

// EXPORT: index.html?export=<id> → <Set>/<Name>.glb (one mesh for every theme) + Textures/<Name>_<Theme>_Albedo|MetallicSmoothness|Emission.png
if(Q.get('export')) setTimeout(async () => {
  const post = (n, body) => fetch('/__file?n=' + encodeURIComponent(n), { method:'POST', body });
  addEventListener('error', e => log('ERR ' + e.message));
  try{
    const M = MODELS.find(m => m.info.id === Q.get('export')); if(!M){ log('ERR unknown model id ' + Q.get('export')); return; }
    const TH = themesOf(M), NAME = M.info.exportName || M.info.id, base = M.build(Object.keys(TH)[0]);
    const geo = base.geometry.clone(); geo.setAttribute('normal', new THREE.Float32BufferAttribute(base.normalsSoft, 3));
    // glTF counts V from the top, studio textures (flipY) from the bottom → flip V, otherwise every UV points at the wrong row
    const uv = geo.getAttribute('uv'); for(let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const mat = new THREE.MeshStandardMaterial({ name:'M_' + NAME });
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    let glb;
    if(base.bones){                                           // rigged: SkinnedMesh + every clip (Blender splits avatar + <Name>@<clip>)
      const sm = makeSkinned({ ...base, geometry:geo, material:mat }); sm.name = NAME;
      const grp = new THREE.Group(); grp.name = NAME + '_Rig'; grp.add(sm);
      const cl = Object.entries(base.anims).map(([n, a]) => clipOf(n, a, base));
      glb = await new GLTFExporter().parseAsync(grp, { binary:true, animations:cl });
      log(`SKIN bones=${base.bones.length} clips=${cl.map(c => c.name).join(',')}`);
    } else {
      const m = new THREE.Mesh(geo, mat); m.name = NAME;
      glb = await new GLTFExporter().parseAsync(m, { binary:true });
    }
    const DIR = exportDir(NAME);
    await post(`${DIR}/${NAME}.glb`, glb);
    for(const [id, th] of Object.entries(TH)){
      const r = M.build(id), tn = th.name.replace(/\s+/g, ''), c = r.textures.canvases;
      const pre = Object.keys(TH).length === 1 ? NAME : `${NAME}_${tn}`;
      await post(`${DIR}/Textures/${pre}_Albedo.png`, c.albedo.toDataURL('image/png'));
      await post(`${DIR}/Textures/${pre}_MetallicSmoothness.png`, c.unityMetal.toDataURL('image/png'));
      await post(`${DIR}/Textures/${pre}_Emission.png`, c.emission.toDataURL('image/png'));
    }
    const sz = base.geometry.boundingBox.getSize(new THREE.Vector3());
    log(`EXPORT ${NAME} dir=${DIR} tris=${base.tris} size=${cm(sz.x)}x${cm(sz.y)}x${cm(sz.z)}cm themes=${Object.keys(TH).length}`); log('DONE');
  }catch(e){ log('ERR ' + e.message); }
}, 1500);
